// 房间管理：patrolId -> { clients: Map<clientId, {ws, role, userId, userName, lastHeartbeat}>, monitors: Set<clientId> }

const rooms = new Map();

function addClient(patrolId, clientId, clientInfo) {
  if (!rooms.has(patrolId)) {
    rooms.set(patrolId, { clients: new Map(), monitors: new Set() });
  }
  const room = rooms.get(patrolId);
  room.clients.set(clientId, clientInfo);
  if (clientInfo.role === 'monitor') {
    room.monitors.add(clientId);
  }
}

function removeClient(patrolId, clientId) {
  const room = rooms.get(patrolId);
  if (!room) return null;
  const client = room.clients.get(clientId);
  room.clients.delete(clientId);
  room.monitors.delete(clientId);
  if (room.clients.size === 0) {
    rooms.delete(patrolId);
  }
  return client;
}

function getRoom(patrolId) {
  return rooms.get(patrolId);
}

function forEachMobileInRoom(patrolId, fn) {
  const room = rooms.get(patrolId);
  if (!room) return;
  for (const [cid, info] of room.clients) {
    if (info.role === 'mobile') fn(cid, info);
  }
}

function broadcastToMonitors(patrolId, message) {
  const room = rooms.get(patrolId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const cid of room.monitors) {
    const client = room.clients.get(cid);
    if (client && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

function getAllMonitorsByPatrol(patrolId) {
  const room = rooms.get(patrolId);
  if (!room) return [];
  const result = [];
  for (const cid of room.monitors) {
    const client = room.clients.get(cid);
    if (client && client.ws.readyState === 1) result.push(cid);
  }
  return result;
}

function getMobileUsers(patrolId) {
  const room = rooms.get(patrolId);
  if (!room) return [];
  const result = [];
  for (const [cid, info] of room.clients) {
    if (info.role === 'mobile') {
      result.push({ userId: info.userId, userName: info.userName });
    }
  }
  return result;
}

module.exports = { rooms, addClient, removeClient, getRoom, forEachMobileInRoom, broadcastToMonitors, getAllMonitorsByPatrol, getMobileUsers };
