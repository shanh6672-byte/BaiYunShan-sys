// ==================== CartoDB Provider ====================
// 文件：src/js/map/providers/carto-provider.js
// 职责：提供 CartoDB Positron / Dark / Voyager 瓦片图层定义

var CartoProvider = {
    name: 'carto',

    // ---- CartoDB 瓦片 URL 模板（移除 {r} 避免 retina 404） ----
    POSITRON_URL: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    DARK_URL:     'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    VOYAGER_URL:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',

    MAX_ZOOM: 19,
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',

    // ---- 工厂方法 ----

    /** CartoDB Positron（浅色） */
    createCartoPositronLayer: function () {
        return {
            name: 'Carto Positron',
            url: this.POSITRON_URL,
            options: {
                maxZoom: this.MAX_ZOOM,
                attribution: this.ATTRIBUTION
            }
        };
    },

    /** CartoDB Dark Matter（暗色） */
    createCartoDarkLayer: function () {
        return {
            name: 'Carto Dark',
            url: this.DARK_URL,
            options: {
                maxZoom: this.MAX_ZOOM,
                attribution: this.ATTRIBUTION
            }
        };
    },

    /** CartoDB Voyager */
    createCartoVoyagerLayer: function () {
        return {
            name: 'Carto Voyager',
            url: this.VOYAGER_URL,
            options: {
                maxZoom: this.MAX_ZOOM,
                attribution: this.ATTRIBUTION
            }
        };
    },

    // ---- 注册到 BaiyunshanMap.TILE_LAYERS ----
    register: function () {
        BaiyunshanMap.TILE_LAYERS['carto-positron'] = this.createCartoPositronLayer();
        BaiyunshanMap.TILE_LAYERS['carto-dark']     = this.createCartoDarkLayer();
        BaiyunshanMap.TILE_LAYERS['carto-voyager']  = this.createCartoVoyagerLayer();
    }
};

// 自动注册
if (typeof BaiyunshanMap !== 'undefined') {
    CartoProvider.register();
}
