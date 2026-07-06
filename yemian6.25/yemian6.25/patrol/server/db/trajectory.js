const { getDb, saveDb } = require('./init');

const trajOps = {
  async insert(point) {
    const db = await getDb();
    // 检查是否已存在（去重）
    const check = db.prepare(
      'SELECT id FROM trajectory_points WHERE user_id = ? AND recorded_at = ? LIMIT 1'
    );
    check.bind([point.user_id, point.recorded_at]);
    const exists = check.step();
    check.free();
    if (exists) return 0;

    const now = Date.now();
    db.run(`
      INSERT INTO trajectory_points
        (patrol_id, user_id, latitude, longitude, accuracy, altitude, altitude_accuracy, speed, heading, recorded_at, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      point.patrol_id, point.user_id, point.latitude, point.longitude,
      point.accuracy || null, point.altitude || null, point.altitude_accuracy || null,
      point.speed || null, point.heading || null,
      point.recorded_at, point.source || 'realtime', now
    ]);
    return 1;
  },

  async insertBatch(points) {
    const db = await getDb();
    let count = 0;
    const checkStmt = db.prepare(
      'SELECT id FROM trajectory_points WHERE user_id = ? AND recorded_at = ? LIMIT 1'
    );
    const now = Date.now();

    for (const p of points) {
      checkStmt.bind([p.user_id, p.recorded_at]);
      if (checkStmt.step()) {
        checkStmt.reset();
        continue;
      }
      checkStmt.reset();

      db.run(`
        INSERT INTO trajectory_points
          (patrol_id, user_id, latitude, longitude, accuracy, altitude, altitude_accuracy, speed, heading, recorded_at, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.patrol_id, p.user_id, p.latitude, p.longitude,
        p.accuracy || null, p.altitude || null, p.altitude_accuracy || null,
        p.speed || null, p.heading || null,
        p.recorded_at, p.source || 'offline_sync', now
      ]);
      count++;
    }
    checkStmt.free();
    if (count > 0) saveDb();
    return count;
  },

  async query({ patrolId, userId, from, to, limit = 10000, offset = 0 }) {
    const db = await getDb();
    let sql = 'SELECT * FROM trajectory_points WHERE patrol_id = ?';
    const params = [patrolId];

    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (from) { sql += ' AND recorded_at >= ?'; params.push(from); }
    if (to) { sql += ' AND recorded_at <= ?'; params.push(to); }
    sql += ' ORDER BY recorded_at ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const obj = {};
      for (const col of cols) obj[col] = stmt.getAsObject()[col];
      results.push(obj);
    }
    stmt.free();
    return results;
  },

  async getLastPointId(patrolId, userId) {
    const db = await getDb();
    const stmt = db.prepare(
      'SELECT id FROM trajectory_points WHERE patrol_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1'
    );
    stmt.bind([patrolId, userId]);
    let id = 0;
    if (stmt.step()) id = stmt.getAsObject().id;
    stmt.free();
    return id;
  },

  async listSessions() {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT
        t.patrol_id, t.user_id,
        u.name as user_name,
        p.name as patrol_name,
        MIN(t.recorded_at) as start_time,
        MAX(t.recorded_at) as end_time,
        COUNT(*) as point_count
      FROM trajectory_points t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN patrols p ON t.patrol_id = p.id
      GROUP BY t.patrol_id, t.user_id
      ORDER BY MAX(t.recorded_at) DESC
      LIMIT 50
    `);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();
    return results;
  },

  async getLatestPoint(patrolId, userId) {
    const db = await getDb();
    const stmt = db.prepare(
      'SELECT latitude, longitude, accuracy, altitude, speed, heading, recorded_at FROM trajectory_points WHERE patrol_id = ? AND user_id = ? ORDER BY recorded_at DESC LIMIT 1'
    );
    stmt.bind([patrolId, userId]);
    let result = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      result = {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy,
        altitude: row.altitude,
        speed: row.speed,
        heading: row.heading,
        timestamp: row.recorded_at
      };
    }
    stmt.free();
    return result;
  }
};

module.exports = trajOps;
