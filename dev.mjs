/* palantir local dev server — no dependencies
   loads .env.local, serves api/seer.js on port 3000
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
console.log('env loaded:', ['SEER_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OWNER_COOKIE_SECRET'].map(k => `${k}=${process.env[k] ? '✓' : '✗'}`).join(' '));

/* import handlers */
const { default: seer }     = await import('./api/seer.js');
const { default: seen }     = await import('./api/seen.js');
const { default: setOwner } = await import('./api/set-owner.js');
const { default: receipt }  = await import('./api/receipt.js');

/* _forge path — palantir.html lives here */
const forgePath = resolve(process.env.HOME, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', '_Codex', '_forge');

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
  /* serve static files — project root first, then _forge */
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const safePath = url.pathname.replace(/^\//, '') || 'index.html';
    const ext = safePath.split('.').pop();
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json' };
    const ct = types[ext] || 'text/plain';

    /* set-owner GET handler */
    if (url.pathname === '/api/set-owner') {
      const mockReq = {
        method: 'GET',
        headers: req.headers,
        query: Object.fromEntries(url.searchParams.entries()),
      };
      const res = mockRes(nodeRes);
      await setOwner(mockReq, res);
      return;
    }

    try {
      const content = readFileSync(resolve(__dir, safePath));
      nodeRes.writeHead(200, { 'Content-Type': ct });
      nodeRes.end(content);
      return;
    } catch { /* fall through */ }
    try {
      const content = readFileSync(resolve(forgePath, safePath));
      nodeRes.writeHead(200, { 'Content-Type': ct });
      nodeRes.end(content);
      return;
    } catch {
      nodeRes.writeHead(404); nodeRes.end('not found'); return;
    }
  }

  /* route POST endpoints */
  if (req.method === 'POST') {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    if (['/api/seer', '/api/receipt', '/api/seen'].includes(route)) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        req.body = body ? JSON.parse(body) : {};
        req.query = route === '/api/receipt' ? { test: '1' } : {};
        const res = mockRes(nodeRes);
        try {
          if (route === '/api/seer')    await seer(req, res);
          else if (route === '/api/seen')    await seen(req, res);
          else if (route === '/api/receipt') await receipt(req, res);
        } catch (e) { console.error(e); nodeRes.writeHead(500); nodeRes.end(); }
      });
      return;
    }
  }

  nodeRes.writeHead(405); nodeRes.end();
}).listen(3000, () => console.log('palantir dev: http://localhost:3000/palantir.html'));
