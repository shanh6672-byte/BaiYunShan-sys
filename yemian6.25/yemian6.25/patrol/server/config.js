module.exports = {
  port: 3000,
  dbPath: require('path').join(__dirname, 'track.db'),
  heartbeatInterval: 30000,
  gcInterval: 60000
};
