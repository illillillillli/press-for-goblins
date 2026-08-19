/* ═══════════════════════════════════════════════════════
   press for goblins — /api/receipt (Vercel endpoint)
   orchestrates both user receipt + admin notification
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import { buildHtml as userHtml, buildText as userText, makeRefNum } from './receipt-user.js';
import { buildHtml as notifHtml, buildText as notifText } from './receipt-notif.js';
import {
  clientIp, enforceEmailLimits, loadSubmission, parseBoundedBody,
  parseProviderResponse, prepareFormRequest, saveSubmission,
  submissionFingerprint, validateFields,
} from '../shared/form-security.mjs';

export default async function handler(req, res) {
  if (!prepareFormRequest(req, res)) return;

  let answers;
  try {
    answers = validateFields(parseBoundedBody(req), 'receipt');
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'bad request' });
  }

  /* honeypot — bots fill every field, humans don't see this one */
  if (answers['_gotcha']) return res.status(400).json({ error: 'bad request' });

  const email = answers['f-email'];
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'email service not configured' });

  const NOAH_EMAILS = [
    'noahsamuelgrey@icloud.com', 'noahsamuelgrey@gmail.com',
    'noahsamuelgrey@outlook.com', 'noahsavestheworld@outlook.com',
    'no.grey@outlook.com', 'illillillilll@outlook.com',
    'noah.grey@hachettechildrens.co.uk', 'noah@pressforgoblins.com',
    'hello@pressforgoblins.com',
  ];
  const submissionId = answers._submissionId;
  const fingerprint = submissionFingerprint('receipt', answers);
  let state;
  try {
    state = await loadSubmission('receipt', submissionId);
    if (state && state.fingerprint !== fingerprint) return res.status(409).json({ error: 'submission id conflict' });
    if (!state) {
      const allowed = await enforceEmailLimits('receipt', clientIp(req), email);
      if (!allowed) return res.status(429).json({ error: 'too many requests' });
      const refNum = NOAH_EMAILS.includes(email) ? '#0000' : await makeRefNum();
      state = {
        fingerprint,
        refNum,
        acceptedAt: new Date().toISOString(),
        submission: answers,
        admin: { accepted: false, providerId: null },
        user: { accepted: false, providerId: null },
      };
      await saveSubmission('receipt', submissionId, state);
    }
  } catch (error) {
    console.error('receipt persistence error:', error?.message || error);
    return res.status(503).json({ error: 'service temporarily unavailable' });
  }

  const refNum = state.refNum;
  const rawTitle = answers['f-title'] || answers['genre'] || answers['service'] || 'unknown';
  const title = rawTitle.replace(/\b\w/g, c => c.toUpperCase());

  const send = (payload, idempotencyKey) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!state.admin.accepted) {
    const result = await parseProviderResponse(await send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: ['hello@pressforgoblins.com'],
      subject: refNum ? `${title} [${refNum}]` : title,
      html: notifHtml(answers, refNum),
      text: notifText(answers),
    }, `pfg-receipt-admin-${submissionId}`));
    state.admin = { accepted: result.ok, providerId: result.id };
    await saveSubmission('receipt', submissionId, state);
    if (!result.ok) {
      console.error('Resend admin receipt error:', result.error || 'unknown');
      return res.status(502).json({ error: 'email service unavailable', retryable: true });
    }
  }

  if (!state.user.accepted) {
    const result = await parseProviderResponse(await send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: [email],
      subject: `${title} [We Have It]`,
      html: userHtml(answers, refNum),
      text: userText(answers),
    }, `pfg-receipt-user-${submissionId}`));
    state.user = { accepted: result.ok, providerId: result.id };
    await saveSubmission('receipt', submissionId, state);
    if (!result.ok) {
      console.error('Resend user receipt error:', result.error || 'unknown');
      return res.status(502).json({ error: 'email service unavailable', retryable: true });
    }
  }

  return res.status(200).json({
    ok: true,
    ref: refNum,
    accepted: { admin: state.admin.providerId, user: state.user.providerId },
    html: userHtml(answers, refNum),
  });
}
