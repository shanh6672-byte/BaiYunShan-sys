// ==================== 白云山地图模块 ====================

/**
 * 白云山林场地图
 *
 * @example
 *   const map = new BaiyunshanMap('mapContainer');
 *   // 或自定义配置
 *   const map = new BaiyunshanMap('mapContainer', { zoom: 15, scaleControl: false });
 */
class BaiyunshanMap {

    // ==================== 静态默认配置 ====================

    static DEFAULTS = {
        // 白云山林场中心坐标（浙江省丽水市）
        center: [28.467, 119.922],

        // 默认缩放级别
        zoom: 13,

        // 最小/最大缩放限制
        minZoom: 3,
        maxZoom: 19,

        // 交互开关
        scrollWheelZoom: true,   // 滚轮缩放
        doubleClickZoom: true,   // 双击缩放
        dragging: true,          // 拖拽平移
        touchZoom: true,         // 触摸缩放（移动端）

        // 控件开关
        zoomControl: true,       // 缩放控件（左上角 +/- 按钮）
        scaleControl: true,      // 比例尺控件（左下角）
        attributionControl: true // 版权信息

        // 注：如需关闭某控件，传入 { scaleControl: false } 即可
    };

    // ==================== 底图配置 ====================

    static TILE_LAYERS = {
        // 标准 OpenStreetMap 底图（默认）
        osm: {
            name: 'OpenStreetMap',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },

        // CartoDB 浅色
        cartoLight: {
            name: 'CartoDB浅色',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            options: {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            }
        },

        // CartoDB 暗色（原项目风格）
        cartoDark: {
            name: 'CartoDB暗色',
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            options: {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            }
        },

        // 高德地图（矢量）
        amap: {
            name: '高德地图',
            url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
            options: {
                subdomains: ['1', '2', '3', '4'],
                maxZoom: 18,
                attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>'
            }
        },

        // 高德卫星图
        amapSat: {
            name: '高德卫星',
            url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
            options: {
                subdomains: ['1', '2', '3', '4'],
                maxZoom: 18,
                attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>'
            }
        },

        // 天地图影像（需 tk 参数，使用公共测试 token）
        tianditu: {
            name: '天地图影像',
            url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=3d1b22a5e3d74a5fb3d3c1f8e0c1e0f1',
            options: {
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                maxZoom: 18,
                attribution: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>'
            }
        },

        // 天地图标注（叠加层）
        tiandituLabel: {
            name: '天地图标注',
            url: 'https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=3d1b22a5e3d74a5fb3d3c1f8e0c1e0f1',
            options: {
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                maxZoom: 18,
                attribution: ''
            }
        }
    };

    // ==================== 构造函数 ====================

    /**
     * @param {string}  containerId - DOM 容器 ID（如 'map'）
     * @param {object}  [options]   - 覆盖默认配置的选项
     * @param {string}  [tileKey]   - 底图标识：'osm'(默认) | 'cartoLight'
     */
    constructor(containerId, options = {}, tileKey = 'osm') {
        // -- 合并配置 --
        const config = { ...BaiyunshanMap.DEFAULTS, ...options };

        // -- 校验容器 --
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`BaiyunshanMap: 未找到容器 #${containerId}`);
        }

        // -- 创建 Leaflet 地图实例 --
        this._map = L.map(containerId, {
            center:           config.center,
            zoom:             config.zoom,
            minZoom:          config.minZoom,
            maxZoom:          config.maxZoom,
            scrollWheelZoom:  config.scrollWheelZoom,
            doubleClickZoom:  config.doubleClickZoom,
            dragging:         config.dragging,
            touchZoom:        config.touchZoom,
            zoomControl:      config.zoomControl,
            attributionControl: config.attributionControl
        });

        // -- 加载底图 --
        this._tileLayer = this._addTileLayer(tileKey);

        // -- 比例尺控件 --
        if (config.scaleControl) {
            this._scaleControl = L.control.scale({
                metric:   true,   // 公制（米/公里）
                imperial: false,  // 不显示英制
                position: 'bottomleft',
                maxWidth: 200
            }).addTo(this._map);
        }

        // -- 记录配置 --
        this._config = config;
        this._containerId = containerId;
        this._tileKey = tileKey;
    }

    // ==================== 私有方法 ====================

    /** 加载瓦片底图 */
    _addTileLayer(key) {
        const def = BaiyunshanMap.TILE_LAYERS[key] || BaiyunshanMap.TILE_LAYERS.osm;
        const layer = L.tileLayer(def.url, def.options);
        layer.addTo(this._map);
        return layer;
    }

    // ==================== 公开方法 ====================

    /** 获取底层 Leaflet 地图实例 */
    getMap() {
        return this._map;
    }

    /** 获取当前中心坐标 */
    getCenter() {
        const c = this._map.getCenter();
        return { lat: c.lat, lng: c.lng };
    }

    /** 获取当前缩放级别 */
    getZoom() {
        return this._map.getZoom();
    }

    /** 设置中心点 */
    setCenter(lat, lng, zoom) {
        this._map.setView([lat, lng], zoom !== undefined ? zoom : this._map.getZoom());
        return this;
    }

    /** 设置缩放级别 */
    setZoom(zoom) {
        this._map.setZoom(zoom);
        return this;
    }

    /** 放大地图 */
    zoomIn() {
        this._map.zoomIn();
        return this;
    }

    /** 缩小地图 */
    zoomOut() {
        this._map.zoomOut();
        return this;
    }

    /** 飞行动画到指定位置 */
    flyTo(lat, lng, zoom) {
        this._map.flyTo([lat, lng], zoom !== undefined ? zoom : this._map.getZoom(), {
            duration: 1.2
        });
        return this;
    }

    /** 适配边界（自动缩放以显示全部坐标） */
    fitBounds(coordsArray, options) {
        const bounds = L.latLngBounds(coordsArray.map(c => [c.lat || c[0], c.lng || c[1]]));
        this._map.fitBounds(bounds, Object.assign({ padding: [30, 30], maxZoom: 16 }, options));
        return this;
    }

    /** 刷新地图尺寸（容器尺寸变化后调用） */
    invalidateSize() {
        this._map.invalidateSize();
        return this;
    }

    /** 切换底图 */
    switchTileLayer(key) {
        if (this._tileLayer) {
            this._map.removeLayer(this._tileLayer);
        }
        this._tileLayer = this._addTileLayer(key);
        this._tileKey = key;
        return this;
    }

    /** 添加标记点 */
    addMarker(lat, lng, options) {
        const marker = L.marker([lat, lng], options || {});
        marker.addTo(this._map);
        return marker;
    }

    /** 添加多边形 */
    addPolygon(coords, options) {
        const polygon = L.polygon(coords, options || {});
        polygon.addTo(this._map);
        return polygon;
    }

    /** 添加折线 */
    addPolyline(coords, options) {
        const polyline = L.polyline(coords, options || {});
        polyline.addTo(this._map);
        return polyline;
    }

    /** 添加圆形 */
    addCircle(lat, lng, radius, options) {
        const circle = L.circle([lat, lng], Object.assign({ radius: radius || 500 }, options));
        circle.addTo(this._map);
        return circle;
    }

    /** 添加自定义 HTML 标记 */
    addDivMarker(lat, lng, html, options) {
        const icon = L.divIcon(Object.assign({
            html: html,
            className: '',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        }, options));
        const marker = L.marker([lat, lng], { icon: icon });
        marker.addTo(this._map);
        return marker;
    }

    /** 移除所有图层（底图除外） */
    clearLayers() {
        this._map.eachLayer(layer => {
            // 保留瓦片图层
            if (layer !== this._tileLayer) {
                this._map.removeLayer(layer);
            }
        });
        return this;
    }

    /** 销毁地图实例 */
    destroy() {
        this._map.remove();
        this._map = null;
        this._tileLayer = null;
        this._scaleControl = null;
    }
}
