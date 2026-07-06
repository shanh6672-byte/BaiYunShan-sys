// ==================== Leaflet 地图引擎适配器 ====================
// 实现 map-facade.js 定义的引擎接口
// 依赖：Leaflet 全局对象 L（由 index.html CDN 加载）

const LeafletEngine = {
    name: 'leaflet',

    // 创建地图实例
    create(containerId, options) {
        const opts = options || {};
        const center = opts.center || [26.65, 106.73];
        const zoom = opts.zoom || 14;
        const map = L.map(containerId, {
            center: center,
            zoom: zoom,
            attributionControl: false,
            zoomControl: false
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);
        return map;
    },

    // 添加林场边界多边形
    addForestBoundary(instance, coords) {
        if (!coords) return;
        L.polygon(coords, {
            color: '#ff9800',
            weight: 2,
            opacity: 0.8,
            fillColor: '#ff9800',
            fillOpacity: 0.06,
            dashArray: '8,4'
        }).addTo(instance);
    },

    // 批量添加林班小班多边形
    addCompartments(instance, list, colors) {
        if (!list || !list.length) return;
        list.forEach((sc, i) => {
            L.polygon(sc.coords, {
                color: colors[i] || '#00bcd4',
                weight: 1.5,
                opacity: 0.6,
                fillColor: colors[i] || '#00bcd4',
                fillOpacity: 0.08
            }).addTo(instance).bindTooltip(sc.name);
        });
    },

    // 批量添加护林员标记点
    addRangerMarkers(instance, list) {
        if (!list || !list.length) return;
        const rIcon = L.divIcon({
            html: '<div style="width:12px;height:12px;background:#00e676;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,230,118,0.6);"></div>',
            className: '',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        list.forEach(r => {
            L.marker([r.lat, r.lng], { icon: rIcon }).addTo(instance)
                .bindTooltip(r.name)
                .bindPopup(
                    `<div class="popup-info"><div class="popup-title" style="color:#00e676;">护林员</div><div class="popup-row"><span class="popup-label">姓名</span><span class="popup-val">${r.name}</span></div><div class="popup-row"><span class="popup-label">工号</span><span class="popup-val">${r.id}</span></div><div class="popup-row"><span class="popup-label">负责区域</span><span class="popup-val">${r.area}</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">${r.status}</span></div><div class="popup-row"><span class="popup-label">行进速度</span><span class="popup-val">${r.speed}</span></div><div class="popup-row"><span class="popup-label">设备电量</span><span class="popup-val">${r.battery}</span></div><div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${r.lng.toFixed(6)}</span></div><div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${r.lat.toFixed(6)}</span></div></div>`
                );
        });
    },

    // 批量添加无人机标记点
    addDroneMarkers(instance, list) {
        if (!list || !list.length) return;
        const dIcon = L.divIcon({
            html: '<div style="width:14px;height:14px;background:#448aff;border:2px solid #fff;border-radius:3px;box-shadow:0 0 8px rgba(68,138,255,0.6);transform:rotate(45deg);"></div>',
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        list.forEach(d => {
            L.marker([d.lat, d.lng], { icon: dIcon }).addTo(instance)
                .bindTooltip(d.name)
                .bindPopup(
                    `<div class="popup-info"><div class="popup-title" style="color:#448aff;">无人机</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">${d.name}</span></div><div class="popup-row"><span class="popup-label">型号</span><span class="popup-val">${d.model}</span></div><div class="popup-row"><span class="popup-label">飞行高度</span><span class="popup-val">${d.alt}</span></div><div class="popup-row"><span class="popup-label">航向</span><span class="popup-val">${d.heading}</span></div><div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">${d.battery}</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">${d.status}</span></div><div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${d.lng.toFixed(6)}</span></div><div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${d.lat.toFixed(6)}</span></div></div>`
                );
        });
    },

    // 批量添加火情标记点
    addFireMarkers(instance, list) {
        if (!list || !list.length) return;
        const fIcon = L.divIcon({
            html: '<div style="width:18px;height:18px;background:radial-gradient(circle,#ff6e40,#ff3d3d);border-radius:50%;box-shadow:0 0 10px rgba(255,61,61,0.8);"></div>',
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
        list.forEach(f => {
            L.marker([f.lat, f.lng], { icon: fIcon }).addTo(instance)
                .bindTooltip('火情-' + f.level)
                .bindPopup(
                    `<div class="popup-info"><div class="popup-title" style="color:#ff3d3d;">火情点</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">${f.name}</span></div><div class="popup-row"><span class="popup-label">等级</span><span class="popup-val">${f.level}</span></div><div class="popup-row"><span class="popup-label">位置</span><span class="popup-val">${f.area}</span></div><div class="popup-row"><span class="popup-label">发现时间</span><span class="popup-val">${f.time}</span></div><div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">${f.status}</span></div><div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${f.lng.toFixed(6)}</span></div><div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${f.lat.toFixed(6)}</span></div></div>`
                );
            L.circle([f.lat, f.lng], {
                radius: 200,
                color: '#ff3d3d',
                weight: 1,
                fillOpacity: 0.1
            }).addTo(instance);
        });
    },

    // 批量添加虫害标记点
    addPestMarkers(instance, list) {
        if (!list || !list.length) return;
        const pIcon = L.divIcon({
            html: '<div style="width:14px;height:14px;background:radial-gradient(circle,#ffcc02,#ff9800);border-radius:50%;box-shadow:0 0 6px rgba(255,152,0,0.6);"></div>',
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        list.forEach((p, i) => {
            L.marker([p.lat, p.lng], { icon: pIcon }).addTo(instance)
                .bindTooltip('松材线虫病')
                .bindPopup(
                    `<div class="popup-info"><div class="popup-title" style="color:#ff9800;">松材线虫病</div><div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">P${String(i + 1).padStart(3, '0')}</span></div><div class="popup-row"><span class="popup-label">所在区域</span><span class="popup-val">${p.area}</span></div><div class="popup-row"><span class="popup-label">感染面积</span><span class="popup-val">${p.areaSize}</span></div><div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${p.lng.toFixed(6)}</span></div><div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${p.lat.toFixed(6)}</span></div></div>`
                );
        });
    },

    // 批量添加巡护轨迹
    addPatrolRoutes(instance, list) {
        if (!list || !list.length) return;
        list.forEach(route => {
            L.polyline(route.coords, {
                color: '#00e676',
                weight: 2,
                opacity: 0.7,
                dashArray: '6,4'
            }).addTo(instance).bindPopup(
                `<div class="popup-info"><div class="popup-title" style="color:#00e676;">巡护轨迹</div><div class="popup-row"><span class="popup-label">巡护人</span><span class="popup-val">${route.person}</span></div><div class="popup-row"><span class="popup-label">日期</span><span class="popup-val">${route.date}</span></div><div class="popup-row"><span class="popup-label">里程</span><span class="popup-val">${route.distance}</span></div></div>`
            );
        });
    },

    // 添加FVC植被退化区域标记点
    addFvcMarkers(instance, list) {
        if (!list || !list.length) return;
        const icon = L.divIcon({
            html: '<div style="width:16px;height:16px;background:radial-gradient(circle,#ff6e40,#d7191c);border-radius:50%;box-shadow:0 0 8px rgba(215,25,28,0.8);"></div>',
            className: '',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        list.forEach(da => {
            L.marker([da.lat, da.lng], { icon: icon }).addTo(instance)
                .bindTooltip(da.area + ' FVC=' + da.fvc.toFixed(2))
                .bindPopup(
                    '<div class="popup-info"><div class="popup-title" style="color:#d7191c;">植被退化区域</div><div class="popup-row"><span class="popup-label">位置</span><span class="popup-val">' + da.area + '</span></div><div class="popup-row"><span class="popup-label">FVC值</span><span class="popup-val">' + da.fvc.toFixed(2) + '</span></div><div class="popup-row"><span class="popup-label">退化等级</span><span class="popup-val">' + da.level + '</span></div></div>'
                );
        });
    },

    // 放大
    zoomIn(instance) {
        if (instance && instance.zoomIn) instance.zoomIn();
    },

    // 缩小
    zoomOut(instance) {
        if (instance && instance.zoomOut) instance.zoomOut();
    },

    // 刷新地图尺寸
    invalidateSize(instance) {
        if (instance && instance.invalidateSize) instance.invalidateSize();
    },

    // ==================== 底图切换 ====================

    /**
     * 统一底图切换（联动所有地图实例）
     * @param {string} type - 底图类型标识，如 'amap-vector' / 'tianditu-image' / 'carto-dark' / 'drone'
     * @returns {number} 成功切换的地图实例数量
     *
     * 支持的 type 值：
     *   osm              OpenStreetMap（默认）
     *   cartoLight       CartoDB 浅色
     *   cartoDark        CartoDB 暗色
     *   amap-vector      高德矢量
     *   amap-image       高德影像
     *   tianditu-vector  天地图矢量
     *   tianditu-image   天地图影像
     *   tianditu-terrain 天地图地形
     *   carto-positron   Carto Positron
     *   carto-dark       Carto Dark
     *   carto-voyager    Carto Voyager
     *   drone            无人机影像（预留）
     */
    setBaseMap: function (type) {
        if (!type) return 0;
        var instances = MapFacade._instances;
        var count = 0;
        Object.keys(instances).forEach(function (id) {
            var leafletMap = instances[id];
            var bym = leafletMap && leafletMap._baiyunshan;
            if (bym && typeof bym.switchTileLayer === 'function') {
                // switchTileLayer：移除旧底图 → 加载新底图 → 保留业务图层
                bym.switchTileLayer(type);
                count++;
            }
        });
        return count;
    }
};

MapFacade.use(LeafletEngine);
