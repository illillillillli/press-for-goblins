const ALLOWED_ORIGINS = new Set(['https://pressforgoblins.com', 'https://www.pressforgoblins.com']);
const ALLOWED_HOSTS = new Set(['pressforgoblins.com', 'www.pressforgoblins.com']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).end();
  const origin = req.headers.origin || '';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const sameSite = req.headers['sec-fetch-site'];
  if (!ALLOWED_HOSTS.has(host)
      || (origin && !ALLOWED_ORIGINS.has(origin))
      || (sameSite && !['same-origin', 'same-site'].includes(sameSite))) return res.status(403).end();
  const bearer = req.headers.authorization;
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer || '')) return res.status(401).end();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).end();
  try {
    const upstream = await fetch(`${url}/rest/v1/rpc/dashboard_summary`, {
      method: 'POST',
      headers: { apikey: key, Authorization: bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_days: 30 }),
    });
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.ok ? 200 : upstream.status === 401 ? 401 : 403).send(body);
  } catch {
    return res.status(503).json({ error: 'temporarily unavailable' });
  }
}
