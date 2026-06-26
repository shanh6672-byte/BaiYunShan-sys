const { getDb, saveDb } = require('./init');

const logOps = {
  async list(filter = {}) {
    const db = await getDb();
    let sql = 'SELECT * FROM patrol_logs WHERE 1=1';
    const params = [];
    if (filter.userId) { sql += ' AND user_id = ?'; params.push(filter.userId); }
    if (filter.patrolId) { sql += ' AND patrol_id = ?'; params.push(filter.patrolId); }
    if (filter.keyword) { sql += ' AND (findings LIKE ? OR notes LIKE ?)'; params.push('%' + filter.keyword + '%', '%' + filter.keyword + '%'); }
    sql += ' ORDER BY log_date DESC';
    if (filter.limit) { sql += ' LIMIT ?'; params.push(filter.limit); }
    if (filter.offset) { sql += ' OFFSET ?'; params.push(filter.offset); }
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(_rowToObj(stmt));
    stmt.free();
    return results;
  },

  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM patrol_logs WHERE id = ?');
    stmt.bind([id]);
    let log = null;
    if (stmt.step()) log = _rowToObj(stmt);
    stmt.free();
    return log;
  },

  async create(log) {
    const db = await getDb();
    const now = Date.now();
    db.run(
      'INSERT INTO patrol_logs (patrol_id, user_id, user_name, area, log_date, duration, distance, findings, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [log.patrol_id || '', log.user_id, log.user_name, log.area || '', log.log_date || now, log.duration || 0, log.distance || 0, log.findings || '', log.notes || '', now]
    );
    saveDb();
    const id = db.exec('SELECT last_insert_rowid()');
    return this.getById(id[0] ? id[0].values[0][0] : 0);
  },

  async update(id, data) {
    const db = await getDb();
    const sets = [];
    const params = [];
    const fields = ['patrol_id', 'user_id', 'user_name', 'area', 'log_date', 'duration', 'distance', 'findings', 'notes'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) { sets.push(f + ' = ?'); params.push(data[f]); }
    });
    if (sets.length === 0) return null;
    params.push(id);
    db.run('UPDATE patrol_logs SET ' + sets.join(', ') + ' WHERE id = ?', params);
    saveDb();
    return this.getById(id);
  },

  async delete(id) {
    const db = await getDb();
    db.run('DELETE FROM patrol_logs WHERE id = ?', [id]);
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

module.exports = logOps;
