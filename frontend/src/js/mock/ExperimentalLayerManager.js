// ==================== 实验数据图层管理器 v7 (调试版) ====================

(function () {
    if (typeof BAIYUNSHAN_BOUNDARY_READY === 'undefined' || typeof turf === 'undefined') {
        console.error('[ExpLayer] 依赖缺失: BAIYUNSHAN_BOUNDARY_READY=' + (typeof BAIYUNSHAN_BOUNDARY_READY) + ' turf=' + (typeof turf));
        return;
    }

    BAIYUNSHAN_BOUNDARY_READY.then(function (geoJSON) {
        console.log('[ExpLayer] SHP边界Promise已resolve, geoJSON.features:', (geoJSON&&geoJSON.features?geoJSON.features.length:0));
        init(geoJSON);
    }).catch(function (err) {
        console.error('[ExpLayer] SHP加载失败:', err);
    });

    // ==================== GCJ-02 坐标转换辅助 ====================
    function convertCoord(lng, lat) {
        if (typeof CoordTransform === 'undefined') return [lng, lat];
        var result = CoordTransform.wgs84ToGcj02(lng, lat);
        return result || [lng, lat];
    }

    // 转换 GeoJSON FeatureCollection 中所有坐标（支持 Point / Polygon / MultiPolygon）
    function convertGeoJSON(fc) {
        if (typeof CoordTransform === 'undefined') return fc;
        if (!fc || !fc.features) return fc;
        fc.features.forEach(function (f) {
            if (!f.geometry) return;
            if (f.geometry.type === 'Point') {
                var gcj = CoordTransform.wgs84ToGcj02(f.geometry.coordinates[0], f.geometry.coordinates[1]);
                if (gcj) f.geometry.coordinates = gcj;
            } else if (f.geometry.type === 'Polygon') {
                f.geometry.coordinates = f.geometry.coordinates.map(function (ring) {
                    return ring.map(function (c) {
                        var gcj = CoordTransform.wgs84ToGcj02(c[0], c[1]);
                        return gcj || c;
                    });
                });
            } else if (f.geometry.type === 'MultiPolygon') {
                f.geometry.coordinates = f.geometry.coordinates.map(function (poly) {
                    return poly.map(function (ring) {
                        return ring.map(function (c) {
                            var gcj = CoordTransform.wgs84ToGcj02(c[0], c[1]);
                            return gcj || c;
                        });
                    });
                });
            }
        });
        return fc;
    }

    // ==================== 图标（使用项目根目录图片） ====================
    var RANGER_ICON = L.icon({
        iconUrl: './forest-ranger.png',
        iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
    });
    var DRONE_ICON = L.icon({
        iconUrl: './drone.png',
        iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
    });
    var FIRE_ICON = L.icon({
        iconUrl: './fire.png',
        iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
    });
    var DISEASE_ICON = L.icon({
        iconUrl: './disease.png',
        iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28]
    });

    // 图标加载检查
    (function checkIcons() {
        var icons = [
            { name: 'forest-ranger.png', label: '护林员' },
            { name: 'drone.png', label: '无人机' },
            { name: 'fire.png', label: '火点' },
            { name: 'disease.png', label: '疫情' }
        ];
        icons.forEach(function (ic) {
            var img = new Image();
            img.onload = function () { console.log('[ExpLayer] ' + ic.label + '图标已应用：' + ic.name); };
            img.onerror = function () { console.warn('[ExpLayer] ⚠ 图标文件可能未找到：' + ic.name); };
            img.src = ic.name;
        });
    })();

    function rangerPopup(p){return'<div class="popup-info"><div class="popup-title" style="color:#00e676;">护林员</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">'+p.id+'</span></div><div class="popup-row"><span class="popup-label">姓名</span><span class="popup-val">'+p.name+'</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">'+p.status+'</span></div><div class="popup-row"><span class="popup-label">电话</span><span class="popup-val">'+p.phone+'</span></div><div class="popup-row"><span class="popup-label">区域</span><span class="popup-val">'+p.patrolArea+'</span></div></div>';}
    function dronePopup(p){return'<div class="popup-info"><div class="popup-title" style="color:#448aff;">无人机</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">'+p.id+'</span></div><div class="popup-row"><span class="popup-label">型号</span><span class="popup-val">'+p.model+'</span></div><div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">'+p.battery+'</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">'+p.status+'</span></div><div class="popup-row"><span class="popup-label">高度</span><span class="popup-val">'+p.altitude+'</span></div></div>';}
    function firePopup(p){return'<div class="popup-info"><div class="popup-title" style="color:#ff3d3d;">火情事件</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">'+p.id+'</span></div><div class="popup-row"><span class="popup-label">等级</span><span class="popup-val">'+p.level+'</span></div><div class="popup-row"><span class="popup-label">温度</span><span class="popup-val">'+p.temperature+'</span></div><div class="popup-row"><span class="popup-label">上报</span><span class="popup-val">'+p.reportTime+'</span></div></div>';}
    function diseasePopup(p){var c=p.severity==='重度'?'#ff3d3d':p.severity==='中度'?'#ff9800':'#ffc107';return'<div class="popup-info"><div class="popup-title" style="color:#ff9800;">松材线虫病</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">'+p.id+'</span></div><div class="popup-row"><span class="popup-label">感染株数</span><span class="popup-val">'+p.infectedTrees+' 棵</span></div><div class="popup-row"><span class="popup-label">程度</span><span class="popup-val" style="color:'+c+';">'+p.severity+'</span></div><div class="popup-row"><span class="popup-label">上报</span><span class="popup-val">'+p.reportTime+'</span></div></div>';}
    function subcompartmentPopup(p){
        var fc = p.forestType==='针叶林'?'#4caf50':p.forestType==='阔叶林'?'#8bc34a':p.forestType==='混交林'?'#009688':p.forestType==='竹林'?'#cddc39':'#ff9800';
        return'<div class="popup-info"><div class="popup-title" style="color:'+fc+';">林业小班</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">'+p.subId+'</span></div><div class="popup-row"><span class="popup-label">林分类型</span><span class="popup-val">'+p.forestType+'</span></div><div class="popup-row"><span class="popup-label">面积</span><span class="popup-val">'+p.area+'</span></div><div class="popup-row"><span class="popup-label">优势树种</span><span class="popup-val">'+p.dominantSpecies+'</span></div><div class="popup-row"><span class="popup-label">龄组</span><span class="popup-val">'+p.ageGroup+'</span></div><div class="popup-row"><span class="popup-label">郁闭度</span><span class="popup-val">'+p.canopyDensity+'</span></div><div class="popup-row"><span class="popup-label">管护区</span><span class="popup-val">'+p.managementUnit+'</span></div></div>';
    }
    function patrolRoutePopup(p){
        var sc=p.status==='已完成'?'#4caf50':'#ff9800';
        return'<div class="popup-info"><div class="popup-title" style="color:#2196f3;">巡护轨迹</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">'+p.routeId+'</span></div><div class="popup-row"><span class="popup-label">巡护员</span><span class="popup-val">'+p.rangerName+'</span></div><div class="popup-row"><span class="popup-label">巡护日期</span><span class="popup-val">'+p.patrolDate+'</span></div><div class="popup-row"><span class="popup-label">巡护里程</span><span class="popup-val">'+p.distance+'</span></div><div class="popup-row"><span class="popup-label">巡护时长</span><span class="popup-val">'+p.duration+'</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val" style="color:'+sc+';">'+p.status+'</span></div></div>';
    }

    function init(geoJSON) {
        var rings = window.BAIYUNSHAN_BOUNDARY_RINGS;
        if (!rings || !rings.length) { console.error('[ExpLayer] rings 为空!'); return; }

        console.log('[ExpLayer] rings数量:', rings.length, '| rings[0]顶点数:', rings[0].length);
        console.log('[ExpLayer] rings[0] 前3点 (lat,lng):', JSON.stringify(rings[0].slice(0,3)));

        // 构建 Turf Polygon（WGS84）
        var mainRing = rings[0].map(function(p){return[p[1],p[0]];});  // [lat,lng]→[lng,lat]
        if (mainRing[0][0]!==mainRing[mainRing.length-1][0]||mainRing[0][1]!==mainRing[mainRing.length-1][1]) {
            mainRing.push([mainRing[0][0],mainRing[0][1]]);
        }
        var turfPolygon = turf.polygon([mainRing]);
        var bbox = turf.bbox(turfPolygon);
        console.log('[ExpLayer] turf.bbox (WGS84):', JSON.stringify(bbox));
        console.log('[ExpLayer]   lng范围:', bbox[0].toFixed(6), '~', bbox[2].toFixed(6));
        console.log('[ExpLayer]   lat范围:', bbox[1].toFixed(6), '~', bbox[3].toFixed(6));

        // 生成数据（WGS84坐标）
        console.log('[ExpLayer] 开始生成点位...');
        var rangerFC  = ForestRangerGenerator.generate(turfPolygon, rings);
        var droneFC   = DroneGenerator.generate(turfPolygon, rings);
        var fireFC    = FireEventGenerator.generate(turfPolygon, rings);
        var diseaseFC = DiseaseEventGenerator.generate(turfPolygon, rings);
        console.log('[ExpLayer] 生成完成 — 护林员:'+rangerFC.features.length+' 无人机:'+droneFC.features.length+' 火情:'+fireFC.features.length+' 疫情:'+diseaseFC.features.length);

        // 小班面 & 巡护轨迹（基于 SHP 边界动态生成）
        var subcompartmentFC = generateSubcompartments(turfPolygon);
        var patrolRouteFC    = generatePatrolRoutes(turfPolygon);

        // ==================== SHP边界校验（WGS84） ====================
        function validateAndLog(fc, label, poly) {
            var before = fc.features.length;
            fc.features = fc.features.filter(function (f) {
                var c = f.geometry.coordinates;
                return turf.booleanPointInPolygon(turf.point(c), poly);
            });
            var after = fc.features.length;
            console.log('[ExpLayer] ' + label + '：' + after + '个，越界：' + (before - after));
            if (after > 0) {
                var preview = fc.features.slice(0, 3).map(function (f) {
                    var c = f.geometry.coordinates;
                    return '[' + c[0].toFixed(6) + ', ' + c[1].toFixed(6) + ']';
                }).join('  ');
                console.log('[ExpLayer]   ' + label + ' 前3点 (WGS84): ' + preview);
            }
            return after;
        }
        validateAndLog(rangerFC,  '护林员', turfPolygon);
        validateAndLog(droneFC,   '无人机', turfPolygon);
        validateAndLog(fireFC,    '火情',   turfPolygon);
        validateAndLog(diseaseFC, '疫情',   turfPolygon);
        console.log('[ExpLayer] 林业小班加载数量:', subcompartmentFC ? subcompartmentFC.features.length : 0);
        console.log('[ExpLayer] 巡护轨迹加载数量:', patrolRouteFC ? patrolRouteFC.features.length : 0);

        // ==================== 收集 WGS84 坐标用于 fitBounds ====================
        var wgs84Coords = [];
        [rangerFC, droneFC, fireFC, diseaseFC].forEach(function(fc){
            if(!fc)return; fc.features.forEach(function(f){ wgs84Coords.push(f.geometry.coordinates.slice()); });
        });
        console.log('[ExpLayer] WGS84坐标收集:', wgs84Coords.length, '个');

        // ==================== GCJ-02 转换 ====================
        console.log('[ExpLayer] 开始 GCJ-02 转换...');
        rangerFC        = convertGeoJSON(rangerFC);
        droneFC         = convertGeoJSON(droneFC);
        fireFC          = convertGeoJSON(fireFC);
        diseaseFC       = convertGeoJSON(diseaseFC);
        subcompartmentFC = subcompartmentFC ? convertGeoJSON(subcompartmentFC) : null;
        patrolRouteFC   = patrolRouteFC    ? convertGeoJSON(patrolRouteFC)    : null;
        var boundaryGCJ = convertGeoJSON(JSON.parse(JSON.stringify(geoJSON))); // SHP边界也转GCJ-02
        console.log('[ExpLayer] GCJ-02 转换完成');

        // 打印转换后前3点
        if (rangerFC.features.length > 0) {
            var preview2 = rangerFC.features.slice(0,3).map(function(f){
                var c=f.geometry.coordinates; return '['+c[0].toFixed(6)+', '+c[1].toFixed(6)+']';
            }).join('  ');
            console.log('[ExpLayer] 护林员 GCJ-02 前3点: ' + preview2);
        }

        // 收集 GCJ-02 坐标
        var gcj02Coords = [];
        [rangerFC, droneFC, fireFC, diseaseFC].forEach(function(fc){
            if(!fc)return; fc.features.forEach(function(f){ gcj02Coords.push(f.geometry.coordinates); });
        });
        // 合并 WGS84 + GCJ-02 坐标用于 fitBounds（确保两个坐标系下的数据都在视野内）
        var allCoords = wgs84Coords.concat(gcj02Coords);
        console.log('[ExpLayer] allCoords 总数:', allCoords.length);

        // 加入小班中心和轨迹坐标
        if (subcompartmentFC) {
            subcompartmentFC.features.forEach(function(f) {
                if (f.geometry && f.geometry.coordinates) {
                    var ring = f.geometry.coordinates[0];
                    var sl=0, st=0; ring.forEach(function(c){sl+=c[0];st+=c[1];});
                    allCoords.push([sl/ring.length, st/ring.length]);
                }
            });
        }
        if (patrolRouteFC) {
            patrolRouteFC.features.forEach(function(f) {
                if (f.geometry && f.geometry.coordinates) {
                    f.geometry.coordinates.forEach(function(c){ allCoords.push(c); });
                }
            });
        }

        // ==================== 创建图层（独立引用，支持单独显示/隐藏） ====================
        var businessLayers = {};

        // 边界使用 GeoServer WFS 真实数据（_loadBoundaryAligned 已加载到 GeoServerLayers._layers.boundary）
        var boundaryLayer = null;
        if (typeof GeoServerLayers !== 'undefined' && GeoServerLayers._layers && GeoServerLayers._layers.boundary) {
            boundaryLayer = GeoServerLayers._layers.boundary;
            businessLayers.forestBoundary = boundaryLayer;
            console.log('[ExpLayer] 使用 GeoServer 真实边界');
        } else if (boundaryGCJ && boundaryGCJ.features) {
            // 回退：GeoServer 边界未就绪时使用 SHP 边界
            boundaryLayer = L.geoJSON(boundaryGCJ, {
                style: { color: '#00ff88', weight: 3, opacity: 0.9, fillColor: '#00ff88', fillOpacity: 0.06, dashArray: '6,4' }
            }).bindTooltip('白云山林场边界(SHP回退)');
            businessLayers.forestBoundary = boundaryLayer;
            console.log('[ExpLayer] GeoServer边界未就绪，回退到SHP边界');
        }

        // 点位图层
        function makePointLayer(fc, iconObj, popupFn, label) {
            if (!fc || fc.features.length === 0) {
                console.warn('[ExpLayer] ' + label + ' FC为空，跳过图层');
                return null;
            }
            var layer = L.geoJSON(fc, {
                pointToLayer: function (feat, latlng) { return L.marker(latlng, { icon: iconObj }); },
                onEachFeature: function (feat, l) { l.bindPopup(popupFn(feat.properties)); }
            });
            console.log('[ExpLayer] ' + label + ' 图层已创建, markers:', layer.getLayers().length);
            return layer;
        }

        var rLyr = makePointLayer(rangerFC, RANGER_ICON, rangerPopup, '护林员');
        var dLyr = makePointLayer(droneFC,  DRONE_ICON,  dronePopup,  '无人机');
        var fLyr = makePointLayer(fireFC,   FIRE_ICON,   firePopup,   '火情');
        var pLyr = makePointLayer(diseaseFC, DISEASE_ICON, diseasePopup, '疫情');
        // rangers/drones 由巡护模块(patrol-module.js)实时管理，此处不注册
        if (fLyr) businessLayers.fires = fLyr;
        if (pLyr) businessLayers.diseases = pLyr;

        // 林业小班面
        var scLyr = null;
        if (subcompartmentFC && subcompartmentFC.features.length > 0) {
            scLyr = L.geoJSON(subcompartmentFC, {
                style: { color: '#4caf50', weight: 2, opacity: 0.9, fillColor: '#4caf50', fillOpacity: 0.15 },
                onEachFeature: function (feat, l) { l.bindPopup(subcompartmentPopup(feat.properties)); }
            });
            businessLayers.subCompartments = scLyr;
            console.log('[ExpLayer] 林业小班图层已创建, polygons:', scLyr.getLayers().length);
        }

        // 巡护轨迹（线路 + 起终点标记 封装为一个 layerGroup）
        var patrolGroup = null;
        if (patrolRouteFC && patrolRouteFC.features.length > 0) {
            patrolGroup = L.layerGroup();
            var prLyr = L.geoJSON(patrolRouteFC, {
                style: { color: '#2196f3', weight: 3, opacity: 0.85 },
                onEachFeature: function (feat, l) { l.bindPopup(patrolRoutePopup(feat.properties)); }
            });
            patrolGroup.addLayer(prLyr);
            patrolRouteFC.features.forEach(function (f) {
                var coords = f.geometry.coordinates;
                if (coords.length >= 2) {
                    var start = coords[0], end = coords[coords.length - 1];
                    L.circleMarker([start[1], start[0]], { radius: 6, color: '#4caf50', fillColor: '#4caf50', fillOpacity: 1, weight: 2 })
                        .bindTooltip('起点: ' + f.properties.rangerName).addTo(patrolGroup);
                    L.circleMarker([end[1], end[0]], { radius: 6, color: '#f44336', fillColor: '#f44336', fillOpacity: 1, weight: 2 })
                        .bindTooltip('终点: ' + f.properties.rangerName).addTo(patrolGroup);
                }
            });
            businessLayers.patrolRoutes = patrolGroup;
            console.log('[ExpLayer] 巡护轨迹图层已创建, lines:', prLyr.getLayers().length);
        }

        var totalLayers = Object.keys(businessLayers).length;
        console.log('[ExpLayer] 业务图层注册完成，共 ' + totalLayers + ' 个');

        // ==================== 图层控制（checkbox + slider） ====================
        var NAME_MAP = {
            forestBoundary: '林场边界', subCompartments: '林区界限', patrolRoutes: '巡护轨迹', fires: '火情点', diseases: '虫害点'
        };

        function getMapInstances() {
            var maps = [];
            Object.keys(MapFacade._instances).forEach(function (id) {
                var m = MapFacade._instances[id];
                if (m && typeof m.addLayer === 'function') maps.push(m);
            });
            return maps;
        }

        // 图层显隐：优先操作 GeoServer 真实图层，回退到 SHP 模拟图层
        function _getLayer(k) {
            // 优先从 GeoServerLayers 获取
            if (typeof GeoServerLayers !== 'undefined') {
                if (k === 'forestBoundary' && GeoServerLayers._layers && GeoServerLayers._layers.boundary) {
                    return GeoServerLayers._layers.boundary;
                }
                if (k === 'dem' && GeoServerLayers._layers && GeoServerLayers._layers.dem) {
                    return GeoServerLayers._layers.dem;
                }
                if (k === 'subCompartments' && GeoServerLayers._layers && GeoServerLayers._layers.compartments) {
                    return GeoServerLayers._layers.compartments;
                }
                // 分类型标记图层：查找第一个地图实例的类型图层
                var mapKeys = Object.keys(MapFacade._instances);
                if (mapKeys.length && GeoServerLayers._typedLayers) {
                    var mapId = MapFacade._instances[mapKeys[0]]._leaflet_id;
                    var typeMap = { fires: 'fires', diseases: 'pests' };
                    var tKey = mapId + '_' + (typeMap[k] || k);
                    if (GeoServerLayers._typedLayers[tKey]) return GeoServerLayers._typedLayers[tKey];
                }
            }
            // 回退到 SHP 模拟图层
            return businessLayers[k] || null;
        }
        function _showLayer(k, maps) {
            var layer = _getLayer(k);
            if (!layer) return;
            maps.forEach(function (m) { if (!m.hasLayer(layer)) m.addLayer(layer); });
            console.log('[LayerControl] ' + NAME_MAP[k] + ' 显示');
        }
        function _hideLayer(k, maps) {
            var layer = _getLayer(k);
            if (!layer) return;
            maps.forEach(function (m) { if (m.hasLayer(layer)) m.removeLayer(layer); });
            console.log('[LayerControl] ' + NAME_MAP[k] + ' 隐藏');
        }

        // 初始状态：按 checkbox 默认值
        var initialState = {};
        document.querySelectorAll('#businessLayerGroup [data-layer]').forEach(function (el) {
            if (el.type === 'checkbox') {
                var key = el.dataset.layer;
                initialState[key] = el.checked;
                if (el.checked && businessLayers[key]) {
                    // 稍后在地图就绪时添加
                }
                // checkbox 事件 — 优先操作 GeoServer 真实图层
                el.addEventListener('change', function () {
                    var k = this.dataset.layer;
                    var maps = getMapInstances();
                    if (this.checked) {
                        _showLayer(k, maps);
                    } else {
                        _hideLayer(k, maps);
                    }
                });
            }
        });

        // slider 事件 — 优先操作 GeoServer 真实图层
        document.querySelectorAll('#businessLayerGroup .layer-opacity[data-layer]').forEach(function (slider) {
            slider.addEventListener('input', function () {
                var key = this.dataset.layer;
                var layer = _getLayer(key);
                if (!layer) return;
                var val = parseInt(this.value) / 100;
                if (layer.eachLayer) {
                    layer.eachLayer(function (sub) {
                        if (sub.setStyle) {
                            var s = sub.options;
                            if (s.fillColor !== undefined) {
                                sub.setStyle({ fillOpacity: val * (s._origFillOpacity || 0.15), opacity: val * 0.9 });
                            } else if (s.color && s.weight) {
                                sub.setStyle({ opacity: val * 0.9 });
                            }
                        }
                        if (sub.setOpacity && sub instanceof L.CircleMarker) {
                            sub.setOpacity(val);
                        }
                    });
                }
                if (layer.setOpacity) layer.setOpacity(val);
            });
        });

        // ==================== 轮询等待地图 ====================
        // API模式下跳过：真实图层由 GeoServerLayers 从 GeoServer WFS 加载
        if (typeof ApiService !== 'undefined' && !ApiService.USE_MOCK) {
            console.log('[ExpLayer] API模式：跳过SHP随机数据，由GeoServer真实图层替代');
            return;
        }
        (function addToMapsWhenReady() {
            var retries = 0, MAX = 30;
            function tryAdd() {
                retries++;
                var keys = Object.keys(MapFacade._instances);
                console.log('[ExpLayer] 轮询#' + retries + ' MapFacade._instances:', keys.length + '个');

                if (keys.length > 0) {
                    keys.forEach(function (id) {
                        var map = MapFacade._instances[id];
                        if (map && typeof map.addLayer === 'function') {
                            // 按 checkbox 初始状态添加各图层
                            Object.keys(businessLayers).forEach(function (key) {
                                if (initialState[key]) {
                                    map.addLayer(businessLayers[key]);
                                }
                            });
                            console.log('[ExpLayer]   [' + id + '] 业务图层已按初始状态添加');
                        }
                    });

                    console.log('[ExpLayer] 实验图层已成功加入 ' + keys.length + ' 个地图实例');
                    console.log('[ExpLayer] 当前地图实例数量:', keys.length);

                    // fitBounds
                    if (allCoords.length > 0) {
                        var bounds = L.latLngBounds(allCoords.map(function (c) { return [c[1], c[0]]; }));
                        keys.forEach(function (id) {
                            var m = MapFacade._instances[id];
                            if (m && typeof m.fitBounds === 'function') {
                                m.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                            }
                        });
                    }
                    return;
                }
                if (retries >= MAX) {
                    console.error('[ExpLayer] 超时：' + (MAX * 300 / 1000) + 's后地图仍未就绪！');
                    return;
                }
                setTimeout(tryAdd, 300);
            }
            tryAdd();
        })();

        window.__experimentalBusinessLayers__ = businessLayers;
    }
})();
