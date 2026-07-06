const express = require('express');
const router = express.Router();
const userOps = require('../db/users');

router.get('/', async (req, res) => {
  const result = await userOps.list();
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const u = await userOps.getById(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(u);
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const u = await userOps.getById(username);
  if (!u || u.password !== password) return res.status(401).json({ error: '用户名或密码错误' });
  res.json({ success: true, data: { id: u.id, name: u.name, role: u.role } });
});

router.post('/', async (req, res) => {
  const { id, name, phone, password, role } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  const result = await userOps.upsert({ id, name, phone, password, role });
  res.json(result);
});

router.put('/:id', async (req, res) => {
  const { name, phone, password, role } = req.body;
  const result = await userOps.upsert({ id: req.params.id, name, phone, password, role });
  res.json(result);
});

router.delete('/:id', async (req, res) => {
  await userOps.delete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
