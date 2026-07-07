// ==================== 数据服务抽象层 ====================
// 以后接入后端时，只需将 USE_MOCK 改为 false，并设置 BASE_URL 即可
const ApiService = {
    USE_MOCK: false,
    BASE_URL: '',

    _getToken() {
        const saved = localStorage.getItem('fps_token');
        return saved || '';
    },

    async request(url, options = {}) {
        if (this.USE_MOCK) return null;
        const token = this._getToken();
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        try {
            const res = await fetch(this.BASE_URL + url, {
                headers,
                ...options
            });
            if (!res.ok) {
                if (res.status === 401) {
                    // Token过期，清除登录状态
                    localStorage.removeItem('fps_token');
                    localStorage.removeItem('fps_user');
                    showLogin();
                    throw new Error('登录已过期，请重新登录');
                }
                throw new Error(`API Error: ${res.status}`);
            }
            return res.json();
        } catch(e) {
            if (e.message && e.message.includes('Failed to fetch')) {
                console.error('[ApiService] 无法连接后端服务:', e.message);
                throw new Error('无法连接后端服务，请确认后端已启动');
            }
            throw e;
        }
    },

    mock: {
        users: {
            admin: { password: 'admin', role: 'admin', name: '管理员' },
            guest: { password: 'guest', role: 'guest', name: '游客' }
        },
        // 【已禁用】旧贵阳Mock数据 — 已切换为浙江省丽水市白云山林场
        // 白云山林场中心（DEM 范围中心：28.5302, 119.9103）
        // 边界/林区/点位数据由 ExperimentalLayerManager + ExperimentalPointFactory 基于 SHP 实时生成
        forestConfig: {
            center: [28.5302, 119.9103],
            boundary: []
        },
        compartments: [],
        compartmentColors: ['#00bcd4','#009688','#00acc1','#26a69a','#00897b'],
        rangers: [],
        drones: [],
        fires: [],
        pests: [],
        patrolRoutes: [],
        fireImageData: [],
        pestImageData: [],
        firePointData: {},
        riskAssessment: {
            summary: { total: 15, high: 3, mid: 5, low: 7 },
            items: [
                { id:'RA001', area:'一号林区', type:'森林火灾', level:'high', score: 87.5, desc:'近期高温干燥，火险等级极高', time:'2026-06-10 08:00', status:'预警中' },
                { id:'RA002', area:'三号林区', type:'松材线虫病', level:'high', score: 82.3, desc:'病虫害扩散趋势明显', time:'2026-06-10 08:00', status:'预警中' },
                { id:'RA003', area:'二号林区', type:'森林火灾', level:'high', score: 79.1, desc:'连续高温预警，火险等级较高', time:'2026-06-10 08:00', status:'预警中' },
                { id:'RA004', area:'四号林区', type:'地质灾害', level:'mid', score: 65.4, desc:'近期降雨较多，山体滑坡风险', time:'2026-06-10 08:00', status:'监控中' },
                { id:'RA005', area:'五号林区', type:'松材线虫病', level:'mid', score: 58.7, desc:'发现疑似感染树木', time:'2026-06-10 08:00', status:'监控中' },
                { id:'RA006', area:'一号林区', type:'盗伐风险', level:'mid', score: 52.3, desc:'偏远区域巡护覆盖不足', time:'2026-06-10 08:00', status:'监控中' },
                { id:'RA007', area:'二号林区', type:'地质灾害', level:'mid', score: 48.9, desc:'低洼区域积水风险', time:'2026-06-10 08:00', status:'监控中' },
                { id:'RA008', area:'三号林区', type:'盗伐风险', level:'mid', score: 45.2, desc:'边界区域监控盲区', time:'2026-06-10 08:00', status:'监控中' },
                { id:'RA009', area:'四号林区', type:'森林火灾', level:'low', score: 32.1, desc:'火险等级一般', time:'2026-06-10 08:00', status:'已解除' },
                { id:'RA010', area:'五号林区', type:'地质灾害', level:'low', score: 28.5, desc:'风险较低', time:'2026-06-10 08:00', status:'已解除' }
            ]
        },
        fvcAnalysis: {
            areas: [
                { name:'一号林区', fvc:0.72, level:'中高覆盖', areaHigh:1850, areaMid:920, areaLow:380, areaBare:150, trend:'稳定' },
                { name:'二号林区', fvc:0.58, level:'中覆盖', areaHigh:1120, areaMid:860, areaLow:520, areaBare:200, trend:'下降' },
                { name:'三号林区', fvc:0.81, level:'高覆盖', areaHigh:2100, areaMid:680, areaLow:180, areaBare:40, trend:'上升' },
                { name:'四号林区', fvc:0.43, level:'低覆盖', areaHigh:680, areaMid:540, areaLow:860, areaBare:120, trend:'下降' },
                { name:'五号林区', fvc:0.65, level:'中高覆盖', areaHigh:1070, areaMid:450, areaLow:290, areaBare:50, trend:'稳定' }
            ],
            degradedAreas: [],
        },
        fvcResult: {
            success: true,
            data: {
                avgFvc: 0.68,
                totalArea: 12060,
                highCoverArea: 6820,
                midCoverArea: 3450,
                lowCoverArea: 1230,
                bareArea: 560,
                degradedCount: 0,
                areas: [
                    { name:'一号林区', fvc:0.72, level:'中高覆盖', areaHigh:1850, areaMid:920, areaLow:380, areaBare:150 },
                    { name:'二号林区', fvc:0.58, level:'中覆盖', areaHigh:1120, areaMid:860, areaLow:520, areaBare:200 },
                    { name:'三号林区', fvc:0.81, level:'高覆盖', areaHigh:2100, areaMid:680, areaLow:180, areaBare:40 },
                    { name:'四号林区', fvc:0.43, level:'低覆盖', areaHigh:680, areaMid:540, areaLow:860, areaBare:120 },
                    { name:'五号林区', fvc:0.65, level:'中高覆盖', areaHigh:1070, areaMid:450, areaLow:290, areaBare:50 }
                ],
                degradedAreas: []
            }
        },
        abnormalEvents: [
            { id:'AE001', type:'fire', area:'一号林区', desc:'发现明火', level:'high', time:'2026-06-10 14:23', status:'处置中', handler:'张建国' },
            { id:'AE002', type:'pest', area:'二号林区', desc:'松材线虫病感染', level:'high', time:'2026-06-09 10:30', status:'处置中', handler:'王大山' },
            { id:'AE003', type:'fire', area:'三号林区', desc:'烟雾疑似', level:'mid', time:'2026-06-10 15:07', status:'已派发', handler:'刘德才' },
            { id:'AE004', type:'geo', area:'四号林区', desc:'山体裂缝', level:'mid', time:'2026-06-08 09:00', status:'监控中', handler:'陈志强' },
            { id:'AE005', type:'theft', area:'五号林区', desc:'疑似盗伐痕迹', level:'low', time:'2026-06-07 16:20', status:'已处置', handler:'李明辉' }
        ],
        patrolStats: {
            totalPatrols: 24, totalDistance: 136.8, totalDuration: 48.5,
            dailyTrend: [18,22,20,24,26,23,24],
            weeklyTrend: [120,135,128,142,136,130,138],
            areaDistribution: [
                { area:'一号林区', count: 6, distance: 38.2 },
                { area:'二号林区', count: 5, distance: 32.5 },
                { area:'三号林区', count: 5, distance: 28.1 },
                { area:'四号林区', count: 4, distance: 22.0 },
                { area:'五号林区', count: 4, distance: 16.0 }
            ]
        },
        performanceRanking: [
            { rank:1, name:'张建国', id:'HL001', patrols:28, distance:86.5, duration:32.4, score:95.2, area:'一号林区' },
            { rank:2, name:'刘德才', id:'HL005', patrols:25, distance:78.3, duration:29.8, score:91.7, area:'三号林区' },
            { rank:3, name:'李明辉', id:'HL002', patrols:23, distance:72.1, duration:27.5, score:88.4, area:'一号林区' },
            { rank:4, name:'王大山', id:'HL003', patrols:21, distance:65.8, duration:25.2, score:84.1, area:'二号林区' },
            { rank:5, name:'陈志强', id:'HL004', patrols:18, distance:52.4, duration:20.6, score:76.3, area:'二号林区' }
        ],
        droneStats: {
            totalFlights: 42, totalDuration: 126.5, totalDistance: 892.3,
            fleet: [
                { name:'UAV-01', model:'大疆M300', flights:16, duration:48.2, distance:342.1, status:'巡航中' },
                { name:'UAV-02', model:'大疆M300', flights:14, duration:42.5, distance:298.7, status:'巡航中' },
                { name:'UAV-03', model:'大疆M350', flights:12, duration:35.8, distance:251.5, status:'巡航中' }
            ]
        },
        disasterStats: {
            fireCount: 3, pestCount: 7, geoCount: 2, totalAffected: 128.5,
            monthlyTrend: [2,1,3,2,4,3,3,5,2,1,2,3],
            typeDistribution: [
                { type:'森林火灾', count:3, affected:86 },
                { type:'松材线虫病', count:7, affected:32.5 },
                { type:'地质灾害', count:2, affected:10 }
            ]
        },
        usersList: [
            { id:'U001', username:'admin', name:'管理员', role:'admin', status:'在线', lastLogin:'2026-06-10 08:00' },
            { id:'U002', username:'zhangjg', name:'张建国', role:'ranger', status:'在线', lastLogin:'2026-06-10 07:30' },
            { id:'U003', username:'limh', name:'李明辉', role:'ranger', status:'在线', lastLogin:'2026-06-10 07:45' },
            { id:'U004', username:'wangds', name:'王大山', role:'ranger', status:'在线', lastLogin:'2026-06-10 08:15' },
            { id:'U005', username:'chenzq', name:'陈志强', role:'ranger', status:'离线', lastLogin:'2026-06-09 17:30' },
            { id:'U006', username:'liudc', name:'刘德才', role:'ranger', status:'在线', lastLogin:'2026-06-10 07:50' },
            { id:'U007', username:'guest', name:'游客', role:'guest', status:'在线', lastLogin:'2026-06-10 09:00' }
        ],
        roles: [
            { id:'R001', name:'admin', label:'系统管理员', desc:'拥有系统全部权限', userCount:1 },
            { id:'R002', name:'ranger', label:'护林员', desc:'巡护监控与数据上报权限', userCount:5 },
            { id:'R003', name:'guest', label:'游客', desc:'仅查看驾驶舱与统计报表', userCount:1 }
        ],
        permissions: [
            { module:'综合驾驶舱', admin:true, ranger:true, guest:true },
            { module:'巡护监控与管理', admin:true, ranger:true, guest:false },
            { module:'空间数据管理', admin:true, ranger:true, guest:false },
            { module:'灾害识别处置', admin:true, ranger:true, guest:false },
            { module:'统计报表', admin:true, ranger:true, guest:true },
            { module:'系统管理', admin:true, ranger:false, guest:false }
        ],
        dataOps: {
            lastBackup: '2026-06-10 03:00',
            backupSize: '2.3 GB',
            dbStatus: '正常',
            storageUsed: '68.5%',
            recentOps: [
                { time:'2026-06-10 03:00', type:'自动备份', status:'成功', size:'2.3 GB' },
                { time:'2026-06-09 03:00', type:'自动备份', status:'成功', size:'2.2 GB' },
                { time:'2026-06-08 15:30', type:'数据导入', status:'成功', size:'156 MB' },
                { time:'2026-06-08 03:00', type:'自动备份', status:'成功', size:'2.2 GB' },
                { time:'2026-06-07 03:00', type:'自动备份', status:'成功', size:'2.1 GB' }
            ]
        },
        logs: [
            { time:'2026-06-10 09:15', user:'管理员', action:'登录系统', module:'认证', ip:'192.168.1.100' },
            { time:'2026-06-10 09:10', user:'张建国', action:'上报巡护数据', module:'巡护管理', ip:'192.168.1.101' },
            { time:'2026-06-10 08:45', user:'系统', action:'自动备份完成', module:'数据运维', ip:'-' },
            { time:'2026-06-10 08:30', user:'李明辉', action:'查看火情详情', module:'灾害识别', ip:'192.168.1.102' },
            { time:'2026-06-10 08:00', user:'管理员', action:'修改权限配置', module:'系统管理', ip:'192.168.1.100' },
            { time:'2026-06-09 17:30', user:'陈志强', action:'退出系统', module:'认证', ip:'192.168.1.103' },
            { time:'2026-06-09 17:00', user:'王大山', action:'上报异常事件', module:'巡护管理', ip:'192.168.1.104' },
            { time:'2026-06-09 16:30', user:'系统', action:'风险预警触发', module:'风险预警', ip:'-' }
        ],
        systemMonitor: {
            cpu: 32.5, memory: 58.2, disk: 68.5, network: 12.8,
            uptime: '15天 8小时',
            services: [
                { name:'Web服务', status:'运行中', port:80, cpu:8.2, memory:12.5 },
                { name:'数据库', status:'运行中', port:3306, cpu:15.3, memory:25.8 },
                { name:'消息队列', status:'运行中', port:5672, cpu:3.9, memory:9.7 }
            ]
        }
    },

    // ===== 接口方法：以后接入后端时，只需修改这些方法 =====
    async login(username, password) {
        if (this.USE_MOCK) {
            const user = this.mock.users[username];
            if (user && user.password === password) {
                return { success: true, data: { username, role: user.role, name: user.name } };
            }
            return { success: false, data: null };
        }
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    async getForestConfig() {
        if (this.USE_MOCK) return this.mock.forestConfig;
        return this.request('/api/forest/config');
    },

    async getCompartments() {
        if (this.USE_MOCK) return this.mock.compartments;
        return this.request('/api/forest/compartments');
    },

    async getCompartmentColors() {
        if (this.USE_MOCK) return this.mock.compartmentColors;
        return this.request('/api/forest/compartments/colors');
    },

    async getRangers() {
        if (this.USE_MOCK) return this.mock.rangers;
        return this.request('/api/rangers');
    },

    async getRangerTracks(rangerId, start, end) {
        if (this.USE_MOCK) return [];
        let url = `/api/rangers/${rangerId}/tracks`;
        const params = [];
        if (start) params.push(`start=${encodeURIComponent(start)}`);
        if (end) params.push(`end=${encodeURIComponent(end)}`);
        if (params.length) url += '?' + params.join('&');
        return this.request(url);
    },

    async getDrones() {
        if (this.USE_MOCK) return this.mock.drones;
        return this.request('/api/drones');
    },

    async getDroneTracks(droneId, start, end) {
        if (this.USE_MOCK) return [];
        let url = `/api/drones/${droneId}/tracks`;
        const params = [];
        if (start) params.push(`start=${encodeURIComponent(start)}`);
        if (end) params.push(`end=${encodeURIComponent(end)}`);
        if (params.length) url += '?' + params.join('&');
        return this.request(url);
    },

    async getFires() {
        if (this.USE_MOCK) return this.mock.fires;
        return this.request('/api/fires');
    },

    async getPests() {
        if (this.USE_MOCK) return this.mock.pests;
        return this.request('/api/pests');
    },

    async getPatrolRoutes() {
        if (this.USE_MOCK) return this.mock.patrolRoutes;
        return this.request('/api/patrol/routes');
    },

    async getFireRecognition() {
        if (this.USE_MOCK) return this.mock.fireImageData;
        return this.request('/api/recognition/fire');
    },

    async getPestRecognition() {
        if (this.USE_MOCK) return this.mock.pestImageData;
        return this.request('/api/recognition/pest');
    },

    async analyzeImage(imageData) {
        if (this.USE_MOCK) {
            return { success: true, result: '疑似 - 烟雾', confidence: 78.5, level: 'mid' };
        }
        return this.request('/api/recognition/analyze', {
            method: 'POST',
            body: JSON.stringify({ image: imageData })
        });
    },

    async getFirePoint(id) {
        if (this.USE_MOCK) return this.mock.firePointData[id] || null;
        return this.request('/api/fires/' + id);
    },
    async getFirePoints() {
        if (this.USE_MOCK) return this.mock.firePointData;
        return this.request('/api/fires/points');
    },

    // ========== 灾害图片上传 / 派发 / 处理状态 ==========

    async uploadDisaster(formData) {
        // multipart/form-data 上传，不设置 Content-Type（浏览器自动设置 boundary）
        const token = this._getToken();
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(this.BASE_URL + '/api/disasters/upload', {
            method: 'POST', headers, body: formData
        });
        if (!res.ok) throw new Error(`上传失败: ${res.status}`);
        return res.json();
    },

    async dispatchDisaster(dtype, id, handler) {
        return this.request(`/api/disasters/${dtype}/${id}/dispatch`, {
            method: 'POST', body: JSON.stringify({ handler })
        });
    },

    async updateDisasterStatus(dtype, id, status, description) {
        const body = { status };
        if (description !== undefined) body.description = description;
        return this.request(`/api/disasters/${dtype}/${id}/status`, {
            method: 'PUT', body: JSON.stringify(body)
        });
    },

    async syncGeoserver() {
        return this.request('/api/geoserver/sync', { method: 'POST' });
    },

    async getStatsOverview() {
        if (this.USE_MOCK) {
            return {
                patrolCount: 24, onlineRangers: 18, onlineDrones: 6,
                patrolDistance: 136.8, patrolDuration: 48.5, taskCount: 32,
                fireCount: 3, pestCount: 7, abnormalCount: 12, unhandledCount: 5
            };
        }
        return this.request('/api/stats/overview');
    },

    // ===== 风险预警 =====
    async getRiskAssessment(params) {
        if (this.USE_MOCK) return this.mock.riskAssessment;
        return this.request('/api/risk/assessment?' + new URLSearchParams(params));
    },

    // ===== FVC植被覆盖度分析 =====
    async getFvcAnalysis(params) {
        if (this.USE_MOCK) return this.mock.fvcAnalysis;
        return this.request('/api/spatial/fvc?' + new URLSearchParams(params));
    },
    async runFvcAnalysis(params) {
        if (this.USE_MOCK) {
            // 模拟分析延迟
            await new Promise(r => setTimeout(r, 1500));
            return this.mock.fvcResult;
        }
        return this.request('/api/spatial/fvc/analyze', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    },

    // ===== 异常事件 =====
    async getAbnormalEvents(type) {
        if (this.USE_MOCK) return this.mock.abnormalEvents;
        return this.request('/api/abnormal-events' + (type ? '?type=' + type : ''));
    },
    async createAbnormalEvent(data) {
        if (this.USE_MOCK) return { success: true, id: 'E' + Date.now() };
        return this.request('/api/abnormal-events', { method: 'POST', body: JSON.stringify(data) });
    },

    // ===== 统计报表 =====
    async getPatrolStats(period) {
        if (this.USE_MOCK) return this.mock.patrolStats;
        return this.request('/api/stats/patrol?' + new URLSearchParams({ period }));
    },
    async getPerformanceRanking(period) {
        if (this.USE_MOCK) return this.mock.performanceRanking;
        return this.request('/api/stats/performance?' + new URLSearchParams({ period }));
    },
    async getDroneStats(period) {
        if (this.USE_MOCK) return this.mock.droneStats;
        return this.request('/api/stats/drones?' + new URLSearchParams({ period }));
    },
    async getDisasterStats(period) {
        if (this.USE_MOCK) return this.mock.disasterStats;
        return this.request('/api/stats/disaster?' + new URLSearchParams({ period }));
    },
    async exportReport(type, format) {
        if (this.USE_MOCK) return { success: true, url: '#mock-export-' + type + '.' + format };
        return this.request('/api/stats/export', { method: 'POST', body: JSON.stringify({ type, format }) });
    },

    // ===== 用户管理 =====
    async getUsers() {
        if (this.USE_MOCK) return this.mock.usersList;
        return this.request('/api/users');
    },
    async createUser(data) {
        if (this.USE_MOCK) return { success: true, id: 'U' + Date.now() };
        return this.request('/api/users', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateUser(id, data) {
        if (this.USE_MOCK) return { success: true };
        return this.request('/api/users/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteUser(id) {
        if (this.USE_MOCK) return { success: true };
        return this.request('/api/users/' + id, { method: 'DELETE' });
    },

    // ===== 角色管理 =====
    async getRoles() {
        if (this.USE_MOCK) return this.mock.roles;
        return this.request('/api/roles');
    },
    async createRole(data) {
        if (this.USE_MOCK) return { success: true, id: 'R' + Date.now() };
        return this.request('/api/roles', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateRole(id, data) {
        if (this.USE_MOCK) return { success: true };
        return this.request('/api/roles/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteRole(id) {
        if (this.USE_MOCK) return { success: true };
        return this.request('/api/roles/' + id, { method: 'DELETE' });
    },

    // ===== 权限管理 =====
    async getPermissions() {
        if (this.USE_MOCK) return this.mock.permissions;
        return this.request('/api/permissions');
    },
    async updatePermission(roleId, data) {
        if (this.USE_MOCK) return { success: true };
        return this.request('/api/permissions/' + roleId, { method: 'PUT', body: JSON.stringify(data) });
    },

    // ===== 数据运维 =====
    async getDataOps() {
        if (this.USE_MOCK) return this.mock.dataOps;
        return this.request('/api/system/data-ops');
    },
    async backupData(type) {
        if (this.USE_MOCK) return { success: true, id: 'BK' + Date.now() };
        return this.request('/api/system/backup', { method: 'POST', body: JSON.stringify({ type }) });
    },
    async importData(data) {
        if (this.USE_MOCK) return { success: true, id: 'IMP' + Date.now() };
        return this.request('/api/system/import', { method: 'POST', body: JSON.stringify(data) });
    },

    // ===== 日志管理 =====
    async getLogs(params) {
        if (this.USE_MOCK) return this.mock.logs;
        return this.request('/api/system/logs?' + new URLSearchParams(params || {}));
    },

    // ===== 系统监控 =====
    async getSystemMonitor() {
        if (this.USE_MOCK) return this.mock.systemMonitor;
        return this.request('/api/system/monitor');
    }
};

// ==================== 登录与权限控制 ====================
let currentUser = null;

// 检查登录状态
function checkAuth() {
    const saved = localStorage.getItem('fps_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            applyRole();
            hideLogin();
            // 启动实时连接（SSE优先，失败则轮询）
            if (typeof RealtimeService !== 'undefined' && !ApiService.USE_MOCK) {
                setTimeout(() => RealtimeService.connect(), 500);
            }
            // 初始化轨迹回放模块
            if (typeof TrackPlayback !== 'undefined') {
                setTimeout(() => TrackPlayback.init(), 800);
            }
            // 加载 GeoServer 真实图层（边界/小班/等高线/土地利用）
            if (typeof GeoServerLayers !== 'undefined') {
                setTimeout(() => GeoServerLayers.init(), 300);
            }
            // 更新侧栏人员信息 + 台账
            setTimeout(() => { refreshDashboardStats(); refreshPersonnelPanels(); refreshForceLedger(); }, 600);
            // 每10秒刷新侧栏+标记+台账+统计
            setInterval(() => {
                refreshDashboardStats();
                refreshPersonnelPanels();
                refreshForceLedger();
                if (typeof GeoServerLayers !== 'undefined') GeoServerLayers.refreshMarkers();
            }, 10000);
        } catch(e) { localStorage.removeItem('fps_user'); localStorage.removeItem('fps_token'); }
    }
}

function hideLogin() {
    document.getElementById('loginOverlay').classList.add('hidden');
}

function showLogin() {
    document.getElementById('loginOverlay').classList.remove('hidden');
}

async function doLogin(username, password) {
    const result = await ApiService.login(username, password);
    if (result.success) {
        currentUser = result.data;
        localStorage.setItem('fps_user', JSON.stringify(currentUser));
        if (result.token) {
            localStorage.setItem('fps_token', result.token);
        }
        document.getElementById('loginError').textContent = '';
        location.reload();
        return true;
    }
    return false;
}

function doLogout() {
    currentUser = null;
    localStorage.removeItem('fps_user');
    localStorage.removeItem('fps_token');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    showLogin();
}

// 根据角色调整界面
function applyRole() {
    if (!currentUser) return;
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.innerHTML = currentUser.name + ' <a class="logout-link" id="logoutBtn">退出</a>';
        document.getElementById('logoutBtn').addEventListener('click', doLogout);
    }

    if (currentUser.role === 'guest') {
        document.querySelectorAll('.nav-item').forEach(nav => {
            if (nav.dataset.page === 'page-system') {
                nav.style.display = 'none';
            }
        });
        document.body.setAttribute('data-role', 'guest');
    } else {
        document.querySelectorAll('.nav-item').forEach(nav => {
            if (nav.dataset.page === 'page-system') {
                nav.style.display = '';
            }
        });
        document.body.removeAttribute('data-role');
    }
}

// 登录表单提交
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) {
        document.getElementById('loginError').textContent = '请输入用户名和密码';
        return;
    }
    doLogin(username, password).then(success => {
        if (!success) {
            document.getElementById('loginError').textContent = '用户名或密码错误';
        }
    });
});

// 页面加载时检查登录状态
checkAuth();

// ==================== 时间显示 ====================
function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent =
        now.getFullYear() + '年' + String(now.getMonth()+1).padStart(2,'0') + '月' +
        String(now.getDate()).padStart(2,'0') + '日 ' +
        String(now.getHours()).padStart(2,'0') + ':' +
        String(now.getMinutes()).padStart(2,'0') + ':' +
        String(now.getSeconds()).padStart(2,'0');
}
updateTime(); setInterval(updateTime, 1000);

// ==================== 地图管理 ====================
// 地图数据（由 initAppData 加载，供 MapFacade 使用）
let forestCenter, forestBoundary, subCompartments, subColors;
let fireImageData, pestImageData, firePointData;

// 异步加载应用数据（切换后端时自动走API）
async function initAppData() {
    const config = await ApiService.getForestConfig();
    forestCenter = config.center;
    forestBoundary = config.boundary;
    subCompartments = await ApiService.getCompartments();
    subColors = await ApiService.getCompartmentColors();
    fireImageData = await ApiService.getFireRecognition();
    pestImageData = await ApiService.getPestRecognition();
    firePointData = await ApiService.getFirePoints();
    // 缓存供 viewFirePoint 查找
    if (firePointData) {
        window._fireApiCache = window._fireApiCache || {};
        Object.keys(firePointData).forEach(function(k) {
            window._fireApiCache[k] = firePointData[k];
        });
    }
}

// 地图实例由 MapFacade 统一管理（map-facade.js）
// 地图渲染由引擎适配器实现（map-engine-leaflet.js）

// ==================== 导航切换 ====================
const pageInited = {};

// ==================== 侧边导航栏交互 ====================
const sideNav = document.getElementById('sideNav');

// 初始状态：综合驾驶舱隐藏侧边导航栏
hideSideNav();

// 显示/隐藏导航栏函数
function showSideNav() {
    sideNav.classList.add('visible');
    document.querySelectorAll('.content-full-panel').forEach(p => p.classList.add('nav-offset'));
}

function hideSideNav() {
    sideNav.classList.remove('visible');
    document.querySelectorAll('.content-full-panel').forEach(p => p.classList.remove('nav-offset'));
    // 关闭所有三级子菜单
    document.querySelectorAll('.nav-tertiary-sub.open').forEach(sub => sub.classList.remove('open'));
    var fpBar = document.getElementById('firePointsBar');
    if (fpBar) fpBar.style.display = 'none';
}

// 展开/折叠三级导航子菜单
function toggleTertiarySub(secondaryEl, activeInner) {
    const navGroup = secondaryEl.closest('.nav-group');
    if (!navGroup) return;

    // 关闭同组内所有三级子菜单
    navGroup.querySelectorAll('.nav-tertiary-sub').forEach(sub => {
        if (sub.previousElementSibling !== secondaryEl) {
            sub.classList.remove('open');
        }
    });

    // 找到紧跟在当前二级导航后的三级子菜单
    const tertiarySub = secondaryEl.nextElementSibling;
    if (tertiarySub && tertiarySub.classList.contains('nav-tertiary-sub')) {
        if (secondaryEl.classList.contains('has-children')) {
            tertiarySub.classList.toggle('open');
            if (activeInner && tertiarySub.classList.contains('open')) {
                tertiarySub.querySelectorAll('.nav-item-tertiary').forEach(i => {
                    i.classList.toggle('active', i.dataset.inner === activeInner);
                });
            }
        }
    } else {
        navGroup.querySelectorAll('.nav-tertiary-sub.open').forEach(sub => sub.classList.remove('open'));
    }
}

// 展开指定二级导航的三级子菜单（切换模块时用）
function expandTertiarySub(secondaryEl, activeInner) {
    const navGroup = secondaryEl.closest('.nav-group');
    if (!navGroup) return;

    navGroup.querySelectorAll('.nav-tertiary-sub').forEach(sub => sub.classList.remove('open'));

    const tertiarySub = secondaryEl.nextElementSibling;
    if (tertiarySub && tertiarySub.classList.contains('nav-tertiary-sub') && secondaryEl.classList.contains('has-children')) {
        tertiarySub.classList.add('open');
        if (activeInner) {
            tertiarySub.querySelectorAll('.nav-item-tertiary').forEach(i => {
                i.classList.toggle('active', i.dataset.inner === activeInner);
            });
        }
    }
}

// 三级导航点击处理
function handleTertiaryClick(e) {
    e.preventDefault();
    const subId = this.dataset.sub;
    const innerId = this.dataset.inner;

    // 更新三级导航active状态
    const tertiarySub = this.closest('.nav-tertiary-sub');
    if (tertiarySub) {
        tertiarySub.querySelectorAll('.nav-item-tertiary').forEach(i => i.classList.remove('active'));
    }
    this.classList.add('active');

    // 切换子页面和内部tab
    if (subId) {
        document.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
        var subEl = document.getElementById(subId);
        if (subEl) subEl.classList.add('active');
    }
    if (innerId) {
        document.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
        var innerEl = document.getElementById(innerId);
        if (innerEl) innerEl.classList.add('active');
    }

    // 火点列表控制
    var fpBar = document.getElementById('firePointsBar');
    if (fpBar) fpBar.style.display = (innerId === 'inner-fire-analysis') ? '' : 'none';

    // 灾害面板切换
    handleDisasterPanels(innerId);

    setTimeout(() => MapFacade.invalidateSize(), 100);
    setTimeout(layoutFloatTabItems, 150);
}

// 灾害面板切换
function handleDisasterPanels(innerId) {
    var abPanel = document.getElementById('abnormalPanel');
    var disPanel = document.getElementById('disasterPanel');
    var riskPanel = document.getElementById('riskCenterPanel');
    if (innerId === 'inner-abnormal-mgmt') {
        if (abPanel) abPanel.classList.add('show');
        if (disPanel) disPanel.style.display = 'none';
        if (riskPanel) riskPanel.style.display = 'none';
    } else if (innerId === 'inner-risk-warning') {
        if (abPanel) abPanel.classList.remove('show');
        if (disPanel) disPanel.style.display = 'none';
        if (riskPanel) riskPanel.style.display = 'grid';
        if (typeof initRiskCharts === 'function') setTimeout(() => initRiskCharts(), 100);
    } else {
        if (abPanel) abPanel.classList.remove('show');
        if (disPanel) disPanel.style.display = '';
        if (riskPanel) riskPanel.style.display = 'none';
    }
}

// 切换当前模块的导航组显示
function switchNavGroup(pageId) {
    document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('active'));
    const targetGroup = document.querySelector('.nav-group[data-page="' + pageId + '"]');
    if (targetGroup) {
        targetGroup.classList.add('active');
        const firstItem = targetGroup.querySelector('.nav-item-secondary');
        if (firstItem) {
            targetGroup.querySelectorAll('.nav-item-secondary').forEach(i => i.classList.remove('active'));
            firstItem.classList.add('active');
            expandTertiarySub(firstItem, firstItem.dataset.inner);

            // 自动切换到第一个二级导航对应的子页面和内部tab
            const subId = firstItem.dataset.sub;
            const innerId = firstItem.dataset.inner;
            if (subId) {
                document.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
                var subEl = document.getElementById(subId);
                if (subEl) subEl.classList.add('active');
            }
            if (innerId) {
                document.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
                var innerEl = document.getElementById(innerId);
                if (innerEl) innerEl.classList.add('active');
            }

            // 火点列表控制
            var fpBar = document.getElementById('firePointsBar');
            if (fpBar) fpBar.style.display = (innerId === 'inner-fire-analysis') ? '' : 'none';

            // 灾害面板切换
            handleDisasterPanels(innerId);
        }
    }
}

// 二级导航点击处理
document.querySelectorAll('.nav-item-secondary').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const subId = this.dataset.sub;
        const innerId = this.dataset.inner;

        // 更新二级导航active状态
        const navGroup = this.closest('.nav-group');
        if (navGroup) {
            navGroup.querySelectorAll('.nav-item-secondary').forEach(i => i.classList.remove('active'));
        }
        this.classList.add('active');

        // 切换三级导航展开/折叠
        toggleTertiarySub(this, innerId);

        // 确定要显示的页面
        let targetPage = 'page-dashboard';
        if (navGroup) targetPage = navGroup.dataset.page;

        // 切换页面
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        var pageEl = document.getElementById(targetPage);
        if (pageEl) pageEl.classList.add('active');

        // 确保页面已初始化
        if (!pageInited[targetPage]) {
            pageInited[targetPage] = true;
            if (targetPage === 'page-resource') initResourcePage();
            if (targetPage === 'page-spatial') initSpatialPage();
            if (targetPage === 'page-disaster') initDisasterPage();
        }

        // 更新顶部导航状态
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const mainNav = document.querySelector('.nav-item[data-page="' + targetPage + '"]');
        if (mainNav) mainNav.classList.add('active');

        // 切换子页面
        if (subId) {
            document.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
            var subEl = document.getElementById(subId);
            if (subEl) subEl.classList.add('active');
        }

        // 切换内部tab
        if (innerId) {
            document.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
            var innerEl = document.getElementById(innerId);
            if (innerEl) innerEl.classList.add('active');
        }

        // 火点列表控制
        var fpBar = document.getElementById('firePointsBar');
        if (fpBar) fpBar.style.display = (innerId === 'inner-fire-analysis') ? '' : 'none';

        // 灾害面板切换
        handleDisasterPanels(innerId);

        setTimeout(() => MapFacade.invalidateSize(), 100);
        setTimeout(layoutFloatTabItems, 150);
    });
});

// 三级导航点击事件绑定
document.querySelectorAll('.nav-item-tertiary').forEach(item => {
    item.addEventListener('click', handleTertiaryClick);
});

// 顶部导航点击逻辑（替换原有逻辑）
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        // 涟漪动画
        const ripple = document.createElement('span');
        ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(0,213,255,0.25);transform:scale(0);animation:navRipple 0.6s ease-out;pointer-events:none;width:120px;height:120px;left:${e.offsetX-60}px;top:${e.offsetY-60}px;`;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);

        const pageId = this.dataset.page;

        // 更新顶部导航active状态
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        // 切换页面
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        var pageEl = document.getElementById(pageId);
        if (pageEl) pageEl.classList.add('active');

        // 侧边导航栏显隐
        if (pageId === 'page-dashboard') {
            hideSideNav();
        } else {
            showSideNav();
            switchNavGroup(pageId);
            if (pageId !== 'page-spatial') {
                var fpBar = document.getElementById('firePointsBar');
                if (fpBar) fpBar.style.display = 'none';
            }
        }

        positionMapControls(pageId);
        setTimeout(function() { positionMapControls(pageId); }, 100);

        // 确保页面已初始化
        if (!pageInited[pageId]) {
            pageInited[pageId] = true;
            if (pageId === 'page-resource') initResourcePage();
            if (pageId === 'page-spatial') initSpatialPage();
            if (pageId === 'page-disaster') initDisasterPage();
        }

        setTimeout(() => MapFacade.invalidateSize(), 100);
        setTimeout(layoutFloatTabItems, 150);
    });
});

// inner-tab 切换（兼容原有 sub-tab-item 和 float-tab-item）
document.addEventListener('click', function(e) {
    const innerTab = e.target.closest('.sub-tab-item') || e.target.closest('.float-tab-item');
    if (innerTab && innerTab.dataset.inner) {
        const btnGroup = innerTab.closest('.sub-tab-bar');
        if (btnGroup) {
            btnGroup.querySelectorAll('.sub-tab-item').forEach(n => n.classList.remove('active'));
        }
        const mapContainer = innerTab.closest('.map-full-container');
        if (mapContainer) {
            mapContainer.querySelectorAll('.float-tab-item').forEach(n => n.classList.remove('active'));
        }
        innerTab.classList.add('active');
        const pageContainer = innerTab.closest('.sub-page') || innerTab.closest('.content-full-panel') || innerTab.closest('.page');
        if (pageContainer) {
            pageContainer.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
            var innerEl = document.getElementById(innerTab.dataset.inner);
            if (innerEl) innerEl.classList.add('active');
        }
        handleDisasterPanels(innerTab.dataset.inner);
        setTimeout(() => MapFacade.invalidateSize(), 100);
    }

    const floatToggle = e.target.closest('.float-panel-toggle');
    if (floatToggle && floatToggle.dataset.target) {
        const targetPanel = document.getElementById(floatToggle.dataset.target);
        if (targetPanel) {
            targetPanel.classList.toggle('collapsed');
            setTimeout(() => MapFacade.invalidateSize(), 300);
        }
    }
});

// ==================== 页面二：资源与巡护业务地图初始化（实验数据版） ====================
function initResourcePage() {
    var refreshTimer = null;
    var monitorLayers = {}; // { boundary, subcomp, ranger, drone }

    setTimeout(async function () {
        // 创建地图实例
        ['resRealtimeMap', 'resCoverageMap', 'resTaskMap'].forEach(function (id) {
            MapFacade.create(id, { center: forestCenter });
        });

        // API模式下：GeoServerLayers 已处理边界和标记，跳过SHP数据
        if (!ApiService.USE_MOCK) {
            console.log('[PatrolMonitor] API模式：跳过SHP图层，由GeoServerLayers管理');
            return;
        }

        // 等待 SHP 边界 + 初始化工厂
        if (typeof ExperimentalMonitorLayerFactory === 'undefined') return;
        await ExperimentalMonitorLayerFactory.init();

        console.log('[PatrolMonitor] 页面初始化');
        console.log('[DroneMonitor] 页面初始化');

        // 创建图层（每个地图独立实例）
        var boundary = ExperimentalMonitorLayerFactory.createBoundaryLayer();
        var subcomp  = ExperimentalMonitorLayerFactory.createSubcompartmentLayer();
        var ranger   = ExperimentalMonitorLayerFactory.createRangerLayer();
        var drone    = ExperimentalMonitorLayerFactory.createDroneLayer();
        monitorLayers = { boundary: boundary, subcomp: subcomp, ranger: ranger, drone: drone };

        // 获取地图实例
        var rtMap   = MapFacade.getMap('resRealtimeMap');
        var covMap  = MapFacade.getMap('resCoverageMap');
        var taskMap = MapFacade.getMap('resTaskMap');
        console.log('[PatrolMonitor] 地图实例已获取');

        // === 实时巡护监控地图（resRealtimeMap）：边界 + 小班 + ranger + drone ===
        if (rtMap) {
            if (boundary) rtMap.addLayer(boundary);
            if (subcomp) { rtMap.addLayer(subcomp); console.log('[PatrolMonitor] 林业小班图层已加载：' + (subcomp.getLayers ? subcomp.getLayers().length : '?')); }
            if (ranger)  { rtMap.addLayer(ranger);  console.log('[PatrolMonitor] 护林员图层已加载：' + ranger.getLayers().length + ' 个'); }
            if (drone)   { drone._visible = false; } // 默认隐藏无人机
            var allCoords = ExperimentalMonitorLayerFactory.getAllCoords();
            if (allCoords.length > 0) {
                var bounds = L.latLngBounds(allCoords.map(function (c) { return [c[1], c[0]]; }));
                rtMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                console.log('[PatrolMonitor] 已缩放至护林员定位范围');
            }
        }

        // === 覆盖分析 / 任务管理：边界 + 小班 ===
        [covMap, taskMap].forEach(function (m) {
            if (!m) return;
            if (boundary) m.addLayer(boundary);
            if (subcomp)  m.addLayer(subcomp);
        });

        // === 护林员定位 / 无人机监控 Tab 切换 ===
        var rangerTab = document.querySelector('[data-inner="inner-ranger-rt"]');
        var droneTab  = document.querySelector('[data-inner="inner-drone-rt"]');
        if (rangerTab && droneTab && rtMap) {
            rangerTab.addEventListener('click', function () {
                if (ranger && !rtMap.hasLayer(ranger)) rtMap.addLayer(ranger);
                if (drone)  { rtMap.removeLayer(drone); drone._visible = false; }
                console.log('[LayerControl] 切换到护林员定位');
            });
            droneTab.addEventListener('click', function () {
                if (drone && !rtMap.hasLayer(drone)) { rtMap.addLayer(drone); drone._visible = true; }
                if (ranger) rtMap.removeLayer(ranger);
                console.log('[LayerControl] 切换到无人机监控');
            });
        }

        // === 实时刷新（每3秒更新 marker 状态） ===
        function refreshLayers() {
            if (rtMap && ranger && rtMap.hasLayer(ranger)) {
                ranger.eachLayer(function (marker) {
                    var popup = marker.getPopup();
                    if (popup) {
                        var content = popup.getContent();
                        // 随机微调电量
                        var newBatt = Math.floor(Math.random() * 30 + 55) + '%';
                        content = content.replace(/电量[：:]\s*\d+%/, '电量：' + newBatt);
                        popup.setContent(content);
                    }
                });
            }
            if (rtMap && drone && drone._visible && rtMap.hasLayer(drone)) {
                drone.eachLayer(function (marker) {
                    var popup = marker.getPopup();
                    if (popup) {
                        var content = popup.getContent();
                        var newBatt = Math.floor(Math.random() * 40 + 45) + '%';
                        content = content.replace(/电量[：:]\s*\d+%/, '电量：' + newBatt);
                        popup.setContent(content);
                    }
                });
            }
            console.log('[PatrolMonitor] 护林员定位数据刷新：' + (ranger ? ranger.getLayers().length : 0) + ' 个');
            console.log('[DroneMonitor] 无人机监控数据刷新：' + (drone ? drone.getLayers().length : 0) + ' 个');
        }
        refreshTimer = setInterval(refreshLayers, 3000);
        console.log('[PatrolMonitor] 实时刷新已启动');
        console.log('[DroneMonitor] 实时刷新已启动');

        setTimeout(function () { MapFacade.invalidateSize('resRealtimeMap'); }, 400);
    }, 200);

    // 页面切换时清理定时器
    var pageEl = document.getElementById('page-resource');
    if (pageEl) {
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.target.classList && !m.target.classList.contains('active') && refreshTimer) {
                    clearInterval(refreshTimer);
                    refreshTimer = null;
                    console.log('[PatrolMonitor] 实时刷新已停止');
                }
            });
        });
        // 监听导航切换
        document.querySelectorAll('.nav-item[data-page]').forEach(function (nav) {
            nav.addEventListener('click', function () {
                if (this.dataset.page !== 'page-resource' && refreshTimer) {
                    clearInterval(refreshTimer);
                    refreshTimer = null;
                }
            });
        });
    }

    // 分析子页面延迟初始化
    var analysisMapInited = false;
    document.querySelectorAll('#page-resource .sub-nav-item').forEach(function (nav) {
        nav.addEventListener('click', async function () {
            var subId = this.dataset.sub;
            if (subId === 'sub-res-analysis' && !analysisMapInited) {
                setTimeout(async function () {
                    MapFacade.create('resAnalysisMap', { center: forestCenter });
                    await ExperimentalMonitorLayerFactory.init();
                    var b2 = ExperimentalMonitorLayerFactory.createBoundaryLayer();
                    var s2 = ExperimentalMonitorLayerFactory.createSubcompartmentLayer();
                    var map2 = MapFacade.getMap('resAnalysisMap');
                    if (map2 && b2) map2.addLayer(b2);
                    if (map2 && s2) map2.addLayer(s2);
                    analysisMapInited = true;
                }, 300);
            }
            setTimeout(function () { MapFacade.invalidateSize(); }, 350);
        });
    });
}

// ==================== 驾驶舱地图初始化 ====================
initAppData().then(async () => {
    MapFacade.create('dashMap', { center: forestCenter });
    // 地图标记（边界/小班/护林员/无人机/火情/虫害）由 ExperimentalLayerManager 统一管理
    // API数据仅用于侧栏面板信息展示
    positionMapControls('page-dashboard');
});

// ==================== 巡护覆盖分析 ====================
document.addEventListener('click', async function(e) {
    const btn = e.target.closest('#coveragePanel button.btn-primary');
    if (!btn || !btn.textContent.includes('执行分析')) return;

    const select = document.querySelector('#coveragePanel select.select-full');
    const periodText = select?.value || '今日';
    const periodMap = { '今日': 'today', '近7天': '7days', '近30天': '30days' };
    const period = periodMap[periodText] || 'today';

    btn.textContent = '分析中...';
    btn.disabled = true;
    try {
        const result = await ApiService.request('/api/analysis/coverage', {
            method: 'POST',
            body: JSON.stringify({ period: period })
        });
        if (result.success) {
            const d = result.data;
            const panel = document.getElementById('coveragePanel');
            if (panel) {
                const items = panel.querySelectorAll('.result-value');
                if (items[0]) items[0].textContent = d.coverageRate + '%';
                if (items[1]) items[1].textContent = d.blindArea.toLocaleString() + ' 亩';
                if (items[2]) items[2].textContent = d.completeness;

                // 盲区列表
                const blindList = panel.querySelector('.blind-area-list');
                if (blindList) {
                    let html = '<h4>盲区列表</h4>';
                    (d.blindAreas || []).forEach(ba => {
                        html += `<div class="blind-item"><span>${ba.name} (${ba.area}亩)</span><span class="tag tag-${ba.tag==='未覆盖'?'red':'orange'} tag-sm">${ba.tag}</span></div>`;
                    });
                    if (!d.blindAreas || d.blindAreas.length === 0) {
                        html += '<div class="blind-item"><span>暂无盲区</span></div>';
                    }
                    blindList.innerHTML = html;
                }

                // 在地图上显示盲区标记
                if (d.blindAreas && d.blindAreas.length) {
                    clearCoverageBlindMarkers();
                    d.blindAreas.forEach(ba => {
                        if (ba.lat && ba.lng && typeof L !== 'undefined') {
                            const m = L.circleMarker([ba.lat, ba.lng], {
                                radius: 10,
                                color: ba.tag === '未覆盖' ? '#ff3d3d' : '#ff9800',
                                fillOpacity: 0.3,
                                weight: 2,
                            }).addTo(MapFacade.getMap('resCoverageMap')).bindTooltip(ba.name + ': ' + ba.area + '亩');
                            coverageBlindMarkers.push(m);
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('覆盖分析失败:', err);
    }
    btn.textContent = '执行分析';
    btn.disabled = false;
});

let coverageBlindMarkers = [];
function clearCoverageBlindMarkers() {
    coverageBlindMarkers.forEach(m => {
        const map = MapFacade.getMap('resCoverageMap');
        if (map) map.removeLayer(m);
    });
    coverageBlindMarkers = [];
}

// ==================== 驾驶舱 - 实时警告筛选 ====================
function filterWarnings() {
    var typeFilter = document.getElementById('warningTypeFilter');
    var timeFilter = document.getElementById('warningTimeFilter');
    if (!typeFilter || !timeFilter) return;
    var typeVal = typeFilter.value;
    var timeVal = timeFilter.value;
    var items = document.querySelectorAll('.warning-item');
    items.forEach(function(item) {
        var show = true;
        if (typeVal !== '全部类型' && item.dataset.type !== typeVal) show = false;
        if (timeVal !== '全部时间' && item.dataset.time) {
            var t = parseInt(item.dataset.time.split(':')[0]);
            if (timeVal === '最近1小时' && t < 14) show = false;
            else if (timeVal === '最近3小时' && t < 12) show = false;
            else if (timeVal === '最近6小时' && t < 9) show = false;
        }
        item.style.display = show ? '' : 'none';
    });
}
var wtf = document.getElementById('warningTypeFilter');
var wttf = document.getElementById('warningTimeFilter');
if (wtf) wtf.addEventListener('change', filterWarnings);
if (wttf) wttf.addEventListener('change', filterWarnings);

// ==================== 图层管理 - 底图切换 ====================
var basemapEl = document.getElementById('basemapSelect');
var currentBasemap = null;
if (basemapEl) {
    basemapEl.addEventListener('change', switchBasemap);
    // 页面加载时自动切换一次（替换引擎默认底图）
    setTimeout(function() { basemapEl.dispatchEvent(new Event('change')); }, 300);
}
function switchBasemap() {
    var val = document.getElementById('basemapSelect').value;
    var mapIds = Object.keys(MapFacade._instances || {});
    mapIds.forEach(function(id) {
        var map = MapFacade._instances[id];
        if (!map) return;
        if (map._customBasemap) map.removeLayer(map._customBasemap);
        var url, opts = { maxZoom: 19 };
        if (val === 'OpenStreetMap') {
            url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        } else if (val === '高德影像') {
            url = 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}';
            opts.subdomains = '1234';
        }
        if (url) {
            map._customBasemap = L.tileLayer(url, opts).addTo(map);
        }
    });
}

// ==================== 恢复初始状态 ====================
function resetToInitialState() {
    // 1. 切回综合驾驶舱页面
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    var dashNav = document.querySelector('.nav-item[data-page="page-dashboard"]');
    if (dashNav) dashNav.classList.add('active');
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var dashPage = document.getElementById('page-dashboard');
    if (dashPage) dashPage.classList.add('active');

    // 2. 恢复底图为高德影像
    var bmSel = document.getElementById('basemapSelect');
    if (bmSel) { bmSel.value = '高德影像'; switchBasemap(); }

    // 3. 恢复图层管理checkbox默认状态
    var defaults = { forestBoundary: true, subCompartments: true, rangers: true, drones: true, patrolRoutes: true, fires: true, diseases: true };
    Object.keys(defaults).forEach(function(k) {
        var cb = document.querySelector('#businessLayerGroup input[data-layer="' + k + '"]');
        if (cb && cb.checked !== defaults[k]) { cb.checked = defaults[k]; cb.dispatchEvent(new Event('change')); }
    });
    // DEM/NDVI 默认关闭
    var demCb = document.querySelector('#rasterLayerGroup input[data-layer="dem"]');
    if (demCb && demCb.checked) { demCb.checked = false; demCb.dispatchEvent(new Event('change')); }

    // 4. 重新加载GeoServer图层
    if (typeof GeoServerLayers !== 'undefined') {
        GeoServerLayers._loaded = false;
        GeoServerLayers.init().catch(function(){});
    }

    // 5. 重置巡护模块状态 + 清除所有路径缓存
    if (typeof Patrol !== 'undefined' && Patrol.state) {
        var pmap = Patrol._getActiveMap ? Patrol._getActiveMap() : null;
        // 清除历史轨迹查询残留
        if (typeof Patrol._clearQueryTrack === 'function') Patrol._clearQueryTrack();
        if (Patrol._qTrackLine && pmap) pmap.removeLayer(Patrol._qTrackLine);
        if (Patrol._qTrackMarks && pmap) pmap.removeLayer(Patrol._qTrackMarks);
        Patrol._qTrackLine = null;
        Patrol._qTrackMarks = null;
        // 清除轨迹缓冲
        Patrol.state._trackBuffer = [];
        Patrol.state._trackFlushTimer = 0;
        // 清除实时轨迹线
        Object.keys(Patrol.state.realtimeTrackLines || {}).forEach(function(k) {
            if (pmap && Patrol.state.realtimeTrackLines[k].line) {
                pmap.removeLayer(Patrol.state.realtimeTrackLines[k].line);
            }
        });
        Patrol.state.realtimeTrackLines = {};
        // 清除路线预览线
        if (Patrol.state._routeDrawing && Patrol.state._routeDrawing.polyline && pmap) {
            pmap.removeLayer(Patrol.state._routeDrawing.polyline);
        }
        Patrol.state._routeDrawing = null;
        // 清除覆盖分析图层
        (Patrol.state._coverageLayers || []).forEach(function(layer) {
            if (pmap) try { pmap.removeLayer(layer); } catch(e) {}
        });
        Patrol.state._coverageLayers = [];
        // 清除回放标记
        if (Patrol.state._playMarker && pmap) pmap.removeLayer(Patrol.state._playMarker);
        Patrol.state._playMarker = null;
        Patrol.state._playCoords = null;
        Patrol.state._isPlaying = false;
        // 清除动画进度和路径
        Patrol.state._animProgress = {};
        Patrol.state.simPaths = {};
        // 重新生成路径并启动
        if (typeof Patrol._generateSimPaths === 'function') Patrol._generateSimPaths();
        if (typeof Patrol._startSimOnMap === 'function') setTimeout(function(){ Patrol._startSimOnMap(); }, 500);
    }

    // 6. 刷新仪表盘统计
    if (typeof refreshDashboardStats === 'function') refreshDashboardStats();

    // 7. 刷新灾害列表
    if (typeof DisasterPanel !== 'undefined') {
        if (DisasterPanel.refreshFireList) DisasterPanel.refreshFireList();
        if (DisasterPanel.refreshPestList) DisasterPanel.refreshPestList();
    }

    // 8. 地图视角回到白云山中心
    var map = (typeof MapFacade !== 'undefined') ? MapFacade.getMap('dashMap') : null;
    if (map) map.setView([28.530, 119.910], 14, { animate: true });

    console.log('[Reset] 页面已恢复初始状态');
}

// ==================== 驾驶舱侧边栏（左右独立） ====================
// 动态计算图层管理侧边栏位置，使其左边缘与按钮右边缘对齐，上边缘与按钮上边缘对齐
function positionLayerSidebar() {
    const btn = document.getElementById('layerToggle');
    const sidebar = document.getElementById('layerSidebar');
    if (!btn || !sidebar) return;
    const btnRect = btn.getBoundingClientRect();
    sidebar.style.left = btnRect.right + 'px';
    sidebar.style.top = btnRect.top + 'px';
}

// 动态调整图例和地图控件位置
function positionMapControls(pageId) {
    var controls = document.getElementById('mapControlsLeft');
    var legend = document.getElementById('experimental-legend');
    var sidebarNav = document.querySelector('.half-pentagon-sidebar');
    var dashLeftPanel = document.getElementById('dashLeftPanel');
    if (!controls) return;

    var legendTop, controlsTop;
    var gap = 39; // 图例与控件之间的距离

    if (pageId === 'page-dashboard') {
        // 图例与巡护态势总览面板顶部对齐
        if (dashLeftPanel) {
            var panelRect = dashLeftPanel.getBoundingClientRect();
            legendTop = panelRect.top + 'px';
            // 获取图例的实际高度来计算控件位置
            if (legend) {
                var legendRect = legend.getBoundingClientRect();
                controlsTop = (legendRect.bottom + gap) + 'px';
            } else {
                controlsTop = (panelRect.top + 150 + gap) + 'px';
            }
        } else {
            legendTop = '74px';
            controlsTop = '324px';
        }
    } else {
        // 图例与侧边导航栏顶部齐平
        if (sidebarNav) {
            var sidebarRect = sidebarNav.getBoundingClientRect();
            legendTop = sidebarRect.top + 'px';
            // 获取图例的实际高度来计算控件位置
            if (legend) {
                var legendRect = legend.getBoundingClientRect();
                controlsTop = (legendRect.bottom + gap) + 'px';
            } else {
                controlsTop = (sidebarRect.top + 150 + gap) + 'px';
            }
        } else {
            legendTop = '64px';
            controlsTop = '314px';
        }
    }

    if (legend) legend.style.top = legendTop;
    controls.style.top = controlsTop;
}

// 左侧边栏 - 图层管理
document.getElementById('layerToggle').addEventListener('click', function() {
    const sidebar = document.getElementById('layerSidebar');
    const isOpen = sidebar.classList.toggle('open');
    this.classList.toggle('active', isOpen);
    if (isOpen) {
        positionLayerSidebar();
    } else {
        sidebar.style.left = '';
    }
    setTimeout(() => MapFacade.invalidateSize('dashMap'), 350);
});
document.getElementById('layerClose').addEventListener('click', function() {
    const sidebar = document.getElementById('layerSidebar');
    sidebar.classList.remove('open');
    sidebar.style.left = '';
    sidebar.style.top = '';
    document.getElementById('layerToggle').classList.remove('active');
    setTimeout(() => MapFacade.invalidateSize('dashMap'), 350);
});

// 窗口尺寸变化时重新定位侧边栏
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('layerSidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        positionLayerSidebar();
    }
});

// 地图缩放控件
document.getElementById('mapZoomIn').addEventListener('click', function() {
    MapFacade.zoomIn('dashMap');
});
document.getElementById('mapZoomOut').addEventListener('click', function() {
    MapFacade.zoomOut('dashMap');
});

// ==================== 图例定位 ====================
function positionLegend() {
    const legend = document.getElementById('mapLegend');
    const ctrl = document.getElementById('mapControlsLeft');
    if (!legend || !ctrl) return;
    const legendRect = legend.getBoundingClientRect();
    ctrl.style.top = (legendRect.bottom + 8) + 'px';
    ctrl.style.left = legendRect.left + 'px';
}

// 初始定位和窗口resize时重新定位
setTimeout(positionLegend, 500);
window.addEventListener('resize', positionLegend);

// ==================== 全局滚轮缩放地图 ====================
document.addEventListener('wheel', function(e) {
    // 如果目标在可滚动的面板内且面板确实可滚动，则不拦截
    var scrollable = e.target.closest('.float-panel, .panel-card, .sidebar-content, .nav-secondary-col, .content-full-panel, .half-pentagon-sidebar');
    if (scrollable) {
        var hasScroll = scrollable.scrollHeight > scrollable.clientHeight;
        if (hasScroll) return;
    }
    // 否则转发给地图
    e.preventDefault();
    if (e.deltaY < 0) {
        MapFacade.zoomIn('dashMap');
    } else if (e.deltaY > 0) {
        MapFacade.zoomOut('dashMap');
    }
}, { passive: false });

// ==================== 图层透明度滑块实时调节 ====================
document.getElementById('layerSidebar').addEventListener('input', function(e) {
    if (e.target.classList.contains('layer-opacity')) {
        var opacity = parseInt(e.target.value, 10) / 100;
        var layerItem = e.target.closest('.layer-item');
        var checkbox = layerItem ? layerItem.querySelector('input[type="checkbox"]') : null;
        var label = layerItem ? layerItem.querySelector('.layer-label') : null;
        var layerName = label ? label.textContent.trim() : '';
        // 更新滑块轨道填充色
        var pct = e.target.value + '%';
        e.target.style.background = 'linear-gradient(to right, rgba(0,213,255,0.8) ' + pct + ', rgba(0,213,255,0.2) ' + pct + ')';
        // 如果对应图层已加载到地图上，实时更新透明度
        var map = MapFacade.getMap('dashMap');
        if (map && layerName) {
            map.eachLayer(function(layer) {
                if (layer.options && layer.options._layerName === layerName) {
                    if (typeof layer.setStyle === 'function') {
                        layer.setStyle({ fillOpacity: opacity * 0.3, opacity: opacity });
                    } else if (typeof layer.setOpacity === 'function') {
                        layer.setOpacity(opacity);
                    }
                }
            });
        }
    }
});

// 初始化滑块轨道填充色
function initSliderFill() {
    document.querySelectorAll('.layer-opacity').forEach(function(slider) {
        var pct = slider.value + '%';
        slider.style.background = 'linear-gradient(to right, rgba(0,213,255,0.8) ' + pct + ', rgba(0,213,255,0.2) ' + pct + ')';
    });
}
initSliderFill();

// ==================== 悬浮面板保持展开（禁用折叠） ====================

// ==================== 悬浮导航按钮布局计算 ====================
function layoutFloatTabItems() {
    document.querySelectorAll('.map-full-container').forEach(container => {
        const items = container.querySelectorAll(':scope > .float-tab-item');
        if (items.length === 0) return;
        const containerWidth = container.offsetWidth;
        if (containerWidth === 0) return;
        const gap = 16;
        items.forEach(item => { item.style.left = '0px'; item.style.transform = 'none'; });
        let totalWidth = 0;
        const widths = [];
        items.forEach(item => {
            const w = item.offsetWidth;
            widths.push(w);
            totalWidth += w;
        });
        totalWidth += gap * (items.length - 1);
        let startX = (containerWidth - totalWidth) / 2;
        items.forEach((item, i) => {
            item.style.left = startX + 'px';
            item.style.transform = 'none';
            startX += widths[i] + gap;
        });
    });
}
layoutFloatTabItems();
window.addEventListener('resize', layoutFloatTabItems);

// ==================== 页面三：空间数据管理 ====================
function initSpatialPage() {
    document.getElementById('page-spatial').innerHTML = `
    <div class="sub-tab-bar">
        <a class="sub-tab-item active" data-inner="inner-fire-analysis">火情分析</a>
        <a class="sub-tab-item" data-inner="inner-ndvi">NDVI分析</a>
        <a class="sub-tab-item" data-inner="inner-fvc">FVC植被覆盖度</a>
    </div>
    <div class="map-full-container">
        <div id="monSpatialMap"></div>
        <div class="float-panel" id="spatialPanel">
            <div class="inner-tab active" id="inner-fire-analysis">
                <div class="panel-card"><div class="card-header"><h3>火情分析</h3></div><div class="card-body">
                    <div class="form-group"><label>数据源</label><select class="select-full" id="fireDataSource"><option>Sentinel-2 卫星影像</option><option>Landsat-8 卫星影像</option><option>GF-1 卫星影像</option><option>无人机多光谱</option><option>气象卫星数据</option></select></div>
                    <div class="form-group"><label>分析区域</label><select class="select-full" id="fireAreaFilter"><option>全部林区</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>
                    <div class="form-row"><div class="form-group half"><label>起始日期</label><input type="date" id="fireStartDate" value="2026-01-01"/></div><div class="form-group half"><label>结束日期</label><input type="date" id="fireEndDate" value="2026-06-28"/></div></div>
                    <div class="form-group"><label>风向风速</label><div class="form-row"><div class="form-group half"><select class="select-full"><option>东北风</option><option>北风</option><option>东风</option><option>东南风</option><option>南风</option><option>西南风</option><option>西风</option><option>西北风</option></select></div><div class="form-group half"><select class="select-full"><option>1级 (0.3-1.5m/s)</option><option>2级 (1.6-3.3m/s)</option><option>3级 (3.4-5.4m/s)</option><option>4级 (5.5-7.9m/s)</option><option>5级 (8.0-10.7m/s)</option><option>6级 (10.8-13.8m/s)</option></select></div></div></div>
                    <div class="analysis-result" style="margin-top:14px;">
                        <div class="result-item"><span class="result-label">火点数量</span><span class="result-value red" id="fireAnalysisCount">加载中...</span></div>
                        <div class="result-item"><span class="result-label">预估面积</span><span class="result-value red" id="fireAnalysisArea">- 亩</span></div>
                        <div class="result-item"><span class="result-label">风险等级</span><span class="result-value orange" id="fireAnalysisRisk">-</span></div>
                        <div class="result-item"><span class="result-label">最高温度</span><span class="result-value orange" id="fireAnalysisTemp">- ℃</span></div>
                    </div>
                </div></div>
            </div>
            <div class="inner-tab" id="inner-ndvi">
                <div class="panel-card"><div class="card-header"><h3>NDVI分析</h3></div><div class="card-body">
                    <div class="form-group"><label>数据源（年份）</label><select class="select-full" id="ndviDataSource" onchange="updateSpatialDates('ndvi', this.value)"><option value="NDVI2">NDVI 2021年</option><option value="NDVI_1">NDVI 2022年</option></select></div>
                    <div class="form-group"><label>分析区域</label><select class="select-full" id="ndviArea"><option>全部林区</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>
                    <div class="form-row"><div class="form-group half"><label>起始日期</label><input type="date" id="ndviStartDate" value="2021-01-01"/></div><div class="form-group half"><label>结束日期</label><input type="date" id="ndviEndDate" value="2021-12-31"/></div></div>
                    <div class="form-group"><label>分辨率</label><select class="select-full" id="ndviResolution"><option>10m</option><option>20m</option><option>30m</option></select></div>
                    <div class="form-group"><label>分类阈值设置</label>
                        <div class="fvc-threshold-group">
                            <div class="threshold-item"><span class="threshold-label">高植被</span><input type="range" value="0.70" min="0" max="1" step="0.01" id="ndviHigh" oninput="document.getElementById('ndviHighVal').textContent=parseFloat(this.value).toFixed(2)"/><span id="ndviHighVal" style="font-size:11px;min-width:30px;">0.70</span></div>
                            <div class="threshold-item"><span class="threshold-label">中植被</span><input type="range" value="0.40" min="0" max="1" step="0.01" id="ndviMid" oninput="document.getElementById('ndviMidVal').textContent=parseFloat(this.value).toFixed(2)"/><span id="ndviMidVal" style="font-size:11px;min-width:30px;">0.40</span></div>
                            <div class="threshold-item"><span class="threshold-label">低植被</span><input type="range" value="0.15" min="0" max="1" step="0.01" id="ndviLow" oninput="document.getElementById('ndviLowVal').textContent=parseFloat(this.value).toFixed(2)"/><span id="ndviLowVal" style="font-size:11px;min-width:30px;">0.15</span></div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block" onclick="runNdviAnalysis()">执行NDVI分析</button>
                    <div id="ndviResultPanel" class="analysis-result" style="margin-top:14px;display:none;">
                        <div class="result-item"><span class="result-label">平均NDVI</span><span class="result-value green" id="ndviAvgValue">0.72</span></div>
                        <div class="result-item"><span class="result-label">高植被面积</span><span class="result-value green" id="ndviHighArea">7,520 亩</span></div>
                        <div class="result-item"><span class="result-label">中植被面积</span><span class="result-value blue" id="ndviMidArea">3,280 亩</span></div>
                        <div class="result-item"><span class="result-label">低植被面积</span><span class="result-value orange" id="ndviLowArea">1,450 亩</span></div>
                        <div class="result-item"><span class="result-label">裸地面积</span><span class="result-value red" id="ndviBareArea">810 亩</span></div>
                        <div class="result-item"><span class="result-label">退化区域</span><span class="result-value red" id="ndviDegraded">4 处</span></div>
                    </div>
                    <div id="ndviDetailList" class="blind-area-list" style="margin-top:10px;display:none;">
                        <h4>植被覆盖分级详情</h4>
                        <div class="fvc-legend-bar">
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#1a9641;"></div><span>高植被 (≥0.70)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#a6d96a;"></div><span>中高植被 (0.55-0.70)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#ffffbf;"></div><span>中植被 (0.40-0.55)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#fdae61;"></div><span>低植被 (0.15-0.40)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#d7191c;"></div><span>裸地 (<0.15)</span></div>
                        </div>
                        <div class="blind-item"><span>一号林区 NDVI=0.75</span><span class="tag tag-green tag-sm">高植被</span></div>
                        <div class="blind-item"><span>二号林区 NDVI=0.58</span><span class="tag tag-green tag-sm">中高植被</span></div>
                        <div class="blind-item"><span>三号林区 NDVI=0.82</span><span class="tag tag-green tag-sm">高植被</span></div>
                        <div class="blind-item"><span>四号林区 NDVI=0.46</span><span class="tag tag-orange tag-sm">中植被</span></div>
                        <div class="blind-item"><span>五号林区 NDVI=0.63</span><span class="tag tag-green tag-sm">中高植被</span></div>
                    </div>
                    <div id="ndviChartArea" style="margin-top:14px;display:none;">
                        <h4 style="font-size:12px;color:#8ba4bc;margin-bottom:8px;">各林区NDVI对比</h4>
                        <div class="fvc-bar-chart">
                            <div class="fvc-bar-row"><span class="fvc-bar-label">一号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:75%;background:linear-gradient(90deg,#1a9641,#006837);"></div></div><span class="fvc-bar-val">0.75</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">二号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:58%;background:linear-gradient(90deg,#a6d96a,#1a9641);"></div></div><span class="fvc-bar-val">0.58</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">三号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:82%;background:linear-gradient(90deg,#1a9641,#006837);"></div></div><span class="fvc-bar-val">0.82</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">四号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:46%;background:linear-gradient(90deg,#ffffbf,#a6d96a);"></div></div><span class="fvc-bar-val">0.46</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">五号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:63%;background:linear-gradient(90deg,#a6d96a,#1a9641);"></div></div><span class="fvc-bar-val">0.63</span></div>
                        </div>
                    </div>
                </div></div>
            </div>
            <div class="inner-tab" id="inner-fvc">
                <div class="panel-card"><div class="card-header"><h3>FVC植被覆盖度分析</h3></div><div class="card-body">
                    <div class="form-group"><label>数据源（年份）</label><select class="select-full" id="fvcDataSource" onchange="updateSpatialDates('fvc', this.value)"><option value="fvc_2" selected>FVC 2021年</option><option value="fvc_1">FVC 2022年</option></select></div>
                    <div class="form-group"><label>分析区域</label><select class="select-full" id="fvcArea"><option>全部林区</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>
                    <div class="form-row"><div class="form-group half"><label>起始日期</label><input type="date" id="fvcStartDate" value="2021-01-01"/></div><div class="form-group half"><label>结束日期</label><input type="date" id="fvcEndDate" value="2021-12-31"/></div></div>
                    <div class="form-group"><label>分辨率</label><select class="select-full" id="fvcResolution"><option>10m</option><option>20m</option><option>30m</option></select></div>
                    <div class="form-group"><label>分类阈值设置</label>
                        <div class="fvc-threshold-group">
                            <div class="threshold-item"><span class="threshold-label">高覆盖</span><input type="range" value="0.75" min="0" max="1" step="0.01" id="fvcHigh" oninput="document.getElementById('fvcHighVal').textContent=parseFloat(this.value).toFixed(2)"/><span id="fvcHighVal" style="font-size:11px;min-width:30px;">0.75</span></div>
                            <div class="threshold-item"><span class="threshold-label">中覆盖</span><input type="range" value="0.45" min="0" max="1" step="0.01" id="fvcMid" oninput="document.getElementById('fvcMidVal').textContent=parseFloat(this.value).toFixed(2)"/><span id="fvcMidVal" style="font-size:11px;min-width:30px;">0.45</span></div>
                            <div class="threshold-item"><span class="threshold-label">低覆盖</span><input type="range" value="0.15" min="0" max="1" step="0.01" id="fvcLow" oninput="document.getElementById('fvcLowVal').textContent=parseFloat(this.value).toFixed(2)"/><span id="fvcLowVal" style="font-size:11px;min-width:30px;">0.15</span></div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block" onclick="runFvcAnalysis()">执行FVC分析</button>
                    <div id="fvcResultPanel" class="analysis-result" style="margin-top:14px;display:none;">
                        <div class="result-item"><span class="result-label">平均FVC</span><span class="result-value green" id="fvcAvgValue">0.68</span></div>
                        <div class="result-item"><span class="result-label">高覆盖面积</span><span class="result-value green" id="fvcHighArea">6,820 亩</span></div>
                        <div class="result-item"><span class="result-label">中覆盖面积</span><span class="result-value blue" id="fvcMidArea">3,450 亩</span></div>
                        <div class="result-item"><span class="result-label">低覆盖面积</span><span class="result-value orange" id="fvcLowArea">1,230 亩</span></div>
                        <div class="result-item"><span class="result-label">裸地面积</span><span class="result-value red" id="fvcBareArea">560 亩</span></div>
                        <div class="result-item"><span class="result-label">退化区域</span><span class="result-value red" id="fvcDegraded">3 处</span></div>
                    </div>
                    <div id="fvcDetailList" class="blind-area-list" style="margin-top:10px;display:none;">
                        <h4>覆盖度分级详情</h4>
                        <div class="fvc-legend-bar">
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#1a9641;"></div><span>高覆盖 (≥0.75)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#a6d96a;"></div><span>中高覆盖 (0.60-0.75)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#ffffbf;"></div><span>中覆盖 (0.45-0.60)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#fdae61;"></div><span>低覆盖 (0.15-0.45)</span></div>
                            <div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#d7191c;"></div><span>裸地 (<0.15)</span></div>
                        </div>
                        <div class="blind-item"><span>一号林区 FVC=0.72</span><span class="tag tag-green tag-sm">中高覆盖</span></div>
                        <div class="blind-item"><span>二号林区 FVC=0.58</span><span class="tag tag-orange tag-sm">中覆盖</span></div>
                        <div class="blind-item"><span>三号林区 FVC=0.81</span><span class="tag tag-green tag-sm">高覆盖</span></div>
                        <div class="blind-item"><span>四号林区 FVC=0.43</span><span class="tag tag-orange tag-sm">低覆盖</span></div>
                        <div class="blind-item"><span>五号林区 FVC=0.65</span><span class="tag tag-green tag-sm">中高覆盖</span></div>
                    </div>
                    <div id="fvcChartArea" style="margin-top:14px;display:none;">
                        <h4 style="font-size:12px;color:#8899aa;margin-bottom:8px;">各林区FVC对比</h4>
                        <div class="fvc-bar-chart">
                            <div class="fvc-bar-row"><span class="fvc-bar-label">一号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:72%;background:linear-gradient(90deg,#a6d96a,#1a9641);"></div></div><span class="fvc-bar-val">0.72</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">二号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:58%;background:linear-gradient(90deg,#ffffbf,#a6d96a);"></div></div><span class="fvc-bar-val">0.58</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">三号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:81%;background:linear-gradient(90deg,#1a9641,#006837);"></div></div><span class="fvc-bar-val">0.81</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">四号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:43%;background:linear-gradient(90deg,#fdae61,#ffffbf);"></div></div><span class="fvc-bar-val">0.43</span></div>
                            <div class="fvc-bar-row"><span class="fvc-bar-label">五号林区</span><div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:65%;background:linear-gradient(90deg,#a6d96a,#1a9641);"></div></div><span class="fvc-bar-val">0.65</span></div>
                        </div>
                    </div>
                </div></div>
            </div>
        </div>
        <button class="float-panel-toggle" data-target="spatialPanel">◀</button>
    </div>`;
    setTimeout(async () => {
        MapFacade.create('monSpatialMap', { center: forestCenter });
        MapFacade.invalidateSize();
        layoutFloatTabItems();

        // 火情分析 - 区域筛选 + 实时数据
        refreshFireAnalysisList();
        var fireAreaEl = document.getElementById('fireAreaFilter');
        if (fireAreaEl) {
            fireAreaEl.addEventListener('change', function() {
                var area = this.value;
                var resultItems = document.querySelectorAll('#inner-fire-analysis .result-item');
                var fps = window._fireApiCache || {};
                var fires = Object.values(fps);
                var filtered = area === '全部林区' ? fires : fires.filter(function(f) {
                    return (f.area || '').indexOf(area) !== -1;
                });
                var totalMu = filtered.reduce(function(s, f) { return s + (f.areaMu || 0); }, 0);
                if (resultItems[0]) resultItems[0].querySelector('.result-value').textContent = filtered.length + ' 处';
                if (resultItems[1]) resultItems[1].querySelector('.result-value').textContent = totalMu + ' 亩';
                // 筛选火点列表
                document.querySelectorAll('.fire-point-item').forEach(function(item) {
                    var name = item.querySelector('.fp-name');
                    if (area === '全部林区') { item.style.display = ''; }
                    else { item.style.display = (name && name.textContent.includes(area.replace('林区',''))) ? '' : 'none'; }
                });
            });
        }
    }, 300);
}

function initDisasterPage() {
    document.getElementById('page-disaster').innerHTML = `
    <div class="sub-tab-bar">
        <a class="sub-tab-item active" data-inner="inner-fire-identify">火情识别</a>
        <a class="sub-tab-item" data-inner="inner-pest-identify">疫情识别</a>
        <a class="sub-tab-item" data-inner="inner-abnormal-mgmt">异常事件</a>
        <a class="sub-tab-item" data-inner="inner-risk-warning">综合风险预警</a>
    </div>
    <div class="float-panel" id="disasterPanel">
        <div class="inner-tab active" id="inner-fire-identify">
            <div class="disaster-toolbar" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="DisasterPanel.openUpload('fire')">＋ 上报火情</button>
                <button class="btn btn-sm btn-outline" onclick="DisasterPanel.syncGeoserver()">刷新</button>
                <span id="fireCountInfo" style="color:#8ba4bc;font-size:12px;line-height:26px;margin-left:auto;">加载中...</span>
            </div>
            <div id="fireDisasterList" class="disaster-list"></div>
        </div>
        <div class="inner-tab" id="inner-pest-identify">
            <div class="disaster-toolbar" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="DisasterPanel.openUpload('pest')">＋ 上报疫情</button>
                <button class="btn btn-sm btn-outline" onclick="DisasterPanel.syncGeoserver()">刷新</button>
                <span id="pestCountInfo" style="color:#8ba4bc;font-size:12px;line-height:26px;margin-left:auto;">加载中...</span>
            </div>
            <div id="pestDisasterList" class="disaster-list"></div>
        </div>
        <div class="inner-tab" id="inner-abnormal-mgmt"></div>
        <div class="inner-tab" id="inner-risk-warning"></div>
        <button class="float-panel-toggle" data-target="disasterPanel">◀</button>
    </div>
    <div class="risk-center-panel" id="riskCenterPanel">
        <div class="risk-left">
            <div class="risk-config">
                <h4>评估配置</h4>
                <div class="form-group"><label>评估区域</label><select class="select-full" id="riskAreaFilter"><option>全部林区</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>
                <div class="form-group"><label>灾害类型</label><select class="select-full" id="riskTypeFilter"><option>综合评估</option><option>森林火灾</option><option>林业有害生物</option><option>气象灾害</option><option>地质灾害</option></select></div>
                <div class="form-row"><div class="form-group half"><label>起始日期</label><input type="date" value="2026-06-01"/></div><div class="form-group half"><label>结束日期</label><input type="date" value="2026-06-27"/></div></div>
                <button class="btn btn-primary btn-block" onclick="runRiskAssessment()">执行评估</button>
            </div>
            <div class="risk-heatmap">
                <h4>风险热力图</h4>
                <div id="riskHeatmapChart" class="risk-chart"></div>
            </div>
        </div>
        <div class="risk-right">
            <div class="risk-overview">
                <h4>风险等级概览</h4>
                <div class="risk-stats">
                    <div class="risk-stat-card"><span class="stat-num">2</span><span class="stat-label">极高风险</span></div>
                    <div class="risk-stat-card"><span class="stat-num">3</span><span class="stat-label">高风险</span></div>
                    <div class="risk-stat-card"><span class="stat-num">5</span><span class="stat-label">中风险</span></div>
                    <div class="risk-stat-card"><span class="stat-num">8</span><span class="stat-label">低风险</span></div>
                </div>
                <div id="riskBarChart" class="risk-chart"></div>
            </div>
            <div class="risk-events">
                <h4>风险事件列表</h4>
                <div class="risk-event-list">
                    <div class="risk-event-item"><span class="re-dot high"></span><span class="re-title">RW001 森林火灾</span><span class="re-area">三号林区</span><span class="re-score high">91%</span></div>
                    <div class="risk-event-item"><span class="re-dot high"></span><span class="re-title">RW002 森林火灾</span><span class="re-area">一号林区</span><span class="re-score high">82%</span></div>
                    <div class="risk-event-item"><span class="re-dot mid"></span><span class="re-title">RW003 林业有害生物</span><span class="re-area">二号林区</span><span class="re-score mid">67%</span></div>
                    <div class="risk-event-item"><span class="re-dot mid"></span><span class="re-title">RW004 气象灾害</span><span class="re-area">一号林区</span><span class="re-score mid">63%</span></div>
                    <div class="risk-event-item"><span class="re-dot low"></span><span class="re-title">RW005 地质灾害</span><span class="re-area">四号林区</span><span class="re-score low">54%</span></div>
                </div>
            </div>
        </div>
    </div>
    <div class="abnormal-panel" id="abnormalPanel">
        <div class="abnormal-header">
            <h3>异常事件</h3>
            <div class="abnormal-filter">
                <select class="select-full" id="abnormalTypeFilter" style="width:110px;" onchange="filterAbnormalItems(this.value)">
                    <option value="全部类型">全部类型</option>
                    <option value="盗伐">盗伐</option>
                    <option value="非法占地">非法占地</option>
                    <option value="垃圾倾倒">垃圾倾倒</option>
                    <option value="违规用火">违规用火</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="reportAbnormal()">上报事件</button>
            </div>
        </div>
        <div class="abnormal-body">
            <div class="abnormal-item" data-type="违规用火"><span class="ab-col ab-col-dot"><span class="ab-dot high"></span></span><span class="ab-col ab-col-name">E001 · 违规用火</span><span class="ab-col ab-col-forest">一号林区</span><span class="ab-col ab-col-desc">发现可疑火源，疑似违规野外用火</span><span class="ab-col ab-col-coord">N28.52° E119.91°</span><span class="ab-col ab-col-status"><span class="tag tag-orange tag-sm">处理中</span></span><span class="ab-col ab-col-action"><button class="btn btn-sm btn-outline" onclick="viewAbnormal('E001')">查看</button></span></div>
            <div class="abnormal-item" data-type="盗伐"><span class="ab-col ab-col-dot"><span class="ab-dot mid"></span></span><span class="ab-col ab-col-name">E002 · 盗伐</span><span class="ab-col ab-col-forest">四号林区</span><span class="ab-col ab-col-desc">监测到树木异常减少，疑似盗伐行为</span><span class="ab-col ab-col-coord">N28.51° E119.94°</span><span class="ab-col ab-col-status"><span class="tag tag-blue tag-sm">已派发</span></span><span class="ab-col ab-col-action"><button class="btn btn-sm btn-outline" onclick="viewAbnormal('E002')">查看</button></span></div>
            <div class="abnormal-item" data-type="垃圾倾倒"><span class="ab-col ab-col-dot"><span class="ab-dot low"></span></span><span class="ab-col ab-col-name">E003 · 垃圾倾倒</span><span class="ab-col ab-col-forest">二号林区</span><span class="ab-col ab-col-desc">发现废弃塑料垃圾堆积</span><span class="ab-col ab-col-coord">N28.53° E119.89°</span><span class="ab-col ab-col-status"><span class="tag tag-green tag-sm">已处理</span></span><span class="ab-col ab-col-action"><button class="btn btn-sm btn-outline" onclick="viewAbnormal('E003')">查看</button></span></div>
        </div>
    </div>`;

    setTimeout(function() {
        if (typeof MapFacade !== 'undefined') { var dm = MapFacade.getMap('dashMap'); if (dm) dm.invalidateSize(); }

        // 自动同步GeoServer
        ApiService.syncGeoserver().catch(function(){});

        // 异常事件类型筛选（由 onchange 内联调用 filterAbnormalItems）

        // 火情/疫情列表初始化（从 DB 加载，联动地图）
        if (typeof DisasterPanel !== 'undefined') {
            DisasterPanel.refreshFireList();
            DisasterPanel.refreshPestList();
        }

        // 综合风险预警 - 区域+类型筛选
        var riskAreaEl = document.getElementById('riskAreaFilter');
        var riskTypeEl = document.getElementById('riskTypeFilter');
        function filterRiskEvents() {
            var areaVal = riskAreaEl ? riskAreaEl.value : '全部林区';
            var typeVal = riskTypeEl ? riskTypeEl.value : '综合评估';
            var items = document.querySelectorAll('.risk-event-item');
            items.forEach(function(item) {
                var show = true;
                if (areaVal !== '全部林区') {
                    var area = item.querySelector('.re-area');
                    if (area && !area.textContent.includes(areaVal.replace('林区',''))) show = false;
                }
                if (typeVal !== '综合评估') {
                    var title = item.querySelector('.re-title');
                    if (title && !title.textContent.includes(typeVal)) show = false;
                }
                item.style.display = show ? '' : 'none';
            });
            var statCards = document.querySelectorAll('.risk-stat-card .stat-num');
            var counts = {'综合评估': [2,3,5,8], '森林火灾': [2,1,2,1], '林业有害生物': [0,1,2,3], '气象灾害': [0,1,1,2], '地质灾害': [0,0,1,3]};
            var c = counts[typeVal] || [2,3,5,8];
            statCards.forEach(function(card, i) { if (c[i] !== undefined) card.textContent = c[i]; });
        }
        if (riskAreaEl) riskAreaEl.addEventListener('change', filterRiskEvents);
        if (riskTypeEl) riskTypeEl.addEventListener('change', filterRiskEvents);
    }, 300);
}

// ==================== 图像识别筛选函数 ====================
// 火情识别筛选函数
function filterFireImages() {
    var sourceFilter = document.getElementById('fireSourceFilter').value;
    var statusFilter = document.getElementById('fireStatusFilter').value;

    if (!fireImageData) return;

    var filtered = fireImageData.filter(function(img) {
        // 图像来源筛选
        var sourceMatch = true;
        if (sourceFilter !== '全部') {
            if (sourceFilter === '无人机拍摄') {
                sourceMatch = img.source.includes('无人机');
            } else if (sourceFilter === '人工拍摄') {
                sourceMatch = img.source.includes('护林员');
            }
        }

        // 状态筛选
        var statusMatch = true;
        if (statusFilter !== '全部') {
            statusMatch = img.level === statusFilter || img.result.includes(statusFilter);
        }

        return sourceMatch && statusMatch;
    });

    // 重置当前页并渲染筛选后的数据
    fireCurrentPage = 1;
    var totalPages = Math.ceil(filtered.length / PER_PAGE);
    renderGallery('fireGallery', filtered, fireCurrentPage, generateFireSVG);
    document.getElementById('firePageInfo').textContent = '第 ' + fireCurrentPage + ' / ' + totalPages + ' 页';

    // 更新翻页按钮状态
    window.filteredFireData = filtered;
}

// 疫情识别筛选函数
function filterPestImages() {
    var sourceFilter = document.getElementById('pestSourceFilter').value;
    var statusFilter = document.getElementById('pestStatusFilter').value;

    if (!pestImageData) return;

    var filtered = pestImageData.filter(function(img) {
        // 图像来源筛选
        var sourceMatch = true;
        if (sourceFilter !== '全部') {
            if (sourceFilter === '无人机拍摄') {
                sourceMatch = img.source.includes('无人机');
            } else if (sourceFilter === '人工拍摄') {
                sourceMatch = img.source.includes('护林员');
            }
        }

        // 状态筛选
        var statusMatch = true;
        if (statusFilter !== '全部') {
            statusMatch = img.level === statusFilter || img.result.includes(statusFilter);
        }

        return sourceMatch && statusMatch;
    });

    // 重置当前页并渲染筛选后的数据
    pestCurrentPage = 1;
    var totalPages = Math.ceil(filtered.length / PER_PAGE);
    renderGallery('pestGallery', filtered, pestCurrentPage, generatePestSVG);
    document.getElementById('pestPageInfo').textContent = '第 ' + pestCurrentPage + ' / ' + totalPages + ' 页';

    // 更新翻页按钮状态
    window.filteredPestData = filtered;
}

// ==================== 图像识别交互函数 ====================
// fireImageData, pestImageData 已在 initAppData() 中异步加载

function generateFireSVG(type, idx) {
    const uid = 'fs' + idx;
    const confidences = [92.3, 87.5, 78.1, 95.6, 83.2, 71.4, 96.8, 79.3, 88.9, 74.5, 91.7, 85.3, 77.8, 93.1, 82.6, 90.4];
    const conf = confidences[idx % confidences.length];
    const barW = Math.round(conf * 0.4);
    const barColor = conf >= 90 ? '#ff3d3d' : conf >= 80 ? '#ff9800' : '#4fc3f7';

    if (type === 'fire') {
        const cx = 60 + (idx * 17) % 80;
        const bx = cx - 30, by = 60, bw = 60, bh = 55;
        return `<svg viewBox="0 0 200 140" style="width:100%;display:block;background:#1a1a2e;"><defs><radialGradient id="${uid}" cx="${cx}%" cy="75%" r="38%"><stop offset="0%" stop-color="#ffeb3b"/><stop offset="25%" stop-color="#ff6e40"/><stop offset="65%" stop-color="#ff3d3d"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><rect width="200" height="140" fill="#1a1a2e"/><polygon points="0,140 ${20+idx*3},90 ${50+idx*2},115 ${80+idx},70 ${110+idx*2},100 ${140+idx},60 ${170+idx*2},95 200,80 200,140" fill="#0d3d0d" opacity="0.8"/><ellipse cx="${cx}" cy="100" rx="55" ry="32" fill="url(#${uid})"/><ellipse cx="${cx-15}" cy="90" rx="12" ry="22" fill="#ffab40" opacity="0.8"/><ellipse cx="${cx+10}" cy="88" rx="10" ry="18" fill="#ff6e40" opacity="0.9"/><ellipse cx="${cx-5}" cy="82" rx="7" ry="13" fill="#ffeb3b" opacity="0.7"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#ff3d3d" stroke-width="1.5" stroke-dasharray="4,2" rx="2"/><circle cx="${bx}" cy="${by}" r="3" fill="#ff3d3d"/><text x="${bx+4}" y="${by-4}" fill="#ff3d3d" font-size="8" font-weight="bold">明火 ${conf}%</text><line x1="${cx}" y1="${by+bh}" x2="${cx}" y2="${by+bh+10}" stroke="#ff3d3d" stroke-width="0.8"/><line x1="${cx-8}" y1="${by+bh+10}" x2="${cx+8}" y2="${by+bh+10}" stroke="#ff3d3d" stroke-width="0.8"/><text x="${cx-8}" y="${by+bh+18}" fill="#ffab40" font-size="6">火源中心</text><rect x="2" y="2" width="50" height="16" rx="2" fill="rgba(0,0,0,0.6)"/><rect x="4" y="6" width="${barW}" height="3" rx="1" fill="${barColor}"/><rect x="4" y="11" width="${Math.round((conf-10)*0.4)}" height="3" rx="1" fill="${barColor}" opacity="0.5"/><text x="56" y="13" fill="#e0e6ed" font-size="7">AI ${conf}%</text></svg>`;
    } else if (type === 'smoke') {
        const sx = 85 + (idx * 7) % 30;
        return `<svg viewBox="0 0 200 140" style="width:100%;display:block;background:#1a1a2e;"><rect width="200" height="140" fill="#1a2a1a"/><polygon points="0,140 25,95 55,115 85,80 115,105 145,70 175,95 200,85 200,140" fill="#1a4d1a" opacity="0.8"/><ellipse cx="100" cy="90" rx="35" ry="18" fill="#888" opacity="0.3"/><ellipse cx="95" cy="85" rx="25" ry="12" fill="#999" opacity="0.2"/><ellipse cx="105" cy="80" rx="18" ry="8" fill="#aaa" opacity="0.15"/><rect x="${sx-20}" y="68" width="50" height="35" fill="none" stroke="#ff9800" stroke-width="1.5" stroke-dasharray="4,2" rx="2"/><circle cx="${sx-20}" cy="68" r="3" fill="#ff9800"/><text x="${sx-16}" y="64" fill="#ff9800" font-size="8" font-weight="bold">烟雾 ${conf}%</text><line x1="${sx+5}" y1="68" x2="${sx+5}" y2="58" stroke="#ff9800" stroke-width="0.8"/><text x="${sx-5}" y="55" fill="#ffab40" font-size="6">烟雾扩散区</text><rect x="2" y="2" width="50" height="16" rx="2" fill="rgba(0,0,0,0.6)"/><rect x="4" y="6" width="${barW}" height="3" rx="1" fill="${barColor}"/><rect x="4" y="11" width="${Math.round((conf-10)*0.4)}" height="3" rx="1" fill="${barColor}" opacity="0.5"/><text x="56" y="13" fill="#e0e6ed" font-size="7">AI ${conf}%</text></svg>`;
    } else {
        return `<svg viewBox="0 0 200 140" style="width:100%;display:block;background:#1a1a2e;"><rect width="200" height="140" fill="#1a2a1a"/><polygon points="0,140 20,100 50,115 80,85 110,105 140,75 170,100 200,88 200,140" fill="#1a5d1a" opacity="0.8"/><rect x="60" y="55" width="70" height="50" fill="none" stroke="#4fc3f7" stroke-width="1" stroke-dasharray="4,2" rx="2"/><circle cx="60" cy="55" r="2.5" fill="#4fc3f7"/><text x="64" y="52" fill="#4fc3f7" font-size="7">巡护区域</text><rect x="2" y="2" width="50" height="16" rx="2" fill="rgba(0,0,0,0.6)"/><rect x="4" y="6" width="${barW}" height="3" rx="1" fill="#4fc3f7"/><rect x="4" y="11" width="${Math.round((conf-10)*0.4)}" height="3" rx="1" fill="#4fc3f7" opacity="0.5"/><text x="56" y="13" fill="#e0e6ed" font-size="7">AI ${conf}%</text></svg>`;
    }
}

function generatePestSVG(type, idx) {
    const uid = 'ps' + idx;
    const confidences = [89.7, 94.2, 76.3, 91.8, 85.6, 73.9, 93.4, 80.1, 88.5, 75.2, 90.6, 84.3, 77.9, 92.5, 81.7, 87.1];
    const conf = confidences[idx % confidences.length];
    const barW = Math.round(conf * 0.4);
    const barColor = conf >= 90 ? '#ff3d3d' : conf >= 80 ? '#ff9800' : '#4fc3f7';

    if (type === 'dead') {
        const tx = 80 + (idx * 13) % 40;
        return `<svg viewBox="0 0 200 140" style="width:100%;display:block;background:#1a1a2e;"><rect width="200" height="140" fill="#1a2a1a"/><polygon points="0,140 30,60 50,70 70,40 90,55 110,35 130,50 150,30 170,55 200,45 200,140" fill="#2d5d1a" opacity="0.6"/><polygon points="${tx-20},140 ${tx-10},55 ${tx},65 ${tx+5},40 ${tx+15},55 ${tx+25},35 ${tx+35},50 ${tx+45},140" fill="#8d6e2d" opacity="0.9"/><rect x="${tx+5}" y="58" width="3" height="82" fill="#5d4037"/><circle cx="${tx-5}" cy="45" r="12" fill="#6d4c2d" opacity="0.8"/><circle cx="${tx+15}" cy="38" r="10" fill="#7d5c3d" opacity="0.7"/><circle cx="${tx+5}" cy="50" r="8" fill="#5d3c1d" opacity="0.6"/><rect x="${tx-22}" y="28" width="55" height="55" fill="none" stroke="#ff3d3d" stroke-width="1.5" stroke-dasharray="4,2" rx="2"/><circle cx="${tx-22}" cy="28" r="3" fill="#ff3d3d"/><text x="${tx-18}" y="24" fill="#ff3d3d" font-size="7" font-weight="bold">枯死 ${conf}%</text><line x1="${tx+5}" y1="28" x2="${tx+5}" y2="18" stroke="#ff3d3d" stroke-width="0.8"/><text x="${tx-5}" y="15" fill="#ffab40" font-size="5.5">松材线虫病</text><rect x="2" y="2" width="50" height="16" rx="2" fill="rgba(0,0,0,0.6)"/><rect x="4" y="6" width="${barW}" height="3" rx="1" fill="${barColor}"/><rect x="4" y="11" width="${Math.round((conf-10)*0.4)}" height="3" rx="1" fill="${barColor}" opacity="0.5"/><text x="56" y="13" fill="#e0e6ed" font-size="7">AI ${conf}%</text></svg>`;
    } else if (type === 'sick') {
        const tx = 85 + (idx * 11) % 30;
        return `<svg viewBox="0 0 200 140" style="width:100%;display:block;background:#1a1a2e;"><rect width="200" height="140" fill="#1a2a1a"/><polygon points="0,140 30,65 55,75 75,50 95,60 115,45 135,55 155,40 175,60 200,50 200,140" fill="#2d6d2a" opacity="0.7"/><polygon points="${tx-10},140 ${tx},55 ${tx+10},65 ${tx+15},50 ${tx+20},60 ${tx+25},45 ${tx+30},55 ${tx+35},140" fill="#4d7d2a" opacity="0.7"/><rect x="${tx+15}" y="58" width="2" height="82" fill="#5d4037"/><circle cx="${tx+8}" cy="50" r="10" fill="#5d8d2a" opacity="0.6"/><circle cx="${tx+22}" cy="46" r="8" fill="#6d9d3a" opacity="0.5"/><rect x="${tx-8}" y="35" width="45" height="40" fill="none" stroke="#ff9800" stroke-width="1.5" stroke-dasharray="4,2" rx="2"/><circle cx="${tx-8}" cy="35" r="3" fill="#ff9800"/><text x="${tx-4}" y="32" fill="#ff9800" font-size="7" font-weight="bold">变色 ${conf}%</text><line x1="${tx+15}" y1="35" x2="${tx+15}" y2="25" stroke="#ff9800" stroke-width="0.8"/><text x="${tx+5}" y="22" fill="#ffab40" font-size="5.5">疑似感染</text><rect x="2" y="2" width="50" height="16" rx="2" fill="rgba(0,0,0,0.6)"/><rect x="4" y="6" width="${barW}" height="3" rx="1" fill="${barColor}"/><rect x="4" y="11" width="${Math.round((conf-10)*0.4)}" height="3" rx="1" fill="${barColor}" opacity="0.5"/><text x="56" y="13" fill="#e0e6ed" font-size="7">AI ${conf}%</text></svg>`;
    } else {
        return `<svg viewBox="0 0 200 140" style="width:100%;display:block;background:#1a1a2e;"><rect width="200" height="140" fill="#1a2a1a"/><polygon points="0,140 20,70 45,80 65,55 85,68 105,50 125,62 145,45 165,65 200,55 200,140" fill="#1d6d1d" opacity="0.8"/><rect x="55" y="50" width="70" height="45" fill="none" stroke="#4fc3f7" stroke-width="1" stroke-dasharray="4,2" rx="2"/><circle cx="55" cy="50" r="2.5" fill="#4fc3f7"/><text x="59" y="47" fill="#4fc3f7" font-size="7">巡护区域</text><rect x="2" y="2" width="50" height="16" rx="2" fill="rgba(0,0,0,0.6)"/><rect x="4" y="6" width="${barW}" height="3" rx="1" fill="#4fc3f7"/><rect x="4" y="11" width="${Math.round((conf-10)*0.4)}" height="3" rx="1" fill="#4fc3f7" opacity="0.5"/><text x="56" y="13" fill="#e0e6ed" font-size="7">AI ${conf}%</text></svg>`;
    }
}

const PER_PAGE = 10;
let fireCurrentPage = 1;
let pestCurrentPage = 1;

function renderGallery(galleryId, data, page, svgGenerator) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    const totalPages = Math.ceil(data.length / PER_PAGE);
    const start = (page - 1) * PER_PAGE;
    const pageData = data.slice(start, start + PER_PAGE);
    gallery.innerHTML = pageData.map((item, i) => {
        const isHigh = item.level === 'high';
        const isMid = item.level === 'mid';
        const borderStyle = isHigh ? 'border:2px solid #ff3d3d;' : 'border:1px solid #2a3a4a;';
        const tagBg = isHigh ? 'rgba(255,61,61,0.9)' : isMid ? 'rgba(255,152,0,0.9)' : 'rgba(0,230,118,0.9)';
        const tagText = isHigh ? '高危' : isMid ? '疑似' : '正常';
        const svg = svgGenerator(item.svgType, start + i);
        return `<div class="identify-card${isHigh ? ' high-risk' : ''}" onclick="showImageInfo(this)" data-lat="${item.lat}" data-lng="${item.lng}" data-source="${item.source}" data-time="${item.time}" data-result="${item.result}" style="position:relative;border-radius:8px;overflow:hidden;${borderStyle}cursor:pointer;">
            ${svg}
            <div style="position:absolute;top:6px;left:6px;background:${tagBg};color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;">${tagText}</div>
            <div style="padding:6px 8px;background:#1a2332;"><div style="font-size:11px;color:#e0e6ed;">${item.label}</div><div style="font-size:10px;color:#8899aa;">${item.source.split('·')[0]} · ${item.time}</div></div>
        </div>`;
    }).join('');
    return totalPages;
}

function switchFirePage(dir) {
    const totalPages = Math.ceil(fireImageData.length / PER_PAGE);
    if (dir === 'next' && fireCurrentPage < totalPages) fireCurrentPage++;
    else if (dir === 'prev' && fireCurrentPage > 1) fireCurrentPage--;
    const tp = renderGallery('fireGallery', fireImageData, fireCurrentPage, generateFireSVG);
    const info = document.getElementById('firePageInfo');
    if (info) info.textContent = `第 ${fireCurrentPage} / ${tp} 页`;
}

function switchPestPage(dir) {
    const totalPages = Math.ceil(pestImageData.length / PER_PAGE);
    if (dir === 'next' && pestCurrentPage < totalPages) pestCurrentPage++;
    else if (dir === 'prev' && pestCurrentPage > 1) pestCurrentPage--;
    const tp = renderGallery('pestGallery', pestImageData, pestCurrentPage, generatePestSVG);
    const info = document.getElementById('pestPageInfo');
    if (info) info.textContent = `第 ${pestCurrentPage} / ${tp} 页`;
}

// 初始化画廊
setTimeout(() => {
    const ftp = renderGallery('fireGallery', fireImageData, 1, generateFireSVG);
    const fInfo = document.getElementById('firePageInfo');
    if (fInfo) fInfo.textContent = `第 1 / ${ftp} 页`;
    const ptp = renderGallery('pestGallery', pestImageData, 1, generatePestSVG);
    const pInfo = document.getElementById('pestPageInfo');
    if (pInfo) pInfo.textContent = `第 1 / ${ptp} 页`;

    // 综合风险预警 - 区域+类型筛选
    var riskAreaEl = document.getElementById('riskAreaFilter');
    var riskTypeEl = document.getElementById('riskTypeFilter');
    function filterRiskEvents() {
        var areaVal = riskAreaEl ? riskAreaEl.value : '全部林区';
        var typeVal = riskTypeEl ? riskTypeEl.value : '综合评估';
        var items = document.querySelectorAll('.risk-event-item');
        items.forEach(function(item) {
            var show = true;
            if (areaVal !== '全部林区') {
                var area = item.querySelector('.re-area');
                if (area && !area.textContent.includes(areaVal.replace('林区',''))) show = false;
            }
            if (typeVal !== '综合评估') {
                var title = item.querySelector('.re-title');
                if (title && !title.textContent.includes(typeVal)) show = false;
            }
            item.style.display = show ? '' : 'none';
        });
        var statCards = document.querySelectorAll('.risk-stat-card .stat-num');
        var counts = {'综合评估': [2,3,5,8], '森林火灾': [2,1,2,1], '林业有害生物': [0,1,2,3], '气象灾害': [0,1,1,2], '地质灾害': [0,0,1,3]};
        var c = counts[typeVal] || [2,3,5,8];
        statCards.forEach(function(card, i) { if (c[i] !== undefined) card.textContent = c[i]; });
    }
    if (riskAreaEl) riskAreaEl.addEventListener('change', filterRiskEvents);
    if (riskTypeEl) riskTypeEl.addEventListener('change', filterRiskEvents);
}, 300);

// ==================== 图像点击交互 ====================
function showImageInfo(el) {
    const lat = el.dataset.lat;
    const lng = el.dataset.lng;
    const source = el.dataset.source;
    const time = el.dataset.time;
    const result = el.dataset.result;
    const isHighRisk = el.classList.contains('high-risk');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `<div style="background:#1a2332;border:1px solid #2a3a4a;border-radius:10px;width:520px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <div style="padding:16px 20px;border-bottom:1px solid #2a3a4a;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;color:#fff;font-size:16px;">图像详情</h3>
            <button onclick="this.closest('div[style]').parentElement.remove()" style="background:none;border:none;color:#8899aa;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:16px 20px;">
            <div style="margin-bottom:12px;">${el.querySelector('svg').outerHTML.replace('style="width:100%;"', 'style="width:100%;border-radius:6px;border:1px solid #2a3a4a;"')}</div>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <span style="background:${isHighRisk ? 'rgba(255,61,61,0.9)' : 'rgba(0,230,118,0.9)'};color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">${result}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">
                <div><span style="color:#8899aa;">纬度：</span><span style="color:#4fc3f7;">${lat}</span></div>
                <div><span style="color:#8899aa;">经度：</span><span style="color:#4fc3f7;">${lng}</span></div>
                <div><span style="color:#8899aa;">来源：</span><span style="color:#e0e6ed;">${source}</span></div>
                <div><span style="color:#8899aa;">时间：</span><span style="color:#e0e6ed;">${time}</span></div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;">
                <button onclick="this.closest('div[style]').parentElement.parentElement.remove()" style="flex:1;padding:8px;background:#4fc3f7;color:#0a1929;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">定位到地图</button>
                <button onclick="this.closest('div[style]').parentElement.parentElement.remove()" style="flex:1;padding:8px;background:#2a3a4a;color:#e0e6ed;border:1px solid #3a4a5a;border-radius:6px;font-size:13px;cursor:pointer;">关闭</button>
            </div>
        </div>
    </div>`;
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

async function refreshFireAnalysisList() {
    try {
        var points = await ApiService.getFirePoints();
        if (!points) return;
        var fpBar = document.getElementById('firePointsBar');
        if (!fpBar) return;
        var fires = Object.values(points);
        fires.sort(function(a, b) { return (b.reportedAt || '').localeCompare(a.reportedAt || ''); });
        var levelMap = { '高': 'high', '中': 'mid', '低': 'low' };
        var html = '';
        fires.forEach(function(f) {
            var lvl = levelMap[f.riskLevel] || 'mid';
            var area = f.area || guessFireArea(f.lat, f.lng);
            var time = (f.reportedAt || '').slice(-5);
            html += '<div class=\"fire-point-item ' + lvl + '\"><span class=\"fp-dot-name\"><span class=\"fp-dot\"></span><span class=\"fp-name\">' + f.id + ' ' + area + '</span></span>';
            html += '<span class=\"fp-risk\">风险等级：' + (f.riskLevel || '中') + '</span>';
            html += '<span class=\"tag tag-' + (lvl === 'high' ? 'red' : lvl === 'mid' ? 'orange' : 'blue') + ' tag-sm\">' + (f.status || '监测中') + '</span>';
            html += '<span class=\"fp-time\">' + time + '</span>';
            html += '<button class=\"btn btn-sm btn-outline\" style=\"font-size:10px;padding:1px 6px;\" data-fid=\"' + f.id + '\" onclick=\"viewFirePoint(this.dataset.fid)\">查看</button></div>';
        });
        fpBar.innerHTML = html || '<div style=\"color:#8ba4bc;font-size:12px;padding:10px;text-align:center;\">暂无火情数据</div>';
        fpBar.style.display = 'flex';
    } catch(e) { console.warn('refreshFireAnalysisList:', e.message); }
}

function guessFireArea(lat, lng) {
    // 精确定位：先匹配已知火点，再按林区边界判断
    if (Math.abs(lat - 28.515) < 0.01 && Math.abs(lng - 119.905) < 0.01) return '一号林区';  // F001
    if (Math.abs(lat - 28.495) < 0.01 && Math.abs(lng - 119.935) < 0.01) return '三号林区';  // F002
    if (Math.abs(lat - 28.545) < 0.01 && Math.abs(lng - 119.880) < 0.01) return '四号林区';  // F003
    if (Math.abs(lat - 28.500) < 0.01 && Math.abs(lng - 119.941) < 0.01) return '三号林区';  // F004
    // 通用判断
    if (lng < 119.896 && lat < 28.534) return '四号林区';
    if (lng > 119.924) return lat > 28.526 ? '二号林区' : '三号林区';
    if (lat < 28.514) return '五号林区';
    if (lat > 28.551) return '二号林区';
    return '一号林区';
}

function runRiskAssessment() {
    var btn = event.target;
    btn.textContent = '评估中...';
    btn.disabled = true;

    // 读取筛选条件
    var areaEl = document.getElementById('riskAreaFilter');
    var typeEl = document.getElementById('riskTypeFilter');
    var area = areaEl ? areaEl.value : '全部林区';
    var type = typeEl ? typeEl.value : '综合评估';
    var dateStart = document.querySelector('#riskCenterPanel input[type=\"date\"]:nth-of-type(1)');
    var dateEnd   = document.querySelector('#riskCenterPanel input[type=\"date\"]:nth-of-type(2)');
    var start = dateStart ? dateStart.value : '2026-06-01';
    var end   = dateEnd   ? dateEnd.value   : '2026-06-27';

    // 基于真实灾情的风险评分数据（按林区 × 灾害类型）
    // 风险值：综合火情/虫害/异常事件的存在和严重程度
    var allScores = {
        '森林火灾':   { '一号林区':72, '二号林区':35, '三号林区':91, '四号林区':82, '五号林区':28 },
        '林业有害生物': { '一号林区':85, '二号林区':67, '三号林区':78, '四号林区':94, '五号林区':42 },
        '气象灾害':   { '一号林区':48, '二号林区':38, '三号林区':55, '四号林区':45, '五号林区':22 },
        '地质灾害':   { '一号林区':32, '二号林区':28, '三号林区':40, '四号林区':54, '五号林区':18 },
    };

    // 综合评分 = 所有类型取最高
    var areas = ['一号林区','二号林区','三号林区','四号林区','五号林区'];
    var compositeScores = areas.map(function(a) {
        return Math.max(allScores['森林火灾'][a], allScores['林业有害生物'][a],
                        allScores['气象灾害'][a], allScores['地质灾害'][a]);
    });

    // 按筛选条件过滤
    var barData, heatData = [];
    if (type === '综合评估') {
        barData = compositeScores;
        var types = ['森林火灾','林业有害生物','气象灾害','地质灾害'];
        // 确定要展示的林区列表
        var filteredAreas = area === '全部林区' ? areas : [area];
        types.forEach(function(t, ti) {
            filteredAreas.forEach(function(a, ai) {
                var score = allScores[t][a];
                heatData.push([ai, ti, score]);
            });
        });
    } else {
        barData = areas.map(function(a) { return allScores[type] ? allScores[type][a] : 0; });
        if (area === '全部林区') {
            areas.forEach(function(a, ai) { heatData.push([ai, 0, allScores[type][a]]); });
        } else {
            heatData.push([0, 0, allScores[type][area] || 0]);
        }
    }

    // 统计卡片
    var riskLevels = { ultra:0, high:0, mid:0, low:0 };
    barData.forEach(function(s) {
        if (s >= 85) riskLevels.ultra++;
        else if (s >= 70) riskLevels.high++;
        else if (s >= 40) riskLevels.mid++;
        else riskLevels.low++;
    });

    // 生成风险事件列表（按风险指数从高到低排序）
    var rawEvents = [
        { type:'森林火灾', area:'三号林区', score:91 },
        { type:'林业有害生物', area:'四号林区', score:94 },
        { type:'森林火灾', area:'一号林区', score:82 },
        { type:'林业有害生物', area:'二号林区', score:67 },
        { type:'森林火灾', area:'四号林区', score:72 },
        { type:'气象灾害', area:'三号林区', score:55 },
        { type:'地质灾害', area:'四号林区', score:54 },
        { type:'林业有害生物', area:'一号林区', score:85 },
        { type:'林业有害生物', area:'三号林区', score:78 },
        { type:'气象灾害', area:'一号林区', score:48 },
        { type:'地质灾害', area:'五号林区', score:40 },
        { type:'森林火灾', area:'五号林区', score:28 },
        { type:'气象灾害', area:'四号林区', score:45 },
        { type:'地质灾害', area:'二号林区', score:28 },
        { type:'地质灾害', area:'一号林区', score:32 },
        { type:'气象灾害', area:'五号林区', score:22 },
        { type:'林业有害生物', area:'五号林区', score:42 },
        { type:'气象灾害', area:'二号林区', score:38 },
        { type:'地质灾害', area:'三号林区', score:40 },
        { type:'地质灾害', area:'四号林区(2)', score:18 },
    ];
    // 按分数降序
    rawEvents.sort(function(a, b) { return b.score - a.score; });

    setTimeout(function() {
        // 更新统计卡片
        var cards = document.querySelectorAll('.risk-stat-card .stat-num');
        if (cards.length >= 4) {
            cards[0].textContent = riskLevels.ultra;
            cards[1].textContent = riskLevels.high;
            cards[2].textContent = riskLevels.mid;
            cards[3].textContent = riskLevels.low;
        }

        // 更新风险事件列表
        var eventContainer = document.querySelector('.risk-event-list');
        if (eventContainer) {
            var html = '';
            var idx = 0;
            rawEvents.forEach(function(ev) {
                if (area !== '全部林区' && ev.area.indexOf(area) === -1) return;
                if (type !== '综合评估' && ev.type !== type) return;
                idx++;
                var lvl = ev.score >= 80 ? 'high' : ev.score >= 50 ? 'mid' : 'low';
                var rwId = 'RW' + ('00' + idx).slice(-3);
                html += '<div class=\"risk-event-item\"><span class=\"re-dot ' + lvl + '\"></span>';
                html += '<span class=\"re-title\">' + rwId + ' ' + ev.type + '</span>';
                html += '<span class=\"re-area\">' + ev.area + '</span>';
                html += '<span class=\"re-score ' + lvl + '\">' + ev.score + '%</span></div>';
            });
            if (!html) html = '<div style=\"color:#8ba4bc;padding:12px;text-align:center;\">当前筛选条件下无风险事件</div>';
            eventContainer.innerHTML = html;
        }

        // 更新热力图
        if (window.riskCharts && window.riskCharts.heatmap) {
            var hTypes = type === '综合评估' ? ['火灾','虫害','气象','地质'] : [type];
            var allAreas = ['一号','二号','三号','四号','五号'];
            var hAreas = area === '全部林区' ? allAreas : [area];
            window.riskCharts.heatmap.setOption({
                xAxis: { data: hAreas },
                yAxis: { data: hTypes },
                series: [{ data: heatData.length > 0 ? heatData : [[0,0,0]] }]
            });
        }

        // 更新柱状图
        if (window.riskCharts && window.riskCharts.bar) {
            window.riskCharts.bar.setOption({
                series: [{
                    data: barData,
                    itemStyle: {
                        color: function(p) {
                            var v = barData[p.dataIndex];
                            return v >= 85 ? '#ff3d3d' : v >= 70 ? '#ffab00' : v >= 40 ? '#ffc107' : '#00e676';
                        }
                    }
                }]
            });
        }

        btn.textContent = '评估完成';
        btn.disabled = false;
        setTimeout(function() { btn.textContent = '执行评估'; }, 2000);
    }, 800);
}

function exportRiskReport() {
    var areaEl = document.getElementById('riskAreaFilter');
    var typeEl = document.getElementById('riskTypeFilter');
    var area = areaEl ? areaEl.value : '全部林区';
    var type = typeEl ? typeEl.value : '综合评估';
    alert('风险评估报告已导出\n区域：' + area + '\n类型：' + type + '\n\n包含热力图、柱状图及风险事件列表，可打印或保存为PDF。');
}

async function runFvcAnalysis() {
    var btn = event.target;
    var originalText = btn.textContent;
    btn.textContent = '分析中...';
    btn.disabled = true;

    var srcEl = document.getElementById('fvcDataSource');
    var source = srcEl ? srcEl.value : 'fvc_2';
    var yearLabel = { 'fvc_1': '2022', 'fvc_2': '2021' };
    var year = yearLabel[source] || '2021';

    // 读取分析区域
    var areaEl = document.getElementById('fvcArea');
    var compartment = areaEl ? areaEl.value : '全部林区';

    // 读取用户自定义分类阈值
    var fvcHighEl = document.getElementById('fvcHigh');
    var fvcMidEl  = document.getElementById('fvcMid');
    var fvcLowEl  = document.getElementById('fvcLow');
    var thresholds = {
        high: (fvcHighEl && parseFloat(fvcHighEl.value)) || 0.75,
        mid:  (fvcMidEl  && parseFloat(fvcMidEl.value))  || 0.45,
        low:  (fvcLowEl  && parseFloat(fvcLowEl.value))  || 0.15
    };

    // 加载WMS栅格到地图
    if (typeof GeoServerLayers !== 'undefined') {
        GeoServerLayers.addFvcLayer(source);
    }

    // 调用后端 API 获取真实分析结果
    try {
        var resp = await ApiService.request('/api/spatial/fvc/analyze', {
            method: 'POST',
            body: JSON.stringify({ year: year, thresholds: thresholds, compartment: compartment })
        });
        if (resp && resp.success && resp.data) {
            resp.data.compartment = resp.data.compartment || compartment;
            showFvcResult(resp.data);
        } else {
            throw new Error('API返回无效数据');
        }
    } catch (e) {
        console.warn('FVC分析API调用失败，使用离线数据:', e.message);
        var fvcValues = {
            'fvc_1': { year:'2022', avg:0.62, high:5800, mid:4100, low:1480, bare:680, degraded:4 },
            'fvc_2': { year:'2021', avg:0.68, high:6820, mid:3450, low:1230, bare:560, degraded:2 },
        };
        var vals = fvcValues[source] || fvcValues['fvc_2'];
        var isSingle = compartment && compartment !== '全部林区';
        var scale = isSingle ? 0.22 : 1.0;
        showFvcResult({
            year: vals.year,
            compartment: compartment,
            avgFvc: vals.avg,
            totalAreaMu: Math.round(12060 * scale),
            highArea: Math.round(vals.high * scale),
            midArea: Math.round(vals.mid * scale),
            lowArea: Math.round(vals.low * scale),
            bareArea: Math.round(vals.bare * scale),
            degradedCount: Math.max(1, Math.round(vals.degraded * scale)),
            areas: isSingle ? [{name: compartment, fvc: vals.avg, level: '中覆盖'}] : _getFallbackAreasFvc(vals.avg),
            source: '离线数据(API不可用)'
        });
    }

    btn.textContent = '已完成 ' + year + ' FVC';
    setTimeout(function() {
        btn.textContent = '执行FVC分析';
        btn.disabled = false;
    }, 2000);
}

function showFvcResult(data) {
    var panel = document.getElementById('fvcResultPanel');
    if (panel) panel.style.display = 'flex';
    var detail = document.getElementById('fvcDetailList');
    if (detail) detail.style.display = 'block';
    var chart = document.getElementById('fvcChartArea');

    var isSingle = data.compartment && data.compartment !== '全部林区';

    // 单个林区时隐藏对比柱状图，显示选中林区标题
    if (chart) chart.style.display = isSingle ? 'none' : 'block';
    if (detail) {
        var h4 = detail.querySelector('h4');
        if (h4) h4.textContent = isSingle ? (data.compartment + ' 覆盖度分级详情') : '覆盖度分级详情（用户自定义阈值）';
    }

    var avgEl = document.getElementById('fvcAvgValue');
    if (avgEl) avgEl.textContent = data.avgFvc.toFixed(2);
    var hiEl = document.getElementById('fvcHighArea');
    if (hiEl) hiEl.textContent = (data.highArea || 0).toLocaleString() + ' 亩';
    var midEl = document.getElementById('fvcMidArea');
    if (midEl) midEl.textContent = (data.midArea || 0).toLocaleString() + ' 亩';
    var loEl = document.getElementById('fvcLowArea');
    if (loEl) loEl.textContent = (data.lowArea || 0).toLocaleString() + ' 亩';
    var baEl = document.getElementById('fvcBareArea');
    if (baEl) baEl.textContent = (data.bareArea || 0).toLocaleString() + ' 亩';
    var dgEl = document.getElementById('fvcDegraded');
    if (dgEl) dgEl.textContent = (data.degradedCount || 0) + ' 处';

    var th = data.thresholds || { high:0.75, mid:0.45, low:0.15 };
    if (data.areas && data.areas.length > 0) {
        if (isSingle) {
            // 单个林区：只显示该林区详情，不显示柱状图
            _updateFvcDetailList(data.areas, th);
        } else {
            _updateFvcBarChart(data.areas, th);
            _updateFvcDetailList(data.areas, th);
        }
    }
}

function _updateFvcBarChart(areas, th) {
    var chartArea = document.getElementById('fvcChartArea');
    if (!chartArea) return;
    th = th || { high:0.75, mid:0.45, low:0.15 };
    var midHi = (th.high + th.mid) / 2;
    var colors = ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c'];
    var html = '<h4 style="font-size:12px;color:#8899aa;margin-bottom:8px;">各林区FVC对比</h4>';
    html += '<div class="fvc-bar-chart">';
    areas.forEach(function(a) {
        var pct = Math.round((a.fvc || 0) * 100);
        var v = a.fvc || 0;
        var color = v >= th.high ? colors[0] : v >= midHi ? colors[1] : v >= th.mid ? colors[2] : v >= th.low ? colors[3] : colors[4];
        html += '<div class="fvc-bar-row"><span class="fvc-bar-label">' + a.name + '</span>';
        html += '<div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>';
        html += '<span class="fvc-bar-val">' + v.toFixed(2) + '</span></div>';
    });
    html += '</div>';
    chartArea.innerHTML = html;
}

function _updateFvcDetailList(areas, th) {
    var detail = document.getElementById('fvcDetailList');
    if (!detail) return;
    th = th || { high:0.75, mid:0.45, low:0.15 };
    var midHi = (th.high + th.mid) / 2;
    var html = '<h4>覆盖度分级详情（用户自定义阈值）</h4>';
    html += '<div class="fvc-legend-bar">';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#1a9641;"></div><span>高覆盖 (&ge;' + th.high.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#a6d96a;"></div><span>中高覆盖 (' + midHi.toFixed(2) + '-' + th.high.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#ffffbf;"></div><span>中覆盖 (' + th.mid.toFixed(2) + '-' + midHi.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#fdae61;"></div><span>低覆盖 (' + th.low.toFixed(2) + '-' + th.mid.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#d7191c;"></div><span>裸地 (<' + th.low.toFixed(2) + ')</span></div>';
    html += '</div>';
    areas.forEach(function(a) {
        var v = a.fvc || 0;
        var tagClass = v >= th.high ? 'tag-green' : v >= th.mid ? 'tag-green' : 'tag-orange';
        html += '<div class="blind-item"><span>' + a.name + ' FVC=' + v.toFixed(2) + '</span><span class="tag ' + tagClass + ' tag-sm">' + (a.level || '') + '</span></div>';
    });
    detail.innerHTML = html;
}

function _getFallbackAreasFvc(avg, th) {
    th = th || { high:0.75, mid:0.45, low:0.15 };
    var midHi = (th.high + th.mid) / 2;
    var variations = [0.06, -0.10, 0.13, -0.15, -0.02];
    var names = ['一号林区', '二号林区', '三号林区', '四号林区', '五号林区'];
    return names.map(function(n, i) {
        var v = Math.round(Math.max(0.05, Math.min(0.95, avg + variations[i])) * 100) / 100;
        var lvl = v >= th.high ? '高覆盖' : v >= midHi ? '中高覆盖' : v >= th.mid ? '中覆盖' : v >= th.low ? '低覆盖' : '裸地';
        return { name: n, fvc: v, level: lvl };
    });
}

// ==================== 火点查看处置 ====================
function viewFirePoint(fid) {
    // 优先用缓存数据，其次 API 返回的 firePointData，最后硬编码默认值
    var f = (window._fireApiCache && window._fireApiCache[fid]) || firePointData[fid];
    if (!f) {
        // 如果没有firePointData中的数据，使用默认数据
        const defaults = {
            'F001': { id:'F001', level:'较大', status:'蔓延中', area:'一号林区', time:'2026-07-02 14:23', lng:'119.905', lat:'28.515', wind:'东南风 3级', spread:'西南方向', speed:'1.2 km/h', affected:'45 亩', response:'无人机红外发现林冠层异常高温，已调集周边护林员和消防力量赶赴现场，正在组织扑救。火场周围已建立隔离带。', commander:'张建国', forces:'护林员6人 + 消防8人' },
            'F002': { id:'F002', level:'一般', status:'已控制', area:'三号林区', time:'2026-07-02 10:15', lng:'119.935', lat:'28.495', wind:'东风 2级', spread:'西方向', speed:'0.8 km/h', affected:'21 亩', response:'护林员上报烟雾，火势已得到控制，正在清理余火和看守火场。', commander:'李明辉', forces:'护林员4人' },
            'F003': { id:'F003', level:'一般', status:'已派发', area:'四号林区', time:'2026-07-01 16:08', lng:'119.880', lat:'28.545', wind:'北风 1级', spread:'南方向', speed:'0.5 km/h', affected:'20 亩', response:'遥感影像热点标记，已派发巡护队前往核查处置，等待现场反馈。', commander:'陈志强', forces:'护林员3人' },
            'F004': { id:'F004', level:'高', status:'监测中', area:'三号林区', time:'2026-07-04 08:45', lng:'119.941', lat:'28.500', wind:'西南风 2级', spread:'东北方向', speed:'0.6 km/h', affected:'12 亩', response:'无人机巡查发现异常热源，初步判断为小型火情，正在持续监测中。', commander:'刘德才', forces:'护林员2人 + 无人机1架' }
        };
        var data = defaults[fid];
        if (!data) return;
        showFirePointModal(data);
    } else {
        showFirePointModal(f);
    }
}

function showFirePointModal(f) {
    // 统一字段名（API 返回 riskLevel/status/reportedAt，硬编码用 level/status/time）
    f.level = f.level || f.riskLevel || f.risk_level || '中';
    f.status = f.status || '监测中';
    if (!f.area || f.area === '未知林区') {
        f.area = guessFireArea(f.lat, f.lng) || '未知林区';
    }
    f.time = f.time || f.reportedAt || f.reported_at || '-';
    f.lng = f.lng || 119.91;
    f.lat = f.lat || 28.51;
    f.wind = f.wind || '东南风 2级';
    f.spread = f.spread || '西方向';
    f.speed = f.speed || '0.8 km/h';
    f.affected = (f.affected || f.areaMu || f.area_mu || 0);
    if (typeof f.affected === 'number') f.affected = f.affected + ' 亩';
    f.response = f.response || f.description || f.measure || '暂无';
    f.commander = f.commander || f.handler || f.reportedBy || f.reported_by || '-';
    f.forces = f.forces || '-';

    const levelColor = f.level === '高' || f.level === '较大' ? '#ff3d3d' : f.level === '中' || f.level === '一般' ? '#ffab00' : '#00d5ff';
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="background:#0f1d33;border:1px solid #1a3355;border-radius:10px;width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);"><div style="padding:16px 20px;border-bottom:1px solid #1a3355;display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;color:#fff;font-size:16px;">火点详情 · ' + f.id + '</h3><button onclick="this.closest(\'div[style]\').parentElement.remove()" style="background:none;border:none;color:#8ba4bc;font-size:18px;cursor:pointer;">✕</button></div><div style="padding:16px 20px;"><div style="display:flex;gap:12px;margin-bottom:14px;"><span style="background:' + levelColor + ';color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">' + f.level + '</span><span style="background:rgba(255,171,0,0.15);color:#ffab00;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">' + f.status + '</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;"><div><span style="color:#8ba4bc;">位置：</span><span style="color:#e4edf5;">' + f.area + '</span></div><div><span style="color:#8ba4bc;">发现时间：</span><span style="color:#e4edf5;">' + f.time + '</span></div><div><span style="color:#8ba4bc;">经度：</span><span style="color:#e4edf5;">' + f.lng + '</span></div><div><span style="color:#8ba4bc;">纬度：</span><span style="color:#e4edf5;">' + f.lat + '</span></div><div><span style="color:#8ba4bc;">风向风速：</span><span style="color:#e4edf5;">' + f.wind + '</span></div><div><span style="color:#8ba4bc;">蔓延方向：</span><span style="color:#ffab00;">' + f.spread + '</span></div><div><span style="color:#8ba4bc;">蔓延速度：</span><span style="color:#ffab00;">' + f.speed + '</span></div><div><span style="color:#8ba4bc;">影响面积：</span><span style="color:#ff3d3d;">' + f.affected + '</span></div></div><div style="margin-top:14px;padding-top:14px;border-top:1px solid #1a3355;"><h4 style="margin:0 0 8px;color:#00d5ff;font-size:13px;">处置信息</h4><div style="font-size:13px;color:#e4edf5;line-height:1.6;margin-bottom:8px;">' + (f.response || f.measure || '暂无') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;"><div><span style="color:#8ba4bc;">现场指挥：</span><span style="color:#e4edf5;">' + (f.commander || f.handler || '-') + '</span></div><div><span style="color:#8ba4bc;">处置力量：</span><span style="color:#e4edf5;">' + (f.forces || '-') + '</span></div></div></div><div style="margin-top:16px;display:flex;gap:8px;"><button id="btnLocateFire_' + f.id + '" style="flex:1;padding:8px;background:#00d5ff;color:#060e1a;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">定位到地图</button><button onclick="this.closest(\'div[style]\').parentElement.parentElement.remove()" style="flex:1;padding:8px;background:#1a3355;color:#e4edf5;border:1px solid #1a3355;border-radius:6px;font-size:13px;cursor:pointer;">关闭</button></div></div></div>';
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    // 绑定定位按钮
    setTimeout(function() {
        var btn = document.getElementById('btnLocateFire_' + f.id);
        if (btn) {
            btn.addEventListener('click', function() {
                var lat = parseFloat(f.lat);
                var lng = parseFloat(f.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    var map = MapFacade.getMap('dashMap');
                    if (map) {
                        map.flyTo([lat, lng], 16, { duration: 1.2 });
                        var marker = L.circleMarker([lat, lng], {
                            radius: 14, color: '#ff3d3d', weight: 3,
                            fillColor: '#ff3d3d', fillOpacity: 0.4
                        }).addTo(map);
                        marker.bindPopup('<b>' + f.id + '</b><br>' + f.area).openPopup();
                        setTimeout(function() { map.removeLayer(marker); }, 4000);
                    }
                }
                modal.remove();
            });
        }
    }, 100);
}

// ==================== 灾害识别右侧栏管理（火情/疫情列表 + 上传 + 派发 + 处理状态） ====================
const DisasterPanel = {
    /** 刷新火情列表（从 GeoServerLayers 缓存读取，DB 已同步） */
    async refreshFireList() {
        const container = document.getElementById('fireDisasterList');
        const info = document.getElementById('fireCountInfo');
        if (!container) return;
        container.innerHTML = '<div style="color:#8ba4bc;font-size:12px;padding:20px;text-align:center;">加载中...</div>';
        try {
            // 强制从 API 重新加载最新数据
            if (typeof GeoServerLayers !== 'undefined') {
                await GeoServerLayers._loadFirePoints();
            }
            const points = (typeof GeoServerLayers !== 'undefined' && GeoServerLayers._firePoints) || {};
            const list = Object.values(points);
            if (info) info.textContent = '共 ' + list.length + ' 起火情';
            if (list.length === 0) {
                container.innerHTML = '<div style="color:#8ba4bc;font-size:12px;padding:20px;text-align:center;">暂无火情数据，点击「上报火情」添加</div>';
                return;
            }
            container.innerHTML = list.map(f => this._renderFireItem(f)).join('');
        } catch (e) {
            container.innerHTML = '<div style="color:#ff6b6b;font-size:12px;padding:20px;text-align:center;">加载失败: ' + e.message + '</div>';
        }
    },

    /** 刷新疫情列表 */
    async refreshPestList() {
        const container = document.getElementById('pestDisasterList');
        const info = document.getElementById('pestCountInfo');
        if (!container) return;
        container.innerHTML = '<div style="color:#8ba4bc;font-size:12px;padding:20px;text-align:center;">加载中...</div>';
        try {
            // 强制从 API 重新加载最新数据
            if (typeof GeoServerLayers !== 'undefined') {
                await GeoServerLayers._loadPestPoints();
            }
            const list = (typeof GeoServerLayers !== 'undefined' && GeoServerLayers._pestPoints) || [];
            if (info) info.textContent = '共 ' + list.length + ' 起疫情';
            if (list.length === 0) {
                container.innerHTML = '<div style="color:#8ba4bc;font-size:12px;padding:20px;text-align:center;">暂无疫情数据，点击「上报疫情」添加</div>';
                return;
            }
            container.innerHTML = list.map(p => this._renderPestItem(p)).join('');
        } catch (e) {
            container.innerHTML = '<div style="color:#ff6b6b;font-size:12px;padding:20px;text-align:center;">加载失败: ' + e.message + '</div>';
        }
    },

    /** 渲染单个火情项：图片/高危信息/上报人/派发状态/处理情况 */
    _renderFireItem(f) {
        const imgUrl = f.imagePath ? ApiService.BASE_URL + f.imagePath : '';
        const riskColor = f.riskLevel === '高' ? '#ff3d3d' : (f.riskLevel === '中' ? '#ffab00' : '#4caf50');
        const dispatched = (f.status || '').indexOf('已派发') >= 0;
        const statusColor = dispatched ? '#2196f3' : (f.status === '已处理' ? '#4caf50' : '#ff9800');
        const numId = parseInt((f.id || '').replace(/\D/g, ''), 10) || 0;
        const safeName = (f.name || f.id || '').replace(/'/g, '');
        return `<div class="disaster-item" style="background:rgba(15,29,51,0.6);border:1px solid #1a3355;border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;" onclick="DisasterPanel.locateOnMap(${f.lat},${f.lng},'${safeName}')">
            <div style="display:flex;gap:10px;">
                ${imgUrl ? `<img src="${imgUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'"/>` : '<div style="width:80px;height:60px;background:#1a3355;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#8ba4bc;font-size:10px;flex-shrink:0;">无图</div>'}
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="color:#fff;font-size:13px;font-weight:600;">${f.name || f.id || '未命名'}</span>
                        <span style="background:${riskColor};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;">${f.riskLevel || '中'}级</span>
                    </div>
                    <div style="font-size:11px;color:#8ba4bc;line-height:1.6;">
                        <div>温度：${f.temperatureC || '-'}°C | 面积：${f.areaMu || 0}亩</div>
                        <div>上报人：${f.reportedBy || '-'}</div>
                        <div>上报时间：${f.reportedAt || '-'}</div>
                    </div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid #1a3355;">
                <div style="font-size:11px;">
                    <span style="color:#8ba4bc;">派发：</span>
                    <span style="color:${dispatched ? '#4caf50' : '#ff6b6b'}">${dispatched ? '已派发' : '未派发'}</span>
                    <span style="color:#8ba4bc;margin-left:8px;">处理：</span>
                    <span style="color:${statusColor}">${f.status || '待处理'}</span>
                </div>
                <div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="DisasterPanel.locateOnMap(${f.lat},${f.lng},'${safeName}')">定位</button>
                    <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="DisasterPanel.dispatch('fire',${numId})">派发</button>
                    <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="DisasterPanel.updateStatus('fire',${numId})">状态</button>
                </div>
            </div>
        </div>`;
    },

    /** 渲染单个疫情项 */
    _renderPestItem(p) {
        const imgUrl = p.imagePath ? ApiService.BASE_URL + p.imagePath : '';
        const dispatched = (p.status || '').indexOf('已派发') >= 0;
        const statusColor = dispatched ? '#2196f3' : (p.status === '已处理' ? '#4caf50' : '#ff9800');
        const numId = parseInt((p.id || '').replace(/\D/g, ''), 10) || 0;
        const safeName = (p.name || p.id || '').replace(/'/g, '');
        return `<div class="disaster-item" style="background:rgba(15,29,51,0.6);border:1px solid #1a3355;border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;" onclick="DisasterPanel.locateOnMap(${p.lat},${p.lng},'${safeName}')">
            <div style="display:flex;gap:10px;">
                ${imgUrl ? `<img src="${imgUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'"/>` : '<div style="width:80px;height:60px;background:#1a3355;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#8ba4bc;font-size:10px;flex-shrink:0;">无图</div>'}
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="color:#fff;font-size:13px;font-weight:600;">${p.name || p.id || '未命名'}</span>
                        <span style="background:#ff9800;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;">${p.diseaseType || '病虫害'}</span>
                    </div>
                    <div style="font-size:11px;color:#8ba4bc;line-height:1.6;">
                        <div>置信度：${p.confidence || 0}% | 面积：${p.affectedAreaMu || 0}亩</div>
                        <div>上报时间：${p.reportedAt || '-'}</div>
                    </div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid #1a3355;">
                <div style="font-size:11px;">
                    <span style="color:#8ba4bc;">派发：</span>
                    <span style="color:${dispatched ? '#4caf50' : '#ff6b6b'}">${dispatched ? '已派发' : '未派发'}</span>
                    <span style="color:#8ba4bc;margin-left:8px;">处理：</span>
                    <span style="color:${statusColor}">${p.status || '待处理'}</span>
                </div>
                <div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="DisasterPanel.locateOnMap(${p.lat},${p.lng},'${safeName}')">定位</button>
                    <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="DisasterPanel.dispatch('pest',${numId})">派发</button>
                    <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="DisasterPanel.updateStatus('pest',${numId})">状态</button>
                </div>
            </div>
        </div>`;
    },

    /** 在地图上定位火情/疫情点 */
    locateOnMap(lat, lng, name) {
        const map = MapFacade.getMap('dashMap');
        if (map && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo([lat, lng], 16, { duration: 1.2 });
            const marker = L.circleMarker([lat, lng], {
                radius: 14, color: '#ff3d3d', weight: 3, fillColor: '#ff3d3d', fillOpacity: 0.4
            }).addTo(map);
            marker.bindPopup('<b>' + (name || '灾害点') + '</b><br>经度:' + lng + ' 纬度:' + lat).openPopup();
            setTimeout(() => { map.removeLayer(marker); }, 5000);
        }
    },

    /** 打开上传弹窗 */
    openUpload(dtype) {
        const isFire = dtype === 'fire';
        const title = isFire ? '上报火情' : '上报疫情';
        const extraFields = isFire ? `
            <div class="form-group"><label>风险等级</label><select id="upRiskLevel" class="select-full"><option value="高">高</option><option value="中" selected>中</option><option value="低">低</option></select></div>
            <div class="form-row"><div class="form-group half"><label>温度(°C)</label><input type="number" id="upTemp" value="60" step="0.1"/></div><div class="form-group half"><label>影响面积(亩)</label><input type="number" id="upArea" value="10" step="0.1"/></div></div>` : `
            <div class="form-group"><label>病虫害类型</label><select id="upDiseaseType" class="select-full"><option>松材线虫病</option><option>美国白蛾</option><option>松毛虫</option><option>其他</option></select></div>
            <div class="form-row"><div class="form-group half"><label>置信度(%)</label><input type="number" id="upConfidence" value="75" min="0" max="100"/></div><div class="form-group half"><label>影响面积(亩)</label><input type="number" id="upPestArea" value="5" step="0.1"/></div></div>`;

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
        modal.id = 'disasterUploadModal';
        modal.innerHTML = `<div style="background:#0f1d33;border:1px solid #1a3355;border-radius:10px;width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
            <div style="padding:16px 20px;border-bottom:1px solid #1a3355;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#fff;font-size:16px;">${title}</h3>
                <button onclick="document.getElementById('disasterUploadModal').remove()" style="background:none;border:none;color:#8ba4bc;font-size:18px;cursor:pointer;">✕</button>
            </div>
            <div style="padding:16px 20px;">
                <div class="form-group"><label>名称</label><input type="text" id="upName" placeholder="如：一号林区火情"/></div>
                <div class="form-row"><div class="form-group half"><label>纬度(lat)</label><input type="number" id="upLat" value="28.5302" step="0.0001"/></div><div class="form-group half"><label>经度(lng)</label><input type="number" id="upLng" value="119.9103" step="0.0001"/></div></div>
                <div class="form-group"><label>上报人</label><input type="text" id="upReporter" placeholder="如：张建国/UAV-01"/></div>
                ${extraFields}
                <div class="form-group"><label>描述</label><textarea id="upDesc" rows="2" placeholder="现场描述..."></textarea></div>
                <div class="form-group"><label>现场图片</label><input type="file" id="upImage" accept="image/*" style="width:100%;color:#e4edf5;"/><div id="upImagePreview" style="margin-top:8px;"></div></div>
                <div style="display:flex;gap:8px;margin-top:16px;">
                    <button id="btnSubmitUpload" style="flex:1;padding:10px;background:#00d5ff;color:#060e1a;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">上传并同步</button>
                    <button onclick="document.getElementById('disasterUploadModal').remove()" style="flex:1;padding:10px;background:#1a3355;color:#e4edf5;border:1px solid #1a3355;border-radius:6px;font-size:13px;cursor:pointer;">取消</button>
                </div>
                <div id="upStatus" style="margin-top:10px;font-size:12px;text-align:center;"></div>
            </div>
        </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);

        // 图片预览
        document.getElementById('upImage').addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('upImagePreview');
            if (file) {
                const reader = new FileReader();
                reader.onload = e => preview.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:160px;object-fit:cover;border-radius:4px;"/>`;
                reader.readAsDataURL(file);
            } else {
                preview.innerHTML = '';
            }
        });

        // 提交
        document.getElementById('btnSubmitUpload').addEventListener('click', () => this._submitUpload(dtype));
    },

    async _submitUpload(dtype) {
        const status = document.getElementById('upStatus');
        const btn = document.getElementById('btnSubmitUpload');
        btn.disabled = true;
        btn.textContent = '上传中...';
        status.style.color = '#ffab00';
        status.textContent = '正在上传图片并同步到 GeoServer...';

        try {
            const fd = new FormData();
            fd.append('type', dtype);
            fd.append('name', document.getElementById('upName').value || (dtype === 'fire' ? '火情' : '疫情'));
            fd.append('lat', document.getElementById('upLat').value);
            fd.append('lng', document.getElementById('upLng').value);
            fd.append('reportedBy', document.getElementById('upReporter').value || '匿名');
            fd.append('description', document.getElementById('upDesc').value || '');
            if (dtype === 'fire') {
                fd.append('riskLevel', document.getElementById('upRiskLevel').value);
                fd.append('temperatureC', document.getElementById('upTemp').value);
                fd.append('areaMu', document.getElementById('upArea').value);
            } else {
                fd.append('diseaseType', document.getElementById('upDiseaseType').value);
                fd.append('confidence', document.getElementById('upConfidence').value);
                fd.append('affectedAreaMu', document.getElementById('upPestArea').value);
            }
            const fileInput = document.getElementById('upImage');
            if (fileInput.files[0]) fd.append('image', fileInput.files[0]);

            const result = await ApiService.uploadDisaster(fd);
            if (result.success) {
                status.style.color = '#4caf50';
                status.textContent = '上传成功！地图已同步更新';
                // 关闭弹窗并刷新列表
                setTimeout(() => {
                    document.getElementById('disasterUploadModal').remove();
                    this.refreshFireList();
                    this.refreshPestList();
                    // 地图已通过 SSE 自动更新，这里做兜底刷新
                    if (typeof GeoServerLayers !== 'undefined') {
                        GeoServerLayers._loadFirePoints().then(() => {
                            const keys = Object.keys(MapFacade._instances);
                            keys.forEach(id => {
                                const map = MapFacade._instances[id];
                                if (map) GeoServerLayers._addMarkersToMap(map);
                            });
                        });
                    }
                }, 1200);
            } else {
                throw new Error(result.error || '上传失败');
            }
        } catch (e) {
            btn.disabled = false;
            btn.textContent = '上传并同步';
            status.style.color = '#ff6b6b';
            status.textContent = '上传失败: ' + e.message;
        }
    },

    /** 派发处理任务 */
    async dispatch(dtype, id) {
        const handler = window.prompt('请输入派发处理人姓名：', '');
        if (!handler) return;
        try {
            await ApiService.dispatchDisaster(dtype, id, handler);
            alert('已派发给：' + handler);
            this.refreshFireList();
            this.refreshPestList();
        } catch (e) {
            alert('派发失败: ' + e.message);
        }
    },

    /** 更新处理状态 */
    async updateStatus(dtype, id) {
        const status = window.prompt('请输入新的处理状态（如：监测中/已派发/处置中/已处理）：', '处置中');
        if (!status) return;
        try {
            await ApiService.updateDisasterStatus(dtype, id, status);
            alert('状态已更新为：' + status);
            this.refreshFireList();
            this.refreshPestList();
        } catch (e) {
            alert('更新失败: ' + e.message);
        }
    },

    /** 手动同步 GeoServer */
    async syncGeoserver() {
        try {
            const r = await ApiService.syncGeoserver();
            if (typeof GeoServerLayers !== 'undefined') {
                await GeoServerLayers._loadFirePoints();
                await GeoServerLayers._loadPestPoints();
                const keys = Object.keys(MapFacade._instances);
                keys.forEach(id => {
                    const map = MapFacade._instances[id];
                    if (map) GeoServerLayers._addMarkersToMap(map);
                });
            }
            this.refreshFireList();
            this.refreshPestList();
        } catch (e) {
            alert('同步失败: ' + e.message);
        }
    },
};

// ==================== 页面五：统计报表 ====================
function initReportPage() {
    document.getElementById('page-report').innerHTML = `
    <div class="sub-tab-bar">
        <a class="sub-tab-item active" data-inner="inner-patrol-stat">巡护统计</a>
        <a class="sub-tab-item" data-inner="inner-performance">人员绩效</a>
        <a class="sub-tab-item" data-inner="inner-drone-stat">无人机统计</a>
        <a class="sub-tab-item" data-inner="inner-disaster-stat">灾害统计</a>
        <a class="sub-tab-item" data-inner="inner-report-export">报表导出</a>
    </div>
    <div class="content-full-panel">
        <div class="inner-tab active" id="inner-patrol-stat">
            <div class="stat-cards-row"><div class="mini-stat"><div class="mini-stat-value blue">1,286</div><div class="mini-stat-label">本月巡护次数</div></div><div class="mini-stat"><div class="mini-stat-value green">5,420h</div><div class="mini-stat-label">本月巡护时长</div></div><div class="mini-stat"><div class="mini-stat-value orange">15,680km</div><div class="mini-stat-label">本月巡护里程</div></div><div class="mini-stat"><div class="mini-stat-value purple">78.5%</div><div class="mini-stat-label">覆盖面积占比</div></div></div>
            <div class="chart-row"><div class="chart-card"><h3>月度巡护趋势</h3><div class="chart-placeholder"><div class="bar-chart"><div class="bar" style="height:40%"><span>1月</span></div><div class="bar" style="height:55%"><span>2月</span></div><div class="bar" style="height:65%"><span>3月</span></div><div class="bar" style="height:70%"><span>4月</span></div><div class="bar" style="height:80%"><span>5月</span></div><div class="bar active" style="height:90%"><span>6月</span></div></div></div></div><div class="chart-card"><h3>各林区巡护分布</h3><div class="chart-placeholder"><div class="donut-chart"><div class="donut"><div class="donut-label">1,286<br><small>总次数</small></div></div><div class="donut-legend"><span><i style="background:#00aaff;"></i>一号林区 28%</span><span><i style="background:#00e676;"></i>二号林区 25%</span><span><i style="background:#ff9800;"></i>三号林区 22%</span><span><i style="background:#b388ff;"></i>四号林区 15%</span><span><i style="background:#ff3d3d;"></i>五号林区 10%</span></div></div></div></div></div>
        </div>
        <div class="inner-tab" id="inner-performance"><div class="panel-card"><div class="card-header"><h3>人员绩效排行</h3><div class="card-actions"><select class="select-sm"><option>本月</option><option>本季度</option></select></div></div><div class="card-body"><table class="data-table"><thead><tr><th>排名</th><th>姓名</th><th>巡护次数</th><th>时长(h)</th><th>里程(km)</th><th>评分</th></tr></thead><tbody><tr class="rank-top"><td>1</td><td>张建国</td><td>28</td><td>112.5</td><td>345.6</td><td><span class="score high">98</span></td></tr><tr class="rank-top"><td>2</td><td>刘德才</td><td>26</td><td>98.3</td><td>312.8</td><td><span class="score high">95</span></td></tr><tr class="rank-top"><td>3</td><td>王大山</td><td>25</td><td>95.0</td><td>298.5</td><td><span class="score mid">92</span></td></tr><tr><td>4</td><td>李明辉</td><td>23</td><td>88.2</td><td>275.3</td><td><span class="score mid">88</span></td></tr><tr><td>5</td><td>赵文博</td><td>22</td><td>82.5</td><td>260.1</td><td><span class="score mid">85</span></td></tr></tbody></table></div></div></div>
        <div class="inner-tab" id="inner-drone-stat"><div class="stat-cards-row"><div class="mini-stat"><div class="mini-stat-value blue">86</div><div class="mini-stat-label">本月飞行次数</div></div><div class="mini-stat"><div class="mini-stat-value green">342h</div><div class="mini-stat-label">本月飞行时长</div></div><div class="mini-stat"><div class="mini-stat-value orange">2,156km</div><div class="mini-stat-label">本月飞行里程</div></div></div><div class="panel-card"><div class="card-header"><h3>无人机飞行统计</h3></div><div class="card-body"><table class="data-table"><thead><tr><th>编号</th><th>型号</th><th>飞行次数</th><th>飞行时长</th><th>飞行里程</th><th>状态</th></tr></thead><tbody><tr><td>UAV-01</td><td>大疆M300</td><td>22</td><td>86h</td><td>540km</td><td><span class="tag tag-green">正常</span></td></tr><tr><td>UAV-02</td><td>大疆M300</td><td>18</td><td>72h</td><td>465km</td><td><span class="tag tag-green">正常</span></td></tr><tr><td>UAV-03</td><td>大疆M350</td><td>20</td><td>80h</td><td>510km</td><td><span class="tag tag-green">正常</span></td></tr></tbody></table></div></div></div>
        <div class="inner-tab" id="inner-disaster-stat"><div class="stat-cards-row"><div class="mini-stat"><div class="mini-stat-value red">23</div><div class="mini-stat-label">本月火情数</div></div><div class="mini-stat"><div class="mini-stat-value orange">45</div><div class="mini-stat-label">本月病害数</div></div><div class="mini-stat"><div class="mini-stat-value purple">18</div><div class="mini-stat-label">本月异常事件</div></div></div><div class="chart-row"><div class="chart-card"><h3>月度灾害趋势</h3><div class="chart-placeholder"><div class="bar-chart"><div class="bar" style="height:30%;background:#ff3d3d;"><span>1月</span></div><div class="bar" style="height:45%;background:#ff3d3d;"><span>2月</span></div><div class="bar" style="height:55%;background:#ff3d3d;"><span>3月</span></div><div class="bar" style="height:70%;background:#ff3d3d;"><span>4月</span></div><div class="bar" style="height:85%;background:#ff3d3d;"><span>5月</span></div><div class="bar active" style="height:60%;background:#ff3d3d;"><span>6月</span></div></div></div></div><div class="chart-card"><h3>灾害类型占比</h3><div class="chart-placeholder"><div class="donut-chart"><div class="donut"><div class="donut-label">86<br><small>总事件</small></div></div><div class="donut-legend"><span><i style="background:#ff3d3d;"></i>火情 27%</span><span><i style="background:#ff9800;"></i>病害 52%</span><span><i style="background:#b388ff;"></i>异常 21%</span></div></div></div></div></div></div>
        <div class="inner-tab" id="inner-report-export"><div class="content-full-panel"><div class="panel-card"><div class="card-header"><h3>报表导出</h3></div><div class="card-body"><div class="export-grid">
            <div class="export-card"><div class="export-icon">📊</div><h4>巡护报表</h4><p>巡护次数、时长、里程、覆盖面积统计</p><div class="export-actions"><button class="btn btn-primary btn-sm">导出Excel</button><button class="btn btn-outline btn-sm">导出PDF</button></div></div>
            <div class="export-card"><div class="export-icon">🔥</div><h4>火情报表</h4><p>火情数量、等级分布、处置情况统计</p><div class="export-actions"><button class="btn btn-primary btn-sm">导出Excel</button><button class="btn btn-outline btn-sm">导出PDF</button></div></div>
            <div class="export-card"><div class="export-icon">🐛</div><h4>病害报表</h4><p>病虫害分布、感染面积、处置进度统计</p><div class="export-actions"><button class="btn btn-primary btn-sm">导出Excel</button><button class="btn btn-outline btn-sm">导出PDF</button></div></div>
            <div class="export-card"><div class="export-icon">📋</div><h4>综合报表</h4><p>巡护+灾害+绩效综合统计报表</p><div class="export-actions"><button class="btn btn-primary btn-sm">导出Excel</button><button class="btn btn-outline btn-sm">导出PDF</button></div></div>
        </div></div></div></div></div>
    </div>`;
}

// ==================== 风险图表 ====================
function initRiskCharts() {
    if (typeof echarts === 'undefined') return;
    var heatmapEl = document.getElementById('riskHeatmapChart');
    var barEl = document.getElementById('riskBarChart');
    if (!heatmapEl || !barEl) return;
    var heatmapChart = echarts.init(heatmapEl);
    var barChart = echarts.init(barEl);
    var option = { backgroundColor: 'transparent', textStyle: { color: '#00d5ff', fontSize: 11 } };
    heatmapChart.setOption(Object.assign({}, option, {
        tooltip: { position: 'top', formatter: function(p) { return p.value + '分 风险等级: ' + (p.value >= 80 ? '高' : p.value >= 50 ? '中' : '低'); }, textStyle: { color: '#fff', fontSize: 12 } },
        grid: { left: 55, right: 15, top: 10, bottom: 45 },
        xAxis: { type: 'category', data: ['一号','二号','三号','四号','五号'], splitArea: { show: false }, axisLabel: { color: '#8ba4bc', fontSize: 11 }, name: '林区', nameTextStyle: { color: '#8ba4bc', fontSize: 11 } },
        yAxis: { type: 'category', data: ['火灾','虫害','气象','地质'], splitArea: { show: false }, axisLabel: { color: '#8ba4bc', fontSize: 11 }, name: '灾害类型', nameTextStyle: { color: '#8ba4bc', fontSize: 11 } },
        visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 5, textStyle: { color: '#8ba4bc', fontSize: 10 }, inRange: { color: ['#00c853', '#ffab00', '#c62828'] } },
        series: [{ name: '风险值', type: 'heatmap', data: [[0,0,92],[1,0,65],[2,0,42],[3,0,88],[4,0,62],[0,1,68],[1,1,85],[2,1,60],[3,1,38],[4,1,58],[0,2,45],[1,2,58],[2,2,95],[3,2,65],[4,2,48],[0,3,65],[1,3,42],[2,3,55],[3,3,90],[4,3,60]], label: { show: true, color: '#fff', fontSize: 10 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    }));
    barChart.setOption(Object.assign({}, option, {
        tooltip: { show: false },
        grid: { left: 40, right: 15, top: 10, bottom: 30 },
        xAxis: { type: 'category', data: ['一号', '二号', '三号', '四号', '五号'], axisLabel: { color: '#8ba4bc', fontSize: 11 } },
        yAxis: { type: 'value', max: 100, axisLabel: { color: '#8ba4bc', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [{ name: '风险评分', type: 'bar', data: [82,67,91,54,38], itemStyle: { color: function(p) { var colors = ['#ff3d3d', '#ffab00', '#ff3d3d', '#ffab00', '#00e676']; return colors[p.dataIndex]; }, borderRadius: [4,4,0,0] }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    }));
    window.riskCharts = { heatmap: heatmapChart, bar: barChart };
    window.addEventListener('resize', function() { heatmapChart.resize(); barChart.resize(); });
}

function runNdviAnalysis() {
    var btn = event.target;
    var originalText = btn.textContent;
    btn.textContent = '分析中...';
    btn.disabled = true;

    // 获取选中的数据源年份
    var srcEl = document.getElementById('ndviDataSource');
    var source = srcEl ? srcEl.value : 'NDVI2';
    var yearLabel = { 'NDVI2': '2021', 'NDVI_1': '2022' };
    var year = yearLabel[source] || '2021';

    // 读取分析区域
    var areaEl = document.getElementById('ndviArea');
    var compartment = areaEl ? areaEl.value : '全部林区';

    // 读取用户自定义分类阈值
    var ndviHighEl = document.getElementById('ndviHigh');
    var ndviMidEl  = document.getElementById('ndviMid');
    var ndviLowEl  = document.getElementById('ndviLow');
    var thresholds = {
        high: (ndviHighEl && parseFloat(ndviHighEl.value)) || 0.70,
        mid:  (ndviMidEl  && parseFloat(ndviMidEl.value))  || 0.40,
        low:  (ndviLowEl  && parseFloat(ndviLowEl.value))  || 0.15
    };

    // 加载WMS栅格到地图
    if (typeof GeoServerLayers !== 'undefined') {
        GeoServerLayers.addNdviLayer(source);
    }

    // 调用后端 API 获取真实分析结果
    ApiService.request('/api/spatial/ndvi/analyze', {
        method: 'POST',
        body: JSON.stringify({ year: year, thresholds: thresholds, compartment: compartment })
    }).then(function(resp) {
        if (resp && resp.success && resp.data) {
            resp.data.compartment = resp.data.compartment || compartment;
            showNdviResult(resp.data);
            btn.textContent = '已完成 ' + year + ' NDVI';
        } else {
            throw new Error('API返回无效数据');
        }
        btn.disabled = false;
    }).catch(function(e) {
        console.warn('NDVI分析API调用失败，使用离线数据:', e.message);
        _showNdviFallback(source, yearLabel, btn, thresholds, compartment);
    });
}

function _showNdviFallback(source, yearLabel, btn, thresholds, compartment) {
    var ndviValues = {
        'NDVI':  { avg:0.68, high:6820, mid:3280, low:1450, bare:560, degraded:3 },
        'NDVI2': { avg:0.72, high:7520, mid:3080, low:1250, bare:410, degraded:2 },
        'NDVI_1':{ avg:0.75, high:8100, mid:2850, low:1080, bare:330, degraded:1 },
    };
    var th = thresholds || { high:0.70, mid:0.40, low:0.15 };
    var vals = ndviValues[source] || ndviValues['NDVI'];
    var isSingle = compartment && compartment !== '全部林区';
    var scale = isSingle ? 0.22 : 1.0;
    showNdviResult({
        year: yearLabel[source] || '',
        compartment: compartment || '全部林区',
        avgNdvi: vals.avg,
        totalAreaMu: Math.round(12060 * scale),
        highArea: Math.round(vals.high * scale),
        midArea: Math.round(vals.mid * scale),
        lowArea: Math.round(vals.low * scale),
        bareArea: Math.round(vals.bare * scale),
        degradedCount: Math.max(1, Math.round(vals.degraded * scale)),
        areas: isSingle ? [{name: compartment, ndvi: vals.avg, level: '中植被'}] : _getFallbackAreasNdvi(vals.avg, th),
        thresholds: th,
        source: '离线数据(API不可用)'
    });
    btn.textContent = '已加载 ' + (yearLabel[source]||'') + ' NDVI';
    btn.disabled = false;
}

function showNdviResult(data) {
    var panel = document.getElementById('ndviResultPanel');
    if (panel) panel.style.display = 'flex';
    var detail = document.getElementById('ndviDetailList');
    if (detail) detail.style.display = 'block';
    var chart = document.getElementById('ndviChartArea');

    var isSingle = data.compartment && data.compartment !== '全部林区';

    // 单个林区时隐藏对比柱状图
    if (chart) chart.style.display = isSingle ? 'none' : 'block';
    if (detail) {
        var h4 = detail.querySelector('h4');
        if (h4) h4.textContent = isSingle ? (data.compartment + ' 植被覆盖分级详情') : '植被覆盖分级详情';
    }

    var avgEl = document.getElementById('ndviAvgValue');
    if (avgEl) avgEl.textContent = data.avgNdvi.toFixed(2);
    var hiEl = document.getElementById('ndviHighArea');
    if (hiEl) hiEl.textContent = (data.highArea || 0).toLocaleString() + ' 亩';
    var midEl = document.getElementById('ndviMidArea');
    if (midEl) midEl.textContent = (data.midArea || 0).toLocaleString() + ' 亩';
    var loEl = document.getElementById('ndviLowArea');
    if (loEl) loEl.textContent = (data.lowArea || 0).toLocaleString() + ' 亩';
    var baEl = document.getElementById('ndviBareArea');
    if (baEl) baEl.textContent = (data.bareArea || 0).toLocaleString() + ' 亩';
    var dgEl = document.getElementById('ndviDegraded');
    if (dgEl) dgEl.textContent = (data.degradedCount || 0) + ' 处';

    // 使用API返回的阈值
    var th = data.thresholds || { high:0.70, mid:0.40, low:0.15 };

    // 动态更新条形图
    if (data.areas && data.areas.length > 0) {
        if (isSingle) {
            _updateNdviDetailList(data.areas, th);
        } else {
            _updateNdviBarChart(data.areas, th);
            _updateNdviDetailList(data.areas, th);
        }
    }
}

// 保存最近一次NDVI阈值供图表渲染使用
var _lastNdviThresholds = null;

function _updateNdviBarChart(areas, th) {
    var chartArea = document.getElementById('ndviChartArea');
    if (!chartArea) return;
    th = th || { high:0.70, mid:0.40, low:0.15 };
    var midHi = (th.high + th.mid) / 2;
    var colors = ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c'];
    var html = '<h4 style="font-size:12px;color:#8ba4bc;margin-bottom:8px;">各林区NDVI对比</h4>';
    html += '<div class="fvc-bar-chart">';
    areas.forEach(function(a) {
        var pct = Math.round((a.ndvi || 0) * 100);
        var v = a.ndvi || 0;
        var color = v >= th.high ? colors[0] : v >= midHi ? colors[1] : v >= th.mid ? colors[2] : v >= th.low ? colors[3] : colors[4];
        html += '<div class="fvc-bar-row"><span class="fvc-bar-label">' + a.name + '</span>';
        html += '<div class="fvc-bar-track"><div class="fvc-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>';
        html += '<span class="fvc-bar-val">' + v.toFixed(2) + '</span></div>';
    });
    html += '</div>';
    chartArea.innerHTML = html;
}

function _updateNdviDetailList(areas, th) {
    var detail = document.getElementById('ndviDetailList');
    if (!detail) return;
    th = th || { high:0.70, mid:0.40, low:0.15 };
    var midHi = (th.high + th.mid) / 2;
    var html = '<h4>植被覆盖分级详情（用户自定义阈值）</h4>';
    html += '<div class="fvc-legend-bar">';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#1a9641;"></div><span>高植被 (&ge;' + th.high.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#a6d96a;"></div><span>中高植被 (' + midHi.toFixed(2) + '-' + th.high.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#ffffbf;"></div><span>中植被 (' + th.mid.toFixed(2) + '-' + midHi.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#fdae61;"></div><span>低植被 (' + th.low.toFixed(2) + '-' + th.mid.toFixed(2) + ')</span></div>';
    html += '<div class="fvc-legend-item"><div class="fvc-legend-color" style="background:#d7191c;"></div><span>裸地 (<' + th.low.toFixed(2) + ')</span></div>';
    html += '</div>';
    areas.forEach(function(a) {
        var v = a.ndvi || 0;
        var tagClass = v >= th.high ? 'tag-green' : v >= th.mid ? 'tag-green' : 'tag-orange';
        html += '<div class="blind-item"><span>' + a.name + ' NDVI=' + v.toFixed(2) + '</span><span class="tag ' + tagClass + ' tag-sm">' + (a.level || '') + '</span></div>';
    });
    detail.innerHTML = html;
}

function _getFallbackAreasNdvi(avg, th) {
    th = th || { high:0.70, mid:0.40, low:0.15 };
    var midHi = (th.high + th.mid) / 2;
    var variations = [0.07, -0.10, 0.12, -0.12, -0.02];
    var names = ['一号林区', '二号林区', '三号林区', '四号林区', '五号林区'];
    return names.map(function(n, i) {
        var v = Math.round(Math.max(0.05, Math.min(0.98, avg + variations[i])) * 100) / 100;
        var lvl = v >= th.high ? '高植被' : v >= midHi ? '中高植被' : v >= th.mid ? '中植被' : v >= th.low ? '低植被' : '裸地';
        return { name: n, ndvi: v, level: lvl };
    });
}

// ==================== 异常事件上报 ====================

function reportAbnormal() {
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="background:#0f1d33;border:1px solid #1a3355;border-radius:10px;width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);">' +
        '<div style="padding:16px 20px;border-bottom:1px solid #1a3355;display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="margin:0;color:#fff;font-size:16px;">📋 上报异常事件</h3>' +
            '<button id="btnCloseAbReport" style="background:none;border:none;color:#8ba4bc;font-size:18px;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 20px;">' +
            '<div class="form-group"><label style="color:#8ba4bc;">异常类型</label>' +
                '<select class="select-full" id="abReportType">' +
                    '<option value="fire">🔥 违规用火</option>' +
                    '<option value="theft">🪓 盗伐</option>' +
                    '<option value="pest">🐛 病虫害</option>' +
                    '<option value="geo">⛰ 地质灾害</option>' +
                    '<option value="trash">🗑 垃圾倾倒</option>' +
                    '<option value="occupy">🏗 非法占地</option>' +
                    '<option value="other">📌 其他异常</option>' +
                '</select></div>' +
            '<div class="form-group"><label style="color:#8ba4bc;">所在区域</label>' +
                '<select class="select-full" id="abReportArea">' +
                    '<option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option>' +
                '</select></div>' +
            '<div class="form-group"><label style="color:#8ba4bc;">风险等级</label>' +
                '<select class="select-full" id="abReportLevel">' +
                    '<option value="高">🔴 高</option><option value="中" selected>🟡 中</option><option value="低">🟢 低</option>' +
                '</select></div>' +
            '<div class="form-group"><label style="color:#8ba4bc;">异常描述</label>' +
                '<textarea id="abReportDesc" class="select-full" rows="3" style="background:#060e1a;color:#e4edf5;border:1px solid #1a3355;border-radius:6px;padding:8px;width:100%;resize:vertical;" placeholder="请详细描述异常情况..."></textarea></div>' +
            '<div class="form-row">' +
                '<div class="form-group half"><label style="color:#8ba4bc;">经度 (lng)</label><input type="number" id="abReportLng" step="0.0001" value="119.910" class="input-sm" style="width:100%;"/></div>' +
                '<div class="form-group half"><label style="color:#8ba4bc;">纬度 (lat)</label><input type="number" id="abReportLat" step="0.0001" value="28.510" class="input-sm" style="width:100%;"/></div>' +
            '</div>' +
            '<div class="form-group"><label style="color:#8ba4bc;">上报人/来源</label>' +
                '<input type="text" id="abReportSource" class="input-sm" style="width:100%;" placeholder="如：护林员张建国、无人机UAV-01..."/></div>' +
            '<div style="margin-top:16px;display:flex;gap:8px;">' +
                '<button id="btnSubmitAbReport" class="btn btn-primary" style="flex:1;">提交上报</button>' +
                '<button id="btnCancelAbReport" class="btn btn-outline" style="flex:1;">取消</button>' +
            '</div>' +
        '</div></div>';
    document.body.appendChild(modal);

    function closeModal() { modal.remove(); }
    document.getElementById('btnCloseAbReport').onclick = closeModal;
    document.getElementById('btnCancelAbReport').onclick = closeModal;
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    document.getElementById('btnSubmitAbReport').onclick = async function() {
        var btn = this;
        btn.textContent = '提交中...';
        btn.disabled = true;

        var typeMap = {
            'fire': '违规用火', 'theft': '盗伐', 'pest': '病虫害',
            'geo': '地质灾害', 'trash': '垃圾倾倒', 'occupy': '非法占地', 'other': '其他异常'
        };
        var typeVal = document.getElementById('abReportType').value;

        var data = {
            type: typeMap[typeVal] || typeVal,
            area: document.getElementById('abReportArea').value,
            desc: document.getElementById('abReportDesc').value || '未填写描述',
            level: document.getElementById('abReportLevel').value,
            lat: parseFloat(document.getElementById('abReportLat').value) || 28.510,
            lng: parseFloat(document.getElementById('abReportLng').value) || 119.910,
            source: document.getElementById('abReportSource').value || '未知来源',
        };

        try {
            var resp = await ApiService.createAbnormalEvent(data);
            if (resp && resp.success) {
                var newEvent = resp.data || resp;
                alert('✅ 异常事件上报成功！\n事件编号：' + newEvent.id);
                closeModal();
                // 直接追加到列表末尾，同时更新缓存
                if (typeof appendAbnormalItem === 'function') appendAbnormalItem(newEvent);
                // 刷新驾驶舱灾害态势总览事件数
                refreshDashboardStats();
            } else {
                throw new Error('上报失败');
            }
        } catch(e) {
            alert('❌ 上报失败：' + (e.message || '网络错误'));
            btn.textContent = '提交上报';
            btn.disabled = false;
        }
    };
}

async function refreshAbnormalList() {
    var body = document.querySelector('.abnormal-body');
    if (!body) return;

    try {
        var events = await ApiService.getAbnormalEvents('');
        if (!events || !events.length) {
            body.innerHTML = '<span style="color:#8ba4bc;font-size:12px;">暂无异常事件</span>';
            window._abnormalEventsCache = {};
            return;
        }

        // 缓存事件数据供 viewAbnormal 查找
        var cache = {};
        events.forEach(function(e) { cache[e.id] = e; });
        window._abnormalEventsCache = cache;

        var html = '';
        events.forEach(function(e) {
            var dotClass = e.level === '高' ? 'high' : e.level === '中' ? 'mid' : 'low';
            var tagClass = e.status === '处置中' ? 'tag-orange' : e.status === '已派发' ? 'tag-blue' : 'tag-green';
            var desc = (e.desc || '').length > 18 ? e.desc.substring(0, 18) + '...' : (e.desc || '');
            html += '<div class="abnormal-item" data-id="' + e.id + '" data-type="' + e.type + '">' +
                '<span class="ab-col ab-col-dot"><span class="ab-dot ' + dotClass + '"></span></span>' +
                '<span class="ab-col ab-col-name">' + e.id + ' · ' + e.type + '</span>' +
                '<span class="ab-col ab-col-forest">' + (e.area || '') + '</span>' +
                '<span class="ab-col ab-col-desc">' + desc + '</span>' +
                '<span class="ab-col ab-col-coord">N' + (e.lat||0).toFixed(2) + '° E' + (e.lng||0).toFixed(2) + '°</span>' +
                '<span class="ab-col ab-col-status"><span class="tag ' + tagClass + ' tag-sm">' + (e.status || '') + '</span></span>' +
                '<span class="ab-col ab-col-action"><button class="btn btn-sm btn-outline" onclick="viewAbnormal(\'' + e.id + '\')">查看</button></span>' +
                '</div>';
        });
        body.innerHTML = html;

        // 筛选使用全局 filterAbnormalItems，无需重新绑定
    } catch(e) {
        console.warn('刷新异常事件列表失败:', e.message);
        body.innerHTML = '<span style="color:#ff6e40;font-size:12px;">⚠ 加载失败，请确认已登录</span>';
    }
}

function appendAbnormalItem(e) {
    var body = document.querySelector('.abnormal-body');
    if (!body) return;

    // 去重：已存在则跳过
    if (window._abnormalEventsCache && window._abnormalEventsCache[e.id]) return;
    if (body.querySelector('[data-id="' + e.id + '"]')) return;

    // 更新缓存
    if (!window._abnormalEventsCache) window._abnormalEventsCache = {};
    window._abnormalEventsCache[e.id] = e;

    // 移除"加载中"占位
    var placeholder = body.querySelector('span');
    if (placeholder) placeholder.remove();

    var dotClass = e.level === '高' ? 'high' : e.level === '中' ? 'mid' : 'low';
    var tagClass = e.status === '处置中' ? 'tag-orange' : e.status === '已派发' ? 'tag-blue' : 'tag-green';
    var desc = (e.desc || '').length > 18 ? e.desc.substring(0, 18) + '...' : (e.desc || '');
    var item = document.createElement('div');
    item.className = 'abnormal-item';
    item.setAttribute('data-id', e.id || '');
    item.setAttribute('data-type', e.type || '');
    item.innerHTML = '<span class="ab-col ab-col-dot"><span class="ab-dot ' + dotClass + '"></span></span>' +
        '<span class="ab-col ab-col-name" style="color:#00e676;">' + e.id + ' · ' + e.type + '</span>' +
        '<span class="ab-col ab-col-forest">' + (e.area || '') + '</span>' +
        '<span class="ab-col ab-col-desc">' + desc + '</span>' +
        '<span class="ab-col ab-col-coord">N' + (e.lat||0).toFixed(2) + '° E' + (e.lng||0).toFixed(2) + '°</span>' +
        '<span class="ab-col ab-col-status"><span class="tag ' + tagClass + ' tag-sm">' + (e.status || '处置中') + '</span></span>' +
        '<span class="ab-col ab-col-action"><button class="btn btn-sm btn-outline" onclick="viewAbnormal(\'' + e.id + '\')">查看</button></span>';
    body.appendChild(item);
}

function filterAbnormalItems(type) {
    var items = document.querySelectorAll('.abnormal-item');
    items.forEach(function(item) {
        if (type === '全部类型' || item.dataset.type === type) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==================== 空间分析日期联动 ====================

function updateSpatialDates(type, value) {
    var yearMap = {
        'ndvi': { 'NDVI2': '2021', 'NDVI_1': '2022' },
        'fvc':  { 'fvc_2': '2021', 'fvc_1': '2022' }
    };
    var year = (yearMap[type] || {})[value] || '2021';
    var startEl = document.getElementById(type + 'StartDate');
    var endEl   = document.getElementById(type + 'EndDate');
    if (startEl) startEl.value = year + '-01-01';
    if (endEl)   endEl.value   = year + '-12-31';
}

// ==================== 异常事件查看处置 ====================
var abnormalMockData = {
    E001: { id:'E001', type:'违规用火', area:'一号林区', desc:'发现可疑火源，疑似违规野外用火，现场有焚烧痕迹和未燃尽的树枝', level:'high', time:'2026-06-10 16:42', status:'处理中', source:'护林员张建国上报', lat:'28.520', lng:'119.908', handler:'张建国', measure:'已现场制止并扑灭明火，对当事人进行警示教育，上报林业站备案' },
    E002: { id:'E002', type:'盗伐', area:'四号林区', desc:'监测到树木异常减少，卫星影像对比发现约15棵松树被非法砍伐', level:'mid', time:'2026-06-09 09:15', status:'已派发', source:'无人机UAV-01巡查发现', lat:'28.505', lng:'119.940', handler:'陈志强', measure:'已派发巡护二队前往现场核查取证，协调森林公安介入调查' },
    E003: { id:'E003', type:'垃圾倾倒', area:'二号林区', desc:'发现废弃塑料垃圾堆积，约3吨建筑和生活混合垃圾', level:'low', time:'2026-06-08 11:30', status:'已处理', source:'护林员李明辉上报', lat:'28.535', lng:'119.885', handler:'李明辉', measure:'已组织清理完毕，安装监控摄像头防止再次倾倒' }
};
function viewAbnormal(eid) {
    // 优先从API缓存查找，回退到mock数据
    var d = (window._abnormalEventsCache && window._abnormalEventsCache[eid]) || abnormalMockData[eid];
    if (!d) { console.warn('未找到事件:', eid); return; }
    var lvlColor = (d.level === 'high' || d.level === '高') ? '#ff3d3d' : (d.level === 'mid' || d.level === '中') ? '#ffab00' : '#00d5ff';
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="background:#0f1d33;border:1px solid #1a3355;border-radius:10px;width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);">' +
        '<div style="padding:16px 20px;border-bottom:1px solid #1a3355;display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="margin:0;color:#fff;font-size:16px;">异常事件详情 · ' + d.id + '</h3>' +
            '<button onclick="this.closest(\'div[style]\').parentElement.remove()" style="background:none;border:none;color:#8ba4bc;font-size:18px;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="padding:16px 20px;">' +
            '<div style="display:flex;gap:10px;margin-bottom:14px;">' +
                '<span style="background:' + lvlColor + ';color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">' + (d.level==='high'?'高危':d.level==='mid'?'中危':'低危') + '</span>' +
                '<span style="background:rgba(255,171,0,0.15);color:#ffab00;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">' + d.status + '</span>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">' +
                '<div><span style="color:#8ba4bc;">事件类型：</span><span style="color:#e4edf5;">' + d.type + '</span></div>' +
                '<div><span style="color:#8ba4bc;">所在区域：</span><span style="color:#e4edf5;">' + d.area + '</span></div>' +
                '<div><span style="color:#8ba4bc;">发现时间：</span><span style="color:#e4edf5;">' + d.time + '</span></div>' +
                '<div><span style="color:#8ba4bc;">上报来源：</span><span style="color:#e4edf5;">' + d.source + '</span></div>' +
                '<div><span style="color:#8ba4bc;">经度：</span><span style="color:#00d5ff;">' + d.lng + '</span></div>' +
                '<div><span style="color:#8ba4bc;">纬度：</span><span style="color:#00d5ff;">' + d.lat + '</span></div>' +
            '</div>' +
            '<div style="margin-top:12px;padding:12px;background:rgba(0,213,255,0.04);border-radius:6px;border-left:3px solid rgba(0,213,255,0.3);">' +
                '<div style="font-size:13px;color:#e4edf5;line-height:1.6;">' + d.desc + '</div>' +
            '</div>' +
            '<div style="margin-top:14px;padding-top:14px;border-top:1px solid #1a3355;">' +
                '<h4 style="margin:0 0 8px;color:#00d5ff;font-size:13px;">处置信息</h4>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;margin-bottom:10px;">' +
                    '<div><span style="color:#8ba4bc;">处置人：</span><span style="color:#e4edf5;">' + d.handler + '</span></div>' +
                '</div>' +
                '<div style="font-size:13px;color:#e4edf5;line-height:1.6;padding:10px;background:rgba(0,213,255,0.04);border-radius:4px;">' + d.measure + '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
}

// ==================== 动态面板刷新 ====================
// 从API加载灾害态势总览统计数据（火情/病害/异常/未处理事件数）
async function refreshDashboardStats() {
    if (ApiService.USE_MOCK || !currentUser) return;
    try {
        const stats = await ApiService.getStatsOverview();
        if (!stats) return;
        // 灾害态势总览
        setElText('dashFireCount', stats.fireCount);
        setElText('dashPestCount', stats.pestCount);
        setElText('dashAbnormalCount', stats.abnormalCount);
        setElText('dashUnhandledCount', stats.unhandledCount);
        // 火情分析面板
        setElText('fireAnalysisCount', stats.fireCount + ' 处');
        setElText('fireAnalysisArea', (stats.fireArea || 0) + ' 亩');
        setElText('fireAnalysisRisk', stats.fireRisk || '-');
        setElText('fireAnalysisTemp', (stats.fireMaxTemp || '-') + ' ℃');
        // 顶部统计卡片
        setElText('dashPatrolCount', stats.patrolCount);
        setElText('dashOnlineRangers', stats.onlineRangers);
        setElText('dashOnlineDrones', stats.onlineDrones);
        setElText('dashPatrolDistance', stats.patrolDistance);
        setElText('dashPatrolDuration', stats.patrolDuration);
        setElText('dashTaskCount', stats.taskCount);
    } catch (e) { /* 静默 */ }
}
function setElText(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.textContent = val;
}

// 从API加载护林员/无人机数据，更新仪表盘和实时监控侧栏
async function refreshPersonnelPanels() {
    if (ApiService.USE_MOCK || !currentUser) return;
    try {
        const [rangers, drones] = await Promise.all([
            ApiService.getRangers(),
            ApiService.getDrones()
        ]);
        if (rangers) _renderDashboardPersonnel(rangers, drones);
        if (rangers) _renderRealtimeRangers(rangers);
        if (drones)  _renderRealtimeDrones(drones);
    } catch (e) { /* 静默 */ }
}

function _renderDashboardPersonnel(rangers, drones) {
    const list = document.querySelector('#dashLeftPanel .person-list');
    if (!list) return;
    let html = '';
    rangers.forEach(r => {
        html += `<div class="person-item"><div class="person-avatar ranger">${r.name[0]}</div><div class="person-info"><div class="person-name">${r.name}</div><div class="person-status">${r.area} · ${r.id}</div></div><span class="status-online">在线</span></div>`;
    });
    drones.forEach(d => {
        const alt = d.altitudeM ? d.altitudeM.toFixed(0) + 'm' : '-';
        html += `<div class="person-item"><div class="person-avatar drone">U</div><div class="person-info"><div class="person-name">${d.code}</div><div class="person-status">${d.model} · 高度${alt}</div></div><span class="status-patrol">巡航中</span></div>`;
    });
    list.innerHTML = html;
}

function _renderRealtimeRangers(rangers) {
    const list = document.querySelector('#inner-ranger-rt .rt-person-list');
    if (!list) return;
    let html = '';
    rangers.forEach(r => {
        const tagClass = r.status === '在线' ? 'green' : 'gray';
        const tagText = r.status === '在线' ? '在线' : '离线';
        const speed = r.speedKmh ? r.speedKmh.toFixed(1) + 'km/h' : '-';
        const batt = r.batteryPercent ? Math.round(r.batteryPercent) + '%' : '-';
        const detail = r.status === '在线'
            ? `${r.area} · 速度${speed} · 电量${batt}`
            : `${r.area} · 最后在线 -`;
        html += `<div class="rt-person-item"><div class="rt-avatar ${tagClass}">${r.name[0]}</div><div class="rt-info"><div class="rt-name">${r.name} <span class="tag tag-${tagClass} tag-sm">${tagText}</span></div><div class="rt-detail">${detail}</div></div><button class="btn btn-sm btn-outline">轨迹</button></div>`;
    });
    list.innerHTML = html;
}

function _renderRealtimeDrones(drones) {
    const list = document.querySelector('#inner-drone-rt .rt-person-list');
    if (!list) return;
    let html = '';
    drones.forEach(d => {
        const alt = d.altitudeM ? d.altitudeM.toFixed(0) + 'm' : (d.altitude_m ? d.altitude_m.toFixed(0) + 'm' : '-');
        const heading = d.headingDeg ? d.headingDeg.toFixed(0) + '°' : '-';
        const batt = d.batteryPercent ? Math.round(d.batteryPercent) + '%' : '-';
        html += `<div class="rt-person-item"><div class="rt-avatar blue">${d.code.slice(-2)}</div><div class="rt-info"><div class="rt-name">${d.code} <span class="tag tag-blue tag-sm">${d.status}</span></div><div class="rt-detail">高度${alt} · 航向${heading} · 电量${batt}</div></div><button class="btn btn-sm btn-outline">航线</button></div>`;
    });
    list.innerHTML = html;
}

// ==================== 巡护力量台账 ====================
let _ledgerRangers = [], _ledgerDrones = [], _ledgerTeams = [];

async function refreshForceLedger() {
    if (ApiService.USE_MOCK || !currentUser) return;
    try {
        const [rangers, drones] = await Promise.all([ApiService.getRangers(), ApiService.getDrones()]);
        if (rangers) { _ledgerRangers = rangers; renderRangerTable(rangers); }
        if (drones)  { _ledgerDrones = drones; renderDroneTable(drones); }
        // 队伍从API获取
        const teams = await ApiService.request('/api/patrol/teams').catch(() => []);
        if (teams && teams.length) { _ledgerTeams = teams; renderTeamTable(teams); }
    } catch(e) { console.warn('台账刷新失败', e); }
}

function renderRangerTable(data) {
    const tbody = document.getElementById('rangerTableBody');
    const count = document.getElementById('rangerCount');
    if (!tbody) return;
    if (count) count.textContent = '共 ' + data.length + ' 人';
    tbody.innerHTML = data.map(r => {
        const sc = r.status === '在线' ? 'green' : 'gray';
        const speed = r.speedKmh ? r.speedKmh.toFixed(1) + ' km/h' : '-';
        const batt = r.batteryPercent ? Math.round(r.batteryPercent) + '%' : '-';
        return `<tr data-name="${r.name}" data-status="${r.status}" data-area="${r.area}" data-id="${r.id}">
            <td>${r.id}</td><td>${r.name}</td><td>${r.phone || '-'}</td><td>${r.area}</td>
            <td>${speed}</td><td>${batt}</td>
            <td><span class="tag tag-${sc}">${r.status}</span></td></tr>`;
    }).join('');
}

function filterRangerTable() {
    const keyword = (document.querySelector('#inner-ranger input[type="text"]')?.value || '').toLowerCase();
    const status = document.getElementById('rangerStatusFilterLedger')?.value || 'all';
    const rows = document.querySelectorAll('#rangerTableBody tr');
    let visible = 0;
    rows.forEach(row => {
        const name = (row.dataset.name || '').toLowerCase();
        const id = (row.dataset.id || '').toLowerCase();
        const area = (row.dataset.area || '').toLowerCase();
        const st = row.dataset.status || '';
        const matchText = !keyword || name.includes(keyword) || id.includes(keyword) || area.includes(keyword);
        const matchStatus = status === 'all' || st === status;
        row.style.display = (matchText && matchStatus) ? '' : 'none';
        if (matchText && matchStatus) visible++;
    });
    const count = document.getElementById('rangerCount');
    if (count) count.textContent = '显示 ' + visible + ' / ' + _ledgerRangers.length + ' 人';
}

function renderDroneTable(data) {
    const tbody = document.getElementById('droneTableBody');
    const count = document.getElementById('droneCount');
    if (!tbody) return;
    if (count) count.textContent = '共 ' + data.length + ' 架';
    tbody.innerHTML = data.map(d => {
        const batt = d.batteryPercent ? Math.round(d.batteryPercent) : 0;
        const battColor = batt > 70 ? 'high' : batt > 30 ? 'mid' : 'low';
        const sc = d.status === '巡航中' ? 'blue' : d.status === '待命' ? 'green' : 'orange';
        const alt = d.altitudeM ? d.altitudeM.toFixed(0) + 'm' : '-';
        const hrs = d.flightHours ? d.flightHours.toFixed(0) + 'h' : '-';
        return `<tr data-code="${d.code}" data-status="${d.status}" data-model="${d.model}">
            <td>${d.code}</td><td>${d.model}</td><td>${d.tag || '-'}</td>
            <td><div class="battery-bar"><div class="battery-fill ${battColor}" style="width:${batt}%"></div></div>${batt}%</td>
            <td>${alt}</td><td>${hrs}</td>
            <td><span class="tag tag-${sc}">${d.status}</span></td></tr>`;
    }).join('');
}

function filterDroneTable() {
    const keyword = (document.querySelector('#inner-drone input[type="text"]')?.value || '').toLowerCase();
    const status = document.getElementById('droneStatusFilterLedger')?.value || 'all';
    const rows = document.querySelectorAll('#droneTableBody tr');
    let visible = 0;
    rows.forEach(row => {
        const code = (row.dataset.code || '').toLowerCase();
        const model = (row.dataset.model || '').toLowerCase();
        const st = row.dataset.status || '';
        row.style.display = ((!keyword || code.includes(keyword) || model.includes(keyword)) && (status === 'all' || st === status)) ? '' : 'none';
        if (row.style.display !== 'none') visible++;
    });
    const count = document.getElementById('droneCount');
    if (count) count.textContent = '显示 ' + visible + ' / ' + _ledgerDrones.length + ' 架';
}

function renderTeamTable(data) {
    const tbody = document.getElementById('teamTableBody');
    const count = document.getElementById('teamCount');
    if (!tbody) return;
    if (count) count.textContent = '共 ' + data.length + ' 队';
    tbody.innerHTML = data.map(t => `<tr>
        <td>${t.id}</td><td>${t.name}</td><td>${t.leader}</td>
        <td>${t.memberCount}</td><td>${t.area}</td><td>${t.monthlyPatrols}</td></tr>`).join('');
}


function initSystemPage() {
    const isGuest = currentUser && currentUser.role === 'guest';
    if (isGuest) return;
    document.getElementById('page-system').innerHTML = `
    <div class="sub-tab-bar">
        <a class="sub-tab-item active" data-inner="inner-user-perm">用户权限管理</a>
        <a class="sub-tab-item" data-inner="inner-data-ops">数据运维</a>
        <a class="sub-tab-item" data-inner="inner-log-mgmt">日志管理</a>
        <a class="sub-tab-item" data-inner="inner-sys-monitor">系统监控</a>
    </div>
    <div class="content-full-panel">
        <div class="inner-tab active" id="inner-user-perm">
            <div class="panel-card"><div class="card-header"><h3>用户权限管理</h3><div class="card-actions"><button class="btn btn-primary">新增用户</button><button class="btn btn-outline">新增角色</button></div></div><div class="card-body">
                <div class="perm-section" style="margin-bottom:20px;"><h4 class="perm-section-title">用户账号</h4><table class="data-table perm-table"><thead><tr><th style="width:14%;">用户名</th><th style="width:14%;">姓名</th><th style="width:14%;">角色</th><th style="width:14%;">部门</th><th style="width:10%;">状态</th><th style="width:14%;">操作</th></tr></thead><tbody><tr><td>admin</td><td>系统管理员</td><td>超级管理员</td><td>信息中心</td><td><span class="tag tag-green">启用</span></td><td><a class="link-btn">编辑</a></td></tr><tr><td>zhangjg</td><td>张建国</td><td>护林员</td><td>巡护一队</td><td><span class="tag tag-green">启用</span></td><td><a class="link-btn">编辑</a><a class="link-btn">删除</a></td></tr><tr><td>dispatch</td><td>调度员</td><td>调度员</td><td>指挥中心</td><td><span class="tag tag-green">启用</span></td><td><a class="link-btn">编辑</a><a class="link-btn">删除</a></td></tr></tbody></table></div>
                <div class="perm-section" style="margin-bottom:20px;"><h4 class="perm-section-title">权限分配</h4><table class="data-table perm-table"><thead><tr><th style="width:16%;">角色</th><th style="width:14%;">综合驾驶舱</th><th style="width:14%;">资源与巡护</th><th style="width:14%;">监控与处置</th><th style="width:14%;">统计报表</th><th style="width:14%;">系统管理</th></tr></thead><tbody><tr><td>超级管理员</td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-green">全部</span></td></tr><tr><td>调度员</td><td><span class="tag tag-green">查看</span></td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-blue">查看</span></td><td><span class="tag tag-gray">无</span></td></tr><tr><td>护林员</td><td><span class="tag tag-blue">查看</span></td><td><span class="tag tag-orange">部分</span></td><td><span class="tag tag-orange">部分</span></td><td><span class="tag tag-gray">无</span></td><td><span class="tag tag-gray">无</span></td></tr><tr><td>无人机操作员</td><td><span class="tag tag-blue">查看</span></td><td><span class="tag tag-orange">部分</span></td><td><span class="tag tag-green">全部</span></td><td><span class="tag tag-gray">无</span></td><td><span class="tag tag-gray">无</span></td></tr></tbody></table></div>
                <div class="perm-section"><h4 class="perm-section-title">角色配置</h4><table class="data-table perm-table"><thead><tr><th style="width:20%;">角色名称</th><th style="width:36%;">描述</th><th style="width:14%;">用户数</th><th style="width:14%;">操作</th></tr></thead><tbody><tr><td>超级管理员</td><td>系统最高权限</td><td>1</td><td><a class="link-btn">编辑</a></td></tr><tr><td>调度员</td><td>任务派发、监控调度</td><td>3</td><td><a class="link-btn">编辑</a><a class="link-btn">删除</a></td></tr><tr><td>护林员</td><td>巡护执行、日志填报</td><td>18</td><td><a class="link-btn">编辑</a><a class="link-btn">删除</a></td></tr><tr><td>无人机操作员</td><td>无人机操控、数据采集</td><td>4</td><td><a class="link-btn">编辑</a><a class="link-btn">删除</a></td></tr></tbody></table></div>
            </div></div>
        </div>
        <div class="inner-tab" id="inner-data-ops"><div class="panel-card"><div class="card-header"><h3>数据运维</h3><div class="card-actions"><button class="btn btn-primary">数据导入</button><button class="btn btn-outline">数据备份</button></div></div><div class="card-body"><table class="data-table"><thead><tr><th>操作类型</th><th>数据集</th><th>执行时间</th><th>状态</th><th>操作</th></tr></thead><tbody><tr><td>备份</td><td>全量备份</td><td>2026-06-08 02:00</td><td><span class="tag tag-green">成功</span></td><td><a class="link-btn">恢复</a></td></tr><tr><td>备份</td><td>增量备份</td><td>2026-06-07 02:00</td><td><span class="tag tag-green">成功</span></td><td><a class="link-btn">恢复</a></td></tr><tr><td>导入</td><td>林班小班数据</td><td>2026-06-06 10:30</td><td><span class="tag tag-green">成功</span></td><td><a class="link-btn">查看</a></td></tr></tbody></table></div></div></div>
        <div class="inner-tab" id="inner-log-mgmt"><div class="panel-card"><div class="card-header"><h3>日志管理</h3></div><div class="card-body"><div class="search-bar"><select><option>全部类型</option><option>登录日志</option><option>操作日志</option><option>异常日志</option></select><input type="date"/><button class="btn btn-sm">查询</button></div><table class="data-table"><thead><tr><th>时间</th><th>类型</th><th>用户</th><th>内容</th><th>IP</th></tr></thead><tbody><tr><td>16:35</td><td>操作</td><td>admin</td><td>查看火情详情 F001</td><td>192.168.1.10</td></tr><tr><td>16:10</td><td>操作</td><td>dispatch</td><td>派发巡护任务至王大山</td><td>192.168.1.11</td></tr><tr><td>15:52</td><td>异常</td><td>系统</td><td>护林员轨迹偏离告警</td><td>-</td></tr><tr><td>08:00</td><td>登录</td><td>admin</td><td>用户登录系统</td><td>192.168.1.10</td></tr></tbody></table></div></div></div>
        <div class="inner-tab" id="inner-sys-monitor"><div class="panel-card"><div class="card-header"><h3>系统监控</h3></div><div class="card-body"><div class="stat-cards-row"><div class="mini-stat"><div class="mini-stat-value green">正常</div><div class="mini-stat-label">服务状态</div></div><div class="mini-stat"><div class="mini-stat-value green">正常</div><div class="mini-stat-label">数据库状态</div></div><div class="mini-stat"><div class="mini-stat-value blue">45%</div><div class="mini-stat-label">CPU使用率</div></div><div class="mini-stat"><div class="mini-stat-value orange">68%</div><div class="mini-stat-label">内存使用率</div></div></div><table class="data-table"><thead><tr><th>服务名称</th><th>端口</th><th>运行时长</th><th>状态</th></tr></thead><tbody><tr><td>Web应用服务</td><td>8080</td><td>15天3小时</td><td><span class="tag tag-green">运行中</span></td></tr><tr><td>GeoServer</td><td>8090</td><td>15天3小时</td><td><span class="tag tag-green">运行中</span></td></tr><tr><td>PostgreSQL</td><td>5432</td><td>15天3小时</td><td><span class="tag tag-green">运行中</span></td></tr><tr><td>Redis缓存</td><td>6379</td><td>15天3小时</td><td><span class="tag tag-green">运行中</span></td></tr></tbody></table></div></div></div>
    </div>`;
}
