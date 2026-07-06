// ==================== 数据服务抽象层 ====================
// USE_MOCK=false 时连接后端 FastAPI，BASE_URL 空字符串 = 同源
const ApiService = {
    USE_MOCK: false,
    BASE_URL: '',

    _getToken() {
        try {
            const user = JSON.parse(localStorage.getItem('fps_user') || '{}');
            return user.token || '';
        } catch (e) { return ''; }
    },

    async request(url, options = {}) {
        if (this.USE_MOCK) return null;
        const token = this._getToken();
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        const res = await fetch(this.BASE_URL + url, {
            headers,
            ...options
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    mock: {
        users: {
            admin: { password: 'admin', role: 'admin', name: '管理员' },
            guest: { password: 'guest', role: 'guest', name: '游客' }
        },
        // 【已禁用】旧贵阳Mock数据 — 已切换为浙江省丽水市白云山林场
        // 地图中心已改为丽水 [28.467, 119.922]
        // 边界/林区/点位数据由 ExperimentalLayerManager + ExperimentalPointFactory 基于 SHP 实时生成
        forestConfig: {
            center: [28.467, 119.922],
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

    async getDrones() {
        if (this.USE_MOCK) return this.mock.drones;
        return this.request('/api/drones');
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
        } catch(e) { localStorage.removeItem('fps_user'); }
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
        // 保存 token 到用户数据中
        if (result.token) {
            currentUser.token = result.token;
        }
        localStorage.setItem('fps_user', JSON.stringify(currentUser));
        document.getElementById('loginError').textContent = '';
        location.reload();
        return true;
    }
    return false;
}

function doLogout() {
    currentUser = null;
    localStorage.removeItem('fps_user');
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
    const loginBtn = this.querySelector('.btn-login');
    loginBtn.textContent = '登录中...';
    loginBtn.disabled = true;
    doLogin(username, password).then(success => {
        if (!success) {
            document.getElementById('loginError').textContent = '用户名或密码错误';
            loginBtn.textContent = '登 录';
            loginBtn.disabled = false;
        }
    }).catch(err => {
        document.getElementById('loginError').textContent = '连接失败: ' + err.message;
        loginBtn.textContent = '登 录';
        loginBtn.disabled = false;
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
}

// 地图实例由 MapFacade 统一管理（map-facade.js）
// 地图渲染由引擎适配器实现（map-engine-leaflet.js）

// ==================== 导航切换 ====================
const pageInited = {};
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        // 涟漪动画
        const ripple = document.createElement('span');
        ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(0,170,255,0.25);transform:scale(0);animation:navRipple 0.6s ease-out;pointer-events:none;width:120px;height:120px;left:${e.offsetX-60}px;top:${e.offsetY-60}px;`;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);

        const pageId = this.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        this.classList.add('active');
        if (!pageInited[pageId]) {
            pageInited[pageId] = true;
            if (pageId === 'page-resource') initResourcePage();
            if (pageId === 'page-spatial') initSpatialPage();
            if (pageId === 'page-disaster') { initDisasterPage(); setTimeout(initRecognitionGalleries, 400); }
            if (pageId === 'page-report') initReportPage();
            if (pageId === 'page-system') initSystemPage();
        }
        setTimeout(() => MapFacade.invalidateSize(), 100);
        setTimeout(layoutFloatTabItems, 150);
    });
});

// 二级导航切换
document.addEventListener('click', function(e) {
    const subNav = e.target.closest('.sub-nav-item');
    if (subNav && subNav.dataset.sub) {
        const parent = subNav.closest('.sub-nav-bar');
        parent.querySelectorAll('.sub-nav-item').forEach(n => n.classList.remove('active'));
        subNav.classList.add('active');
        const container = parent.nextElementSibling;
        container.querySelectorAll(':scope > .sub-page').forEach(p => p.classList.remove('active'));
        document.getElementById(subNav.dataset.sub).classList.add('active');
        setTimeout(() => MapFacade.invalidateSize(), 100);
        setTimeout(layoutFloatTabItems, 150);
    }
    const innerTab = e.target.closest('.sub-tab-item') || e.target.closest('.float-tab-item');
    if (innerTab && innerTab.dataset.inner) {
        // 更新同级按钮的active状态
        const btnGroup = innerTab.closest('.sub-tab-bar');
        if (btnGroup) {
            btnGroup.querySelectorAll('.sub-tab-item').forEach(n => n.classList.remove('active'));
        }
        // 更新同容器内float-tab-item的active状态
        const mapContainer = innerTab.closest('.map-full-container');
        if (mapContainer) {
            mapContainer.querySelectorAll('.float-tab-item').forEach(n => n.classList.remove('active'));
        }
        innerTab.classList.add('active');
        // 切换inner-tab
        const pageContainer = innerTab.closest('.sub-page') || innerTab.closest('.content-full-panel') || innerTab.closest('.page');
        if (pageContainer) {
            pageContainer.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(innerTab.dataset.inner).classList.add('active');
        }
        setTimeout(() => MapFacade.invalidateSize(), 100);
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
    console.log('[云山智巡] API数据加载成功，开始初始化地图...');
    MapFacade.create('dashMap', { center: forestCenter });
    MapFacade.addBaseLayers(forestBoundary, subCompartments, subColors, 'dashMap');
    await MapFacade.addAllMarkers('dashMap');
    console.log('[云山智巡] 驾驶舱地图初始化完成');
}).catch(err => {
    console.error('[云山智巡] 数据加载失败:', err);
    alert('后端连接失败(' + err.message + ')，请确认后端已启动: http://localhost:8000');
});

// ==================== 驾驶舱侧边栏（左右独立） ====================
// 动态计算图层管理侧边栏位置，使其左边缘与按钮右边缘对齐
function positionLayerSidebar() {
    const btn = document.getElementById('layerToggle');
    const sidebar = document.getElementById('layerSidebar');
    if (!btn || !sidebar) return;
    const container = btn.closest('.map-full-container');
    if (!container) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const btnRight = btnRect.right - containerRect.left;
    sidebar.style.left = btnRight + 'px';
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
        <a class="sub-tab-item active" data-inner="inner-base-data">基础数据管理</a>
        <a class="sub-tab-item" data-inner="inner-fire-analysis">火情分析</a>
        <a class="sub-tab-item" data-inner="inner-ndvi">NDVI分析</a>
        <a class="sub-tab-item" data-inner="inner-fvc">FVC植被覆盖度</a>
    </div>
    <div class="map-full-container">
        <div id="monSpatialMap"></div>
        <div class="float-panel" id="spatialPanel">
            <div class="inner-tab active" id="inner-base-data">
                <div class="panel-card"><div class="card-header"><h3>基础数据管理</h3><div class="card-actions"><button class="btn btn-primary">新增林场</button><button class="btn btn-outline">导入数据</button></div></div><div class="card-body">
                    <div style="margin-bottom:16px;"><h4 style="font-size:13px;color:#4fc3f7;margin-bottom:10px;border-bottom:1px solid rgba(30,58,95,0.5);padding-bottom:6px;">林场边界编辑</h4>
                        <div class="edit-tools">
                            <button class="btn btn-sm btn-outline edit-tool" title="绘制边界">✏ 绘制</button>
                            <button class="btn btn-sm btn-outline edit-tool" title="修改边界">✂ 修改</button>
                            <button class="btn btn-sm btn-outline edit-tool" title="删除边界">🗑 删除</button>
                            <button class="btn btn-sm btn-outline edit-tool" title="导入边界">📥 导入</button>
                        </div>
                        <div class="search-bar" style="margin-top:10px"><input type="text" placeholder="搜索林场名称..." style="font-size:11px"/><button class="btn btn-sm">查询</button></div>
                        <table class="data-table data-table-compact">
                            <thead><tr><th>编号</th><th>林场</th><th>面积(亩)</th><th>操作</th></tr></thead>
                            <tbody>
                                <tr><td>LC001</td><td>青山林场</td><td>12500</td><td><a class="link-btn">定位</a><a class="link-btn">编辑</a></td></tr>
                                <tr><td>LC002</td><td>翠湖林场</td><td>8600</td><td><a class="link-btn">定位</a><a class="link-btn">编辑</a></td></tr>
                                <tr><td>LC003</td><td>碧水林场</td><td>9800</td><td><a class="link-btn">定位</a><a class="link-btn">编辑</a></td></tr>
                            </tbody>
                        </table>
                        <div class="form-group" style="margin-top:10px"><label>管护站选择</label><select class="select-full"><option>总管护站</option><option>青山管护站</option><option>碧水管护站</option></select></div>
                    </div>
                    <div><h4 style="font-size:13px;color:#4fc3f7;margin-bottom:10px;border-bottom:1px solid rgba(30,58,95,0.5);padding-bottom:6px;">林班小班编辑</h4>
                        <div class="edit-tools">
                            <button class="btn btn-sm btn-outline edit-tool" title="新增小班">✏ 新增</button>
                            <button class="btn btn-sm btn-outline edit-tool" title="批量导入">📥 导入</button>
                        </div>
                        <div class="search-bar" style="margin-top:10px"><input type="text" placeholder="搜索林班/小班..." style="font-size:11px"/><button class="btn btn-sm">查询</button></div>
                        <table class="data-table data-table-compact">
                            <thead><tr><th>林班</th><th>小班</th><th>地类</th><th>操作</th></tr></thead>
                            <tbody>
                                <tr><td>1</td><td>1-1</td><td>有林地</td><td><a class="link-btn">定位</a><a class="link-btn">属性</a></td></tr>
                                <tr><td>1</td><td>1-2</td><td>有林地</td><td><a class="link-btn">定位</a><a class="link-btn">属性</a></td></tr>
                                <tr><td>2</td><td>2-1</td><td>灌木林地</td><td><a class="link-btn">定位</a><a class="link-btn">属性</a></td></tr>
                            </tbody>
                        </table>
                        <div class="edit-detail-form" style="margin-top:10px">
                            <div class="form-group"><label>小班属性编辑</label></div>
                            <div class="form-row"><div class="form-group half"><label>地类</label><select class="select-full"><option>有林地</option><option>灌木林地</option><option>疏林地</option></select></div><div class="form-group half"><label>优势树种</label><select class="select-full"><option>马尾松</option><option>杉木</option><option>阔叶混交</option></select></div></div>
                            <div class="form-row"><div class="form-group half"><label>面积(亩)</label><input type="number" value="320" class="input-sm"/></div><div class="form-group half"><label>郁闭度</label><input type="number" value="0.7" step="0.1" class="input-sm"/></div></div>
                            <div class="form-row"><div class="form-group half"><label>树龄(年)</label><input type="number" value="25" class="input-sm"/></div><div class="form-group half"><label>蓄积量(m3)</label><input type="number" value="180" class="input-sm"/></div></div>
                            <div class="form-group"><label>备注信息</label><input type="text" placeholder="管护单位、责任人等"/></div>
                            <button class="btn btn-primary btn-sm btn-block">保存属性</button>
                        </div>
                    </div>
                </div></div>
            </div>
            <div class="inner-tab" id="inner-fire-analysis">
                <div class="panel-card"><div class="card-header"><h3>遥感火情分析</h3></div><div class="card-body">
                    <p style="font-size:12px;color:#8899aa;margin-bottom:12px;">上传卫星遥感影像(TIF)，基于热红外波段进行火点检测</p>
                    <div class="form-group"><label>上传遥感影像</label><input type="file" id="spFireFile" accept=".tif,.tiff,.img" style="color:#8899aa;font-size:12px;"/></div>
                    <button class="btn btn-primary btn-block" onclick="runSpatialFireAnalysis()">🔥 上传并检测火情</button>
                    <div id="spFireStatus" style="margin-top:8px;font-size:12px;color:#4fc3f7;"></div>
                    <div id="spFireResult" class="analysis-result" style="margin-top:14px;display:none;"></div>
                </div></div>
            </div>
            <div class="inner-tab" id="inner-ndvi">
                <div class="panel-card"><div class="card-header"><h3>NDVI归一化植被指数分析</h3></div><div class="card-body">
                    <p style="font-size:12px;color:#8899aa;margin-bottom:12px;">上传卫星遥感影像(TIF)，计算归一化植被指数</p>
                    <div class="form-group"><label>上传遥感影像</label><input type="file" id="spNdviFile" accept=".tif,.tiff" style="color:#8899aa;font-size:12px;"/></div>
                    <div class="form-row"><div class="form-group half"><label>近红外波段(NIR)</label><input type="number" id="spNdviNir" value="4" min="1" max="10"/></div><div class="form-group half"><label>红光波段(RED)</label><input type="number" id="spNdviRed" value="3" min="1" max="10"/></div></div>
                    <button class="btn btn-primary btn-block" onclick="runSpatialNdviAnalysis()">🌿 上传并计算NDVI</button>
                    <div id="spNdviStatus" style="margin-top:8px;font-size:12px;color:#4fc3f7;"></div>
                    <div id="spNdviResult" class="analysis-result" style="margin-top:14px;display:none;"></div>
                </div></div>
            </div>
            <div class="inner-tab" id="inner-fvc">
                <div class="panel-card"><div class="card-header"><h3>FVC植被覆盖度分析</h3></div><div class="card-body">
                    <p style="font-size:12px;color:#4fc3f7;margin-bottom:10px;padding:8px;background:rgba(79,195,247,0.08);border-radius:4px;">📡 方式一：上传遥感影像文件(TIF)，自动计算植被覆盖度</p>
                    <div class="form-group"><label>上传遥感影像</label><input type="file" id="spFvcFile" accept=".tif,.tiff" style="color:#8899aa;font-size:12px;"/></div>
                    <button class="btn btn-primary btn-block" onclick="runSpatialFvcAnalysis()">🌲 上传并计算FVC</button>
                    <div id="spFvcStatus" style="margin-top:8px;font-size:12px;color:#4fc3f7;"></div>
                    <div id="spFvcResult" class="analysis-result" style="margin-top:14px;display:none;"></div>
                    <hr style="border-color:rgba(30,58,95,0.4);margin:16px 0;"/>
                    <p style="font-size:11px;color:#8899aa;margin-bottom:8px;">📊 方式二：参数化分析（已有数据）</p>
                    <div class="form-group"><label>数据源</label><select class="select-full" id="fvcDataSource"><option>Sentinel-2 卫星影像</option><option>Landsat-8 卫星影像</option><option>GF-1 卫星影像</option><option>无人机多光谱</option></select></div>
                    <div class="form-group"><label>分析区域</label><select class="select-full" id="fvcArea"><option>全部林区</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>
                    <div class="form-row"><div class="form-group half"><label>起始日期</label><input type="date" id="fvcStartDate" value="2026-05-01"/></div><div class="form-group half"><label>结束日期</label><input type="date" id="fvcEndDate" value="2026-06-10"/></div></div>
                    <div class="form-group"><label>分辨率</label><select class="select-full" id="fvcResolution"><option>10m</option><option>20m</option><option>30m</option></select></div>
                    <div class="form-group"><label>分类阈值设置</label>
                        <div class="fvc-threshold-group">
                            <div class="threshold-item"><span class="threshold-label">高覆盖</span><input type="number" class="input-sm" value="0.75" step="0.05" min="0" max="1" id="fvcHigh"/><span class="threshold-unit">≥</span></div>
                            <div class="threshold-item"><span class="threshold-label">中覆盖</span><input type="number" class="input-sm" value="0.45" step="0.05" min="0" max="1" id="fvcMid"/><span class="threshold-unit">≥</span></div>
                            <div class="threshold-item"><span class="threshold-label">低覆盖</span><input type="number" class="input-sm" value="0.15" step="0.05" min="0" max="1" id="fvcLow"/><span class="threshold-unit">≥</span></div>
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
        MapFacade.addBaseLayers(forestBoundary, subCompartments, subColors, 'monSpatialMap');
        await MapFacade.addAllMarkers('monSpatialMap');
        MapFacade.invalidateSize();
        layoutFloatTabItems();
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
    <div class="content-full-panel">
        <div class="inner-tab active" id="inner-fire-identify">
            <div class="panel-card"><div class="card-header"><h3>火情AI识别</h3><div class="card-actions"><button class="btn btn-primary" onclick="document.getElementById('fireUploadInput').click()">上传图像</button><input type="file" id="fireUploadInput" accept="image/*" style="display:none" onchange="handleFireUpload(this)"><button class="btn btn-outline">无人机图像导入</button></div></div><div class="card-body">
                <div class="identify-toolbar" style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
                    <span style="color:#8899aa;font-size:12px;">图像来源：</span>
                    <select class="select-full" style="max-width:160px;"><option>全部</option><option>无人机拍摄</option><option>人工拍摄</option></select>
                    <span style="color:#8899aa;font-size:12px;margin-left:12px;">识别状态：</span>
                    <select class="select-full" style="max-width:140px;"><option>全部</option><option>高危</option><option>疑似</option><option>正常</option></select>
                </div>
                <div class="identify-gallery" id="fireGallery" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
                </div>
                <div style="margin-top:12px;display:flex;justify-content:center;gap:8px;">
                    <button class="btn btn-sm btn-outline" onclick="switchFirePage('prev')">上一页</button>
                    <span id="firePageInfo" style="color:#8899aa;font-size:12px;line-height:30px;">第 1 / 3 页</span>
                    <button class="btn btn-sm btn-outline" onclick="switchFirePage('next')">下一页</button>
                </div>
            </div></div>
        </div>
        <div class="inner-tab" id="inner-pest-identify">
            <div class="panel-card"><div class="card-header"><h3>疫情AI识别</h3><div class="card-actions"><button class="btn btn-primary" onclick="document.getElementById('pestUploadInput').click()">上传图像</button><input type="file" id="pestUploadInput" accept="image/*" style="display:none" onchange="handlePestUpload(this)"><button class="btn btn-outline">无人机图像导入</button></div></div><div class="card-body">
                <div class="identify-toolbar" style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
                    <span style="color:#8899aa;font-size:12px;">图像来源：</span>
                    <select class="select-full" style="max-width:160px;"><option>全部</option><option>无人机拍摄</option><option>人工拍摄</option></select>
                    <span style="color:#8899aa;font-size:12px;margin-left:12px;">识别状态：</span>
                    <select class="select-full" style="max-width:140px;"><option>全部</option><option>高危</option><option>疑似</option><option>正常</option></select>
                </div>
                <div class="identify-gallery" id="pestGallery" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
                </div>
                <div style="margin-top:12px;display:flex;justify-content:center;gap:8px;">
                    <button class="btn btn-sm btn-outline" onclick="switchPestPage('prev')">上一页</button>
                    <span id="pestPageInfo" style="color:#8899aa;font-size:12px;line-height:30px;">第 1 / 2 页</span>
                    <button class="btn btn-sm btn-outline" onclick="switchPestPage('next')">下一页</button>
                </div>
            </div></div>
        </div>
        <div class="inner-tab" id="inner-abnormal-mgmt"><div class="panel-card"><div class="card-header"><h3>异常事件</h3><div class="card-actions"><button class="btn btn-primary">上报事件</button></div></div><div class="card-body"><div class="event-type-filter"><button class="btn btn-sm btn-outline active">全部</button><button class="btn btn-sm btn-outline">盗伐</button><button class="btn btn-sm btn-outline">非法占地</button><button class="btn btn-sm btn-outline">垃圾倾倒</button><button class="btn btn-sm btn-outline">违规用火</button></div><table class="data-table"><thead><tr><th>编号</th><th>类型</th><th>位置</th><th>上报人</th><th>状态</th><th>负责人</th></tr></thead><tbody><tr><td>E001</td><td>违规用火</td><td>一号林区南侧</td><td>张建国</td><td><span class="tag tag-orange">处理中</span></td><td><div style="font-size:12px;"><div>张建国</div><div style="color:#8899aa;font-size:11px;">138-0001-1234</div></div></td></tr><tr><td>E002</td><td>盗伐</td><td>四号林区西侧</td><td>UAV-03</td><td><span class="tag tag-blue">已派发</span></td><td><div style="font-size:12px;"><div>陈志强</div><div style="color:#8899aa;font-size:11px;">139-0002-5678</div></div></td></tr></tbody></table></div></div></div>
        <div class="inner-tab" id="inner-risk-warning">
            <div class="panel-card"><div class="card-header"><h3>综合风险预警</h3><div class="card-actions"><button class="btn btn-primary" onclick="runRiskAssessment()">执行风险评估</button><button class="btn btn-outline" onclick="exportRiskReport()">导出评估报告</button></div></div><div class="card-body">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div class="panel-card" style="margin:0;"><div class="card-header"><h3>评估参数配置</h3></div><div class="card-body">
                        <div class="form-group"><label>评估区域</label><select class="select-full"><option>全部林区</option><option>一号林区</option><option>二号林区</option><option>三号林区</option><option>四号林区</option><option>五号林区</option></select></div>
                        <div class="form-group"><label>灾害类型</label><select class="select-full"><option>综合评估</option><option>森林火灾</option><option>林业有害生物</option><option>气象灾害</option><option>地质灾害</option></select></div>
                        <div class="form-group"><label>评估时间范围</label><div class="form-row"><div class="form-group half"><input type="date" value="2026-06-01"/></div><div class="form-group half"><input type="date" value="2026-06-10"/></div></div></div>
                        <div class="form-group"><label>气象权重</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="30" style="flex:1;accent-color:var(--accent-blue);"/><span style="color:var(--text-secondary);font-size:12px;min-width:32px;">30%</span></div></div>
                        <div class="form-group"><label>地形权重</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="25" style="flex:1;accent-color:var(--accent-blue);"/><span style="color:var(--text-secondary);font-size:12px;min-width:32px;">25%</span></div></div>
                        <div class="form-group"><label>植被权重</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="25" style="flex:1;accent-color:var(--accent-blue);"/><span style="color:var(--text-secondary);font-size:12px;min-width:32px;">25%</span></div></div>
                        <div class="form-group"><label>人为活动权重</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="20" style="flex:1;accent-color:var(--accent-blue);"/><span style="color:var(--text-secondary);font-size:12px;min-width:32px;">20%</span></div></div>
                        <div class="form-group"><label>预警阈值</label><select class="select-full"><option>中风险（60分）</option><option>低风险（40分）</option><option>高风险（80分）</option></select></div>
                    </div></div>
                    <div class="panel-card" style="margin:0;"><div class="card-header"><h3>风险等级概览</h3></div><div class="card-body">
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
                            <div style="text-align:center;padding:12px 8px;border-radius:6px;background:rgba(255,61,61,0.1);border:1px solid rgba(255,61,61,0.2);"><div style="font-size:24px;font-weight:700;color:#ff3d3d;">2</div><div style="font-size:11px;color:#ff3d3d;margin-top:4px;">极高风险</div></div>
                            <div style="text-align:center;padding:12px 8px;border-radius:6px;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.2);"><div style="font-size:24px;font-weight:700;color:#ff9800;">3</div><div style="font-size:11px;color:#ff9800;margin-top:4px;">高风险</div></div>
                            <div style="text-align:center;padding:12px 8px;border-radius:6px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);"><div style="font-size:24px;font-weight:700;color:#ffc107;">5</div><div style="font-size:11px;color:#ffc107;margin-top:4px;">中风险</div></div>
                            <div style="text-align:center;padding:12px 8px;border-radius:6px;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.2);"><div style="font-size:24px;font-weight:700;color:#4caf50;">8</div><div style="font-size:11px;color:#4caf50;margin-top:4px;">低风险</div></div>
                        </div>
                        <div style="margin-bottom:12px;"><h4 style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">各林区风险评分</h4>
                            <div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>一号林区</span><span style="color:#ff3d3d;font-weight:600;">82分</span></div><div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="width:82%;height:100%;background:linear-gradient(90deg,#ff9800,#ff3d3d);border-radius:3px;"></div></div></div>
                            <div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>二号林区</span><span style="color:#ff9800;font-weight:600;">67分</span></div><div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="width:67%;height:100%;background:linear-gradient(90deg,#ffc107,#ff9800);border-radius:3px;"></div></div></div>
                            <div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>三号林区</span><span style="color:#ff3d3d;font-weight:600;">91分</span></div><div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="width:91%;height:100%;background:linear-gradient(90deg,#ff3d3d,#d32f2f);border-radius:3px;"></div></div></div>
                            <div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>四号林区</span><span style="color:#ffc107;font-weight:600;">54分</span></div><div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="width:54%;height:100%;background:linear-gradient(90deg,#4caf50,#ffc107);border-radius:3px;"></div></div></div>
                            <div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>五号林区</span><span style="color:#4caf50;font-weight:600;">38分</span></div><div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="width:38%;height:100%;background:linear-gradient(90deg,#4caf50,#66bb6a);border-radius:3px;"></div></div></div>
                        </div>
                    </div></div>
                </div>
                <div class="panel-card" style="margin-top:16px;"><div class="card-header"><h3>风险事件列表</h3><div class="card-actions"><button class="btn btn-sm btn-outline">全部</button><button class="btn btn-sm btn-outline">极高风险</button><button class="btn btn-sm btn-outline">高风险</button><button class="btn btn-sm btn-outline">中风险</button></div></div><div class="card-body">
                    <table class="data-table"><thead><tr><th>编号</th><th>风险类型</th><th>关联区域</th><th>风险评分</th><th>风险等级</th><th>主要致险因子</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
                        <tr><td>RW001</td><td>森林火灾</td><td>三号林区</td><td><span style="color:#ff3d3d;font-weight:700;">91</span></td><td><span class="tag tag-red">极高风险</span></td><td>持续高温干旱 + 可燃物载量大</td><td>2026-06-10 08:30</td><td><a class="link-btn">详情</a><a class="link-btn">处置</a></td></tr>
                        <tr><td>RW002</td><td>森林火灾</td><td>一号林区</td><td><span style="color:#ff3d3d;font-weight:700;">82</span></td><td><span class="tag tag-red">极高风险</span></td><td>雷击火险 + 风力较大</td><td>2026-06-10 07:15</td><td><a class="link-btn">详情</a><a class="link-btn">处置</a></td></tr>
                        <tr><td>RW003</td><td>林业有害生物</td><td>二号林区</td><td><span style="color:#ff9800;font-weight:700;">67</span></td><td><span class="tag tag-orange">高风险</span></td><td>松材线虫扩散 + 防治滞后</td><td>2026-06-09 16:45</td><td><a class="link-btn">详情</a><a class="link-btn">处置</a></td></tr>
                        <tr><td>RW004</td><td>气象灾害</td><td>一号林区</td><td><span style="color:#ff9800;font-weight:700;">63</span></td><td><span class="tag tag-orange">高风险</span></td><td>暴雨预警 + 低洼地形</td><td>2026-06-09 14:20</td><td><a class="link-btn">详情</a><a class="link-btn">处置</a></td></tr>
                        <tr><td>RW005</td><td>地质灾害</td><td>四号林区</td><td><span style="color:#ff9800;font-weight:700;">58</span></td><td><span class="tag tag-orange">高风险</span></td><td>坡度>35° + 土壤含水饱和</td><td>2026-06-09 11:00</td><td><a class="link-btn">详情</a><a class="link-btn">处置</a></td></tr>
                        <tr><td>RW006</td><td>林业有害生物</td><td>四号林区</td><td><span style="color:#ffc107;font-weight:700;">54</span></td><td><span class="tag tag-yellow" style="background:rgba(255,193,7,0.15);color:#ffc107;border:1px solid rgba(255,193,7,0.3);padding:2px 8px;border-radius:10px;font-size:11px;">中风险</span></td><td>美国白蛾监测阳性</td><td>2026-06-08 09:30</td><td><a class="link-btn">详情</a><a class="link-btn">处置</a></td></tr>
                    </tbody></table>
                </div></div>
            </div></div>
        </div>
    </div>`;
}

// ==================== 图像识别交互函数 ====================
// fireImageData, pestImageData 已在 initAppData() 中异步加载

function generateFireSVG(type, idx) {
    const uid = 'fs' + idx;
    const confidences = [92.3, 87.5, 78.1, 95.6, 83.2, 71.4, 96.8, 79.3, 88.9, 74.5, 91.7, 85.3, 77.8, 93.1, 82.6, 90.4];
    const conf = confidences[idx % confidences.length];
    const barW = Math.round(conf * 0.4);
    const barColor = conf >= 90 ? '#ff3d3d' : conf >= 80 ? '#ff9800' : '#4fc3f7';

    if (type === 'real') {
        // AI实时检测结果 - 由 renderGallery 处理 imageBase64
        return '';
    } else if (type === 'fire') {
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
    if (!gallery || !data.length) return 0;
    const totalPages = Math.ceil(data.length / PER_PAGE);
    const start = (page - 1) * PER_PAGE;
    const pageData = data.slice(start, start + PER_PAGE);
    gallery.innerHTML = pageData.map((item, i) => {
        const isHigh = item.level === 'high';
        const isMid = item.level === 'mid';
        const borderStyle = isHigh ? 'border:2px solid #ff3d3d;' : 'border:1px solid #2a3a4a;';
        const tagBg = isHigh ? 'rgba(255,61,61,0.9)' : isMid ? 'rgba(255,152,0,0.9)' : 'rgba(0,230,118,0.9)';
        const tagText = isHigh ? '高危' : isMid ? '疑似' : '正常';
        // AI实时检测：显示base64标注图，否则显示模拟SVG
        const imgContent = item.imageBase64
            ? `<img src="${item.imageBase64}" style="width:100%;display:block;" alt="AI检测结果"/>`
            : svgGenerator(item.svgType, start + i);
        return `<div class="identify-card${isHigh ? ' high-risk' : ''}" onclick="showImageInfo(this)" data-lat="${item.lat}" data-lng="${item.lng}" data-source="${item.source}" data-time="${item.time}" data-result="${item.result}" data-image-base64="${item.imageBase64 || ''}" style="position:relative;border-radius:8px;overflow:hidden;${borderStyle}cursor:pointer;">
            ${imgContent}
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

// 初始化识别图库（在灾害页面创建后调用）
function initRecognitionGalleries() {
    if (typeof fireImageData === 'undefined') return;
    const ftp = renderGallery('fireGallery', fireImageData, 1, generateFireSVG);
    const fInfo = document.getElementById('firePageInfo');
    if (fInfo) fInfo.textContent = `第 1 / ${ftp} 页`;
    const ptp = renderGallery('pestGallery', pestImageData, 1, generatePestSVG);
    const pInfo = document.getElementById('pestPageInfo');
    if (pInfo) pInfo.textContent = `第 1 / ${ptp} 页`;
}

// 页面加载时尝试初始化（如果 fireData 已提前加载完成且元素存在）
setTimeout(() => { initRecognitionGalleries(); }, 500);

// ==================== 火情AI识别 - 上传图片检测 ====================
let fireDetectCounter = 0;

async function handleFireUpload(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    const gallery = document.getElementById('fireGallery');
    if (!gallery) return;

    gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;">
        <div style="color:#4fc3f7;font-size:14px;">
            <div style="margin-bottom:8px;">&#9203;</div>
            正在使用AI模型检测火情，请稍候...
        </div>
    </div>`;

    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('http://localhost:5000/api/recognition/detect', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:#ff5252;">检测失败: ${data.error}</div>`;
            return;
        }

        fireDetectCounter++;
        const newItem = {
            id: 'AI' + String(fireDetectCounter).padStart(3, '0'),
            area: '实时检测',
            label: data.filename || '检测图片',
            source: 'AI实时检测',
            time: data.timestamp,
            result: data.result_text,
            level: data.level,
            lat: '',
            lng: '',
            svgType: 'real',
            imageBase64: data.image_base64
        };

        fireImageData.unshift(newItem);
        fireCurrentPage = 1;
        const tp = renderGallery('fireGallery', fireImageData, 1, generateFireSVG);
        const info = document.getElementById('firePageInfo');
        if (info) info.textContent = `第 1 / ${tp} 页`;

    } catch (err) {
        gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:#ff5252;">
            无法连接AI检测服务，请确认Flask后端已启动(端口5000)
        </div>`;
    }
}

let pestDetectCounter = 0;

async function handlePestUpload(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    const gallery = document.getElementById('pestGallery');
    if (!gallery) return;

    gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;">
        <div style="color:#4fc3f7;font-size:14px;">⏳ 正在使用AI模型检测病虫，请稍候...</div>
    </div>`;

    try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('http://localhost:5000/api/recognition/detect', {
            method: 'POST', body: formData
        });
        const data = await response.json();

        if (!data.success) {
            gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:#ff5252;">检测失败: ${data.error}</div>`;
            return;
        }

        pestDetectCounter++;
        const newItem = {
            id: 'AP' + String(pestDetectCounter).padStart(3, '0'),
            area: '实时检测',
            label: data.filename || '检测图片',
            source: 'AI实时检测',
            time: data.timestamp,
            result: data.result_text,
            level: data.level,
            lat: '', lng: '',
            svgType: 'real',
            imageBase64: data.image_base64
        };

        pestImageData.unshift(newItem);
        pestCurrentPage = 1;
        const tp = renderGallery('pestGallery', pestImageData, 1, generatePestSVG);
        const info = document.getElementById('pestPageInfo');
        if (info) info.textContent = `第 1 / ${tp} 页`;

    } catch (err) {
        gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:#ff5252;">
            无法连接AI检测服务，请确认Flask后端已启动(端口5000)
        </div>`;
    }
}

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

function runRiskAssessment() {
    const btn = event.target;
    btn.textContent = '评估中...';
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = '执行风险评估';
        btn.disabled = false;
        alert('风险评估完成！已更新各林区风险等级。');
    }, 2000);
}

function exportRiskReport() {
    alert('评估报告已生成，正在导出PDF...');
}

// ==================== 遥感影像分析 ====================
const FLASK_API = 'http://localhost:5000';

async function uploadAndAnalyze(fileInputId, analysisType, params, statusId, resultId) {
    const fileInput = document.getElementById(fileInputId);
    const file = fileInput?.files[0];
    if (!file) { alert('请先选择遥感影像文件(TIF)'); return; }

    const status = document.getElementById(statusId);
    if (status) status.textContent = '⏳ 正在上传影像...';

    try {
        // 1. 上传文件
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(FLASK_API + '/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error);

        if (status) status.textContent = '⏳ 正在执行分析...';

        // 2. 执行分析
        const analyzeRes = await fetch(FLASK_API + analysisType, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: uploadData.filepath, ...params })
        });
        const analyzeData = await analyzeRes.json();
        if (!analyzeData.success) throw new Error(analyzeData.error);

        // 3. 显示结果
        const resultDiv = document.getElementById(resultId);
        if (resultDiv) {
            resultDiv.style.display = 'flex';
            resultDiv.innerHTML = renderAnalysisResult(analysisType, analyzeData);
        }
        if (status) status.textContent = '✅ 分析完成';
    } catch (err) {
        if (status) status.textContent = '❌ 失败: ' + err.message;
    }
}

function renderAnalysisResult(type, data) {
    if (type === '/api/analyze/fire') {
        const s = data.statistics || {};
        return `<div class="result-item"><span class="result-label">火点数量</span><span class="result-value red">${s.total_fire_points || 0} 处</span></div>
        <div class="result-item"><span class="result-label">预估面积</span><span class="result-value red">${s.estimated_area_hectares || 0} 公顷</span></div>
        <div class="result-item"><span class="result-label">风险等级</span><span class="result-value red">${s.fire_risk_level || '-'}</span></div>
        <div class="result-item"><span class="result-label">最高温度</span><span class="result-value orange">${s.temperature_stats?.max_temp_c || '-'}°C</span></div>
        <div style="margin-top:8px"><img src="http://localhost:5000/api/result/${data.result_image?.split('/').pop()}" style="width:100%;border-radius:4px;max-height:250px;object-fit:contain;"/></div>`;
    }
    if (type === '/api/analyze/ndvi') {
        const s = data.statistics || {};
        return `<div class="result-item"><span class="result-label">平均NDVI</span><span class="result-value green">${s.mean || '-'}</span></div>
        <div class="result-item"><span class="result-label">最大NDVI</span><span class="result-value green">${s.max || '-'}</span></div>
        <div class="result-item"><span class="result-label">最小NDVI</span><span class="result-value orange">${s.min || '-'}</span></div>
        <div style="margin-top:8px"><img src="http://localhost:5000/api/result/${data.result_image?.split('/').pop()}" style="width:100%;border-radius:4px;max-height:250px;object-fit:contain;"/></div>`;
    }
    if (type === '/api/analyze/fvc') {
        const s = data.statistics || {};
        return `<div class="result-item"><span class="result-label">平均FVC</span><span class="result-value green">${s.mean_fvc || '-'}</span></div>
        <div class="result-item"><span class="result-label">植被覆盖率</span><span class="result-value blue">${s.vegetation_coverage_rate || '-'}%</span></div>
        <div style="margin-top:8px"><img src="http://localhost:5000/api/result/${data.result_image?.split('/').pop()}" style="width:100%;border-radius:4px;max-height:250px;object-fit:contain;"/></div>`;
    }
    return '';
}

function runSpatialFireAnalysis() {
    uploadAndAnalyze('spFireFile', '/api/analyze/fire',
        { thermal_band: 1, nir_band: 2, red_band: 3, temp_threshold: 320, ndvi_threshold: 0.1 },
        'spFireStatus', 'spFireResult');
}
function runSpatialNdviAnalysis() {
    const nir = parseInt(document.getElementById('spNdviNir')?.value) || 4;
    const red = parseInt(document.getElementById('spNdviRed')?.value) || 3;
    uploadAndAnalyze('spNdviFile', '/api/analyze/ndvi',
        { nir_band: nir, red_band: red },
        'spNdviStatus', 'spNdviResult');
}
function runSpatialFvcAnalysis() {
    uploadAndAnalyze('spFvcFile', '/api/analyze/fvc',
        { nir_band: 4, red_band: 3 },
        'spFvcStatus', 'spFvcResult');
}

// ==================== FVC植被覆盖度分析（保留原有兼容） ====================
async function runFvcAnalysis() {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '分析中...';
    btn.disabled = true;

    const params = {
        dataSource: document.getElementById('fvcDataSource')?.value || 'Sentinel-2 卫星影像',
        area: document.getElementById('fvcArea')?.value || '全部林区',
        startDate: document.getElementById('fvcStartDate')?.value || '2026-05-01',
        endDate: document.getElementById('fvcEndDate')?.value || '2026-06-10',
        resolution: document.getElementById('fvcResolution')?.value || '10m',
        thresholdHigh: parseFloat(document.getElementById('fvcHigh')?.value) || 0.75,
        thresholdMid: parseFloat(document.getElementById('fvcMid')?.value) || 0.45,
        thresholdLow: parseFloat(document.getElementById('fvcLow')?.value) || 0.15
    };

    try {
        const result = await ApiService.runFvcAnalysis(params);
        if (result && result.success) {
            const d = result.data;
            const panel = document.getElementById('fvcResultPanel');
            if (panel) {
                panel.style.display = 'flex';
                document.getElementById('fvcAvgValue').textContent = d.avgFvc.toFixed(2);
                document.getElementById('fvcHighArea').textContent = d.highCoverArea.toLocaleString() + ' 亩';
                document.getElementById('fvcMidArea').textContent = d.midCoverArea.toLocaleString() + ' 亩';
                document.getElementById('fvcLowArea').textContent = d.lowCoverArea.toLocaleString() + ' 亩';
                document.getElementById('fvcBareArea').textContent = d.bareArea.toLocaleString() + ' 亩';
                document.getElementById('fvcDegraded').textContent = d.degradedCount + ' 处';
            }
            const detailList = document.getElementById('fvcDetailList');
            if (detailList) {
                detailList.style.display = 'block';
                const items = detailList.querySelectorAll('.blind-item');
                d.areas.forEach((a, i) => {
                    if (items[i]) {
                        items[i].querySelector('span:first-child').textContent = a.name + ' FVC=' + a.fvc.toFixed(2);
                        const tag = items[i].querySelector('.tag');
                        if (tag) {
                            tag.textContent = a.level;
                            tag.className = 'tag tag-sm ' + (a.fvc >= 0.75 ? 'tag-green' : a.fvc >= 0.45 ? 'tag-orange' : 'tag-red');
                        }
                    }
                });
            }
            const chartArea = document.getElementById('fvcChartArea');
            if (chartArea) {
                chartArea.style.display = 'block';
                const barRows = chartArea.querySelectorAll('.fvc-bar-row');
                d.areas.forEach((a, i) => {
                    if (barRows[i]) {
                        barRows[i].querySelector('.fvc-bar-label').textContent = a.name;
                        const fill = barRows[i].querySelector('.fvc-bar-fill');
                        fill.style.width = (a.fvc * 100) + '%';
                        const color = a.fvc >= 0.75 ? 'linear-gradient(90deg,#1a9641,#006837)' :
                                      a.fvc >= 0.6 ? 'linear-gradient(90deg,#a6d96a,#1a9641)' :
                                      a.fvc >= 0.45 ? 'linear-gradient(90deg,#ffffbf,#a6d96a)' :
                                      'linear-gradient(90deg,#fdae61,#ffffbf)';
                        fill.style.background = color;
                        barRows[i].querySelector('.fvc-bar-val').textContent = a.fvc.toFixed(2);
                    }
                });
            }
            if (d.degradedAreas) {
                MapFacade.addFvcMarkers(d.degradedAreas, 'monSpatialMap');
            }
        }
    } catch (err) {
        console.error('FVC分析失败:', err);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ==================== 火点查看处置 ====================
// firePointData 已在 initAppData() 中异步加载

function viewFirePoint(fid) {
    const f = firePointData[fid];
    if (!f) return;
    const levelColor = f.level === '较大' ? '#ff3d3d' : '#ff9800';
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `<div style="background:#1a2332;border:1px solid #2a3a4a;border-radius:10px;width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <div style="padding:16px 20px;border-bottom:1px solid #2a3a4a;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;color:#fff;font-size:16px;">火点详情 · ${f.id}</h3>
            <button onclick="this.closest('div[style]').parentElement.remove()" style="background:none;border:none;color:#8899aa;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:16px 20px;">
            <div style="display:flex;gap:12px;margin-bottom:14px;">
                <span style="background:${levelColor};color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">${f.level}</span>
                <span style="background:rgba(255,152,0,0.15);color:#ff9800;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;">${f.status}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">
                <div><span style="color:#8899aa;">位置：</span><span style="color:#e0e6ed;">${f.area}</span></div>
                <div><span style="color:#8899aa;">发现时间：</span><span style="color:#e0e6ed;">${f.time}</span></div>
                <div><span style="color:#8899aa;">经度：</span><span style="color:#e0e6ed;">${f.lng}</span></div>
                <div><span style="color:#8899aa;">纬度：</span><span style="color:#e0e6ed;">${f.lat}</span></div>
                <div><span style="color:#8899aa;">风向风速：</span><span style="color:#e0e6ed;">${f.wind}</span></div>
                <div><span style="color:#8899aa;">蔓延方向：</span><span style="color:#ff9800;">${f.spread}</span></div>
                <div><span style="color:#8899aa;">蔓延速度：</span><span style="color:#ff9800;">${f.speed}</span></div>
                <div><span style="color:#8899aa;">影响面积：</span><span style="color:#ff3d3d;">${f.affected}</span></div>
            </div>
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid #2a3a4a;">
                <h4 style="margin:0 0 8px;color:#4fc3f7;font-size:13px;">处置信息</h4>
                <div style="font-size:13px;color:#e0e6ed;line-height:1.6;margin-bottom:8px;">${f.response}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">
                    <div><span style="color:#8899aa;">现场指挥：</span><span style="color:#e0e6ed;">${f.commander}</span></div>
                    <div><span style="color:#8899aa;">处置力量：</span><span style="color:#e0e6ed;">${f.forces}</span></div>
                </div>
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


// ==================== 巡护任务管理 CRUD ====================
async function createTask() {
    const name = document.getElementById("taskName")?.value.trim();
    if (!name) { alert("请输入任务名称"); return; }
    const data = {
        name: name,
        task_type: document.getElementById("taskType")?.value || "日常巡护",
        ranger: document.getElementById("taskRanger")?.value || "",
        drone: document.getElementById("taskDrone")?.value || "",
        area: document.getElementById("taskArea")?.value || "",
        description: document.getElementById("taskDesc")?.value || "",
        start_time: document.getElementById("taskStart")?.value || "",
        end_time: document.getElementById("taskEnd")?.value || "",
    };
    try {
        const res = await fetch("/api/patrol/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert("任务创建成功: " + result.task_code);
            ["taskName","taskDesc"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
            loadTasks();
        }
    } catch (err) { alert("创建失败: " + err.message); }
}

async function loadTasks() {
    const tbody = document.getElementById("taskTableBody");
    if (!tbody) return;
    try {
        const res = await fetch("/api/patrol/tasks");
        const tasks = await res.json();
        if (!tasks.length) {
            tbody.innerHTML = "<tr><td colspan=6 style=text-align:center;color:#8899aa;>暂无任务</td></tr>";
            return;
        }
        tbody.innerHTML = tasks.map(t => {
            const st = t.status === "执行中" ? "tag-green" : t.status === "已完成" ? "tag-blue" : "tag-orange";
            return '<tr><td>'+t.task_code+'</td><td>'+t.name+'</td><td>'+(t.executor||'-')+'</td><td><div class="progress-bar"><div class="progress-fill" style="width:'+t.progress+'%"></div></div> '+t.progress+'%</td><td><span class="tag '+st+'">'+t.status+'</span></td><td><a class="link-btn task-start" data-code="'+t.task_code+'">启动</a> <a class="link-btn task-finish" data-code="'+t.task_code+'">完成</a> <a class="link-btn task-delete" data-code="'+t.task_code+'">删除</a></td></tr>';
        }).join("");
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan=6 style=text-align:center;color:#ff5252;>加载失败</td></tr>";
    }
}

async function updateTaskStatus(code, status) {
    try {
        await fetch("/api/patrol/tasks/" + code, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status, progress: status === "已完成" ? 100 : 50 })
        });
        loadTasks();
    } catch (err) { alert("更新失败"); }
}

async function deleteTask(code) {
    if (!confirm("确认删除任务 " + code + "?")) return;
    try {
        await fetch("/api/patrol/tasks/" + code, { method: "DELETE" });
        loadTasks();
    } catch (err) { alert("删除失败"); }
}

const _origInitResource2 = initResourcePage;
initResourcePage = function() {
    _origInitResource2();
    setTimeout(loadTasks, 800);
};

// 任务表格事件委托（启动/完成/删除）
document.addEventListener("click", function(e) {
    const a = e.target.closest("a.link-btn");
    if (!a) return;
    const code = a.getAttribute("data-code");
    if (!code) return;
    if (a.classList.contains("task-start")) updateTaskStatus(code, "执行中");
    else if (a.classList.contains("task-finish")) updateTaskStatus(code, "已完成");
    else if (a.classList.contains("task-delete")) deleteTask(code);
});


// ==================== 巡护日志 ====================
function showLogForm() {
    document.getElementById("logFormArea").style.display = "block";
}

async function submitLog() {
    const data = {
        date: document.getElementById("logDate")?.value || new Date().toISOString().slice(5,10).replace("-","/"),
        person: document.getElementById("logPerson")?.value || "",
        area: document.getElementById("logArea")?.value || "",
        duration_h: parseFloat(document.getElementById("logDuration")?.value) || 0,
        distance_km: parseFloat(document.getElementById("logDistance")?.value) || 0,
        findings: document.getElementById("logFindings")?.value || "无异常",
    };
    if (!data.person) { alert("请输入巡护人"); return; }
    try {
        await fetch("/api/patrol/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        document.getElementById("logFormArea").style.display = "none";
        ["logDate","logPerson","logArea","logDuration","logDistance","logFindings"].forEach(id => {
            const el = document.getElementById(id); if (el && el.tagName === "INPUT") el.value = "";
        });
        loadLogs();
    } catch (err) { alert("提交失败: " + err.message); }
}

async function loadLogs() {
    const tbody = document.getElementById("logTableBody");
    if (!tbody) return;
    try {
        const res = await fetch("/api/patrol/logs");
        const logs = await res.json();
        if (!logs.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8899aa;">暂无日志</td></tr>'; return; }
        tbody.innerHTML = logs.map(l =>
            '<tr><td>'+l.date+'</td><td>'+l.person+'</td><td>'+l.area+'</td><td>'+l.duration_h+'</td><td>'+l.distance_km+'</td><td>'+l.findings+'</td></tr>'
        ).join("");
    } catch (err) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ff5252;">加载失败</td></tr>'; }
}

// ==================== 异常事件 ====================
async function loadAbnormalEvents() {
    const tbody = document.querySelector("#inner-abnormal-mgmt tbody");
    if (!tbody) return;
    try {
        const res = await fetch("/api/abnormal-events");
        const events = await res.json();
        if (!events.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8899aa;">暂无事件</td></tr>'; return; }
        tbody.innerHTML = events.map(e => {
            const st = e.level === "high" ? "tag-red" : e.level === "mid" ? "tag-orange" : "tag-green";
            return '<tr><td>'+e.id+'</td><td>'+e.type+'</td><td>'+e.area+'</td><td>'+e.desc+'</td><td><span class="tag '+st+'">'+e.status+'</span></td><td>'+e.handler+'</td></tr>';
        }).join("");
    } catch (err) {}
}

// ==================== 风险预警 ====================
async function loadRiskAssessment() {
    try {
        const res = await fetch("/api/risk/assessment");
        const data = await res.json();
        const items = data.items || [];
        const tbody = document.querySelector("#inner-risk-warning tbody");
        if (tbody && items.length) {
            tbody.innerHTML = items.map(r => {
                const lv = r.level === "high" ? "tag-red" : r.level === "mid" ? "tag-orange" : "tag-green";
                const lvText = r.level === "high" ? "极高风险" : r.level === "mid" ? "高风险" : "中风险";
                return '<tr><td>'+r.id+'</td><td>'+r.type+'</td><td>'+r.area+'</td><td style="color:#ff3d3d;font-weight:700;">'+r.score+'</td><td><span class="tag '+lv+'">'+lvText+'</span></td><td>'+r.desc+'</td><td>'+r.time+'</td><td><a class="link-btn">详情</a></td></tr>';
            }).join("");
        }
    } catch (err) {}
}

function runRiskAssessment() {
    loadRiskAssessment();
    alert("风险评估已刷新");
}

// ==================== 护林员台账 ====================
async function loadRangers() {
    const tbody = document.getElementById("rangerTableBody");
    if (!tbody) return;
    try {
        const res = await fetch("/api/rangers");
        const rangers = await res.json();
        if (!rangers.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8899aa;">暂无数据</td></tr>'; return; }
        tbody.innerHTML = rangers.map(r =>
            '<tr><td>'+r.id+'</td><td>'+r.name+'</td><td>'+r.phone||'-'+'</td><td>'+r.area+'</td><td><span class="tag '+(r.status==="在线"?"tag-green":"tag-gray")+'">'+r.status+'</span></td><td><a class="link-btn">编辑</a><a class="link-btn">删除</a></td></tr>'
        ).join("");
    } catch (err) {}
}

// ==================== 无人机台账 ====================
async function loadDrones() {
    const tbody = document.getElementById("droneTableBody");
    if (!tbody) return;
    try {
        const res = await fetch("/api/drones");
        const drones = await res.json();
        if (!drones.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8899aa;">暂无数据</td></tr>'; return; }
        tbody.innerHTML = drones.map(d => {
            const bat = parseInt(d.battery) || 50;
            const batClass = bat >= 70 ? "high" : bat >= 30 ? "mid" : "low";
            const stTag = d.status === "巡航中" ? "tag-blue" : d.status === "待命" ? "tag-green" : "tag-orange";
            return '<tr><td>'+d.name+'</td><td>'+d.model+'</td><td><div class="battery-bar"><div class="battery-fill '+batClass+'" style="width:'+bat+'%"></div></div>'+d.battery+'</td><td>'+d.flight_hours+'h</td><td><span class="tag '+stTag+'">'+d.status+'</span></td><td><a class="link-btn">详情</a><a class="link-btn">维护</a></td></tr>';
        }).join("");
    } catch (err) {}
}

// ==================== 页面切换时自动加载 ====================
// 日志：进入巡护任务区域时加载
const _origInitResource3 = initResourcePage;
initResourcePage = function() {
    _origInitResource3();
    setTimeout(loadTasks, 800);
    setTimeout(loadLogs, 1000);
    setTimeout(loadRangers, 1200);
    setTimeout(loadDrones, 1400);
};

// 灾害页面：加载异常事件 + 风险预警
const _origInitDisaster = initDisasterPage;
initDisasterPage = function() {
    _origInitDisaster();
    setTimeout(loadAbnormalEvents, 600);
    setTimeout(loadRiskAssessment, 800);
    setTimeout(initRecognitionGalleries, 400);
};
