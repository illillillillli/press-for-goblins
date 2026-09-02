export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'POST') return sendLogin(req, res);
  if (req.method !== 'GET') return res.status(405).end();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'unavailable' });
  return res.status(200).json({ url, key });
}

const ALLOWED_ORIGINS = new Set(['https://pressforgoblins.com', 'https://www.pressforgoblins.com']);

async function sendLogin(req, res) {
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
