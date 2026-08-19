import { normaliseMetric, parseCookies } from '../shared/analytics.mjs';
import { createHmac } from 'node:crypto';

export const COLLECTION_ENABLED = process.env.ANALYTICS_COLLECTION_ENABLED === 'true';
const ALLOWED_ORIGINS = new Set([
  'https://pressforgoblins.com',
  'https://www.pressforgoblins.com',
]);

async function rateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const capability = process.env.ANALYTICS_INGEST_CAPABILITY;
  if (!url || !token || !capability) return false;
  const ipKey = createHmac('sha256', capability).update(ip).digest('hex').slice(0, 32);
  try {
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', `analytics:rl:${ipKey}`], ['EXPIRE', `analytics:rl:${ipKey}`, 60, 'NX']]),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Number(data?.[0]?.result) <= 30;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).end();
  if (!COLLECTION_ENABLED) return res.status(410).json({ collection: 'paused' });

  const origin = req.headers.origin || '';
  const sameSite = req.headers['sec-fetch-site'];
  if (!ALLOWED_ORIGINS.has(origin) || (sameSite && !['same-origin', 'same-site'].includes(sameSite))) {
    return res.status(403).end();
  }

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (Buffer.byteLength(raw) > 1024) return res.status(413).end();
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).end(); }
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !['metric', 'value', 'session'].includes(key))) {
    return res.status(400).end();
  }
  const safe = normaliseMetric(body.metric, body.value);
  if (!safe) return res.status(400).end();
  const session = typeof body.session === 'string' && /^[0-9a-f-]{36}$/i.test(body.session)
    ? body.session.toLowerCase()
    : null;
  if (!session) return res.status(400).end();

  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  if (!(await rateLimit(ip))) return res.status(503).json({ collection: 'temporarily unavailable' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const capability = process.env.ANALYTICS_INGEST_CAPABILITY;
  if (!supabaseUrl || !publishableKey || !capability) return res.status(503).end();

  const ownerToken = parseCookies(req.headers.cookie).pfg_owner || null;
  const sessionHash = createHmac('sha256', capability).update(session).digest('hex');
  async function increment(metric, value) {
    return fetch(`${supabaseUrl}/rest/v1/rpc/analytics_ingest`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_metric: metric,
        p_value: value,
        p_capability: capability,
        p_owner_token: ownerToken,
        p_session_hash: sessionHash,
      }),
    });
  }
  try {
    const requests = [increment(safe.metric, safe.value)];
    if (safe.metric === 'page') {
      const device = /mobile|android|iphone|ipad/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop';
      const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
      const region = country === 'GB' || country === 'US' ? country : country ? 'other' : 'unknown';
      requests.push(increment('device', device), increment('region', region));
    }
    const responses = await Promise.all(requests);
    if (responses.some(response => !response.ok)) return res.status(503).end();
    return res.status(204).end();
  } catch {
    return res.status(503).end();
  }
}
