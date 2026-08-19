/* ═══════════════════════════════════════════════════════
   press for goblins - /api/nonce (vercel endpoint)
   issues a short-lived HMAC token for form submissions.
   stateless - no redis required.
   env vars: NONCE_SECRET (min 32 chars)
   ═══════════════════════════════════════════════════════ */

import { createHmac, randomBytes } from 'node:crypto';

/* token valid for 10 minutes */
const TTL_MS = 10 * 60 * 1000;

export function signNonce(nonce, ts, secret) {
  return createHmac('sha256', secret)
    .update(`${nonce}:${ts}`)
    .digest('hex');
}

export function verifyNonce(nonce, ts, sig, secret) {
  const now = Date.now();
  if (!nonce || !ts || !sig) return false;
  if (Math.abs(now - Number(ts)) > TTL_MS) return false;
  const expected = signNonce(nonce, ts, secret);
  /* timing-safe compare */
  if (expected.length !== sig.length) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export default async function handler(req, res) {
  const allowedOrigins = [
    'https://pressforgoblins.com',
    'https://www.pressforgoblins.com',
  ];
  const origin = req.headers['origin'] || '';
  if (!allowedOrigins.includes(origin)) return res.status(403).end();

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const secret = process.env.NONCE_SECRET || '';
  if (secret.length < 32) return res.status(500).json({ error: 'server misconfigured' });

  const nonce = randomBytes(16).toString('hex');
  const ts = Date.now();
  const sig = signNonce(nonce, ts, secret);

  return res.status(200).json({ nonce, ts, sig });
}
