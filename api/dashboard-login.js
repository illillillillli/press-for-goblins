const ALLOWED_ORIGINS = new Set(['https://pressforgoblins.com', 'https://www.pressforgoblins.com']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).end();
  if (!ALLOWED_ORIGINS.has(req.headers.origin || '')) return res.status(403).end();

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const owner = (process.env.DASHBOARD_OWNER_EMAIL || '').trim().toLowerCase();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!owner || email !== owner) return res.status(204).end();
  if (!url || !key) return res.status(503).end();

  try {
    const upstream = await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent('https://pressforgoblins.com/dashboard')}`, {
      method: 'POST',
      headers: { apikey:key, 'Content-Type':'application/json' },
      body: JSON.stringify({ email, create_user:false }),
    });
    return res.status(upstream.ok ? 204 : 503).end();
  } catch {
    return res.status(503).end();
  }
}
