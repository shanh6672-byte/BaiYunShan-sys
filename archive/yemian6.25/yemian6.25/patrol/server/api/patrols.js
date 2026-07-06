const express = require('express');
const router = express.Router();
const patrolOps = require('../db/patrols');

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const result = await patrolOps.list(filter);
  res.json(result);
});

router.get('/active', async (req, res) => {
  const result = await patrolOps.getActive();
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const p = await patrolOps.getById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

router.post('/', async (req, res) => {
  const { id, name, area, task_type, description, start_time, end_time, members } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  const result = await patrolOps.create({ id, name, area, task_type, description, start_time, end_time, members });
  res.json(result);
});

router.put('/:id', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  const result = await patrolOps.updateStatus(req.params.id, status, Date.now());
  res.json(result);
});

router.delete('/:id', async (req, res) => {
  const { adminPassword } = req.body || {};
  if (!adminPassword) return res.status(401).json({ error: '需要管理员密码' });

  const userOps = require('../db/users');
  const admin = await userOps.getById('admin');
  if (!admin || admin.password !== adminPassword) {
    return res.status(401).json({ error: '管理员密码错误' });
  }

  await patrolOps.delete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
