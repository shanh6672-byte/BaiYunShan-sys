// ==================== GeoServer 真实图层加载器 ====================
// 从 GeoServer WFS 加载数据，经 GCJ-02 坐标转换后与高德/天地图底图对齐

/**
 * GCJ-02 坐标修正 WMS 瓦片图层
 * 底图是高德(GCJ-02)，GeoServer 栅格是 WGS-84(EPSG:4326)
 * 发送 WMS 请求前将 bbox 从 GCJ-02 逆转为 WGS-84
 */
if (typeof L !== 'undefined') {
    L.TileLayer.GCJ02CorrectedWMS = L.TileLayer.WMS.extend({
        getTileUrl: function(coords) {
            var url = L.TileLayer.WMS.prototype.getTileUrl.call(this, coords);
            if (typeof CoordTransform === 'undefined') return url;
            var m = url.match(/[&?]bbox=([^&]+)/i);
            if (!m) return url;
            var p = m[1].split(',');
            var south = parseFloat(p[0]), west = parseFloat(p[1]);
            var north = parseFloat(p[2]), east = parseFloat(p[3]);
            var sw = CoordTransform.gcj02ToWgs84(west, south);
            var ne = CoordTransform.gcj02ToWgs84(east, north);
            if (!sw || !ne) return url;
            var fixed = [sw[1].toFixed(8), sw[0].toFixed(8), ne[1].toFixed(8), ne[0].toFixed(8)].join(',');
            return url.replace(m[1], fixed);
        }
    });
}

const GeoServerLayers = {
    _loaded: false,
    _layers: {},  // Leaflet GeoJSON layers
    _apiMarkers: {},

    async init() {
        if (this._loaded || ApiService.USE_MOCK) return;

        try {
            // WFS 获取边界 GeoJSON → GCJ-02 转换 → 与底图对齐
            await this._loadBoundaryAligned();
            await this._loadCompartments();
            this._loadDem();
            this._loadNdvi();
            this._loadNdvi2022();
            this._loadFvc();
            this._loadFvc2022();
            this._bindLayerControls();
            await this._loadApiMarkers();
            await this._loadFirePoints();
            await this._loadPestPoints();
            this._loaded = true;
            console.log('[GeoLayers] 图层+标记就绪');
            this._addToAllMaps();
        } catch (e) {
            console.error('[GeoLayers] 加载失败:', e);
        }
    },

    /** 从后端加载火情点（DB 数据，已同步至 GeoServer） */
    async _loadFirePoints() {
        try {
            const data = await ApiService.getFirePoints();
            this._firePoints = data || {};
            console.log('[GeoLayers] 火情点: ' + Object.keys(this._firePoints).length + ' 个');
        } catch (e) {
            console.warn('[GeoLayers] 火情点加载失败:', e.message);
            this._firePoints = {};
        }
    },

    /** 从后端加载疫情点 */
    async _loadPestPoints() {
        try {
            const data = await ApiService.getPests();
            this._pestPoints = data || [];
            console.log('[GeoLayers] 疫情点: ' + (this._pestPoints.length || 0) + ' 个');
        } catch (e) {
            console.warn('[GeoLayers] 疫情点加载失败:', e.message);
            this._pestPoints = [];
        }
    },

    /** WFS获取边界，转为GCJ-02坐标系对齐高德/天地图 */
    async _loadBoundaryAligned() {
        try {
            const url = ApiService.BASE_URL + '/api/geoserver/baiyunshan/ows'
                + '?service=WFS&version=2.0.0&request=GetFeature'
                + '&typeName=baiyunshan:baiyun_boundary&outputFormat=application/json';
            const token = ApiService._getToken ? ApiService._getToken() : '';
            const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            const res = await fetch(url, { headers });
            const geojson = await res.json();

            // GCJ-02 坐标转换（兼容 Polygon 和 MultiPolygon）
            if (typeof CoordTransform !== 'undefined' && geojson.features) {
                function convertBoundaryCoords(coords) {
                    if (typeof coords[0] === 'number') {
                        const gcj = CoordTransform.wgs84ToGcj02(coords[0], coords[1]);
                        return gcj || coords;
                    }
                    return coords.map(convertBoundaryCoords);
                }
                geojson.features.forEach(f => {
                    if (f.geometry && f.geometry.coordinates) {
                        f.geometry.coordinates = convertBoundaryCoords(f.geometry.coordinates);
                    }
                });
                console.log('[GeoLayers] 边界坐标已转换为GCJ-02');
            }

            this._layers.boundary = L.geoJSON(geojson, {
                style: { color: '#00ff88', weight: 3, opacity: 0.9, fillOpacity: 0, dashArray: '6,4' }
            }).bindTooltip('白云山林场边界');
            console.log('[GeoLayers] 边界已加载: ' + (geojson.features ? geojson.features.length : 0) + ' 个面');
        } catch (e) {
            console.warn('[GeoLayers] 边界加载失败:', e.message);
        }
    },

    /** WFS获取林班小班，转为GCJ-02坐标系 */
    async _loadCompartments() {
        try {
            const url = ApiService.BASE_URL + '/api/geoserver/baiyunshan/ows'
                + '?service=WFS&version=2.0.0&request=GetFeature'
                + '&typeName=baiyunshan:baiyunshan_compartments1&outputFormat=application/json';
            const token = ApiService._getToken ? ApiService._getToken() : '';
            const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            const res = await fetch(url, { headers });
            const geojson = await res.json();

            // GCJ-02 坐标转换（兼容 Polygon 和 MultiPolygon）
            if (typeof CoordTransform !== 'undefined' && geojson.features) {
                function convertCoords(coords) {
                    if (typeof coords[0] === 'number') {
                        // 叶子节点：[lng, lat]
                        const gcj = CoordTransform.wgs84ToGcj02(coords[0], coords[1]);
                        return gcj || coords;
                    }
                    return coords.map(convertCoords);
                }
                geojson.features.forEach(f => {
                    if (f.geometry && f.geometry.coordinates) {
                        f.geometry.coordinates = convertCoords(f.geometry.coordinates);
                    }
                });
            }

            // 5个林区固定颜色
            const colors = ['#4fc3f7','#00e676','#ffb74d','#e57373','#ba68c8'];
            this._layers.compartments = L.geoJSON(geojson, {
                style: function(feature) {
                    var idx = ((feature.properties || {}).id || 1) - 1;
                    return {
                        color: colors[idx % colors.length],
                        weight: 2, opacity: 0.8,
                        fillOpacity: 0,
                    };
                },
                onEachFeature: function(feature, layer) {
                    var p = feature.properties || {};
                    layer.bindTooltip((p.name || '林区') + ' · ' + (p.area_mu || '') + '亩 · ' + (p.tree || ''));
                }
            });
            console.log('[GeoLayers] 林班小班已加载: ' + (geojson.features ? geojson.features.length : 0) + ' 个区');
        } catch (e) {
            console.warn('[GeoLayers] 林班小班加载失败:', e.message);
        }
    },

    /** 加载DEM（GCJ-02修正、裁剪后边界外透明、带金字塔） */
    _loadDem() {
        this._layers.dem = new L.TileLayer.GCJ02CorrectedWMS(this._geoserverWms, {
            layers: 'baiyunshan:dem',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            uppercase: true,
            maxZoom: 20,
            opacity: 0.5,
        });
        console.log('[GeoLayers] DEM图层已创建');
    },

    /** 加载NDVI 2021 */
    _loadNdvi() {
        this._layers.ndvi = new L.TileLayer.GCJ02CorrectedWMS(this._geoserverWms, {
            layers: 'baiyunshan:ndvi_2021',
            format: 'image/png', transparent: true,
            version: '1.3.0', crs: L.CRS.EPSG4326,
            uppercase: true, maxZoom: 20, opacity: 0.8,
        });
        console.log('[GeoLayers] NDVI 2021已创建');
    },

    /** 加载NDVI 2022 */
    _loadNdvi2022() {
        this._layers.ndvi2022 = new L.TileLayer.GCJ02CorrectedWMS(this._geoserverWms, {
            layers: 'baiyunshan:ndvi_2022',
            format: 'image/png', transparent: true,
            version: '1.3.0', crs: L.CRS.EPSG4326,
            uppercase: true, maxZoom: 20, opacity: 0.8,
        });
        console.log('[GeoLayers] NDVI 2022已创建');
    },

    /** 加载FVC 2021 */
    _loadFvc() {
        this._layers.fvc = new L.TileLayer.GCJ02CorrectedWMS(this._geoserverWms, {
            layers: 'baiyunshan:fvc_2021',
            format: 'image/png', transparent: true,
            version: '1.3.0', crs: L.CRS.EPSG4326,
            uppercase: true, maxZoom: 20, opacity: 0.8,
        });
        console.log('[GeoLayers] FVC 2021已创建');
    },

    /** 加载FVC 2022 */
    _loadFvc2022() {
        this._layers.fvc2022 = new L.TileLayer.GCJ02CorrectedWMS(this._geoserverWms, {
            layers: 'baiyunshan:fvc_2022',
            format: 'image/png', transparent: true,
            version: '1.3.0', crs: L.CRS.EPSG4326,
            uppercase: true, maxZoom: 20, opacity: 0.8,
        });
        console.log('[GeoLayers] FVC 2022已创建');
    },

    /** 绑定专题图层 + 巡护轨迹侧边栏控制（延迟确保 DOM + 地图就绪） */
    _bindLayerControls() {
        var self = this;
        function bind(k, cbSel, sliderSel) {
            function doBind() {
                var cb = document.querySelector(cbSel);
                if (!cb) { setTimeout(doBind, 500); return; }  // DOM 还没渲染
                cb.addEventListener('change', function() {
                    var checked = this.checked;
                    // 直接获取所有 Leaflet 地图实例（不依赖 MapFacade._instances 的重试）
                    var maps = Object.values(MapFacade._instances);
                    if (maps.length === 0) {
                        // 回退：从 DOM 中查找 Leaflet 地图实例
                        document.querySelectorAll('.leaflet-container').forEach(function(el) {
                            if (el._leaflet_map) maps.push(el._leaflet_map);
                        });
                    }
                    if (checked) {
                        maps.forEach(function(m) { if (self._layers[k] && !m.hasLayer(self._layers[k])) { m.addLayer(self._layers[k]); m.invalidateSize(); } });
                    } else {
                        maps.forEach(function(m) { if (self._layers[k] && m.hasLayer(self._layers[k])) m.removeLayer(self._layers[k]); });
                    }
                });
                var sl = document.querySelector(sliderSel);
                if (sl) sl.addEventListener('input', function() { if (self._layers[k]) self._layers[k].setOpacity(this.value/100); });
            }
            doBind();
        }
        bind('dem', '#rasterLayerGroup input[data-layer="dem"]', '#rasterLayerGroup input.layer-opacity[data-layer="dem"]');
        bind('ndvi', '#rasterLayerGroup input[data-layer="ndvi_2021"]', '#rasterLayerGroup input.layer-opacity[data-layer="ndvi_2021"]');
        bind('ndvi2022', '#rasterLayerGroup input[data-layer="ndvi_2022"]', '#rasterLayerGroup input.layer-opacity[data-layer="ndvi_2022"]');
        bind('fvc', '#rasterLayerGroup input[data-layer="fvc_2021"]', '#rasterLayerGroup input.layer-opacity[data-layer="fvc_2021"]');
        bind('fvc2022', '#rasterLayerGroup input[data-layer="fvc_2022"]', '#rasterLayerGroup input.layer-opacity[data-layer="fvc_2022"]');
        // 林场边界 + 林区界限
        bind('boundary', '#businessLayerGroup input[data-layer="forestBoundary"]', '#businessLayerGroup input.layer-opacity[data-layer="forestBoundary"]');
        bind('compartments', '#businessLayerGroup input[data-layer="subCompartments"]', '#businessLayerGroup input.layer-opacity[data-layer="subCompartments"]');

        // 巡护轨迹 toggle
        var trackCb = document.querySelector('#businessLayerGroup input[data-layer="patrolRoutes"]');
        if (trackCb) trackCb.addEventListener('change', function() { self._togglePatrolTracks(this.checked); });
    },

    _togglePatrolTracks: function(visible) {
        var maps = Object.values(MapFacade._instances);
        maps.forEach(function(map) {
            map.eachLayer(function(layer) {
                if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                    var c = layer.options.color || '';
                    if (c === '#fdd835' || c === '#448aff')
                        layer.setStyle({ opacity: visible ? (layer._origOpacity || 0.85) : 0 });
                }
            });
        });
    },

    /** 从API加载火情/疫情标记（护林员/无人机由巡护模块管理） */
    async _loadApiMarkers() {
        // 护林员和无人机位置由 patrol-module.js 实时管理，此处仅加载灾害数据
    },

    /**
     * 在地图上添加/刷新API标记（先清除上次的标记再添加，避免叠加）
     */
    _addMarkersToMap(map) {
        if (!map || typeof L === 'undefined') return;

        const mapId = map._leaflet_id;

        // 清除上次添加的标记（避免叠加）
        ['fires','pests','all'].forEach(t => {
            const key = mapId + '_' + t;
            if (this._typedLayers && this._typedLayers[key]) {
                map.removeLayer(this._typedLayers[key]);
            }
        });
        if (this._markerLayers && this._markerLayers[mapId]) {
            map.removeLayer(this._markerLayers[mapId]);
        }

        // 按类型分别创建 layerGroup
        this._typedLayers = this._typedLayers || {};
        this._markerLayers = this._markerLayers || {};
        const fGroup = L.layerGroup();
        const pGroup = L.layerGroup();
        const allGroup = L.layerGroup();

        const fIcon = L.icon({ iconUrl: './fire.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
        const pIcon = L.icon({ iconUrl: './disease.png', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30] });

        // 火情点
        const firePoints = this._firePoints || {};
        const fireMarkers = [];
        Object.keys(firePoints).forEach(key => {
            const f = firePoints[key];
            if (!f || !f.lat || !f.lng) return;
            const m = L.marker([f.lat, f.lng], { icon: fIcon }).addTo(fGroup).addTo(allGroup)
                .bindTooltip((f.name || f.id) + ' · ' + (f.riskLevel || '') + '级火情');
            const imgUrl = f.imagePath ? ApiService.BASE_URL + f.imagePath : '';
            m.bindPopup(`<div class="popup-info" style="min-width:200px;">
                <div class="popup-title" style="color:#ff3d3d;">火情 · ${f.id || ''}</div>
                ${imgUrl ? `<img src="${imgUrl}" style="width:100%;max-height:140px;object-fit:cover;border-radius:4px;margin:4px 0;"/>` : ''}
                <div class="popup-row">名称：${f.name || '-'}</div>
                <div class="popup-row">风险等级：${f.riskLevel || '-'}</div>
                <div class="popup-row">温度：${f.temperatureC || '-'}°C</div>
                <div class="popup-row">面积：${f.areaMu || 0} 亩</div>
                <div class="popup-row">上报人：${f.reportedBy || '-'}</div>
                <div class="popup-row">处理情况：${f.status || '-'}</div>
                <div class="popup-row">上报时间：${f.reportedAt || '-'}</div>
            </div>`);
            fireMarkers.push({ id: f.id, marker: m, data: f });
        });

        // 疫情点
        (this._pestPoints || []).forEach(p => {
            if (!p || !p.lat || !p.lng) return;
            const m = L.marker([p.lat, p.lng], { icon: pIcon }).addTo(pGroup).addTo(allGroup)
                .bindTooltip((p.name || p.id) + ' · ' + (p.diseaseType || ''));
            const imgUrl = p.imagePath ? ApiService.BASE_URL + p.imagePath : '';
            m.bindPopup(`<div class="popup-info" style="min-width:200px;">
                <div class="popup-title" style="color:#ff9800;">疫情 · ${p.id || ''}</div>
                ${imgUrl ? `<img src="${imgUrl}" style="width:100%;max-height:140px;object-fit:cover;border-radius:4px;margin:4px 0;"/>` : ''}
                <div class="popup-row">名称：${p.name || '-'}</div>
                <div class="popup-row">类型：${p.diseaseType || '-'}</div>
                <div class="popup-row">置信度：${p.confidence || 0}%</div>
                <div class="popup-row">受影响面积：${p.affectedAreaMu || 0} 亩</div>
                <div class="popup-row">处理情况：${p.status || '-'}</div>
                <div class="popup-row">上报时间：${p.reportedAt || '-'}</div>
            </div>`);
        });

        // 存储分类型引用（护林员/无人机由巡护模块独立管理）
        this._typedLayers[mapId + '_fires'] = fGroup;
        this._typedLayers[mapId + '_pests'] = pGroup;
        this._markerLayers[mapId] = allGroup;
        this._fireMarkers = fireMarkers;

        // 按类型分别添加到地图（图层管理面板可单独控制显隐）
        fGroup.addTo(map);
        pGroup.addTo(map);

        // 同步图层管理面板勾选状态（护林员/无人机由巡护模块独立响应）
        var checkboxes = document.querySelectorAll('#businessLayerGroup input[type="checkbox"][data-layer]');
        checkboxes.forEach(function(cb) {
            var k = cb.dataset.layer;
            var typeMap = { fires: fGroup, diseases: pGroup };
            if (typeMap[k] && !cb.checked) {
                map.removeLayer(typeMap[k]);
            }
        });
    },

    /** 添加/刷新火情点图层到指定地图（供灾害识别页调用） */
    addFireLayerToMap(map) {
        if (!map) return;
        this._addMarkersToMap(map);
    },

    /** 获取所有火情点数据 */
    getFirePoints() { return this._firePoints || {}; },

    /** 根据 id 获取火情点 marker */
    getFireMarker(id) {
        const fm = (this._fireMarkers || []).find(x => x.id === id);
        return fm ? fm.marker : null;
    },

    /** 添加单个新火情点（SSE 收到 fire_new 时调用） */
    addSingleFirePoint(fire) {
        if (!fire || !fire.lat || !fire.lng) return;
        if (!this._firePoints) this._firePoints = {};
        this._firePoints[fire.id] = fire;
        // 刷新所有地图上的标记
        const keys = Object.keys(MapFacade._instances);
        keys.forEach(id => {
            const map = MapFacade._instances[id];
            if (map) this._addMarkersToMap(map);
        });
        if (typeof DisasterPanel !== 'undefined' && DisasterPanel.refreshFireList) {
            DisasterPanel.refreshFireList();
        }
    },

    /** 添加到所有地图 */
    _addToAllMaps() {
        const self = this;
        function addToMaps() {
            // 获取 Leaflet 地图实例（MapFacade + DOM 回退）
            var maps = Object.values(MapFacade._instances);
            if (maps.length === 0) {
                document.querySelectorAll('.leaflet-container').forEach(function(el) {
                    if (el._leaflet_map) maps.push(el._leaflet_map);
                });
            }
            if (maps.length === 0) { setTimeout(addToMaps, 300); return; }
            maps.forEach(function(map) {
                // 林场边界（仅checkbox勾选时加载）
                var bndCb = document.querySelector('#businessLayerGroup input[data-layer=\"forestBoundary\"]');
                if (self._layers.boundary && !map.hasLayer(self._layers.boundary) && (!bndCb || bndCb.checked)) map.addLayer(self._layers.boundary);
                // DEM/NDVI 在 #rasterLayerGroup 中，默认不显示
                ['dem','ndvi','ndvi2022','fvc','fvc2022'].forEach(function(k) {
                    var dl = k==='ndvi2022'?'ndvi_2022':k==='ndvi'?'ndvi_2021':k==='fvc2022'?'fvc_2022':k==='fvc'?'fvc_2021':k;
                    var cb = document.querySelector('#rasterLayerGroup input[data-layer=\"'+dl+'\"]');
                    if (self._layers[k] && !map.hasLayer(self._layers[k]) && cb && cb.checked) {
                        map.addLayer(self._layers[k]);
                    }
                });
                if (self._layers.compartments && !map.hasLayer(self._layers.compartments)) {
                    var compCb = document.querySelector('#businessLayerGroup input[type=\"checkbox\"][data-layer=\"subCompartments\"]');
                    if (!compCb || compCb.checked) {
                        map.addLayer(self._layers.compartments);
                    }
                }
                self._addMarkersToMap(map);
            });
            console.log('[GeoLayers] 边界+标记已添加到 ' + maps.length + ' 个地图');
        }
        addToMaps();
    },

    async refreshMarkers() {
        await this._loadApiMarkers();
        const keys = Object.keys(MapFacade._instances);
        keys.forEach(id => {
            const map = MapFacade._instances[id];
            if (map) this._addMarkersToMap(map);
        });
    },

    // ===== NDVI / FVC 栅格 WMS 直接加载（无需代理，tile图片无跨域限制） =====
    _rasterLayer: null,
    _geoserverWms: '/geoserver/baiyunshan/wms',

    /**
     * NDVI / FVC 分级渲染 —— 直接加载预生成的 PNG 叠加到主地图
     * source → PNG 文件名映射（预生成在项目根目录）
     */
    addNdviClassified: function(source, thresholds) {
        this._loadStaticPng(source);
    },

    addFvcClassified: function(source, thresholds) {
        this._loadStaticPng(source);
    },

    /** 直接加载预生成 PNG：source → 文件名 → L.imageOverlay */
    _pngMap: {
        'NDVI2': 'ndvi_2021_classified.png',
        'NDVI_1': 'ndvi_2022_classified.png',
        'fvc_2': 'fvc_2021_classified.png',
        'fvc_1': 'fvc_2022_classified.png',
    },

    _loadStaticPng: function(source) {
        var png = this._pngMap[source];
        if (!png) { console.warn('[GeoLayers] 未知数据源: ' + source); return; }
        var wrapper = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
        // BaiyunshanMap 包装器 → 获取底层 Leaflet L.map
        var map = (wrapper && wrapper.getMap) ? wrapper.getMap() : wrapper;
        if (!map || typeof L === 'undefined') { console.warn('[GeoLayers] 地图不可用'); return; }
        this._removeRasterLayer();

        // WGS84 原始范围 → GCJ-02 对齐高德
        var bounds = [[28.4798, 119.8545], [28.5807, 119.9661]];
        if (typeof CoordTransform !== 'undefined') {
            var sw = CoordTransform.wgs84ToGcj02(119.8545, 28.4798);
            var ne = CoordTransform.wgs84ToGcj02(119.9661, 28.5807);
            if (sw && ne) bounds = [[sw[1], sw[0]], [ne[1], ne[0]]];
        }
        this._rasterLayer = L.imageOverlay(png, bounds, { opacity: 0.8 }).addTo(map);
    },

    /** 通用分级渲染（保留）：调用 5052 API → 叠加 PNG 到主地图 monSpatialMap */
    _showClassified: function(source, thresholds) {
        var map = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
        if (!map || typeof L === 'undefined') { console.warn('[GeoLayers] 地图不可用'); return; }
        this._removeRasterLayer();

        var self = this;
        var token = (typeof ApiService !== 'undefined') ? ApiService._getToken() : (localStorage.getItem('fps_token') || '');
        var label = (source && source.startsWith('fvc')) ? 'FVC' : 'NDVI';
        fetch('/api/spatial/ndvi/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                source: source,
                high_threshold: thresholds.high,
                medium_threshold: thresholds.mid,
                low_threshold: thresholds.low
            })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
            var data = result.data;
            if (!result.ok || data.error) { alert(label + ': ' + (data.error || '失败')); return; }

            var b = data.bounds;
            var bounds = [[b.south, b.west], [b.north, b.east]];
            if (typeof CoordTransform !== 'undefined') {
                var sw = CoordTransform.wgs84ToGcj02(b.west, b.south);
                var ne = CoordTransform.wgs84ToGcj02(b.east, b.north);
                if (sw && ne) bounds = [[sw[1], sw[0]], [ne[1], ne[0]]];
            }
            self._rasterLayer = L.imageOverlay('data:image/png;base64,' + data.image, bounds, { opacity: 0.8 }).addTo(map);
        })
        .catch(function(err) { alert('网络错误: ' + err.message); });
    },

    /** 加载NDVI WMS栅格到空间分析地图 */
    addNdviLayer(source) {
        const map = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
        if (!map || typeof L === 'undefined') { console.warn('[GeoLayers] 地图不可用'); return; }
        this._removeRasterLayer();
        const names = { 'NDVI': 'NDVI', 'NDVI2': 'NDVI-2', 'NDVI_1': 'NDVI-1' };
        const layerName = 'baiyunshan:' + (names[source] || source);
        console.log('[GeoLayers] 加载NDVI: ' + layerName);
        this._rasterLayer = L.tileLayer.wms(this._geoserverWms, {
            layers: layerName, format: 'image/png', transparent: true,
            version: '1.3.0', styles: '',
        }).addTo(map);
    },

    /** 加载FVC WMS栅格 */
    addFvcLayer(source) {
        const map = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
        if (!map || typeof L === 'undefined') { console.warn('[GeoLayers] 地图不可用'); return; }
        this._removeRasterLayer();
        // GeoServer 实际 coverage: fvc-1, fvc-2（注意有连字符）
        const names = { 'fvc_1': 'fvc-1', 'fvc_2': 'fvc-2' };
        const layerName = 'baiyunshan:' + (names[source] || source);
        console.log('[GeoLayers] 加载FVC: ' + layerName);
        this._rasterLayer = L.tileLayer.wms(this._geoserverWms, {
            layers: layerName, format: 'image/png', transparent: true,
            version: '1.3.0', styles: '',
        }).addTo(map);
    },

    _removeRasterLayer() {
        if (this._rasterLayer) {
            var map = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
            if (map && map.hasLayer(this._rasterLayer)) map.removeLayer(this._rasterLayer);
            this._rasterLayer = null;
            if (map) map.invalidateSize();
        }
        if (this._ndviCloseBtn) { this._ndviCloseBtn.remove(); this._ndviCloseBtn = null; }
    },

    /**
     * 直接加载 PNG 到高德底图 — 从 DOM 拿 Leaflet 原生实例，避免 BaiyunshanMap 包装器问题
     */
    showNdviOverlay: function(pngFile) {
        var wrapper = MapFacade.getMap('monSpatialMap') || MapFacade.getMap('dashMap') || MapFacade.getMap();
        var map = (wrapper && wrapper.getMap) ? wrapper.getMap() : wrapper;
        if (!map) { console.warn('[GeoLayers] 地图不可用'); return; }

        if (this._rasterLayer && map.hasLayer(this._rasterLayer)) {
            map.removeLayer(this._rasterLayer);
        }

        var bounds = [[28.4798, 119.8545], [28.5807, 119.9661]];
        if (typeof CoordTransform !== 'undefined') {
            var sw = CoordTransform.wgs84ToGcj02(119.8545, 28.4798);
            var ne = CoordTransform.wgs84ToGcj02(119.9661, 28.5807);
            if (sw && ne) bounds = [[sw[1], sw[0]], [ne[1], ne[0]]];
        }
        this._rasterLayer = L.imageOverlay(pngFile, bounds, { opacity: 0.8 }).addTo(map);
    },
};
