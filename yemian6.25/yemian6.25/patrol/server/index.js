const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const { getDb } = require('./db/init');
const { WebSocketServer } = require('ws');
const { handleConnection } = require('./ws/handler');
const { startHeartbeat } = require('./ws/heartbeat');

async function main() {
  await getDb();
  console.log('数据库已初始化');

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // CORS（允许主页面跨域调用）
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // REST API
  app.use('/api/patrols', require('./api/patrols'));
  app.use('/api/users', require('./api/users'));
  app.use('/api/trajectory', require('./api/trajectory'));
  app.use('/api/logs', require('./api/logs'));
  app.use('/api/routes', require('./api/routes'));

  // 静态文件
  app.use('/mobile', express.static(path.join(__dirname, '..', 'mobile')));
  app.use('/web', express.static(path.join(__dirname, '..', '..', '..', 'Track', 'web')));

  // yszx 管理后台 + patrol 模块
  app.use('/yszx', express.static(path.join(__dirname, '..', '..')));
  app.use('/patrol', express.static(path.join(__dirname, '..', '..', 'patrol')));

  // 首页
  app.get('/', (req, res) => {
    const host = req.get('host');
    res.send(`<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><title>云山智巡 - 森林巡护管理系统</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:'Microsoft YaHei',sans-serif;text-align:center;margin-top:80px;background:#0a1628;color:#e0e8f0}
a{display:inline-block;margin:14px;padding:16px 32px;background:rgba(15,31,58,0.9);color:#00aaff;text-decoration:none;border-radius:8px;font-size:16px;border:1px solid #1e3a5f;transition:all 0.3s}
a:hover{background:#1a3358;box-shadow:0 0 20px rgba(0,170,255,0.2)}
.warn{margin-top:24px;padding:14px;background:rgba(255,152,0,0.1);color:#ff9800;border-radius:8px;font-size:13px;max-width:520px;margin-left:auto;margin-right:auto;border:1px solid rgba(255,152,0,0.2)}
h1{color:#00aaff;font-weight:700;letter-spacing:3px}
p{color:#8899aa}
</style></head>
<body>
<h1>云山智巡</h1>
<p>森林巡护态势感知系统</p>
<a href="/yszx">🖥️ 管理后台 (云山智巡)</a>
<a href="/mobile">📱 移动巡护端 (护林员)</a>
<div class="warn">
  ⚠️ <b>手机使用须知:</b> 获取GPS需要HTTPS<br>
  手机浏览器请访问 <b>http://&lt;电脑IP&gt;:${config.port}/mobile</b><br>
  首次访问会提示不安全，点击<b>继续前往</b>或<b>接受风险</b>即可
</div>
</body></html>`);
  });

  // 获取局域网IP
  const os = require('os');
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }

  // ========== HTTP 模式 (3000) ==========
  const server = http.createServer(app);

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => handleConnection(ws));
  startHeartbeat();

  server.listen(config.port, '0.0.0.0', () => {
    console.log('==================================');
    console.log('  云山智巡 - 森林巡护管理系统');
    console.log('==================================');
    console.log('  管理后台: http://localhost:' + config.port + '/yszx');
    ips.forEach(ip => console.log('  局域网: http://' + ip + ':' + config.port + '/yszx'));
  });
}

main().catch(err => { console.error('启动失败:', err); process.exit(1); });
