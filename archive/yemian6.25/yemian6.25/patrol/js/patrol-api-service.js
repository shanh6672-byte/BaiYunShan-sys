// patrol-api-service.js — Mock数据 + 模拟位置实时更新
const PatrolApiService = {
    USE_MOCK: true,
    MOCK_UPDATE_INTERVAL: 3000,

    setDataMode(useMock) {
        if (this.USE_MOCK === useMock) return;
        this.USE_MOCK = useMock;
        this.stopMockSimulation();
        console.log('[PatrolApi] 数据模式切换: ' + (useMock ? '模拟数据' : '实时WebSocket'));
        // 触发模式变更事件，让 ws-client 重连
        patrolState.emit('data-mode-changed', { useMock: useMock });
    },

    getModeLabel() {
        return this.USE_MOCK ? '模拟模式' : '实时模式';
    },

    _mockRangers: [
        { userId: 'HL001', name: '张建国', area: '一号林区', phone: '138****1234',
          lat: 26.655, lng: 106.722, speed: 2.3, heading: 45, battery: 78, status: '在线' },
        { userId: 'HL002', name: '李明辉', area: '一号林区', phone: '139****5678',
          lat: 26.658, lng: 106.728, speed: 1.8, heading: 120, battery: 65, status: '在线' },
        { userId: 'HL003', name: '王大山', area: '二号林区', phone: '137****9012',
          lat: 26.648, lng: 106.735, speed: 3.1, heading: 200, battery: 42, status: '在线' },
        { userId: 'HL004', name: '陈志强', area: '二号林区', phone: '136****3456',
          lat: 26.660, lng: 106.740, speed: 0, heading: 0, battery: 15, status: '离线' },
        { userId: 'HL005', name: '刘德才', area: '三号林区', phone: '135****7890',
          lat: 26.642, lng: 106.725, speed: 0, heading: 0, battery: 80, status: '离线' },
        { userId: 'HL006', name: '赵文华', area: '一号林区', phone: '134****2345',
          lat: 26.644, lng: 106.720, speed: 2.0, heading: 315, battery: 90, status: '在线' },
        { userId: 'HL007', name: '孙立军', area: '四号林区', phone: '133****6789',
          lat: 26.650, lng: 106.715, speed: 0, heading: 0, battery: 72, status: '离线' },
        { userId: 'HL008', name: '周国平', area: '五号林区', phone: '132****0123',
          lat: 26.648, lng: 106.728, speed: 0, heading: 0, battery: 55, status: '离线' },
    ],
    _mockDrones: [
        { droneId: 'UAV-01', model: '大疆M300', alt: 120, heading: 45, battery: 85,
          lat: 26.660, lng: 106.730, speed: 8.0, status: '巡航中', operator: '张建国' },
        { droneId: 'UAV-02', model: '大疆M300', alt: 100, heading: 225, battery: 52,
          lat: 26.650, lng: 106.740, speed: 6.5, status: '巡航中', operator: '李明辉' },
        { droneId: 'UAV-03', model: '大疆M350', alt: 150, heading: 90, battery: 92,
          lat: 26.645, lng: 106.720, speed: 9.2, status: '巡航中', operator: '系统自动' },
    ],

    _simTimer: null,
    _simState: new Map(),

    startMockSimulation() {
        this._mockRangers.forEach(r => {
            patrolState.updateRanger(r.userId, r);
            this._simState.set(r.userId, { lat: r.lat, lng: r.lng, heading: r.heading });
            if (r.status === '在线') {
                patrolState.appendTrajectoryPoint(r.userId, {
                    lat: r.lat, lng: r.lng, ts: Date.now(), speed: r.speed, accuracy: 5, heading: r.heading
                });
            }
        });
        this._mockDrones.forEach(d => {
            patrolState.updateDrone(d.droneId, d);
            this._simState.set(d.droneId, { lat: d.lat, lng: d.lng, heading: d.heading });
            patrolState.appendTrajectoryPoint(d.droneId, {
                lat: d.lat, lng: d.lng, ts: Date.now(), speed: d.speed, accuracy: 2, heading: d.heading
            });
        });

        this._simTimer = setInterval(() => this._tick(), this.MOCK_UPDATE_INTERVAL);
    },

    _tick() {
        const now = Date.now();

        this._mockRangers.forEach(r => {
            if (r.status !== '在线') return;
            const s = this._simState.get(r.userId);
            s.lat += (Math.random() - 0.5) * 0.0003;
            s.lng += (Math.random() - 0.5) * 0.0003;
            s.heading = (s.heading + (Math.random() - 0.5) * 30 + 360) % 360;
            r.speed = Math.round((1.5 + Math.random() * 2) * 10) / 10;
            r.battery = Math.max(5, r.battery - Math.random() * 0.5);
            r.heading = s.heading;
            r.lat = s.lat;
            r.lng = s.lng;

            const point = { lat: s.lat, lng: s.lng, ts: now, speed: r.speed, accuracy: 5, heading: s.heading };
            patrolState.updateRanger(r.userId, { ...r });
            patrolState.appendTrajectoryPoint(r.userId, point);
        });

        this._mockDrones.forEach(d => {
            const s = this._simState.get(d.droneId);
            s.lat += (Math.random() - 0.5) * 0.0008;
            s.lng += (Math.random() - 0.5) * 0.0008;
            s.heading = (s.heading + (Math.random() - 0.5) * 20 + 360) % 360;
            d.battery = Math.max(5, d.battery - Math.random() * 0.3);
            d.heading = s.heading;
            d.lat = s.lat;
            d.lng = s.lng;

            const point = { lat: s.lat, lng: s.lng, ts: now, speed: d.speed, accuracy: 2, heading: s.heading };
            patrolState.updateDrone(d.droneId, { ...d });
            patrolState.appendTrajectoryPoint(d.droneId, point);
        });
    },

    stopMockSimulation() {
        clearInterval(this._simTimer);
        this._simTimer = null;
    },

    generateMockTrajectory(userId, pointCount) {
        pointCount = pointCount || 200;
        const ranger = this._mockRangers.find(r => r.userId === userId);
        const drone = this._mockDrones.find(d => d.droneId === userId);
        const base = ranger || drone;
        if (!base) return [];

        const points = [];
        let lat = base.lat - 0.005, lng = base.lng - 0.005;
        const now = Date.now();
        const interval = ranger ? 3000 : 1500;
        for (let i = 0; i < pointCount; i++) {
            lat += (Math.random() - 0.4) * 0.0004;
            lng += (Math.random() - 0.5) * 0.0004;
            points.push({
                lat: Math.round(lat * 1e6) / 1e6,
                lng: Math.round(lng * 1e6) / 1e6,
                ts: now - (pointCount - i) * interval,
                speed: 1 + Math.random() * 3,
                accuracy: 3 + Math.random() * 8,
            });
        }
        return points;
    },

    getMockTrajectory(userId, from, to) {
        return Promise.resolve(this.generateMockTrajectory(userId));
    },
};
