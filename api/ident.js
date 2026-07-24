/* ═══════════════════════════════════════════════════════
   press for goblins — /api/ident → served at /ident
   password-protected dashboard. on successful auth, sets
   palantir_mine + palantir_device cookies so the device
   is recognised as an owner in /api/seen.
   env vars: SEER_PASSWORD, OWNER_COOKIE_SECRET,
             UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';

/* ── rate limiter: 5 attempts per IP per 15 minutes ── */
async function checkRateLimit(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; /* no redis — allow (local dev) */
  const key     = `ident:rl:${ip}`;
  const lockKey = `ident:lock:${ip}`;
  try {
    const lockRes  = await fetch(`${url}/get/${lockKey}`, { headers: { Authorization: `Bearer ${token}` } });
    const lockData = await lockRes.json();
    if (lockData?.result) return false;

    const r    = await fetch(`${url}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([['INCR', key], ['EXPIRE', key, 900, 'NX']]),
    });
    const data  = await r.json();
    const count = data?.[0]?.result ?? 0;
    if (count > 5) {
      await fetch(`${url}/set/${lockKey}/1/ex/900`, { headers: { Authorization: `Bearer ${token}` } });
      return false;
    }
    return true;
  } catch {
    return true; /* fail open — don't lock yourself out */
  }
}

async function clearRateLimit(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/del/ident:rl:${ip}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, pair) => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) acc[name.trim()] = rest.join('=');
    return acc;
  }, {});
}

function isValidUUID(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function safeEqual(a, b) {
  try {
    const h = (s) => createHash('sha256').update(s).digest();
    return timingSafeEqual(h(String(a)), h(String(b)));
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/* ── login page HTML ── */
const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ident</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;color:rgba(255,255,255,.88);font-family:'Courier New',monospace;font-size:18px;min-height:100vh;display:flex;align-items:center;justify-content:center}
  form{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:320px;padding:40px}
  input{background:rgba(255,255,255,.14);border:none;color:rgba(255,255,255,.88);font-family:'Courier New',monospace;font-size:18px;padding:10px 14px;outline:none;width:100%;text-align:center;-webkit-text-security:disc;letter-spacing:.1em;caret-color:#89ce8d;transition:background .2s}
  input::placeholder{-webkit-text-security:none;letter-spacing:normal;color:rgba(255,255,255,.25)}
  input:focus{background:rgba(255,255,255,.2)}
  .err{color:#89ce8d;font-size:14px;min-height:1.4em;font-family:'Courier New',monospace}
</style>
</head>
<body>
<form method="POST" action="/ident">
  <input type="text" name="password" placeholder="········" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" autofocus>
  <div class="err">__ERR__</div>
</form>
</body>
</html>`;

/* ── palantir dashboard HTML — embedded at deploy time ── */
const DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>definitely three goblins looking at the data</title>
<style>
  /* [fonts] PressStart2P via CDN; Courier New is everywhere else */
  @font-face {
    font-family: 'Press Start 2P';
    src: url('https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK0nSgPJE4580.woff2') format('woff2');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  /* [colours] exact tokens from main site */
  :root {
    --green:          #89ce8d;
    --text-primary:   rgba(255, 255, 255, 0.88);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --text-muted:     rgba(255, 255, 255, 0.35);
    --text-ghost:     rgba(255, 255, 255, 0.14);
    --bg-void:        #000;
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
    --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;
    --sp-12: 48px; --sp-16: 64px; --sp-20: 80px;

    --font:    'Courier New', Courier, monospace;
    --font-px: 'Press Start 2P', 'Courier New', monospace;
    --bar-width: 20;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg-void);
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 15px;
    line-height: 1.4;
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  ::selection { background: #444; color: #fff; }

  /* ── crt sweep — copied verbatim from main site ── */
  .crt {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 203;
    mix-blend-mode: screen;
    background: radial-gradient(ellipse 60% 18vh at 50% 0%, rgba(255, 255, 255, 0.04), transparent 100%);
    background-repeat: no-repeat;
    animation: crtSweep 25s linear infinite;
  }
  @keyframes crtSweep {
    0%   { background-position: 50% -25vh; }
    100% { background-position: 50% 125vh; }
  }

  /* ── eyes — animated, exact copy from main site ── */
  .eyes {
    position: fixed;
    top: 32px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 16px;
    z-index: 202;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    pointer-events: none;
    align-items: center;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }

  @media (min-width: 601px) {
    .eyes { top: 48px; }
  }

  .eyes svg {
    display: block;
    width: 102px;
    height: auto;
  }

  @media (min-width: 601px) {
    .eyes svg { width: 119px; }
  }

  .eye-pair.p1 { opacity: 1; }
  .eye-pair.p2 { opacity: 0.44; }
  .eye-pair.p3 { opacity: 0.13; }

  /* eyes start closed — clip-path squishes them to an invisible line */
  .eye-pair {
    clip-path: inset(50% 0 50% 0);
    -webkit-clip-path: inset(50% 0 50% 0);
    transform-origin: center;
  }

  /* once open, clip-path is removed so the full eye shows */
  .eye-pair.open-locked {
    clip-path: inset(0 0 0 0);
    -webkit-clip-path: inset(0 0 0 0);
  }

  /* p1 and p2 open simply */
  .eye-pair.p1.open {
    -webkit-animation: pairOpen .8s cubic-bezier(.22, .8, .3, 1) forwards;
    animation: pairOpen .8s cubic-bezier(.22, .8, .3, 1) forwards;
  }
  .eye-pair.p2.open {
    -webkit-animation: pairOpen .8s cubic-bezier(.22, .8, .3, 1) forwards;
    animation: pairOpen .8s cubic-bezier(.22, .8, .3, 1) forwards;
  }

  @-webkit-keyframes pairOpen {
    0%   { -webkit-clip-path: inset(50% 0 50% 0); clip-path: inset(50% 0 50% 0); }
    100% { -webkit-clip-path: inset(0 0 0 0);     clip-path: inset(0 0 0 0); }
  }
  @keyframes pairOpen {
    0%   { -webkit-clip-path: inset(50% 0 50% 0); clip-path: inset(50% 0 50% 0); }
    100% { -webkit-clip-path: inset(0 0 0 0);     clip-path: inset(0 0 0 0); }
  }

  /* p3 droop — opens cleanly, lazily droops, then eases back open */
  .eye-pair.p3.open {
    -webkit-animation: openBot 2.04s linear forwards;
    animation: openBot 2.04s linear forwards;
  }
  @-webkit-keyframes openBot {
    0%   { -webkit-clip-path: inset(50% 0 50% 0); clip-path: inset(50% 0 50% 0); animation-timing-function: ease-out; }
    40%  { -webkit-clip-path: inset(5% 0 5% 0);   clip-path: inset(5% 0 5% 0);   animation-timing-function: ease-out; }
    60%  { -webkit-clip-path: inset(27% 0 27% 0);  clip-path: inset(27% 0 27% 0);  animation-timing-function: ease-out; }
    100% { -webkit-clip-path: inset(0 0 0 0);     clip-path: inset(0 0 0 0); }
  }
  @keyframes openBot {
    0%   { -webkit-clip-path: inset(50% 0 50% 0); clip-path: inset(50% 0 50% 0); animation-timing-function: ease-out; }
    40%  { -webkit-clip-path: inset(5% 0 5% 0);   clip-path: inset(5% 0 5% 0);   animation-timing-function: ease-out; }
    60%  { -webkit-clip-path: inset(27% 0 27% 0);  clip-path: inset(27% 0 27% 0);  animation-timing-function: ease-out; }
    100% { -webkit-clip-path: inset(0 0 0 0);     clip-path: inset(0 0 0 0); }
  }

  /* blink */
  .eye-pair.blink {
    -webkit-animation: blink .22s ease-in-out !important;
    animation: blink .22s ease-in-out !important;
  }
  @-webkit-keyframes blink {
    0%   { -webkit-clip-path: inset(0 0 0 0);    clip-path: inset(0 0 0 0); }
    50%  { -webkit-clip-path: inset(48% 0 48% 0); clip-path: inset(48% 0 48% 0); }
    100% { -webkit-clip-path: inset(0 0 0 0);    clip-path: inset(0 0 0 0); }
  }
  @keyframes blink {
    0%   { -webkit-clip-path: inset(0 0 0 0);    clip-path: inset(0 0 0 0); }
    50%  { -webkit-clip-path: inset(48% 0 48% 0); clip-path: inset(48% 0 48% 0); }
    100% { -webkit-clip-path: inset(0 0 0 0);    clip-path: inset(0 0 0 0); }
  }

  /* black blocker strip behind eyes — exact from main site */
  .eyes-blocker {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 144px;
    background: #000;
    z-index: 200;
    pointer-events: none;
  }

  @media (min-width: 601px) {
    .eyes-blocker { height: 168px; }
  }

  /* gradient fade below eyes — exact from main site */
  .eyes-shadow {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 160px;
    background: linear-gradient(to bottom, #000 0%, #000 50%, rgba(0,0,0,0.4) 72%, transparent 100%);
    z-index: 201;
    pointer-events: none;
  }

  @media (min-width: 601px) {
    .eyes-shadow { height: 184px; }
  }

  /* ── auth screen ── */
  #auth {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 420px;
    margin: 0 auto;
    padding: 176px 40px 80px;
    text-align: center;
  }

  #auth-label {
    font-family: var(--font-px);
    font-size: 11px;
    color: var(--green);
    letter-spacing: 0.20em;
    line-height: 1.8;
  }

  #auth input#pw-input {
    background: rgba(255, 255, 255, 0.14);
    border: none;
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 18px;
    padding: 10px 14px;
    outline: none;
    width: 100%;
    caret-color: var(--green);
    text-align: center;
    -webkit-text-security: disc;
    letter-spacing: 0.1em;
    transition: background 0.2s ease;
  }

  #auth input#pw-input:focus {
    background: rgba(255, 255, 255, 0.20);
  }

  #auth input#pw-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
    -webkit-text-security: none;
    letter-spacing: normal;
  }

  #auth-error {
    color: var(--text-muted);
    font-size: 13px;
    min-height: 16px;
    letter-spacing: 0.06em;
  }

  /* ── dashboard ── */
  #dash {
    display: none;
    padding: 176px 40px 100px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: 601px) {
    #dash { padding-top: 192px; }
  }

  /* ── dashed rule — same as main site ── */
  .dash-rule {
    border: none;
    border-top: 1px dashed rgba(255, 255, 255, 0.15);
    margin: 40px 0;
  }

  /* ── section label ── */
  .section-label {
    font-family: var(--font-px);
    font-size: 11px;
    color: var(--green);
    letter-spacing: 0.20em;
    text-transform: lowercase;
    margin-bottom: 20px;
    user-select: none;
    line-height: 1.8;
  }

  /* ── summary / hero stat ── */
  #summary-row {
    display: grid;
    grid-template-columns: auto 1fr 1fr 1fr 1fr 1fr;
    gap: 0 24px;
    align-items: end;
    margin-bottom: 0;
  }

  @media (max-width: 900px) {
    #summary-row {
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
    }
  }

  @media (max-width: 600px) {
    #summary-row {
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  }

  .stat-block { }

  .stat-value {
    font-family: var(--font);
    font-size: 26px;
    letter-spacing: -0.02em;
    line-height: 1;
    color: #fff;
  }

  .stat-value.hero {
    font-family: var(--font-px);
    font-size: 48px;
    letter-spacing: -0.02em;
    line-height: 1;
    color: var(--green);
  }

  @media (max-width: 600px) {
    .stat-value.hero { font-size: 36px; }
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: 13px;
    margin-top: 8px;
    letter-spacing: 0.04em;
    font-family: var(--font);
  }

  /* ── mid grid: 3 columns ── */
  #mid-grid {
    display: grid;
    grid-template-columns: 35% 28% 37%;
    gap: 0 16px;
    margin-bottom: 0;
  }

  @media (max-width: 800px) {
    #mid-grid {
      grid-template-columns: 1fr;
      gap: 36px 0;
    }
  }

  /* ── funnel bars for drop-off ── */
  .funnel-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .funnel-step {
    font-family: var(--font-px);
    font-size: 11px;
    color: var(--green);
    min-width: 28px;
    flex-shrink: 0;
    letter-spacing: 0.04em;
  }

  .funnel-track {
    font-size: 13px;
    letter-spacing: 0.02em;
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
  }

  .funnel-filled { color: var(--green); }
  .funnel-empty  { color: rgba(255, 255, 255, 0.08); }

  .funnel-count {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── generic bar rows (sources, devices) ── */
  .bar-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
    overflow: hidden;
  }

  .bar-key {
    color: #fff;
    width: 80px;
    min-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
    flex-shrink: 0;
  }

  .bar-key.wide {
    width: 140px;
    min-width: 140px;
  }

  .bar-track {
    color: var(--green);
    font-size: 13px;
    letter-spacing: 0.02em;
    flex-shrink: 1;
    overflow: hidden;
  }

  .bar-count {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    min-width: 24px;
    text-align: right;
  }

  /* ── log section ── */
  #log-section {
    margin-bottom: 60px;
  }

  #log-wrap {
    overflow-x: hidden;
    width: 100%;
  }

  #log-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  #log-table col.col-time   { width: 13%; }
  #log-table col.col-step   { width: 11%; }
  #log-table col.col-src    { width: 26%; }
  #log-table col.col-dev    { width: 9%;  }
  #log-table col.col-dur    { width: 9%;  }
  #log-table col.col-iact   { width: 32%; }

  #log-table th {
    color: var(--green);
    font-family: var(--font-px);
    font-size: 11px;
    font-weight: normal;
    letter-spacing: 0.20em;
    text-align: left;
    padding: 0 12px 16px 0;
    user-select: none;
    line-height: 1.8;
  }

  #log-table td {
    color: #fff;
    font-family: var(--font);
    font-size: 14px;
    padding: 8px 12px 8px 0;
    line-height: 1.4;
    vertical-align: top;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  #log-table tr.abandoned td { color: rgba(255, 255, 255, 0.4); }
  #log-table tr.abandoned td.col-step { color: rgba(255, 255, 255, 0.55); }

  #log-table td.col-time  { color: rgba(255, 255, 255, 0.45); }
  #log-table td.col-step  { color: #fff; font-size: 14px; }
  #log-table td.col-src   { color: #fff; }
  #log-table td.col-dev   { color: rgba(255, 255, 255, 0.7); }
  #log-table td.col-dur   { color: rgba(255, 255, 255, 0.7); }
  #log-table td.col-iact  { color: rgba(255, 255, 255, 0.45); }

  /* selections — always visible sub-row */
  .sel-row td {
    padding: 0 12px 12px 0;
    white-space: normal;
    overflow: visible;
  }
  .sel-row { display: table-row; }

  .sel-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
    padding: 4px 0 2px;
    border-left: 1px solid rgba(137, 206, 141, 0.2);
    padding-left: 12px;
    margin-top: 2px;
  }

  .sel-kv { display: flex; gap: 6px; align-items: baseline; font-size: 12px; }
  .sel-k  { color: rgba(255, 255, 255, 0.22); letter-spacing: 0.04em; }
  .sel-v  { color: var(--text-secondary); }

  /* ── dash header ── */
  #dash-header {
    display: flex;
    align-items: baseline;
    gap: 24px;
    margin-bottom: 36px;
  }

  #dash-title {
    font-family: var(--font-px);
    font-size: 16px;
    color: var(--green);
    letter-spacing: 0.12em;
  }

  #dash-sub {
    color: var(--text-secondary);
    font-size: 16px;
    letter-spacing: 0.04em;
  }

  /* ── devices panel ── */
  #devices-section {
    margin-bottom: 60px;
  }

  .device-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .device-row:last-child {
    border-bottom: none;
  }

  .device-name {
    flex: 1;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    min-width: 0;
  }

  .device-name:hover {
    color: var(--green);
  }

  .device-name-input {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--green);
    color: var(--green);
    font-family: var(--font);
    font-size: 14px;
    outline: none;
    padding: 0;
    min-width: 0;
  }

  .device-meta {
    color: var(--text-muted);
    font-size: 13px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .device-country {
    color: var(--text-secondary);
    font-size: 13px;
    min-width: 32px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── refresh indicator ── */
  #refresh-state {
    position: fixed;
    bottom: 28px;
    right: 40px;
    color: rgba(255, 255, 255, 0.12);
    font-size: 13px;
    letter-spacing: 0.08em;
    font-family: var(--font);
  }
</style>
</head>
<body>

<!-- crt sweep — exact from main site -->
<div class="crt"></div>

<!-- hidden svg defs — must appear before eye markup for safari -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0"
  style="position:absolute" aria-hidden="true">
  <defs>
    <g id="_p1-paths">
      <path
        d="M3 0h1v1h-1z M18 0h1v1h-1z M3 1h1v1h-1z M18 1h1v1h-1z M0 3h1v1h-1z M22 3h2v1h-2z M16 4h1v1h-1z M16 5h1v1h-1z M24 5h2v1h-2z M16 6h1v1h-1z M16 7h1v1h-1z M26 7h2v1h-2z M16 8h1v1h-1z M27 8h1v1h-1z M0 9h1v1h-1z M16 9h1v1h-1z M16 10h1v1h-1z M3 11h1v1h-1z M16 11h1v1h-1z M27 11h1v1h-1z M3 12h1v1h-1z M16 12h1v1h-1z M27 12h1v1h-1z M5 13h1v1h-1z M5 14h1v1h-1z M20 15h1v1h-1z"
        fill="#2d4a2e" />
      <path
        d="M4 0h14v1h-14z M4 1h14v1h-14z M2 2h3v1h-3z M19 2h3v1h-3z M2 3h3v1h-3z M19 3h3v1h-3z M0 4h4v1h-4z M22 4h2v1h-2z M0 5h2v1h-2z M0 6h2v1h-2z M24 6h2v1h-2z M0 7h2v1h-2z M0 8h2v1h-2z M26 8h1v1h-1z M2 9h2v1h-2z M26 9h2v1h-2z M2 10h2v1h-2z M26 10h2v1h-2z M4 11h1v1h-1z M24 11h3v1h-3z M4 12h1v1h-1z M24 12h3v1h-3z M6 13h3v1h-3z M20 13h4v1h-4z M6 14h3v1h-3z M21 14h3v1h-3z M9 15h11v1h-11z"
        fill="#4d784e" />
      <path
        d="M5 2h14v1h-14z M5 3h3v1h-3z M14 3h5v1h-5z M4 4h3v1h-3z M19 4h3v1h-3z M2 5h4v1h-4z M13 5h2v1h-2z M20 5h4v1h-4z M2 6h3v1h-3z M21 6h3v1h-3z M2 7h3v1h-3z M24 7h2v1h-2z M2 8h3v1h-3z M24 8h2v1h-2z M4 9h3v1h-3z M23 9h3v1h-3z M4 10h3v1h-3z M22 10h4v1h-4z M5 11h4v1h-4z M21 11h3v1h-3z M5 12h4v1h-4z M20 12h4v1h-4z M9 13h11v1h-11z M9 14h12v1h-12z"
        fill="#6ba36d" />
      <path
        d="M8 3h6v1h-6z M7 4h8v1h-8z M17 4h2v1h-2z M6 5h7v1h-7z M17 5h3v1h-3z M5 6h8v1h-8z M17 6h4v1h-4z M5 7h8v1h-8z M17 7h7v1h-7z M5 8h8v1h-8z M17 8h7v1h-7z M7 9h6v1h-6z M17 9h6v1h-6z M7 10h6v1h-6z M17 10h5v1h-5z M9 11h6v1h-6z M17 11h4v1h-4z M9 12h6v1h-6z M17 12h3v1h-3z"
        fill="#89ce8d" />
      <g transform="translate(37,0)">
        <path
          d="M10 0h1v1h-1z M10 1h1v1h-1z M6 2h1v1h-1z M5 3h2v1h-2z M3 5h2v1h-2z M1 7h2v1h-2z M1 8h1v1h-1z M27 9h1v1h-1z M1 11h1v1h-1z M1 12h1v1h-1z M23 13h1v1h-1z M23 14h1v1h-1z M8 15h1v1h-1z"
          fill="#2d4a2e" />
        <path
          d="M11 0h14v1h-14z M11 1h14v1h-14z M7 2h3v1h-3z M23 2h4v1h-4z M7 3h3v1h-3z M23 3h4v1h-4z M5 4h2v1h-2z M25 4h3v1h-3z M27 5h1v1h-1z M3 6h2v1h-2z M27 6h1v1h-1z M27 7h1v1h-1z M2 8h1v1h-1z M27 8h1v1h-1z M0 9h3v1h-3z M25 9h2v1h-2z M0 10h3v1h-3z M25 10h2v1h-2z M2 11h3v1h-3z M23 11h2v1h-2z M2 12h3v1h-3z M23 12h2v1h-2z M5 13h3v1h-3z M20 13h3v1h-3z M5 14h4v1h-4z M20 14h3v1h-3z M9 15h11v1h-11z"
          fill="#4d784e" />
        <path
          d="M10 2h13v1h-13z M10 3h5v1h-5z M16 3h3v1h-3z M20 3h3v1h-3z M7 4h3v1h-3z M22 4h3v1h-3z M5 5h4v1h-4z M14 5h2v1h-2z M23 5h4v1h-4z M5 6h3v1h-3z M24 6h3v1h-3z M3 7h2v1h-2z M24 7h3v1h-3z M3 8h2v1h-2z M24 8h3v1h-3z M3 9h2v1h-2z M22 9h3v1h-3z M3 10h4v1h-4z M22 10h3v1h-3z M5 11h3v1h-3z M20 11h3v1h-3z M5 12h4v1h-4z M20 12h3v1h-3z M8 13h12v1h-12z M9 14h11v1h-11z"
          fill="#6ba36d" />
        <path
          d="M15 3h1v1h-1z M19 3h1v1h-1z M10 4h2v1h-2z M14 4h8v1h-8z M9 5h3v1h-3z M16 5h7v1h-7z M8 6h4v1h-4z M16 6h8v1h-8z M5 7h7v1h-7z M16 7h8v1h-8z M5 8h7v1h-7z M16 8h8v1h-8z M5 9h7v1h-7z M16 9h6v1h-6z M7 10h5v1h-5z M16 10h6v1h-6z M8 11h4v1h-4z M14 11h6v1h-6z M9 12h3v1h-3z M14 12h6v1h-6z"
          fill="#89ce8d" />
      </g>
    </g>
  </defs>
</svg>

<!-- eyes — animated, exact from main site -->
<div class="eyes" id="eyes" aria-hidden="true">
  <svg class="eye-pair p1" viewBox="0 0 65 16" shape-rendering="crispEdges">
    <use href="#_p1-paths" xlink:href="#_p1-paths" />
  </svg>
  <svg class="eye-pair p2" viewBox="0 0 65 16" shape-rendering="crispEdges">
    <use href="#_p1-paths" xlink:href="#_p1-paths" />
  </svg>
  <svg class="eye-pair p3" viewBox="0 0 65 16" shape-rendering="crispEdges">
    <use href="#_p1-paths" xlink:href="#_p1-paths" />
  </svg>
</div>
<div class="eyes-blocker" aria-hidden="true"></div>
<div class="eyes-shadow" aria-hidden="true"></div>

<!-- auth -->
<div id="auth">
  <div id="auth-label"></div>
  <input type="text" id="pw-input" placeholder="········" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
  <div id="auth-error"></div>
</div>

<!-- dashboard -->
<div id="dash">

  <!-- header -->
  <div id="dash-header">
    <span id="dash-title">palantir</span>
    <span id="dash-sub"></span>
  </div>

  <hr class="dash-rule">

  <!-- summary row -->
  <div id="summary-row">
    <div class="stat-block">
      <div class="stat-value hero" id="s-rate">—</div>
      <div class="stat-label">subjects who completed the ritual</div>
    </div>
    <div class="stat-block">
      <div class="stat-value" id="s-total">—</div>
      <div class="stat-label">total sessions</div>
    </div>
    <div class="stat-block">
      <div class="stat-value" id="s-completed">—</div>
      <div class="stat-label">completed</div>
    </div>
    <div class="stat-block">
      <div class="stat-value" id="s-abandoned">—</div>
      <div class="stat-label">abandoned</div>
    </div>
    <div class="stat-block">
      <div class="stat-value" id="s-dur-c">—</div>
      <div class="stat-label">avg · completed</div>
    </div>
    <div class="stat-block">
      <div class="stat-value" id="s-dur-a">—</div>
      <div class="stat-label">avg · abandoned</div>
    </div>
  </div>

  <hr class="dash-rule">

  <!-- mid grid -->
  <div id="mid-grid">

    <!-- col 1: drop-off funnel -->
    <div class="section">
      <div class="section-label">attrition by stage</div>
      <div id="steps-funnel"></div>
    </div>

    <!-- col 2: origin signals + interface type -->
    <div class="section">
      <div class="section-label">origin signals</div>
      <div id="sources-bars"></div>
      <div class="section-label" style="margin-top:32px">interface type</div>
      <div id="devices-bars"></div>
    </div>

    <!-- col 3: time on site + countries -->
    <div class="section">
      <div class="section-label">time on site</div>
      <div id="dur-bars"></div>
      <div class="section-label" style="margin-top:32px">countries</div>
      <div id="countries-bars"></div>
    </div>

  </div>

  <hr class="dash-rule">

  <!-- my devices -->
  <div id="devices-section">
    <div class="section-label">my devices</div>
    <div id="devices-list"></div>
  </div>

  <hr class="dash-rule">

  <!-- field log -->
  <div id="log-section">
    <div class="section-label">field log · recent transmissions</div>
    <div id="log-wrap">
      <table id="log-table">
        <colgroup>
          <col class="col-time">
          <col class="col-step">
          <col class="col-src">
          <col class="col-dev">
          <col class="col-dur">
          <col class="col-iact">
        </colgroup>
        <thead>
          <tr>
            <th>time</th>
            <th>step</th>
            <th>src</th>
            <th>dev</th>
            <th>dur</th>
            <th>via · selections</th>
          </tr>
        </thead>
        <tbody id="log-body"></tbody>
      </table>
    </div>
  </div>

</div>

<!-- fixed timestamp -->
<div id="refresh-state"></div>

<script>
  /* ── eye open sequence + idle blink — exact from main site ── */
  (function () {
    const eyes = Array.from(document.querySelectorAll('.eye-pair'));
    setTimeout(() => eyes[0].classList.add('open'), 300);
    setTimeout(() => eyes[1].classList.add('open'), 1100);
    setTimeout(() => eyes[2].classList.add('open'), 2100);
    setTimeout(() => eyes.forEach(e => { e.classList.remove('open'); e.classList.add('open-locked'); }), 5100);
    function startIdleBlinks() {
      eyes.forEach(eye => {
        function scheduleNextBlink() {
          const delay = 15000 + Math.random() * 5000;
          setTimeout(() => {
            if (!eye.classList.contains('open-locked')) { scheduleNextBlink(); return; }
            eye.classList.add('blink');
            setTimeout(() => { eye.classList.remove('blink'); scheduleNextBlink(); }, 250);
          }, delay);
        }
        scheduleNextBlink();
      });
    }
    setTimeout(startIdleBlinks, 6000);
  })();

  const ENDPOINT       = '/api/seer';
  const BAR_WIDTH      = 20;
  const REFRESH_INTERVAL = 60_000;
  const TOTAL_STEPS    = 12;

  let refreshTimer = null;
  let lastPassword = '';

  /* ── utils ── */

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mn = String(d.getMinutes()).padStart(2, '0');
    return mm + '-' + dd + ' ' + hh + ':' + mn;
  }

  function fmtDur(secs) {
    if (!secs || secs === 0) return '—';
    if (secs < 60) return secs + 's';
    return Math.floor(secs / 60) + 'm' + String(secs % 60).padStart(2, '0') + 's';
  }

  function durBucket(secs) {
    if (!secs || secs < 5)  return 'bounce <5s';
    if (secs < 30)          return 'glance 5-30s';
    if (secs < 120)         return 'read 30s-2m';
    if (secs < 300)         return 'engaged 2-5m';
    return                         'invested 5m+';
  }

  function asciiBar(count, max) {
    const filled = max > 0 ? Math.round((count / max) * BAR_WIDTH) : 0;
    return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
  }

  function truncate(str, len) {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len - 1) + '…' : str;
  }

  /* ── funnel renderer ── */

  function renderFunnel(containerId, stepCounts) {
    const container = document.getElementById(containerId);
    container.textContent = '';
    const entries = Object.entries(stepCounts)
      .map(([k, v]) => [parseInt(k, 10), v])
      .sort((a, b) => a[0] - b[0]);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.style.color = 'rgba(255,255,255,0.12)';
      empty.textContent = '—';
      container.appendChild(empty);
      return;
    }
    const maxCount = entries[0][1] || 1;
    for (const [step, count] of entries) {
      const proportion = count / maxCount;
      const filledCount = Math.round(proportion * BAR_WIDTH);
      const emptyCount  = BAR_WIDTH - filledCount;
      const row = document.createElement('div');
      row.className = 'funnel-row';
      const stepEl = document.createElement('span');
      stepEl.className = 'funnel-step';
      stepEl.textContent = String(step).padStart(2, '0');
      const track = document.createElement('span');
      track.className = 'funnel-track';
      const filled = document.createElement('span');
      filled.className = 'funnel-filled';
      filled.textContent = '█'.repeat(filledCount);
      const empty = document.createElement('span');
      empty.className = 'funnel-empty';
      empty.textContent = '░'.repeat(emptyCount);
      track.appendChild(filled);
      track.appendChild(empty);
      const countEl = document.createElement('span');
      countEl.className = 'funnel-count';
      countEl.textContent = count;
      row.appendChild(stepEl);
      row.appendChild(track);
      row.appendChild(countEl);
      container.appendChild(row);
    }
  }

  /* ── generic bar renderer ── */

  function renderBars(containerId, obj, wideKeys) {
    const container = document.getElementById(containerId);
    container.textContent = '';
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.style.color = 'rgba(255,255,255,0.12)';
      empty.textContent = '—';
      container.appendChild(empty);
      return;
    }
    const max = entries[0][1] || 1;
    for (const [key, count] of entries) {
      const row = document.createElement('div');
      row.className = 'bar-row';
      const k = document.createElement('span');
      k.className = wideKeys ? 'bar-key wide' : 'bar-key';
      k.textContent = wideKeys ? truncate(key, 18) : key;
      k.title = key;
      const b = document.createElement('span');
      b.className = 'bar-track';
      b.textContent = asciiBar(count, max);
      const c = document.createElement('span');
      c.className = 'bar-count';
      c.textContent = count;
      row.appendChild(k);
      row.appendChild(b);
      row.appendChild(c);
      container.appendChild(row);
    }
  }

  /* ── log renderer ── */

  function renderLog(rows) {
    const tbody = document.getElementById('log-body');
    tbody.textContent = '';
    for (const row of rows) {
      const completed = row.completed;
      const stepLabel = row.entry_step != null && row.entry_step !== row.step
        ? row.entry_step + '→' + row.step + '/' + TOTAL_STEPS
        : row.step + '/' + TOTAL_STEPS;
      const src = row.utm_source || row.referrer || 'direct';
      const sel = row.selections || {};
      const hasSelections = Object.keys(sel).length > 0;
      const tr = document.createElement('tr');
      tr.className = completed ? '' : 'abandoned';
      const cells = [
        { cls: 'col-time', val: fmtTime(row.created_at) },
        { cls: 'col-step', val: stepLabel },
        { cls: 'col-src',  val: truncate(src, 22) },
        { cls: 'col-dev',  val: row.device || '—' },
        { cls: 'col-dur',  val: fmtDur(row.duration_seconds) },
        { cls: 'col-iact', val: row.interaction_type || '—' },
      ];
      for (const { cls, val } of cells) {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = val;
        if (cls === 'col-src') td.title = src;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      if (hasSelections) {
        const trSel = document.createElement('tr');
        trSel.className = 'sel-row' + (completed ? '' : ' abandoned');
        const tdSel = document.createElement('td');
        tdSel.colSpan = 6;
        const inner = document.createElement('div');
        inner.className = 'sel-inner';
        for (const [k, v] of Object.entries(sel)) {
          const kv = document.createElement('div');
          kv.className = 'sel-kv';
          const sk = document.createElement('span');
          sk.className = 'sel-k';
          sk.textContent = k;
          const sv = document.createElement('span');
          sv.className = 'sel-v';
          sv.textContent = String(v);
          kv.appendChild(sk);
          kv.appendChild(sv);
          inner.appendChild(kv);
        }
        tdSel.appendChild(inner);
        trSel.appendChild(tdSel);
        tbody.appendChild(trSel);
      }
    }
  }

  /* ── render dashboard ── */

  function renderDash(data) {
    const { summary, stepCounts, sources, devices, countries, rows } = data;
    const rate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) + '%' : '—';
    document.getElementById('s-rate').textContent      = rate;
    document.getElementById('s-total').textContent     = summary.total;
    document.getElementById('s-completed').textContent = summary.completed;
    document.getElementById('s-abandoned').textContent = summary.abandoned;
    document.getElementById('s-dur-c').textContent     = fmtDur(summary.avgDurationCompleted);
    document.getElementById('s-dur-a').textContent     = fmtDur(summary.avgDurationAbandoned);
    renderFunnel('steps-funnel', stepCounts);
    renderBars('sources-bars', sources, true);
    renderBars('devices-bars', devices, false);
    renderBars('countries-bars', countries, false);
    const durBuckets = {};
    for (const row of rows) {
      const b = durBucket(row.duration_seconds);
      durBuckets[b] = (durBuckets[b] || 0) + 1;
    }
    const bucketOrder = ['bounce <5s', 'glance 5-30s', 'read 30s-2m', 'engaged 2-5m', 'invested 5m+'];
    const durOrdered = {};
    for (const k of bucketOrder) if (durBuckets[k]) durOrdered[k] = durBuckets[k];
    renderBars('dur-bars', durOrdered, true);
    renderLog(rows);
    document.getElementById('refresh-state').textContent = 'last signal received ' + fmtTime(new Date().toISOString());
  }

  /* ── fetch ── */

  async function fetchData(password) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, limit: 200 }),
    });
    if (res.status === 401) throw Object.assign(new Error('forbidden'), { status: 401 });
    if (!res.ok) throw new Error('error ' + res.status);
    return res.json();
  }

  /* ── auth submit ── */

  async function submitPassword() {
    const pw = document.getElementById('pw-input').value;
    if (!pw) return;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    try {
      const data = await fetchData(pw);
      lastPassword = pw;
      sessionStorage.setItem('palantir_pw', pw);
      showDash(data);
    } catch (e) {
      errEl.textContent = e.status === 401 ? 'access denied' : (e.message || 'error');
    }
  }

  async function showDash(data) {
    document.getElementById('auth').style.display = 'none';
    const dash = document.getElementById('dash');
    dash.style.display = 'block';
    renderDash(data);
    const deviceList = await fetchDevices(lastPassword);
    renderDevices(deviceList, lastPassword);
    scheduleRefresh();
  }

  /* ── auto-refresh ── */

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (document.hidden) return;
    refreshTimer = setTimeout(async () => {
      try { const data = await fetchData(lastPassword); renderDash(data); } catch { /* silent */ }
      scheduleRefresh();
    }, REFRESH_INTERVAL);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && lastPassword) {
      fetchData(lastPassword).then(renderDash).catch(() => {});
      scheduleRefresh();
    } else {
      clearTimeout(refreshTimer);
    }
  });

  document.getElementById('pw-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitPassword();
  });

  /* ── devices ── */

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  async function fetchDevices(password) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, action: 'list_devices' }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    return j.devices || [];
  }

  async function renameDevice(password, deviceToken, name) {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, action: 'rename_device', device_token: deviceToken, name }),
    });
  }

  function renderDevices(deviceList, password) {
    const container = document.getElementById('devices-list');
    container.textContent = '';
    if (!deviceList.length) {
      const empty = document.createElement('div');
      empty.style.color = 'rgba(255,255,255,0.22)';
      empty.style.fontSize = '13px';
      empty.style.paddingTop = '8px';
      empty.textContent = 'no devices registered yet — visit /ident on each device';
      container.appendChild(empty);
      return;
    }
    for (const dev of deviceList) {
      const row = document.createElement('div');
      row.className = 'device-row';
      const nameEl = document.createElement('span');
      nameEl.className = 'device-name';
      nameEl.textContent = dev.name || 'unnamed';
      nameEl.title = 'click to rename';
      nameEl.addEventListener('click', () => {
        const input = document.createElement('input');
        input.className = 'device-name-input';
        input.value = dev.name || '';
        input.maxLength = 50;
        row.replaceChild(input, nameEl);
        input.focus();
        input.select();
        async function commit() {
          const newName = input.value.trim() || 'unnamed';
          dev.name = newName;
          nameEl.textContent = newName;
          row.replaceChild(nameEl, input);
          await renameDevice(password, dev.device_token, newName);
        }
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { row.replaceChild(nameEl, input); }
        });
      });
      const meta = document.createElement('span');
      meta.className = 'device-meta';
      meta.textContent = 'last seen ' + fmtDate(dev.last_seen);
      const country = document.createElement('span');
      country.className = 'device-country';
      country.textContent = dev.last_country || '—';
      row.appendChild(nameEl);
      row.appendChild(meta);
      row.appendChild(country);
      container.appendChild(row);
    }
  }

  /* ── auto-login from sessionStorage ── */

  const saved = sessionStorage.getItem('palantir_pw');
  if (saved) {
    lastPassword = saved;
    fetchData(saved).then(showDash).catch(() => { sessionStorage.removeItem('palantir_pw'); });
  }
</script>
</body>
</html>`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const seerPassword = process.env.SEER_PASSWORD || '';
  const ownerSecret  = process.env.OWNER_COOKIE_SECRET || '';
  if (!seerPassword || !ownerSecret) return res.status(500).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';

  const cookies = parseCookies(req.headers.cookie);

  /* already authenticated — serve dashboard directly */
  if (req.method === 'GET') {
    const authed = cookies.ident_session && safeEqual(cookies.ident_session, seerPassword);
    if (authed) return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(DASHBOARD);
    return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(LOGIN_PAGE.replace('__ERR__', ''));
  }

  /* POST — password submission */
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(LOGIN_PAGE.replace('__ERR__', 'too many attempts'));
  }

  /* read raw body — vercel node runtime requires manual stream reading for form posts */
  let rawBody;
  try {
    rawBody = typeof req.body === 'string'
      ? req.body
      : (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body))
        ? new URLSearchParams(req.body).toString()
        : await readBody(req);
  } catch {
    return res.status(400).end();
  }

  const params   = new URLSearchParams(rawBody);
  const submitted = params.get('password') || '';

  if (!safeEqual(submitted, seerPassword)) {
    return res.status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(LOGIN_PAGE.replace('__ERR__', 'wrong'));
  }

  /* correct — clear rate limit, set cookies, serve dashboard */
  await clearRateLimit(ip);

  const existingDevice = cookies.palantir_device;
  const deviceToken    = isValidUUID(existingDevice) ? existingDevice : randomUUID();
  const maxAge         = 60 * 60 * 24 * 3650; /* 10 years */
  const opts           = `Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure; HttpOnly`;

  res.setHeader('Set-Cookie', [
    `ident_session=${seerPassword}; ${opts}`,
    `palantir_mine=${ownerSecret}; ${opts}`,
    `palantir_device=${deviceToken}; ${opts}`,
  ]);

  return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(DASHBOARD);
}
