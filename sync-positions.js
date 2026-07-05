// ==================== ExperimentalLayerManager → 后端 坐标同步 ====================
// ExperimentalLayerManager 基于真实SHP边界生成标记后，将其坐标同步到后端数据库，
// 确保API返回的坐标与地图标记一致

const PositionSync = {
    _synced: false,
    _retries: 0,
    _maxRetries: 20,

    /**
     * 轮询等待 ExperimentalLayerManager 完成图层创建，然后提取坐标同步到后端
     */
    init() {
        if (this._synced || ApiService.USE_MOCK) return;
        this._trySync();
    },

    _trySync() {
        this._retries++;
        // 查找地图上已有的护林员/无人机 marker
        const map = MapFacade.getMap();
        if (!map || this._retries > this._maxRetries) {
            if (this._retries > this._maxRetries) {
                console.log('[Sync] 超时，使用默认坐标');
                this._syncFromApi();
            } else {
                setTimeout(() => this._trySync(), 1500);
            }
            return;
        }

        const rangers = [];
        const drones = [];

        // 遍历地图所有图层，找到带 tooltip 的 marker
        map.eachLayer(layer => {
            if (!layer.getLatLng) return;  // 不是 marker
            const tooltip = layer.getTooltip();
            if (!tooltip) return;
            const name = (tooltip.getContent && tooltip.getContent()) || '';

            const latlng = layer.getLatLng();
            if (typeof latlng.lat !== 'number' || typeof latlng.lng !== 'number') return;

            // 判断是护林员还是无人机（根据 tooltip 内容）
            // ExperimentalLayerManager 的护林员 marker tooltip 是人名
            // 无人机 marker tooltip 是 UAV-xx
            if (name && name.match(/^UAV/i)) {
                drones.push({ code: name, lat: latlng.lat, lng: latlng.lng });
            } else if (name && name.length >= 2 && !name.match(/^(起点|终点|火|松|林|白)/)) {
                rangers.push({ name: name, lat: latlng.lat, lng: latlng.lng });
            }
        });

        if (rangers.length === 0 && drones.length === 0) {
            // 图层还没加载完，继续等
            setTimeout(() => this._trySync(), 1500);
            return;
        }

        console.log(`[Sync] 找到 ${rangers.length} 名护林员, ${drones.length} 架无人机，同步中...`);
        this._postSync(rangers, drones);
    },

    async _postSync(rangers, drones) {
        try {
            const res = await fetch(ApiService.BASE_URL + '/api/positions/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rangers, drones })
            });
            const data = await res.json();
            if (data.success) {
                console.log(`[Sync] 同步完成: ${data.rangers} 护林员 / ${data.drones} 无人机`);
                this._synced = true;
            }
        } catch (e) {
            console.warn('[Sync] 同步失败:', e);
        }
    },

    /**
     * 降级方案：用 API 现有坐标（track-playback 会用）
     */
    async _syncFromApi() {
        console.log('[Sync] 降级：使用API现有坐标');
        this._synced = true;
    }
};
