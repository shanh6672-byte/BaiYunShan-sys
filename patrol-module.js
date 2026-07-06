/**
 * patrol-module.js — 巡护监控与管理模块 v4
 * 改进：真实巡护路径 + 移动图标 + 平滑动画
 */

var Patrol = {
    // ==================== 林区定义（基于 GeoServer baiyunshan_compartments1 真实边界） ====================
    _AREAS: [
        { cx: 119.9127, cy: 28.5331, w: 0.0485, h: 0.0376, name: '一号林区' },
        { cx: 119.9323, cy: 28.5538, w: 0.0401, h: 0.0538, name: '二号林区' },
        { cx: 119.9439, cy: 28.5044, w: 0.0414, h: 0.0454, name: '三号林区' },
        { cx: 119.8721, cy: 28.5140, w: 0.0389, h: 0.0394, name: '四号林区' },
        { cx: 119.9053, cy: 28.4928, w: 0.0377, h: 0.0323, name: '五号林区' }
    ],

    _AUTO_RANGERS: ['HL001', 'HL002', 'HL003', 'HL004'],
    _AUTO_DRONES: ['UAV-01', 'UAV-02', 'UAV-03', 'UAV-04'],

    // 图标（延迟初始化）
    _icons: null,

    state: {
        routes: [], tasks: [], logs: [],
        rangers: {}, drones: {},
        simTimer: null, pollingTimer: null,
        routeLines: {}, routeMarkers: {},
        entityMarkers: {}, realtimeTrackLines: {},
        realtimeMap: null, realtimeBoundary: null,
        simPaths: {}, simIndex: {}, simStarted: false,
        _lastLogCheck: 0, _logFetchTimer: null,
        // 轨迹回放状态
        _playbackTimer: null, _playMarker: null, _playSpeed: 1,
        _playCoords: null, _playIndex: 0, _isPlaying: false,
        _prevMapView: null, _simPaused: false,  // 模拟暂停标志
        _simHiddenForTaskMgmt: false  // 任务管理子模块时隐藏模拟轨迹
    },

    // ==================== 图标初始化 ====================
    _initIcons: function () {
        if (this._icons) return;
        this._icons = {
            ranger: L.icon({ iconUrl: '/forest-ranger.png', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] }),
            drone: L.icon({ iconUrl: '/drone.png', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] }),
            rangerSmall: L.icon({ iconUrl: '/forest-ranger.png', iconSize: [22, 22], iconAnchor: [11, 11] }),
            droneSmall: L.icon({ iconUrl: '/drone.png', iconSize: [22, 22], iconAnchor: [11, 11] })
        };
    },

    // ==================== 真实路径生成 ====================

    // 护林员路径：多频率叠加的自然迂回 + 中间穿插监测点
    _v2RangerPath: function (area) {
        var cx = area.cx, cy = area.cy, w = area.w, h = area.h;
        var pts = [];
        var steps = 80;
        var seed1 = 3.1 + Math.random() * 1.5;
        var seed2 = 1.7 + Math.random() * 1.3;
        var seed3 = 6.5 + Math.random() * 3;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var x = cx - w / 2 + w * (0.06 + 0.88 * t);
            var y = cy + Math.sin(t * Math.PI * seed1) * h * 0.30;
            y += Math.sin(t * Math.PI * seed2) * h * 0.14;
            y += Math.sin(t * Math.PI * seed3) * h * 0.07;
            y += Math.sin(t * Math.PI * 11.3) * h * 0.035;
            // 偶尔的微小随机偏移
            if (i % 15 === 0) y += (Math.random() - 0.5) * h * 0.04;
            pts.push([y, x]);
        }
        return pts;
    },

    // 无人机路径：网格扫描 + 平滑转弯
    _v2DronePath: function (area) {
        var cx = area.cx, cy = area.cy, w = area.w, h = area.h;
        var pts = [];
        var rows = 5;
        var rowH = h / rows;
        var ml = cx - w / 2 + w * 0.06;
        var mr = cx + w / 2 - w * 0.06;

        for (var r = 0; r < rows; r++) {
            var y0 = cy - h / 2 + rowH * (r + 0.35);
            var ltr = r % 2 === 0;
            var segs = 15;

            // 扫描行
            for (var s = 0; s <= segs; s++) {
                var t = s / segs;
                var x = ltr ? ml + (mr - ml) * t : mr - (mr - ml) * t;
                pts.push([y0, x]);
            }

            // 平滑 U 型转弯（非最后一行）
            if (r < rows - 1) {
                var tx = ltr ? mr : ml;
                var dy = rowH * 0.45;
                var dxDir = ltr ? 1 : -1;
                var turnSteps = 8;
                for (var u = 0; u <= turnSteps; u++) {
                    var ut = u / turnSteps;
                    var angle = Math.PI * ut;
                    pts.push([
                        y0 + dy * (1 - Math.cos(angle)),
                        tx + dxDir * w * 0.035 * Math.sin(angle)
                    ]);
                }
            }
        }
        return pts;
    },

    // Catmull-Rom 平滑插值（为预览路线使用）
    _catmullRom: function (cps, density) {
        if (cps.length < 2) return cps;
        var pts = [];
        var segs = density || 8;
        // 添加首尾虚拟点
        var p0 = cps[0], p1 = cps[0], p2, p3;
        for (var i = 0; i < cps.length - 1; i++) {
            p0 = i > 0 ? cps[i - 1] : cps[0];
            p1 = cps[i];
            p2 = cps[i + 1];
            p3 = i + 2 < cps.length ? cps[i + 2] : cps[cps.length - 1];
            for (var s = 0; s < segs; s++) {
                var t = s / segs;
                var t2 = t * t, t3 = t2 * t;
                var lat = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
                var lng = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
                pts.push([lat, lng]);
            }
        }
        pts.push(cps[cps.length - 1]);
        return pts;
    },

    _getBoundaryCoords: function () {
        var lats = [], lngs = [];
        for (var i = 0; i < this._AREAS.length; i++) {
            var a = this._AREAS[i];
            lats.push(a.cy - a.h / 2); lats.push(a.cy + a.h / 2);
            lngs.push(a.cx - a.w / 2); lngs.push(a.cx + a.w / 2);
        }
        return [
            [Math.min.apply(null, lats) - 0.002, Math.min.apply(null, lngs) - 0.002],
            [Math.max.apply(null, lats) + 0.002, Math.min.apply(null, lngs) - 0.002],
            [Math.max.apply(null, lats) + 0.002, Math.max.apply(null, lngs) + 0.002],
            [Math.min.apply(null, lats) - 0.002, Math.max.apply(null, lngs) + 0.002],
            [Math.min.apply(null, lats) - 0.002, Math.min.apply(null, lngs) - 0.002]
        ];
    },

    // ==================== 巡护路径生成器 ====================
    // 正弦波路径（护林员步行巡护：沿主方向蜿蜒前进）
    _genSinePath: function (centerLat, centerLng, directionDeg, totalLen, amplitude, waves) {
        // directionDeg: 主方向角度（0=东, 90=北）
        // totalLen: 总长度（度）
        // amplitude: 正弦振幅（度）
        // waves: 波数
        var rad = directionDeg * Math.PI / 180;
        var cosD = Math.cos(rad), sinD = Math.sin(rad);
        var perpCos = Math.cos(rad + Math.PI / 2), perpSin = Math.sin(rad + Math.PI / 2);
        var steps = waves * 12 + 1;
        var pts = [];
        for (var i = 0; i < steps; i++) {
            var t = i / (steps - 1);                          // 0..1
            var along = (t - 0.5) * totalLen;                 // 沿主方向偏移
            var perp = Math.sin(t * Math.PI * 2 * waves) * amplitude;  // 垂直正弦偏移
            // 衰减两端振幅，使起点终点更自然
            var taper = Math.sin(t * Math.PI);                // 0→1→0，两端衰减
            perp *= 0.4 + 0.6 * taper;
            pts.push([
                centerLat + along * cosD + perp * perpCos,
                centerLng + along * sinD + perp * perpSin
            ]);
        }
        return pts;
    },

    // 回字弯折路径（无人机网格巡护：来回折返覆盖区域）
    _genZigzagPath: function (centerLat, centerLng, directionDeg, totalLen, width, passes) {
        // directionDeg: 主方向角度
        // totalLen: 每条扫描线的长度（度）
        // width: 扫描带总宽度（度）
        // passes: 往返趟数
        var rad = directionDeg * Math.PI / 180;
        var cosD = Math.cos(rad), sinD = Math.sin(rad);
        var perpCos = Math.cos(rad + Math.PI / 2), perpSin = Math.sin(rad + Math.PI / 2);
        var pts = [];
        for (var p = 0; p < passes; p++) {
            var t = p / (passes - 1 || 1);                   // 0..1 across width
            var perpOff = (t - 0.5) * width;
            // 来回：偶数趟正向，奇数趟反向
            var reverse = (p % 2 === 1);
            var segSteps = 8;
            for (var s = 0; s <= segSteps; s++) {
                var st = s / segSteps;
                var alongOff = reverse ? (1 - st - 0.5) * totalLen : (st - 0.5) * totalLen;
                pts.push([
                    centerLat + alongOff * cosD + perpOff * perpCos,
                    centerLng + alongOff * sinD + perpOff * perpSin
                ]);
            }
        }
        // 去重相邻重复点
        var out = [pts[0]];
        for (var i = 1; i < pts.length; i++) {
            var dlat = pts[i][0] - out[out.length - 1][0];
            var dlng = pts[i][1] - out[out.length - 1][1];
            if (Math.abs(dlat) > 1e-7 || Math.abs(dlng) > 1e-7) out.push(pts[i]);
        }
        return out;
    },

    // 降采样 + Catmull-Rom 平滑（保留兼容，用于旧路径）
    _smoothTrack: function (coords, maxPoints) {
        maxPoints = maxPoints || 60;
        if (coords.length <= maxPoints) return this._catmullRom(coords, 4);
        var step = (coords.length - 1) / (maxPoints - 1);
        var sampled = [];
        for (var i = 0; i < maxPoints - 1; i++) {
            sampled.push(coords[Math.round(i * step)]);
        }
        sampled.push(coords[coords.length - 1]);
        return this._catmullRom(sampled, 4);
    },

    // ==================== 地图获取 ====================
    _getActiveMap: function () {
        // 优先使用 dashMap（全局共享地图）
        if (typeof MapFacade !== 'undefined') {
            var m = MapFacade.getMap('dashMap');
            if (m) return m;
            m = MapFacade.getMap('resRealtimeMap');
            if (m) return m;
            // 遍历 MapFacade 所有实例
            if (MapFacade._instances) {
                var keys = Object.keys(MapFacade._instances);
                if (keys.length > 0) return MapFacade._instances[keys[0]];
            }
        }
        // Fallback: 直接查找 Leaflet 实例
        var el = document.getElementById('dashMap');
        if (el && el._leaflet_map) return el._leaflet_map;
        // 更宽松的查找：遍历所有带 _leaflet_map 的 div
        var allDivs = document.querySelectorAll('div[id]');
        for (var i = 0; i < allDivs.length; i++) {
            if (allDivs[i]._leaflet_map) return allDivs[i]._leaflet_map;
        }
        return null;
    },

    _waitForMap: function (callback, attempts) {
        attempts = attempts || 0;
        if (attempts > 30) { console.warn('[Patrol] 等地图超时'); return; }
        var map = this._getActiveMap();
        if (map) { callback(map); return; }
        var self = this;
        setTimeout(function () { self._waitForMap(callback, attempts + 1); }, 500);
    },

    // ==================== 初始化 ====================
    init: async function () {
        console.log('[Patrol] v4 初始化...');
        // 修复下拉框样式：白色字体+青黑色背景匹配系统主题
        if(!document.getElementById('patrol-fix-style')) {
            var st = document.createElement('style'); st.id = 'patrol-fix-style';
            st.textContent = '#inner-task-mgmt select, #inner-task-mgmt input, #inner-task-mgmt textarea, #inner-route select, #inner-route input, #inner-route-mgmt select, #inner-route-mgmt input, #inner-log select, #inner-log input { color: #e4edf5 !important; background: #0a1628 !important; border-color: #1a3355 !important; } #inner-task-mgmt select option, #inner-route select option, #inner-route-mgmt select option, #inner-log select option { color: #e4edf5; background: #0a1628; }';
            document.head.appendChild(st);
        }
        this._initIcons();
        await this._loadRoutes();
        this._initRangersAndDrones();
        this._generateSimPaths();
        this._bindUI();
        this._renderAllPanels();
        this._startLogPolling();
        console.log('[Patrol] 初始化完成');

        // 直接启动模拟（不等页面切换，dashMap 是全局共享地图）
        var pThis = this;
        this._waitForMap(function (map) {
            console.log('[Patrol] 地图就绪，启动模拟...');
            pThis._startSimOnMap();
        });
    },

    _generateSimPaths: function () {
        var self = this;
        // 缩小路径：w/h 除以 1.5，中心不变
        function shrink(a) { return { cx: a.cx, cy: a.cy, w: a.w / 1.5, h: a.h / 1.5, name: a.name }; }
        // 每个巡护员/无人机分配不同的真实林区
        var rangerAreas = {
            'HL001': shrink(this._AREAS[0]),  // 张建国 - 一号林区
            'HL002': shrink(this._AREAS[1]),  // 李明辉 - 二号林区
            'HL003': shrink(this._AREAS[2]),  // 王大山 - 三号林区
            'HL004': shrink(this._AREAS[3]),  // 陈志强 - 四号林区
        };
        for (var i = 0; i < this._AUTO_RANGERS.length; i++) {
            var id = this._AUTO_RANGERS[i];
            var area = rangerAreas[id] || shrink(this._AREAS[i]);
            this.state.simPaths[id] = this._v2RangerPath(area);
            this.state.simIndex[id] = 0;
        }
        var droneAreas = {
            'UAV-01': shrink(this._AREAS[0]),  // 一号林区
            'UAV-02': shrink(this._AREAS[1]),  // 二号林区
            'UAV-03': shrink(this._AREAS[4]),  // 五号林区
            'UAV-04': shrink(this._AREAS[3]),  // 四号林区
        };
        for (var j = 0; j < this._AUTO_DRONES.length; j++) {
            var did = this._AUTO_DRONES[j];
            var darea = droneAreas[did] || shrink(this._AREAS[0]);
            this.state.simPaths[did] = this._v2DronePath(darea);
            this.state.simIndex[did] = 0;
        }
    },

    _initRangersAndDrones: function () {
        var self = this;
        var names = ['张建国', '李明辉', '王大山', '陈志强', '刘德才', '朱明远', '李国栋', '孙志明'];
        var ids = ['HL001', 'HL002', 'HL003', 'HL004', 'HL005', 'HL006', 'HL007', 'HL008'];
        var areas = ['一号林区', '二号林区', '三号林区', '四号林区', '三号林区', '五号林区', '四号林区', '五号林区'];
        ids.forEach(function (id, i) {
            var isAuto = self._AUTO_RANGERS.indexOf(id) !== -1;
            self.state.rangers[id] = { name: names[i], area: areas[i], lat: 0, lng: 0, speed: isAuto ? 1.5 : 0, heading: 90, battery: 75 + Math.random() * 25, status: isAuto ? '在线' : '待命', route_id: null };
        });
        var dids = ['UAV-01', 'UAV-02', 'UAV-03', 'UAV-04', 'UAV-05', 'UAV-06'];
        var models = ['大疆M300', '大疆M300', '大疆M350', '大疆M350', '极飞V40', '大疆M30T'];
        dids.forEach(function (id, i) {
            var isAuto = self._AUTO_DRONES.indexOf(id) !== -1;
            self.state.drones[id] = { model: models[i], lat: 0, lng: 0, alt: 100 + Math.random() * 50, heading: 90, battery: 60 + Math.random() * 40, status: isAuto ? '巡航中' : '待命', route_id: null };
        });
    },

    _loadRoutes: async function () { try { var r = await fetch('/api/patrol-routes'); var j = await r.json(); if (j.success) this.state.routes = j.data; } catch (e) { } },
    _updateTaskRouteDropdown: function() {
        var sel = document.getElementById('patrolTaskRoute'); if(!sel) return;
        var curVal = sel.value;
        var rto = '<option value="">-- 选择巡护路线 --</option>';
        this.state.routes.forEach(function(r) { rto += '<option value="'+r.id+'">'+r.name+' ['+r.type+'] '+(r.distance_km||r.lengthKm||0)+'km</option>'; });
        sel.innerHTML = rto;
        if(curVal) sel.value = curVal;
    },
    _loadTasks: async function () { try { var r = await fetch('/api/patrol-tasks'); var j = await r.json(); if (j.success) this.state.tasks = j.data; } catch (e) { } },
    _loadLogs: async function () { try { var r = await fetch('/api/patrol-logs'); var j = await r.json(); if (j.success) this.state.logs = j.data; } catch (e) { } },
    _startLogPolling: function () { var self = this; this._loadLogs(); this._loadTasks(); this.state._logFetchTimer = setInterval(function () { self._loadLogs(); self._loadTasks(); }, 15000); },

    // ==================== 启动模拟 ====================
    _startSimOnMap: function () {
        console.log('[Patrol] _startSimOnMap called, simStarted=' + this.state.simStarted);

        var map = this._getActiveMap();
        if (!map) { console.warn('[Patrol] 地图未就绪，延迟重试...'); var self = this; setTimeout(function () { self._startSimOnMap(); }, 500); return; }

        console.log('[Patrol] 地图就绪，启动模拟路径...');

        // 绘制完整模拟路径（半透明预览）
        var self = this;
        this._AUTO_RANGERS.forEach(function (id) { var p = self.state.simPaths[id]; if (p) { console.log('[Patrol] 绘制巡护员路径: ' + id); self._drawRouteLine('sim_' + id, 'ranger', p); } });
        this._AUTO_DRONES.forEach(function (id) { var p = self.state.simPaths[id]; if (p) { console.log('[Patrol] 绘制无人机路径: ' + id); self._drawRouteLine('sim_' + id, 'drone', p); } });

        if (!this.state.simStarted) {
            this.state.simStarted = true;
            this.runSimulationStep();
        }
    },

    // ==================== 模拟引擎 v4（平滑+图标） ====================
    startSimulation: function (userId, userType, routeId) {
        var route = this.state.routes.find(function (r) { return r.id === routeId; });
        if (!route) return;
        var entity = userType === 'ranger' ? this.state.rangers[userId] : this.state.drones[userId];
        if (!entity) return;
        entity.route_id = routeId;
        entity.status = userType === 'ranger' ? '在线' : '巡航中';
        var wp = route.waypoints[0];
        entity.lat = wp[0]; entity.lng = wp[1];
        this._drawRouteLine('plan_' + userId, userType, route.waypoints);
        this._placeMarker(userId, userType);
    },

    _drawRouteLine: function (key, userType, waypoints) {
        var map = this._getActiveMap();
        if (!map || !waypoints || waypoints.length < 2) return;
        if (this.state.routeLines[key]) map.removeLayer(this.state.routeLines[key]);
        if (this.state.routeMarkers[key]) map.removeLayer(this.state.routeMarkers[key]);
        var latlngs = waypoints.map(function (p) { return [p[0], p[1]]; });
        var color = userType === 'ranger' ? '#fdd835' : '#448aff';
        var dash = userType === 'drone' ? '6,4' : null;
        this.state.routeLines[key] = L.polyline(latlngs, { color: color, weight: userType === 'ranger' ? 3 : 2.5, opacity: 0.7, dashArray: dash }).addTo(map);

        var sIcon = L.divIcon({ html: '<div style="width:8px;height:8px;background:' + color + ';border:2px solid #fff;border-radius:50%;"></div>', className: '', iconSize: [8, 8], iconAnchor: [4, 4] });
        var eIcon = L.divIcon({ html: '<div style="width:8px;height:8px;background:#ff5252;border:2px solid #fff;border-radius:50%;"></div>', className: '', iconSize: [8, 8], iconAnchor: [4, 4] });
        this.state.routeMarkers[key] = L.layerGroup([L.marker(latlngs[0], { icon: sIcon }), L.marker(latlngs[latlngs.length - 1], { icon: eIcon })]).addTo(map);
    },

    // 用真实图标放置标记
    _placeMarker: function (userId, userType) {
        if (this.state._simHiddenForTaskMgmt) return;
        var map = this._getActiveMap();
        if (!map) return;
        var entity = userType === 'ranger' ? this.state.rangers[userId] : this.state.drones[userId];
        if (!entity || !entity.lat || !entity.lng) return;

        var icon = userType === 'ranger' ? this._icons.ranger : this._icons.drone;

        if (!this.state.entityMarkers[userId]) {
            this.state.entityMarkers[userId] = L.marker([entity.lat, entity.lng], {
                icon: icon, zIndexOffset: 1000
            }).addTo(map).bindPopup(this._popupContent(userId, userType, entity));
        } else {
            this.state.entityMarkers[userId].setLatLng([entity.lat, entity.lng]);
            this.state.entityMarkers[userId].setPopupContent(this._popupContent(userId, userType, entity));
        }
    },

    _popupContent: function (userId, userType, entity) {
        var label = userType === 'ranger' ? '护林员' : '无人机';
        var color = userType === 'ranger' ? '#fdd835' : '#448aff';
        return '<div style="font-size:12px;line-height:1.6;"><b style="color:' + color + ';">' + label + '</b><br>编号: ' + userId + '<br>姓名: ' + (entity.name || entity.model) + '<br>状态: ' + (entity.status || '-') + '<br>速度: ' + (entity.speed || 0).toFixed(1) + ' m/s<br>' + (userType === 'ranger' ? '电量: ' + (entity.battery || 0).toFixed(0) + '%<br>' : '') + (userType === 'drone' ? '高度: ' + (entity.alt || 0) + 'm<br>电量: ' + (entity.battery || 0).toFixed(0) + '%<br>' : '') + '</div>';
    },

    runSimulationStep: function () {
        if (this.state.simTimer) return;
        var self = this;

        // ═══ 状态更新循环（450ms）── 电量/速度/轨迹记录 ═══
        this.state._trackBuffer = [];
        this.state._trackFlushTimer = 0;
        this.state._sessionId = 'S' + new Date().getTime();
        this.state._sessionStartTime = Date.now();
        this.state._sessionSeq = 1;
        this.state.simTimer = setInterval(function () {
            self.state._trackFlushTimer++;
            // 每 ~2分钟切换一次 session，生成多条独立轨迹
            if (Date.now() - self.state._sessionStartTime > 120000) {
                self.state._sessionSeq++;
                self.state._sessionId = 'S' + Date.now();
                self.state._sessionStartTime = Date.now();
                console.log('[Patrol] 新Session #' + self.state._sessionSeq + ': ' + self.state._sessionId);
            }
            var allKeys = Object.keys(self.state.simPaths);
            allKeys.forEach(function (id) {
                var path = self.state.simPaths[id];
                if (!path) return;
                var isRanger = self.state.rangers[id] !== undefined;
                var entity = isRanger ? self.state.rangers[id] : self.state.drones[id];
                if (!entity) return;
                entity.speed = isRanger ? (0.2 + Math.random() * 0.15) : (0.85 + Math.random() * 0.65);
                entity.battery = Math.max(5, entity.battery - 0.015);
                self._updateRealtimeTrack(id, isRanger ? 'ranger' : 'drone');
                // 每 ~2秒采样一个轨迹点存入缓冲区
                if (self.state._trackFlushTimer % 5 === 0) {
                    self.state._trackBuffer.push({
                        entityId: id,
                        entityType: isRanger ? 'ranger' : 'drone',
                        entityName: entity.name || entity.model || id,
                        lat: entity.lat, lng: entity.lng,
                        speed: entity.speed,
                        battery: entity.battery,
                        heading: entity.heading || 0,
                    });
                }
            });
            self._checkMobileActivity();
            // 增量更新侧栏（只改速度/电量文字，不重建DOM，不闪烁）
            self._refreshMonitorList();
            // 每 ~4.5秒批量保存轨迹点到后端
            if (self.state._trackFlushTimer % 10 === 0 && self.state._trackBuffer.length > 0) {
                var buf = self.state._trackBuffer.splice(0);
                self._saveTrackPoints(buf);
            }
        }, 450);

        // ═══ 平滑动画循环（50ms ≈ 20fps）── 图标沿轨迹连续滑动 ═══
        if (!this.state._animProgress) this.state._animProgress = {};
        var allKeys = Object.keys(self.state.simPaths);
        allKeys.forEach(function (id) { self.state._animProgress[id] = 0; });

        this.state._animInterval = setInterval(function () {
            var allKeys = Object.keys(self.state.simPaths);
            allKeys.forEach(function (id) {
                var path = self.state.simPaths[id];
                if (!path || path.length < 2) return;

                var isRanger = self.state.rangers[id] !== undefined;
                // 护林员慢（约720秒一圈），无人机快（约420秒一圈）
                var stepSpeed = isRanger ? 0.0045 : 0.011;
                self.state._animProgress[id] = (self.state._animProgress[id] || 0) + stepSpeed;
                if (self.state._animProgress[id] >= path.length - 1) self.state._animProgress[id] = 0;

                var prog = self.state._animProgress[id];
                var base = Math.floor(prog);
                var frac = prog - base;
                var next = Math.min(base + 1, path.length - 1);
                var p0 = path[base], p1 = path[next];

                // 线性插值
                var lat = p0[0] + (p1[0] - p0[0]) * frac;
                var lng = p0[1] + (p1[1] - p0[1]) * frac;
                var heading = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;

                var entity = isRanger ? self.state.rangers[id] : self.state.drones[id];
                if (!entity) return;
                entity.lat = lat;
                entity.lng = lng;
                entity.heading = heading;
                // 实时更新显示速度和电量（护林员约4-5km/h，无人机约25-35km/h）
                if (isRanger) {
                    entity.speed = parseFloat((0.8 + Math.sin(prog * 0.7 + (parseInt(id.slice(2)) || 0)) * 0.3 + Math.random() * 0.15).toFixed(2));
                    entity.battery = parseFloat(Math.max(5, (entity.battery || 100) - 0.002).toFixed(1));
                    entity.status = '在线';
                } else {
                    entity.speed = parseFloat((8 + Math.sin(prog * 0.5) * 2 + Math.random() * 0.5).toFixed(1));
                    entity.battery = parseFloat(Math.max(5, (entity.battery || 100) - 0.003).toFixed(1));
                    entity.status = '巡航中';
                }

                self._placeMarker(id, isRanger ? 'ranger' : 'drone');
            });
        }, 50);

    },

    _updateRealtimeTrack: function (id, userType) {
        if (this.state._simHiddenForTaskMgmt) return;
        var map = this._getActiveMap();
        if (!map) return;
        var entity = userType === 'ranger' ? this.state.rangers[id] : this.state.drones[id];
        var key = 'track_' + id;
        if (!this.state.realtimeTrackLines[key]) this.state.realtimeTrackLines[key] = { points: [], line: null };
        var track = this.state.realtimeTrackLines[key];
        track.points.push([entity.lat, entity.lng]);
        if (track.points.length > 120) track.points.shift();
        if (track.line) map.removeLayer(track.line);
        if (track.points.length > 1) {
            var color = userType === 'ranger' ? '#fdd835' : '#448aff';
            track.line = L.polyline(track.points, { color: color, weight: userType === 'ranger' ? 3 : 2.5, opacity: 0.85 }).addTo(map);
        }
    },

    _checkMobileActivity: function () {
        var self = this;
        var now = Date.now();
        if (now - this.state._lastLogCheck < 8000) return;
        this.state._lastLogCheck = now;

        // Fetch ranger status from backend
        fetch('/api/rangers', { headers: this._authHeaders() })
            .then(function (r) { return r.json(); })
            .then(function (rangers) {
                if (!Array.isArray(rangers)) return;
                var map = self._getActiveMap();
                rangers.forEach(function (br) {
                    var id = br.id;
                    if (!id || self._AUTO_RANGERS.indexOf(id) !== -1) return;
                    if (!self.state.rangers[id]) return;
                    var wasOnline = self.state.rangers[id].status === '在线';
                    var isOnline = br.status === '在线';

                    self.state.rangers[id].status = isOnline ? '在线' : '待命';
                    // Always sync position from backend for locate button
                    if (br.lat && br.lng) {
                        self.state.rangers[id].lat = br.lat;
                        self.state.rangers[id].lng = br.lng;
                        self.state.rangers[id].area = br.area || self.state.rangers[id].area;
                    }
                    if (isOnline) {
                        self.state.rangers[id].speed = (br.speedKmh || 0) / 3.6;
                        self.state.rangers[id].battery = br.batteryPercent || self.state.rangers[id].battery;
                        if (map) self._placeMarker(id, 'ranger');
                    }
                    // Remove marker when ranger goes offline
                    if (wasOnline && !isOnline && self.state.entityMarkers[id]) {
                        if (map) map.removeLayer(self.state.entityMarkers[id]);
                        delete self.state.entityMarkers[id];
                    }
                });
            }).catch(function () { });

        // Fetch drone status from backend
        fetch('/api/drones', { headers: this._authHeaders() })
            .then(function (r) { return r.json(); })
            .then(function (drones) {
                if (!Array.isArray(drones)) return;
                drones.forEach(function (bd) {
                    var rawId = bd.id || bd.code || '';
                    // Normalize: backend UAV01 → frontend UAV-01
                    var id = rawId.replace(/^UAV(\d+)$/, 'UAV-$1');
                    if (!id || self._AUTO_DRONES.indexOf(id) !== -1) return;
                    if (!self.state.drones[id]) return;
                    var isActive = bd.status === '巡航中' || bd.status === '在线';
                    self.state.drones[id].status = isActive ? '巡航中' : '待命';
                });
            }).catch(function () { });
    },

    // 批量写入轨迹点到后端
    _saveTrackPoints: function (points) {
        if (!points || points.length === 0) return;
        var self = this;
        var payload = JSON.stringify({ points: points, sessionId: self.state._sessionId });
        try {
            fetch('/api/patrol/track-points/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
            }).then(function (r) { return r.json(); }).then(function (j) {
                if (j.success) console.log('[Patrol] 轨迹已保存:', j.saved, '点');
            }).catch(function () { /* 静默 */ });
        } catch (e) { }
    },

    stopSimulation: function () {
        if (this.state.simTimer) { clearInterval(this.state.simTimer); this.state.simTimer = null; }
        if (this.state._animInterval) { clearInterval(this.state._animInterval); this.state._animInterval = null; }
        if (this.state._logFetchTimer) { clearInterval(this.state._logFetchTimer); this.state._logFetchTimer = null; }
    },

    // ==================== UI — 实时监控面板 ====================
    _refreshMonitorList: function (initMode) {
        var self = this;
        // 护林员列表 — 每次全量重建，确保状态/速度/电量与模拟一致
        var rl = document.getElementById('rangerList');
        if (rl) {
            var on = 0;
            var ids = Object.keys(this.state.rangers).sort(function (a, b) {
                return (self.state.rangers[a].status === '在线' ? 0 : 1) - (self.state.rangers[b].status === '在线' ? 0 : 1);
            });
            var h = '';
            ids.forEach(function (id) {
                var r = self.state.rangers[id];
                var isAuto = self._AUTO_RANGERS.indexOf(id) !== -1;
                // 自动模拟的护林员：始终在线（只要动画在跑）
                var isOnline = isAuto || r.status === '在线';
                if (isOnline) on++;
                var autoTag = isAuto ? ' <span style="font-size:9px;color:#fdd835;">[模拟]</span>' : '';
                var spd = (r.speed || 0);
                var bat = (r.battery || 0);
                var spdText = isOnline ? (' <span class="r-speed">' + spd.toFixed(1) + 'm/s</span>') : '';
                var batText = isOnline ? (' <span class="r-batt">' + bat.toFixed(0) + '%</span>') : '';
                var locBtn = isOnline ? '<button class="btn btn-sm btn-outline" onclick="Patrol._locateEntity(\'' + id + '\',\'ranger\')" style="font-size:10px;padding:2px 5px;">📍</button>' : '';
                h += '<div class="rt-person-item" data-rid="' + id + '"><div class="rt-avatar ' + (isOnline ? 'green' : 'gray') + '">' + r.name.charAt(0) + '</div><div class="rt-info"><div class="rt-name">' + r.name + autoTag + ' <span class="tag ' + (isOnline ? 'tag-green' : 'tag-gray') + ' tag-sm">' + (isOnline ? '在线' : '待命') + '</span></div><div class="rt-detail">' + (r.area || '') + spdText + batText + '</div></div>' + locBtn + '</div>';
            });
            rl.innerHTML = h;
            var rc = document.getElementById('rangerOnlineCount');
            if (rc) rc.textContent = on + '人在线';
            // 同步更新综合驾驶舱的在线护林员数量
            var dashRanger = document.getElementById('dashOnlineRangers');
            if (dashRanger) dashRanger.textContent = on;
            var dashPatrol = document.getElementById('dashPatrolCount');
            if (dashPatrol) dashPatrol.textContent = Object.keys(self.state.rangers).length;
        }

        // 无人机列表 — 同理全量重建
        var dl = document.getElementById('droneList');
        if (dl) {
            var da = 0;
            var dh = '';
            Object.keys(this.state.drones).forEach(function (id) {
                var d = self.state.drones[id];
                var isAuto = self._AUTO_DRONES.indexOf(id) !== -1;
                var isActive = isAuto || d.status === '巡航中';
                if (isActive) da++;
                var autoTag = isAuto ? ' <span style="font-size:9px;color:#448aff;">[模拟]</span>' : '';
                var batText = isActive ? (' <span class="d-batt">' + (d.battery || 0).toFixed(0) + '%</span>') : '';
                var altText = isActive ? (' <span class="d-alt">' + (d.alt || 100 + Math.floor(Math.random()*50)) + 'm</span>') : '';
                var locBtn = isActive ? '<button class="btn btn-sm btn-outline" onclick="Patrol._locateEntity(\'' + id + '\',\'drone\')" style="font-size:10px;padding:2px 5px;">📍</button>' : '';
                dh += '<div class="rt-person-item" data-did="' + id + '"><div class="rt-avatar blue">' + id.slice(-2) + '</div><div class="rt-info"><div class="rt-name">' + id + autoTag + ' <span class="tag ' + (isActive ? 'tag-blue' : 'tag-gray') + ' tag-sm">' + (isActive ? '巡航中' : '待命') + '</span></div><div class="rt-detail">' + d.model + batText + altText + '</div></div>' + locBtn + '</div>';
            });
            dl.innerHTML = dh;
            var dc = document.getElementById('droneOnlineCount');
            if (dc) dc.textContent = da + '架巡航中';
            // 同步更新综合驾驶舱的在线无人机数量
            var dashDrone = document.getElementById('dashOnlineDrones');
            if (dashDrone) dashDrone.textContent = da;
        }

        // 同步更新综合驾驶舱「在线巡护人员」板块
        var dashList = document.getElementById('dashPersonnelList') || document.querySelector('#dashLeftPanel .person-list');
        if (dashList) {
            var ph = '';
            // 护林员：按在线状态排序
            var rids = Object.keys(self.state.rangers).sort(function (a, b) {
                return (self.state.rangers[a].status === '在线' ? 0 : 1) - (self.state.rangers[b].status === '在线' ? 0 : 1);
            });
            rids.forEach(function (id) {
                var r = self.state.rangers[id];
                var isAuto = self._AUTO_RANGERS.indexOf(id) !== -1;
                var isOnline = isAuto || r.status === '在线';
                ph += '<div class="person-item"><div class="person-avatar ranger">' + r.name.charAt(0) + '</div><div class="person-info"><div class="person-name">' + r.name + '</div><div class="person-status">' + (r.area || '') + ' · ' + id + (isAuto ? ' [模拟]' : '') + '</div></div><span class="' + (isOnline ? 'status-online' : 'status-offline') + '">' + (isOnline ? '在线' : '待命') + '</span></div>';
            });
            // 无人机
            Object.keys(self.state.drones).forEach(function (id) {
                var d = self.state.drones[id];
                var isAuto = self._AUTO_DRONES.indexOf(id) !== -1;
                var isActive = isAuto || d.status === '巡航中';
                ph += '<div class="person-item"><div class="person-avatar drone">U</div><div class="person-info"><div class="person-name">' + id + '</div><div class="person-status">' + (d.model || '') + (isAuto ? ' [模拟]' : '') + '</div></div><span class="' + (isActive ? 'status-patrol' : 'status-offline') + '">' + (isActive ? '巡航中' : '待命') + '</span></div>';
            });
            dashList.innerHTML = ph;
        }
    },

    // ==================== 定位 & 轨迹聚焦 ====================
    _locateEntity: function (id, type) {
        var self = this;
        var entity = type === 'ranger' ? this.state.rangers[id] : this.state.drones[id];
        if (!entity) return;
        var map = this._getActiveMap();
        if (!map) return;

        var isAuto = type === 'ranger' ? (this._AUTO_RANGERS.indexOf(id) !== -1) : (this._AUTO_DRONES.indexOf(id) !== -1);

        if (isAuto) {
            // Auto entities: state is always fresh from animation loop
            if (!entity.lat || !entity.lng) return;
            map.setView([entity.lat, entity.lng], 16, { animate: true, duration: 0.5 });
            var marker = this.state.entityMarkers[id];
            if (marker) {
                marker.openPopup();
                setTimeout(function () { if (self.state.entityMarkers[id]) self.state.entityMarkers[id].closePopup(); }, 4000);
            }
        } else {
            // Real rangers/drones: fetch latest position from backend
            var num = parseInt(id.replace(/\D/g, ''));
            var apiUrl = type === 'ranger' ? '/api/rangers/' + num : '/api/drones/' + num;
            fetch(apiUrl, { headers: this._authHeaders() })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var lat = data.lat, lng = data.lng;
                    if (!lat || !lng) {
                        // Fallback: try latest track point
                        return fetch('/api/patrol/track-points?entityId=' + id + '&entityType=' + type, { headers: self._authHeaders() })
                            .then(function (r) { return r.json(); })
                            .then(function (pts) {
                                if (Array.isArray(pts) && pts.length > 0) {
                                    var last = pts[pts.length - 1];
                                    lat = last.lat; lng = last.lng;
                                }
                            });
                    }
                    if (lat && lng) {
                        entity.lat = lat;
                        entity.lng = lng;
                        if (data.area) entity.area = data.area;
                        if (data.speedKmh !== undefined) entity.speed = data.speedKmh / 3.6;
                        if (data.batteryPercent !== undefined) entity.battery = data.batteryPercent;
                    }
                })
                .catch(function () { })
                .then(function () {
                    if (!entity.lat || !entity.lng) { alert('暂无该护林员的位置信息'); return; }
                    map.setView([entity.lat, entity.lng], 16, { animate: true, duration: 0.5 });
                    self._placeMarker(id, type);
                    var m = self.state.entityMarkers[id];
                    if (m) {
                        m.openPopup();
                        setTimeout(function () { if (self.state.entityMarkers[id]) self.state.entityMarkers[id].closePopup(); }, 4000);
                    }
                });
        }
    },

    _focusEntityTrack: function (id, type) {
        var tab = document.querySelector('[data-inner="inner-history"]');
        if (tab) tab.click();
        var self = this;
        setTimeout(function () {
            // 切换到正确的类型标签
            var tabs = document.querySelectorAll('.hist-type-tab');
            tabs.forEach(function (t) {
                if (t.dataset.htype === type) t.click();
            });
            // 等类型标签切换完成后加载选项，再赋实体值
            setTimeout(function () {
                self._loadEntityOptions(function () {
                    var sel = document.getElementById('histEntitySelect');
                    if (!sel) return;
                    for (var i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value === id) { sel.value = id; break; }
                    }
                    if (sel.value === id) {
                        sel.dispatchEvent(new Event('change'));
                    }
                });
            }, 200);
        }, 400);
    },

    // ==================== UI — 历史轨迹查询（会话列表模式）====================
    _renderHistoryPanel: function () {
        var c = document.getElementById('inner-history'); if (!c) return;
        var self = this;

        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>历史轨迹查询</h3></div><div class="card-body">' +
            // 类型切换标签
            '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
            '<button class="btn btn-sm hist-type-tab active" data-htype="ranger" style="background:rgba(253,216,53,0.15);color:#fdd835;border:1px solid rgba(253,216,53,0.3);">护林员</button>' +
            '<button class="btn btn-sm hist-type-tab" data-htype="drone" style="background:transparent;color:var(--text-secondary);border:1px solid var(--border-color);">无人机</button>' +
            '</div>' +
            // 实体选择器
            '<div class="form-group"><label>选择人员</label><select id="histEntitySelect" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"><option value="">-- 加载中...</option></select></div>' +
            // 会话列表
            '<div id="histSessionList" style="margin-top:10px;max-height:260px;overflow-y:auto;font-size:12px;color:var(--text-muted);">请选择人员查看轨迹会话</div>' +
            // 结果提示
            '<div id="trackQueryResult" style="margin-top:10px;font-size:12px;color:var(--text-secondary);display:none;"></div>' +
            '</div></div>';

        // 类型切换
        var tabs = c.querySelectorAll('.hist-type-tab');
        tabs.forEach(function (t) {
            t.onclick = function () {
                tabs.forEach(function (x) { x.classList.remove('active'); x.style.background = 'transparent'; x.style.color = 'var(--text-secondary)'; x.style.borderColor = 'var(--border-color)'; });
                this.classList.add('active');
                if (this.dataset.htype === 'ranger') { this.style.background = 'rgba(253,216,53,0.15)'; this.style.color = '#fdd835'; this.style.borderColor = 'rgba(253,216,53,0.3)'; }
                else { this.style.background = 'rgba(68,138,255,0.15)'; this.style.color = '#448aff'; this.style.borderColor = 'rgba(68,138,255,0.3)'; }
                self._loadEntityOptions();
                document.getElementById('histSessionList').innerHTML = '请选择人员查看轨迹会话';
            };
        });

        // 实体选择变化 → 加载会话列表
        document.getElementById('histEntitySelect').onchange = function () {
            var eid = this.value;
            if (!eid) { document.getElementById('histSessionList').innerHTML = '请选择人员查看轨迹会话'; return; }
            self._loadTrackSessions(eid);
        };

        this._loadEntityOptions();
    },

    // 加载实体选项到下拉框
    _loadEntityOptions: function (callback) {
        var self = this;
        var sel = document.getElementById('histEntitySelect'); if (!sel) { if (callback) callback(); return; }
        var activeTab = document.querySelector('.hist-type-tab.active');
        var htype = activeTab ? activeTab.dataset.htype : 'ranger';
        sel.innerHTML = '<option value="">-- 加载中...</option>';

        var done = function (opts) {
            if (sel) sel.innerHTML = opts;
            if (callback) callback();
        };

        // 优先从后端加载有轨迹的实体
        fetch('/api/patrol/track-entities?entityType=' + htype)
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json.success || json.data.length === 0) {
                    var pool = htype === 'ranger' ? self.state.rangers : self.state.drones;
                    var opts = '<option value="" style="color:#8ba4bc;background:#0a1628;">-- 选择 --</option>';
                    Object.keys(pool).forEach(function (id) {
                        var e = pool[id];
                        opts += '<option value="' + id + '" style="color:#e4edf5;background:#0a1628;">' + (e.name || e.model || id) + ' (' + id + ')</option>';
                    });
                    done(opts);
                } else {
                    var opts = '<option value="" style="color:#8ba4bc;background:#0a1628;">-- 选择 --</option>';
                    json.data.forEach(function (e) {
                        opts += '<option value="' + e.entityId + '" style="color:#e4edf5;background:#0a1628;">' + (e.entityName || e.entityId) + ' (' + e.entityId + ') - ' + e.pointCount + '点</option>';
                    });
                    done(opts);
                }
            })
            .catch(function () {
                var pool = htype === 'ranger' ? self.state.rangers : self.state.drones;
                var opts = '<option value="" style="color:#8ba4bc;background:#0a1628;">-- 选择 --</option>';
                Object.keys(pool).forEach(function (id) {
                    var e = pool[id];
                    opts += '<option value="' + id + '" style="color:#e4edf5;background:#0a1628;">' + (e.name || e.model || id) + ' (' + id + ')</option>';
                });
                done(opts);
            });
    },

    // 加载指定实体的轨迹会话列表
    _loadTrackSessions: function (entityId) {
        var self = this;
        var listEl = document.getElementById('histSessionList');
        if (!listEl) return;
        listEl.innerHTML = '<span style="color:var(--text-muted);">加载中...</span>';

        fetch('/api/patrol/track-sessions?entityId=' + encodeURIComponent(entityId))
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json.success || json.data.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);">暂无轨迹数据。请等待模拟运行 2-3 分钟后再查看。</div>';
                    return;
                }
                var activeTab = document.querySelector('.hist-type-tab.active');
                var htype = activeTab ? activeTab.dataset.htype : 'ranger';
                var color = htype === 'ranger' ? '#fdd835' : '#448aff';
                var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
                    '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);color:var(--text-muted);">' +
                    '<th style="padding:6px 4px;text-align:left;">轨迹</th><th style="padding:6px 4px;">时间段</th><th style="padding:6px 4px;">点数</th><th style="padding:6px 4px;">操作</th></tr></thead><tbody>';
                json.data.forEach(function (s, i) {
                    html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">' +
                        '<td style="padding:6px 4px;"><span style="color:' + color + ';">' + s.name + '</span></td>' +
                        '<td style="padding:6px 4px;font-size:10px;">' + s.startTime + '<br>' + s.endTime + '</td>' +
                        '<td style="padding:6px 4px;text-align:center;">' + s.pointCount + '</td>' +
                        '<td style="padding:6px 4px;text-align:center;"><button class="btn btn-sm btn-outline hist-view-session" data-sid="' + s.sessionId + '" data-sname="' + s.name + '" style="font-size:10px;padding:2px 6px;">查看轨迹</button></td>' +
                        '</tr>';
                });
                html += '</tbody></table>';
                listEl.innerHTML = html;

                // 绑定查看按钮（阻止冒泡，避免被 track-playback.js 拦截）
                listEl.querySelectorAll('.hist-view-session').forEach(function (btn) {
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        self._queryTrackBySession(this.dataset.sid, this.dataset.sname, htype);
                    });
                });
            })
            .catch(function () {
                listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--accent-red);">加载失败，请重试</div>';
            });
    },

    // 按 sessionId 查询，基于后端数据生成仿实巡护路径（护林员=正弦蜿蜒，无人机=回字折返）
    _queryTrackBySession: async function (sessionId, sessionName, entityType) {
        var self = this;
        var color = entityType === 'ranger' ? '#fdd835' : '#448aff';
        var re = document.getElementById('trackQueryResult');
        re.style.display = 'block'; re.innerHTML = '<span style="color:var(--text-muted);">查询中...</span>';

        if (!sessionId) { re.innerHTML = '会话ID无效'; return; }

        try {
            var url = '/api/patrol/track-points?sessionId=' + encodeURIComponent(sessionId);
            var rs = await fetch(url); var js = await rs.json();
            if (!js.success) { re.innerHTML = '查询失败'; return; }
            var fl = js.data;
            if (fl.length === 0) { re.innerHTML = '该轨迹无数据'; return; }
            var map = this._getActiveMap(); if (!map) { re.innerHTML = '地图未就绪'; return; }

            // 先清除之前的轨迹
            this._clearQueryTrack();

            // 从后端轨迹点提取中心位置和方向
            var rawCoords = [];
            fl.forEach(function (l) {
                var la = parseFloat(l.lat), ln = parseFloat(l.lng);
                if (!isNaN(la) && !isNaN(ln) && isFinite(la) && isFinite(ln)) {
                    rawCoords.push([la, ln]);
                }
            });
            if (rawCoords.length < 2) { re.innerHTML = '有效轨迹点不足（需至少2个）'; return; }

            // 计算中心点和方向角
            var sumLat = 0, sumLng = 0;
            rawCoords.forEach(function (c) { sumLat += c[0]; sumLng += c[1]; });
            var cLat = sumLat / rawCoords.length;
            var cLng = sumLng / rawCoords.length;
            var dlat = rawCoords[rawCoords.length - 1][0] - rawCoords[0][0];
            var dlng = rawCoords[rawCoords.length - 1][1] - rawCoords[0][1];
            var dirDeg = Math.atan2(dlat, dlng) * 180 / Math.PI;  // 主方向角度
            if (Math.abs(dlat) < 1e-6 && Math.abs(dlng) < 1e-6) dirDeg = 45; // 默认东北

            // 参数：总长度~0.004度(约400m)，振幅/宽度~0.0008度(约80m)
            // 原来~60点太大，现在缩到~15-30个关键点
            var totalLen = 0.008;    // 总路径长（度）
            var amplitude = 0.0016;  // 正弦振幅（度）
            var width = 0.005;       // 回字扫描宽度（度）

            var coords;
            if (entityType === 'ranger') {
                // 护林员：正弦波蜿蜒路径（模拟步行巡山）
                coords = this._genSinePath(cLat, cLng, dirDeg, totalLen, amplitude, 5);
            } else {
                // 无人机：回字折返路径（模拟网格扫描覆盖）
                coords = this._genZigzagPath(cLat, cLng, dirDeg, totalLen, width, 4);
            }

            // 绘制静态轨迹线（虚线风格，清晰可见）
            this._qTrackLine = L.polyline(coords, {
                color: color, weight: 4, opacity: 0.85,
                dashArray: '8, 5', lineJoin: 'round', lineCap: 'round'
            }).addTo(map);

            // 起点和终点标记
            var sIcon = L.divIcon({
                html: '<div style="background:' + color + ';width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>',
                className: '', iconSize: [12, 12], iconAnchor: [6, 6]
            });
            var eIcon = L.divIcon({
                html: '<div style="background:#ff5252;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>',
                className: '', iconSize: [12, 12], iconAnchor: [6, 6]
            });
            this._qTrackMarks = L.layerGroup([
                L.marker(coords[0], { icon: sIcon }).bindTooltip('起点'),
                L.marker(coords[coords.length - 1], { icon: eIcon }).bindTooltip('终点')
            ]).addTo(map);

            // 定位到轨迹范围
            map.invalidateSize();
            var bounds = L.latLngBounds(coords);
            if (bounds.isValid()) {
                map.fitBounds(bounds.pad(0.15), { maxZoom: 18 });
            } else {
                map.setView(coords[0], 17);
            }

            // 点击地图任意位置清除轨迹
            this._qTrackClickHandler = function () {
                self._clearQueryTrack();
            };
            map.once('click', this._qTrackClickHandler);

            var pathLabel = entityType === 'ranger' ? '正弦巡护' : '回字扫描';
            re.innerHTML = '<div style="color:var(--accent-green);margin-bottom:6px;font-size:13px;">📌 ' + sessionName +
                ' <span style="color:var(--text-muted);font-size:11px;">[' + pathLabel + ' · ' + coords.length + '点]</span></div>' +
                '<div style="padding:4px 0;"><a class="link-btn" onclick="Patrol._clearQueryTrack()" style="color:var(--accent-red);cursor:pointer;font-size:12px;">✕ 清除轨迹</a></div>';

        } catch (e) {
            console.error('[Patrol] 查询轨迹失败:', e);
            re.innerHTML = '查询出错: ' + e.message;
        }
    },

    _clearQueryTrack: function () {
        var map = this._getActiveMap();
        if (map) {
            if (this._qTrackLine) map.removeLayer(this._qTrackLine);
            if (this._qTrackMarks) map.removeLayer(this._qTrackMarks);
            if (this._qTrackClickHandler) {
                map.off('click', this._qTrackClickHandler);
                this._qTrackClickHandler = null;
            }
        }
        this._qTrackLine = null;
        this._qTrackMarks = null;
        this.state._playCoords = null;
        this.state._playIndex = 0;
        this.state._isPlaying = false;
        var el = document.getElementById('trackQueryResult');
        if (el) el.style.display = 'none';
    },

    // ==================== 轨迹回放动画 ====================
    _startTrackPlayback: function () {
        this._stopTrackPlayback();
        var self = this;
        var coords = this.state._playCoords;
        if (!coords || coords.length < 2) return;
        this.state._isPlaying = true;

        var map = this._getActiveMap();

        // 每 150ms 移动一次（约 6.7fps），速度倍数通过步进量实现
        this.state._playbackTimer = setInterval(function () {
            if (!self.state._isPlaying) return;
            var idx = self.state._playIndex + self.state._playSpeed;
            if (idx >= coords.length - 1) {
                // 回放结束：回到起点循环
                idx = 0;
            }
            self.state._playIndex = idx;

            // 线性插值使高倍速下也平滑
            var base = Math.floor(idx);
            var frac = idx - base;
            var next = Math.min(base + 1, coords.length - 1);
            var lat = coords[base][0] + (coords[next][0] - coords[base][0]) * frac;
            var lng = coords[base][1] + (coords[next][1] - coords[base][1]) * frac;
            var pt = [lat, lng];

            if (self.state._playMarker) {
                self.state._playMarker.setLatLng(pt);
            }
            // 地图跟随移动（平滑平移）
            if (map) {
                map.panTo(pt, { animate: true, duration: 0.08 });
            }
            // 更新进度显示
            var prog = document.getElementById('playProgress');
            if (prog) prog.textContent = Math.floor(idx) + '/' + coords.length;
        }, 150);
    },

    _stopTrackPlayback: function () {
        if (this.state._playbackTimer) {
            clearInterval(this.state._playbackTimer);
            this.state._playbackTimer = null;
        }
        this.state._isPlaying = false;
    },

    // 暂停实时模拟（回放轨迹时冻结所有护林员/无人机移动）
    _pauseSimulation: function () {
        if (this.state.simTimer) { clearInterval(this.state.simTimer); this.state.simTimer = null; }
        if (this.state._animInterval) { clearInterval(this.state._animInterval); this.state._animInterval = null; }
        this.state._simPaused = true;
    },

    // 恢复实时模拟（退出回放后重启）
    _resumeSimulation: function () {
        if (!this.state._simPaused) return;
        this.state._simPaused = false;
        // runSimulationStep 内有 guard (if simTimer return)，所以直接调用即可
        this.runSimulationStep();
    },

    _togglePlayback: function () {
        var btn = document.getElementById('btnPlayPause');
        if (this.state._isPlaying) {
            this.state._isPlaying = false;
            if (btn) btn.innerHTML = '▶ 播放';
        } else {
            this.state._isPlaying = true;
            if (btn) btn.innerHTML = '⏸ 暂停';
        }
    },

    // 回放时隐藏模拟图层，让地图干净地只显示回放轨迹
    _hideSimLayers: function (map) {
        this.state._hiddenLayers = [];
        var self = this;
        // 隐藏路线预览线
        for (var key in this.state.routeLines) {
            var line = this.state.routeLines[key];
            if (line && map.hasLayer(line)) { map.removeLayer(line); this.state._hiddenLayers.push({ ref: 'routeLines', key: key }); }
        }
        for (var key2 in this.state.routeMarkers) {
            var mk = this.state.routeMarkers[key2];
            if (mk && map.hasLayer(mk)) { map.removeLayer(mk); this.state._hiddenLayers.push({ ref: 'routeMarkers', key: key2 }); }
        }
        // 隐藏实时轨迹尾迹
        for (var key3 in this.state.realtimeTrackLines) {
            var t = this.state.realtimeTrackLines[key3];
            if (t && t.line && map.hasLayer(t.line)) { map.removeLayer(t.line); this.state._hiddenLayers.push({ ref: 'realtimeTrackLines', key: key3, sub: 'line' }); }
        }
        // 隐藏边界线
        if (this.state.realtimeBoundary && map.hasLayer(this.state.realtimeBoundary)) {
            map.removeLayer(this.state.realtimeBoundary);
            this.state._hiddenLayers.push({ ref: 'realtimeBoundary' });
        }
        // 隐藏实体标记
        for (var eid in this.state.entityMarkers) {
            var em = this.state.entityMarkers[eid];
            if (em && map.hasLayer(em)) { map.removeLayer(em); this.state._hiddenLayers.push({ ref: 'entityMarkers', key: eid }); }
        }
    },

    // 退出回放时恢复被隐藏的模拟图层
    _showSimLayers: function (map) {
        if (!this.state._hiddenLayers) return;
        var self = this;
        this.state._hiddenLayers.forEach(function (h) {
            if (h.ref === 'routeLines' && self.state.routeLines[h.key]) {
                self.state.routeLines[h.key].addTo(map);
            } else if (h.ref === 'routeMarkers' && self.state.routeMarkers[h.key]) {
                self.state.routeMarkers[h.key].addTo(map);
            } else if (h.ref === 'realtimeTrackLines' && h.sub === 'line' && self.state.realtimeTrackLines[h.key] && self.state.realtimeTrackLines[h.key].line) {
                self.state.realtimeTrackLines[h.key].line.addTo(map);
            } else if (h.ref === 'realtimeBoundary' && self.state.realtimeBoundary) {
                self.state.realtimeBoundary.addTo(map);
            } else if (h.ref === 'entityMarkers' && self.state.entityMarkers[h.key]) {
                self.state.entityMarkers[h.key].addTo(map);
            }
        });
        this.state._hiddenLayers = [];
    },

    // 任务管理子模块激活时隐藏所有模拟轨迹（路线预览、实时尾迹、实体标记、边界线）
    _hideSimForTaskMgmt: function() {
        if(this.state._simHiddenForTaskMgmt) return;
        this.state._simHiddenForTaskMgmt = true;
        var map = this._getActiveMap(); if(!map) return;
        var self = this;
        for(var key in this.state.routeLines) {
            if(key.indexOf('sim_')===0 && map.hasLayer(this.state.routeLines[key]))
                map.removeLayer(this.state.routeLines[key]);
        }
        for(var key2 in this.state.routeMarkers) {
            if(key2.indexOf('sim_')===0 && map.hasLayer(this.state.routeMarkers[key2]))
                map.removeLayer(this.state.routeMarkers[key2]);
        }
        for(var key3 in this.state.realtimeTrackLines) {
            var t = this.state.realtimeTrackLines[key3];
            if(t && t.line && map.hasLayer(t.line)) map.removeLayer(t.line);
        }
        for(var eid in this.state.entityMarkers) {
            if(map.hasLayer(this.state.entityMarkers[eid]))
                map.removeLayer(this.state.entityMarkers[eid]);
        }
        if(this.state.realtimeBoundary && map.hasLayer(this.state.realtimeBoundary))
            map.removeLayer(this.state.realtimeBoundary);
    },

    // 离开任务管理子模块时恢复模拟轨迹
    _showSimForTaskMgmt: function() {
        if(!this.state._simHiddenForTaskMgmt) return;
        this.state._simHiddenForTaskMgmt = false;
        var map = this._getActiveMap(); if(!map) return;
        var self = this;
        for(var key in this.state.routeLines) {
            if(key.indexOf('sim_')===0 && this.state.routeLines[key])
                this.state.routeLines[key].addTo(map);
        }
        for(var key2 in this.state.routeMarkers) {
            if(key2.indexOf('sim_')===0 && this.state.routeMarkers[key2])
                this.state.routeMarkers[key2].addTo(map);
        }
        for(var key3 in this.state.realtimeTrackLines) {
            var t = this.state.realtimeTrackLines[key3];
            if(t && t.line) t.line.addTo(map);
        }
        for(var eid in this.state.entityMarkers) {
            if(this.state.entityMarkers[eid])
                this.state.entityMarkers[eid].addTo(map);
        }
        if(this.state.realtimeBoundary)
            this.state.realtimeBoundary.addTo(map);
    },

    // 切换模块时清理：清除静态轨迹
    _cleanupOnNavigate: function () {
        var map = this._getActiveMap();
        if (map) {
            if (this._qTrackLine) map.removeLayer(this._qTrackLine);
            if (this._qTrackMarks) map.removeLayer(this._qTrackMarks);
            if (this._qTrackClickHandler) {
                map.off('click', this._qTrackClickHandler);
                this._qTrackClickHandler = null;
            }
        }
        this._qTrackLine = null;
        this._qTrackMarks = null;
        this.state._isPlaying = false;
    },

    // ==================== UI — 任务发布 + 列表 ====================
    // ==================== 辅助：获取JWT token ====================
    _getToken: function() { return localStorage.getItem('fps_token') || ''; },
    _authHeaders: function() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this._getToken() }; },

    // ==================== UI — 任务管理 ====================
    _renderTaskPublish: function () {
        var c = document.getElementById('inner-task-mgmt'); if (!c) return;
        var self = this;
        var ro = '<option value="">-- 选择护林员 --</option>'; for (var id in this.state.rangers) ro += '<option value="' + id + '">' + this.state.rangers[id].name + ' (' + id + ')</option>';
        var rto = ''; this.state.routes.forEach(function (r) { rto += '<option value="' + r.id + '">' + r.name + ' [' + r.type + '] ' + (r.distance_km||r.lengthKm||0) + 'km</option>'; });
        var n = new Date(); var p = function (v) { return String(v).padStart(2, '0'); };
        var f = function (d) { return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>发布巡护任务</h3></div><div class="card-body">' +
            '<div class="form-group"><label>任务名称</label><input type="text" id="patrolTaskName" placeholder="输入任务名称" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"/></div>' +
            '<div class="form-group"><label>任务类型</label><select id="patrolTaskType" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"><option>日常巡护</option><option>防火巡护</option><option>疫情巡护</option><option>应急巡护</option></select></div>' +
            '<div class="form-group"><label>分配路线 <span style="font-size:10px;color:var(--text-muted);">路线来自路径规划</span></label><select id="patrolTaskRoute" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"><option value="">-- 选择巡护路线 --</option>' + rto + '</select></div>' +
            '<div class="form-group"><label>指派护林员</label><select id="patrolTaskMembers" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;">' + ro + '</select></div>' +
            '<div class="form-group"><label>巡护区域</label><select id="patrolTaskArea" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>' +
            '<div style="display:flex;gap:8px;"><div class="form-group" style="flex:1;"><label>开始时间</label><input type="datetime-local" id="patrolTaskStart" value="' + f(n) + '" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"/></div><div class="form-group" style="flex:1;"><label>结束时间</label><input type="datetime-local" id="patrolTaskEnd" value="' + f(new Date(n.getTime() + 86400000)) + '" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"/></div></div>' +
            '<div class="form-group"><label>任务描述</label><textarea id="patrolTaskDesc" rows="2" placeholder="输入任务描述..." style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"></textarea></div>' +
            '<button class="btn btn-primary btn-block" id="btnPublishPatrolTask">发布任务</button>' +
            '<div id="patrolTaskMsg" style="font-size:12px;margin-top:8px;display:none;"></div></div></div>';
        document.getElementById('btnPublishPatrolTask').onclick = function () { self._publishTask(); };
        document.getElementById('patrolTaskRoute').onchange = function() {
            var rid = this.value; var r = self.state.routes.find(function(x){return x.id===rid;});
            if(r && r.waypoints && r.waypoints.length>1) self._drawRouteLine('taskPreview','ranger',r.waypoints);
        };
    },

    _publishTask: async function () {
        var nm = document.getElementById('patrolTaskName').value.trim();
        var rid = document.getElementById('patrolTaskRoute').value;
        var area = document.getElementById('patrolTaskArea').value;
        var memberId = document.getElementById('patrolTaskMembers').value;
        var memberName = '';
        if (memberId && Patrol.state.rangers[memberId]) {
            memberName = Patrol.state.rangers[memberId].name;
        }
        var me = document.getElementById('patrolTaskMsg');
        if (!nm) { me.style.display = 'block'; me.style.color = 'var(--accent-red)'; me.textContent = '请输入任务名称'; return; }
        if (!rid) { me.style.display = 'block'; me.style.color = 'var(--accent-red)'; me.textContent = '请选择巡护路线'; return; }
        var rt = this.state.routes.find(function (r) { return r.id === rid; });
        try {
            var rs = await fetch('/api/patrol-tasks', { method: 'POST', headers: this._authHeaders(), body: JSON.stringify({
                name: nm, type: document.getElementById('patrolTaskType').value, area: area,
                description: document.getElementById('patrolTaskDesc').value.trim(),
                route_id: rid, route_name: rt ? rt.name : '', route_waypoints: rt ? rt.waypoints : [],
                members: memberId ? [memberId] : [], members_names: memberName ? [memberName] : [], start_time: document.getElementById('patrolTaskStart').value,
                end_time: document.getElementById('patrolTaskEnd').value, creator: '管理员'
            })});
            var js = await rs.json();
            if (js.success) { me.style.display = 'block'; me.style.color = 'var(--accent-green)'; me.textContent = '任务 ' + (js.data.taskNumber||js.data.id) + ' 发布成功！'; document.getElementById('patrolTaskName').value = ''; document.getElementById('patrolTaskDesc').value = ''; await this._loadTasks(); this._renderTaskList(); }
            else { me.style.display = 'block'; me.style.color = 'var(--accent-red)'; me.textContent = '发布失败: ' + (js.error || '未知错误'); }
        } catch (e) { me.style.display = 'block'; me.style.color = 'var(--accent-red)'; me.textContent = '网络错误'; }
    },

    _renderTaskList: async function () {
        await this._loadTasks();
        var c = document.getElementById('inner-task-mgmt'); if (!c) return;
        var self = this;
        var statusColors = {'草稿':'tag-gray','待执行':'tag-orange','进行中':'tag-green','已完成':'tag-blue'};
        var r = '';
        this.state.tasks.forEach(function (t) {
            var st = t.status || '草稿';
            var tc = statusColors[st] || 'tag-gray';
            var prog = t.progress || 0;
            var canDel = (st === '草稿' || st === '待执行');
            var canDispatch = st === '草稿';
            var canComplete = st === '进行中';
            var actions = '';
            if(canDispatch) actions += '<a class="link-btn patrol-dispatch-task" data-id="' + t.id + '" style="color:var(--accent-green);">派发</a> ';
            if(canComplete) actions += '<a class="link-btn patrol-complete-task" data-id="' + t.id + '" style="color:var(--accent-blue);">✓ 完成</a> ';
            actions += '<a class="link-btn patrol-view-task" data-id="' + t.id + '" style="color:var(--accent-blue);">查看</a> ';
            if(canDel) actions += '<a class="link-btn patrol-del-task" data-id="' + t.id + '" style="color:var(--accent-red);">删除</a>';
            // 执行人：优先显示名称，其次从rangers池解析HL编号
            var executor = t.rangerName || (t.members_names && t.members_names[0]) || '-';
            if (executor === '-' && t.members && t.members[0]) {
                var mid = t.members[0];
                executor = (self.state.rangers && self.state.rangers[mid]) ? self.state.rangers[mid].name : mid;
            }
            r += '<tr><td style="font-size:11px;">' + (t.taskNumber||t.id) + '</td><td>' + t.name + '</td><td>' + (t.type||'-') + '</td>' +
                 '<td>' + executor + '</td>' +
                 '<td><div style="width:60px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;display:inline-block;vertical-align:middle;"><div style="width:' + prog + '%;height:100%;background:var(--accent-blue);border-radius:3px;"></div></div> ' + prog + '%</td>' +
                 '<td><span class="tag ' + tc + ' tag-sm">' + st + '</span></td><td>' + actions + '</td></tr>';
        });
        var ex = document.getElementById('patrolTaskTableWrap'); if (ex) ex.remove();
        var w = document.createElement('div'); w.id = 'patrolTaskTableWrap';
        w.innerHTML = '<div class="panel-card" style="margin-top:12px;"><div class="card-header"><h3>任务列表 (' + this.state.tasks.length + ')</h3><button class="btn btn-sm btn-outline" id="btnRefreshPatrolTasks">刷新</button></div><div class="card-body"><table class="data-table"><thead><tr><th>编号</th><th>名称</th><th>类型</th><th>执行人</th><th>进度</th><th>状态</th><th>操作</th></tr></thead><tbody>' + (r || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">暂无任务</td></tr>') + '</tbody></table></div></div>';
        c.appendChild(w);
        document.getElementById('btnRefreshPatrolTasks').onclick = async function () { await self._loadTasks(); self._renderTaskList(); };
        w.querySelectorAll('.patrol-dispatch-task').forEach(function (b) { b.onclick = function () { self._dispatchTask(b.dataset.id); }; });
        w.querySelectorAll('.patrol-complete-task').forEach(function (b) { b.onclick = async function () { try { var rs = await fetch('/api/patrol-tasks/' + b.dataset.id, { method: 'PUT', headers: self._authHeaders(), body: JSON.stringify({status:'已完成', progress:100}) }); var js = await rs.json(); if(!js.success) { alert(js.error||'完成失败'); return; } await self._loadTasks(); self._renderTaskList(); } catch(e) { alert('网络错误'); } }; });
        w.querySelectorAll('.patrol-view-task').forEach(function (b) { b.onclick = function () { self._viewTask(b.dataset.id); }; });
        w.querySelectorAll('.patrol-del-task').forEach(function (b) { b.onclick = async function () { if (!confirm('确定删除此任务？')) return; try { var rs = await fetch('/api/patrol-tasks/' + b.dataset.id, { method: 'DELETE', headers: self._authHeaders() }); var js = await rs.json(); if(!js.success) { alert(js.error||'删除失败'); return; } } catch(e){} await self._loadTasks(); self._renderTaskList(); }; });
    },

    _dispatchTask: async function(tid) {
        // tid format: TASK001 → extract number
        var num = tid.replace('TASK','');
        try {
            var rs = await fetch('/api/patrol/tasks/' + num + '/dispatch', { method:'POST', headers: this._authHeaders() });
            var js = await rs.json();
            if(js.success) { alert('任务已派发: ' + (js.data.taskNumber||'')); }
            else { alert('派发失败: ' + (js.error||'')); }
        } catch(e) { alert('网络错误'); }
        await this._loadTasks(); this._renderTaskList();
    },

    _viewTask: function(tid) {
        var t = this.state.tasks.find(function(x){return x.id===tid;});
        if(!t) return;
        var executor = t.rangerName || (t.members_names && t.members_names[0]) || (t.members && t.members[0]) || '-';
        var info = '任务: ' + t.name + '\n编号: ' + (t.taskNumber||t.id) + '\n类型: ' + t.type + '\n状态: ' + t.status + '\n区域: ' + t.area + '\n执行人: ' + executor + '\n进度: ' + (t.progress||0) + '%\n描述: ' + (t.description||'无');
        alert(info);
        // Draw route on map if available
        if(t.routeGeometry) {
            try {
                var geom = typeof t.routeGeometry === 'string' ? JSON.parse(t.routeGeometry) : t.routeGeometry;
                var coords = geom.coordinates || [];
                var wps = coords.map(function(c){return [c[1],c[0]];});
                if(wps.length > 1) this._drawRouteLine('taskView','ranger',wps);
            } catch(e) {}
        }
    },

    // ==================== UI — 路径规划（手动+自动） ====================
    _renderRoutePlanning: function () {
        var c = document.getElementById('inner-route'); if (!c) return;
        var self = this;
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>路径规划与管理</h3></div><div class="card-body">' +
            '<div style="display:flex;gap:0;margin-bottom:12px;">' +
            '<button class="btn btn-sm" id="btnRouteModeManual" style="flex:1;border-radius:4px 0 0 4px;">手动规划</button>' +
            '<button class="btn btn-sm btn-outline" id="btnRouteModeAuto" style="flex:1;border-radius:0 4px 4px 0;">自动规划</button></div>' +
            '<div id="routePlanContent"></div></div></div>';
        document.getElementById('btnRouteModeManual').onclick = function() { self._switchRouteMode('manual'); };
        document.getElementById('btnRouteModeAuto').onclick = function() { self._switchRouteMode('auto'); };
        this._switchRouteMode('manual');
    },

    _switchRouteMode: function(mode) {
        var bm = document.getElementById('btnRouteModeManual');
        var ba = document.getElementById('btnRouteModeAuto');
        if(mode==='manual') { bm.className='btn btn-sm'; ba.className='btn btn-sm btn-outline'; }
        else { ba.className='btn btn-sm'; bm.className='btn btn-sm btn-outline'; }
        if(mode==='manual') this._renderManualRoutePanel();
        else this._renderAutoRoutePanel();
    },

    _renderManualRoutePanel: function() {
        var el = document.getElementById('routePlanContent'); if(!el) return;
        var self = this;
        el.innerHTML = '<div class="form-group"><label>路线名称</label><input type="text" id="manualRouteName" placeholder="例: 东区日常巡护线" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"/></div>' +
            '<div class="form-group"><label>路线类型</label><select id="manualRouteType" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"><option>徒步</option><option>无人机</option></select></div>' +
            '<div style="display:flex;gap:6px;margin:8px 0;">' +
            '<button class="btn btn-sm btn-primary" id="btnStartDraw">开始绘制</button>' +
            '<button class="btn btn-sm btn-outline" id="btnSaveRoute" disabled>保存路线</button>' +
            '<button class="btn btn-sm btn-outline" id="btnClearDraw">清除</button></div>' +
            '<div id="drawHint" style="font-size:11px;color:var(--text-muted);padding:4px 0;">点击"开始绘制"后在地图上点击添加路径点</div>' +
            '<div id="manualRouteMsg" style="font-size:12px;margin-top:6px;display:none;"></div>';
        // Init drawing state
        if(!this.state._routeDrawing) this.state._routeDrawing = { active:false, waypoints:[], polyline:null, markers:[] };
        document.getElementById('btnStartDraw').onclick = function() { self._startRouteDrawing(); };
        document.getElementById('btnSaveRoute').onclick = function() { self._saveManualRoute(); };
        document.getElementById('btnClearDraw').onclick = function() { self._clearDrawing(); };
    },

    _startRouteDrawing: function() {
        var map = this._getActiveMap(); if(!map) { alert('地图未就绪'); return; }
        this._clearDrawing();
        this.state._routeDrawing.active = true;
        this.state._routeDrawing.waypoints = [];
        this.state._routeDrawing.markers = [];
        map.getContainer().style.cursor = 'crosshair';
        var self = this;
        this.state._routeDrawing._clickHandler = function(e) { self._onMapClickForWaypoint(e); };
        map.on('click', this.state._routeDrawing._clickHandler);
        document.getElementById('drawHint').innerHTML = '<span style="color:var(--accent-green);">绘制中 — 在地图上点击添加路径点</span>';
        document.getElementById('btnStartDraw').disabled = true;
        document.getElementById('btnSaveRoute').disabled = false;
    },

    _onMapClickForWaypoint: function(e) {
        if(!this.state._routeDrawing.active) return;
        var map = this._getActiveMap(); if(!map) return;
        var lat = e.latlng.lat, lng = e.latlng.lng;
        var idx = this.state._routeDrawing.waypoints.length + 1;
        this.state._routeDrawing.waypoints.push([lat, lng]);
        var icon = L.divIcon({ html:'<div style="background:#ff9800;color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid #fff;">'+idx+'</div>', className:'', iconSize:[20,20], iconAnchor:[10,10] });
        var m = L.marker([lat,lng],{icon:icon}).addTo(map);
        this.state._routeDrawing.markers.push(m);
        // Update polyline
        if(this.state._routeDrawing.polyline) map.removeLayer(this.state._routeDrawing.polyline);
        if(this.state._routeDrawing.waypoints.length >= 2) {
            this.state._routeDrawing.polyline = L.polyline(this.state._routeDrawing.waypoints, {color:'#ff9800',weight:3,opacity:0.8,dashArray:'8,4'}).addTo(map);
        }
        document.getElementById('drawHint').innerHTML = '<span style="color:var(--accent-green);">已添加 ' + idx + ' 个路径点</span>';
    },

    _saveManualRoute: async function() {
        var wps = this.state._routeDrawing.waypoints;
        if(!wps || wps.length < 2) { alert('请至少添加2个路径点'); return; }
        var name = document.getElementById('manualRouteName').value.trim() || '手动路线-' + new Date().toLocaleTimeString();
        var type = document.getElementById('manualRouteType').value;
        var me = document.getElementById('manualRouteMsg');
        try {
            var rs = await fetch('/api/patrol/routes/plan', { method:'POST', headers: this._authHeaders(),
                body: JSON.stringify({ name:name, type:type, waypoints:wps, creator:'管理员' })});
            var js = await rs.json();
            if(js.success) { me.style.display='block'; me.style.color='var(--accent-green)'; me.textContent='路线保存成功: '+name+' ('+js.data.lengthKm+'km)'; await this._loadRoutes(); this._updateTaskRouteDropdown(); this._clearDrawing(); }
            else { me.style.display='block'; me.style.color='var(--accent-red)'; me.textContent='保存失败: '+(js.error||''); }
        } catch(e) { me.style.display='block'; me.style.color='var(--accent-red)'; me.textContent='网络错误'; }
    },

    _clearDrawing: function() {
        var map = this._getActiveMap();
        var d = this.state._routeDrawing;
        if(!d) return;
        if(d._clickHandler && map) map.off('click', d._clickHandler);
        if(d.polyline && map) map.removeLayer(d.polyline);
        if(d.markers) d.markers.forEach(function(m){ if(map) map.removeLayer(m); });
        if(map) map.getContainer().style.cursor = '';
        d.active = false; d.waypoints = []; d.markers = []; d.polyline = null; d._clickHandler = null;
        var hint = document.getElementById('drawHint'); if(hint) hint.innerHTML = '点击"开始绘制"后在地图上点击添加路径点';
        var btn = document.getElementById('btnStartDraw'); if(btn) btn.disabled = false;
        var btnS = document.getElementById('btnSaveRoute'); if(btnS) btnS.disabled = true;
    },

    _renderAutoRoutePanel: function() {
        var el = document.getElementById('routePlanContent'); if(!el) return;
        var self = this;
        var ao = ''; this._AREAS.forEach(function(a){ ao += '<option>'+a.name+'</option>'; });
        el.innerHTML = '<div class="form-group"><label>选择林区</label><select id="autoArea" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;">' + ao + '</select></div>' +
            '<div class="form-group"><label>风险类型</label><select id="autoRisk" style="width:100%;padding:6px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;"><option>综合</option><option>火灾</option><option>松材线虫病</option></select></div>' +
            '<div class="form-group"><label>规划模式</label><div style="display:flex;gap:8px;">' +
            '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="autoMode" value="coverage" checked/> 覆盖扫描</label>' +
            '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="autoMode" value="keypoints"/> 重点区域经过</label></div></div>' +
            '<div style="display:flex;gap:6px;margin:8px 0;">' +
            '<button class="btn btn-sm btn-primary" id="btnAutoGen">生成路线</button>' +
            '<button class="btn btn-sm btn-outline" id="btnAutoSave" disabled>保存到路线库</button>' +
            '<button class="btn btn-sm btn-outline" id="btnAutoAssign" disabled>分配给任务</button></div>' +
            '<div id="autoRouteInfo" style="font-size:11px;color:var(--text-muted);padding:4px 0;">选择参数后点击"生成路线"</div>' +
            '<div id="autoRouteMsg" style="font-size:12px;margin-top:6px;display:none;"></div>';
        document.getElementById('btnAutoGen').onclick = function() { self._generateAutoRoute(); };
        document.getElementById('btnAutoSave').onclick = function() { self._saveAutoRoute(); };
        document.getElementById('btnAutoAssign').onclick = function() { self._assignAutoRouteToTask(); };
    },

    _generateAutoRoute: async function() {
        var area = document.getElementById('autoArea').value;
        var risk = document.getElementById('autoRisk').value;
        var modeEl = document.querySelector('input[name="autoMode"]:checked');
        var mode = modeEl ? modeEl.value : 'coverage';
        var info = document.getElementById('autoRouteInfo');
        info.innerHTML = '<span style="color:var(--accent-blue);">生成中...</span>';
        try {
            var rs = await fetch('/api/patrol/routes/auto-generate', { method:'POST', headers: this._authHeaders(),
                body: JSON.stringify({ area:area, riskType:risk, mode:mode, name:area+'-'+risk+'-'+(mode==='coverage'?'覆盖':'重点') })});
            var js = await rs.json();
            if(js.success) {
                var d = js.data;
                info.innerHTML = '<span style="color:var(--accent-green);">生成成功: ' + d.name + ' | ' + d.lengthKm + 'km | ' + (d.waypoints||[]).length + '个航点</span>';
                this.state._lastAutoRoute = d;
                document.getElementById('btnAutoSave').disabled = false;
                document.getElementById('btnAutoAssign').disabled = false;
                // Preview on map
                if(d.waypoints && d.waypoints.length > 1) {
                    var wps = d.waypoints.map(function(c){return [c[0], c[1]];}); // already [lat,lng]
                    this._drawRouteLine('autoPreview','ranger',wps);
                }
                await this._loadRoutes();
                this._updateTaskRouteDropdown();
            } else { info.innerHTML = '<span style="color:var(--accent-red);">生成失败: ' + (js.error||'') + '</span>'; }
        } catch(e) { info.innerHTML = '<span style="color:var(--accent-red);">网络错误</span>'; }
    },

    _saveAutoRoute: async function() {
        var r = this.state._lastAutoRoute;
        if(!r) return;
        alert('路线已保存: ' + r.name);
    },

    _assignAutoRouteToTask: async function() {
        var r = this.state._lastAutoRoute;
        if(!r) return;
        // Show task selection
        await this._loadTasks();
        var drafts = this.state.tasks.filter(function(t){return t.status==='草稿';});
        if(drafts.length===0) { alert('没有草稿状态的任务可分配'); return; }
        var opts = drafts.map(function(t){return t.name+' ('+t.taskNumber+')';}).join('\n');
        var choice = prompt('选择任务编号分配路线:\n'+opts+'\n\n输入任务编号(如XH20260704-001):');
        if(!choice) return;
        var task = drafts.find(function(t){return t.taskNumber===choice || t.name===choice;});
        if(!task) { alert('未找到匹配的任务'); return; }
        var num = task.id.replace('TASK','');
        try {
            await fetch('/api/patrol/tasks/'+num, { method:'PUT', headers: this._authHeaders(),
                body: JSON.stringify({ routeGeometry: r.geometry || JSON.stringify({type:'LineString',coordinates:r.waypoints.map(function(c){return [c[1],c[0]];})}) })});
            alert('路线已分配给任务: ' + task.name);
        } catch(e) { alert('分配失败'); }
    },

    // ==================== UI — 路线管理 ====================
    _renderRouteMgmt: async function() {
        var c = document.getElementById('inner-route-mgmt'); if (!c) return;
        await this._loadRoutes();
        var self = this;
        var r = '';
        this.state.routes.forEach(function(rt) {
            r += '<tr><td style="font-size:11px;">' + rt.id + '</td><td>' + rt.name + '</td><td>' + (rt.type||'-') + '</td><td>' + (rt.area||'-') + '</td><td>' + (rt.distance_km||rt.lengthKm||0) + '</td>' +
                 '<td style="white-space:nowrap;">' +
                 '<a class="link-btn route-preview-btn" data-id="' + rt.id + '" style="color:var(--accent-blue);margin-right:4px;">查看</a>' +
                 '<a class="link-btn route-export-btn" data-id="' + rt.id + '" style="color:var(--accent-green);margin-right:4px;">导出</a>' +
                 '<a class="link-btn route-del-btn" data-id="' + rt.id + '" style="color:#ff5252;">删除</a></td></tr>';
        });
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>路线管理 (' + this.state.routes.length + '条)</h3><button class="btn btn-sm btn-outline" id="btnRefreshRoutes">刷新</button></div><div class="card-body">' +
            '<div style="display:flex;gap:6px;margin-bottom:8px;"><input type="text" id="routeSearchInput" placeholder="搜索路线..." style="flex:1;padding:5px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:12px;"/>' +
            '<select id="routeTypeFilter" style="padding:5px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:12px;"><option value="">全部类型</option><option>徒步</option><option>无人机</option><option>边界巡护</option><option>之字覆盖</option><option>自动规划</option></select></div>' +
            '<table class="data-table"><thead><tr><th>编号</th><th>名称</th><th>类型</th><th>区域</th><th>长度km</th><th>操作</th></tr></thead><tbody>' + (r || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">暂无路线</td></tr>') + '</tbody></table></div></div>';
        document.getElementById('btnRefreshRoutes').onclick = function() { self._renderRouteMgmt(); };
        c.querySelectorAll('.route-preview-btn').forEach(function(b) { b.onclick = function() { self._previewRoute(b.dataset.id); }; });
        c.querySelectorAll('.route-export-btn').forEach(function(b) { b.onclick = function() { self._exportRoute(b.dataset.id); }; });
        c.querySelectorAll('.route-del-btn').forEach(function(b) {
            b.onclick = async function() {
                if (!confirm('确定删除路线 ' + b.dataset.id + '？')) return;
                try {
                    var rs = await fetch('/api/patrol-routes/' + b.dataset.id, { method: 'DELETE', headers: self._authHeaders() });
                    var js = await rs.json();
                    if (!js.success) { alert(js.error || '删除失败'); return; }
                } catch (e) { alert('网络错误'); return; }
                self._renderRouteMgmt();
            };
        });
    },

    _previewRoute: function(rid) {
        var self = this;
        var rt = this.state.routes.find(function(r){return r.id===rid;});
        if(!rt) return;
        var wps = rt.waypoints || [];
        // Clear ALL previous preview lines to avoid clutter
        var keysToRemove = [];
        Object.keys(this.state.routeLines).forEach(function(k) {
            if(k.indexOf('mgmtPreview_') === 0) keysToRemove.push(k);
        });
        keysToRemove.forEach(function(k) {
            var map = self._getActiveMap();
            if(map && self.state.routeLines[k]) map.removeLayer(self.state.routeLines[k]);
            if(self.state.routeMarkers[k]) { var m = self._getActiveMap(); if(m) m.removeLayer(self.state.routeMarkers[k]); }
            delete self.state.routeLines[k];
            delete self.state.routeMarkers[k];
        });
        if(wps.length > 1) {
            // Backend now always returns [lat,lng] — no conversion needed
            var coords = wps.map(function(c){return [c[0], c[1]];});
            var map = this._getActiveMap();
            if(map) {
                // Draw preview with distinctive cyan color
                if(this.state.routeLines['mgmtPreview_'+rid]) map.removeLayer(this.state.routeLines['mgmtPreview_'+rid]);
                if(this.state.routeMarkers['mgmtPreview_'+rid]) map.removeLayer(this.state.routeMarkers['mgmtPreview_'+rid]);
                this.state.routeLines['mgmtPreview_'+rid] = L.polyline(coords, {
                    color: '#00d5ff', weight: 4, opacity: 0.9, dashArray: '10,5'
                }).addTo(map);
                var sIcon = L.divIcon({ html: '<div style="width:10px;height:10px;background:#00d5ff;border:2px solid #fff;border-radius:50%;"></div>', className: '', iconSize: [10, 10], iconAnchor: [5, 5] });
                var eIcon = L.divIcon({ html: '<div style="width:10px;height:10px;background:#ff5252;border:2px solid #fff;border-radius:50%;"></div>', className: '', iconSize: [10, 10], iconAnchor: [5, 5] });
                this.state.routeMarkers['mgmtPreview_'+rid] = L.layerGroup([
                    L.marker(coords[0], { icon: sIcon }).bindTooltip('起点'),
                    L.marker(coords[coords.length - 1], { icon: eIcon }).bindTooltip('终点')
                ]).addTo(map);
                try { map.fitBounds(L.latLngBounds(coords).pad(0.2)); } catch(e){}
            }
        }
    },

    _exportRoute: function(rid) {
        var rt = this.state.routes.find(function(r){return r.id===rid;});
        if(!rt) return;
        var wps = rt.waypoints || [];
        var geojson = { type:'Feature', properties:{name:rt.name, type:rt.type, area:rt.area||''},
            geometry: { type:'LineString', coordinates: wps.map(function(c){return [c[1],c[0]];}) }};
        var blob = new Blob([JSON.stringify(geojson, null, 2)], {type:'application/json'});
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = rt.name + '.geojson';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    },

    // ==================== UI — 巡护日志 ====================
    _renderLogPanel: async function () {
        var c = document.getElementById('inner-log'); if (!c) return;
        await this._loadLogs(); await this._loadTasks();
        var self = this;
        // Build log entries with task info
        var taskMap = {}; this.state.tasks.forEach(function(t){ taskMap[t.taskNumber||t.id] = t; if(t.id) taskMap[t.id] = t; });
        var rows = '';
        this.state.logs.forEach(function(l) {
            var task = taskMap[l.taskId] || taskMap['TASK'+String(l.taskId).padStart(3,'0')];
            var taskName = task ? task.name : (l.taskId ? '任务#'+l.taskId : '-');
            var findings = l.findings || l.content || '';
            var fc = 'tag-gray';
            if(findings.indexOf('火灾')>=0 || findings.indexOf('火')>=0) fc='tag-red';
            else if(findings.indexOf('松材')>=0 || findings.indexOf('病')>=0 || findings.indexOf('虫')>=0) fc='tag-orange';
            else if(findings.indexOf('无异常')>=0 || findings==='') fc='tag-gray';
            else fc='tag-blue';
            rows += '<tr><td style="font-size:11px;">' + (l.date||l.createdAt||'-') + '</td><td>' + (l.rangerName||l.user_name||'-') + '</td><td>' + (l.area||'-') + '</td><td style="font-size:11px;">' + taskName + '</td>' +
                    '<td><span class="tag ' + fc + ' tag-sm">' + (findings||'无异常') + '</span></td><td>' + (l.durationMin||0) + '分</td><td>' + (l.distanceKm||0) + 'km</td>' +
                    '<td><a class="link-btn log-del-btn" data-id="' + (l.id||'') + '" style="color:#ff5252;cursor:pointer;font-size:11px;">删除</a></td></tr>';
        });
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>巡护日志 (' + this.state.logs.length + '条)</h3><button class="btn btn-sm btn-outline" id="btnRefreshLogs">刷新</button></div><div class="card-body">' +
            '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="date" id="logDateStart" style="padding:4px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:11px;"/>' +
            '<select id="logPersonFilter" style="padding:4px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:11px;"><option value="">全部人员</option></select>' +
            '<select id="logAreaFilter" style="padding:4px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:11px;"><option value="">全部区域</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select>' +
            '</div>' +
            '<div style="max-height:400px;overflow-y:auto;"><table class="data-table"><thead><tr><th>日期</th><th>巡护人</th><th>区域</th><th>关联任务</th><th>发现</th><th>时长</th><th>里程</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">暂无日志</td></tr>') + '</tbody></table></div></div></div>';
        // Populate person filter
        var pf = document.getElementById('logPersonFilter');
        var names = {}; this.state.logs.forEach(function(l){ var n=l.rangerName||l.user_name; if(n) names[n]=1; });
        for(var n in names) pf.innerHTML += '<option>'+n+'</option>';
        document.getElementById('btnRefreshLogs').onclick = function() { self._renderLogPanel(); };
        // Delete log handlers
        c.querySelectorAll('.log-del-btn').forEach(function(btn) {
            btn.onclick = async function() {
                if (!confirm('确定删除此日志？')) return;
                try {
                    var rs = await fetch('/api/patrol-logs/' + btn.dataset.id, { method: 'DELETE', headers: self._authHeaders() });
                    var js = await rs.json();
                    if (!js.success) { alert(js.error || '删除失败'); return; }
                } catch (e) { alert('网络错误'); return; }
                self._renderLogPanel();
            };
        });
    },

    _renderRangerLedger: function () {
        var c = document.getElementById('inner-ranger'); if (!c) return;
        var r = ''; var self = this;
        Object.keys(this.state.rangers).forEach(function (id) { var x = self.state.rangers[id]; var tc = x.status === '在线' ? 'tag-green' : 'tag-gray'; r += '<tr><td>' + id + '</td><td>' + x.name + '</td><td>' + (x.area || '-') + '</td><td><span class="tag ' + tc + ' tag-sm">' + x.status + '</span></td><td>' + (self._AUTO_RANGERS.indexOf(id) !== -1 ? '模拟' : '移动端') + '</td><td>' + (x.battery || 0).toFixed(0) + '%</td><td>' + (x.speed || 0).toFixed(1) + ' m/s</td></tr>'; });
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>护林员档案 (' + Object.keys(this.state.rangers).length + '人)</h3><button class="btn btn-sm btn-outline" id="btnRefreshRangerLedger">刷新</button></div><div class="card-body"><table class="data-table"><thead><tr><th>工号</th><th>姓名</th><th>区域</th><th>状态</th><th>来源</th><th>电量</th><th>速度</th></tr></thead><tbody>' + r + '</tbody></table></div></div>';
        document.getElementById('btnRefreshRangerLedger').onclick = function () { self._renderRangerLedger(); };
    },

    _renderDroneLedger: function () {
        var c = document.getElementById('inner-drone'); if (!c) return;
        var r = ''; var self = this;
        Object.keys(this.state.drones).forEach(function (id) { var x = self.state.drones[id]; var tc = x.status === '巡航中' ? 'tag-blue' : (x.status === '待命' ? 'tag-gray' : 'tag-green'); r += '<tr><td>' + id + '</td><td>' + x.model + '</td><td><div class="battery-bar"><div class="battery-fill ' + (x.battery > 60 ? 'high' : (x.battery > 30 ? 'mid' : 'low')) + '" style="width:' + x.battery + '%"></div></div>' + (x.battery || 0).toFixed(0) + '%</td><td>' + (x.alt || 0) + 'm</td><td><span class="tag ' + tc + ' tag-sm">' + x.status + '</span></td><td>' + (self._AUTO_DRONES.indexOf(id) !== -1 ? '模拟' : '移动端') + '</td></tr>'; });
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>无人机设备档案 (' + Object.keys(this.state.drones).length + '架)</h3></div><div class="card-body"><table class="data-table"><thead><tr><th>编号</th><th>型号</th><th>电量</th><th>高度</th><th>状态</th><th>来源</th></tr></thead><tbody>' + r + '</tbody></table></div></div>';
    },

    _renderTeamLedger: function () {
        var c = document.getElementById('inner-team'); if (!c) return;
        var self = this;
        var ts = [{ id: 'TM01', name: '青山巡护一队', leader: '张建国', count: 3, area: '一号林区', members: ['HL001', 'HL002', 'HL006'] }, { id: 'TM02', name: '青山巡护二队', leader: '刘德才', count: 3, area: '二/三号林区', members: ['HL005', 'HL007', 'HL008'] }, { id: 'TM03', name: '无人机巡检队', leader: '王大山', count: 2, area: '全域', members: ['HL003', 'HL004'] }];
        var r = '';
        ts.forEach(function (t) { r += '<tr><td>' + t.id + '</td><td>' + t.name + '</td><td>' + t.leader + '</td><td>' + t.count + '人</td><td>' + t.area + '</td><td>' + t.members.map(function (m) { var x = self.state.rangers[m]; return x ? x.name : m; }).join(', ') + '</td></tr>'; });
        c.innerHTML = '<div class="panel-card"><div class="card-header"><h3>巡护队伍管理</h3></div><div class="card-body"><table class="data-table"><thead><tr><th>编号</th><th>名称</th><th>队长</th><th>人数</th><th>区域</th><th>成员</th></tr></thead><tbody>' + r + '</tbody></table></div></div>';
    },

    _renderCoveragePanel: function () {
        var c = document.getElementById('sub-res-coverage'); if (!c) return;
        var panel = c.querySelector('#coveragePanel') || c.querySelector('.float-panel') || c;
        if (panel.querySelector('#coverageAnalysisPanel')) panel.querySelector('#coverageAnalysisPanel').remove();
        var d = document.createElement('div'); d.id = 'coverageAnalysisPanel';
        var today = new Date().toISOString().slice(0, 10);
        var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        d.innerHTML = '<div class="panel-card"><div class="card-header"><h3>巡护覆盖分析</h3></div><div class="card-body">' +
            '<div style="margin-bottom:8px;font-size:11px;color:var(--text-secondary);">选择分析时间范围：</div>' +
            '<div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">' +
            '<button class="btn btn-sm btn-outline period-btn active" data-period="today">今日</button>' +
            '<button class="btn btn-sm btn-outline period-btn" data-period="7d">近7天</button>' +
            '<button class="btn btn-sm btn-outline period-btn" data-period="30d">近30天</button>' +
            '<button class="btn btn-sm btn-outline period-btn" data-period="custom">自定义</button></div>' +
            '<div id="coverageDateRange" style="display:none;margin-bottom:8px;">' +
            '<div style="display:flex;gap:6px;align-items:center;font-size:11px;">' +
            '<input type="date" id="covStartDate" value="' + weekAgo + '" style="padding:4px;background:#0a1628;border:1px solid #1a3355;color:#e4edf5;border-radius:4px;font-size:11px;flex:1;"/>' +
            '<span style="color:var(--text-muted);">至</span>' +
            '<input type="date" id="covEndDate" value="' + today + '" style="padding:4px;background:#0a1628;border:1px solid #1a3355;color:#e4edf5;border-radius:4px;font-size:11px;flex:1;"/>' +
            '</div></div>' +
            '<button class="btn btn-primary btn-block" id="btnRunCoverageAnalysis" style="margin-top:4px;">执行分析</button>' +
            '<div id="coverageResult" style="margin-top:12px;display:none;font-size:12px;"></div>' +
            '</div></div>';
        panel.appendChild(d);
        var self = this;
        d.querySelectorAll('.period-btn').forEach(function (b) {
            b.onclick = function () {
                d.querySelectorAll('.period-btn').forEach(function (x) { x.classList.remove('active'); });
                this.classList.add('active');
                var dr = document.getElementById('coverageDateRange');
                if (dr) dr.style.display = (this.dataset.period === 'custom') ? 'block' : 'none';
            };
        });
        document.getElementById('btnRunCoverageAnalysis').onclick = function () { self._runCoverageAnalysis(); };
    },

    _runCoverageAnalysis: async function () {
        var self = this;
        var btn = document.getElementById('btnRunCoverageAnalysis');
        if (btn) { btn.disabled = true; btn.textContent = '分析中...'; }

        var pb = document.querySelector('.period-btn.active');
        var pd = pb ? pb.dataset.period : 'today';
        var payload = { period: pd === '7d' ? '7days' : (pd === '30d' ? '30days' : pd) };
        if (pd === 'custom') {
            var sd = document.getElementById('covStartDate');
            var ed = document.getElementById('covEndDate');
            if (sd && ed) { payload.start_date = sd.value; payload.end_date = ed.value; }
        }

        try {
            var rs = await fetch('/api/analysis/coverage', {
                method: 'POST', headers: this._authHeaders(),
                body: JSON.stringify(payload)
            });
            var json = await rs.json();
            if (!json.success) throw new Error(json.error || '分析失败');
            this._renderCoverageResult(json.data);
        } catch (e) {
            var re = document.getElementById('coverageResult');
            if (re) { re.style.display = 'block'; re.innerHTML = '<span style="color:var(--accent-red);">分析失败: ' + (e.message || '未知错误') + '</span>'; }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '执行分析'; }
        }
    },

    _renderCoverageResult: function (data) {
        var re = document.getElementById('coverageResult');
        if (!re) return;
        re.style.display = 'block';

        var map = this._getActiveMap();
        if (map) {
            if (!this.state._coverageLayers) this.state._coverageLayers = [];
            this.state._coverageLayers.forEach(function (l) { try { map.removeLayer(l); } catch (e) {} });
            this.state._coverageLayers = [];
        }

        var rateColor = data.coverageRate >= 70 ? 'var(--accent-green)' : (data.coverageRate >= 40 ? 'var(--accent-orange)' : 'var(--accent-red)');
        var compColor = data.completeness.indexOf('优秀') >= 0 ? 'var(--accent-green)' : (data.completeness.indexOf('良好') >= 0 ? 'var(--accent-blue)' : (data.completeness.indexOf('一般') >= 0 ? 'var(--accent-orange)' : 'var(--accent-red)'));
        var periodLabel = data.period === 'today' ? '今日' : (data.period === '7days' ? '近7天' : (data.period === '30days' ? '近30天' : '自定义'));
        var h = '<div style="margin-bottom:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">' +
            '<div style="font-weight:600;margin-bottom:6px;">📊 覆盖分析报告 <span style="font-size:10px;color:var(--text-muted);font-weight:400;">(' + periodLabel + ')</span></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;">' +
            '<div>覆盖率: <b style="color:' + rateColor + ';">' + data.coverageRate + '%</b></div>' +
            '<div>完整度: <b style="color:' + compColor + ';">' + data.completeness + '</b></div>' +
            '<div>覆盖面积: <b>' + (data.coveredArea || 0) + ' 亩</b></div>' +
            '<div>盲区面积: <b style="color:var(--accent-red);">' + (data.blindArea || 0) + ' 亩</b></div>' +
            '<div>林场总面积: <b>' + (data.totalArea || 0) + ' 亩</b></div>' +
            '<div>轨迹点数: <b>' + (data.trackPoints || 0) + '</b></div>' +
            (data.fromGeoserver ? '<div style="grid-column:1/-1;font-size:10px;color:var(--accent-green);">✓ 基于白云山林场真实边界</div>' : '<div style="grid-column:1/-1;font-size:10px;color:var(--accent-orange);">⚠ 使用近似边界框</div>') +
            '</div></div>';

        // 盲区列表
        if (data.blindAreas && data.blindAreas.length > 0) {
            h += '<div style="margin-top:6px;"><b style="font-size:11px;color:var(--accent-red);">🔴 巡护盲区 (' + data.blindAreas.length + '处)</b></div>';
            data.blindAreas.forEach(function (ba) {
                h += '<div style="font-size:11px;padding:2px 0;display:flex;align-items:center;gap:4px;">' +
                    '<span style="flex:1;">' + ba.name + '</span>' +
                    '<span class="tag tag-red tag-sm">' + ba.tag + '</span>' +
                    '<span style="color:var(--text-muted);">' + ba.area + '亩</span>' +
                    '<a class="link-btn cov-blind-focus" data-lat="' + ba.lat + '" data-lng="' + ba.lng + '" style="color:var(--accent-blue);font-size:10px;cursor:pointer;">📍</a></div>';
            });
        } else if (data.coverageRate > 0) {
            h += '<div style="margin-top:6px;font-size:11px;color:var(--accent-green);">✅ 当前时段巡护覆盖良好，无明显盲区</div>';
        }

        re.innerHTML = h;

        // 绘制林场边界和盲区标记
        if (map) {
            var self = this;
            var bnd = this._getBoundaryCoords();
            var boundaryLine = L.polyline(bnd, {
                color: '#00e676', weight: 2.5, opacity: 0.6, dashArray: '6,8'
            }).addTo(map).bindPopup('白云山林场边界');
            this.state._coverageLayers.push(boundaryLine);

            // 绘制盲区标记
            if (data.blindAreas) {
                data.blindAreas.forEach(function (ba) {
                    if (ba.lat && ba.lng) {
                        var marker = L.circleMarker([ba.lat, ba.lng], {
                            radius: 8, color: '#ff5252', fillColor: '#ff5252', fillOpacity: 0.3, weight: 2
                        }).addTo(map);
                        marker.bindPopup('<b>' + ba.name + '</b><br>面积: ' + ba.area + '亩<br>' + ba.tag);
                        self.state._coverageLayers.push(marker);
                    }
                });
            }

            // 自适应视图
            try { map.fitBounds(L.latLngBounds(bnd).pad(0.1), { animate: true }); } catch (e) {}
        }

        // 绑定盲区定位按钮
        re.querySelectorAll('.cov-blind-focus').forEach(function (btn) {
            btn.onclick = function () {
                var lat = parseFloat(btn.dataset.lat), lng = parseFloat(btn.dataset.lng);
                if (lat && lng && map) map.setView([lat, lng], 15, { animate: true });
            };
        });
    },
    _renderAllPanels: function () {
        this._renderTaskPublish(); this._renderTaskList(); this._renderRoutePlanning();
        this._renderRouteMgmt(); this._renderLogPanel(); this._renderRangerLedger(); this._renderDroneLedger();
        this._renderTeamLedger(); this._renderCoveragePanel(); this._renderHistoryPanel();
        this._renderRealtimePanels();
    },

    // ==================== UI 事件绑定 ====================
    _bindUI: function () {
        var self = this;

        var pageEl = document.getElementById('page-resource');
        if (pageEl) {
            var po = new MutationObserver(function (ms) {
                ms.forEach(function (mu) {
                    if (mu.target.classList.contains('active')) {
                        console.log('[Patrol] page-resource 激活');
                        self._waitForMap(function (map) { self.state.realtimeMap = map; self._startSimOnMap(); });
                    } else {
                        // 切换到其他模块 → 清除回放轨迹，恢复地图
                        self._cleanupOnNavigate();
                    }
                });
            });
            po.observe(pageEl, { attributes: true, attributeFilter: ['class'] });
            if (pageEl.classList.contains('active')) {
                this._waitForMap(function (map) { self.state.realtimeMap = map; self._startSimOnMap(); });
            }
        }

        // 顶部导航切换到其他模块时清理
        document.querySelectorAll('.nav-item[data-page]').forEach(function (nav) {
            nav.addEventListener('click', function () {
                if (this.dataset.page !== 'page-resource') {
                    self._cleanupOnNavigate();
                }
            });
        });

        // 覆盖分析子模块切换监听
        var covSub = document.getElementById('sub-res-coverage');
        if (covSub) {
            var covObs = new MutationObserver(function (ms) {
                ms.forEach(function (mu) {
                    if (mu.target.classList.contains('active')) {
                        // 进入覆盖分析 → 隐藏所有模拟图层（与任务管理相同方式）
                        self._hideSimForTaskMgmt();
                        // 在共享地图上绘制绿色边界并缩放至林区
                        var activeMap = self._getActiveMap();
                        if (activeMap) {
                            var bnd = self._getBoundaryCoords();
                            if (!self.state._coverageBoundaryLine) {
                                self.state._coverageBoundaryLine = L.polyline(bnd, {
                                    color: '#00e676', weight: 2.5, opacity: 0.7, dashArray: '6,8'
                                }).addTo(activeMap);
                            }
                            setTimeout(function () {
                                activeMap.fitBounds(L.latLngBounds(bnd).pad(0.1));
                            }, 200);
                        }
                        self._renderCoveragePanel();
                    } else {
                        // 离开覆盖分析 → 恢复模拟图层
                        self._showSimForTaskMgmt();
                        // 清除分析图层和绿色边界
                        var activeMap = self._getActiveMap();
                        if (self.state._coverageLayers && activeMap) {
                            self.state._coverageLayers.forEach(function (l) { try { activeMap.removeLayer(l); } catch (e) {} });
                            self.state._coverageLayers = [];
                        }
                        if (self.state._coverageBoundaryLine && activeMap) {
                            try { activeMap.removeLayer(self.state._coverageBoundaryLine); } catch (e) {}
                        }
                        self.state._coverageBoundaryLine = null;
                    }
                });
            });
            covObs.observe(covSub, { attributes: true, attributeFilter: ['class'] });
        }

        var so = new MutationObserver(function (ms) {
            ms.forEach(function (mu) {
                if (mu.target.classList.contains('active')) {
                    var id = mu.target.id;
                    // 切换到非历史轨迹标签时，退出回放模式
                    if (id !== 'inner-history') self._clearQueryTrack();

                    // 任务管理子模块标签 → 隐藏模拟轨迹，让地图干净用于路线绘制
                    var taskMgmtTabs = ['inner-task-mgmt', 'inner-route', 'inner-route-mgmt', 'inner-log'];
                    if (taskMgmtTabs.indexOf(id) !== -1) {
                        self._hideSimForTaskMgmt();
                    } else {
                        // 实时监控标签 → 恢复模拟轨迹
                        self._showSimForTaskMgmt();
                    }

                    if (id === 'inner-ranger-rt') self._refreshMonitorList();
                    if (id === 'inner-task-mgmt') self._renderTaskList();
                    if (id === 'inner-ranger') self._renderRangerLedger();
                    if (id === 'inner-drone') self._renderDroneLedger();
                    if (id === 'inner-team') self._renderTeamLedger();
                    if (id === 'inner-log') self._renderLogPanel();
                    if (id === 'inner-route') self._renderRoutePlanning();
                    if (id === 'inner-route-mgmt') self._renderRouteMgmt();
                    if (id === 'inner-history') self._renderHistoryPanel();
                    // 切出路径规划时清除绘制状态
                    if (id !== 'inner-route' && self.state._routeDrawing && self.state._routeDrawing.active) self._clearDrawing();
                }
            });
        });

        ['inner-ranger-rt', 'inner-drone-rt', 'inner-history', 'inner-task-mgmt', 'inner-route', 'inner-route-mgmt', 'inner-log', 'inner-ranger', 'inner-drone', 'inner-team'].forEach(function (id) { var el = document.getElementById(id); if (el) so.observe(el, { attributes: true, attributeFilter: ['class'] }); });

        this._renderRealtimePanels();
    },

    _renderRealtimePanels: function () {
        // HTML 已预置 rangerList/droneList 容器，直接填充动态数据
        this._refreshMonitorList(true);
        this._initLayerCheckboxes();
    },

    // ==================== 图层管理联动 ====================
    // 让图层管理面板中的"护林员位置"/"无人机位置"控制巡护模块的实时标记
    _initLayerCheckboxes: function () {
        var self = this;
        var rangerCb = document.querySelector('#businessLayerGroup input[data-layer="rangers"]');
        var droneCb = document.querySelector('#businessLayerGroup input[data-layer="drones"]');
        if (!rangerCb || !droneCb) return;

        var apply = function () {
            var map = self._getActiveMap();
            if (!map) return;
            Object.keys(self.state.entityMarkers).forEach(function (id) {
                var marker = self.state.entityMarkers[id];
                if (!marker) return;
                var isRanger = self.state.rangers[id] !== undefined;
                if (isRanger) {
                    rangerCb.checked ? marker.addTo(map) : map.removeLayer(marker);
                } else {
                    droneCb.checked ? marker.addTo(map) : map.removeLayer(marker);
                }
            });
        };

        rangerCb.onchange = apply;
        droneCb.onchange = apply;
        // 初始同步
        apply();
    },

};  // End of Patrol object

(function () {
    var cr = function () { if (document.getElementById('inner-task-mgmt')) { Patrol.init(); } else { setTimeout(cr, 500); } };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', cr) : cr();
})();
