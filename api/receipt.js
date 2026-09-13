/* ═══════════════════════════════════════════════════════
   press for goblins - /api/receipt (vercel endpoint)
   orchestrates both user receipt + admin notification
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import { buildHtml as userHtml, buildText as userText, makeRefNum } from '../shared/receipt-user.mjs';
import { buildHtml as notifHtml, buildText as notifText } from '../shared/receipt-notif.mjs';
import {
  clientIp, enforceEmailLimits, loadSubmission, parseBoundedBody,
  isConfiguredTestAddress, prepareFormRequest, saveSubmission,
  sendProviderEmail, submissionFingerprint, validateFields,
} from '../shared/form-security.mjs';

export default async function handler(req, res) {
  if (!prepareFormRequest(req, res)) return;

  let answers;
  try {
    answers = validateFields(parseBoundedBody(req), 'receipt');
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'bad request' });
  }

  /* honeypot - bots fill every field, humans don't see this one */
  if (answers['_gotcha']) return res.status(400).json({ error: 'bad request' });

  const email = answers['f-email'];
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'email service not configured' });

  const submissionId = answers._submissionId;
  const fingerprint = submissionFingerprint('receipt', answers);
  let state;
  try {
    state = await loadSubmission('receipt', submissionId);
    if (state && state.fingerprint !== fingerprint) return res.status(409).json({ error: 'submission id conflict' });
    if (!state) {
      const allowed = await enforceEmailLimits('receipt', clientIp(req), email);
      if (!allowed) return res.status(429).json({ error: 'too many requests' });
      const refNum = isConfiguredTestAddress(email) ? '#0000' : await makeRefNum();
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

  if (!state.admin.accepted) {
    const result = await sendProviderEmail(apiKey, {
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: ['hello@pressforgoblins.com'],
      subject: refNum ? `${title} [${refNum}]` : title,
      html: notifHtml(answers, refNum),
      text: notifText(answers),
    }, `pfg-receipt-admin-${submissionId}`);
    state.admin = { accepted: result.ok, providerId: result.id };
    await saveSubmission('receipt', submissionId, state);
    if (!result.ok) {
      console.error('Resend admin receipt error:', result.error || 'unknown');
      return res.status(502).json({ error: 'email service unavailable', retryable: true });
    }
  }

  if (!state.user.accepted) {
    const result = await sendProviderEmail(apiKey, {
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: [email],
      subject: `${title} [We Have It]`,
      html: userHtml(answers, refNum),
      text: userText(answers),
    }, `pfg-receipt-user-${submissionId}`);
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
