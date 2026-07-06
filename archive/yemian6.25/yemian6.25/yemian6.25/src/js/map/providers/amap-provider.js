// ==================== 高德地图 Provider ====================
// 文件：src/js/map/providers/amap-provider.js
// 职责：提供高德矢量、影像、注记瓦片图层定义
// 依赖：BaiyunshanMap.TILE_LAYERS（运行时注入）

var AmapProvider = {
    name: 'amap',

    // ---- 高德瓦片 URL 模板 ----
    // 矢量（style=8）
    VECTOR_URL: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    // 卫星影像（style=6）
    SATELLITE_URL: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    // 注记（style=8 + 透明背景，叠加层）

    SUBDOMAINS: ['1', '2', '3', '4'],
    MAX_ZOOM: 18,
    ATTRIBUTION: '&copy; <a href="https://www.amap.com/">高德地图</a>',

    // ---- 工厂方法 ----

    /** 高德矢量图层 */
    createAmapVectorLayer: function () {
        return {
            name: '高德矢量',
            url: this.VECTOR_URL,
            options: {
                subdomains: this.SUBDOMAINS,
                maxZoom: this.MAX_ZOOM,
                attribution: this.ATTRIBUTION
            }
        };
    },

    /** 高德卫星影像图层 */
    createAmapSatelliteLayer: function () {
        return {
            name: '高德影像',
            url: this.SATELLITE_URL,
            options: {
                subdomains: this.SUBDOMAINS,
                maxZoom: this.MAX_ZOOM,
                attribution: this.ATTRIBUTION
            }
        };
    },

    /** 高德注记图层（叠加层，不含底图） */
    createAmapLabelLayer: function () {
        return {
            name: '高德注记',
            url: this.VECTOR_URL,  // 高德矢量自带注记，此处保留接口
            options: {
                subdomains: this.SUBDOMAINS,
                maxZoom: this.MAX_ZOOM,
                attribution: '',
                opacity: 0.6
            }
        };
    },

    // ---- 注册到 BaiyunshanMap.TILE_LAYERS ----
    register: function () {
        BaiyunshanMap.TILE_LAYERS['amap-vector']     = this.createAmapVectorLayer();
        BaiyunshanMap.TILE_LAYERS['amap-image']      = this.createAmapSatelliteLayer();
        BaiyunshanMap.TILE_LAYERS['amap-label']      = this.createAmapLabelLayer();
    }
};

// 自动注册
if (typeof BaiyunshanMap !== 'undefined') {
    AmapProvider.register();
}
