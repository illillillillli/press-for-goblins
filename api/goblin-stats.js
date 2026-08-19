import { createHash, timingSafeEqual } from 'node:crypto';

const ALLOWED_HOSTS = new Set(['pressforgoblins.com', 'www.pressforgoblins.com']);

function authorised(header, expected) {
  const supplied = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(header || '')?.[1] || '';
  if (!supplied || !expected) return false;
  const left = createHash('sha256').update(supplied).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).end();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return res.status(403).end();
  if (!authorised(req.headers.authorization, process.env.GOBLIN_STATS_READ_TOKEN)) return res.status(401).end();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const capability = process.env.ANALYTICS_INGEST_CAPABILITY;
  if (!url || !key || !capability) return res.status(503).end();
  const days = boundedInteger(req.query?.days, 30, 1, 90);
  const minutes = boundedInteger(req.query?.minutes, 1440, 1, 43200);
  const limit = boundedInteger(req.query?.limit, 20, 1, 50);

  try {
    const upstream = await fetch(`${url}/rest/v1/rpc/goblin_stats_snapshot`, {
      method: 'POST',
      headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ p_days:days, p_minutes:minutes, p_limit:limit, p_capability:capability }),
    });
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.ok ? 200 : 503).send(body);
  } catch {
    return res.status(503).json({ error:'temporarily unavailable' });
  }
}
