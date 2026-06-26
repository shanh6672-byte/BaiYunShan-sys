// patrol-task-manager.js — 巡护任务管理（任务发布 + 路线规划 + 任务执行 + 巡护日志）
var patrolTaskMgr = {
  _users: [],
  _patrols: [],
  _logs: [],
  _routePoints: [],
  _routeLine: null,
  _routeMap: null,

  async init() {
    await this._loadData();
    this._renderPublishForm();
    this._renderExecuteTable();
    this._renderRoutePlanning();
    this._renderLogManagement();
  },

  _verifyAdmin(callback) {
    var pwd = prompt('请输入管理员密码以删除任务:');
    if (!pwd) return;
    var admin = this._users.find(function(u) { return u.role === 'admin'; });
    if (!admin) { alert('未找到管理员账户'); return; }
    if (pwd === admin.password) {
      callback(pwd);
    } else {
      alert('密码错误，只有管理员才能删除任务');
    }
  },

  async _loadData() {
    try {
      var u = await fetch('/api/users');
      this._users = await u.json();
    } catch(e) { console.log('[TaskMgr] 用户加载失败，使用本地数据'); }
    try {
      var p = await fetch('/api/patrols');
      this._patrols = await p.json();
    } catch(e) { console.log('[TaskMgr] 任务加载失败，使用本地数据'); }
    // 自动刷新路线分配下拉框
    this._populatePatrolSelect();
  },

  _renderPublishForm() {
    var container = document.getElementById('inner-publish');
    if (!container) return;

    var rangerOpts = '';
    this._users.forEach(function(u) {
      if (u.role === 'ranger') {
        rangerOpts += '<option value="' + u.id + '">' + u.name + ' (' + u.id + ')</option>';
      }
    });

    var now = new Date();
    var pad = function(v) { return String(v).padStart(2, '0'); };
    var fmt = function(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    var endDate = new Date(now.getTime() + 86400000);

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>新建巡护任务</h3><div class="card-actions"><button class="btn btn-primary" id="btnPublishTask">发布任务</button></div></div>' +
      '<div class="card-body">' +
        '<div class="form-group"><label>任务名称</label><input type="text" id="taskName" placeholder="输入任务名称"/></div>' +
        '<div class="form-group"><label>任务类型</label><select class="select-full" id="taskType"><option>日常巡护</option><option>专项巡护</option><option>应急巡护</option></select></div>' +
        '<div class="form-group"><label>指派护林员</label><select class="select-full" id="taskMembers" multiple style="height:120px;">' + rangerOpts + '</select><div style="font-size:10px;color:var(--text-muted);">Ctrl+点击多选</div></div>' +
        '<div class="form-row"><div class="form-group half"><label>开始时间</label><input type="datetime-local" id="taskStartTime" value="' + fmt(now) + '"/></div>' +
        '<div class="form-group half"><label>结束时间</label><input type="datetime-local" id="taskEndTime" value="' + fmt(endDate) + '"/></div></div>' +
        '<div class="form-group"><label>巡护区域</label><select class="select-full" id="taskArea"><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>' +
        '<div class="form-group"><label>任务描述</label><textarea rows="3" id="taskDesc" placeholder="输入任务描述..."></textarea></div>' +
        '<div id="taskPublishMsg" style="font-size:12px;margin-top:8px;display:none;"></div>' +
      '</div></div>';

    var self = this;
    document.getElementById('btnPublishTask').onclick = function() { self._publishTask(); };
  },

  async _publishTask() {
    var name = document.getElementById('taskName').value.trim();
    var taskType = document.getElementById('taskType').value;
    var area = document.getElementById('taskArea').value;
    var desc = document.getElementById('taskDesc').value.trim();
    var startTime = document.getElementById('taskStartTime').value;
    var endTime = document.getElementById('taskEndTime').value;
    var membersSel = document.getElementById('taskMembers');
    var members = [];
    for (var i = 0; i < membersSel.options.length; i++) {
      if (membersSel.options[i].selected) members.push(membersSel.options[i].value);
    }

    if (!name) { this._showMsg('请输入任务名称', 'error'); return; }
    if (members.length === 0) { this._showMsg('请选择至少一名护林员', 'error'); return; }

    var ts = new Date().getTime();
    var taskId = 'P' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(ts % 100000).padStart(3, '0');

    var startTs = startTime ? new Date(startTime).getTime() : ts;
    var endTs = endTime ? new Date(endTime).getTime() : ts + 86400000;

    try {
      var resp = await fetch('/api/patrols', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId, name: name, area: area, task_type: taskType,
          description: desc, start_time: startTs, end_time: endTs, members: members
        })
      });
      if (resp.ok) {
        this._showMsg('任务 ' + taskId + ' 发布成功！移动端可查看', 'success');
        // 清空表单
        document.getElementById('taskName').value = '';
        document.getElementById('taskDesc').value = '';
        membersSel.selectedIndex = -1;
        // 刷新执行列表
        await this._loadData();
        this._renderExecuteTable();
      } else {
        var err = await resp.json();
        this._showMsg('发布失败: ' + (err.error || '未知错误'), 'error');
      }
    } catch(e) {
      this._showMsg('发布失败: 网络错误，请检查服务是否启动', 'error');
    }
  },

  _showMsg(msg, type) {
    var el = document.getElementById('taskPublishMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.color = type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)';
    setTimeout(function() { el.style.display = 'none'; }, 4000);
  },

  _renderExecuteTable() {
    var container = document.getElementById('inner-execute');
    if (!container) return;

    var statusNames = { pending: '待开始', active: '进行中', completed: '已完成', cancelled: '已取消' };
    var statusTags = { pending: 'tag-orange', active: 'tag-green', completed: 'tag-blue', cancelled: 'tag-gray' };

    var rows = '';
    var self = this;
    if (this._patrols.length === 0) {
      rows = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">暂无任务，请先发布任务</td></tr>';
    } else {
      this._patrols.forEach(function(p) {
        var memberNames = (p.members || []).map(function(m) { return m.name; }).join(', ');
        var statusName = statusNames[p.status] || p.status;
        var tagClass = statusTags[p.status] || 'tag-gray';
        var actions = '';
        if (p.status === 'pending') {
          actions = '<a class="link-btn btn-start-task" data-id="' + p.id + '">启动</a><a class="link-btn btn-del-task" data-id="' + p.id + '" style="color:var(--accent-red);">删除</a>';
        } else if (p.status === 'active') {
          actions = '<a class="link-btn btn-end-task" data-id="' + p.id + '">结束</a>';
        } else {
          actions = '<a class="link-btn btn-del-task" data-id="' + p.id + '" style="color:var(--accent-red);">删除</a>';
        }
        rows += '<tr><td>' + p.id + '</td><td>' + p.name + '</td><td>' + memberNames + '</td>' +
          '<td>' + (p.task_type || '日常巡护') + '</td>' +
          '<td><span class="tag ' + tagClass + ' tag-sm">' + statusName + '</span></td>' +
          '<td>' + actions + '</td></tr>';
      });
    }

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>任务执行管理</h3><div class="card-actions"><button class="btn btn-outline btn-sm" id="btnRefreshTasks">刷新</button></div></div>' +
      '<div class="card-body"><table class="data-table"><thead><tr><th>任务编号</th><th>任务名称</th><th>执行人</th><th>类型</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    document.getElementById('btnRefreshTasks').onclick = async function() {
      await self._loadData();
      self._renderExecuteTable();
    };

    // Bind action buttons
    container.querySelectorAll('.btn-start-task').forEach(function(btn) {
      btn.onclick = async function() {
        var id = this.dataset.id;
        await fetch('/api/patrols/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
        await self._loadData();
        self._renderExecuteTable();
      };
    });
    container.querySelectorAll('.btn-end-task').forEach(function(btn) {
      btn.onclick = async function() {
        var id = this.dataset.id;
        await fetch('/api/patrols/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) });
        await self._loadData();
        self._renderExecuteTable();
      };
    });
    container.querySelectorAll('.btn-del-task').forEach(function(btn) {
      btn.onclick = function() {
        var id = this.dataset.id;
        var self2 = self;
        self._verifyAdmin(async function(pwd) {
          if (!confirm('确定删除该任务？此操作不可恢复。')) return;
          var resp = await fetch('/api/patrols/' + id, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword: pwd })
          });
          if (!resp.ok) { var err = await resp.json(); alert('删除失败: ' + (err.error || resp.status)); return; }
          await self2._loadData();
          self2._renderExecuteTable();
        });
      };
    });
  },

  // ==================== 路线规划 ====================
  _routeMarkers: [],
  _routeEditMode: false,
  _routeTemplates: [],
  _autoRouteLayer: null,

  _renderRoutePlanning() {
    var container = document.getElementById('inner-route');
    if (!container) return;
    var self = this;

    // 加载模板
    this._loadTemplates();

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>路线规划</h3></div>' +
      '<div class="card-body">' +
      // 三模式切换
      '<div class="route-tools" style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;">' +
      '<button class="btn btn-sm btn-outline active" id="btnModeDraw">手绘路线</button>' +
      '<button class="btn btn-sm btn-outline" id="btnModeImport">导入路线</button>' +
      '<button class="btn btn-sm btn-outline" id="btnModeAuto">自动生成</button>' +
      '</div>' +

      // 手绘/导入模式的控件
      '<div id="routeDrawPanel">' +
      '<div class="form-group"><label>路线名称</label><input type="text" id="routeName" placeholder="输入路线名称"/></div>' +
      '<div class="form-row"><div class="form-group half"><label>预计时长(h)</label><input type="number" id="routeDuration" value="4" step="0.5"/></div>' +
      '<div class="form-group half"><label>路线长度</label><span id="routeDistance" style="font-size:14px;color:var(--accent-green);padding-top:18px;display:block;">0.00 km</span></div></div>' +
      '<div class="form-group"><label>覆盖林区</label><span id="routeCoverage" style="font-size:12px;color:var(--text-muted);">-</span></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">' +
      '<button class="btn btn-sm btn-primary" id="btnStartDraw">开始绘制</button>' +
      '<button class="btn btn-sm" id="btnEditRoute" disabled>编辑路线</button>' +
      '<button class="btn btn-sm" id="btnUndoPoint" disabled>撤销节点</button>' +
      '<button class="btn btn-sm btn-outline" id="btnClearRoute">清除路线</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;" id="routeHint">点击"开始绘制"后，在地图上点击添加路线节点，双击完成绘制</div>' +
      '</div>' +

      // 导入模式控件
      '<div id="routeImportPanel" style="display:none;">' +
      '<div class="form-group"><label>导入空间数据文件</label>' +
      '<input type="file" id="routeFileInput" accept=".geojson,.gpx,.kml" style="display:block;margin-top:4px;"/>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">支持 GeoJSON (LineString/MultiLineString)、GPX 轨迹文件</div></div>' +
      '<div id="routeImportPreview" style="font-size:12px;color:var(--accent-green);margin-top:4px;"></div>' +
      '</div>' +

      // 自动生成控件
      '<div id="routeAutoPanel" style="display:none;">' +
      '<div class="form-row"><div class="form-group half"><label>目标林区</label><select class="select-full" id="autoArea"><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option><option>全部林区</option></select></div>' +
      '<div class="form-group half"><label>巡护模式</label><select class="select-full" id="autoMode"><option>全面覆盖</option><option>边界巡查</option><option>重点区域</option></select></div></div>' +
      '<div class="form-row"><div class="form-group half"><label>路线密度</label><select class="select-full" id="autoDensity"><option>稀疏 (~5km)</option><option selected>适中 (~8km)</option><option>密集 (~12km)</option></select></div>' +
      '<div class="form-group half"><label>起点偏好</label><select class="select-full" id="autoStart"><option>林区入口</option><option>中心向外</option><option>随机起点</option></select></div></div>' +
      '<button class="btn btn-sm btn-primary" id="btnAutoGenerate">生成推荐路线</button>' +
      '<div id="autoGenResult" style="font-size:12px;margin-top:6px;display:none;"></div>' +
      '</div>' +

      // 操作栏
      '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">' +
      '<button class="btn btn-sm btn-primary" id="btnSaveTemplate">保存为模板</button>' +
      '<button class="btn btn-sm" id="btnLoadTemplate">加载模板</button>' +
      '<button class="btn btn-sm btn-outline" id="btnExportGeoJSON">导出GeoJSON</button>' +
      '<button class="btn btn-sm btn-outline" id="btnExportGPX">导出GPX</button>' +
      '</div>' +

      // 分配至巡护任务
      '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,170,255,0.15);">' +
      '<div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">将此路线分配至巡护任务</div>' +
      '<div style="display:flex;gap:6px;align-items:center;">' +
      '<select class="select-full" id="assignPatrolSelect" style="flex:1;"><option value="">-- 选择巡护任务 --</option></select>' +
      '<button class="btn btn-sm btn-primary" id="btnAssignRoute" disabled>分配</button></div>' +
      '<div id="assignedRouteInfo" style="margin-top:6px;font-size:12px;display:none;"></div>' +
      '</div>' +

      // 模板列表
      '<div id="routeTemplateList" style="display:none;margin-top:8px;max-height:150px;overflow-y:auto;"></div>' +

      '<div id="routeMsg" style="font-size:12px;margin-top:8px;display:none;"></div>' +
      '</div></div>';

    this._initRouteMap();
    this._bindRouteEvents();
  },

  _bindRouteEvents() {
    var self = this;

    // 模式切换
    document.getElementById('btnModeDraw').onclick = function() {
      self._switchMode('draw');
    };
    document.getElementById('btnModeImport').onclick = function() {
      self._switchMode('import');
    };
    document.getElementById('btnModeAuto').onclick = function() {
      self._switchMode('auto');
    };

    // 手绘
    document.getElementById('btnStartDraw').onclick = function() { self._startDrawing(); };
    document.getElementById('btnEditRoute').onclick = function() { self._toggleEditMode(); };
    document.getElementById('btnUndoPoint').onclick = function() { self._undoLastPoint(); };
    document.getElementById('btnClearRoute').onclick = function() { self._clearRoute(); };

    // 导入
    document.getElementById('routeFileInput').onchange = function(e) { self._handleFileImport(e); };

    // 自动生成
    document.getElementById('btnAutoGenerate').onclick = function() { self._autoGenerateRoute(); };

    // 模板
    document.getElementById('btnSaveTemplate').onclick = function() { self._saveTemplate(); };
    document.getElementById('btnLoadTemplate').onclick = function() { self._toggleTemplateList(); };

    // 导出
    document.getElementById('btnExportGeoJSON').onclick = function() { self._exportFormat('geojson'); };
    document.getElementById('btnExportGPX').onclick = function() { self._exportFormat('gpx'); };

    // 分配至任务
    document.getElementById('btnAssignRoute').onclick = function() { self._assignRouteToTask(); };
    this._populatePatrolSelect();
  },

  _switchMode(mode) {
    var self = this;
    ['btnModeDraw','btnModeImport','btnModeAuto'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });
    document.getElementById('btnMode' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');

    document.getElementById('routeDrawPanel').style.display = mode === 'draw' ? 'block' : 'none';
    document.getElementById('routeImportPanel').style.display = mode === 'import' ? 'block' : 'none';
    document.getElementById('routeAutoPanel').style.display = mode === 'auto' ? 'block' : 'none';

    if (mode !== 'draw') {
      this._exitDrawingMode();
    }
  },

  // ===== 手绘路线 =====
  _startDrawing() {
    this._clearRoute();
    this._exitEditMode();
    var self = this;
    var map = this._routeMap;
    if (!map) { this._initRouteMap(); map = this._routeMap; }

    map.getContainer().style.cursor = 'crosshair';
    document.getElementById('routeHint').textContent = '绘制中：点击地图添加路线节点，双击完成绘制';
    document.getElementById('routeHint').style.color = '#00e676';

    function onClick(e) {
      self._routePoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
      if (!self._routeLine) {
        self._routeLine = L.polyline([], { color: '#00e676', weight: 3, opacity: 0.8 }).addTo(map);
      }
      self._routeLine.addLatLng(e.latlng);

      // 添加可拖拽的节点标记
      var marker = L.circleMarker(e.latlng, { radius: 5, fillColor: '#00e676', color: '#fff', weight: 1.5, fillOpacity: 0.9, draggable: false })
        .bindTooltip('节点' + self._routePoints.length).addTo(map);
      self._routeMarkers.push(marker);

      self._updateDistance();
      self._updateCoverage();
      document.getElementById('btnEditRoute').disabled = false;
      document.getElementById('btnUndoPoint').disabled = false;
    }

    map.on('click', onClick);

    map.on('dblclick', function() {
      map.off('click', onClick);
      map.getContainer().style.cursor = '';
      document.getElementById('routeHint').textContent = '绘制完成（' + self._routePoints.length + '个节点）。可点击"编辑路线"调整节点位置';
      document.getElementById('routeHint').style.color = 'var(--accent-green)';
      self._updateDistance();
      self._updateCoverage();
      if (self._routePoints.length >= 2) {
        document.getElementById('btnEditRoute').disabled = false;
      }
    });

    this._drawCleanup = function() {
      map.off('click', onClick);
      map.getContainer().style.cursor = '';
    };
  },

  _undoLastPoint() {
    if (this._routePoints.length === 0) return;
    this._routePoints.pop();
    if (this._routeMarkers.length > 0) {
      var m = this._routeMarkers.pop();
      this._routeMap.removeLayer(m);
    }
    if (this._routeLine) {
      var latlngs = this._routePoints.map(function(p) { return [p.lat, p.lng]; });
      this._routeLine.setLatLngs(latlngs);
    }
    this._updateDistance();
    this._updateCoverage();
    if (this._routePoints.length === 0) {
      document.getElementById('btnEditRoute').disabled = true;
      document.getElementById('btnUndoPoint').disabled = true;
      document.getElementById('routeHint').textContent = '点击"开始绘制"后，在地图上点击添加路线节点，双击完成绘制';
      document.getElementById('routeHint').style.color = 'var(--text-muted)';
    }
  },

  _toggleEditMode() {
    if (this._routePoints.length < 2) return;
    this._exitDrawingMode();
    this._routeEditMode = !this._routeEditMode;
    var btn = document.getElementById('btnEditRoute');
    var self = this;

    if (this._routeEditMode) {
      btn.textContent = '完成编辑';
      btn.classList.add('active');
      document.getElementById('routeHint').textContent = '编辑模式：拖拽节点调整路线位置，右键节点可删除';
      document.getElementById('routeHint').style.color = '#ffeb3b';

      this._routeMarkers.forEach(function(m, i) {
        m.setStyle({ fillColor: '#ffeb3b', radius: 6 });
        m.dragging.enable();
        m.on('drag', function(e) {
          self._routePoints[i] = { lat: e.latlng.lat, lng: e.latlng.lng };
          var latlngs = self._routePoints.map(function(p) { return [p.lat, p.lng]; });
          self._routeLine.setLatLngs(latlngs);
        });
        m.on('dragend', function() {
          self._updateDistance();
          self._updateCoverage();
        });
        m.on('contextmenu', function(e) {
          L.DomEvent.stop(e.originalEvent);
          self._routeMap.removeLayer(m);
          self._routeMarkers.splice(i, 1);
          self._routePoints.splice(i, 1);
          var latlngs = self._routePoints.map(function(p) { return [p.lat, p.lng]; });
          self._routeLine.setLatLngs(latlngs);
          self._updateDistance();
          self._updateCoverage();
        });
      });
    } else {
      btn.textContent = '编辑路线';
      btn.classList.remove('active');
      document.getElementById('routeHint').textContent = '路线已保存。可点击"编辑路线"调整节点位置';
      document.getElementById('routeHint').style.color = 'var(--text-muted)';

      this._routeMarkers.forEach(function(m, i) {
        m.setStyle({ fillColor: '#00e676', radius: 5 });
        m.dragging.disable();
        m.off('drag');
        m.off('dragend');
        m.off('contextmenu');
      });
    }
  },

  _exitDrawingMode() {
    if (this._drawCleanup) { this._drawCleanup(); this._drawCleanup = null; }
    if (this._routeMap) this._routeMap.getContainer().style.cursor = '';
  },

  // ===== 导入路线 =====
  _handleFileImport(e) {
    var self = this;
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(evt) {
      var content = evt.target.result;
      var points = null;
      var name = file.name.replace(/\.[^.]+$/, '');

      try {
        if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
          points = self._parseGeoJSON(content);
        } else if (file.name.endsWith('.gpx')) {
          points = self._parseGPX(content);
        } else if (file.name.endsWith('.kml')) {
          points = self._parseKML(content);
        }
      } catch(err) {
        self._showRouteMsg('文件解析失败: ' + err.message, 'error');
        return;
      }

      if (!points || points.length < 2) {
        self._showRouteMsg('未能从文件中提取有效路线（至少需要2个坐标点）', 'error');
        return;
      }

      self._clearRoute();
      self._routePoints = points;
      self._renderImportedRoute();
      document.getElementById('routeName').value = name;
      self._updateDistance();
      self._updateCoverage();
      document.getElementById('routeImportPreview').textContent = '成功加载 ' + points.length + ' 个坐标点';
      document.getElementById('btnEditRoute').disabled = false;
      document.getElementById('routeHint').textContent = '路线已导入（' + points.length + '个节点）。可编辑、保存或导出';
      document.getElementById('routeHint').style.color = 'var(--accent-green)';
    };
    reader.readAsText(file);
  },

  _renderImportedRoute() {
    var map = this._routeMap;
    var self = this;
    if (!map) { this._initRouteMap(); map = this._routeMap; }

    var latlngs = this._routePoints.map(function(p) { return [p.lat, p.lng]; });
    this._routeLine = L.polyline(latlngs, { color: '#00bcd4', weight: 3, opacity: 0.8 }).addTo(map);

    // 起终点标记
    if (this._routePoints.length > 0) {
      var s = this._routePoints[0];
      L.circleMarker([s.lat, s.lng], { radius: 6, fillColor: '#00e676', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
        .bindTooltip('起点').addTo(map);
    }
    if (this._routePoints.length > 1) {
      var e = this._routePoints[this._routePoints.length - 1];
      L.circleMarker([e.lat, e.lng], { radius: 6, fillColor: '#ff5252', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
        .bindTooltip('终点').addTo(map);
    }

    // 中间节点
    this._routePoints.forEach(function(p, i) {
      if (i === 0 || i === self._routePoints.length - 1) return;
      var m = L.circleMarker([p.lat, p.lng], { radius: 3, fillColor: '#00bcd4', color: '#fff', weight: 1, fillOpacity: 0.8, draggable: false })
        .bindTooltip('节点' + (i + 1)).addTo(map);
      self._routeMarkers.push(m);
    });

    // 自适应视野
    map.fitBounds(L.latLngBounds(latlngs).pad(0.1));
  },

  _parseGeoJSON(content) {
    var data = JSON.parse(content);
    var coords = null;

    if (data.type === 'FeatureCollection' && data.features) {
      data = data.features[0];
    }
    if (data.type === 'Feature' && data.geometry) {
      data = data.geometry;
    }
    if (data.type === 'LineString') {
      coords = data.coordinates;
    } else if (data.type === 'MultiLineString') {
      coords = data.coordinates[0];
    }

    if (!coords) return null;
    return coords.map(function(c) {
      // GeoJSON是 [lng, lat] 格式
      return { lat: c[1], lng: c[0] };
    });
  },

  _parseGPX(content) {
    var points = [];
    var trkptRegex = /<trkpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>/gi;
    var match;
    while ((match = trkptRegex.exec(content)) !== null) {
      points.push({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) });
    }
    return points.length >= 2 ? points : null;
  },

  _parseKML(content) {
    var points = [];
    var coordRegex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
    var match;
    while ((match = coordRegex.exec(content)) !== null) {
      var coordText = match[1].trim();
      var tuples = coordText.split(/\s+/);
      tuples.forEach(function(t) {
        var parts = t.split(',');
        if (parts.length >= 2) {
          points.push({ lat: parseFloat(parts[1]), lng: parseFloat(parts[0]) });
        }
      });
    }
    return points.length >= 2 ? points : null;
  },

  // ===== 自动生成路线 =====
  _autoGenerateRoute() {
    var self = this;
    var area = document.getElementById('autoArea').value;
    var mode = document.getElementById('autoMode').value;
    var density = document.getElementById('autoDensity').value;
    var startPref = document.getElementById('autoStart').value;

    // 获取目标区域范围
    var compartments = window.subCompartments || [
      { name:'一号林区', coords:[[26.662,106.710],[26.660,106.728],[26.652,106.730],[26.648,106.718],[26.650,106.708]] },
      { name:'二号林区', coords:[[26.660,106.728],[26.662,106.745],[26.650,106.748],[26.648,106.735],[26.652,106.730]] },
      { name:'三号林区', coords:[[26.648,106.718],[26.652,106.730],[26.648,106.735],[26.638,106.730],[26.635,106.720]] },
      { name:'四号林区', coords:[[26.650,106.748],[26.662,106.752],[26.650,106.755],[26.638,106.750],[26.640,106.745]] },
      { name:'五号林区', coords:[[26.638,106.710],[26.648,106.718],[26.635,106.720],[26.630,106.715],[26.632,106.708]] }
    ];

    // 确定目标区域
    var targetComps;
    if (area === '全部林区') {
      targetComps = compartments;
    } else {
      targetComps = compartments.filter(function(c) { return c.name === area; });
    }

    // 计算目标边界
    var allCoords = [];
    targetComps.forEach(function(c) {
      allCoords = allCoords.concat(c.coords);
    });
    var lats = allCoords.map(function(c) { return c[0]; });
    var lngs = allCoords.map(function(c) { return c[1]; });
    var bounds = {
      minLat: Math.min.apply(null, lats), maxLat: Math.max.apply(null, lats),
      minLng: Math.min.apply(null, lngs), maxLng: Math.max.apply(null, lngs)
    };
    var centerLat = (bounds.minLat + bounds.maxLat) / 2;
    var centerLng = (bounds.minLng + bounds.maxLng) / 2;

    // 密度参数
    var step, zigzagCount;
    if (density.indexOf('稀疏') >= 0) { step = 0.006; zigzagCount = 5; }
    else if (density.indexOf('密集') >= 0) { step = 0.0025; zigzagCount = 12; }
    else { step = 0.004; zigzagCount = 8; }

    // 生成路线点
    var points = [];
    var latRange = bounds.maxLat - bounds.minLat;
    var lngRange = bounds.maxLng - bounds.minLng;

    if (mode === '全面覆盖') {
      // Z字形覆盖扫描
      var rows = Math.ceil(latRange / step);
      var lngSpan = lngRange * 0.85;
      var lngStart = bounds.minLng + lngRange * 0.075;
      var lngEnd = bounds.maxLng - lngRange * 0.075;

      // 起点
      if (startPref === '林区入口') {
        points.push({ lat: bounds.minLat + latRange * 0.1, lng: lngStart });
      } else if (startPref === '中心向外') {
        points.push({ lat: centerLat, lng: centerLng });
        // 先移到边界开始扫描
        points.push({ lat: bounds.minLat + step * 0.5, lng: lngStart });
      } else {
        points.push({ lat: bounds.minLat + Math.random() * latRange * 0.3, lng: lngStart + Math.random() * lngRange * 0.3 });
      }

      for (var r = 0; r < rows; r++) {
        var lat = bounds.minLat + (r + 0.5) * step;
        if (lat > bounds.maxLat) lat = bounds.maxLat - step * 0.3;
        if (r % 2 === 0) {
          points.push({ lat: lat, lng: lngEnd });
        } else {
          points.push({ lat: lat, lng: lngStart });
        }
      }
    } else if (mode === '边界巡查') {
      // 沿区域边界生成路线
      var comp = targetComps[0];
      var coords = comp.coords;
      // 在边界内侧偏移
      for (var i = 0; i <= coords.length; i++) {
        var idx = i % coords.length;
        points.push({ lat: coords[idx][0], lng: coords[idx][1] });
      }
    } else {
      // 重点区域模式：在中心区域生成密集巡查
      for (var i = 0; i < zigzagCount; i++) {
        var t = i / (zigzagCount - 1);
        var lat = centerLat + (t - 0.5) * latRange * 0.7;
        var lngOffset = (i % 2 === 0) ? -lngRange * 0.35 : lngRange * 0.35;
        points.push({ lat: lat, lng: centerLng + lngOffset });
      }
    }

    // 过滤：只保留在目标林区范围内的点
    var pointInPolygon = function(lat, lng, coords) {
      var inside = false;
      for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        var xi = coords[i][0], yi = coords[i][1];
        var xj = coords[j][0], yj = coords[j][1];
        if ((yi > lng) !== (yj > lng) && lat < (xj - xi) * (lng - yi) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };
    var inAnyTarget = function(lat, lng) {
      for (var c = 0; c < targetComps.length; c++) {
        if (pointInPolygon(lat, lng, targetComps[c].coords)) return true;
      }
      return false;
    };

    var filteredPoints = points.filter(function(p) { return inAnyTarget(p.lat, p.lng); });
    if (filteredPoints.length < 2) filteredPoints = points;

    // 渲染生成的路线
    this._clearRoute();
    this._routePoints = filteredPoints;
    this._renderGeneratedRoute(filteredPoints);

    document.getElementById('routeName').value = area + '-' + mode + '路线';
    this._updateDistance();
    this._updateCoverage();
    document.getElementById('btnEditRoute').disabled = false;

    var resultEl = document.getElementById('autoGenResult');
    resultEl.style.display = 'block';
    resultEl.style.color = 'var(--accent-green)';
    resultEl.textContent = '已生成 ' + filteredPoints.length + ' 个路径点，总长约 ' + document.getElementById('routeDistance').textContent;
  },

  _renderGeneratedRoute(points) {
    var map = this._routeMap;
    var self = this;
    if (!map) { this._initRouteMap(); map = this._routeMap; }

    var latlngs = points.map(function(p) { return [p.lat, p.lng]; });
    this._routeLine = L.polyline(latlngs, { color: '#ff9800', weight: 3, opacity: 0.8 }).addTo(map);

    // 起终点
    L.circleMarker([points[0].lat, points[0].lng], { radius: 6, fillColor: '#00e676', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
      .bindTooltip('起点').addTo(map);
    L.circleMarker([points[points.length - 1].lat, points[points.length - 1].lng], { radius: 6, fillColor: '#ff5252', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
      .bindTooltip('终点').addTo(map);

    points.forEach(function(p, i) {
      if (i === 0 || i === points.length - 1) return;
      var m = L.circleMarker([p.lat, p.lng], { radius: 3, fillColor: '#ff9800', color: '#fff', weight: 1, fillOpacity: 0.7, draggable: false })
        .bindTooltip('节点' + (i + 1)).addTo(map);
      self._routeMarkers.push(m);
    });

    map.fitBounds(L.latLngBounds(latlngs).pad(0.1));
  },

  // ===== 覆盖分析 =====
  _updateCoverage() {
    var el = document.getElementById('routeCoverage');
    if (!el || this._routePoints.length < 2) {
      if (el) el.textContent = '-';
      return;
    }
    var compartments = window.subCompartments || [];
    if (compartments.length === 0) { el.textContent = '无林区数据'; return; }

    var pointInPolygon = function(lat, lng, coords) {
      var inside = false;
      for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        var xi = coords[i][0], yi = coords[i][1];
        var xj = coords[j][0], yj = coords[j][1];
        if ((yi > lng) !== (yj > lng) && lat < (xj - xi) * (lng - yi) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };

    var covered = [];
    var self = this;
    compartments.forEach(function(comp) {
      var hit = self._routePoints.some(function(p) { return pointInPolygon(p.lat, p.lng, comp.coords); });
      if (hit) covered.push(comp.name);
    });
    if (covered.length === 0) {
      el.textContent = '未覆盖已知林区';
      el.style.color = 'var(--accent-red)';
    } else {
      el.textContent = covered.join('、');
      el.style.color = 'var(--accent-green)';
    }
  },

  // ===== 任务分配 =====
  _populatePatrolSelect() {
    var sel = document.getElementById('assignPatrolSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- 选择巡护任务 --</option>';
    var self = this;
    this._patrols.forEach(function(p) {
      if (p.status === 'completed' || p.status === 'cancelled') return;
      sel.innerHTML += '<option value="' + p.id + '">' + p.id + ' ' + p.name + ' (' + p.area + ')</option>';
    });
    sel.onchange = function() {
      document.getElementById('btnAssignRoute').disabled = !sel.value || self._routePoints.length < 2;
      self._checkExistingRoute(sel.value);
    };

    // 初始检查是否有路线可分配
    this._updateAssignBtn();
  },

  _updateAssignBtn() {
    var sel = document.getElementById('assignPatrolSelect');
    var btn = document.getElementById('btnAssignRoute');
    if (btn) btn.disabled = !sel || !sel.value || this._routePoints.length < 2;
  },

  async _checkExistingRoute(patrolId) {
    if (!patrolId) return;
    try {
      var resp = await fetch('/api/routes/patrol/' + patrolId);
      var routes = await resp.json();
      var info = document.getElementById('assignedRouteInfo');
      if (routes.length > 0) {
        var latest = routes[0];
        info.style.display = 'block';
        info.style.color = 'var(--accent-blue)';
        info.innerHTML = '该任务已绑定路线: <b>' + (latest.name || '未命名') + '</b> (' + parseFloat(latest.distance || 0).toFixed(2) + ' km) — 分配将覆盖旧路线';
      } else {
        info.style.display = 'block';
        info.style.color = 'var(--text-muted)';
        info.textContent = '该任务暂无绑定路线';
      }
    } catch(e) {}
  },

  async _assignRouteToTask() {
    var patrolId = document.getElementById('assignPatrolSelect').value;
    if (!patrolId || this._routePoints.length < 2) {
      this._showRouteMsg('请先规划路线并选择目标任务', 'error');
      return;
    }

    var name = document.getElementById('routeName').value.trim() || patrolId + '-巡护路线';
    var distText = document.getElementById('routeDistance').textContent;
    var distNum = parseFloat(distText) || 0;
    var duration = parseInt(document.getElementById('routeDuration').value) || 4;

    try {
      var resp = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patrol_id: patrolId,
          name: name,
          points: this._routePoints,
          distance: distNum,
          duration: duration,
          mode: this._routeEditMode ? 'edit' : 'draw'
        })
      });
      if (resp.ok) {
        var info = document.getElementById('assignedRouteInfo');
        info.style.display = 'block';
        info.style.color = 'var(--accent-green)';
        info.innerHTML = '路线已分配至 <b>' + patrolId + '</b> (' + distText + ', ' + this._routePoints.length + '个节点) — 护林员移动端可查看并依路线巡护';
        this._showRouteMsg('路线已分配至任务 ' + patrolId, 'success');
      } else {
        var err = await resp.json();
        this._showRouteMsg('分配失败: ' + (err.error || '未知错误'), 'error');
      }
    } catch(e) {
      this._showRouteMsg('分配失败: 网络错误', 'error');
    }
  },

  // ===== 模板管理 =====
  _saveTemplate() {
    if (this._routePoints.length < 2) { this._showRouteMsg('请先规划路线（至少2个节点）', 'error'); return; }
    var name = document.getElementById('routeName').value.trim() || '未命名路线';
    var template = {
      id: 'rt_' + Date.now(),
      name: name,
      points: this._routePoints,
      duration: document.getElementById('routeDuration').value,
      createdAt: new Date().toISOString().slice(0, 10),
      distance: document.getElementById('routeDistance').textContent
    };

    // 去重更新
    var existIdx = -1;
    for (var i = 0; i < this._routeTemplates.length; i++) {
      if (this._routeTemplates[i].name === name) { existIdx = i; break; }
    }
    if (existIdx >= 0) {
      this._routeTemplates[existIdx] = template;
    } else {
      this._routeTemplates.push(template);
    }

    try { localStorage.setItem('yszx_route_templates', JSON.stringify(this._routeTemplates)); } catch(e) {}
    this._showRouteMsg('路线模板"' + name + '"已保存', 'success');
    this._renderTemplateList();
  },

  _loadTemplates() {
    try {
      var raw = localStorage.getItem('yszx_route_templates');
      this._routeTemplates = raw ? JSON.parse(raw) : [];
    } catch(e) { this._routeTemplates = []; }
  },

  _toggleTemplateList() {
    var list = document.getElementById('routeTemplateList');
    if (list.style.display === 'none') {
      this._renderTemplateList();
      list.style.display = 'block';
    } else {
      list.style.display = 'none';
    }
  },

  _renderTemplateList() {
    var list = document.getElementById('routeTemplateList');
    if (!list) return;
    var self = this;

    if (this._routeTemplates.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">暂无保存的路线模板</div>';
      return;
    }

    var html = '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">已保存的路线模板 (' + this._routeTemplates.length + ')</div>';
    this._routeTemplates.forEach(function(t, i) {
      html += '<div class="template-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin-bottom:4px;background:rgba(0,170,255,0.04);border-radius:4px;font-size:12px;">' +
        '<div><span style="color:var(--accent-blue);cursor:pointer;" class="tmpl-load" data-idx="' + i + '">' + t.name + '</span>' +
        '<span style="color:var(--text-muted);margin-left:8px;">' + t.distance + '</span>' +
        '<span style="color:var(--text-muted);margin-left:4px;font-size:10px;">' + t.createdAt + '</span></div>' +
        '<span style="color:var(--accent-red);cursor:pointer;font-size:11px;" class="tmpl-del" data-idx="' + i + '">删除</span></div>';
    });
    list.innerHTML = html;

    list.querySelectorAll('.tmpl-load').forEach(function(el) {
      el.onclick = function() {
        var t = self._routeTemplates[this.dataset.idx];
        self._clearRoute();
        self._routePoints = t.points.slice();
        self._renderImportedRoute();
        document.getElementById('routeName').value = t.name;
        document.getElementById('routeDuration').value = t.duration || 4;
        self._updateDistance();
        self._updateCoverage();
        document.getElementById('btnEditRoute').disabled = false;
        document.getElementById('routeHint').textContent = '已加载模板: ' + t.name;
        document.getElementById('routeHint').style.color = 'var(--accent-green)';
        list.style.display = 'none';
      };
    });
    list.querySelectorAll('.tmpl-del').forEach(function(el) {
      el.onclick = function() {
        self._routeTemplates.splice(this.dataset.idx, 1);
        try { localStorage.setItem('yszx_route_templates', JSON.stringify(self._routeTemplates)); } catch(e) {}
        self._renderTemplateList();
      };
    });
  },

  // ===== 导出 =====
  _exportFormat(format) {
    if (this._routePoints.length < 2) { this._showRouteMsg('请先规划路线', 'error'); return; }
    var name = document.getElementById('routeName').value.trim() || 'route';
    var self = this;

    if (format === 'geojson') {
      var geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            name: name,
            distance: document.getElementById('routeDistance').textContent,
            points: this._routePoints.length
          },
          geometry: {
            type: 'LineString',
            coordinates: this._routePoints.map(function(p) { return [p.lng, p.lat]; })
          }
        }]
      };
      var blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.geojson'; a.click();
      this._showRouteMsg('已导出GeoJSON格式', 'success');
    } else if (format === 'gpx') {
      var gpx = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<gpx version="1.1" creator="云山智巡" xmlns="http://www.topografix.com/GPX/1/1">\n' +
        '  <trk><name>' + name + '</name><trkseg>\n';
      this._routePoints.forEach(function(p) {
        gpx += '    <trkpt lat="' + p.lat.toFixed(6) + '" lon="' + p.lng.toFixed(6) + '"></trkpt>\n';
      });
      gpx += '  </trkseg></trk>\n</gpx>';
      var gpxBlob = new Blob([gpx], { type: 'application/gpx+xml' });
      var ga = document.createElement('a'); ga.href = URL.createObjectURL(gpxBlob); ga.download = name + '.gpx'; ga.click();
      this._showRouteMsg('已导出GPX格式', 'success');
    }
  },

  _initRouteMap() {
    if (!window.maps || !window.maps.resTaskMap) {
      var center = window.forestCenter || [26.65, 106.73];
      var map = L.map('resTaskMap', { center: center, zoom: 14, attributionControl: false, zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      if (!window.maps) window.maps = {};
      window.maps.resTaskMap = map;
      if (window.subCompartments) {
        window.subCompartments.forEach(function(sc, i) {
          var colors = ['#00bcd4','#009688','#00acc1','#26a69a','#00897b'];
          L.polygon(sc.coords, { color: colors[i] || '#00bcd4', weight: 1.5, opacity: 0.6, fillOpacity: 0.08 }).addTo(map).bindTooltip(sc.name);
        });
      }
      map.on('contextmenu', function(e) {
        L.DomEvent.stop(e.originalEvent);
      });
    }
    this._routeMap = window.maps.resTaskMap;
  },

  _clearRoute() {
    if (this._drawCleanup) { this._drawCleanup(); this._drawCleanup = null; }
    if (this._routeLine) { this._routeMap.removeLayer(this._routeLine); this._routeLine = null; }
    this._routeMarkers.forEach(function(m) { this._routeMap.removeLayer(m); }, this);
    this._routeMarkers = [];
    this._routePoints = [];
    if (this._autoRouteLayer) { this._routeMap.removeLayer(this._autoRouteLayer); this._autoRouteLayer = null; }
    document.getElementById('routeDistance').textContent = '0.00 km';
    document.getElementById('routeCoverage').textContent = '-';
    document.getElementById('routeCoverage').style.color = 'var(--text-muted)';
    document.getElementById('btnEditRoute').disabled = true;
    document.getElementById('btnUndoPoint').disabled = true;
    document.getElementById('routeHint').textContent = '点击"开始绘制"后，在地图上点击添加路线节点，双击完成绘制';
    document.getElementById('routeHint').style.color = 'var(--text-muted)';
  },

  _updateDistance() {
    var dist = 0;
    for (var i = 1; i < this._routePoints.length; i++) {
      var a = this._routePoints[i - 1];
      var b = this._routePoints[i];
      dist += haversineDistance({ latitude: a.lat, longitude: a.lng }, { latitude: b.lat, longitude: b.lng });
    }
    document.getElementById('routeDistance').textContent = (dist / 1000).toFixed(2) + ' km';
    this._updateAssignBtn();
  },

  _showRouteMsg(msg, type) {
    var el = document.getElementById('routeMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.color = type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)';
    setTimeout(function() { el.style.display = 'none'; }, 3500);
  },

  // ==================== 巡护日志 ====================
  async _renderLogManagement() {
    var container = document.getElementById('inner-log');
    if (!container) return;
    var self = this;

    try {
      var resp = await fetch('/api/logs');
      this._logs = await resp.json();
    } catch(e) { this._logs = []; }

    var rows = '';
    if (this._logs.length === 0) {
      rows = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">暂无日志记录</td></tr>';
    } else {
      this._logs.forEach(function(log) {
        var logDate = log.log_date ? new Date(log.log_date) : new Date();
        var pad = function(v) { return String(v).padStart(2, '0'); };
        var dateStr = (logDate.getMonth() + 1) + '-' + pad(logDate.getDate());
        rows += '<tr>' +
          '<td>' + dateStr + '</td>' +
          '<td>' + (log.user_name || log.user_id) + '</td>' +
          '<td>' + (log.area || '-') + '</td>' +
          '<td>' + (log.duration || 0).toFixed(1) + '</td>' +
          '<td>' + (log.distance || 0).toFixed(1) + '</td>' +
          '<td>' + (log.findings || '无异常') + '</td>' +
          '<td><a class="link-btn btn-view-log" data-id="' + log.id + '">查看</a>' +
          '<a class="link-btn btn-del-log" data-id="' + log.id + '" style="color:var(--accent-red);">删除</a></td>' +
          '</tr>';
      });
    }

    var rangerOpts = '';
    this._users.filter(function(u) { return u.role === 'ranger'; }).forEach(function(u) {
      rangerOpts += '<option value="' + u.id + '">' + u.name + '</option>';
    });

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>巡护日志</h3>' +
      '<div class="card-actions"><button class="btn btn-primary btn-sm" id="btnAddLog">填报日志</button>' +
      '<button class="btn btn-outline btn-sm" id="btnRefreshLogs">刷新</button></div></div>' +
      '<div class="card-body">' +
      '<div class="search-bar" style="margin-bottom:10px;">' +
      '<input type="text" id="logSearch" placeholder="搜索日志..."/>' +
      '<select id="logUserFilter"><option value="">全部人员</option>' + rangerOpts + '</select>' +
      '<button class="btn btn-sm" id="btnLogSearch">查询</button></div>' +
      '<table class="data-table"><thead><tr><th>日期</th><th>巡护人</th><th>区域</th><th>时长(h)</th><th>里程(km)</th><th>发现</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div id="logEditPanel" style="display:none;margin-top:12px;padding:12px;background:rgba(0,170,255,0.04);border:1px solid rgba(0,170,255,0.15);border-radius:8px;"></div>' +
      '</div></div>';

    document.getElementById('btnAddLog').onclick = function() { self._showLogEdit(); };
    document.getElementById('btnRefreshLogs').onclick = async function() { await self._renderLogManagement(); };
    document.getElementById('btnLogSearch').onclick = function() { self._doLogSearch(); };
    document.getElementById('logSearch').onkeyup = function(e) { if (e.key === 'Enter') self._doLogSearch(); };

    container.querySelectorAll('.btn-view-log').forEach(function(btn) {
      btn.onclick = function() {
        var log = self._logs.find(function(l) { return l.id == this.dataset.id; });
        if (log) self._showLogEdit(log, true);
      };
    });
    container.querySelectorAll('.btn-del-log').forEach(function(btn) {
      btn.onclick = async function() {
        if (!confirm('确定删除该日志？')) return;
        try { await fetch('/api/logs/' + this.dataset.id, { method: 'DELETE' }); } catch(e) {}
        await self._renderLogManagement();
      };
    });
  },

  _showLogEdit(log, readOnly) {
    log = log || {};
    var panel = document.getElementById('logEditPanel');
    panel.style.display = 'block';
    var now = new Date();
    var pad = function(v) { return String(v).padStart(2, '0'); };
    var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var rangerOpts = '';
    var self = this;
    this._users.filter(function(u) { return u.role === 'ranger'; }).forEach(function(u) {
      rangerOpts += '<option value="' + u.id + '" data-name="' + u.name + '"' + (log.user_id === u.id ? ' selected' : '') + '>' + u.name + ' (' + u.id + ')</option>';
    });

    var disabled = readOnly ? ' disabled' : '';
    panel.innerHTML =
      '<h4 style="margin:0 0 8px 0;font-size:13px;">' + (readOnly ? '日志详情' : (log.id ? '编辑日志' : '新增日志')) + '</h4>' +
      '<div class="form-row"><div class="form-group half"><label>巡护人</label><select id="editLogUser"' + disabled + '>' + rangerOpts + '</select></div>' +
      '<div class="form-group half"><label>日期</label><input type="date" id="editLogDate" value="' + (log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : today) + '"' + disabled + '/></div></div>' +
      '<div class="form-row"><div class="form-group half"><label>区域</label><select id="editLogArea"' + disabled + '><option' + (log.area === '一号林区' ? ' selected' : '') + '>一号林区</option><option' + (log.area === '二号林区' ? ' selected' : '') + '>二号林区</option><option' + (log.area === '三号林区' ? ' selected' : '') + '>三号林区</option><option' + (log.area === '四号林区' ? ' selected' : '') + '>四号林区</option><option' + (log.area === '五号林区' ? ' selected' : '') + '>五号林区</option></select></div>' +
      '<div class="form-group half"><label>巡护任务</label><select id="editLogPatrol"' + disabled + '><option value="">无关联任务</option>' +
      this._patrols.map(function(p) { return '<option value="' + p.id + '"' + (log.patrol_id === p.id ? ' selected' : '') + '>' + p.name + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="form-row"><div class="form-group half"><label>时长(h)</label><input type="number" id="editLogDuration" step="0.1" value="' + (log.duration || 0) + '"' + disabled + '/></div>' +
      '<div class="form-group half"><label>里程(km)</label><input type="number" id="editLogDistance" step="0.1" value="' + (log.distance || 0) + '"' + disabled + '/></div></div>' +
      '<div class="form-group"><label>发现</label><input type="text" id="editLogFindings" value="' + (log.findings || '') + '"' + disabled + ' placeholder="野外用火、枯死松树、异常情况等"/></div>' +
      '<div class="form-group"><label>备注</label><textarea rows="2" id="editLogNotes"' + disabled + '>' + (log.notes || '') + '</textarea></div>';

    if (!readOnly) {
      panel.innerHTML += '<div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary btn-sm" id="btnSaveLog">保存</button><button class="btn btn-outline btn-sm" id="btnCancelLog">取消</button></div>';
    } else {
      panel.innerHTML += '<button class="btn btn-sm btn-outline" style="margin-top:8px;" id="btnCloseLog">关闭</button>';
    }

    if (readOnly) {
      document.getElementById('btnCloseLog').onclick = function() { panel.style.display = 'none'; };
      return;
    }

    document.getElementById('btnSaveLog').onclick = async function() {
      var userSel = document.getElementById('editLogUser');
      var userName = userSel.options[userSel.selectedIndex].dataset.name || userSel.value;
      var data = {
        user_id: userSel.value,
        user_name: userName,
        log_date: new Date(document.getElementById('editLogDate').value).getTime(),
        area: document.getElementById('editLogArea').value,
        patrol_id: document.getElementById('editLogPatrol').value,
        duration: parseFloat(document.getElementById('editLogDuration').value) || 0,
        distance: parseFloat(document.getElementById('editLogDistance').value) || 0,
        findings: document.getElementById('editLogFindings').value.trim(),
        notes: document.getElementById('editLogNotes').value.trim()
      };
      if (!data.user_id) { alert('请选择巡护人'); return; }
      try {
        if (log.id) {
          await fetch('/api/logs/' + log.id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        } else {
          await fetch('/api/logs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        }
        await self._renderLogManagement();
      } catch(e) { alert('保存失败'); }
    };
    document.getElementById('btnCancelLog').onclick = function() { panel.style.display = 'none'; };
  },

  _doLogSearch() {
    var keyword = (document.getElementById('logSearch').value || '').toLowerCase();
    var userId = document.getElementById('logUserFilter').value;
    var self = this;
    var filtered = this._logs.filter(function(log) {
      if (userId && log.user_id !== userId) return false;
      if (keyword) {
        var findings = (log.findings || '').toLowerCase();
        var notes = (log.notes || '').toLowerCase();
        var name = (log.user_name || '').toLowerCase();
        return findings.indexOf(keyword) >= 0 || notes.indexOf(keyword) >= 0 || name.indexOf(keyword) >= 0;
      }
      return true;
    });

    var tbody = document.querySelector('#inner-log tbody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">无匹配记录</td></tr>';
      return;
    }
    var rows = '';
    filtered.forEach(function(log) {
      var logDate = log.log_date ? new Date(log.log_date) : new Date();
      var pad = function(v) { return String(v).padStart(2, '0'); };
      var dateStr = (logDate.getMonth() + 1) + '-' + pad(logDate.getDate());
      rows += '<tr><td>' + dateStr + '</td><td>' + (log.user_name || log.user_id) + '</td><td>' + (log.area || '-') + '</td>' +
        '<td>' + (log.duration || 0).toFixed(1) + '</td><td>' + (log.distance || 0).toFixed(1) + '</td>' +
        '<td>' + (log.findings || '无异常') + '</td>' +
        '<td><a class="link-btn btn-view-log" data-id="' + log.id + '">查看</a>' +
        '<a class="link-btn btn-del-log" data-id="' + log.id + '" style="color:var(--accent-red);">删除</a></td></tr>';
    });
    tbody.innerHTML = rows;
    tbody.querySelectorAll('.btn-view-log').forEach(function(btn) {
      btn.onclick = function() {
        var log = self._logs.find(function(l) { return l.id == this.dataset.id; });
        if (log) self._showLogEdit(log, true);
      };
    });
    tbody.querySelectorAll('.btn-del-log').forEach(function(btn) {
      btn.onclick = async function() {
        if (!confirm('确定删除？')) return;
        try { await fetch('/api/logs/' + this.dataset.id, { method: 'DELETE' }); } catch(e) {}
        await self._renderLogManagement();
      };
    });
  }
};
