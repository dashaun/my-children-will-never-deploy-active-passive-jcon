#!/usr/bin/env node
// Serves ../docs (the reveal.js deck) and bridges one live shell, running in
// ../demo, to the terminal docked under the demo slides.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const ROOT = __dirname;
const DOCS = path.resolve(ROOT, '..', 'docs');
const DEMO = path.resolve(ROOT, '..', 'demo');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// Client libs come straight from node_modules so the deck works offline.
const VENDOR = {
  '/vendor/xterm.js': 'node_modules/@xterm/xterm/lib/xterm.js',
  '/vendor/xterm.css': 'node_modules/@xterm/xterm/css/xterm.css',
  '/vendor/addon-fit.js': 'node_modules/@xterm/addon-fit/lib/addon-fit.js',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (VENDOR[urlPath]) return sendFile(res, path.join(ROOT, VENDOR[urlPath]));
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, shell: !!shell }));
  }
  const file = path.join(DOCS, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(DOCS + path.sep)) return send404(res);
  sendFile(res, file);
});

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send404(res);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

// ---------------------------------------------------------------------------
// One persistent shell for the whole talk. Every deck window (presenter tab,
// speaker-view previews) sees the same output; a reload replays recent output.
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
let shell = null;
let history = '';

function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === 1) c.send(s);
}

function startShell() {
  if (shell) {
    try { shell.kill(); } catch (_) { /* already gone */ }
  }
  history = '';
  const bash = fs.existsSync('/opt/homebrew/bin/bash') ? '/opt/homebrew/bin/bash' : 'bash';
  shell = pty.spawn(bash, ['--noprofile', '--rcfile', path.join(ROOT, 'shell.rc'), '-i'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 18,
    cwd: DEMO,
    env: { ...process.env, HISTFILE: path.join(os.tmpdir(), 'active-passive-stage.history') },
  });
  const self = shell;
  shell.onData((data) => {
    history += data;
    if (history.length > 400000) history = history.slice(-250000);
    broadcast({ type: 'term', data });
  });
  shell.onExit(({ exitCode }) => {
    if (shell !== self) return;
    shell = null;
    broadcast({ type: 'term', data: `\r\n\x1b[1;33m[shell exited ${exitCode}, press ↻ to restart]\x1b[0m\r\n` });
  });
  broadcast({ type: 'reset' });
}

wss.on('connection', (ws) => {
  clients.add(ws);
  if (history) ws.send(JSON.stringify({ type: 'term', data: history }));
  ws.on('message', (raw) => {
    const msg = String(raw);
    if (msg === 'restart') return startShell();
    if (msg.startsWith('resize:')) {
      const [cols, rows] = msg.slice(7).split(',').map(Number);
      if (shell && cols > 0 && rows > 0) {
        try { shell.resize(cols, rows); } catch (_) { /* noop */ }
      }
      return;
    }
    if (msg.startsWith('input:') && shell) shell.write(msg.slice(6));
  });
  ws.on('close', () => clients.delete(ws));
});

startShell();
server.listen(PORT, () => {
  console.log('\n  My Children Will Never Deploy Active-Passive');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  live shell in ${DEMO}\n`);
});
