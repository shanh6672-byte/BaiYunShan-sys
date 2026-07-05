// ==================== SSE 实时推送模块 ====================
// 连接后端 /api/patrol/stream，实时更新巡护力量位置

const RealtimeService = {
    _eventSource: null,
    _connected: false,
    _updateInterval: null,

    // 启动SSE连接
    connect() {
        if (this._eventSource) {
            this.disconnect();
        }

        const token = localStorage.getItem('fps_token') || '';
        // SSE不支持自定义header，通过URL参数传递token
        const url = ApiService.BASE_URL + '/api/patrol/stream?token=' + encodeURIComponent(token);

        try {
            this._eventSource = new EventSource(url);
        } catch(e) {
            console.warn('[Realtime] SSE连接创建失败，使用降级轮询模式');
            this._startPolling();
            return;
        }

        this._eventSource.onopen = () => {
            console.log('[Realtime] SSE连接已建立');
            this._connected = true;
        };

        this._eventSource.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._handleMessage(msg);
            } catch(e) {
                // heartbeat or invalid message, ignore
            }
        };

        this._eventSource.onerror = (e) => {
            // SSE断开后保持轮询，不重复disconnect/connect
            if (this._eventSource) {
                this._eventSource.close();
                this._eventSource = null;
            }
            this._connected = false;
            this._startPolling();
        };
    },

    // 断开SSE连接
    disconnect() {
        if (this._eventSource) {
            this._eventSource.close();
            this._eventSource = null;
        }
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
        this._connected = false;
    },

    // 降级轮询模式 + SSE节流（10秒内最多刷新一次）
    _throttleUntil: 0,

    _startPolling() {
        if (this._updateInterval) return;
        console.log('[Realtime] 启动轮询模式（每10秒）');
        this._pollUpdates();
        this._updateInterval = setInterval(() => {
            this._pollUpdates();
        }, 10000);
    },

    // 节流刷新：10秒内只执行一次
    _throttledRefresh() {
        var now = Date.now();
        if (now - this._throttleUntil < 0) return;
        this._throttleUntil = now + 10000;
        this._pollUpdates();
    },

    async _pollUpdates() {
        try {
            const [rangers, drones] = await Promise.all([
                ApiService.getRangers().catch(() => null),
                ApiService.getDrones().catch(() => null),
            ]);
            // 更新 GeoServerLayers 缓存并刷新地图标记
            if (rangers && typeof GeoServerLayers !== 'undefined') {
                GeoServerLayers._apiMarkers = GeoServerLayers._apiMarkers || {};
                GeoServerLayers._apiMarkers.rangers = rangers;
            }
            if (drones && typeof GeoServerLayers !== 'undefined') {
                GeoServerLayers._apiMarkers = GeoServerLayers._apiMarkers || {};
                GeoServerLayers._apiMarkers.drones = drones;
            }
            // 刷新所有地图上的标记
            if (typeof GeoServerLayers !== 'undefined') {
                var keys = Object.keys(MapFacade._instances);
                keys.forEach(function(id) {
                    var map = MapFacade._instances[id];
                    if (map) GeoServerLayers._addMarkersToMap(map);
                });
            }
        } catch(e) {
            // 静默失败
        }
    },

    // 处理SSE消息
    _handleMessage(msg) {
        switch(msg.type) {
            case 'ranger_update':
            case 'drone_update':
                this._throttledRefresh();
                break;
            case 'fire_new':
                // 新火情：自动添加到地图并刷新右侧栏
                console.log('[Realtime] 新火情事件:', msg.data);
                if (typeof GeoServerLayers !== 'undefined' && msg.data) {
                    GeoServerLayers.addSingleFirePoint(msg.data);
                }
                break;
            case 'pest_new':
                console.log('[Realtime] 新疫情事件:', msg.data);
                if (typeof GeoServerLayers !== 'undefined' && msg.data) {
                    GeoServerLayers._pestPoints = GeoServerLayers._pestPoints || [];
                    GeoServerLayers._pestPoints.push(msg.data);
                    const keys = Object.keys(MapFacade._instances);
                    keys.forEach(id => {
                        const map = MapFacade._instances[id];
                        if (map && GeoServerLayers._addMarkersToMap) GeoServerLayers._addMarkersToMap(map);
                    });
                }
                break;
            case 'abnormal_new':
                console.log('[Realtime] 新异常事件:', msg.data);
                if (typeof appendAbnormalItem === 'function' && msg.data) {
                    appendAbnormalItem(msg.data);
                }
                if (typeof refreshDashboardStats === 'function') refreshDashboardStats();
                break;
            case 'fire_update':
            case 'pest_update':
                // 状态更新：刷新右侧栏
                if (typeof DisasterPanel !== 'undefined' && DisasterPanel.refreshFireList) {
                    DisasterPanel.refreshFireList();
                }
                break;
            case 'heartbeat':
            case 'connected':
                break;
        }
    },

};
