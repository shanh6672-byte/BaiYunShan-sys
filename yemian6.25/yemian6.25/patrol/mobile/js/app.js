var miniMap, myMarker, myPath, myPathPoints;
var app = {
  ws: null,
  gps: null,
  storage: null,
  patrolId: null,
  userId: null,
  userName: null,
  patrolling: false,
  pointCount: 0,
  unsyncedCount: 0,
  _syncing: false,
  startTime: 0,
  totalDistance: 0,
  lastPoint: null,
  syncTimer: null,
  durationTimer: null,
  firstFix: false,
  _registered: false,

  async init() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WsClient(proto + '//' + location.host);
    this.gps = new GpsCollector({ minAccuracy: 60, minDistance: 5 });
    this.gps.onDebug = function(msg) { console.log('[GPS] ' + msg); };
    this.gps.onStatus = function(msg) {
      var el = document.getElementById('gpsStatus');
      if (el) { el.textContent = msg; el.style.display = 'block'; el.style.color = '#ff9800'; }
    };
    this.storage = new OfflineStorage();
    await this.storage.init();
    await this._loadOptions();
  },

  _allUsers: [],
  _allPatrols: [],

  async _loadOptions() {
    try {
      var u = await fetch('/api/users');
      this._allUsers = await u.json();
      this._renderUserSelect();
    } catch(e) { console.log('[Init] 用户加载失败:', e); }
    try {
      var p = await fetch('/api/patrols');
      this._allPatrols = await p.json();
    } catch(e) { console.log('[Init] 任务加载失败:', e); }
  },

  _renderUserSelect() {
    var selU = document.getElementById('selUser');
    if (!selU) return;
    selU.innerHTML = '<option value="">-- 选择巡护员 --</option>';
    var self = this;
    this._allUsers.forEach(function(u) {
      if (u.role === 'ranger') {
        var o = document.createElement('option');
        o.value = u.id; o.textContent = u.name + ' (' + u.id + ')'; o.dataset.name = u.name;
        selU.appendChild(o);
      }
    });
  },

  login() {
    var selU = document.getElementById('selUser');
    var password = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginError');

    if (!selU.value) { if (errEl) { errEl.textContent = '请选择巡护员'; errEl.style.display = 'block'; } return; }
    if (!password) { if (errEl) { errEl.textContent = '请输入密码'; errEl.style.display = 'block'; } return; }

    var uid = selU.value;
    var uname = selU.selectedOptions[0].dataset.name || uid;

    this.userId = uid;
    this.userName = uname;

    if (errEl) errEl.style.display = 'none';
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';
    document.getElementById('displayUserId').textContent = uname;

    // 加载该用户的巡护任务
    this._renderPatrolSelect();

    this._initMap();

    var self = this;
    this.ws.onMessage = function(m) { self._onMsg(m); };
    this.ws.onStatusChange = function(c) { self._onConn(c); };
    this.ws.onReconnected = function() {
      self._registered = false;
      if (self.patrolId && self.userId) {
        self.ws.send({ type: 'register', role: 'mobile', patrolId: self.patrolId, userId: self.userId, userName: self.userName });
      }
    };
    this.ws.connect();
  },

  _renderPatrolSelect() {
    var selP = document.getElementById('selPatrol');
    if (!selP) return;
    selP.innerHTML = '<option value="">-- 选择任务 --</option>';
    var statusNames = { pending: '待开始', active: '进行中', completed: '已完成' };
    var self = this;
    this._allPatrols.forEach(function(p) {
      var isMember = !p.members || p.members.length === 0 || p.members.some(function(m) { return m.id === self.userId; });
      if (!isMember) return;
      var o = document.createElement('option');
      o.value = p.id; o.textContent = p.name + ' [' + (statusNames[p.status] || p.status) + ']';
      selP.appendChild(o);
    });
  },

  _assignedRouteLayer: null,

  confirmTask() {
    var selP = document.getElementById('selPatrol');
    if (!selP || !selP.value) { alert('请选择巡护任务'); return; }
    this.patrolId = selP.value;
    document.getElementById('displayPatrolId').textContent = this.patrolId;
    document.getElementById('btnStart').style.display = 'inline-block';
    document.getElementById('btnStop').style.display = 'none';
    this._loadAssignedRoute();
  },

  async _loadAssignedRoute() {
    // 清除旧路线
    if (this._assignedRouteLayer && miniMap) {
      miniMap.removeLayer(this._assignedRouteLayer);
      this._assignedRouteLayer = null;
    }
    try {
      var resp = await fetch('/api/routes/patrol/' + this.patrolId);
      var routes = await resp.json();
      if (routes.length === 0) {
        this._log('该任务暂无预设路线');
        return;
      }
      var route = routes[0];
      var points = [];
      try { points = JSON.parse(route.points_json); } catch(e) { points = []; }
      if (points.length < 2) return;

      if (miniMap) {
        this._assignedRouteLayer = L.layerGroup().addTo(miniMap);
        var latlngs = points.map(function(p) {
          var gcj = wgs84ToGcj02(p.lng, p.lat);
          return [gcj.lat, gcj.lng];
        });
        L.polyline(latlngs, { color: '#ff9800', weight: 3, opacity: 0.7, dashArray: '8 4' })
          .bindTooltip(route.name || '预设路线 (' + (parseFloat(route.distance) || 0).toFixed(2) + 'km)')
          .addTo(this._assignedRouteLayer);

        // 起终点
        L.circleMarker(latlngs[0], { radius: 7, fillColor: '#00e676', color: '#fff', weight: 2, fillOpacity: 0.9 })
          .bindTooltip('起点').addTo(this._assignedRouteLayer);
        L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, fillColor: '#ff5252', color: '#fff', weight: 2, fillOpacity: 0.9 })
          .bindTooltip('终点').addTo(this._assignedRouteLayer);

        // 自适应视野
        miniMap.fitBounds(L.latLngBounds(latlngs).pad(0.15));
        this._log('已加载预设路线: ' + route.name + ' (' + parseFloat(route.distance).toFixed(2) + 'km, ' + points.length + '节点)');
      }
    } catch(e) {
      this._log('路线加载失败: ' + e.message);
    }
  },

  _initMap() {
    if (typeof L === 'undefined') {
      document.getElementById('miniMap').innerHTML =
        '<div style="text-align:center;padding-top:90px;color:#999">地图加载中...</div>';
      return;
    }
    miniMap = L.map('miniMap', { attributionControl: false, zoomControl: true }).setView([26.65, 106.73], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(miniMap);
    myPathPoints = [];
  },

  _waitConn(cb) {
    if (this.ws.isConnected) { cb(); return; }
    var a = 0, self = this;
    var t = setInterval(function() {
      a++;
      if (self.ws.isConnected) { clearInterval(t); cb(); }
      else if (a > 60) { clearInterval(t); self._log('连接超时'); }
    }, 200);
  },

  startPatrol() {
    if (this.patrolling) return;
    if (!this.patrolId) { alert('请先选择巡护任务'); return; }
    var self = this;

    this._doStart();

    // 无论 WS 是否已连接，都要注册（Track 在 login 时已注册，巡逻端在 confirmTask 后注册）
    var doRegister = function() {
      self.ws.send({ type: 'register', role: 'mobile', patrolId: self.patrolId, userId: self.userId, userName: self.userName });
    };
    if (this.ws.isConnected) {
      doRegister();
    } else {
      this._log('网络未连接，数据将本地缓存');
      this.ws.connect();
      this._waitConn(doRegister);
    }
  },

  _doStart() {
    var self = this;
    this.patrolling = true;
    this.startTime = Date.now();
    this.totalDistance = 0;
    this.pointCount = 0;
    this.rawCount = 0;
    this.lastPoint = null;
    this.firstFix = false;

    var gpsEl = document.getElementById('gpsStatus');
    if (gpsEl) { gpsEl.textContent = '等待GPS定位...'; gpsEl.style.display = 'block'; gpsEl.style.color = '#ff9800'; }

    this.gps.onRawPosition = function(raw) {
      self.rawCount = (self.rawCount || 0) + 1;
      var src = raw.source || '?';
      if (!self.firstFix) {
        self.firstFix = true;
        var el = document.getElementById('gpsStatus');
        if (el) { el.textContent = 'GPS已定位 (精度' + raw.acc.toFixed(0) + 'm, ' + src + ')'; el.style.color = '#00e676'; }
        self._log('首次定位成功(' + src + ')，精度 ' + raw.acc.toFixed(0) + 'm');
        var gcjInit = wgs84ToGcj02(raw.lng, raw.lat);
        if (miniMap) miniMap.setView([gcjInit.lat, gcjInit.lng], 16);
      }
      document.getElementById('gpsRaw').textContent = self.rawCount + ' (' + src + ')';
    };

    this.gps.onPosition = function(point) {
      self.pointCount++;
      self._log('有效点#' + self.pointCount + ' lat=' + point.latitude.toFixed(6) + ' lng=' + point.longitude.toFixed(6) + ' 精度=' + point.accuracy.toFixed(1) + 'm');
      if (!self._registered) {
        self.storage.addPoint(point);
        document.getElementById('sendStatus').textContent = '等待注册...';
        document.getElementById('sendStatus').style.color = '#ff9800';
        if (miniMap) {
          var gcj = wgs84ToGcj02(point.longitude, point.latitude);
          var ll = L.latLng(gcj.lat, gcj.lng);
          if (!myMarker) { myMarker = L.circleMarker(ll, { radius: 6, fillColor: '#00e676', color: '#fff', weight: 2, fillOpacity: 0.9 }).addTo(miniMap); }
          else myMarker.setLatLng(ll);
          myPathPoints.push(ll);
          if (!myPath) { myPath = L.polyline(myPathPoints, { color: '#00e676', weight: 3, opacity: 0.7 }).addTo(miniMap); }
          else myPath.setLatLngs(myPathPoints);
        }
        document.getElementById('lastLat').textContent = point.latitude.toFixed(6);
        document.getElementById('lastLng').textContent = point.longitude.toFixed(6);
        document.getElementById('lastAcc').textContent = point.accuracy.toFixed(1) + 'm';
        document.getElementById('pointCount').textContent = self.pointCount;
        return;
      }
      var el = document.getElementById('gpsStatus');
      if (el && self.firstFix) el.style.display = 'none';

      if (self.lastPoint) self.totalDistance += haversineDistance(self.lastPoint, point);
      self.lastPoint = point;

      var sent = self.ws.send({
        type: 'location_update', patrolId: self.patrolId, userId: self.userId, userName: self.userName,
        latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy,
        altitude: point.altitude, altitudeAccuracy: point.altitudeAccuracy,
        speed: point.speed, heading: point.heading, timestamp: point.recorded_at
      });

      self.storage.addPoint(point);

      document.getElementById('lastLat').textContent = point.latitude.toFixed(6);
      document.getElementById('lastLng').textContent = point.longitude.toFixed(6);
      document.getElementById('lastAcc').textContent = point.accuracy.toFixed(1) + 'm';
      document.getElementById('lastSpeed').textContent = point.speed ? (point.speed * 3.6).toFixed(1) + 'km/h' : '-';
      document.getElementById('pointCount').textContent = self.pointCount;
      document.getElementById('totalDist').textContent = Math.round(self.totalDistance);
      document.getElementById('sendStatus').textContent = sent ? '已发送' : '缓存中';
      document.getElementById('sendStatus').style.color = sent ? '#00e676' : '#ff9800';

      if (miniMap) {
        var gcj2 = wgs84ToGcj02(point.longitude, point.latitude);
        var ll = L.latLng(gcj2.lat, gcj2.lng);
        if (!myMarker) { myMarker = L.circleMarker(ll, { radius: 6, fillColor: '#00e676', color: '#fff', weight: 2, fillOpacity: 0.9 }).addTo(miniMap); }
        else myMarker.setLatLng(ll);
        myPathPoints.push(ll);
        if (!myPath) { myPath = L.polyline(myPathPoints, { color: '#00e676', weight: 3, opacity: 0.7 }).addTo(miniMap); }
        else myPath.setLatLngs(myPathPoints);
      }
    };

    this.gps.onError = function(err) {
      var el = document.getElementById('gpsStatus');
      if (el) { el.textContent = 'X ' + err; el.style.display = 'block'; el.style.color = '#ff3d3d'; }
      self._log('X ' + err);
    };

    var ok = this.gps.start();
    if (!ok) {
      var el = document.getElementById('gpsStatus');
      if (el) { el.textContent = 'X 设备不支持GPS'; el.style.display = 'block'; el.style.color = '#ff3d3d'; }
      return;
    }

    document.getElementById('btnStart').style.display = 'none';
    document.getElementById('btnStop').style.display = 'inline-block';
    document.getElementById('patrolStatus').textContent = '巡护中';

    this.ws.send({ type: 'status_change', patrolId: this.patrolId, userId: this.userId, userName: this.userName, status: 'active' });

    this.syncTimer = setInterval(function() { self._trySync(); }, 30000);
    this.durationTimer = setInterval(function() {
      if (!self.startTime) return;
      var sec = Math.floor((Date.now() - self.startTime) / 1000);
      document.getElementById('duration').textContent =
        String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }, 1000);

    this._log('开始巡护，等待GPS定位...');
  },

  stopPatrol() {
    this.patrolling = false;
    this.gps.stop();
    clearInterval(this.syncTimer);
    clearInterval(this.durationTimer);

    document.getElementById('btnStart').style.display = 'inline-block';
    document.getElementById('btnStop').style.display = 'none';
    document.getElementById('patrolStatus').textContent = '已结束';
    var gpsEl = document.getElementById('gpsStatus');
    if (gpsEl) gpsEl.style.display = 'none';

    var durSec = Math.floor((Date.now() - this.startTime) / 1000);
    this.ws.send({ type: 'status_change', patrolId: this.patrolId, userId: this.userId, userName: this.userName, status: 'ended', duration: durSec, distance: Math.round(this.totalDistance), pointCount: this.pointCount });
    this._trySync();
    this._log('结束，共 ' + this.pointCount + ' 有效点，总距离 ' + Math.round(this.totalDistance) + 'm');
  },

  async _trySync() {
    if (this._syncing) return;
    this._syncing = true;
    try {
      var batch = await this.storage.getBatchForSync(200);
      if (batch.length === 0) { this._syncing = false; return; }
      var self = this;
      var resp = await fetch('/api/trajectory/' + this.patrolId + '/batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.userId, points: batch })
      });
      if (resp.ok) {
        var data = await resp.json();
        await this.storage.purgeUploaded(batch);
        if (data.inserted > 0) self._log('同步 ' + data.inserted + ' 条离线数据');
      } else {
        await this.storage.markFailed(batch);
      }
    } catch(e) {}
    this._syncing = false;
  },

  _onMsg(msg) {
    if (msg.type === 'registered') {
      this._registered = true;
      this._log('已注册到服务端，开始发送位置数据');
    }
  },

  _onConn(connected) {
    var el = document.getElementById('connStatus');
    if (connected) { el.textContent = '在线'; el.className = 'chip online'; }
    else { el.textContent = '离线'; el.className = 'chip offline'; }
    if (connected && this.patrolling) this._trySync();
  },

  _log(msg) {
    var el = document.getElementById('log');
    var t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    el.innerHTML += '<div>[' + t + '] ' + msg + '</div>';
    el.scrollTop = el.scrollHeight;
  }
};

// 启动
(function() {
  var t = setInterval(function() {
    if (typeof WsClient !== 'undefined') { clearInterval(t); app.init(); }
  }, 100);
  setTimeout(function() { clearInterval(t); }, 10000);
})();

window.addEventListener('online', function() { if (app.patrolling) app._trySync(); });
