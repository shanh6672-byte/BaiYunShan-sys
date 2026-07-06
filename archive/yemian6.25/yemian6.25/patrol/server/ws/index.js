const { WebSocketServer } = require('ws');
const { handleConnection } = require('./handler');
const { startHeartbeat } = require('./heartbeat');

function initWs(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    handleConnection(ws);
  });

  startHeartbeat();

  return wss;
}

module.exports = { initWs };
