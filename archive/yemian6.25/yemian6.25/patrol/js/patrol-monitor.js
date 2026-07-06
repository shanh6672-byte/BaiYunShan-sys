// patrol-monitor.js — 实时巡护监控主控制器（入口）
let patrolMapManager, patrolWsClient, patrolReplayPlayer;

async function initPatrolMonitor() {
    console.log('[PatrolMonitor] 初始化开始...');
    const mapDiv = document.getElementById('resRealtimeMap');
    if (!mapDiv) { console.error('[PatrolMonitor] 找不到 #resRealtimeMap'); return; }

    patrolMapManager = new PatrolMapManager('resRealtimeMap', window.forestCenter);
    patrolWsClient = new PatrolWsClient();
    patrolReplayPlayer = new PatrolReplayPlayer(patrolMapManager);

    // 加载真实数据：用户 + 巡护任务
    await _loadInitialData();

    // 移动端入口链接
    var mobileUrl = location.protocol + '//' + location.hostname + ':3000/mobile';
    var rightPanel = document.querySelector('.patrol-right-panel');
    if (rightPanel && !document.getElementById('mobileEntryBanner')) {
        var banner = document.createElement('div');
        banner.id = 'mobileEntryBanner';
        banner.style.cssText = 'padding:8px 12px;margin-bottom:8px;background:rgba(0,170,255,0.08);border:1px solid rgba(0,170,255,0.2);border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:8px;';
        banner.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">📱 移动巡护端</span><a href="' + mobileUrl + '" target="_blank" style="font-size:12px;color:var(--accent-blue);text-decoration:none;font-weight:600;">打开 →</a>';
        rightPanel.insertBefore(banner, rightPanel.firstChild);
    }

    _renderRangerPanel();
    _renderDronePanel();
    _renderHistoryPanel();
    _bindUIEvents();
    _bindStateListeners();
    _updateMapStats();

    // 混合模式：mock维持演示护林员，真实WS更新所有上线的移动端用户
    // 连接所有巡护任务，确保任何移动端上线都能被监控到
    var allPatrolIds = (patrolState._allPatrols || []).map(function(p) { return p.id; });
    console.log('[PatrolMonitor] 混合模式启动，监控全部 ' + allPatrolIds.length + ' 个任务, 护林员:', patrolState.rangers.size);
    patrolWsClient.connectHybrid(allPatrolIds, null);
}

async function _loadInitialData() {
    // 加载所有用户
    try {
        var u = await fetch('/api/users');
        var users = await u.json();
        patrolState._allUsers = users;
        users.forEach(function(user) {
            if (user.role === 'admin') return;
            if (!patrolState.rangers.has(user.id)) {
                patrolState.rangers.set(user.id, {
                    name: user.name,
                    userId: user.id,
                    phone: user.phone || '',
                    area: _areaForUser(user.id),
                    status: '离线',
                    speed: 0,
                    heading: 0,
                    battery: 100,
                    lat: 0,
                    lng: 0
                });
            }
        });
        patrolState.emit('ranger-updated', {});
    } catch(e) { console.log('[PatrolMonitor] 用户加载失败:', e); }

    // 加载所有巡护任务
    try {
        var p = await fetch('/api/patrols');
        var patrols = await p.json();
        patrolState._allPatrols = patrols;
    } catch(e) { console.log('[PatrolMonitor] 任务加载失败:', e); }
}

function _areaForUser(userId) {
    var areas = {
        'HL001': '一号林区', 'HL002': '一号林区',
        'HL003': '二号林区', 'HL004': '二号林区',
        'HL005': '三号林区', 'HL006': '三号林区',
        'HL007': '四号林区', 'HL008': '五号林区'
    };
    return areas[userId] || '未分配';
}

function _bindStateListeners() {
    patrolState.on('ws-status', ({ status }) => {
        var el = document.getElementById('patrolWsStatus');
        if (!el) return;
        var dot = el.querySelector('.ws-dot');
        var text = el.querySelector('.ws-text');
        if (dot) dot.className = 'ws-dot ' + status;
        if (text) {
            text.textContent = status === 'mock' ? '数据源：模拟模式' :
                              status === 'hybrid' ? '数据源：混合模式' :
                              status === 'online' ? '数据源：实时连接' : '数据源：连接断开';
        }
    });

    patrolState.on('ranger-updated', () => {
        _refreshRangerList();
        _updateMapStats();
    });
    patrolState.on('ranger-status-changed', () => {
        _refreshRangerList();
        _updateMapStats();
    });
    patrolState.on('drone-updated', () => {
        _refreshDroneList();
        _updateMapStats();
    });
}

function _renderRangerPanel() {
    var container = document.getElementById('inner-ranger-rt');
    if (!container) return;
    container.innerHTML = '<div class="panel-card">' +
        '<div class="card-header">' +
            '<h3>护林员实时状态 <span class="tag tag-green tag-sm" id="rangerOnlineCount">0人在线</span></h3>' +
            '<div style="display:flex;gap:6px;">' +
                '<button class="btn btn-sm btn-outline" id="btnRefreshRanger">刷新</button>' +
                '<button class="btn btn-sm btn-outline" id="btnFitAllRanger">定位全部</button>' +
            '</div>' +
        '</div>' +
        '<div class="card-body"><div class="rt-person-list" id="rangerList"></div></div>' +
        '</div>';
    _refreshRangerList();
    document.getElementById('btnRefreshRanger').onclick = () => {
        console.log('[PatrolMonitor] 刷新按钮点击 - HL005当前状态:', JSON.stringify(patrolState.rangers.get('HL005')));
        _refreshRangerList(); _updateMapStats();
    };
    document.getElementById('btnFitAllRanger').onclick = () => patrolMapManager.fitAllActive();
}

function _refreshRangerList() {
    var listEl = document.getElementById('rangerList');
    var countEl = document.getElementById('rangerOnlineCount');
    if (!listEl) return;

    var onlineCount = 0;
    var html = '';
    patrolState.rangers.forEach(function(r, userId) {
        var isOnline = r.status === '在线';
        if (isOnline) onlineCount++;
        var tagClass = isOnline ? 'tag-green' : 'tag-gray';
        var hasPosition = r.lat && r.lng && r.lat !== 0;
        var detail = isOnline && hasPosition
            ? (r.area || '') + ' · 速度' + ((r.speed || 0) * 3.6).toFixed(1) + 'km/h'
            : (r.area || '') + ' · 暂无位置';
        html += '<div class="rt-person-item ' + (isOnline ? '' : 'patrol-offline') + '" data-uid="' + userId + '">' +
            '<div class="rt-avatar ' + (isOnline ? 'green' : 'gray') + '">' + (r.name || userId).charAt(0) + '</div>' +
            '<div class="rt-info">' +
                '<div class="rt-name">' + r.name + ' <span class="tag ' + tagClass + ' tag-sm">' + r.status + '</span></div>' +
                '<div class="rt-detail">' + detail + '</div>' +
            '</div>' +
            '<button class="btn btn-sm btn-outline btn-locate"' + (hasPosition ? '' : ' disabled') + '>定位</button>' +
            '<button class="btn btn-sm btn-outline btn-replay">轨迹</button>' +
        '</div>';
    });
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = onlineCount + '人在线';

    if (!html) return;
    listEl.querySelectorAll('.btn-locate').forEach(function(btn) {
        btn.onclick = function(e) {
            e.stopPropagation();
            var uid = this.closest('.rt-person-item').dataset.uid;
            patrolMapManager.setViewMode('ranger');
            patrolMapManager.focusUser(uid);
        };
    });
    listEl.querySelectorAll('.btn-replay').forEach(function(btn) {
        btn.onclick = function(e) {
            e.stopPropagation();
            var uid = this.closest('.rt-person-item').dataset.uid;
            _switchToReplay(uid);
        };
    });
}

function _renderDronePanel() {
    var container = document.getElementById('inner-drone-rt');
    if (!container) return;
    container.innerHTML = '<div class="panel-card">' +
        '<div class="card-header">' +
            '<h3>无人机实时状态 <span class="tag tag-blue tag-sm" id="droneOnlineCount">0架巡航中</span></h3>' +
            '<button class="btn btn-sm btn-outline" id="btnFitAllDrone">定位全部</button>' +
        '</div>' +
        '<div class="card-body"><div class="rt-person-list" id="droneList"></div></div>' +
    '</div>';
    _refreshDroneList();
    document.getElementById('btnFitAllDrone').onclick = () => patrolMapManager.fitAllActive();
}

function _refreshDroneList() {
    var listEl = document.getElementById('droneList');
    var countEl = document.getElementById('droneOnlineCount');
    if (!listEl) return;

    var cruiseCount = 0;
    var html = '';
    patrolState.drones.forEach(function(d, droneId) {
        if (d.status === '巡航中') cruiseCount++;
        html += '<div class="rt-person-item" data-uid="' + droneId + '">' +
            '<div class="rt-avatar blue">' + droneId.slice(-2) + '</div>' +
            '<div class="rt-info">' +
                '<div class="rt-name">' + droneId + ' <span class="tag tag-blue tag-sm">' + d.status + '</span></div>' +
                '<div class="rt-detail">' + d.model + ' · 高度' + d.alt + 'm · 电量' + (d.battery || 0).toFixed(0) + '%</div>' +
            '</div>' +
            '<button class="btn btn-sm btn-outline btn-locate">定位</button>' +
            '<button class="btn btn-sm btn-outline btn-replay">航线</button>' +
        '</div>';
    });
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = cruiseCount + '架巡航中';

    if (!html) return;
    listEl.querySelectorAll('.btn-locate').forEach(function(btn) {
        btn.onclick = function(e) {
            e.stopPropagation();
            var uid = this.closest('.rt-person-item').dataset.uid;
            patrolMapManager.setViewMode('drone');
            patrolMapManager.focusUser(uid);
        };
    });
    listEl.querySelectorAll('.btn-replay').forEach(function(btn) {
        btn.onclick = function(e) {
            e.stopPropagation();
            var uid = this.closest('.rt-person-item').dataset.uid;
            _switchToReplay(uid);
        };
    });
}

function _renderHistoryPanel() {
    var container = document.getElementById('inner-history');
    if (!container) return;
    var now = new Date();
    var pad = function(v) { return String(v).padStart(2, '0'); };
    var fmt = function(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    var endStr = fmt(now);
    now.setHours(now.getHours() - 6);
    var startStr = fmt(now);

    // 动态生成护林员选项
    var rangerOpts = '';
    var allUsers = patrolState._allUsers || [];
    allUsers.forEach(function(u) {
        if (u.role !== 'ranger') return;
        rangerOpts += '<option value="' + u.id + '">' + u.name + ' (' + u.id + ')</option>';
    });
    if (!rangerOpts) rangerOpts = '<option value="">无护林员数据</option>';

    // 动态生成无人机选项
    var droneList = [
        { id:'UAV-01', model:'大疆M300' }, { id:'UAV-02', model:'大疆M300' },
        { id:'UAV-03', model:'大疆M350' }, { id:'UAV-04', model:'大疆M350' },
        { id:'UAV-05', model:'极飞V40' }, { id:'UAV-06', model:'大疆M30T' }
    ];
    var droneOpts = '';
    droneList.forEach(function(d) {
        droneOpts += '<option value="' + d.id + '">' + d.id + ' ' + d.model + '</option>';
    });

    container.innerHTML = '<div class="panel-card">' +
        '<div class="card-header"><h3>历史轨迹回放</h3></div>' +
        '<div class="card-body">' +
            '<div class="form-group"><label>选择人员/无人机</label>' +
                '<select class="select-full" id="replaySelect">' +
                    '<optgroup label="护林员">' + rangerOpts + '</optgroup>' +
                    '<optgroup label="无人机">' + droneOpts + '</optgroup>' +
                '</select>' +
            '</div>' +
            '<div class="form-row">' +
                '<div class="form-group half"><label>开始时间</label><input type="datetime-local" id="replayStart" value="' + startStr + '"/></div>' +
                '<div class="form-group half"><label>结束时间</label><input type="datetime-local" id="replayEnd" value="' + endStr + '"/></div>' +
            '</div>' +
            '<button class="btn btn-primary btn-block" id="btnQueryReplay">查询轨迹</button>' +
            '<div class="playback-controls" id="replayControls" style="display:none;">' +
                '<button class="btn btn-outline btn-sm" id="btnReplayPause">⏸</button>' +
                '<button class="btn btn-primary btn-sm" id="btnReplayPlay">▶ 播放</button>' +
                '<button class="btn btn-outline btn-sm speed-btn active" data-speed="1">1x</button>' +
                '<button class="btn btn-outline btn-sm speed-btn" data-speed="2">2x</button>' +
                '<button class="btn btn-outline btn-sm speed-btn" data-speed="4">4x</button>' +
                '<button class="btn btn-outline btn-sm speed-btn" data-speed="8">8x</button>' +
                '<span id="replayTimeLabel" style="font-size:11px;color:var(--text-secondary);">00:00</span>' +
            '</div>' +
            '<div style="margin-top:8px;"><input type="range" id="replayProgressBar" min="0" max="100" value="0" style="width:100%;display:none;"/></div>' +
            // 轨迹档案区域
            '<div class="card-header" style="margin-top:16px;"><h3>轨迹档案</h3></div>' +
            '<div id="trajectoryArchiveList" style="max-height:200px;overflow-y:auto;font-size:12px;">' +
                '<div style="color:var(--text-muted);text-align:center;padding:12px;">点击"加载档案"查看</div>' +
            '</div>' +
            '<button class="btn btn-outline btn-sm btn-block" id="btnLoadArchive" style="margin-top:8px;">加载档案</button>' +
        '</div>' +
    '</div>';
}

function _switchToReplay(userId) {
    var replaySelect = document.getElementById('replaySelect');
    if (replaySelect) replaySelect.value = userId;

    var tabItems = document.querySelectorAll('#sub-res-realtime .sub-tab-item');
    tabItems.forEach(function(t) { t.classList.remove('active'); });
    var historyTab = document.querySelector('#sub-res-realtime .sub-tab-item[data-inner="inner-history"]');
    if (historyTab) historyTab.classList.add('active');

    var innerTabs = document.querySelectorAll('#sub-res-realtime .inner-tab');
    innerTabs.forEach(function(t) { t.classList.remove('active'); });
    var historyPanel = document.getElementById('inner-history');
    if (historyPanel) historyPanel.classList.add('active');

    patrolMapManager.setViewMode('history');
    setTimeout(function() { patrolMapManager.map.invalidateSize(); }, 100);

    document.getElementById('btnQueryReplay').click();
}

function _bindUIEvents() {
    var btnQuery = document.getElementById('btnQueryReplay');
    if (btnQuery) {
        btnQuery.onclick = async function() {
            var userId = document.getElementById('replaySelect').value;
            var startEl = document.getElementById('replayStart');
            var endEl = document.getElementById('replayEnd');
            var from = startEl && startEl.value ? new Date(startEl.value).getTime() : null;
            var to = endEl && endEl.value ? new Date(endEl.value).getTime() : null;
            var count = await patrolReplayPlayer.load(userId, from, to);
            if (count > 0) {
                document.getElementById('replayControls').style.display = 'flex';
                document.getElementById('replayProgressBar').style.display = 'block';
            } else {
                alert('未找到该用户/无人机在指定时间段的轨迹数据');
            }
        };
    }

    var btnPlay = document.getElementById('btnReplayPlay');
    if (btnPlay) {
        btnPlay.onclick = function() { patrolReplayPlayer.play(); };
    }

    var btnPause = document.getElementById('btnReplayPause');
    if (btnPause) {
        btnPause.onclick = function() { patrolReplayPlayer.pause(); };
    }

    document.querySelectorAll('.speed-btn').forEach(function(btn) {
        btn.onclick = function() {
            document.querySelectorAll('.speed-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            patrolReplayPlayer.setSpeed(Number(this.dataset.speed));
        };
    });

    var progressBar = document.getElementById('replayProgressBar');
    if (progressBar) {
        progressBar.oninput = function() {
            patrolReplayPlayer.seek(Number(this.value));
        };
    }

    patrolReplayPlayer.onProgress = function(progress) {
        var bar = document.getElementById('replayProgressBar');
        if (bar) bar.value = progress;
    };
    patrolReplayPlayer.onTimeUpdate = function(date) {
        var label = document.getElementById('replayTimeLabel');
        if (label) {
            var p = function(v) { return String(v).padStart(2, '0'); };
            label.textContent = p(date.getHours()) + ':' + p(date.getMinutes()) + ':' + p(date.getSeconds());
        }
    };

    // 轨迹档案加载按钮
    var btnArchive = document.getElementById('btnLoadArchive');
    if (btnArchive) {
        btnArchive.onclick = function() { _loadTrajectoryArchive(); };
    }
}

async function _loadTrajectoryArchive() {
    var listEl = document.getElementById('trajectoryArchiveList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">加载中...</div>';
    try {
        var resp = await fetch('/api/trajectory/sessions/list');
        var data = await resp.json();
        var sessions = data.sessions || [];
        if (sessions.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">暂无轨迹档案</div>';
            return;
        }
        var html = '';
        sessions.forEach(function(s, i) {
            var startTime = s.start_time ? new Date(s.start_time).toLocaleString('zh-CN') : '-';
            var endTime = s.end_time ? new Date(s.end_time).toLocaleString('zh-CN') : '进行中';
            var patrolName = s.patrol_name || s.patrol_id;
            html += '<div class="archive-item" style="padding:6px 8px;margin:4px 0;background:rgba(0,170,255,0.04);border-radius:4px;cursor:pointer;"' +
                ' data-user="' + s.user_id + '" data-patrol="' + s.patrol_id + '" data-from="' + (s.start_time || '') + '" data-to="' + (s.end_time || '') + '">' +
                '<div style="font-weight:600;">' + s.user_name + ' (' + s.user_id + ') - ' + patrolName + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + startTime + ' ~ ' + endTime + ' · ' + s.point_count + '点</div>' +
                '</div>';
        });
        listEl.innerHTML = html;

        // 点击档案项 → 回填回放控件并查询
        listEl.querySelectorAll('.archive-item').forEach(function(item) {
            item.onclick = function() {
                var uid = this.dataset.user;
                var selectEl = document.getElementById('replaySelect');
                if (selectEl) selectEl.value = uid;
                // 切换到历史回放tab
                var historyTab = document.querySelector('#sub-res-realtime .sub-tab-item[data-inner="inner-history"]');
                if (historyTab) historyTab.click();
                // 自动查询
                setTimeout(function() {
                    var btnQ = document.getElementById('btnQueryReplay');
                    if (btnQ) btnQ.click();
                }, 300);
            };
        });
    } catch(e) {
        listEl.innerHTML = '<div style="color:var(--accent-red);text-align:center;padding:12px;">加载失败: ' + e.message + '</div>';
    }
}

function _updateMapStats() {
    var el = document.getElementById('patrolMapStats');
    if (!el) return;
    var onlineRangers = 0, cruiseDrones = 0;
    patrolState.rangers.forEach(function(r) { if (r.status === '在线') onlineRangers++; });
    patrolState.drones.forEach(function(d) { if (d.status === '巡航中') cruiseDrones++; });
    el.innerHTML = '<div class="map-stat-chip"><div class="chip-dot" style="background:#00e676;"></div><span>护林员 ' + onlineRangers + '</span></div>' +
        '<div class="map-stat-chip"><div class="chip-dot" style="background:#448aff;"></div><span>无人机 ' + cruiseDrones + '</span></div>';
}

function countOnline() {
    var c = 0;
    patrolState.rangers.forEach(function(r) { if (r.status === '在线') c++; });
    return c;
}

window.PatrolMonitor = { init: initPatrolMonitor, state: patrolState };
