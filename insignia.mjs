#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   press for goblins — insignia
   reads constants from insignia.js and patches the
   <!-- BEGIN INSIGNIA --> block in index.html.
   run: node insignia.mjs
   also runs automatically via vercel buildCommand.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  ACCENT,
  SITE_URL,
  EYES_URL,
  QR_URL,
  ADDRESS_1,
  ADDRESS_2,
  FONT_BODY,
  FONT_DISPLAY,
} from './api/shared/insignia.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const INDEX = join(__dir, 'index.html');

const BEGIN = '<!-- BEGIN INSIGNIA';
const END   = '<!-- END INSIGNIA -->';

/* hash of insignia.js for the sync comment */
const insigniaSource = readFileSync(join(__dir, 'api/shared/insignia.js'), 'utf8');
const hash = createHash('sha1').update(insigniaSource).digest('hex').slice(0, 8);

/* the block compositor writes into index.html */
const block = `<!-- BEGIN INSIGNIA — synced from insignia.js @ ${hash} -->
<style>
  /* [insignia] single source of truth — edit api/shared/insignia.js, not here */
  :root {
    --green: ${ACCENT};
    --site-url: "${SITE_URL}";
    --font-body: ${FONT_BODY};
    --font-display: ${FONT_DISPLAY};
  }
</style>
<!-- END INSIGNIA -->`;

let html = readFileSync(INDEX, 'utf8');

if (!html.includes(BEGIN) || !html.includes(END)) {
  console.error('[insignia] ERROR: markers not found in index.html');
  console.error('  expected: ' + BEGIN);
  console.error('  and:      ' + END);
  process.exit(1);
}

const before = html.indexOf(BEGIN);
const after  = html.indexOf(END) + END.length;
html = html.slice(0, before) + block + html.slice(after);

writeFileSync(INDEX, html, 'utf8');
console.log(`[insignia] index.html patched — insignia @ ${hash}`);
