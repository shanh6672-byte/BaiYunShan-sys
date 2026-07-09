// ==================== 地图门面（Facade） ====================
// 统一地图操作接口，对 app.js 屏蔽底层地图引擎差异
// 切换引擎：在 index.html 中加载不同的 map-engine-xxx.js 即可

const MapFacade = {
    _engine: null,
    _instances: {},

    // 注入引擎实现
    use(engine) {
        this._engine = engine;
    },

    // 获取引擎（带校验）
    _engineOrThrow() {
        if (!this._engine) throw new Error('MapFacade: 未注册地图引擎，请调用 MapFacade.use(engine)');
        return this._engine;
    },

    // 创建地图实例
    create(containerId, options) {
        const engine = this._engineOrThrow();
        // 如果已有实例则刷新尺寸后复用
        if (this._instances[containerId]) {
            engine.invalidateSize(this._instances[containerId]);
            return this._instances[containerId];
        }
        console.trace('[MapFacade] create() 调用栈 — containerId:', containerId);
        const instance = engine.create(containerId, options);
        this._instances[containerId] = instance;
        console.log('[MapFacade] 实例已注册: ' + containerId + ', 当前总数: ' + Object.keys(this._instances).length);
        return instance;
    },

    // 获取地图实例
    getMap(containerId) {
        // 未传id时返回第一个实例（兼容旧 dashMap 变量的宽松引用）
        if (!containerId) {
            const keys = Object.keys(this._instances);
            return keys.length ? this._instances[keys[0]] : null;
        }
        return this._instances[containerId] || null;
    },

    // ==================== 图层绘制 ====================

    // 添加林场边界
    addForestBoundary(coords, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addForestBoundary(instance, coords);
    },

    // 添加林班小班
    addCompartments(list, colors, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addCompartments(instance, list, colors);
    },

    // 添加护林员标记
    addRangerMarkers(list, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addRangerMarkers(instance, list);
    },

    // 添加无人机标记
    addDroneMarkers(list, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addDroneMarkers(instance, list);
    },

    // 添加火情标记
    addFireMarkers(list, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addFireMarkers(instance, list);
    },

    // 添加虫害标记
    addPestMarkers(list, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addPestMarkers(instance, list);
    },

    // 添加巡护轨迹
    addPatrolRoutes(list, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addPatrolRoutes(instance, list);
    },

    // 添加FVC退化区域标记
    addFvcMarkers(list, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.addFvcMarkers(instance, list);
    },

    // ==================== 便捷方法 ====================

    // 一次性添加基础图层（林场边界 + 林班小班）
    addBaseLayers(boundary, compartments, colors, containerId) {
        this.addForestBoundary(boundary, containerId);
        this.addCompartments(compartments, colors, containerId);
    },

    // 一次性添加所有业务标记点（仅位置标记，不含巡护轨迹线）
    async addAllMarkers(containerId) {
        // ApiService 作为全局变量存在于 app.js 中
        if (typeof ApiService === 'undefined') return;

        const rangers = await ApiService.getRangers();
        this.addRangerMarkers(rangers, containerId);

        const drones = await ApiService.getDrones();
        this.addDroneMarkers(drones, containerId);

        const fires = await ApiService.getFires();
        this.addFireMarkers(fires, containerId);

        const pests = await ApiService.getPests();
        this.addPestMarkers(pests, containerId);

        // 巡护轨迹线仅在历史轨迹回放中显示，不在此处添加
    },

    // ==================== 地图控制 ====================

    // 刷新所有地图尺寸
    invalidateSize(containerId) {
        const engine = this._engineOrThrow();
        if (containerId) {
            const instance = this._instances[containerId];
            if (instance) engine.invalidateSize(instance);
        } else {
            Object.values(this._instances).forEach(inst => engine.invalidateSize(inst));
        }
    },

    // 放大
    zoomIn(containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.zoomIn(instance);
    },

    // 缩小
    zoomOut(containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance) engine.zoomOut(instance);
    },

    // ==================== 轨迹与其他 ====================

    // 绘制折线（轨迹）
    addPolyline(coords, options, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance && engine.addPolyline) {
            return engine.addPolyline(instance, coords, options);
        }
        return null;
    },

    // 移除图层
    removeLayer(layer, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance && engine.removeLayer) {
            engine.removeLayer(instance, layer);
        }
    },

    // 缩放到坐标范围
    fitBounds(coords, containerId) {
        const engine = this._engineOrThrow();
        const instance = this.getMap(containerId);
        if (instance && engine.fitBounds) {
            engine.fitBounds(instance, coords);
        }
    },
};
