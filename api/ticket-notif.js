/* ═══════════════════════════════════════════════════════
   press for goblins — field notes notification → admin
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import {
  escapeHtml, preheaderSpan, tearLine, eyesBlock,
  breathingZone, obfuscateEmail, stampSvg, qrFooterBlock, outerShell, nowUtc,
} from './shared/interpress.js';

export function buildHtml(email, refNum) {
  const { year, dateStr, timeStr } = nowUtc();

  /* ref number — right-aligned ghost text.
     MSO conditional: Special Elite loads via <link> which Outlook strips.
     non-MSO clients get Special Elite. Outlook gets clean Courier New fallback. */
  const refBlock = `<tr>
    <td style="padding:0;text-align:right;background:#010101;" bgcolor="#000000">
      <!--[if !mso]><!-->
      <div style="font-family:'Special Elite','Courier New',Courier,monospace;font-size:80px;color:rgba(255,255,255,0.12);letter-spacing:0.04em;line-height:1;word-break:break-all;">${escapeHtml(refNum || '')}</div>
      <!--<![endif]-->
      <!--[if mso]>
      <div style="font-family:'Courier New',Courier,monospace;font-size:56px;color:rgba(255,255,255,0.12);letter-spacing:0.08em;line-height:1;word-break:break-all;">${escapeHtml(refNum || '')}</div>
      <![endif]-->
    </td>
  </tr>`;

  /* email block — split across two spans so iOS Mail / Gmail / Outlook don't auto-linkify */
  const receiptRows = `<tr><td style="padding:0 0 36px 0;text-align:center;background:#010101;" bgcolor="#000000">
    <span style="display:block;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:normal;color:#ffffff;letter-spacing:0.02em;white-space:nowrap;">${obfuscateEmail(email)}</span>
    <span style="display:block;margin-top:14px;font-family:'Courier New',Courier,monospace;font-size:13px;color:rgba(255,255,255,0.55);letter-spacing:0.04em;">${escapeHtml(dateStr)} @ ${escapeHtml(timeStr)}</span>
  </td></tr>`;

  const inner = [
    /* 16px top breathing zone */
    breathingZone(16),
    /* eyes */
    eyesBlock(),
    /* 24px spacer */
    breathingZone(24),
    /* ref number */
    refBlock,
    /* 24px spacer before tearline — aligned with all other emails */
    `<tr><td style="padding:0 0 24px 0;font-size:1px;line-height:1px;background:#010101;" bgcolor="#000000">&nbsp;</td></tr>`,
    tearLine(),
    /* 16px zone-1 spacer */
    breathingZone(16),
    /* stub block */
    receiptRows,
    /* stamp — SVG ink stamp */
    stampSvg({ topText: 'field reports', midText: 'ADMIT ONE', refNum, year, id: 'tn' }),
    breathingZone(36),
    /* qr + address footer — no goblin-footnote on admin notif */
    qrFooterBlock(),
  ].join('\n');

  return outerShell({
    title: 'field notes signup — press for goblins',
    preheader: preheaderSpan(email),
    innerRows: inner,
  });
}

export function buildText(email, refNum) {
  return `${email}\n\nref: ${refNum || ''}\n`;
}
