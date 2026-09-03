import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const lifetime = 15552000;

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueOwnerSession(secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret) return null;
  const device = randomBytes(3).toString('hex');
  const payload = `${device}.${now + lifetime}`;
  return { device, value:`${payload}.${signature(payload, secret)}` };
}

export function readOwnerSession(value, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof value !== 'string') return null;
  const match = /^([a-f0-9]{6})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match || Number(match[2]) <= now) return null;
  const payload = `${match[1]}.${match[2]}`;
  const supplied = Buffer.from(match[3]);
  const expected = Buffer.from(signature(payload, secret));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? match[1] : null;
}

export function sameSecret(supplied, expected) {
  if (typeof supplied !== 'string' || !supplied || !expected) return false;
  const left = createHmac('sha256', expected).update(supplied).digest();
  const right = createHmac('sha256', expected).update(expected).digest();
  return timingSafeEqual(left, right);
}
