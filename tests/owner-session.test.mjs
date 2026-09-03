import test from 'node:test';
import assert from 'node:assert/strict';
import { issueOwnerSession, readOwnerSession, sameSecret } from '../shared/owner-session.mjs';

test('owner sessions are signed, expire and retain only an anonymous device code', () => {
  const marker=issueOwnerSession('secret',1700000000);
  assert.match(marker.device,/^[a-f0-9]{6}$/);
  assert.equal(readOwnerSession(marker.value,'secret',1700000001),marker.device);
  assert.equal(readOwnerSession(marker.value,'wrong',1700000001),null);
  assert.equal(readOwnerSession(marker.value,'secret',1715552001),null);
});

test('registration secrets compare without exposing the configured value', () => {
  assert.equal(sameSecret('right','right'),true);
  assert.equal(sameSecret('wrong','right'),false);
});
