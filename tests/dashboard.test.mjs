import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../dashboard.html', import.meta.url), 'utf8');
const config = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');

test('dashboard uses the approved proportional bars and circles without constellation graphics', () => {
  assert.match(dashboard, /className='stack'/);
  assert.match(dashboard, /className='direct'/);
  assert.match(dashboard, /class="orbit large"/);
  assert.match(dashboard, /className='donut'/);
  assert.doesNotMatch(dashboard, /constellation/i);
});

test('answer bars use the exact public query wording', () => {
  for (const wording of [
    'are you in need of goblins?',
    "what's the project?",
    'what do you need?',
    "what's the genre?",
    'sound good?',
    'creative development',
    'comic or graphic novel',
    'query/pitch feedback',
    "i'm in",
  ]) assert.ok(dashboard.includes(wording), `missing ${wording}`);
});

test('counted actions disclose their recorded opportunity denominators', () => {
  assert.match(dashboard, /counted once per tab session/i);
  assert.match(dashboard, /denominator:\['opportunity','email_rune'\]/);
  assert.match(dashboard, /denominator:\['opportunity','linkedin'\]/);
  assert.match(dashboard, /denominator:\['opportunity','field_reports_signup'\]/);
});

test('private dashboard has one canonical route and no legacy internal name', () => {
  const forbidden = ['palan', 'tir'].join('');
  assert.match(config, /"source": "\/dashboard"/);
  assert.match(dashboard, /\/api\/dashboard-data/);
  assert.ok(!`${dashboard}\n${config}`.toLowerCase().includes(forbidden));
});
