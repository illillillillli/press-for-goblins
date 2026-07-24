/* ═══════════════════════════════════════════════════════
   press for goblins — /api/ticket (Vercel endpoint)
   orchestrates user ticket + admin notification
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import { buildHtml as userHtml, buildText as userText } from './ticket-user.js';
import { buildHtml as notifHtml, buildText as notifText } from './ticket-notif.js';

async function makeSignupRef() {
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/incr/pfg-signup-counter`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const data = await res.json();
    return `#${String(data.result).padStart(4, '0')}`;
  } catch {
    return null;
  }
}

/* ── rate limiter (upstash-backed, fail-closed) ── */
async function isRateLimited(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  const key = `ticket:rl:${ip}`;
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 3600, 'NX'],
      ]),
    });
    const data = await r.json();
    const count = data?.[0]?.result ?? 0;
    return count > 20;
  } catch {
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const allowed = [
    'https://pressforgoblins.com',
    'https://www.pressforgoblins.com',
  ];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '';
  if (await isRateLimited(ip)) return res.status(429).json({ error: 'too many requests' });

  const { email, '_gotcha': gotcha } = req.body || {};
  if (gotcha) return res.status(400).json({ error: 'bad request' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'missing api credentials' });

  const NOAH_EMAILS = [
    'noahsamuelgrey@icloud.com', 'noahsamuelgrey@gmail.com',
    'noahsamuelgrey@outlook.com', 'noahsavestheworld@outlook.com',
    'no.grey@outlook.com', 'illillillilll@outlook.com',
    'noah.grey@hachettechildrens.co.uk', 'noah@pressforgoblins.com',
    'hello@pressforgoblins.com',
  ];
  const refNum = NOAH_EMAILS.includes(email.toLowerCase()) ? '#0000' : await makeSignupRef();

  const send = (payload) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  /* store subscriber in Upstash (sadd = no duplicates) */
  if (!NOAH_EMAILS.includes(email.toLowerCase())) {
    fetch(`${process.env.UPSTASH_REDIS_REST_URL}/sadd/pfg-subscribers/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    }).catch(() => {}); /* fire-and-forget — don't block on this */
  }

  const [userRes, notifRes] = await Promise.all([
    send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: [email],
      subject: 'Field Reports [+1]',
      html: userHtml(email, refNum),
      text: userText(),
    }),
    send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: ['hello@pressforgoblins.com'],
      subject: refNum ? `Field Reports [${refNum}]` : 'Field Reports',
      html: notifHtml(email, refNum),
      text: notifText(email, refNum),
    }),
  ]);

  if (!userRes.ok) {
    const err = await userRes.text().catch(() => '');
    console.error('Resend user email error:', err);
    return res.status(200).json({ ok: true, emailSent: false });
  }

  return res.status(200).json({ ok: true, ref: refNum });
}
