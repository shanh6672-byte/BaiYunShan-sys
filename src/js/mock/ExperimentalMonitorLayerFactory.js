// ==================== 实验监控图层工厂 ====================
// 文件：src/js/mock/ExperimentalMonitorLayerFactory.js
// 职责：为巡护监控页面提供统一图层创建函数
//       从现有实验数据源（SHP + 生成器）创建 Leaflet 图层实例
//       每个地图实例需要独立的 Layer 对象（不能共享同一 Layer）

var ExperimentalMonitorLayerFactory = {

    _turfPolygon: null,
    _boundaryGCJ: null,
    _ready: false,

    // ---- 初始化（异步，依赖 SHP 边界加载） ----
    init: function () {
        var self = this;
        if (this._ready) return Promise.resolve(this);
        return window.BAIYUNSHAN_BOUNDARY_READY.then(function (geoJSON) {
            var rings = window.BAIYUNSHAN_BOUNDARY_RINGS;
            if (!rings || !rings.length) throw new Error('SHP rings 为空');

            // 构建 Turf Polygon
            var mainRing = rings[0].map(function (p) { return [p[1], p[0]]; });
            if (mainRing[0][0] !== mainRing[mainRing.length - 1][0] || mainRing[0][1] !== mainRing[mainRing.length - 1][1]) {
                mainRing.push([mainRing[0][0], mainRing[0][1]]);
            }
            self._turfPolygon = turf.polygon([mainRing]);

            // SHP边界 GCJ-02 转换
            self._boundaryGCJ = self._convertGeoJSON(JSON.parse(JSON.stringify(geoJSON)));
            self._ready = true;
            console.log('[MonitorFactory] 初始化完成，边界已加载');
            return self;
        });
    },

    // ---- GCJ-02 转换 ----
    _convertGeoJSON: function (fc) {
        if (typeof CoordTransform === 'undefined') return fc;
        if (!fc || !fc.features) return fc;
        fc.features.forEach(function (f) {
            if (!f.geometry) return;
            if (f.geometry.type === 'Point') {
                var gcj = CoordTransform.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
                if (gcj) f.geometry.coordinates = gcj;
            } else if (f.geometry.type === 'Polygon') {
                f.geometry.coordinates = f.geometry.coordinates.map(function (ring) {
                    return ring.map(function (c) { var g = CoordTransform.wgs84ToGcj02(c[0], c[1]); return g || c; });
                });
            }
        });
        return fc;
    },

    _convertPointFC: function (fc) {
        var converted = JSON.parse(JSON.stringify(fc));
        return this._convertGeoJSON(converted);
    },

    // ---- 生成护林员 FC（GCJ-02） ----
    _getRangerFC: function () {
        var rangerFC = ForestRangerGenerator.generate(this._turfPolygon, window.BAIYUNSHAN_BOUNDARY_RINGS);
        // 边界校验
        var self = this;
        rangerFC.features = rangerFC.features.filter(function (f) {
            return turf.booleanPointInPolygon(turf.point(f.geometry.coordinates), self._turfPolygon);
        });
        return this._convertPointFC(rangerFC);
    },

    // ---- 生成无人机 FC（GCJ-02） ----
    _getDroneFC: function () {
        var droneFC = DroneGenerator.generate(this._turfPolygon, window.BAIYUNSHAN_BOUNDARY_RINGS);
        var self = this;
        droneFC.features = droneFC.features.filter(function (f) {
            return turf.booleanPointInPolygon(turf.point(f.geometry.coordinates), self._turfPolygon);
        });
        return this._convertPointFC(droneFC);
    },

    // ---- 生成小班 FC（GCJ-02） ----
    _getSubcompartmentFC: function () {
        var scFC = generateSubcompartments(this._turfPolygon);
        return this._convertGeoJSON(JSON.parse(JSON.stringify(scFC)));
    },

    // ---- 创建 SHP 边界图层 ----
    createBoundaryLayer: function () {
        if (!this._boundaryGCJ) return null;
        return L.geoJSON(this._boundaryGCJ, {
            style: { color: '#00ff88', weight: 3, opacity: 0.9, fillColor: '#00ff88', fillOpacity: 0.06, dashArray: '6,4' }
        }).bindTooltip('白云山林场边界(SHP)');
    },

    // ---- 创建林业小班图层 ----
    createSubcompartmentLayer: function () {
        var fc = this._getSubcompartmentFC();
        if (!fc || !fc.features || fc.features.length === 0) return null;
        console.log('[MonitorFactory] 林业小班图层已创建：' + fc.features.length + ' 个');
        return L.geoJSON(fc, {
            style: { color: '#4caf50', weight: 2, opacity: 0.9, fillColor: '#4caf50', fillOpacity: 0.15 },
            onEachFeature: function (feat, l) {
                var p = feat.properties;
                var fc2 = p.forestType === '针叶林' ? '#4caf50' : p.forestType === '阔叶林' ? '#8bc34a' : p.forestType === '混交林' ? '#009688' : p.forestType === '竹林' ? '#cddc39' : '#ff9800';
                l.bindPopup('<div class="popup-info"><div class="popup-title" style="color:' + fc2 + ';">林业小班</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">' + p.subId + '</span></div><div class="popup-row"><span class="popup-label">林分类型</span><span class="popup-val">' + p.forestType + '</span></div><div class="popup-row"><span class="popup-label">面积</span><span class="popup-val">' + p.area + '</span></div><div class="popup-row"><span class="popup-label">优势树种</span><span class="popup-val">' + p.dominantSpecies + '</span></div><div class="popup-row"><span class="popup-label">龄组</span><span class="popup-val">' + p.ageGroup + '</span></div><div class="popup-row"><span class="popup-label">郁闭度</span><span class="popup-val">' + p.canopyDensity + '</span></div><div class="popup-row"><span class="popup-label">管护区</span><span class="popup-val">' + p.managementUnit + '</span></div></div>');
            }
        });
    },

    // ---- 创建护林员图层 ----
    createRangerLayer: function () {
        var fc = this._getRangerFC();
        if (!fc || !fc.features || fc.features.length === 0) return null;
        var icon = L.icon({ iconUrl: './forest-ranger.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        console.log('[MonitorFactory] 护林员图层已创建：' + fc.features.length + ' 个');
        return L.geoJSON(fc, {
            pointToLayer: function (feat, latlng) { return L.marker(latlng, { icon: icon }); },
            onEachFeature: function (feat, l) {
                var p = feat.properties;
                l.bindPopup('<div class="popup-info"><div class="popup-title" style="color:#00e676;">护林员</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">' + p.id + '</span></div><div class="popup-row"><span class="popup-label">姓名</span><span class="popup-val">' + p.name + '</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">' + p.status + '</span></div><div class="popup-row"><span class="popup-label">电话</span><span class="popup-val">' + p.phone + '</span></div><div class="popup-row"><span class="popup-label">区域</span><span class="popup-val">' + p.patrolArea + '</span></div></div>');
            }
        });
    },

    // ---- 创建无人机图层 ----
    createDroneLayer: function () {
        var fc = this._getDroneFC();
        if (!fc || !fc.features || fc.features.length === 0) return null;
        var icon = L.icon({ iconUrl: './drone.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        console.log('[MonitorFactory] 无人机图层已创建：' + fc.features.length + ' 个');
        return L.geoJSON(fc, {
            pointToLayer: function (feat, latlng) { return L.marker(latlng, { icon: icon }); },
            onEachFeature: function (feat, l) {
                var p = feat.properties;
                l.bindPopup('<div class="popup-info"><div class="popup-title" style="color:#448aff;">无人机</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">' + p.id + '</span></div><div class="popup-row"><span class="popup-label">型号</span><span class="popup-val">' + p.model + '</span></div><div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">' + p.battery + '</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">' + p.status + '</span></div><div class="popup-row"><span class="popup-label">高度</span><span class="popup-val">' + p.altitude + '</span></div></div>');
            }
        });
    },

    // ---- 获取所有坐标用于 fitBounds ----
    getAllCoords: function () {
        var coords = [];
        if (this._boundaryGCJ && this._boundaryGCJ.features) {
            this._boundaryGCJ.features.forEach(function (f) {
                if (f.geometry && f.geometry.coordinates) {
                    f.geometry.coordinates[0].forEach(function (c) { coords.push(c); });
                }
            });
        }
        return coords;
    },

    // ---- 清除内部缓存（重新生成时调用） ----
    refresh: function () {
        // 不重新生成 turfPolygon，只清除 FC 缓存
        console.log('[MonitorFactory] 数据刷新');
    }
};
