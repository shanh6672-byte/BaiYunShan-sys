// ==================== 无人机影像 Provider ====================
// 文件：src/js/map/providers/drone-provider.js
// 职责：提供无人机影像加载接口（WMS/WMTS/XYZ/GeoTIFF/ArcGIS），
//       当前返回占位图层，后续接入真实数据源

var DroneLayerProvider = {
    name: 'drone',

    // ---- 占位瓦片（透明，不遮挡底图） ----
    _placeholderUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',

    _makePlaceholder: function (label) {
        return {
            name: label,
            url: this._placeholderUrl,
            options: {
                maxZoom: 22,
                attribution: '[占位] ' + label + ' - 待接入真实数据',
                opacity: 0
            }
        };
    },

    // ---- 接口方法 ----

    /** WMS 服务加载（占位） */
    loadWMS: function (url, layerName) {
        return this._makePlaceholder('无人机 WMS: ' + (layerName || url));
    },

    /** WMTS 服务加载（占位） */
    loadWMTS: function (url, layerName) {
        return this._makePlaceholder('无人机 WMTS: ' + (layerName || url));
    },

    /** XYZ 瓦片加载（占位） */
    loadXYZ: function (url) {
        return this._makePlaceholder('无人机 XYZ: ' + url);
    },

    /** GeoTIFF 加载（占位） */
    loadGeoTIFF: function (url) {
        return this._makePlaceholder('无人机 GeoTIFF: ' + url);
    },

    /** ArcGIS 服务加载（占位） */
    loadArcGIS: function (url) {
        return this._makePlaceholder('无人机 ArcGIS: ' + url);
    },

    // ---- 注册到 BaiyunshanMap.TILE_LAYERS ----
    register: function () {
        BaiyunshanMap.TILE_LAYERS['drone-wms']     = this.loadWMS('', 'WMS默认');
        BaiyunshanMap.TILE_LAYERS['drone-wmts']    = this.loadWMTS('', 'WMTS默认');
        BaiyunshanMap.TILE_LAYERS['drone-xyz']     = this.loadXYZ('XYZ默认');
        BaiyunshanMap.TILE_LAYERS['drone-geotiff'] = this.loadGeoTIFF('GeoTIFF默认');
        BaiyunshanMap.TILE_LAYERS['drone-arcgis']  = this.loadArcGIS('ArcGIS默认');
        // 统一别名
        BaiyunshanMap.TILE_LAYERS['drone']         = this._makePlaceholder('无人机影像（预留）');
    }
};

// 自动注册
if (typeof BaiyunshanMap !== 'undefined') {
    DroneLayerProvider.register();
}
