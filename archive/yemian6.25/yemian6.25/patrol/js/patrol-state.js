// patrol-state.js — 巡护监控模块中心状态管理（EventEmitter）
class PatrolState {
    constructor() {
        this._listeners = {};

        this.dataMode = 'mock';
        this.wsConnected = false;

        this.rangers = new Map();
        this.drones = new Map();
        this.activeTrajectories = new Map();

        this.selectedUserId = null;
        this.replayActive = false;
        this.replayProgress = 0;
        this.currentInnerTab = 'inner-ranger-rt';
    }

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        (this._listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) { console.warn('[PatrolState] listener error:', event, e); } });
    }

    updateRanger(userId, data) {
        const existing = this.rangers.get(userId) || {};
        this.rangers.set(userId, { ...existing, ...data, lastUpdate: Date.now() });
        this.emit('ranger-updated', { userId, data: this.rangers.get(userId) });
    }

    updateDrone(droneId, data) {
        const existing = this.drones.get(droneId) || {};
        this.drones.set(droneId, { ...existing, ...data, lastUpdate: Date.now() });
        this.emit('drone-updated', { droneId, data: this.drones.get(droneId) });
    }

    appendTrajectoryPoint(userId, point) {
        if (!this.activeTrajectories.has(userId)) {
            this.activeTrajectories.set(userId, []);
        }
        this.activeTrajectories.get(userId).push(point);
        this.emit('trajectory-appended', { userId, point });
    }

    setRangerOnlineStatus(userId, online) {
        const ranger = this.rangers.get(userId);
        if (ranger) {
            ranger.status = online ? '在线' : '离线';
            if (online) ranger.lastSeen = Date.now();
            this.emit('ranger-status-changed', { userId, online });
        }
    }
}

const patrolState = new PatrolState();
