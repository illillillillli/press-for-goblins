/* ═══════════════════════════════════════════════════════
   press for goblins — /api/seer (Vercel endpoint)
   returns session data for the seer dashboard
   env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
             SEER_PASSWORD
   ═══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  /* no-cache headers on every response — prevent CDN/proxy caching of auth'd data */
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  /* only POST allowed — password travels in body, never in headers or query params */
  if (req.method !== 'POST') return res.status(405).end();

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

  /* pagination from body — 200 rows max */
  const limit = Math.min(Number(bodyParsed?.limit) || 200, 200);
  const offset = Math.max(Number(bodyParsed?.offset) || 0, 0);

  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/seen?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!r.ok) {
      const err = await r.text();
      console.error('supabase read failed:', err);
      return res.status(500).json({ error: 'db error' });
    }

    const rows = await r.json();

    /* compute summary stats */
    const total = rows.length;
    const completed = rows.filter(r => r.completed).length;
    const abandoned = total - completed;

    /* step drop-off */
    const stepCounts = {};
    for (const row of rows) {
      const s = row.step || 0;
      stepCounts[s] = (stepCounts[s] || 0) + 1;
    }

    /* source breakdown */
    const sources = {};
    for (const row of rows) {
      const src = row.utm_source || row.referrer || 'direct';
      const key = src.includes('instagram') ? 'instagram'
        : src.includes('linkedin') ? 'linkedin'
        : src.includes('tiktok') ? 'tiktok'
        : src.includes('google') ? 'google'
        : src === 'direct' ? 'direct'
        : src;
      sources[key] = (sources[key] || 0) + 1;
    }

    /* device breakdown */
    const devices = {};
    for (const row of rows) {
      const d = row.device || 'unknown';
      devices[d] = (devices[d] || 0) + 1;
    }

    /* country breakdown */
    const countries = {};
    for (const row of rows) {
      const c = row.country || 'unknown';
      countries[c] = (countries[c] || 0) + 1;
    }

    /* avg duration split: completed vs abandoned */
    const completedRows = rows.filter(r => r.completed && r.duration_seconds > 0);
    const abandonedRows = rows.filter(r => !r.completed && r.duration_seconds > 0);
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
      rows,
    });
  } catch (e) {
    console.error('seer endpoint error:', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
