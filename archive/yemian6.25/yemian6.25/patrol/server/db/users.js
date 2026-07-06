const { getDb, saveDb } = require('./init');

const userOps = {
  async list() {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM users ORDER BY name');
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

  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([id]);
    let user = null;
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      user = {};
      for (const col of cols) user[col] = stmt.getAsObject()[col];
    }
    stmt.free();
    return user;
  },

  async delete(id) {
    const db = await getDb();
    db.run('DELETE FROM patrol_members WHERE user_id = ?', [id]);
    db.run('DELETE FROM users WHERE id = ?', [id]);
    saveDb();
    return { ok: true };
  },

  async upsert(user) {
    const db = await getDb();
    const existing = await this.getById(user.id);
    if (existing) {
      db.run('UPDATE users SET name = ?, phone = ?, password = COALESCE(?, password), role = COALESCE(?, role) WHERE id = ?',
        [user.name, user.phone || '', user.password || null, user.role || null, user.id]);
    } else {
      const color = user.color || _randomColor();
      const role = user.role || 'ranger';
      const password = user.password || '123456';
      db.run('INSERT INTO users (id, name, phone, password, role, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, user.name, user.phone || '', password, role, color, Date.now()]);
    }
    saveDb();
    return this.getById(user.id);
  }
};

function _randomColor() {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = userOps;
