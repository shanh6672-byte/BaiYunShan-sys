// patrol-ws-client.js — WebSocket / 模拟双模 + 混合模式（指定用户走真实WS）
class PatrolWsClient {
    constructor(url) {
        this.url = url || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3000';
        this.ws = null;           // 主连接（mock模式时不用）
        this.realWsMap = new Map(); // 混合模式：patrolId -> WS连接
        this.reconnectTimer = null;
        this.reconnectDelay = 2000;
        this.monitoringPatrolId = null;
        this._targetUserId = null; // 混合模式只更新此用户
    }

    connect(patrolId) {
        this.monitoringPatrolId = patrolId;
        this._doConnectInternal(patrolId);

        var self = this;
        patrolState.on('data-mode-changed', function(data) {
            console.log('[PatrolWs] 数据模式变更，重连中...');
            self.disconnect();
            self._doConnectInternal(self.monitoringPatrolId);
        });
    }

    // 混合模式：mock运行同时，连接真实WS更新所有用户
    // patrolIds可以是单个字符串或数组
    connectHybrid(patrolIds, targetUserId) {
        this._targetUserId = targetUserId;
        var ids = Array.isArray(patrolIds) ? patrolIds : [patrolIds];
        this.monitoringPatrolId = ids[0];
        this._doConnectInternal(ids[0]);  // 启动mock
        for (var i = 0; i < ids.length; i++) {
            this._connectReal(ids[i]);     // 为每个任务连接真实WS
        }
        console.log('[PatrolWs] 混合模式: mock全体 + 真实WS监控 ' + ids.length + ' 个任务');
    }

    _doConnectInternal(patrolId) {
        if (PatrolApiService.USE_MOCK) {
            patrolState.dataMode = this._targetUserId ? 'hybrid' : 'mock';
            PatrolApiService.startMockSimulation();
            this._emitStatus(this._targetUserId ? 'hybrid' : 'mock');
            return;
        }

        patrolState.dataMode = 'ws';
        this._doConnect(patrolId);
    }

    _doConnect(patrolId) {
        try {
            this.ws = new WebSocket(this.url);
        } catch (e) {
            this._scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            patrolState.wsConnected = true;
            this.reconnectDelay = 2000;
            this._emitStatus('online');
            this.ws.send(JSON.stringify({ type: 'register', role: 'monitor', patrolId: this.monitoringPatrolId }));
        };

        this.ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch (err) { return; }
            this._handleMessage(msg);
        };

        this.ws.onclose = () => {
            patrolState.wsConnected = false;
            this._emitStatus('offline');
            this._scheduleReconnect();
        };

        this.ws.onerror = (e) => { console.error('[PatrolWs] WS错误:', e); };
    }

    // 混合模式的真实WebSocket连接，只更新_targetUserId
    _connectReal(patrolId) {
        if (this.realWsMap.has(patrolId)) return; // 已有连接
        var self = this;
        var ws;
        try {
            ws = new WebSocket(this.url);
        } catch (e) {
            setTimeout(function() { self._connectReal(patrolId); }, 5000);
            return;
        }

        this.realWsMap.set(patrolId, ws);

        ws.onopen = function() {
            ws.send(JSON.stringify({ type: 'register', role: 'monitor', patrolId: patrolId }));
            console.log('[PatrolWs] 真实WS已连接 patrolId=' + patrolId);
        };

        ws.onmessage = function(e) {
            var msg;
            try { msg = JSON.parse(e.data); } catch (err) { return; }
            console.log('[PatrolWs] 真实WS收到 type=' + msg.type + ' userId=' + msg.userId + ' patrolId=' + patrolId);
            // 接受所有用户的真实数据，不再过滤
            self._handleMessage(msg);
        };

        ws.onclose = function() {
            console.log('[PatrolWs] 真实WS断开 patrolId=' + patrolId);
            self.realWsMap.delete(patrolId);
            setTimeout(function() { self._connectReal(patrolId); }, self.reconnectDelay);
        };

        ws.onerror = function(e) { console.error('[PatrolWs] 真实WS错误 patrolId=' + patrolId, e); };
    }

    _handleMessage(msg) {
        switch (msg.type) {
            case 'trajectory_broadcast':
                console.log('[PatrolWs] 处理轨迹广播 userId=' + msg.userId + ' lat=' + msg.latitude + ' lng=' + msg.longitude);
                patrolState.updateRanger(msg.userId, {
                    name: msg.userName || msg.userId,
                    lat: msg.latitude,
                    lng: msg.longitude,
                    speed: msg.speed,
                    heading: msg.heading,
                    status: '在线'
                });
                patrolState.appendTrajectoryPoint(msg.userId, {
                    lat: msg.latitude, lng: msg.longitude,
                    ts: msg.timestamp, speed: msg.speed,
                    accuracy: msg.accuracy, heading: msg.heading
                });
                break;
            case 'user_status':
                var isOnline = msg.status === 'online' || msg.status === 'active';
                console.log('[PatrolWs] 处理状态变更 userId=' + msg.userId + ' status=' + msg.status + ' 在线=' + isOnline);
                patrolState.setRangerOnlineStatus(msg.userId, isOnline);
                if (msg.userName) {
                    patrolState.updateRanger(msg.userId, { name: msg.userName });
                }
                break;
            case 'registered':
                console.log('[PatrolWs] 收到注册确认');
                break;
        }
    }

    _scheduleReconnect() {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
            this._doConnect(this.monitoringPatrolId);
        }, this.reconnectDelay);
    }

    _emitStatus(status) {
        patrolState.emit('ws-status', { status });
    }

    disconnect() {
        clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.realWsMap.forEach(function(ws, patrolId) {
            ws.onclose = null;
            ws.close();
        });
        this.realWsMap.clear();
        PatrolApiService.stopMockSimulation();
        patrolState.wsConnected = false;
    }
}
