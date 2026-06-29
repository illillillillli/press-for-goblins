#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   press for goblins — impressions
   generates all four standalone email preview HTMLs
   usage: node impressions.mjs
   output: ~/Documents/_forge/{receipt-user,receipt-notif,ticket-user,ticket-notif}.html
   ═══════════════════════════════════════════════════════ */

import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { buildHtml as receiptUserHtml, buildText as receiptUserText } from './api/receipt-user.js';
import { buildHtml as receiptNotifHtml } from './api/receipt-notif.js';
import { buildHtml as ticketUserHtml } from './api/ticket-user.js';
import { buildHtml as ticketNotifHtml } from './api/ticket-notif.js';

const OUT = join(homedir(), 'Documents', '_forge');
const REF = '#0009';

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

/* write combined receipts-and-tickets.html with srcdoc baked in */
function toSrcdoc(html) {
  return html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>receipts &amp; tickets — pfg</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { overflow-x: hidden; }
    body { background: #000; font-family: 'Courier New', monospace; color: rgba(255,255,255,0.5); padding: 40px 24px; }
    .grid-scroll { overflow-x: auto; }
    .grid { display: grid; grid-template-columns: repeat(4, 480px); gap: 24px; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 10px; }
    .label { font-size: 13px; letter-spacing: 0.05em; color: rgba(255,255,255,0.3); text-transform: lowercase; text-align: center; padding: 32px 0 10px; }
    iframe { width: 100%; border: none; background: #010101; display: block; }
  </style>
</head>
<body>
  <div class="grid-scroll"><div class="grid">
${emails.map(({ name, label, html }, i) => `    <div class="col">
      <div class="label">${label}</div>
      <iframe srcdoc="${toSrcdoc(html)}" id="frame-${name.replace('.html','')}" onload="this.style.height=this.contentDocument.documentElement.scrollHeight+'px'"></iframe>
    </div>`).join('\n')}
  </div></div>
</body>
</html>`;

writeFileSync(join(OUT, 'receipts-and-tickets.html'), combinedHtml, 'utf8');
console.log('wrote receipts-and-tickets.html');

console.log('\ndone.');
