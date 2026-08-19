import { createHash } from 'node:crypto';

export const ALLOWED_ORIGINS = new Set([
  'https://pressforgoblins.com',
  'https://www.pressforgoblins.com',
]);

const BODY_LIMIT = 12 * 1024;
const SUBMISSION_TTL = 60 * 60 * 24 * 14;

export function prepareFormRequest(req, res) {
  const origin = String(req.headers.origin || '');
  if (!ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return false;
  }
  return true;
}

export function parseBoundedBody(req) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (Buffer.byteLength(raw, 'utf8') > BODY_LIMIT) {
    const error = new Error('payload too large');
    error.status = 413;
    throw error;
  }
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    const error = new Error('invalid json');
    error.status = 400;
    throw error;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('invalid body');
    error.status = 400;
    throw error;
  }
  return body;
}

const RECEIPT_LIMITS = {
  gate: 80,
  'writer-type': 160,
  service: 160,
  genre: 160,
  'f-pitch': 2400,
  'f-title': 240,
  'f-name': 160,
  'f-email': 254,
  'f-message': 4000,
  terms: 80,
  'terms-concern': 1200,
  _gotcha: 200,
  _submissionId: 64,
};

const TICKET_LIMITS = { email: 254, _gotcha: 200, _submissionId: 64 };

export function validateFields(body, kind) {
  const limits = kind === 'receipt' ? RECEIPT_LIMITS : TICKET_LIMITS;
  for (const [key, value] of Object.entries(body)) {
    if (!(key in limits) || typeof value !== 'string' || value.length > limits[key]) {
      const error = new Error('invalid fields');
      error.status = 400;
      throw error;
    }
  }
  const emailKey = kind === 'receipt' ? 'f-email' : 'email';
  const email = String(body[emailKey] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    const error = new Error('missing or invalid email');
    error.status = 400;
    throw error;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body._submissionId || '')) {
    const error = new Error('invalid submission id');
    error.status = 400;
    throw error;
  }
  if (kind === 'receipt' && /[\r\n]/.test(body['f-title'] || '')) {
    const error = new Error('invalid title');
    error.status = 400;
    throw error;
  }
  return { ...body, [emailKey]: email };
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('redis not configured');
  return { url, token };
}

async function pipeline(commands) {
  const { url, token } = redisConfig();
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error('redis unavailable');
  const results = await response.json();
  if (!Array.isArray(results) || results.some(result => result?.error)) throw new Error('redis command failed');
  return results.map(result => result?.result);
}

export async function enforceEmailLimits(kind, ip, email) {
  const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 24);
  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `pfg:${kind}:ip:${ip}`;
  const recipientKey = `pfg:${kind}:recipient:${emailHash}`;
  const globalKey = `pfg:${kind}:global:${day}`;
  const results = await pipeline([
    ['INCR', ipKey], ['EXPIRE', ipKey, 3600, 'NX'],
    ['INCR', recipientKey], ['EXPIRE', recipientKey, 86400, 'NX'],
    ['INCR', globalKey], ['EXPIRE', globalKey, 172800, 'NX'],
  ]);
  const ipCount = Number(results[0] || 0);
  const recipientCount = Number(results[2] || 0);
  const globalCount = Number(results[4] || 0);
  return ipCount <= 10 && recipientCount <= 4 && globalCount <= 100;
}

export function submissionFingerprint(kind, body) {
  const stable = Object.keys(body).sort().reduce((copy, key) => {
    if (key !== '_gotcha') copy[key] = body[key];
    return copy;
  }, {});
  return createHash('sha256').update(`${kind}:${JSON.stringify(stable)}`).digest('hex');
}

export async function loadSubmission(kind, id) {
  const [raw] = await pipeline([['GET', `pfg:${kind}:submission:${id}`]]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error('invalid submission state'); }
}

export async function saveSubmission(kind, id, state) {
  await pipeline([['SET', `pfg:${kind}:submission:${id}`, JSON.stringify(state), 'EX', SUBMISSION_TTL]]);
}

export async function storeSubscriber(email) {
  await pipeline([['SADD', 'pfg-subscribers', email]]);
}

export function clientIp(req) {
  return req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';
}

export async function parseProviderResponse(response) {
  let data = null;
  try { data = await response.json(); } catch { /* provider returned no JSON */ }
  return { ok: response.ok, id: data?.id || null, error: data?.message || data?.name || null };
}
