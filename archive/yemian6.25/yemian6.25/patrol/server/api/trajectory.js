const express = require('express');
const router = express.Router();
const trajOps = require('../db/trajectory');

// 轨迹档案列表（必须在 /:patrolId 之前定义）
router.get('/sessions/list', async (req, res) => {
  try {
    const sessions = await trajOps.listSessions();
    res.json({ sessions, total: sessions.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:patrolId', async (req, res) => {
  const { userId, from, to, limit, offset } = req.query;
  const points = await trajOps.query({
    patrolId: req.params.patrolId,
    userId,
    from: from ? Number(from) : undefined,
    to: to ? Number(to) : undefined,
    limit: limit ? Number(limit) : 10000,
    offset: offset ? Number(offset) : 0
  });
  res.json({ patrolId: req.params.patrolId, points, total: points.length });
});

router.post('/:patrolId/batch', async (req, res) => {
  const { points } = req.body;
  if (!points || !Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: 'points array required' });
  }
  const items = points.map(p => ({
    patrol_id: req.params.patrolId,
    user_id: p.user_id || req.body.user_id,
    latitude: p.latitude,
    longitude: p.longitude,
    accuracy: p.accuracy,
    altitude: p.altitude,
    altitude_accuracy: p.altitude_accuracy,
    speed: p.speed,
    heading: p.heading,
    recorded_at: p.recorded_at,
    source: 'offline_sync'
  }));
  const inserted = await trajOps.insertBatch(items);
  res.json({ inserted });
});

module.exports = router;
