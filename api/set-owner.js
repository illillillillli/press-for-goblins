/* ═══════════════════════════════════════════════════════
   press for goblins — /api/set-owner (Vercel endpoint)
   sets palantir_mine + palantir_device cookies on owner devices.
   visit /api/set-owner?token=<OWNER_COOKIE_SECRET> once per device.
   preserves existing palantir_device UUID on repeat visits.
   redirects to / on success, 403 on wrong token.
   env vars: OWNER_COOKIE_SECRET
   ═══════════════════════════════════════════════════════ */

import { randomUUID } from 'node:crypto';

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [name, ...rest] = pair.trim().split('=');
    if (!name) return acc;
    acc[name.trim()] = rest.join('=');
    return acc;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const expected = process.env.OWNER_COOKIE_SECRET || '';
  if (!expected) return res.status(500).end();

  const token = String(req.query.token || '');

  /* timing-safe compare */
  let valid = false;
  try {
    const { timingSafeEqual, createHash } = await import('node:crypto');
    const hash = (s) => createHash('sha256').update(s).digest();
    valid = timingSafeEqual(hash(token), hash(expected));
  } catch {
    valid = token === expected;
  }

  if (!valid) return res.status(403).send('forbidden');

  /* preserve existing device UUID if present — don't overwrite on repeat visits */
  const cookies = parseCookies(req.headers.cookie);
  const existingDeviceToken = cookies.palantir_device;
  const deviceToken = (existingDeviceToken && existingDeviceToken.length === 36)
    ? existingDeviceToken
    : randomUUID();

  const maxAge = 60 * 60 * 24 * 365;
  const cookieOpts = `Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;

  res.setHeader('Set-Cookie', [
    `palantir_mine=${expected}; ${cookieOpts}`,
    `palantir_device=${deviceToken}; ${cookieOpts}`,
  ]);

  res.writeHead(302, { Location: '/' });
  res.end();
}
