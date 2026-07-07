// ==================== GeoServer 真实图层加载器 ====================
// 从 GeoServer WFS 加载数据，经 GCJ-02 坐标转换后与高德/天地图底图对齐

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

    /** 加载DEM数字高程模型WMS图层（色带渲染，不拦截鼠标事件） */
    _loadDem() {
        this._layers.dem = L.tileLayer.wms(this._geoserverWms, {
            layers: 'baiyunshan:dem',
            format: 'image/jpeg',
            transparent: false,
            version: '1.1.0',
            opacity: 0.5,
            interactive: false,
        });
        console.log('[GeoLayers] DEM图层已创建（色带渲染）');
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
        (function poll() {
            const keys = Object.keys(MapFacade._instances);
            if (keys.length === 0) { setTimeout(poll, 500); return; }
            keys.forEach(id => {
                const map = MapFacade._instances[id];
                if (!map) return;
                if (self._layers.boundary && !map.hasLayer(self._layers.boundary)) map.addLayer(self._layers.boundary);
                // DEM图层（默认不显示，仅checkbox勾选时加载）
                var demCb = document.querySelector('#businessLayerGroup input[type=\"checkbox\"][data-layer=\"dem\"]');
                if (self._layers.dem && !map.hasLayer(self._layers.dem) && demCb && demCb.checked) {
                    map.addLayer(self._layers.dem);
                }
                if (self._layers.compartments && !map.hasLayer(self._layers.compartments)) {
                    // 检查图层管理面板中林班小班是否勾选
                    var compCb = document.querySelector('#businessLayerGroup input[type=\"checkbox\"][data-layer=\"subCompartments\"]');
                    if (!compCb || compCb.checked) {
                        map.addLayer(self._layers.compartments);
                    }
                }
                self._addMarkersToMap(map);
            });
            console.log('[GeoLayers] 边界+标记已添加到 ' + keys.length + ' 个地图');
        })();
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

    /** 加载NDVI WMS栅格到空间分析地图 */
    addNdviLayer(source) {
        const map = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
        if (!map || typeof L === 'undefined') { console.warn('[GeoLayers] 地图不可用'); return; }
        this._removeRasterLayer();
        // 图层名映射 → GeoServer 实际 coverage: NDVI, NDVI-1, NDVI-2
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
            const map = MapFacade.getMap('monSpatialMap') || MapFacade.getMap();
            if (map) map.removeLayer(this._rasterLayer);
            this._rasterLayer = null;
        }
    },
};
