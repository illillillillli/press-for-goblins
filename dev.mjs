/* press for goblins local dev server - no dependencies
   loads .env.local and serves the site plus API handlers on port 3000
   run: node dev.mjs */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* load .env.local */
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '.env.local');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}
console.log('env loaded:', ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ANALYTICS_INGEST_CAPABILITY'].map(k => `${k}=${process.env[k] ? '✓' : '✗'}`).join(' '));

/* import handlers */
const { default: seen }     = await import('./api/seen.js');
const { default: dashboardConfig } = await import('./api/dashboard-config.js');
const { default: dashboardData } = await import('./api/dashboard-data.js');
const { default: dashboardOwner } = await import('./api/dashboard-owner.js');
const { default: goblinStats } = await import('./api/goblin-stats.js');
const { default: receipt }  = await import('./api/receipt.js');

/* mock vercel req/res */
function mockRes(nodeRes) {
  let statusCode = 200;
  const headers = {};
  const res = {
    status(code) { statusCode = code; return res; },
    json(obj) {
      nodeRes.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
      nodeRes.end(JSON.stringify(obj));
    },
    end(body) {
      nodeRes.writeHead(statusCode, headers);
      nodeRes.end(body || '');
    },
    send(body) { res.end(body); },
    setHeader(k, v) { headers[k] = v; nodeRes.setHeader(k, v); },
    writeHead(code, h) { statusCode = code; Object.assign(headers, h || {}); },
  };
  return res;
}

createServer(async (req, nodeRes) => {
  /* serve static files from the project root */
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const safePath = url.pathname === '/dashboard' ? 'dashboard.html' : (url.pathname.replace(/^\//, '') || 'index.html');
    if (url.pathname === '/api/dashboard-config') return dashboardConfig(req, mockRes(nodeRes));
    if (url.pathname === '/api/dashboard-data') return dashboardData(req, mockRes(nodeRes));
    if (url.pathname === '/api/goblin-stats') {
      req.query = Object.fromEntries(url.searchParams);
      return goblinStats(req, mockRes(nodeRes));
    }
    const ext = safePath.split('.').pop();
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json' };
    const ct = types[ext] || 'text/plain';

    try {
      const content = readFileSync(resolve(__dir, safePath));
      nodeRes.writeHead(200, { 'Content-Type': ct });
      nodeRes.end(content);
      return;
    } catch { /* fall through */ }
    nodeRes.writeHead(404); nodeRes.end('not found'); return;
  }

  /* route POST endpoints */
  if (req.method === 'POST') {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    if (['/api/receipt', '/api/seen', '/api/dashboard-owner'].includes(route)) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        req.body = body ? JSON.parse(body) : {};
        req.query = route === '/api/receipt' ? { test: '1' } : {};
        const res = mockRes(nodeRes);
        try {
          if (route === '/api/seen') await seen(req, res);
          else if (route === '/api/dashboard-owner') await dashboardOwner(req, res);
          else if (route === '/api/receipt') await receipt(req, res);
        } catch (e) { console.error(e); nodeRes.writeHead(500); nodeRes.end(); }
      });
      return;
    }
  }

  nodeRes.writeHead(405); nodeRes.end();
}).listen(3000, () => console.log('press for goblins: http://localhost:3000 · dashboard: http://localhost:3000/dashboard'));
