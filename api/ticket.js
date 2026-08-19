/* ═══════════════════════════════════════════════════════
   press for goblins - /api/ticket (vercel endpoint)
   orchestrates user ticket + admin notification
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import { buildHtml as userHtml, buildText as userText } from './ticket-user.js';
import { buildHtml as notifHtml, buildText as notifText } from './ticket-notif.js';
import {
  clientIp, enforceEmailLimits, loadSubmission, parseBoundedBody,
  parseProviderResponse, prepareFormRequest, saveSubmission, storeSubscriber,
  submissionFingerprint, validateFields,
} from '../shared/form-security.mjs';

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

export default async function handler(req, res) {
  if (!prepareFormRequest(req, res)) return;

  let body;
  try {
    body = validateFields(parseBoundedBody(req), 'ticket');
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'bad request' });
  }

  const { email, '_gotcha': gotcha, _submissionId: submissionId } = body;
  if (gotcha) return res.status(400).json({ error: 'bad request' });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'missing api credentials' });

  const NOAH_EMAILS = [
    'noahsamuelgrey@icloud.com', 'noahsamuelgrey@gmail.com',
    'noahsamuelgrey@outlook.com', 'noahsavestheworld@outlook.com',
    'no.grey@outlook.com', 'illillillilll@outlook.com',
    'noah.grey@hachettechildrens.co.uk', 'noah@pressforgoblins.com',
    'hello@pressforgoblins.com',
  ];
  const isTestAddress = NOAH_EMAILS.includes(email);
  const fingerprint = submissionFingerprint('ticket', body);
  let state;
  try {
    state = await loadSubmission('ticket', submissionId);
    if (state && state.fingerprint !== fingerprint) return res.status(409).json({ error: 'submission id conflict' });
    if (!state) {
      const allowed = await enforceEmailLimits('ticket', clientIp(req), email);
      if (!allowed) return res.status(429).json({ error: 'too many requests' });
      const refNum = isTestAddress ? '#0000' : await makeSignupRef();
      state = {
        fingerprint,
        refNum,
        acceptedAt: new Date().toISOString(),
        subscriberPersisted: false,
        admin: { accepted: false, providerId: null },
        user: { accepted: false, providerId: null },
      };
      await saveSubmission('ticket', submissionId, state);
    }
    if (!state.subscriberPersisted) {
      if (!isTestAddress) await storeSubscriber(email);
      state.subscriberPersisted = true;
      await saveSubmission('ticket', submissionId, state);
    }
  } catch (error) {
    console.error('ticket persistence error:', error?.message || error);
    return res.status(503).json({ error: 'service temporarily unavailable' });
  }

  const refNum = state.refNum;

  const send = (payload, idempotencyKey) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!state.user.accepted) {
    const result = await parseProviderResponse(await send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: [email],
      subject: 'Field Reports [+1]',
      html: userHtml(email, refNum),
      text: userText(),
    }, `pfg-ticket-user-${submissionId}`));
    state.user = { accepted: result.ok, providerId: result.id };
    await saveSubmission('ticket', submissionId, state);
    if (!result.ok) {
      console.error('Resend user ticket error:', result.error || 'unknown');
      return res.status(502).json({ error: 'email service unavailable', retryable: true });
    }
  }

  if (!state.admin.accepted) {
    const result = await parseProviderResponse(await send({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: ['hello@pressforgoblins.com'],
      subject: refNum ? `Field Reports [${refNum}]` : 'Field Reports',
      html: notifHtml(email, refNum),
      text: notifText(email, refNum),
    }, `pfg-ticket-admin-${submissionId}`));
    state.admin = { accepted: result.ok, providerId: result.id };
    await saveSubmission('ticket', submissionId, state);
    if (!result.ok) {
      console.error('Resend admin ticket error:', result.error || 'unknown');
      return res.status(502).json({ error: 'email service unavailable', retryable: true });
    }
  }

  return res.status(200).json({
    ok: true,
    ref: refNum,
    accepted: { admin: state.admin.providerId, user: state.user.providerId },
    subscriberPersisted: state.subscriberPersisted,
  });
}
