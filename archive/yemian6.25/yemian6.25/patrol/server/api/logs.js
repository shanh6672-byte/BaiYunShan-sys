const express = require('express');
const router = express.Router();
const logOps = require('../db/logs');

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.patrolId) filter.patrolId = req.query.patrolId;
  if (req.query.keyword) filter.keyword = req.query.keyword;
  if (req.query.limit) filter.limit = parseInt(req.query.limit);
  if (req.query.offset) filter.offset = parseInt(req.query.offset);
  const result = await logOps.list(filter);
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const log = await logOps.getById(parseInt(req.params.id));
  if (!log) return res.status(404).json({ error: 'not found' });
  res.json(log);
});

router.post('/', async (req, res) => {
  const { patrol_id, user_id, user_name, area, log_date, duration, distance, findings, notes } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const result = await logOps.create({ patrol_id, user_id, user_name, area, log_date, duration, distance, findings, notes });
  res.json(result);
});

router.put('/:id', async (req, res) => {
  const result = await logOps.update(parseInt(req.params.id), req.body);
  if (!result) return res.status(404).json({ error: 'not found' });
  res.json(result);
});

router.delete('/:id', async (req, res) => {
  await logOps.delete(parseInt(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
