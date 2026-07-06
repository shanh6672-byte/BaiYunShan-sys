const { v4: uuidv4 } = require('uuid');
const { addClient, removeClient, broadcastToMonitors, getMobileUsers } = require('./rooms');
const userOps = require('../db/users');
const patrolOps = require('../db/patrols');
const trajOps = require('../db/trajectory');
const logOps = require('../db/logs');

const clients = new Map();

async function handleConnection(ws) {
  const clientId = uuidv4();
  let patrolId = null;
  let role = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'register':
        patrolId = msg.patrolId;
        role = msg.role;
        console.log('[WS] 注册: role=' + role + ' userId=' + msg.userId + ' patrolId=' + patrolId);

        // 确保巡护员存在
        if (msg.role === 'mobile' && msg.userId) {
          await userOps.upsert({ id: msg.userId, name: msg.userName || msg.userId });
          await patrolOps.create({ id: patrolId, name: msg.patrolName || patrolId, members: [msg.userId] });
        }

        clients.set(clientId, { ws, role, patrolId, userId: msg.userId });
        addClient(patrolId, clientId, {
          ws, role, userId: msg.userId, userName: msg.userName || msg.userId,
          lastHeartbeat: Date.now()
        });

        const resp = { type: 'registered', clientId, patrolId };
        if (msg.lastPointId && msg.userId) {
          try {
            resp.syncStatus = {
              lastServerPointId: await trajOps.getLastPointId(patrolId, msg.userId)
            };
          } catch {}
        }

        ws.send(JSON.stringify(resp));

        if (role === 'mobile') {
          const monitorCount = require('./rooms').getAllMonitorsByPatrol(patrolId).length;
          console.log('[WS] 广播user_status到 ' + monitorCount + ' 个监控端, userId=' + msg.userId + ' status=online');
          broadcastToMonitors(patrolId, {
            type: 'user_status', patrolId, userId: msg.userId,
            userName: msg.userName || msg.userId, status: 'online'
          });
        }

        // 如果是监控端注册，把当前在线的移动端列表和最新位置推给它
        if (role === 'monitor') {
          const online = getMobileUsers(patrolId);
          for (const m of online) {
            ws.send(JSON.stringify({
              type: 'user_status', patrolId, userId: m.userId,
              userName: m.userName, status: 'online'
            }));
            // 推送该用户的最新位置
            try {
              const latest = await trajOps.getLatestPoint(patrolId, m.userId);
              if (latest) {
                ws.send(JSON.stringify({
                  type: 'trajectory_broadcast',
                  patrolId,
                  userId: m.userId,
                  userName: m.userName,
                  latitude: latest.latitude,
                  longitude: latest.longitude,
                  accuracy: latest.accuracy,
                  altitude: latest.altitude,
                  speed: latest.speed,
                  heading: latest.heading,
                  timestamp: latest.timestamp
                }));
              }
            } catch {}
          }
        }
        break;

      case 'location_update':
        if (role !== 'mobile') break;
        console.log('[WS] 位置: userId=' + msg.userId + ' lat=' + msg.latitude + ' lng=' + msg.longitude);
        // 更新心跳
        (() => {
          const ci = clients.get(clientId);
          if (ci) {
            const room = require('./rooms').getRoom(patrolId);
            if (room) {
              const info = room.clients.get(clientId);
              if (info) info.lastHeartbeat = Date.now();
            }
          }
        })();
        // 异步写入数据库（不阻塞广播）
        trajOps.insert({
          patrol_id: patrolId,
          user_id: msg.userId,
          latitude: msg.latitude,
          longitude: msg.longitude,
          accuracy: msg.accuracy,
          altitude: msg.altitude,
          altitude_accuracy: msg.altitudeAccuracy,
          speed: msg.speed,
          heading: msg.heading,
          recorded_at: msg.timestamp,
          source: 'realtime'
        }).catch(() => {});
        // 广播给监控端（不等待数据库写入）
        console.log('[WS] 广播轨迹到 patrol=' + patrolId);
        broadcastToMonitors(patrolId, {
          type: 'trajectory_broadcast',
          patrolId,
          userId: msg.userId,
          userName: msg.userName || msg.userId,
          latitude: msg.latitude,
          longitude: msg.longitude,
          accuracy: msg.accuracy,
          altitude: msg.altitude,
          speed: msg.speed,
          heading: msg.heading,
          timestamp: msg.timestamp
        });
        break;

      case 'heartbeat':
        (() => {
          const info2 = clients.get(clientId);
          if (info2) {
            const room = require('./rooms').getRoom(patrolId);
            if (room) {
              const rinfo = room.clients.get(clientId);
              if (rinfo) rinfo.lastHeartbeat = Date.now();
            }
          }
        })();
        ws.send(JSON.stringify({ type: 'heartbeat_ack', serverTime: Date.now() }));
        break;

      case 'status_change':
        if (role === 'mobile' && msg.status === 'active') {
          try { await patrolOps.updateStatus(patrolId, 'active', Date.now()); } catch {}
        }
        if (role === 'mobile' && (msg.status === 'ended' || msg.status === 'paused')) {
          try { await patrolOps.updateStatus(patrolId, 'completed', Date.now()); } catch {}
          // 自动创建巡护日志
          if (msg.status === 'ended') {
            try {
              await logOps.create({
                patrol_id: patrolId,
                user_id: msg.userId,
                user_name: msg.userName || msg.userId,
                log_date: Date.now(),
                duration: msg.duration || 0,
                distance: msg.distance || 0,
                findings: '',
                notes: '系统自动记录 (有效点' + (msg.pointCount || 0) + '个)'
              });
              console.log('[WS] 自动创建巡护日志: ' + msg.userId + ' patrol=' + patrolId);
            } catch(e) { console.log('[WS] 日志创建失败:', e.message); }
          }
        }
        broadcastToMonitors(patrolId, {
          type: 'user_status', patrolId, userId: msg.userId,
          userName: msg.userName, status: msg.status
        });
        break;
    }
  });

  ws.on('close', () => {
    if (patrolId) {
      const removed = removeClient(patrolId, clientId);
      if (removed && removed.role === 'mobile') {
        broadcastToMonitors(patrolId, {
          type: 'user_status', patrolId, userId: removed.userId,
          userName: removed.userName, status: 'offline'
        });
      }
    }
    clients.delete(clientId);
  });
}

module.exports = { handleConnection };
