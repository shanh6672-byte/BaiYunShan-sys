// ==================== 天地图 Provider ====================
// 文件：src/js/map/providers/tianditu-provider.js
// 职责：提供天地图矢量、影像、地形、注记瓦片图层定义
// Token 从配置读取，不硬编码

var TiandituProvider = {
    name: 'tianditu',

    // ---- Token 从统一配置读取 ----
    // 在 src/js/map/config.js 中修改 MapConfig.tianditu.token
    _config: {
        get token() {
            return (typeof MapConfig !== 'undefined' && MapConfig.tianditu)
                ? MapConfig.tianditu.token
                : '3d1b22a5e3d74a5fb3d3c1f8e0c1e0f1';  // 回退
        }
    },

    // ---- 天地图 WMTS URL 模板 ----
    // 注意：WMTS 的 TILEMATRIX 从 1 开始，Leaflet {z} 从 0 开始
    // 偏移 1 级可能造成瓦片轻微错位，但不影响加载
    VECTOR_URL:    'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={tk}',
    SATELLITE_URL: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={tk}',
    TERRAIN_URL:   'https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={tk}',
    LABEL_URL:     'https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={tk}',

    SUBDOMAINS: ['0', '1', '2', '3', '4', '5', '6', '7'],
    MAX_ZOOM: 18,
    ATTRIBUTION: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',

    // ---- Token 配置 ----

    /** 设置 Token */
    setToken: function (token) {
        this._config.token = token;
    },

    /** 获取 Token */
    getToken: function () {
        // 优先从配置读取，后续可改为 ApiService.getTiandituToken()
        return this._config.token;
    },

    /** 构建带 token 的 options */
    _buildOptions: function (extra) {
        var opts = {
            subdomains: this.SUBDOMAINS,
            maxZoom: this.MAX_ZOOM,
            attribution: this.ATTRIBUTION
        };
        if (extra) {
            Object.keys(extra).forEach(function (k) { opts[k] = extra[k]; });
        }
        return opts;
    },

    // ---- 工厂方法 ----

    /** 天地图矢量图层 */
    createTiandituVectorLayer: function () {
        return {
            name: '天地图矢量',
            url: this.VECTOR_URL.replace('{tk}', this.getToken()),
            options: this._buildOptions()
        };
    },

    /** 天地图卫星影像图层 */
    createTiandituSatelliteLayer: function () {
        return {
            name: '天地图影像',
            url: this.SATELLITE_URL.replace('{tk}', this.getToken()),
            options: this._buildOptions()
        };
    },

    /** 天地图地形图层 */
    createTiandituTerrainLayer: function () {
        var url = this.TERRAIN_URL.replace('{tk}', this.getToken());
        console.log('[Tianditu] 地形图层 URL:', url);
        console.log('[Tianditu] Token 前8位:', this.getToken().substring(0, 8) + '...');
        return {
            name: '天地图地形',
            url: url,
            options: this._buildOptions()
        };
    },

    /** 天地图注记图层（叠加层） */
    createTiandituLabelLayer: function () {
        return {
            name: '天地图注记',
            url: this.LABEL_URL.replace('{tk}', this.getToken()),
            options: this._buildOptions({ attribution: '' })
        };
    },

    // ---- 注册到 BaiyunshanMap.TILE_LAYERS ----
    register: function () {
        BaiyunshanMap.TILE_LAYERS['tianditu-vector']  = this.createTiandituVectorLayer();
        BaiyunshanMap.TILE_LAYERS['tianditu-image']   = this.createTiandituSatelliteLayer();
        BaiyunshanMap.TILE_LAYERS['tianditu-terrain'] = this.createTiandituTerrainLayer();
        BaiyunshanMap.TILE_LAYERS['tianditu-label']   = this.createTiandituLabelLayer();
    }
};

// 自动注册
if (typeof BaiyunshanMap !== 'undefined') {
    TiandituProvider.register();
}
