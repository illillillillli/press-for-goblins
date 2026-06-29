/* ═══════════════════════════════════════════════════════
   press for goblins — /api/seen (Vercel endpoint)
   receives session beacons from index.html
   env vars: SUPABASE_URL, SUPABASE_ANON_KEY,
             UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

/* rate limit: max 20 POSTs per IP per 60s via upstash redis */
async function checkRateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; /* skip if not configured */
  const key = `seen:rl:${ip}`;
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 60, 'NX'],
      ]),
    });
    const data = await r.json();
    const count = data?.[0]?.result ?? 0;
    return count <= 20;
  } catch {
    return true; /* fail open — don't block real users if redis is down */
  }
}

/* strip query params from referrer to avoid storing PII tokens */
function sanitiseReferrer(raw) {
  try {
    const u = new URL(String(raw || ''));
    return `${u.origin}${u.pathname}`.slice(0, 500);
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  /* strict origin check */
  const allowedOrigins = [
    'https://pressforgoblins.com',
    'https://www.pressforgoblins.com',
  ];
  const origin = req.headers['origin'];
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).end();
  }

  /* CORS headers — needed for fetch()-based clients sending application/json */
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  /* preflight */
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).end();

  /* rate limit by IP */
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';
  const allowed = await checkRateLimit(ip);
  if (!allowed) return res.status(429).end();

  /* body size limit */
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (raw.length > 4096) return res.status(413).end();

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).end();
  }

  const {
    session_id,
    step,
    entry_step,
    interaction_type,
    selections,
    referrer,
    utm_source,
    completed,
    duration_seconds,
  } = body || {};

  /* selections: type check + 2KB size cap */
  const rawSel = selections;
  const selStr = (rawSel && typeof rawSel === 'object' && !Array.isArray(rawSel))
    ? JSON.stringify(rawSel) : null;
  const safeSelections = (selStr && selStr.length <= 2048) ? rawSel : {};

  /* derive device from user-agent */
  const ua = req.headers['user-agent'] || '';
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';

  /* derive country from vercel header */
  const country = req.headers['x-vercel-ip-country'] || null;

  /* validate interaction_type — only known values accepted */
  const knownInteractions = ['keyboard', 'touch', 'pointer'];
  const safeInteraction = knownInteractions.includes(interaction_type) ? interaction_type : null;

  const payload = {
    session_id: String(session_id || '').slice(0, 64),
    step: Number(step) || 0,
    entry_step: entry_step != null ? Number(entry_step) || null : null,
    interaction_type: safeInteraction,
    selections: safeSelections,
    referrer: sanitiseReferrer(referrer),
    utm_source: String(utm_source || '').slice(0, 100),
    device,
    country,
    completed: Boolean(completed),
    duration_seconds: Math.min(Math.max(Number(duration_seconds) || 0, 0), 3600),
  };

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/seen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('supabase insert failed:', err);
      return res.status(500).end();
    }

    return res.status(200).end();
  } catch (e) {
    console.error('seen endpoint error:', e);
    return res.status(500).end();
  }
}
