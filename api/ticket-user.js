/* ═══════════════════════════════════════════════════════
   press for goblins — field notes ticket → subscriber
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import {
  escapeHtml, preheaderSpan, tearLine, eyesBlock,
  breathingZone, stubBlockHtml, obfuscateEmail, stampSvg, qrFooterBlock, outerShell, nowUtc,
} from './shared/interpress.js';

/* goblin-footnote — same text as receipt-user */
const GOBLIN_FOOTNOTE = `<tr><td style="padding:0 0 24px 0;text-align:left;background:#010101;" bgcolor="#000000"><span style="display:block;font-family:'Courier New',Courier,monospace;font-style:normal;font-size:15px;color:rgba(255,255,255,0.88);line-height:1.6;letter-spacing:0.01em;"><sup style="font-size:11px;vertical-align:top;line-height:1;color:rgba(255,255,255,0.88);">*</sup>bonus points may be awarded for big questions, oscar wilde quotes and/or memorable dialogue</span></td></tr>`;

export function buildHtml(email, refNum) {
  const { year, dateStr, timeStr } = nowUtc();

  /* ref number — right-aligned ghost text.
     MSO conditional: Special Elite loads via <link> which Outlook strips.
     non-MSO clients (Apple Mail, Gmail, iOS) get Special Elite.
     Outlook gets a clean Courier New fallback at a smaller size. */
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

  /* handwriting block: "we have approved your request / expect occasional field reports / you may reply to this ticket*"
     .hw-arrow spans are hidden by <style> block in supporting clients; visible in Outlook (no <style> support) as terminal fallback */
  const hwRows = `<tr>
    <td style="padding:0 0 32px 4px;text-align:left;background:#010101;" bgcolor="#000000">
      <p class="anim-hw" style="margin:0 0 5px 0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>we have approved your request</p>
      <p class="anim-hw" style="margin:0 0 5px 0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>expect occasional field reports</p>
      <p class="anim-hw anim-reply-line" style="margin:0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>you may reply to this ticket<sup style="font-size:12px;vertical-align:top;line-height:1;color:rgba(255,255,255,0.88);">*</sup></p>
    </td>
  </tr>`;

  /* stub block: email obfuscated so iOS Mail doesn't auto-link it */
  const receiptRows = stubBlockHtml(obfuscateEmail(email), dateStr, `@ ${timeStr}`);

  const inner = [
    /* 16px top breathing zone */
    breathingZone(16),
    /* eyes */
    eyesBlock(),
    /* 24px spacer */
    breathingZone(24),
    /* ref number */
    refBlock,
    /* 24px spacer + scissors tearline */
    `<tr><td style="padding:0 0 24px 0;font-size:1px;line-height:1px;background:#010101;" bgcolor="#000000">&nbsp;</td></tr>`,
    tearLine(),
    /* handwriting */
    hwRows,
    /* stub block */
    receiptRows,
    /* stamp — SVG ink stamp */
    stampSvg({ topText: 'field reports', midText: 'ADMIT ONE', refNum, year, id: 'tu' }),
    breathingZone(36),
    /* goblin footnote */
    GOBLIN_FOOTNOTE,
    /* qr + address footer */
    qrFooterBlock(),
  ].join('\n');

  return outerShell({
    title: 'field notes — press for goblins',
    extraFonts: '',
    preheader: preheaderSpan('> expect occasional field reports'),
    innerRows: inner,
  });
}

export function buildText() {
  return [
    'Expect occasional field reports',
    '',
    '> we have approved your request',
    '> you will receive occasional notes from the field',
    '> that will be all, human',
    '',
    'pressforgoblins.com',
  ].join('\n');
}
