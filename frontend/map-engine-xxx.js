// ==================== 新地图引擎适配器（占位） ====================
// 实现与 map-engine-leaflet.js 完全相同的接口契约
// 替换时：在 index.html 中将 map-engine-leaflet.js 替换为此文件，
//         并设置 window.__MAP_ENGINE__ = NewEngine;
//
// 使用方式（index.html）：
//   <script src="map-engine-xxx.js"></script>
//   <script>window.__MAP_ENGINE__ = NewEngine;</script>

const NewEngine = {
    name: 'new-engine',

    // 创建地图实例
    // options: { center: [lat, lng], zoom: number }
    create(containerId, options) {
        throw new Error('NewEngine.create() 尚未实现');
    },

    // 添加林场边界多边形
    // coords: [[lat, lng], ...]
    addForestBoundary(instance, coords) {
        throw new Error('NewEngine.addForestBoundary() 尚未实现');
    },

    // 批量添加林班小班多边形
    // list: [{ name, coords: [[lat,lng],...] }, ...]
    // colors: ['#hex', ...]
    addCompartments(instance, list, colors) {
        throw new Error('NewEngine.addCompartments() 尚未实现');
    },

    // 批量添加护林员标记点
    // list: [{ lat, lng, name, id, area, status, speed, battery }, ...]
    addRangerMarkers(instance, list) {
        throw new Error('NewEngine.addRangerMarkers() 尚未实现');
    },

    // 批量添加无人机标记点
    // list: [{ lat, lng, name, model, alt, heading, battery, status }, ...]
    addDroneMarkers(instance, list) {
        throw new Error('NewEngine.addDroneMarkers() 尚未实现');
    },

    // 批量添加火情标记点（含扩散圈）
    // list: [{ lat, lng, name, level, area, time, status }, ...]
    addFireMarkers(instance, list) {
        throw new Error('NewEngine.addFireMarkers() 尚未实现');
    },

    // 批量添加虫害标记点
    // list: [{ lat, lng, area, areaSize }, ...]
    addPestMarkers(instance, list) {
        throw new Error('NewEngine.addPestMarkers() 尚未实现');
    },

    // 批量添加巡护轨迹线
    // list: [{ coords: [[lat,lng],...], person, date, distance }, ...]
    addPatrolRoutes(instance, list) {
        throw new Error('NewEngine.addPatrolRoutes() 尚未实现');
    },

    // 添加FVC植被退化区域标记点
    // list: [{ lat, lng, area, fvc, level }, ...]
    addFvcMarkers(instance, list) {
        throw new Error('NewEngine.addFvcMarkers() 尚未实现');
    },

    // 放大
    zoomIn(instance) {
        throw new Error('NewEngine.zoomIn() 尚未实现');
    },

    // 缩小
    zoomOut(instance) {
        throw new Error('NewEngine.zoomOut() 尚未实现');
    },

    // 刷新地图尺寸（容器尺寸变化后调用）
    invalidateSize(instance) {
        throw new Error('NewEngine.invalidateSize() 尚未实现');
    }
};
