#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const policy = JSON.parse(readFileSync(resolve(root, 'policy/interface-case.json'), 'utf8'));
const exceptionPolicy = JSON.parse(readFileSync(resolve(root, 'policy/interface-case-exceptions.json'), 'utf8'));

export function inspectHumanText(source, file = '<source>') {
  const findings = [];
  const exceptions = exceptionPolicy.exceptions.filter((entry) =>
    Array.isArray(entry.files) && entry.files.some((candidate) => file.endsWith(candidate))
  );
  const stripApproved = (value) => exceptions.some((entry) => value === entry.text) ? '' : value;
  const inspect = (value, surface) => {
    const decoded = decodeEntities(value).replace(/\s+/g, ' ').trim();
    if (!decoded) return;
    const unchecked = stripApproved(decoded);
    const uppercase = [...unchecked].filter((character) => /\p{Lu}/u.test(character));
    if (uppercase.length) findings.push({ file, surface, text: decoded, uppercase: [...new Set(uppercase)].join('') });
  };

  const withoutCode = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  for (const match of withoutCode.matchAll(/>([^<]+)</g)) inspect(match[1], 'text');
  for (const match of withoutCode.matchAll(/\b(alt|aria-label|aria-description|title|placeholder|srcdoc)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
    const attribute = match[1].toLowerCase();
    if (attribute === 'srcdoc') findings.push(...inspectHumanText(decodeEntities(match[3]), `${file}#srcdoc`));
    else inspect(match[3], attribute);
  }

  for (const forbidden of policy.forbidden_presentations) {
    if (source.toLowerCase().includes(forbidden)) findings.push({ file, surface: 'presentation', text: forbidden, uppercase: 'computed' });
  }
  return findings;
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function main(files) {
  if (!files.length) throw new Error('usage: node scripts/human-text-gate.mjs <html-or-svg> [...]');
  const findings = files.flatMap((file) => inspectHumanText(readFileSync(file, 'utf8'), file));
  const report = { ok: findings.length === 0, policy_version: policy.version, rewrite: policy.rewrite, files, findings };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
