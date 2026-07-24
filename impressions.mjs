#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   press for goblins — impressions
   generates the master preview + all four standalone email HTMLs
   usage: node impressions.mjs
   output: ~/Documents/_forge/impressions.html (master)
           ~/Documents/_forge/{receipt-user,receipt-notif,ticket-user,ticket-notif}.html
   ═══════════════════════════════════════════════════════ */

import { writeFileSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

import { buildHtml as receiptUserHtml, buildText as receiptUserText } from './api/receipt-user.js';
import { buildHtml as receiptNotifHtml } from './api/receipt-notif.js';
import { buildHtml as ticketUserHtml } from './api/ticket-user.js';
import { buildHtml as ticketNotifHtml } from './api/ticket-notif.js';

const OUT = join(homedir(), 'Documents', '_forge');
const REF = '#0009';

/* absolute file:// path to index.html — works from _forge/ which is in a different tree */
const SITE_PATH = join(homedir(), 'iCloud', '_Codex', 'press for goblins', 'index.html')
  .split(' ').join('%20');
const SITE_URL = `file://${SITE_PATH}`;

/* dummy answers for receipt previews */
const DUMMY_ANSWERS = {
  gate: 'yes',
  'writer-type': 'novel',
  service: 'editorial assessment',
  genre: 'fantasy',
  'f-pitch': '░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
  'f-title': '░░░░░░░░░░░',
  'f-name': '░░░░░░░░░░░',
  'f-email': '░░░░@░░░░░░░░.░░░',
  'f-message': '░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
};

const DUMMY_EMAIL = '░░░░@░░░░░░░░.░░░';

const emails = [
  { name: 'receipt-user.html',  label: 'receipt > user',   html: receiptUserHtml(DUMMY_ANSWERS, REF) },
  { name: 'receipt-notif.html', label: 'receipt > goblin', html: receiptNotifHtml(DUMMY_ANSWERS, REF) },
  { name: 'ticket-user.html',   label: 'ticket > user',    html: ticketUserHtml(DUMMY_EMAIL, REF) },
  { name: 'ticket-notif.html',  label: 'ticket > goblin',  html: ticketNotifHtml(DUMMY_EMAIL, REF) },
];

/* write individual preview files */
for (const { name, html } of emails) {
  writeFileSync(join(OUT, name), html, 'utf8');
  console.log(`wrote ${name}`);
}

/* write combined impressions.html — site previews + all four emails */
function toSrcdoc(html) {
  return html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/* terminal: MacBook Pro 14" logical viewport 1512×900, scaled to 0.7× */
const TERMINAL_IFRAME_W = 1512;
const TERMINAL_IFRAME_H = 900;
const TERMINAL_SCALE = 0.7;
const TERMINAL_DISPLAY_W = Math.round(TERMINAL_IFRAME_W * TERMINAL_SCALE); /* 1058px */
const TERMINAL_DISPLAY_H = Math.round(TERMINAL_IFRAME_H * TERMINAL_SCALE); /* 630px */

/* slate: iPhone 15 Plus logical pixels 430×932 */
const SLATE_W = 430;
const SLATE_H = 932;

const siteCols = `    <div class="col col-terminal">
      <div class="label">terminal (desktop)</div>
      <div class="site-wrap site-wrap-terminal">
        <iframe src="${SITE_URL}" id="frame-terminal" width="${TERMINAL_IFRAME_W}" height="${TERMINAL_IFRAME_H}" scrolling="yes"></iframe>
      </div>
    </div>
    <div class="col col-slate">
      <div class="label">slate (mobile)</div>
      <div class="site-wrap site-wrap-slate">
        <iframe src="${SITE_URL}" id="frame-slate" width="${SLATE_W}" height="${SLATE_H}" scrolling="yes"></iframe>
      </div>
    </div>`;

const emailCols = emails.map(({ name, label, html }) => `    <div class="col">
      <div class="label">${label}</div>
      <iframe srcdoc="${toSrcdoc(html)}" id="frame-${name.replace('.html','')}" onload="this.style.height=this.contentDocument.documentElement.scrollHeight+'px'"></iframe>
    </div>`).join('\n');

const combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>impressions — pfg</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { overflow-x: auto; }
    body { background: #000; font-family: 'Courier New', monospace; color: rgba(255,255,255,0.5); padding: 40px 24px; }
    .grid-scroll { overflow-x: auto; }
    .grid { display: grid; grid-template-columns: ${TERMINAL_DISPLAY_W}px ${SLATE_W}px 480px 480px 480px 480px; gap: 24px; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 10px; }
    .label { font-size: 13px; letter-spacing: 0.05em; color: rgba(255,255,255,0.3); text-transform: lowercase; text-align: center; padding: 32px 0 10px; }
    iframe { border: none; background: #010101; display: block; }

    /* email iframes: full column width, auto height */
    .col:not(.col-terminal):not(.col-slate) iframe { width: 100%; }

    /* terminal: 1400px iframe scaled to 520×520 display (square) */
    .site-wrap-terminal {
      width: ${TERMINAL_DISPLAY_W}px;
      height: ${TERMINAL_DISPLAY_H}px;
      overflow: hidden;
      position: relative;
    }
    .site-wrap-terminal iframe {
      width: ${TERMINAL_IFRAME_W}px;
      height: ${TERMINAL_IFRAME_H}px;
      transform: scale(${TERMINAL_SCALE.toFixed(6)});
      transform-origin: top left;
      pointer-events: auto;
    }

    /* slate: 375×812 native portrait, no scaling */
    .site-wrap-slate {
      width: ${SLATE_W}px;
      height: ${SLATE_H}px;
      overflow: hidden;
    }
    .site-wrap-slate iframe {
      width: ${SLATE_W}px;
      height: ${SLATE_H}px;
    }
  </style>
</head>
<body>
  <div class="grid-scroll"><div class="grid">
${siteCols}
${emailCols}
  </div></div>
  <script>
    /* horizontal wheel always scrolls the page, even when cursor is over an iframe.
       iframes swallow wheel events by default — this fires on the outer document only.
       vertical scroll is unaffected (iframes handle it internally). */
    window.addEventListener('wheel', function(e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        window.scrollBy({ left: e.deltaX, behavior: 'auto' });
      }
    }, { passive: false });
  </script>
</body>
</html>`;

writeFileSync(join(OUT, 'impressions.html'), combinedHtml, 'utf8');
console.log('wrote impressions.html');

/* also keep receipts-and-tickets.html for backwards compat */
const legacyHtml = combinedHtml
  .replace('<title>impressions — pfg</title>', '<title>receipts &amp; tickets — pfg</title>');
writeFileSync(join(OUT, 'receipts-and-tickets.html'), legacyHtml, 'utf8');
console.log('wrote receipts-and-tickets.html (legacy alias)');

console.log('\ndone.');
