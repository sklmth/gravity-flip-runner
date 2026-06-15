// 重力反转跑酷 - 后端服务 (零依赖)
// 用 Node 内置模块: http 托管静态文件 + node:sqlite 排行榜
// 要求 Node >= 22.5 (内置 node:sqlite)。 启动: node server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ===== 数据库初始化 =====
const db = new DatabaseSync(path.join(ROOT, 'leaderboard.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
`);

const stmtInsert = db.prepare('INSERT INTO scores (name, score, coins) VALUES (?, ?, ?)');
const stmtTop = db.prepare('SELECT name, score, coins, created_at FROM scores ORDER BY score DESC, id ASC LIMIT ?');
const stmtRank = db.prepare('SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ?');
const stmtTotal = db.prepare('SELECT COUNT(*) AS total FROM scores');

// ===== 静态文件类型 =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

function serveStatic(req, res) {
  // 防目录穿越
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  // 不暴露数据库文件
  if (path.basename(filePath).startsWith('leaderboard.db')) {
    res.writeHead(404); res.end('Not found'); return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ===== 请求处理 =====
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // GET /api/leaderboard?limit=10
  if (req.method === 'GET' && urlPath === '/api/leaderboard') {
    let limit = parseInt(new URL(req.url, 'http://x').searchParams.get('limit'), 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 10;
    limit = Math.min(limit, 100);
    try {
      const rows = stmtTop.all(limit).map((r, i) => ({ rank: i + 1, ...r }));
      return sendJson(res, 200, { ok: true, list: rows });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'db_error' });
    }
  }

  // POST /api/score  { name, score, coins }
  if (req.method === 'POST' && urlPath === '/api/score') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e4) req.destroy(); // 防超大请求
    });
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch (e) { /* 容错 */ }

      // 基本清洗(不防作弊, 仅保证健壮性)
      let name = String(data.name == null ? '' : data.name).trim().slice(0, 12);
      if (!name) name = '匿名';
      const score = Math.max(0, Math.floor(Number(data.score) || 0));
      const coins = Math.max(0, Math.floor(Number(data.coins) || 0));

      try {
        stmtInsert.run(name, score, coins);
        const rank = stmtRank.get(score).rank;
        const total = stmtTotal.get().total;
        return sendJson(res, 200, { ok: true, rank, total, name, score, coins });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: 'db_error' });
      }
    });
    return;
  }

  // 其余走静态文件
  if (req.method === 'GET') return serveStatic(req, res);

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🌀 重力反转跑酷 运行中: http://localhost:${PORT}`);
});
