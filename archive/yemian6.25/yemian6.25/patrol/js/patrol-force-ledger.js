// patrol-force-ledger.js — 巡护力量台账（护林员/无人机/巡护队伍）
var patrolForceLedger = {
  _users: [],
  _drones: [],
  _unlockedPhones: {},  // 已解锁查看的手机号: {userId: true}
  _teams: [
    { id:'TM01', name:'青山巡护一队', leader:'张建国', count:6, area:'一号/二号林区', monthly:86, members:['HL001','HL002','HL006'] },
    { id:'TM02', name:'青山巡护二队', leader:'刘德才', count:6, area:'三号/四号林区', monthly:72, members:['HL005','HL007'] },
    { id:'TM03', name:'无人机巡检队', leader:'周国平', count:4, area:'全域', monthly:45, members:['HL008'] },
    { id:'TM04', name:'应急突击队', leader:'赵文华', count:8, area:'全域', monthly:28, members:['HL003','HL004'] },
  ],
  _editingTeamId: null,
  _editingRangerId: null,

  async init() {
    await this._loadData();
    this._renderRangerLedger();
    this._renderDroneLedger();
    this._renderTeamLedger();
    this._bindInnerTabSwitch();
  },

  async _loadData() {
    try {
      var u = await fetch('/api/users');
      this._users = await u.json();
    } catch(e) { console.log('[ForceLedger] 用户加载失败'); }
    // 无人机用内置数据
    this._drones = [
      { id:'UAV-01', model:'大疆M300', battery:85, flightHours:128, status:'巡航中', operator:'张建国', purchaseDate:'2024-03-15', lastMaintain:'2026-05-20' },
      { id:'UAV-02', model:'大疆M300', battery:52, flightHours:96, status:'巡航中', operator:'李明辉', purchaseDate:'2024-03-15', lastMaintain:'2026-05-18' },
      { id:'UAV-03', model:'大疆M350', battery:92, flightHours:45, status:'巡航中', operator:'系统自动', purchaseDate:'2025-01-10', lastMaintain:'2026-06-01' },
      { id:'UAV-04', model:'大疆M350', battery:15, flightHours:210, status:'维护中', operator:'-', purchaseDate:'2024-08-20', lastMaintain:'2026-04-15' },
      { id:'UAV-05', model:'极飞V40', battery:78, flightHours:67, status:'待命', operator:'周国平', purchaseDate:'2025-06-05', lastMaintain:'2026-05-30' },
      { id:'UAV-06', model:'大疆M30T', battery:60, flightHours:88, status:'待命', operator:'孙立军', purchaseDate:'2025-09-12', lastMaintain:'2026-05-25' },
    ];
  },

  // ==================== 护林员台账 ====================
  _renderRangerLedger() {
    var container = document.getElementById('inner-ranger');
    if (!container) return;
    var self = this;
    var rangers = this._users.filter(function(u) { return u.role === 'ranger'; });

    var rows = '';
    rangers.forEach(function(r) {
      var status = self._getRangerStatus(r.id);
      var tagClass = status === '在线' ? 'tag-green' : 'tag-gray';
      var phoneDisplay = self._getPhoneDisplay(r);
      var isUnlocked = self._unlockedPhones[r.id];
      var hasPhone = r.phone && r.phone !== '-';
      var phoneCell = '<span class="ranger-phone" data-id="' + r.id + '">' + phoneDisplay + '</span>';
      if (hasPhone) {
        var btnLabel = isUnlocked ? '完成' : '查看';
        phoneCell += ' <a class="link-btn btn-view-phone" data-id="' + r.id + '" style="font-size:11px;">' + btnLabel + '</a>';
      }
      rows += '<tr><td>' + r.id + '</td><td>' + r.name + '</td><td>' + phoneCell + '</td>' +
        '<td>' + (r.area || self._areaFor(r.id)) + '</td>' +
        '<td><span class="tag ' + tagClass + ' tag-sm">' + status + '</span></td>' +
        '<td><a class="link-btn btn-edit-ranger" data-id="' + r.id + '">编辑</a>' +
        '<a class="link-btn btn-del-ranger" data-id="' + r.id + '" style="color:var(--accent-red);">删除</a></td></tr>';
    });

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>护林员档案 (' + rangers.length + '人)</h3>' +
      '<div class="card-actions"><button class="btn btn-primary btn-sm" id="btnAddRanger">新增护林员</button>' +
      '<button class="btn btn-outline btn-sm" id="btnRefreshRangerLedger">刷新</button></div></div>' +
      '<div class="card-body">' +
      '<div class="search-bar" style="margin-bottom:12px;">' +
      '<input type="text" id="rangerSearch" placeholder="搜索姓名/工号..." style="width:150px;"/>' +
      '<select id="rangerStatusFilter"><option value="">全部状态</option><option value="在线">在线</option><option value="离线">离线</option></select>' +
      '<button class="btn btn-sm" id="btnRangerSearch">查询</button></div>' +
      '<table class="data-table"><thead><tr><th>工号</th><th>姓名</th><th>电话</th><th>负责区域</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="pagination" style="margin-top:8px;"><span>共 ' + rangers.length + ' 人</span></div>' +
      '<div id="rangerEditPanel" style="display:none;margin-top:12px;padding:12px;background:rgba(0,170,255,0.04);border:1px solid rgba(0,170,255,0.15);border-radius:8px;"></div>' +
      '</div></div>';

    this._bindRangerEvents(rangers);
  },

  _getRangerStatus(userId) {
    var r = patrolState.rangers.get(userId);
    return (r && r.status) || '离线';
  },

  _maskPhone(phone) {
    if (!phone || phone === '-') return '-';
    var s = String(phone);
    if (s.length >= 11) return s.substring(0, 3) + '****' + s.substring(7);
    if (s.length >= 7) return s.substring(0, 3) + '****';
    return s;
  },

  _getPhoneDisplay(r) {
    if (this._unlockedPhones[r.id]) return r.phone || '-';
    return this._maskPhone(r.phone);
  },

  _verifyAdmin(callback) {
    var pwd = prompt('请输入管理员密码以查看完整电话信息:');
    if (!pwd) return;
    var admin = this._users.find(function(u) { return u.role === 'admin'; });
    if (!admin) { alert('未找到管理员账户'); return; }
    if (pwd === admin.password) {
      callback();
    } else {
      alert('密码错误，无权限查看完整电话信息');
    }
  },

  _areaFor(userId) {
    var areas = { 'HL001':'一号林区','HL002':'一号林区','HL003':'二号林区','HL004':'二号林区','HL005':'三号林区','HL006':'三号林区','HL007':'四号林区','HL008':'五号林区' };
    return areas[userId] || '未分配';
  },

  _bindRangerEvents(rangers) {
    var self = this;
    document.getElementById('btnAddRanger').onclick = function() { self._showRangerEdit(); };
    document.getElementById('btnRefreshRangerLedger').onclick = async function() {
      await self._loadData();
      self._renderRangerLedger();
    };
    document.getElementById('btnRangerSearch').onclick = function() { self._doRangerSearch(rangers); };
    document.getElementById('rangerSearch').onkeyup = function(e) { if (e.key === 'Enter') self._doRangerSearch(rangers); };

    document.querySelectorAll('#inner-ranger .btn-edit-ranger').forEach(function(btn) {
      btn.onclick = function() {
        var id = this.dataset.id;
        var u = rangers.find(function(r) { return r.id === id; });
        if (u) self._showRangerEdit(u);
      };
    });
    document.querySelectorAll('#inner-ranger .btn-del-ranger').forEach(function(btn) {
      btn.onclick = async function() {
        if (!confirm('确定删除该护林员？此操作不可恢复！')) return;
        try {
          var resp = await fetch('/api/users/' + this.dataset.id, { method: 'DELETE' });
          if (!resp.ok) { alert('删除失败，请检查服务器'); return; }
        } catch(e) { alert('删除失败: ' + e.message); return; }
        await self._loadData();
        self._renderRangerLedger();
      };
    });

    // 查看/完成 切换 — 查看需管理员密码，完成直接切换回遮掩
    document.querySelectorAll('#inner-ranger .btn-view-phone').forEach(function(btn) {
      btn.onclick = function() {
        var uid = this.dataset.id;
        if (self._unlockedPhones[uid]) {
          // 已解锁 → 点击"完成" → 重新遮掩
          self._unlockedPhones[uid] = false;
          self._renderRangerLedger();
        } else {
          // 未解锁 → 点击"查看" → 验证管理员密码
          self._verifyAdmin(function() {
            self._unlockedPhones[uid] = true;
            self._renderRangerLedger();
          });
        }
      };
    });
  },

  _showRangerEdit(user) {
    user = user || {};
    var panel = document.getElementById('rangerEditPanel');
    panel.style.display = 'block';
    panel.innerHTML =
      '<h4 style="margin:0 0 8px 0;font-size:13px;">' + (user.id ? '编辑' : '新增') + '护林员</h4>' +
      '<div class="form-row"><div class="form-group half"><label>工号</label><input type="text" id="editRangerId" value="' + (user.id || '') + '" ' + (user.id ? 'readonly' : 'placeholder="如HL009"') + '/></div>' +
      '<div class="form-group half"><label>姓名</label><input type="text" id="editRangerName" value="' + (user.name || '') + '"/></div></div>' +
      '<div class="form-row"><div class="form-group half"><label>电话</label><input type="text" id="editRangerPhone" value="' + (user.phone || '') + '"/></div>' +
      '<div class="form-group half"><label>角色</label><select id="editRangerRole"><option value="ranger"' + (user.role === 'ranger' ? ' selected' : '') + '>护林员</option><option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>管理员</option></select></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary btn-sm" id="btnSaveRanger">保存</button><button class="btn btn-outline btn-sm" id="btnCancelRanger">取消</button></div>';
    var self = this;
    document.getElementById('btnSaveRanger').onclick = async function() {
      var data = {
        id: document.getElementById('editRangerId').value.trim(),
        name: document.getElementById('editRangerName').value.trim(),
        phone: document.getElementById('editRangerPhone').value.trim(),
        role: document.getElementById('editRangerRole').value,
        password: '123456'
      };
      if (!data.id || !data.name) { alert('工号和姓名必填'); return; }
      try {
        if (user.id) {
          await fetch('/api/users/' + user.id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        } else {
          await fetch('/api/users', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        }
        await self._loadData();
        self._renderRangerLedger();
      } catch(e) { alert('保存失败'); }
    };
    document.getElementById('btnCancelRanger').onclick = function() { panel.style.display = 'none'; };
  },

  _doRangerSearch(rangers) {
    var keyword = (document.getElementById('rangerSearch').value || '').toLowerCase();
    var statusFilter = document.getElementById('rangerStatusFilter').value;
    var tbody = document.querySelector('#inner-ranger tbody');
    if (!tbody) return;
    var rows = '';
    var self = this;
    rangers.forEach(function(r) {
      if (keyword && r.name.indexOf(keyword) === -1 && r.id.toLowerCase().indexOf(keyword) === -1) return;
      var status = self._getRangerStatus(r.id);
      if (statusFilter && status !== statusFilter) return;
      var tagClass = status === '在线' ? 'tag-green' : 'tag-gray';
      var phoneDisplay = self._getPhoneDisplay(r);
      var isUnlocked = self._unlockedPhones[r.id];
      var hasPhone = r.phone && r.phone !== '-';
      var phoneCell = '<span class="ranger-phone" data-id="' + r.id + '">' + phoneDisplay + '</span>';
      if (hasPhone) {
        var btnLabel = isUnlocked ? '完成' : '查看';
        phoneCell += ' <a class="link-btn btn-view-phone" data-id="' + r.id + '" style="font-size:11px;">' + btnLabel + '</a>';
      }
      rows += '<tr><td>' + r.id + '</td><td>' + r.name + '</td><td>' + phoneCell + '</td>' +
        '<td>' + (r.area || self._areaFor(r.id)) + '</td>' +
        '<td><span class="tag ' + tagClass + ' tag-sm">' + status + '</span></td>' +
        '<td><a class="link-btn btn-edit-ranger" data-id="' + r.id + '">编辑</a>' +
        '<a class="link-btn btn-del-ranger" data-id="' + r.id + '" style="color:var(--accent-red);">删除</a></td></tr>';
    });
    tbody.innerHTML = rows;
    // rebind
    tbody.querySelectorAll('.btn-edit-ranger').forEach(function(btn) {
      btn.onclick = function() {
        var u = rangers.find(function(r) { return r.id === btn.dataset.id; });
        if (u) self._showRangerEdit(u);
      };
    });
    tbody.querySelectorAll('.btn-del-ranger').forEach(function(btn) {
      btn.onclick = async function() {
        if (!confirm('确定删除该护林员？此操作不可恢复！')) return;
        try {
          var resp = await fetch('/api/users/' + btn.dataset.id, { method: 'DELETE' });
          if (!resp.ok) { alert('删除失败'); return; }
        } catch(e) { alert('删除失败: ' + e.message); return; }
        await self._loadData();
        self._renderRangerLedger();
      };
    });
    tbody.querySelectorAll('.btn-view-phone').forEach(function(btn) {
      btn.onclick = function() {
        var uid = this.dataset.id;
        if (self._unlockedPhones[uid]) {
          self._unlockedPhones[uid] = false;
          self._renderRangerLedger();
        } else {
          self._verifyAdmin(function() {
            self._unlockedPhones[uid] = true;
            self._renderRangerLedger();
          });
        }
      };
    });
  },

  // ==================== 无人机台账 ====================
  _renderDroneLedger() {
    var container = document.getElementById('inner-drone');
    if (!container) return;
    var self = this;
    var rows = '';
    this._drones.forEach(function(d) {
      var batteryLevel = d.battery > 60 ? 'high' : (d.battery > 30 ? 'mid' : 'low');
      var statusTag = d.status === '巡航中' ? 'tag-blue' : (d.status === '待命' ? 'tag-green' : 'tag-orange');
      rows += '<tr><td>' + d.id + '</td><td>' + d.model + '</td>' +
        '<td><div class="battery-bar"><div class="battery-fill ' + batteryLevel + '" style="width:' + d.battery + '%"></div></div>' + d.battery + '%</td>' +
        '<td>' + d.flightHours + 'h</td><td>' + d.lastMaintain + '</td>' +
        '<td><span class="tag ' + statusTag + ' tag-sm">' + d.status + '</span></td>' +
        '<td><a class="link-btn btn-drone-detail" data-id="' + d.id + '">详情</a>' +
        '<a class="link-btn btn-drone-maintain" data-id="' + d.id + '">维护记录</a></td></tr>';
    });

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>无人机设备档案 (' + this._drones.length + '架)</h3>' +
      '<div class="card-actions"><button class="btn btn-primary btn-sm" id="btnAddDrone">新增设备</button>' +
      '<button class="btn btn-outline btn-sm" id="btnExportDrone">导出</button></div></div>' +
      '<div class="card-body">' +
      '<table class="data-table"><thead><tr><th>编号</th><th>型号</th><th>电量</th><th>飞行时长</th><th>上次维护</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div id="droneDetailPanel" style="display:none;margin-top:12px;padding:12px;background:rgba(68,138,255,0.04);border:1px solid rgba(68,138,255,0.15);border-radius:8px;"></div>' +
      '</div></div>';

    document.querySelectorAll('#inner-drone .btn-drone-detail').forEach(function(btn) {
      btn.onclick = function() { self._showDroneDetail(this.dataset.id); };
    });
    document.querySelectorAll('#inner-drone .btn-drone-maintain').forEach(function(btn) {
      btn.onclick = function() { self._showDroneMaintain(this.dataset.id); };
    });

    // 新增设备按钮
    var btnAdd = document.getElementById('btnAddDrone');
    if (btnAdd) btnAdd.onclick = function() { self._showDroneAddForm(); };

    // 导出按钮
    var btnExport = document.getElementById('btnExportDrone');
    if (btnExport) btnExport.onclick = function() { self._exportDroneCSV(); };
  },

  _showDroneDetail(id) {
    var d = this._drones.find(function(d) { return d.id === id; });
    if (!d) return;
    var panel = document.getElementById('droneDetailPanel');
    panel.style.display = 'block';
    panel.innerHTML = '<h4 style="margin:0 0 8px 0;font-size:13px;">' + d.id + ' - ' + d.model + ' 详情</h4>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">' +
      '<div><span style="color:var(--text-muted);">型号:</span> ' + d.model + '</div>' +
      '<div><span style="color:var(--text-muted);">电量:</span> ' + d.battery + '%</div>' +
      '<div><span style="color:var(--text-muted);">总飞行时长:</span> ' + d.flightHours + 'h</div>' +
      '<div><span style="color:var(--text-muted);">操作员:</span> ' + d.operator + '</div>' +
      '<div><span style="color:var(--text-muted);">购置日期:</span> ' + d.purchaseDate + '</div>' +
      '<div><span style="color:var(--text-muted);">上次维护:</span> ' + d.lastMaintain + '</div>' +
      '<div><span style="color:var(--text-muted);">状态:</span> ' + d.status + '</div>' +
      '</div><button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="document.getElementById(\'droneDetailPanel\').style.display=\'none\'">关闭</button>';
  },

  _showDroneMaintain(id) {
    var d = this._drones.find(function(d) { return d.id === id; });
    if (!d) return;
    var panel = document.getElementById('droneDetailPanel');
    panel.style.display = 'block';
    var records = [
      { date:'2026-06-01', type:'定期保养', desc:'更换螺旋桨、校准云台', tech:'李工' },
      { date:'2026-05-01', type:'定期保养', desc:'电池检测、固件升级', tech:'李工' },
      { date:'2026-04-01', type:'定期保养', desc:'机身检查、传感器校准', tech:'王工' },
    ];
    var rows = records.map(function(r) { return '<tr><td>' + r.date + '</td><td>' + r.type + '</td><td>' + r.desc + '</td><td>' + r.tech + '</td></tr>'; }).join('');
    panel.innerHTML = '<h4 style="margin:0 0 8px 0;font-size:13px;">' + d.id + ' 维护记录</h4>' +
      '<table class="data-table"><thead><tr><th>日期</th><th>类型</th><th>内容</th><th>技术员</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="document.getElementById(\'droneDetailPanel\').style.display=\'none\'">关闭</button>';
  },

  // ==================== 无人机新增/导出 ====================
  _showDroneAddForm() {
    var panel = document.getElementById('droneDetailPanel');
    panel.style.display = 'block';
    panel.innerHTML =
      '<h4 style="margin:0 0 8px 0;font-size:13px;">新增无人机设备</h4>' +
      '<div class="form-row">' +
        '<div class="form-group half"><label>编号</label><input type="text" id="newDroneId" placeholder="如UAV-07"/></div>' +
        '<div class="form-group half"><label>型号</label><select id="newDroneModel"><option>大疆M300</option><option>大疆M350</option><option>大疆M30T</option><option>极飞V40</option><option>大疆Mavic 3T</option></select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group half"><label>电量 (%)</label><input type="number" id="newDroneBattery" value="100" min="0" max="100"/></div>' +
        '<div class="form-group half"><label>飞行时长 (h)</label><input type="number" id="newDroneHours" value="0" min="0"/></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group half"><label>状态</label><select id="newDroneStatus"><option>待命</option><option>巡航中</option><option>维护中</option></select></div>' +
        '<div class="form-group half"><label>操作员</label><input type="text" id="newDroneOperator" placeholder="操作员姓名"/></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group half"><label>购置日期</label><input type="date" id="newDronePurchase"/></div>' +
        '<div class="form-group half"><label>上次维护</label><input type="date" id="newDroneMaintain"/></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary btn-sm" id="btnSaveDrone">保存</button><button class="btn btn-outline btn-sm" id="btnCancelDroneAdd">取消</button></div>';
    var self = this;
    document.getElementById('btnSaveDrone').onclick = function() {
      var drone = {
        id: document.getElementById('newDroneId').value.trim(),
        model: document.getElementById('newDroneModel').value,
        battery: parseInt(document.getElementById('newDroneBattery').value) || 100,
        flightHours: parseInt(document.getElementById('newDroneHours').value) || 0,
        status: document.getElementById('newDroneStatus').value,
        operator: document.getElementById('newDroneOperator').value.trim() || '-',
        purchaseDate: document.getElementById('newDronePurchase').value || new Date().toISOString().slice(0,10),
        lastMaintain: document.getElementById('newDroneMaintain').value || new Date().toISOString().slice(0,10)
      };
      if (!drone.id) { alert('请输入设备编号'); return; }
      if (self._drones.some(function(d) { return d.id === drone.id; })) { alert('设备编号已存在'); return; }
      self._drones.push(drone);
      self._renderDroneLedger();
      panel.style.display = 'none';
    };
    document.getElementById('btnCancelDroneAdd').onclick = function() { panel.style.display = 'none'; };
  },

  _exportDroneCSV() {
    var headers = ['编号', '型号', '电量%', '飞行时长h', '状态', '操作员', '购置日期', '上次维护'];
    var rows = [headers.join(',')];
    this._drones.forEach(function(d) {
      rows.push([d.id, d.model, d.battery, d.flightHours, d.status, d.operator, d.purchaseDate, d.lastMaintain].join(','));
    });
    var BOM = '﻿';
    var csv = BOM + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = '无人机设备档案_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  // ==================== 巡护队伍台账 ====================
  _renderTeamLedger() {
    var container = document.getElementById('inner-team');
    if (!container) return;
    var self = this;
    var rows = '';
    this._teams.forEach(function(t) {
      rows += '<tr><td>' + t.id + '</td><td>' + t.name + '</td><td>' + t.leader + '</td>' +
        '<td>' + t.count + '人</td><td>' + t.area + '</td><td>' + t.monthly + '</td>' +
        '<td><a class="link-btn btn-edit-team" data-id="' + t.id + '">编辑</a>' +
        '<a class="link-btn btn-assign-team" data-id="' + t.id + '">分配区域</a>' +
        '<a class="link-btn btn-del-team" data-id="' + t.id + '" style="color:var(--accent-red);">删除</a></td></tr>';
    });

    container.innerHTML = '<div class="panel-card">' +
      '<div class="card-header"><h3>巡护队伍管理 (' + this._teams.length + '队)</h3>' +
      '<div class="card-actions"><button class="btn btn-primary btn-sm" id="btnAddTeam">新建队伍</button></div></div>' +
      '<div class="card-body">' +
      '<table class="data-table"><thead><tr><th>编号</th><th>名称</th><th>队长</th><th>人数</th><th>区域</th><th>本月巡护</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div id="teamEditPanel" style="display:none;margin-top:12px;padding:12px;background:rgba(0,170,255,0.04);border:1px solid rgba(0,170,255,0.15);border-radius:8px;"></div>' +
      '</div></div>';

    document.getElementById('btnAddTeam').onclick = function() { self._showTeamEdit(); };
    document.querySelectorAll('#inner-team .btn-edit-team').forEach(function(btn) {
      btn.onclick = function() {
        var t = self._teams.find(function(t) { return t.id === btn.dataset.id; });
        if (t) self._showTeamEdit(t);
      };
    });
    document.querySelectorAll('#inner-team .btn-assign-team').forEach(function(btn) {
      btn.onclick = function() {
        var t = self._teams.find(function(t) { return t.id === btn.dataset.id; });
        if (t) self._showTeamEdit(t, true);
      };
    });
    document.querySelectorAll('#inner-team .btn-del-team').forEach(function(btn) {
      btn.onclick = function() {
        if (!confirm('确定删除该队伍？')) return;
        self._teams = self._teams.filter(function(t) { return t.id !== btn.dataset.id; });
        self._renderTeamLedger();
      };
    });
  },

  _showTeamEdit(team, assignMode) {
    team = team || {};
    var panel = document.getElementById('teamEditPanel');
    panel.style.display = 'block';
    var rangerOpts = '';
    var self = this;
    var rangers = this._users.filter(function(u) { return u.role === 'ranger'; });
    rangers.forEach(function(r) {
      var selected = team.members && team.members.indexOf(r.id) >= 0 ? ' selected' : '';
      rangerOpts += '<option value="' + r.id + '"' + selected + '>' + r.name + ' (' + r.id + ')</option>';
    });

    panel.innerHTML =
      '<h4 style="margin:0 0 8px 0;font-size:13px;">' + (assignMode ? '分配区域 - ' + team.name : (team.id ? '编辑' : '新建') + '队伍') + '</h4>' +
      '<div class="form-row"><div class="form-group half"><label>编号</label><input type="text" id="editTeamId" value="' + (team.id || '') + '" ' + (team.id ? 'readonly' : 'placeholder="如TM05"') + '/></div>' +
      '<div class="form-group half"><label>名称</label><input type="text" id="editTeamName" value="' + (team.name || '') + '"/></div></div>' +
      '<div class="form-row"><div class="form-group half"><label>队长</label><select id="editTeamLeader"><option value="">-- 选择队长 --</option>' +
      rangers.map(function(r) { return '<option value="' + r.id + '"' + (team.leader === r.name ? ' selected' : '') + '>' + r.name + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group half"><label>巡护区域</label><input type="text" id="editTeamArea" value="' + (team.area || '') + '"/></div></div>' +
      '<div class="form-group"><label>队伍成员 <span style="font-size:10px;color:var(--text-muted);">Ctrl+Click 多选</span></label><select id="editTeamMembers" multiple style="height:100px;">' + rangerOpts + '</select></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary btn-sm" id="btnSaveTeam">保存</button><button class="btn btn-outline btn-sm" id="btnCancelTeam">取消</button></div>';

    document.getElementById('btnSaveTeam').onclick = function() {
      var id = document.getElementById('editTeamId').value.trim();
      var name = document.getElementById('editTeamName').value.trim();
      var leaderSel = document.getElementById('editTeamLeader');
      var leaderName = leaderSel.options[leaderSel.selectedIndex].text;
      var area = document.getElementById('editTeamArea').value.trim();
      var membersSel = document.getElementById('editTeamMembers');
      var members = [];
      for (var i = 0; i < membersSel.options.length; i++) {
        if (membersSel.options[i].selected) members.push(membersSel.options[i].value);
      }
      if (!id || !name) { alert('编号和名称必填'); return; }

      if (team.id) {
        var t = self._teams.find(function(t) { return t.id === team.id; });
        if (t) {
          t.name = name; t.leader = leaderName; t.area = area;
          t.members = members; t.count = members.length;
        }
      } else {
        self._teams.push({ id:id, name:name, leader:leaderName, count:members.length, area:area, monthly:0, members:members });
      }
      self._renderTeamLedger();
      panel.style.display = 'none';
    };
    document.getElementById('btnCancelTeam').onclick = function() { panel.style.display = 'none'; };
  },

  // ==================== 内部tab切换监听 ====================
  _bindInnerTabSwitch() {
    var self = this;
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mu) {
        if (mu.target.id === 'inner-ranger' && mu.target.classList.contains('active')) self._renderRangerLedger();
        if (mu.target.id === 'inner-drone' && mu.target.classList.contains('active')) self._renderDroneLedger();
        if (mu.target.id === 'inner-team' && mu.target.classList.contains('active')) self._renderTeamLedger();
      });
    });
    ['inner-ranger','inner-drone','inner-team'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
};

function initForceLedger() {
  patrolForceLedger.init();
}
