// ==================== GeoServer WMS 图层 Provider ====================
// 提供白云山林场GeoServer上的矢量/栅格图层

const GeoserverProvider = {
    // GeoServer 配置
    BASE_URL: 'http://39.97.254.191:8080/geoserver',
    WORKSPACE: 'baiyunshan',

    // 可用图层列表
    layers: {
        // 业务图层（矢量）
        baiyun_boundary: {
            name: 'baiyun_boundary',
            title: '林场边界',
            type: 'vector',
            layerType: 'wms',
        },
        forest_compartment: {
            name: 'baiyunshan_compartments',
            title: '林班小班（五区）',
            type: 'vector',
            layerType: 'wms',
        },
        contour: {
            name: 'contour',
            title: '等高线',
            type: 'vector',
            layerType: 'wms',
        },
        landuse_class: {
            name: 'landuse_class',
            title: '土地利用分类',
            type: 'vector',
            layerType: 'wms',
        },
        // 专题图层（栅格）
        dem: {
            name: 'dem',
            title: 'DEM数字高程',
            type: 'raster',
            layerType: 'wms',
        },
        hillsha: {
            name: 'hillsha',
            title: '地形晕渲',
            type: 'raster',
            layerType: 'wms',
        },
        NDVI: {
            name: 'NDVI',
            title: 'NDVI植被指数',
            type: 'raster',
            layerType: 'wms',
        },
        s2_image: {
            name: 's2_image',
            title: 'Sentinel-2影像',
            type: 'raster',
            layerType: 'wms',
        },
    },

    /**
     * 获取 WMS GetMap URL
     * @param {string} layerName - 图层名
     * @returns {string} WMS URL
     */
    getWmsUrl(layerName) {
        const layer = this.layers[layerName];
        if (!layer) return '';
        return `${this.BASE_URL}/${this.WORKSPACE}/wms`;
    },

    /**
     * 获取 WMS 图层参数（用于 Leaflet L.tileLayer.wms）
     * @param {string} layerName - 图层名
     * @returns {object} 图层参数
     */
    getWmsLayerParams(layerName) {
        return {
            service: 'WMS',
            version: '1.3.0',
            request: 'GetMap',
            layers: `${this.WORKSPACE}:${layerName}`,
            format: 'image/png',
            transparent: true,
            crs: 'EPSG:4326',
        };
    },

    /**
     * 获取 WFS 要素查询 URL
     * @param {string} layerName - 图层名
     * @returns {string} WFS URL
     */
    getWfsUrl(layerName) {
        return `${this.BASE_URL}/${this.WORKSPACE}/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=${this.WORKSPACE}:${layerName}&outputFormat=application/json`;
    },

    /**
     * 通过后端代理获取 WFS GeoJSON（解决跨域）
     */
    getProxyWfsUrl(layerName) {
        return `http://localhost:5050/api/geoserver/${this.WORKSPACE}/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=${this.WORKSPACE}:${layerName}&outputFormat=application/json`;
    },

    /**
     * 获取业务图层列表
     */
    getBusinessLayers() {
        return [
            this.layers.baiyun_boundary,
            this.layers.forest_compartment,
            this.layers.contour,
            this.layers.landuse_class,
        ];
    },

    /**
     * 获取专题图层列表
     */
    getThematicLayers() {
        return [
            this.layers.dem,
            this.layers.hillsha,
            this.layers.NDVI,
            this.layers.s2_image,
        ];
    },
};

// 暴露到全局
window.GeoserverProvider = GeoserverProvider;
