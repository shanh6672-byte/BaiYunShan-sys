const { getDb, saveDb } = require('./init');

const routeOps = {
  async list(filter = {}) {
    const db = await getDb();
    let sql = 'SELECT * FROM patrol_routes WHERE 1=1';
    const params = [];
    if (filter.patrolId) { sql += ' AND patrol_id = ?'; params.push(filter.patrolId); }
    sql += ' ORDER BY created_at DESC';
    if (filter.limit) { sql += ' LIMIT ?'; params.push(filter.limit); }
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(_rowToObj(stmt));
    stmt.free();
    return results;
  },

  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM patrol_routes WHERE id = ?');
    stmt.bind([id]);
    let route = null;
    if (stmt.step()) route = _rowToObj(stmt);
    stmt.free();
    return route;
  },

  async getByPatrolId(patrolId) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM patrol_routes WHERE patrol_id = ? ORDER BY created_at DESC');
    stmt.bind([patrolId]);
    const results = [];
    while (stmt.step()) results.push(_rowToObj(stmt));
    stmt.free();
    return results;
  },

  async create(route) {
    const db = await getDb();
    const now = Date.now();
    db.run(
      'INSERT INTO patrol_routes (patrol_id, name, points_json, distance, duration, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [route.patrol_id || '', route.name || '', route.points_json || '[]', route.distance || 0, route.duration || 4, route.mode || 'draw', now]
    );
    saveDb();
    const id = db.exec('SELECT last_insert_rowid()');
    return this.getById(id[0] ? id[0].values[0][0] : 0);
  },

  async update(id, data) {
    const db = await getDb();
    const sets = [];
    const params = [];
    const fields = ['patrol_id', 'name', 'points_json', 'distance', 'duration', 'mode'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) { sets.push(f + ' = ?'); params.push(data[f]); }
    });
    if (sets.length === 0) return null;
    params.push(id);
    db.run('UPDATE patrol_routes SET ' + sets.join(', ') + ' WHERE id = ?', params);
    saveDb();
    return this.getById(id);
  },

  async delete(id) {
    const db = await getDb();
    db.run('DELETE FROM patrol_routes WHERE id = ?', [id]);
    saveDb();
    return { ok: true };
  },

  async deleteByPatrolId(patrolId) {
    const db = await getDb();
    db.run('DELETE FROM patrol_routes WHERE patrol_id = ?', [patrolId]);
    saveDb();
    return { ok: true };
  }
};

function _rowToObj(stmt) {
  const cols = stmt.getColumnNames();
  const obj = {};
  for (const col of cols) obj[col] = stmt.getAsObject()[col];
  return obj;
}

module.exports = routeOps;
