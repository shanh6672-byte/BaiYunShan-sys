const { getDb, saveDb } = require('./init');

const patrolOps = {
  async list(filter = {}) {
    const db = await getDb();
    let sql = 'SELECT * FROM patrols';
    const conditions = [];
    const params = [];
    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(_rowToObj(stmt));
    stmt.free();

    // 批量加载 members
    if (results.length > 0) {
      const ids = results.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const mStmt = db.prepare(`
        SELECT pm.patrol_id, u.id, u.name, u.color, pm.status
        FROM patrol_members pm JOIN users u ON pm.user_id = u.id
        WHERE pm.patrol_id IN (${placeholders})
      `);
      mStmt.bind(ids);
      const memberMap = {};
      while (mStmt.step()) {
        const row = mStmt.getAsObject();
        if (!memberMap[row.patrol_id]) memberMap[row.patrol_id] = [];
        memberMap[row.patrol_id].push({ id: row.id, name: row.name, color: row.color, status: row.status });
      }
      mStmt.free();
      for (const r of results) {
        r.members = memberMap[r.id] || [];
      }
    }

    return results;
  },

  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM patrols WHERE id = ?');
    stmt.bind([id]);
    let patrol = null;
    if (stmt.step()) patrol = _rowToObj(stmt);
    stmt.free();
    if (patrol) {
      patrol.members = this._getMembers(db, id);
    }
    return patrol;
  },

  _getMembers(db, patrolId) {
    const stmt = db.prepare(`
      SELECT u.id, u.name, u.color, pm.status
      FROM patrol_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.patrol_id = ?
    `);
    stmt.bind([patrolId]);
    const results = [];
    while (stmt.step()) results.push(_rowToObj(stmt));
    stmt.free();
    return results;
  },

  async create(patrol) {
    const db = await getDb();
    const now = Date.now();
    db.run('INSERT OR IGNORE INTO patrols (id, name, area, task_type, description, start_time, end_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [patrol.id, patrol.name, patrol.area || '', patrol.task_type || '日常巡护', patrol.description || '', patrol.start_time || null, patrol.end_time || null, 'pending', now]);
    if (patrol.members && patrol.members.length) {
      for (const uid of patrol.members) {
        db.run('INSERT OR IGNORE INTO patrol_members (patrol_id, user_id) VALUES (?, ?)',
          [patrol.id, uid]);
      }
    }
    saveDb();
    return this.getById(patrol.id);
  },

  async updateStatus(id, status, timestamp) {
    const db = await getDb();
    if (status === 'active') {
      db.run('UPDATE patrols SET status = ?, started_at = COALESCE(started_at, ?) WHERE id = ?',
        [status, timestamp, id]);
    } else if (status === 'completed' || status === 'cancelled') {
      db.run('UPDATE patrols SET status = ?, ended_at = ? WHERE id = ?',
        [status, timestamp, id]);
    } else {
      db.run('UPDATE patrols SET status = ? WHERE id = ?', [status, id]);
    }
    saveDb();
    return this.getById(id);
  },

  async delete(id) {
    const db = await getDb();
    db.run('DELETE FROM trajectory_points WHERE patrol_id = ?', [id]);
    db.run('DELETE FROM patrol_members WHERE patrol_id = ?', [id]);
    db.run('DELETE FROM patrols WHERE id = ?', [id]);
    saveDb();
  },

  async getActive() {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT p.*, GROUP_CONCAT(pm.user_id) as member_ids
      FROM patrols p LEFT JOIN patrol_members pm ON p.id = pm.patrol_id
      WHERE p.status = 'active' GROUP BY p.id
    `);
    const results = [];
    while (stmt.step()) results.push(_rowToObj(stmt));
    stmt.free();
    return results;
  }
};

function _rowToObj(stmt) {
  const cols = stmt.getColumnNames();
  const obj = {};
  for (const col of cols) obj[col] = stmt.getAsObject()[col];
  return obj;
}

module.exports = patrolOps;
