// ==================== 白云山驾驶舱地图桥接 ====================

(function () {
    var CONTAINER_ID = 'dashMap';

    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;                     // 容器不存在则静默退出

    // -- 标记容器以便 BaiyunshanMap CSS 命中 --
    container.classList.add('bym-map-container');

    // -- 创建白云山地图 --
    // zoomControl: false → 复用页面已有的自定义缩放按钮 (#mapZoomIn / #mapZoomOut)
    var bymMap = new BaiyunshanMap(CONTAINER_ID, {
        zoomControl: false,
        scaleControl: true
    });

    // -- 将 BaiyunshanMap 内部的 Leaflet L.map 实例注入 MapFacade --
    // 此后 app.js 中所有 MapFacade.xxx('dashMap') 调用都操作此实例
    MapFacade._instances[CONTAINER_ID] = bymMap.getMap();

    // -- 暴露引用供控制台调试 --
    window.__bymDashMap__ = bymMap;
})();
