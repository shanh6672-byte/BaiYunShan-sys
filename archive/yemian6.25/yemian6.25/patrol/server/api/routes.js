const express = require('express');
const router = express.Router();
const routeOps = require('../db/routes');

// GET /api/routes — list all or by patrol_id
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.patrol_id) filter.patrolId = req.query.patrol_id;
    if (req.query.limit) filter.limit = parseInt(req.query.limit);
    const routes = await routeOps.list(filter);
    res.json(routes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/routes/:id
router.get('/:id', async (req, res) => {
  try {
    if (req.params.id === 'patrol') {
      // /api/routes/patrol/:patrolId
      return; // handled below
    }
    const route = await routeOps.getById(parseInt(req.params.id));
    if (!route) return res.status(404).json({ error: '路线不存在' });
    res.json(route);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/routes/patrol/:patrolId
router.get('/patrol/:patrolId', async (req, res) => {
  try {
    const routes = await routeOps.getByPatrolId(req.params.patrolId);
    res.json(routes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/routes
router.post('/', async (req, res) => {
  try {
    const { patrol_id, name, points, points_json, distance, duration, mode } = req.body;
    const data = {
      patrol_id: patrol_id || '',
      name: name || '未命名路线',
      points_json: points_json || JSON.stringify(points || []),
      distance: distance || 0,
      duration: duration || 4,
      mode: mode || 'draw'
    };
    const route = await routeOps.create(data);

    // 广播路线更新给关联巡护的移动端
    if (patrol_id && req.app._wssBroadcast) {
      req.app._wssBroadcast(patrol_id, { type: 'route_assigned', route: route });
    }

    res.status(201).json(route);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/routes/:id
router.put('/:id', async (req, res) => {
  try {
    const route = await routeOps.update(parseInt(req.params.id), req.body);
    if (!route) return res.status(404).json({ error: '路线不存在' });
    res.json(route);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/routes/:id
router.delete('/:id', async (req, res) => {
  try {
    await routeOps.delete(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
