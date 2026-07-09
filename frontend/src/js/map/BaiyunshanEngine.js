// ==================== 白云山地图引擎适配器 ====================
var BaiyunshanEngine = {
    name: 'baiyunshan',

    // ==================== 地图联动同步 ====================
    // 当一个地图被拖拽或缩放时，自动同步到其余所有地图
    _syncing: false,

    _hookSync: function (leafletMap, myId) {
        leafletMap.on('moveend', function () {
            if (BaiyunshanEngine._syncing) return;      // 防止递归触发
            BaiyunshanEngine._syncing = true;

            var center = leafletMap.getCenter();
            var zoom   = leafletMap.getZoom();

            Object.keys(MapFacade._instances).forEach(function (id) {
                if (id === myId) return;                // 跳过自己
                var other = MapFacade._instances[id];
                if (other && other.setView) {
                    other.setView(center, zoom, { animate: false });
                }
            });

            BaiyunshanEngine._syncing = false;
        });
    },

    // ==================== 创建地图实例 ====================
    // 使用 BaiyunshanMap 替代原生 L.map，自动应用 OSM 底图 + 比例尺 + 联动同步
    create: function (containerId, options) {
        console.trace('[BaiyunshanEngine] create() 调用栈 — containerId:', containerId);
        var container = document.getElementById(containerId);
        if (!container) {
            throw new Error('BaiyunshanEngine: 未找到容器 #' + containerId);
        }

        // 标记容器以便 CSS 命中（响应式 / 控件微调）
        container.classList.add('bym-map-container');

        // 创建 BaiyunshanMap
        // zoomControl: false → 复用页面已有的自定义缩放按钮
        // 忽略 app.js 传入的 center（贵阳），使用 BaiyunshanMap 默认的丽水白云山坐标
        var bym = new BaiyunshanMap(containerId, {
            zoomControl: false,
            scaleControl: true
        });

        var leafletMap = bym.getMap();
        console.log('[BaiyunshanEngine] 地图已创建: ' + containerId + ', center:', leafletMap.getCenter());

        // 存储 BaiyunshanMap 引用以便后续直接操作
        if (!leafletMap._baiyunshan) {
            leafletMap._baiyunshan = bym;
        }

        // 挂载联动同步：此地图移动/缩放时 → 推送至其余所有地图
        BaiyunshanEngine._hookSync(leafletMap, containerId);

        // ★ 修复：地图创建后立即刷新尺寸，解决"需要操作才显示"的问题
        setTimeout(function () {
            leafletMap.invalidateSize();
        }, 100);
        // 双重保险：稍后再刷新一次，处理 CSS 过渡 / 异步渲染
        setTimeout(function () {
            leafletMap.invalidateSize();
        }, 500);

        return leafletMap;
    },

    // ==================== 图层绘制（委托给 LeafletEngine） ====================
    // 以下方法接收的 instance 是 bym.getMap() 返回的 Leaflet L.map 实例，
    // LeafletEngine 的方法直接操作 Leaflet API，完全兼容

    addForestBoundary: LeafletEngine.addForestBoundary,
    addCompartments:  LeafletEngine.addCompartments,
    addRangerMarkers: LeafletEngine.addRangerMarkers,
    addDroneMarkers:  LeafletEngine.addDroneMarkers,
    addFireMarkers:   LeafletEngine.addFireMarkers,
    addPestMarkers:   LeafletEngine.addPestMarkers,
    addPatrolRoutes:  LeafletEngine.addPatrolRoutes,
    addFvcMarkers:    LeafletEngine.addFvcMarkers,
    addPolyline:      LeafletEngine.addPolyline,
    removeLayer:      LeafletEngine.removeLayer,
    fitBounds:        LeafletEngine.fitBounds,

    // ==================== 地图控制（委托给 LeafletEngine） ====================

    zoomIn:          LeafletEngine.zoomIn,
    zoomOut:         LeafletEngine.zoomOut,
    invalidateSize:  LeafletEngine.invalidateSize
};
