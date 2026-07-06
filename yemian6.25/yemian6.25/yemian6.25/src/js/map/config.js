// ==================== 地图统一配置 ====================
// 文件：src/js/map/config.js
// 职责：底图 Token、默认底图、服务地址等全局配置
//       接入后端后改为从 ApiService 读取

var MapConfig = {

    // ---- 天地图 Token ----
    // 申请地址：https://console.tianditu.gov.cn/
    // 空白瓦片 = Token 失效，请替换为新 Token
    tianditu: {
        token: '3d1b22a5e3d74a5fb3d3c1f8e0c1e0f1'
    },

    // ---- 默认底图 ----
    // 可设置为任意已注册的 TILE_LAYERS key
    defaultBasemap: 'amap-image'

    // ---- 扩展配置（预留） ----
    // 后续接入后端时，可在此处添加：
    //   gf2:     { wmsUrl: '...', wmtsUrl: '...' }
    //   drone:   { serverUrl: '...' }
    //   amap:    { key: '...' }   (高德 JS API Key，瓦片无需)
};
