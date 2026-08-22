import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../dashboard.html', import.meta.url), 'utf8');

const screenIds = [
  'screen-hero',
  'screen-term',
  'screen-receipt',
  'screen-about',
  'screen-portfolio',
];

function openingTag(id) {
  const match = source.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`));
  assert.ok(match, `missing opening tag for ${id}`);
  return match[0];
}

test('all executable inline scripts parse', () => {
  for (const [name, html] of [['site', source], ['dashboard', dashboardSource]]) {
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(match => !/type=["']application\/ld\+json["']/i.test(match[1]))
      .map(match => match[2]);
    assert.ok(scripts.length, `${name} has no executable script`);
    scripts.forEach((script, index) => assert.doesNotThrow(() => new Function(script), `${name} script ${index + 1} must parse`));
  }
});

test('initial screen markup is isolated before JavaScript runs', () => {
  const hero = openingTag('screen-hero');
  assert.match(hero, /class="screen is-active"/);
  assert.match(hero, /aria-hidden="false"/);
  assert.doesNotMatch(hero, /\sinert(?:\s|>)/);

  for (const id of screenIds.filter(id => id !== 'screen-hero')) {
    const tag = openingTag(id);
    assert.match(tag, /aria-hidden="true"/, `${id} must begin hidden from assistive technology`);
    assert.match(tag, /\sinert(?:\s|>)/, `${id} must begin inert`);
    assert.match(tag, /tabindex="-1"/, `${id} needs a non-tabbing context focus target`);
  }
});

test('one screen-state owner controls visibility, interactivity and focus', () => {
  assert.match(source, /function setActiveScreenState\(id, options\)/);
  assert.match(source, /target\.inert = false/);
  assert.match(source, /screen\.inert = true/);
  assert.match(source, /focusedScreen && focusedScreen !== target/);
  assert.match(source, /screen\.focus\(\{ preventScroll: true \}\)/);

  assert.equal((source.match(/classList\.add\('is-active'\)/g) || []).length, 1);
  assert.equal((source.match(/classList\.remove\('is-active'\)/g) || []).length, 1);
  assert.match(source, /function activateScreen\(id, options\) \{\s*return window\._setActiveScreenState\(id, options\);/);
  assert.match(source, /function showScreen\(name, options\) \{[\s\S]*?return window\._setActiveScreenState\(screens\[name\]\.id, options\);/);
});

test('flow entry and receipt transitions request contextual focus without targeting an input', () => {
  assert.match(source, /showScreen\('term', \{ focus: 'context' \}\)/);
  assert.ok(
    (source.match(/showScreen\('receipt', \{ focus: 'context' \}\)/g) || []).length >= 2,
    'receipt entry paths must request contextual focus',
  );
  assert.doesNotMatch(source, /focusScreenContext[\s\S]{0,500}querySelector\(['"](?:input|textarea)/);
});

test('principal views share one physical heading and divider at every viewport', () => {
  assert.equal((source.match(/<h1\b/g) || []).length, 1, 'principal views must not duplicate headings');
  assert.equal((source.match(/<span class="principal-divider"/g) || []).length, 1);
  assert.equal((source.match(/class="principal-header-slot"/g) || []).length, 3);
  assert.doesNotMatch(source, /id="(?:home|about|port)-title"/);
  assert.match(source, /\.principal-header-slot\s*\{[\s\S]*?display:\s*block/);
  assert.doesNotMatch(source, /@media \(min-width:\s*601px\)[\s\S]{0,300}\.principal-header-slot\s*\{[\s\S]{0,100}display:\s*none/);
  assert.match(source, /var el = document\.getElementById\('principal-title'\)/);
  assert.match(source, /document\.addEventListener\('principalTitleChanged', fitTitle\)/);
});

test('principal tab changes are atomic and use the settled opening cadence everywhere', () => {
  assert.match(source, /\.screen\s*\{[\s\S]*?transition:\s*none/);
  assert.doesNotMatch(source, /MOBILE_HERO_INTRO/);
  assert.match(source, /const HERO_READY_MS = 1500/);
  assert.match(source, /const HERO_CORRECTION_MS = 2800/);
  assert.match(source, /eyes\[0\]\.classList\.add\('open'\)/);
  assert.match(source, /setTimeout\(\(\) => eyes\[1\]\.classList\.add\('open'\), 220\)/);
  assert.match(source, /setTimeout\(\(\) => eyes\[2\]\.classList\.add\('open'\), 440\)/);
});

test('principal headings begin below the fully opaque top mist at every viewport', () => {
  assert.match(source, /transparent 155px,[\s\S]{0,300}#000 200px/);
  assert.match(source, /padding:\s*210px/);
  assert.match(source, /--mobile-mist-top-zero:\s*120px/);
  assert.match(source, /--mobile-mist-top-opaque:\s*140px/);
  assert.match(source, /padding-top:\s*calc\(var\(--mobile-mist-top-zero,[\s\S]{0,100}var\(--mobile-content-inset/);
});

test('Meet the Goblins alone owns the interactive social star field', () => {
  assert.match(source, /id="linkedin-ascii-link"/);
  assert.match(source, /id="ascii-output"/);
  assert.match(source, /\[ascii-linkedin\] interactive star field/);
  assert.match(source, /#linkedin-ascii-link\s*\{[\s\S]*?touch-action:\s*none/);
  assert.match(source, /#linkedin-ascii-link\.is-unlocked\s*\{\s*touch-action:\s*manipulation/);
  assert.match(source, /var REVEALED_KEY = 'pfg-linkedin-revealed'/);
  assert.match(source, /pfgAnalyticsEnabled\(\).*sessionStorage\.setItem\(REVEALED_KEY, '1'\)/);
  assert.match(source, /pfgAnalyticsEnabled\(\).*sessionStorage\.getItem\(REVEALED_KEY\) === '1'/);
  assert.match(source, /link\.addEventListener\('touchstart',[\s\S]{0,100}if \(allRevealed\) return/);
  assert.match(source, /#about-social\s*\{\s*margin-top:\s*var\(--mobile-space-section\)/);
  assert.doesNotMatch(source, /instagram-ascii-link|ascii-output-insta|port-social/);
});

test('all free-text entry begins at the left inset', () => {
  assert.match(source, /\.term-input-field\s*\{[\s\S]*?text-align:\s*left/);
  assert.match(source, /#port-email-input\s*\{[\s\S]*?text-align:\s*left/);
});

test('opportunities count only on their active screen and at least half inside the viewport', () => {
  assert.match(source, /function pfgOpportunityIsVisible\(element\)/);
  assert.match(source, /element\.closest\('\.screen'\)/);
  assert.match(source, /screen\.classList\.contains\('is-active'\)/);
  assert.match(source, /screen\.getAttribute\('aria-hidden'\) !== 'false'/);
  assert.match(source, /\(visibleWidth \* visibleHeight\) \/ area >= \.5/);
  assert.match(source, /activeScreenChanged'[\s\S]{0,100}pfgCheckVisibleOpportunities/);
});
