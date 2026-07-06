const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = OFF');
  db.run('PRAGMA synchronous = OFF');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT,
      password    TEXT DEFAULT '123456',
      role        TEXT DEFAULT 'ranger',
      color       TEXT DEFAULT '#3388ff',
      created_at  INTEGER
    )
  `);

  // 兼容旧表：尝试添加新列
  try { db.run('ALTER TABLE users ADD COLUMN password TEXT DEFAULT \'123456\''); } catch(e) {}
  try { db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'ranger\''); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS patrols (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      area          TEXT,
      task_type     TEXT DEFAULT '日常巡护',
      description   TEXT,
      start_time    INTEGER,
      end_time      INTEGER,
      status        TEXT DEFAULT 'pending',
      started_at    INTEGER,
      ended_at      INTEGER,
      created_at    INTEGER
    )
  `);

  try { db.run('ALTER TABLE patrols ADD COLUMN task_type TEXT DEFAULT \'日常巡护\''); } catch(e) {}
  try { db.run('ALTER TABLE patrols ADD COLUMN description TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE patrols ADD COLUMN start_time INTEGER'); } catch(e) {}
  try { db.run('ALTER TABLE patrols ADD COLUMN end_time INTEGER'); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS patrol_members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patrol_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      status      TEXT DEFAULT 'active',
      UNIQUE(patrol_id, user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trajectory_points (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      patrol_id       TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      latitude        REAL NOT NULL,
      longitude       REAL NOT NULL,
      accuracy        REAL,
      altitude        REAL,
      altitude_accuracy REAL,
      speed           REAL,
      heading         REAL,
      recorded_at     INTEGER NOT NULL,
      source          TEXT DEFAULT 'realtime',
      created_at      INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS patrol_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patrol_id   TEXT,
      user_id     TEXT NOT NULL,
      user_name   TEXT,
      area        TEXT,
      log_date    INTEGER,
      duration    REAL DEFAULT 0,
      distance    REAL DEFAULT 0,
      findings    TEXT,
      notes       TEXT,
      created_at  INTEGER
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_traj_patrol_user ON trajectory_points(patrol_id, user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_traj_time ON trajectory_points(patrol_id, user_id, recorded_at)');
  db.run(`
    CREATE TABLE IF NOT EXISTS patrol_routes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patrol_id   TEXT NOT NULL,
      name        TEXT,
      points_json TEXT NOT NULL,
      distance    REAL DEFAULT 0,
      duration    REAL DEFAULT 4,
      mode        TEXT DEFAULT 'draw',
      created_at  INTEGER
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_logs_user ON patrol_logs(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_logs_date ON patrol_logs(log_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_route_patrol ON patrol_routes(patrol_id)');
  try { db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_route_patrol_name ON patrol_routes(patrol_id, name)'); } catch(e) {}
  try { db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_traj_point ON trajectory_points(patrol_id, user_id, recorded_at)'); } catch(e) {}

  // 初始化默认数据
  seedDefaultData(db);
  // 种子轨迹路线（幂等：只在路线数不足时补入）
  seedTrajectoryData(db);

  return db;
}

function seedDefaultData(db) {
  var stmt = db.prepare('SELECT COUNT(*) as cnt FROM users');
  var cnt = 0;
  if (stmt.step()) cnt = stmt.getAsObject().cnt;
  stmt.free();
  if (cnt > 0) return;

  var now = Date.now();
  var users = [
    ['admin', '管理员', '', 'admin', 'admin', '#00aaff', now],
    ['HL001', '张建国', '13812341234', '123456', 'ranger', '#00e676', now],
    ['HL002', '李明辉', '13956785678', '123456', 'ranger', '#00e676', now],
    ['HL003', '王大山', '13790129012', '123456', 'ranger', '#00e676', now],
    ['HL004', '陈志强', '13634563456', '123456', 'ranger', '#ff9800', now],
    ['HL005', '刘德才', '13578907890', '123456', 'ranger', '#00e676', now],
    ['HL006', '赵文华', '13423452345', '123456', 'ranger', '#00e676', now],
    ['HL007', '孙立军', '13367896789', '123456', 'ranger', '#ff9800', now],
    ['HL008', '周国平', '13201230123', '123456', 'ranger', '#00e676', now],
  ];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    db.run('INSERT OR IGNORE INTO users (id, name, phone, password, role, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', u);
  }

  var patrols = [
    ['P20240622-001', '一号林区日常巡护', '一号林区', '日常巡护', '覆盖一号林区全域', now - 86400000, now + 86400000 * 2, 'completed', now],
    ['P20240622-002', '二号林区火情排查', '二号林区', '专项巡护', '排查二号林区火情隐患', now, now + 86400000, 'completed', now],
    ['P20240622-003', '三号林区病虫害巡查', '三号林区', '专项巡护', '巡查松材线虫病害', now - 3600000, now + 86400000 * 3, 'active', now],
    ['P20240622-004', '四号林区常规巡护', '四号林区', '日常巡护', '覆盖四号林区全域', now - 86400000 * 7, now + 86400000 * 7, 'completed', now],
    ['P20240622-005', '五号林区生态监测', '五号林区', '日常巡护', '五号林区生态样地监测', now - 86400000 * 5, now + 86400000 * 5, 'completed', now],
    ['P20240622-006', '全域综合巡护', '一号林区', '专项巡护', '全域火险隐患综合排查', now - 86400000 * 14, now + 86400000 * 14, 'completed', now],
  ];
  for (var j = 0; j < patrols.length; j++) {
    var p = patrols[j];
    db.run('INSERT OR IGNORE INTO patrols (id, name, area, task_type, description, start_time, end_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', p);
  }

  // 关联护林员到任务
  var members = [
    ['P20240622-001', 'HL001'],
    ['P20240622-001', 'HL002'],
    ['P20240622-002', 'HL003'],
    ['P20240622-002', 'HL004'],
    ['P20240622-003', 'HL005'],
    ['P20240622-004', 'HL007'],
    ['P20240622-004', 'HL008'],
    ['P20240622-005', 'HL008'],
    ['P20240622-006', 'HL006'],
    ['P20240622-006', 'HL007'],
  ];
  for (var k = 0; k < members.length; k++) {
    var m = members[k];
    db.run('INSERT OR IGNORE INTO patrol_members (patrol_id, user_id) VALUES (?, ?)', m);
  }

  // 初始巡护日志
  var logs = [
    ['P20240622-001', 'HL001', '张建国', '一号林区', now - 86400000, 6.5, 18.2, '野外用火1处', '正常完成巡护'],
    ['P20240622-001', 'HL002', '李明辉', '一号林区', now - 86400000, 5.0, 14.5, '无异常', '正常完成巡护'],
    ['P20240622-002', 'HL003', '王大山', '二号林区', now - 86400000 * 2, 7.0, 20.3, '枯死松树3棵', '已上报病虫害'],
    ['P20240622-002', 'HL004', '陈志强', '二号林区', now - 86400000 * 2, 4.5, 12.8, '发现盗伐痕迹', '已上报处理'],
    ['P20240622-003', 'HL005', '刘德才', '三号林区', now - 86400000 * 3, 8.0, 22.1, '松材线虫感染区扩大', '已上报，需专项治理'],
    ['P20240622-004', 'HL007', '孙立军', '四号林区', now - 86400000 * 5, 5.5, 15.8, '发现野生动物痕迹', '正常完成巡护'],
    ['P20240622-005', 'HL008', '周国平', '五号林区', now - 86400000 * 4, 4.0, 12.0, '无异常', '正常完成巡护'],
    ['P20240622-006', 'HL006', '赵文华', '一号林区', now - 86400000 * 10, 7.2, 20.5, '滑坡隐患1处', '已上报处理'],
  ];
  for (var l = 0; l < logs.length; l++) {
    var log = logs[l];
    db.run('INSERT OR IGNORE INTO patrol_logs (patrol_id, user_id, user_name, area, log_date, duration, distance, findings, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', log);
  }

  saveDb();
  console.log('已初始化默认数据: ' + users.length + ' 用户, ' + patrols.length + ' 任务, ' + logs.length + ' 日志');
}

// ===== 轨迹种子数据（幂等：只在路线数不足时补入，绝不删DB） =====
function seedTrajectoryData(db) {
  var routeStmt = db.prepare('SELECT COUNT(*) as cnt FROM patrol_routes');
  var routeCnt = 0;
  if (routeStmt.step()) routeCnt = routeStmt.getAsObject().cnt;
  routeStmt.free();

  var TARGET = 35; // 5个林区 × 7条路线
  if (routeCnt >= TARGET) {
    console.log('[SeedTraj] 路线充足 (' + routeCnt + '/' + TARGET + ')，跳过');
    return;
  }
  console.log('[SeedTraj] 路线不足 (' + routeCnt + '/' + TARGET + ')，开始补入...');

  var now = Date.now();

  var compartments = [
    { area: '一号林区', pid: 'P20240622-001', centerLat: 26.645, centerLng: 106.722, w: 0.012, h: 0.010 },
    { area: '二号林区', pid: 'P20240622-002', centerLat: 26.655, centerLng: 106.735, w: 0.014, h: 0.012 },
    { area: '三号林区', pid: 'P20240622-003', centerLat: 26.642, centerLng: 106.718, w: 0.012, h: 0.010 },
    { area: '四号林区', pid: 'P20240622-004', centerLat: 26.650, centerLng: 106.715, w: 0.013, h: 0.011 },
    { area: '五号林区', pid: 'P20240622-005', centerLat: 26.648, centerLng: 106.728, w: 0.012, h: 0.010 },
  ];

  // Z字扫描路径生成器
  function generateZigzagRoute(startLat, startLng, endLat, endLng, zigCount) {
    var pts = [];
    var steps = zigCount * 2;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var lat = startLat + (endLat - startLat) * t;
      var lng = startLng + (endLng - startLng) * t;
      if (i > 0 && i < steps) {
        var off = (i % 2 === 0 ? 1 : -1) * 0.0018 * (1 - Math.abs(t - 0.5) * 2);
        lat += off * 0.25;
        lng += off * 1.2;
      }
      pts.push({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
    }
    return pts;
  }

  // 沿路线均匀分布轨迹点 + GPS抖动
  function generateTrajAlongRoute(patrolId, userId, routePoints, pointCount, baseTime, intervalSec) {
    intervalSec = intervalSec || 25;
    for (var ti = 0; ti < pointCount; ti++) {
      var progress = ti / (pointCount - 1);
      var segIdx = Math.min(Math.floor(progress * (routePoints.length - 1)), routePoints.length - 2);
      var segT = (progress * (routePoints.length - 1)) - segIdx;
      var p0 = routePoints[segIdx];
      var p1 = routePoints[segIdx + 1];
      var lat = p0.lat + (p1.lat - p0.lat) * segT + (Math.random() - 0.5) * 0.00015;
      var lng = p0.lng + (p1.lng - p0.lng) * segT + (Math.random() - 0.5) * 0.00015;
      var ts = baseTime - (pointCount - ti) * intervalSec * 1000;
      var acc = 3 + Math.random() * 10;
      db.run('INSERT OR IGNORE INTO trajectory_points (patrol_id, user_id, latitude, longitude, accuracy, recorded_at, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [patrolId, userId, parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)), parseFloat(acc.toFixed(1)), ts, 'realtime', ts]);
    }
  }

  // 辅助：插入路线记录（幂等）
  function insertRoute(patrolId, name, routePts, dist, dur) {
    db.run('INSERT OR IGNORE INTO patrol_routes (patrol_id, name, points_json, distance, duration, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [patrolId, name, JSON.stringify(routePts), dist, dur, 'draw', now]);
  }

  // 每个林区7条路线配置: [起点偏移lat, 起点偏移lng, 终点偏移lat, 终点偏移lng, zig数, 用户, 点数, 几天前, 间隔秒, 路线名后缀, 距离, 时长]
  // 起点/终点偏移相对于林区中心的 (h/2, w/2) 边界
  var routeTotal = 0, trajTotal = 0;

  function addCompRoutes(c, routes) {
    for (var ri = 0; ri < routes.length; ri++) {
      var r = routes[ri];
      var startLat = c.centerLat + r[0] * c.h/2;
      var startLng = c.centerLng + r[1] * c.w/2;
      var endLat = c.centerLat + r[2] * c.h/2;
      var endLng = c.centerLng + r[3] * c.w/2;
      var routePts = generateZigzagRoute(startLat, startLng, endLat, endLng, r[4]);
      insertRoute(c.pid, c.area + r[9], routePts, r[10], r[11]);
      generateTrajAlongRoute(c.pid, r[5], routePts, r[6], now - 86400000 * r[7], r[8]);
      routeTotal++;
      trajTotal += r[6];
    }
  }

  // ===== 一号林区 (P001): HL001 + HL002 =====
  addCompRoutes(compartments[0], [
    // [sLat, sLng, eLat, eLng, zig, user, pts, daysAgo, interval, name, dist, dur]
    [-1, -1,  1,  1, 6, 'HL001', 200,  2, 28, '主巡路线', 4.2, 5.0],
    [ 0.6,  0.8, -0.6, -0.8, 4, 'HL002', 160,  2, 30, '辅助路线', 3.0, 3.5],
    [-1,  0.6,  1, -0.6, 5, 'HL001', 140,  3, 32, '纵穿路线', 3.2, 3.8],
    [-0.5,  1, -0.5, -1, 6, 'HL002', 180,  4, 26, '横贯路线', 3.8, 4.5],
    [-0.3, -1,  0.3,  1, 4, 'HL001', 150,  5, 30, '斜穿路线', 3.1, 3.6],
    [ 0.8, -0.8, -0.8,  0.8, 5, 'HL002', 170,  6, 27, '对角路线', 3.5, 4.0],
    [-0.9,  0.2,  0.9, -0.2, 7, 'HL001', 190,  7, 25, '密集扫描路线', 4.0, 4.8],
  ]);

  // ===== 二号林区 (P002): HL003 + HL004 =====
  addCompRoutes(compartments[1], [
    [-1, -1,  1,  1, 5, 'HL004', 180,  1, 22, '火情排查路线', 3.85, 4.5],
    [ 0.4, -0.6, -0.6,  0.6, 4, 'HL003', 150,  2, 25, '辅助巡查路线', 3.0, 3.0],
    [ 0.8, -0.8, -0.8,  0.8, 5, 'HL003', 160,  4, 28, '横穿排查路线', 3.5, 4.0],
    [ 0.3,  0.9,  0.3, -0.9, 6, 'HL004', 170,  5, 24, '南北纵穿路线', 3.6, 4.2],
    [-0.7,  0.5,  0.7, -0.5, 5, 'HL003', 155,  6, 27, '斜角排查路线', 3.3, 3.8],
    [-0.5, -0.9,  0.5,  0.9, 7, 'HL004', 190,  3, 23, '对角线巡护', 4.1, 5.0],
    [-0.8,  0,    0.8,  0,   4, 'HL004', 140,  7, 30, '中线横穿路线', 3.0, 3.5],
  ]);

  // ===== 三号林区 (P003): HL005 + HL006 =====
  addCompRoutes(compartments[2], [
    [-1, -1,  1,  1, 5, 'HL005', 200,  3, 24, '病虫害巡查路线', 3.5, 4.0],
    [-0.6,  0.8,  0.6, -0.8, 5, 'HL005', 160,  5, 26, '横穿巡查路线', 3.4, 3.8],
    [ 0.5, -0.7, -0.5,  0.7, 4, 'HL005', 150,  8, 30, '斜向巡查路线', 3.2, 3.6],
    [-0.4, -0.8,  0.4,  0.8, 6, 'HL005', 180,  6, 25, '对角病虫路线', 3.7, 4.3],
    [ 0.7,  0.3, -0.7, -0.3, 5, 'HL005', 170,  7, 27, '纵贯扫描路线', 3.6, 4.1],
    [-0.8,  0.4,  0.8, -0.4, 7, 'HL005', 190,  4, 23, '密集筛查路线', 4.0, 4.6],
    [-0.2, -0.9,  0.2,  0.9, 4, 'HL005', 140,  9, 32, '边缘巡查路线', 3.0, 3.4],
  ]);

  // ===== 四号林区 (P004): HL007 + HL008 =====
  addCompRoutes(compartments[3], [
    [-1, -1,  1,  1, 5, 'HL007', 200,  5, 26, '常规巡护路线', 3.8, 4.2],
    [ 0.3, -0.7, -0.5,  0.7, 4, 'HL008', 150,  5, 28, '辅助路线', 3.0, 3.5],
    [ 0.7, -0.7, -0.7,  0.7, 5, 'HL007', 140,  6, 30, '纵穿巡护路线', 3.3, 3.8],
    [-0.6,  0.5,  0.6, -0.5, 6, 'HL008', 170,  7, 25, '斜角路线', 3.5, 4.1],
    [-0.3, -0.9,  0.3,  0.9, 5, 'HL007', 180,  8, 27, '南北横贯路线', 3.7, 4.3],
    [ 0.5,  0.6, -0.5, -0.6, 7, 'HL008', 190,  4, 23, '密集巡护路线', 4.0, 4.7],
    [-0.8, -0.3,  0.8,  0.3, 4, 'HL007', 160,  9, 29, '边缘覆盖路线', 3.4, 3.9],
  ]);

  // ===== 五号林区 (P005): HL008 =====
  addCompRoutes(compartments[4], [
    [-1, -1,  1,  1, 5, 'HL008', 160,  4, 27, '生态监测路线', 3.6, 4.0],
    [-0.6,  0.7,  0.6, -0.7, 4, 'HL008', 130,  5, 30, '生态辅助路线', 3.1, 3.5],
    [ 0.5, -0.6, -0.5,  0.6, 5, 'HL008', 170,  6, 25, '样地巡查路线', 3.5, 4.0],
    [-0.4, -0.7,  0.4,  0.7, 6, 'HL008', 180,  7, 26, '对角样线路线', 3.7, 4.2],
    [ 0.7,  0.4, -0.7, -0.4, 4, 'HL008', 140,  8, 31, '纵穿样带路线', 3.1, 3.6],
    [-0.7,  0.3,  0.7, -0.3, 7, 'HL008', 190,  3, 22, '密集生态路线', 4.1, 4.8],
    [ 0.1, -0.9, -0.1,  0.9, 5, 'HL008', 150,  9, 28, '边缘监测路线', 3.3, 3.8],
  ]);

  // ===== 全局散点：确保边缘覆盖 =====
  var scatterCenters = [
    [26.640, 106.710], [26.660, 106.745], [26.635, 106.730],
    [26.655, 106.710], [26.643, 106.740], [26.648, 106.718],
    [26.652, 106.725], [26.638, 106.722], [26.662, 106.738],
    [26.645, 106.750], [26.636, 106.715], [26.658, 106.720],
  ];
  scatterCenters.forEach(function(sc) {
    for (var si = 0; si < 6; si++) {
      var spid = ['P20240622-001','P20240622-002','P20240622-003','P20240622-004','P20240622-005','P20240622-006'][Math.floor(Math.random() * 6)];
      var suid = ['HL001','HL002','HL003','HL004','HL005','HL006','HL007','HL008'][Math.floor(Math.random() * 8)];
      db.run('INSERT OR IGNORE INTO trajectory_points (patrol_id, user_id, latitude, longitude, accuracy, recorded_at, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [spid, suid, sc[0] + (Math.random() - 0.5) * 0.003, sc[1] + (Math.random() - 0.5) * 0.003, 10 + Math.random() * 20, now - 86400000 * Math.floor(Math.random() * 28), 'realtime', now]);
    }
  });
  trajTotal += scatterCenters.length * 6;

  saveDb();
  console.log('[SeedTraj] 补入完成: ' + routeTotal + ' 条路线, ' + trajTotal + ' 个轨迹点');
}

// 定期保存到磁盘
async function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.dbPath, buffer);
}

// 每60秒自动保存
setInterval(() => saveDb(), 60000);

process.on('exit', () => { if (db) { const d = Buffer.from(db.export()); fs.writeFileSync(config.dbPath, d); } });
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

module.exports = { getDb, saveDb };
