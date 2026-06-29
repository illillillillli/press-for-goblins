/* ═══════════════════════════════════════════════════════
   press for goblins — shared email scaffolding
   imported by receipt-user.js, receipt-notif.js,
   ticket-user.js, ticket-notif.js
   constants: insignia.js
   ═══════════════════════════════════════════════════════ */

import { ACCENT, SITE_URL, EYES_URL, QR_URL, ADDRESS_1, ADDRESS_2, FONT_BODY, FONT_DISPLAY } from './insignia.js';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── email address obfuscation ── */
/* splits "user@domain.com" across two <span> elements so iOS Mail / Gmail /
   Outlook cannot auto-detect it as a tappable mailto link.
   the zero-width joiner between the spans is invisible but breaks the regex. */
export function obfuscateEmail(email) {
  const safe = escapeHtml(email);
  const at = safe.indexOf('@');
  if (at === -1) return safe;
  const local = safe.slice(0, at);
  const domain = safe.slice(at + 1);
  return `<span style="unicode-bidi:embed;">${local}</span>&#8203;<span style="unicode-bidi:embed;">@${domain}</span>`;
}

/* ── preheader (invisible preview text) ── */
/* mso-hide:all suppresses in Word-based Outlook; no MSO conditional wrapper —
   that wrapper caused push notification extractors (iOS Mail, Gmail) to skip
   the span entirely and fall through to visible body text instead */
export function preheaderSpan(text) {
  const padding = '&zwnj;&nbsp;'.repeat(200);
  return `<div style="max-height:0;overflow:hidden;mso-hide:all;">\n<span style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;visibility:hidden;">${escapeHtml(text)}${padding}</span>\n</div>`;
}

/* ── ghost ref number header ── */
/* metaLine optional — shown below ref in admin emails only */
export function ghostHeader(refNum, metaLine) {
  const ref = `<div style="font-family:${FONT_DISPLAY};font-size:72px;color:rgba(255,255,255,0.12);letter-spacing:0.04em;line-height:1;word-break:break-all;">${escapeHtml(refNum || '')}</div>`;
  const meta = metaLine
    ? `<div style="font-family:${FONT_BODY};font-size:15px;font-weight:bold;color:rgba(255,255,255,0.12);letter-spacing:0.08em;line-height:1;margin-top:14px;padding-bottom:14px;">${escapeHtml(metaLine)}</div>`
    : '';
  return `<tr>
    <td style="padding:28px 0 0 0;text-align:right;background:#010101;" bgcolor="#000000">
      ${ref}${meta}
    </td>
  </tr>`;
}

/* ── tear line (25px spacer + dashed rule) ── */
export function tearLine() {
  return `<tr><td style="padding:0 0 25px 0;font-size:1px;line-height:1px;background:#010101;" bgcolor="#000000">&nbsp;</td></tr>
  <tr><td style="padding:0 0 32px 0;border-top:1px dashed rgba(255,255,255,0.18);font-size:1px;line-height:1px;background:#010101;" bgcolor="#000000">&nbsp;</td></tr>`;
}

/* ── eyes image block ── */
export function eyesBlock() {
  return `<tr>
    <td class="anim-eyes" style="padding:0;text-align:center;background:#010101;" align="center" bgcolor="#000000">
      <img src="${EYES_URL}" width="192" height="192" alt="" style="display:block;margin:0 auto;border:0;">
    </td>
  </tr>`;
}

/* ── breathing zone spacer ── */
export function breathingZone(px) {
  return `<tr><td style="padding:0 0 ${px}px 0;font-size:1px;line-height:1px;background:#010101;" bgcolor="#000000">&nbsp;</td></tr>`;
}

/* ── dot leader row: label · · · value ── */
export function dotRow(label, value) {
  const labelStyle = `font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.55);line-height:1.9;white-space:nowrap;padding-right:6px;`;
  const dotStyle   = `font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.2);line-height:1.9;width:100%;overflow:hidden;letter-spacing:2px;`;
  const valStyle   = `font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.55);line-height:1.9;white-space:nowrap;word-break:break-word;text-align:right;padding-left:6px;`;
  const dots = '· · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·';
  return `<tr>
    <td style="${labelStyle}background:#010101;" bgcolor="#000000">${escapeHtml(label)}</td>
    <td style="${dotStyle}background:#010101;" bgcolor="#000000">${dots}</td>
    <td style="${valStyle}background:#010101;" bgcolor="#000000">${escapeHtml(value)}</td>
  </tr>`;
}
/* like dotRow but accepts pre-rendered HTML for the value (e.g. obfuscated email) */
export function dotRowHtml(label, valueHtml) {
  const labelStyle = `font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.55);line-height:1.9;white-space:nowrap;padding-right:6px;`;
  const dotStyle   = `font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.2);line-height:1.9;width:100%;overflow:hidden;letter-spacing:2px;`;
  const valStyle   = `font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.55);line-height:1.9;white-space:nowrap;word-break:break-word;text-align:right;padding-left:6px;`;
  const dots = '· · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·';
  return `<tr>
    <td style="${labelStyle}background:#010101;" bgcolor="#000000">${escapeHtml(label)}</td>
    <td style="${dotStyle}background:#010101;" bgcolor="#000000">${dots}</td>
    <td style="${valStyle}background:#010101;" bgcolor="#000000">${valueHtml}</td>
  </tr>`;
}

/* ── ticket stub block: email centered white | asterisk rule | admitted on date+time ── */
/* email: bearer address. dateStr: e.g. "14 jun 2026". timeStr: e.g. "@ 20:00"          */
export function stubBlock(email, dateStr, timeStr) {
  /* asterisk row: always one star wider each side than the admitted line.
     admitted line is fixed-length monospace; calibrated count = 13 stars fits it,
     so we use 15 (13 + 1 each side). */
  return `<tr><td style="padding:0 0 36px 0;text-align:center;background:#010101;" bgcolor="#000000">
    <span style="display:block;font-family:${FONT_BODY};font-size:16px;font-weight:normal;color:#fff;letter-spacing:0.02em;white-space:nowrap;">${escapeHtml(email)}</span>
    <span style="display:block;margin-top:14px;font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.55);letter-spacing:0.04em;">${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span>
  </td></tr>`;
}

/* like stubBlock but accepts pre-rendered HTML for the email (e.g. obfuscated) */
export function stubBlockHtml(emailHtml, dateStr, timeStr) {
  return `<tr><td style="padding:0 0 36px 0;text-align:center;background:#010101;" bgcolor="#000000">
    <span style="display:block;font-family:${FONT_BODY};font-size:16px;font-weight:normal;color:#fff;letter-spacing:0.02em;white-space:nowrap;">${emailHtml}</span>
    <span style="display:block;margin-top:14px;font-family:${FONT_BODY};font-size:13px;color:rgba(255,255,255,0.55);letter-spacing:0.04em;">${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span>
  </td></tr>`;
}

/* ── stamp PNG — static image fallback (renders in Outlook iOS + all clients) ── */
/* src: full URL to hosted PNG. alt: accessible label. opacity: default 0.69. */
export function stampImg({ src, alt = 'stamp', opacity = 0.69 }) {
  return `<tr>
    <td style="padding:0;border-top:1px dashed rgba(255,255,255,0.18);border-bottom:1px dashed rgba(255,255,255,0.18);text-align:center;overflow:visible;background:#010101;" align="center" bgcolor="#000000">
      <img class="anim-stamp" src="${src}" width="260" height="200" alt="${alt}" style="display:block;margin:0 auto;border:0;opacity:${opacity};transform-origin:center;">
    </td>
  </tr>`;
}

/* ── stamp SVG — circular ink stamp (Apple Mail + WebKit only — Outlook strips SVG) ── */
/* topText: arc text top (e.g. 'query received' / 'field reports')
   midText: centre line (e.g. 'UNDER REVIEW' / 'ADMIT ONE')
   refNum:  shown below midText
   year:    shown above midText
   id:      unique filter id suffix (avoid SVG filter id collisions across emails) */
export function stampSvg({ topText, midText, refNum, year, id = 'a' }) {
  const sid = escapeHtml(id);
  return `<tr>
    <td style="padding:0;border-top:1px dashed rgba(255,255,255,0.18);border-bottom:1px dashed rgba(255,255,255,0.18);text-align:center;overflow:visible;background:#010101;" align="center" bgcolor="#000000">
      <svg aria-label="${escapeHtml(midText)}" viewBox="0 0 260 200" width="260" height="200" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;transform:rotate(-8deg);opacity:0.69;">
        <defs>
          <filter id="pfgSE${sid}" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="2" seed="42" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 8 -4" result="holes"/>
            <feComposite in="wobble" in2="holes" operator="out"/>
          </filter>
          <filter id="pfgTE${sid}" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="2" seed="42" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 -1.1" result="holes"/>
            <feComposite in="wobble" in2="holes" operator="out"/>
          </filter>
          <path id="pfgAT${sid}" d="M 113,100 A 57,57 0 0,1 227,100" fill="none" stroke="none" />
          <path id="pfgAB${sid}" d="M 107,100 A 63,63 0 0,0 233,100" fill="none" stroke="none" />
        </defs>
        <g filter="url(#pfgSE${sid})">
          <circle cx="170" cy="100" r="70" fill="none" stroke="${ACCENT}" stroke-width="1.5" />
          <line x1="101" y1="90" x2="239" y2="90" stroke="${ACCENT}" stroke-width="1.5" />
          <line x1="102" y1="116" x2="238" y2="116" stroke="${ACCENT}" stroke-width="1.5" />
        </g>
        <g filter="url(#pfgSE${sid})">
          <path d="M 15,65 C 42,57 68,73 95,65" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="12,4,8,3,20,5" />
          <path d="M 15,85 C 42,77 68,93 95,85" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="8,3,15,4,6,3" />
          <path d="M 15,105 C 42,97 68,113 95,105" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="15,5,6,3,12,4" />
          <path d="M 15,125 C 42,117 68,133 95,125" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="10,4,12,3,18,5" />
        </g>
        <g filter="url(#pfgTE${sid})">
          <text fill="${ACCENT}" font-family="${FONT_DISPLAY}" letter-spacing="3" font-size="11">
            <textPath href="#pfgAT${sid}" startOffset="50%" text-anchor="middle">${escapeHtml(topText)}</textPath>
          </text>
          <g fill="${ACCENT}" text-anchor="middle" font-family="${FONT_DISPLAY}">
            <text x="170" y="75" font-size="12" letter-spacing="5">${escapeHtml(String(year))}</text>
            <text x="170" y="108" font-size="12" letter-spacing="3.5">${escapeHtml(midText)}</text>
            <text x="170" y="138" font-size="12" letter-spacing="5">${escapeHtml(refNum || '')}</text>
          </g>
          <text fill="${ACCENT}" font-family="${FONT_DISPLAY}" letter-spacing="3" font-size="10">
            <textPath href="#pfgAB${sid}" startOffset="50%" text-anchor="middle">pressforgoblins</textPath>
          </text>
        </g>
      </svg>
    </td>
  </tr>`;
}

/* ── QR + footer block ── */
export function qrFooterBlock() {
  return `<tr class="anim-qr-footer">
    <td style="padding:0 0 28px 0;text-align:center;background:#010101;" bgcolor="#000000">
      <img src="${QR_URL}" width="240" height="240" alt="pressforgoblins.com" style="display:block;margin:0 auto 16px;border:0;">
      <p style="margin:0;color:rgba(255,255,255,0.4);font-family:${FONT_BODY};font-size:15px;line-height:1.8;font-style:normal;">Press for Goblins<sup style="font-size:7.65px;line-height:0;vertical-align:super;">TM</sup><br>${ADDRESS_1}<br><span style="white-space:nowrap;">${ADDRESS_2}</span><br><br><a href="${SITE_URL}" style="color:${ACCENT};font-family:${FONT_BODY};font-size:15px;text-decoration:none;">pressforgoblins.com</a></p>
    </td>
  </tr>`;
}

/* ── outer HTML shell — wraps everything ── */
/* title: <title> tag text
   extraFonts: additional Google Fonts href fragment ('' if none)
   innerRows: assembled <tr> blocks for the inner table */
export function outerShell({ title, extraFonts = '', innerRows, preheader = '' }) {
  const families = `Special+Elite${extraFonts}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=${families}&display=swap');
    /* clients that support <style> hide the terminal-fallback arrow spans */
    .hw-arrow { display:none !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:#010101;font-family:${FONT_BODY};" bgcolor="#000000">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#010101;" bgcolor="#000000">
    <tr>
      <td style="padding:32px 16px;background:#010101;" align="center" bgcolor="#000000">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;border:1px dashed rgba(255,255,255,0.18);background:#010101;" bgcolor="#000000">
          <tr><td style="padding:0 28px;background:#010101;" bgcolor="#000000">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${innerRows}
            </table>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── date/time helpers ── */
export function nowUtc() {
  const now = new Date();
  const day   = String(now.getUTCDate()).padStart(2, '0');
  const month = now.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toLowerCase();
  const year  = now.getUTCFullYear();
  const hrs   = String(now.getUTCHours()).padStart(2, '0');
  const mins  = String(now.getUTCMinutes()).padStart(2, '0');
  return { day, month, year, hrs, mins,
    dateStr: `${day} ${month} ${year}`,
    timeStr: `${hrs}:${mins}`,
    issuedStr: `${day} ${month} ${year} @ ${hrs}:${mins}`,
  };
}

/* ── body text block (Courier New — matches goblin chat messages) ── */
/* lines: array of strings. last line gets margin:0. */
export function hwBlock(lines) {
  const baseStyle = `font-family:${FONT_BODY};font-size:16px;line-height:1.6;letter-spacing:0.03em;color:${ACCENT};text-align:left;`;
  const rows = lines.map((line, i) => {
    const margin = i < lines.length - 1 ? 'margin:0 0 5px 0;' : 'margin:0;';
    /* last line may contain a superscript asterisk — passed as raw HTML */
    return `<p class="anim-hw" style="${margin}${baseStyle}">${line}</p>`;
  }).join('\n');
  return `<tr>
    <td style="padding:0 0 32px 4px;text-align:left;background:#010101;" bgcolor="#000000">
      ${rows}
    </td>
  </tr>`;
}
