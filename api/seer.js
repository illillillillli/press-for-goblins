/* ═══════════════════════════════════════════════════════
   press for goblins — /api/seer (Vercel endpoint)
   returns session data for the seer dashboard
   env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
             SEER_PASSWORD, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

/* ── rate limiter: 10 attempts per IP per 15 minutes, fail-closed ── */
async function checkSeerRateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: true }; /* no redis configured — allow (local dev) */
  const key = `seer:rl:${ip}`;
  const lockKey = `seer:lock:${ip}`;
  try {
    /* check lockout first */
    const lockRes = await fetch(`${url}/get/${lockKey}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const lockData = await lockRes.json();
    if (lockData?.result) return { allowed: false, locked: true };

    /* increment attempt counter */
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 900, 'NX'],
      ]),
    });
    const data = await r.json();
    const count = data?.[0]?.result ?? 0;

    if (count > 10) {
      /* lock for 15 minutes */
      await fetch(`${url}/set/${lockKey}/1/ex/900`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return { allowed: false, locked: true };
    }
    return { allowed: true };
  } catch {
    return { allowed: false }; /* fail closed */
  }
}

/* reset attempt counter on successful auth */
async function clearSeerRateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const key = `seer:rl:${ip}`;
  await fetch(`${url}/del/${key}`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => {});
}

const SEER_COLUMNS = 'session_id,step,entry_step,interaction_type,selections,referrer,utm_source,device,country,completed,duration_seconds,created_at';

export default async function handler(req, res) {
  /* no-cache headers on every response — prevent CDN/proxy caching of auth'd data */
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  /* only POST allowed — password travels in body, never in headers or query params */
  if (req.method !== 'POST') return res.status(405).end();

  /* rate limit by IP — fail closed */
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
  const { allowed, locked } = await checkSeerRateLimit(ip);
  if (!allowed) return res.status(429).json({ error: locked ? 'too many attempts — try again later' : 'rate limit error' });

  /* guard: fail closed if SEER_PASSWORD is unset or empty */
  const expected = process.env.SEER_PASSWORD || '';
  if (!expected || expected.length < 8) {
    return res.status(500).json({ error: 'server misconfigured' });
  }

  /* extract password from request body */
  let bodyParsed;
  try {
    bodyParsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'bad request' });
  }
  const auth = String(bodyParsed?.password || '');

  /* password check — hash both sides to eliminate length leak, then timing-safe compare */
  let valid = false;
  try {
    const { timingSafeEqual, createHash } = await import('node:crypto');
    const hash = (s) => createHash('sha256').update(s).digest();
    valid = timingSafeEqual(hash(auth), hash(expected));
  } catch {
    /* fallback: manual constant-time XOR (no length leak, no short-circuit) */
    const a = Buffer.from(auth.padEnd(64, '\0'));
    const b = Buffer.from(expected.padEnd(64, '\0'));
    let diff = auth.length ^ expected.length;
    for (let i = 0; i < 64; i++) diff |= a[i] ^ b[i];
    valid = diff === 0;
  }
  if (!valid) return res.status(401).json({ error: 'forbidden' });

  /* clear attempt counter on success */
  await clearSeerRateLimit(ip);

  const action = bodyParsed?.action || 'data';
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  /* ── list_devices ── */
  if (action === 'list_devices') {
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/devices?select=device_token,name,first_seen,last_seen,last_country&order=last_seen.desc`,
        { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
      );
      if (!r.ok) return res.status(500).json({ error: 'db error' });
      return res.status(200).json({ devices: await r.json() });
    } catch (e) {
      console.error('list_devices error:', e);
      return res.status(500).json({ error: 'internal error' });
    }
  }

  /* ── rename_device ── */
  if (action === 'rename_device') {
    const deviceToken = String(bodyParsed?.device_token || '').trim();
    const name = String(bodyParsed?.name || '').trim().slice(0, 50);
    if (!deviceToken || !name) return res.status(400).json({ error: 'missing fields' });
    /* sanitise: only printable ascii */
    if (!/^[\x20-\x7E]+$/.test(name)) return res.status(400).json({ error: 'invalid name' });
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/devices?device_token=eq.${encodeURIComponent(deviceToken)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ name }),
        }
      );
      if (!r.ok) return res.status(500).json({ error: 'db error' });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('rename_device error:', e);
      return res.status(500).json({ error: 'internal error' });
    }
  }

  /* ── default: session data ── */

  /* pagination from body — 200 rows max */
  const limit = Math.min(Number(bodyParsed?.limit) || 200, 200);
  const offset = Math.max(Number(bodyParsed?.offset) || 0, 0);

  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/seen?select=${SEER_COLUMNS}&order=created_at.desc&limit=${limit}&offset=${offset}`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );

    if (!r.ok) {
      const err = await r.text();
      console.error('supabase read failed:', err);
      return res.status(500).json({ error: 'db error' });
    }

    const rows = await r.json();

    /* compute summary stats — exclude owner sessions */
    const realRows = rows.filter(r => !r.is_owner);
    const total = realRows.length;
    const completed = realRows.filter(r => r.completed).length;
    const abandoned = total - completed;

    const stepCounts = {};
    for (const row of realRows) {
      const s = row.step || 0;
      stepCounts[s] = (stepCounts[s] || 0) + 1;
    }

    const sources = {};
    for (const row of realRows) {
      const src = row.utm_source || row.referrer || 'direct';
      const key = src.includes('instagram') ? 'instagram'
        : src.includes('linkedin') ? 'linkedin'
        : src.includes('tiktok') ? 'tiktok'
        : src.includes('google') ? 'google'
        : src === 'direct' ? 'direct'
        : src;
      sources[key] = (sources[key] || 0) + 1;
    }

    const devices = {};
    for (const row of realRows) {
      const d = row.device || 'unknown';
      devices[d] = (devices[d] || 0) + 1;
    }

    const countries = {};
    for (const row of realRows) {
      const c = row.country || 'unknown';
      countries[c] = (countries[c] || 0) + 1;
    }

    const completedRows = realRows.filter(r => r.completed && r.duration_seconds > 0);
    const abandonedRows = realRows.filter(r => !r.completed && r.duration_seconds > 0);
    const avgDurationCompleted = completedRows.length
      ? Math.round(completedRows.reduce((a, r) => a + r.duration_seconds, 0) / completedRows.length)
      : 0;
    const avgDurationAbandoned = abandonedRows.length
      ? Math.round(abandonedRows.reduce((a, r) => a + r.duration_seconds, 0) / abandonedRows.length)
      : 0;

    return res.status(200).json({
      summary: { total, completed, abandoned, avgDurationCompleted, avgDurationAbandoned },
      stepCounts,
      sources,
      devices,
      countries,
      rows: realRows,
    });
  } catch (e) {
    console.error('seer endpoint error:', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
