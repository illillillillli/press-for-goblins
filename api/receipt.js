/* ═══════════════════════════════════════════════════════
   press for goblins — /api/receipt (Vercel endpoint)
   orchestrates both user receipt + admin notification
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import { buildHtml as userHtml, buildText as userText, makeRefNum } from './receipt-user.js';
import { buildHtml as notifHtml, buildText as notifText } from './receipt-notif.js';

/* ── rate limiter (upstash-backed, fail-closed) ── */
async function isRateLimited(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; /* fail closed if not configured */
  const key = `receipt:rl:${ip}`;
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
    return true; /* fail closed */
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

  let answers;
  try {
    answers = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'invalid json' });
  }

  /* honeypot — bots fill every field, humans don't see this one */
  if (answers['_gotcha']) return res.status(400).json({ error: 'bad request' });

  const email = answers['f-email'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'missing or invalid email' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'email service not configured' });

  const NOAH_EMAILS = [
    'noahsamuelgrey@icloud.com', 'noahsamuelgrey@gmail.com',
    'noahsamuelgrey@outlook.com', 'noahsavestheworld@outlook.com',
    'no.grey@outlook.com', 'illillillilll@outlook.com',
    'noah.grey@hachettechildrens.co.uk', 'noah@pressforgoblins.com',
    'hello@pressforgoblins.com',
  ];
  const refNum = NOAH_EMAILS.includes(email.toLowerCase()) ? '#0000' : await makeRefNum();
  const rawTitle = answers['f-title'] || answers['genre'] || answers['service'] || 'unknown';
  const title = rawTitle.replace(/\b\w/g, c => c.toUpperCase());

  const send = (payload) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const [notifRes, receiptRes] = await Promise.all([
    send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: ['hello@pressforgoblins.com'],
      subject: refNum ? `${title} [${refNum}]` : title,
      html: notifHtml(answers, refNum),
      text: notifText(answers),
    }),
    send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: [email],
      subject: `${title} [We Have It]`,
      html: userHtml(answers, refNum),
      text: userText(answers),
    }),
  ]);

  if (!notifRes.ok || !receiptRes.ok) {
    const err = await (notifRes.ok ? receiptRes : notifRes).text();
    console.error('Resend error:', err);
    return res.status(502).json({ error: 'email delivery failed' });
  }

  return res.status(200).json({ ok: true, ref: refNum, html: userHtml(answers, refNum) });
}
