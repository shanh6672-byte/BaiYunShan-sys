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
        L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
            maxZoom: 18,
            subdomains: '1234',
            attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>'
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

    // 护林员图标（使用与 ExperimentalLayerManager 相同的 PNG）
    _getRangerIcon() {
        if (!this._rangerIcon) {
            this._rangerIcon = L.icon({
                iconUrl: './forest-ranger.png',
                iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
            });
        }
        return this._rangerIcon;
    },

    // 无人机图标
    _getDroneIcon() {
        if (!this._droneIcon) {
            this._droneIcon = L.icon({
                iconUrl: './drone.png',
                iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
            });
        }
        return this._droneIcon;
    },

    // 批量添加护林员标记点（使用PNG图标，与 ExperimentalLayerManager 统一）
    addRangerMarkers(instance, list) {
        if (!list || !list.length) return;
        const icon = this._getRangerIcon();
        list.forEach(r => {
            const speedVal = (r.speedKmh != null) ? r.speedKmh.toFixed(1) + ' km/h'
                : (r.speed != null) ? r.speed : '-';
            const battVal = (r.batteryPercent != null) ? r.batteryPercent.toFixed(0) + '%'
                : (r.battery != null) ? r.battery : '-';
            L.marker([r.lat, r.lng], { icon: icon }).addTo(instance)
                .bindTooltip(r.name || '护林员')
                .bindPopup(
                    `<div class="popup-info"><div class="popup-title" style="color:#00e676;">护林员</div>` +
                    `<div class="popup-row"><span class="popup-label">姓名</span><span class="popup-val">${r.name || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">工号</span><span class="popup-val">${r.id || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">负责区域</span><span class="popup-val">${r.area || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">${r.status || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">速度</span><span class="popup-val">${speedVal}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">${battVal}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${(r.lng||0).toFixed(6)}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${(r.lat||0).toFixed(6)}</span></div></div>`
                );
        });
    },

    // 批量添加无人机标记点（使用PNG图标）
    addDroneMarkers(instance, list) {
        if (!list || !list.length) return;
        const icon = this._getDroneIcon();
        list.forEach(d => {
            const altVal = (d.altitudeM != null) ? d.altitudeM.toFixed(0) + 'm'
                : (d.alt != null) ? d.alt : '-';
            const headingVal = (d.headingDeg != null) ? d.headingDeg.toFixed(0) + '°'
                : (d.heading != null) ? d.heading : '-';
            const battVal = (d.batteryPercent != null) ? d.batteryPercent.toFixed(0) + '%'
                : (d.battery != null) ? d.battery : '-';
            L.marker([d.lat, d.lng], { icon: icon }).addTo(instance)
                .bindTooltip(d.code || d.name || '无人机')
                .bindPopup(
                    `<div class="popup-info"><div class="popup-title" style="color:#448aff;">无人机</div>` +
                    `<div class="popup-row"><span class="popup-label">编号</span><span class="popup-val">${d.code || d.name || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">型号</span><span class="popup-val">${d.model || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">飞行高度</span><span class="popup-val">${altVal}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">航向</span><span class="popup-val">${headingVal}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">电量</span><span class="popup-val">${battVal}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">状态</span><span class="popup-val">${d.status || '-'}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">经度</span><span class="popup-val">${(d.lng||0).toFixed(6)}</span></div>` +
                    `<div class="popup-row"><span class="popup-label">纬度</span><span class="popup-val">${(d.lat||0).toFixed(6)}</span></div></div>`
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

    // 绘制折线（轨迹回放用）
    addPolyline(instance, coords, options) {
        if (!coords || coords.length < 2) return null;
        const opts = options || {};
        return L.polyline(coords, {
            color: opts.color || '#00e676',
            weight: opts.weight || 3,
            opacity: opts.opacity || 0.8,
        }).addTo(instance);
    },

    // 移除图层
    removeLayer(instance, layer) {
        if (instance && layer) {
            instance.removeLayer(layer);
        }
    },

    // 缩放到坐标范围
    fitBounds(instance, coords) {
        if (instance && coords && coords.length) {
            const bounds = L.latLngBounds(coords);
            instance.fitBounds(bounds, { padding: [50, 50] });
        }
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
