const { rooms, removeClient } = require('./rooms');
const config = require('../config');

function startHeartbeat() {
  setInterval(() => {
    const now = Date.now();
    for (const [patrolId, room] of rooms) {
      for (const [clientId, info] of room.clients) {
        if (now - info.lastHeartbeat > config.heartbeatInterval) {
          info.ws.terminate();
          const removed = removeClient(patrolId, clientId);
          if (removed && removed.role === 'mobile') {
            const { broadcastToMonitors } = require('./rooms');
            broadcastToMonitors(patrolId, {
              type: 'user_status',
              patrolId,
              userId: removed.userId,
              userName: removed.userName,
              status: 'offline'
            });
          }
        }
      }
    }
  }, 20000);
}

module.exports = { startHeartbeat };
