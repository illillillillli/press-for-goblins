import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectHumanText } from '../scripts/human-text-gate.mjs';

test('passes lowercase rendered text and ignores machine syntax', () => {
  const source = '<style>.THING{color:#ABC}</style><div class="THING" data-code="ABC">field reports</div><script>const ABC = 1;</script>';
  assert.deepEqual(inspectHumanText(source, '_previews/example.html'), []);
});

test('fails uppercase visible text and accessible text', () => {
  const source = '<button aria-label="OPEN REPORT">EVENTS</button>';
  assert.deepEqual(inspectHumanText(source, '_previews/example.html').map(({ surface, text }) => ({ surface, text })), [
    { surface: 'text', text: 'EVENTS' },
    { surface: 'aria-label', text: 'OPEN REPORT' }
  ]);
});

test('fails computed uppercase presentation', () => {
  const findings = inspectHumanText('<style>.label { text-transform: uppercase; }</style><span>events</span>', '_previews/example.html');
  assert.equal(findings[0].surface, 'presentation');
});

test('checks rendered text inside an escaped srcdoc', () => {
  const source = '<iframe srcdoc="&lt;div aria-label=&quot;OPEN&quot;&gt;REPORT&lt;/div&gt;"></iframe>';
  const findings = inspectHumanText(source, '_previews/wrapper.html');
  assert.deepEqual(findings.map(({ text }) => text), ['REPORT', 'OPEN']);
});

test('allows only the approved proper-case address strings in the public index', () => {
  const approved = '<p>Press for Goblins</p><p>167-169 Great Portland St</p><p>London W1W 5PF</p>';
  assert.deepEqual(inspectHumanText(approved, 'index.html'), []);
  assert.equal(inspectHumanText('<p>Great Portland Street</p>', 'index.html').length, 1);
});
