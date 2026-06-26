// ==================== GF-2 遥感影像 Provider ====================
// 文件：src/js/map/providers/gf2-provider.js
// 职责：GF-2 高分二号遥感影像加载接口（WMS/WMTS/XYZ/GeoTIFF）
//       当前为占位实现，后续接入真实 GF-2 数据源
// 用途：遥感分析、风险分析、热力图、NDVI成果展示、专题图展示

var GF2Provider = {
    name: 'gf2',

    // ---- 占位瓦片（透明，不遮挡底图） ----
    _placeholderPng: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',

    _makePlaceholder: function (label) {
        return {
            name: '[GF-2] ' + label,
            url: this._placeholderPng,
            options: {
                maxZoom: 22,
                attribution: '[占位] GF-2 ' + label + ' — 待接入真实数据源',
                opacity: 0
            }
        };
    },

    // ---- 接口方法（预留） ----

    /** WMS 服务 */
    loadWMS: function (url, layerName) {
        return this._makePlaceholder('WMS: ' + (layerName || url));
    },

    /** WMTS 服务 */
    loadWMTS: function (url, layerName) {
        return this._makePlaceholder('WMTS: ' + (layerName || url));
    },

    /** XYZ 瓦片 */
    loadXYZ: function (url) {
        return this._makePlaceholder('XYZ: ' + url);
    },

    /** GeoTIFF 文件 */
    loadGeoTIFF: function (url) {
        return this._makePlaceholder('GeoTIFF: ' + url);
    },

    // ---- 注册到 BaiyunshanMap.TILE_LAYERS ----
    register: function () {
        BaiyunshanMap.TILE_LAYERS['gf2']         = this._makePlaceholder('GF-2影像（预留）');
        BaiyunshanMap.TILE_LAYERS['gf2-wms']     = this.loadWMS('', 'WMS默认');
        BaiyunshanMap.TILE_LAYERS['gf2-wmts']    = this.loadWMTS('', 'WMTS默认');
        BaiyunshanMap.TILE_LAYERS['gf2-xyz']     = this.loadXYZ('XYZ默认');
        BaiyunshanMap.TILE_LAYERS['gf2-geotiff'] = this.loadGeoTIFF('GeoTIFF默认');
    }
};

// 自动注册
if (typeof BaiyunshanMap !== 'undefined') {
    GF2Provider.register();
}
