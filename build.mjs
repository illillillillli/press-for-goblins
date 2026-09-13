#!/usr/bin/env node
/* Build the deliberately monolithic public application into an allowlisted
   static directory. Repository tests, manuals, previews and operational tools
   are source material, never public web routes. */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = dirname(fileURLToPath(import.meta.url));
const output = resolve(repository, 'dist');
if (!output.startsWith(repository + sep)) throw new Error('unsafe output directory');

execFileSync(process.execPath, [join(repository, 'insignia.mjs')], { stdio: 'inherit' });
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const exactFiles = new Set([
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'assets/icons/active-dot.svg',
  'assets/icons/favicon.png',
  'assets/icons/shortcut.png',
  'assets/images/eyes.png',
  'assets/images/home.png',
  'assets/images/home-nav.svg',
  'assets/images/portfolio.png',
  'assets/images/portfolio-nav.svg',
  'assets/images/preview.png',
  'assets/images/qr.png',
  'assets/images/worldglass.svg',
  'assets/worldglass/natural-earth-110m-land.js',
  'assets/worldglass/worldglass.css',
  'assets/worldglass/worldglass.js',
  'fonts/PressStart2P-Regular.woff',
  'fonts/PressStart2P-Regular.woff2',
  'fonts/SpecialElite-Regular.woff2'
]);

const included = [];
for (const candidate of exactFiles) {
  const source = resolve(repository, candidate);
  if (!source.startsWith(repository + sep) || !existsSync(source) || lstatSync(source).isSymbolicLink()) continue;
  if (!exactFiles.has(candidate)) continue;
  const destination = resolve(output, candidate);
  if (relative(output, destination).startsWith('..')) throw new Error(`unsafe public path: ${candidate}`);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  included.push(candidate);
}

for (const required of exactFiles) {
  if (!included.includes(required)) throw new Error(`missing required public file: ${required}`);
}

console.log(`[build] ${included.length} allowlisted static files written to dist`);
