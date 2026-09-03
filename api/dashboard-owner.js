import { issueOwnerSession, sameSecret } from '../shared/owner-session.mjs';

const ALLOWED_ORIGINS = new Set(['https://pressforgoblins.com', 'https://www.pressforgoblins.com']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).end();
  if (!ALLOWED_ORIGINS.has(req.headers.origin || '')) return res.status(403).end();
  if (sameSecret(req.body?.registration, process.env.DASHBOARD_REGISTRATION_TOKEN)) {
    const marker = issueOwnerSession(process.env.DASHBOARD_OWNER_COOKIE_SECRET);
    if (!marker) return res.status(503).end();
    res.setHeader('Set-Cookie', `pfg_owner_session=${marker.value}; Max-Age=15552000; Path=/; SameSite=Strict; Secure; HttpOnly`);
    return res.status(200).json({ device:marker.device });
  }
  const bearer = req.headers.authorization;
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer || '')) return res.status(401).end();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).end();
  try {
    const upstream = await fetch(`${url}/rest/v1/rpc/issue_owner_exclusion`, {
      method: 'POST',
      headers: { apikey: key, Authorization: bearer, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!upstream.ok) return res.status(403).end();
    const marker = await upstream.json();
    if (!marker || typeof marker.token !== 'string' || !/^[a-f0-9]{64}$/.test(marker.token)
        || typeof marker.device !== 'string' || !/^[a-f0-9]{6}$/.test(marker.device)) return res.status(503).end();
    res.setHeader('Set-Cookie', `pfg_owner=${marker.token}; Max-Age=15552000; Path=/; SameSite=Strict; Secure; HttpOnly`);
    return res.status(200).json({ device: marker.device });
  } catch {
    return res.status(503).end();
  }
}
