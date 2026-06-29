/* ═══════════════════════════════════════════════════════
   press for goblins — query receipt → submitter
   env vars: RESEND_API_KEY, UPSTASH_REDIS_REST_URL,
             UPSTASH_REDIS_REST_TOKEN
   ═══════════════════════════════════════════════════════ */

import {
  escapeHtml, preheaderSpan, tearLine, eyesBlock,
  breathingZone, dotRow, dotRowHtml, obfuscateEmail, stampSvg, qrFooterBlock, outerShell, nowUtc,
} from './shared/interpress.js';

/* ── ref counter ── */
export async function makeRefNum() {
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/incr/pfg-query-counter`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const data = await res.json();
    return `#${String(data.result).padStart(4, '0')}`;
  } catch {
    return null;
  }
}

const FIELD_LABELS = {
  'writer-type': 'project',
  'service':     'here for',
  'genre':       'genre',
  'f-pitch':     'pitch',
  'f-title':     'project name',
  'f-name':      'name',
  'f-email':     'email',
  'f-message':   'anything else',
};

const FIELD_ORDER = [
  'gate', 'writer-type', 'service', 'genre',
  'f-pitch', 'f-title', 'f-name', 'f-email', 'f-message',
];

const GOBLIN_PROMPTS = {
  'gate':        { q: ['ew', 'a human', 'are you in need of goblins?'] },
  'writer-type': { q: ["what's the project?"] },
  'service':     { q: ['what do you need?'] },
  'genre':       { q: ["what's the genre?"] },
  'f-pitch':     { q: ["what's it about?", "we'll need enough to want more"] },
  'f-title':     { q: ['does it have a name?', 'if not, give us a working title, a comp or a one-liner', 'we need something to file this under'] },
  'f-name':      { q: ['what should we call you?'] },
  'f-email':     { q: ['where shall we send the verdict?'] },
  'f-message':   { q: ['is there anything else we should know?'] },
};

const REACTIONS = {
  gate: {
    yes: 'we can tell', obviously: "this one's spicy",
    'you have no idea': 'you do look pretty desperate', 'are you really goblins?': 'three of them',
  },
  'writer-type': {
    novel: 'you poor thing', 'comic or graphic novel': 'we bet you were really cool in school',
    'video game': 'we would destroy you at goblin kart', 'tabletop game': 'said no-one ever',
  },
  service: {
    'editorial assessment': 'standard goblin work', 'creative development': 'standard goblin work',
    'query/pitch feedback': 'the final boss', 'narrative direction': 'standard goblin work',
    writing: 'we like working to a good brief',
  },
  genre: {
    'sci-fi': 'good territory', fantasy: 'our natural habitat', horror: 'finally',
    romance: 'writing a good love story is harder than people think',
    'genre blend': 'it always is',
  },
};

function goblinRow(text) {
  return `<tr><td class="anim-goblin-row" style="background:#010101;padding:0 0 10px 0;" bgcolor="#000000"><span style="color:#89ce8d;font-family:'Courier New',Courier,monospace;font-size:15px;">&gt;</span><span class="anim-goblin-text" style="color:rgba(255,255,255,0.88);font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;"> ${escapeHtml(text)}</span></td></tr>`;
}
function userRow(text) {
  return `<tr><td class="anim-user-row" align="right" style="background:#010101;padding:0 0 18px 0;" bgcolor="#000000"><span style="color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;word-break:break-word;">${escapeHtml(text)}</span></td></tr>`;
}
function reactRow(text) {
  return `<tr><td class="anim-goblin-row" style="background:#010101;padding:0 0 18px 0;" bgcolor="#000000"><span style="color:#89ce8d;font-family:'Courier New',Courier,monospace;font-size:15px;">&gt;</span><span class="anim-goblin-text" style="color:rgba(255,255,255,0.88);font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;"> ${escapeHtml(text)}</span></td></tr>`;
}

function buildChatRows(answers) {
  return FIELD_ORDER
    .filter(k => answers[k] && GOBLIN_PROMPTS[k])
    .flatMap(k => {
      const rows = [];
      (GOBLIN_PROMPTS[k].q || []).forEach(q => rows.push(goblinRow(q)));
      const display = String(answers[k]);
      rows.push(userRow(display));
      const reaction = REACTIONS[k]?.[answers[k]];
      if (reaction) rows.push(reactRow(reaction));
      return rows;
    })
    .join('');
}

/* goblin-footnote with per-letter jiggly spans — matches preview exactly */
const GOBLIN_FOOTNOTE = `<tr><td class="anim-footnote" style="padding:0 0 24px 0;text-align:left;background:#010101;" bgcolor="#000000"><span style="display:block;font-family:'Courier New',Courier,monospace;font-style:normal;font-size:15px;color:rgba(255,255,255,0.88);line-height:1.6;letter-spacing:0.01em;"><sup style="font-size:11px;vertical-align:top;line-height:1;color:rgba(255,255,255,0.88);">*</sup>bonus points may be awarded for big questions, oscar wilde quotes and/or memorable dialogue</span></td></tr>`;

export function buildHtml(answers, refNum) {
  const { year, issuedStr } = nowUtc();
  const email = answers['f-email'] || '';
  const chatRows = buildChatRows(answers);

  /* ref number — right-aligned ghost text.
     MSO conditional: Special Elite loads via <link> which Outlook strips.
     non-MSO clients get Special Elite at 96px; Outlook gets Courier New at 64px. */
  const refBlock = `<tr>
    <td style="padding:0;text-align:right;background:#010101;" bgcolor="#000000">
      <!--[if !mso]><!-->
      <div class="anim-ref-num" style="font-family:'Special Elite','Courier New',Courier,monospace;font-size:80px;color:rgba(255,255,255,0.12);letter-spacing:0.04em;line-height:1;word-break:break-all;">${escapeHtml(refNum || '')}</div>
      <!--<![endif]-->
      <!--[if mso]>
      <div style="font-family:'Courier New',Courier,monospace;font-size:56px;color:rgba(255,255,255,0.12);letter-spacing:0.08em;line-height:1;word-break:break-all;">${escapeHtml(refNum || '')}</div>
      <![endif]-->
    </td>
  </tr>`;

  /* date-stamp centred above chat log */
  const dateStamp = `<tr><td style="padding:0 0 8px 0;text-align:center;background:#010101;" bgcolor="#000000"><span style="font-family:'Courier New',Courier,monospace;font-size:13px;font-weight:normal;color:rgba(255,255,255,0.55);letter-spacing:0.08em;line-height:1.5;">${escapeHtml(issuedStr)}</span></td></tr>`;

  /* receipt dot-leader rows: issued + email */
  const receiptRows = `<tr><td style="padding:0 0 32px 0;background:#010101;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0">
    ${dotRow('issued', issuedStr)}
    ${dotRowHtml('email', obfuscateEmail(email))}
  </table></td></tr>`;

  /* handwriting block: "we have received your query / expect our verdict within two weeks / you may reply to this receipt*" */
  const hwRows = `<tr>
    <td style="padding:0 0 32px 4px;text-align:left;background:#010101;" bgcolor="#000000">
      <p class="anim-hw" style="margin:0 0 5px 0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>we have received your query</p>
      <p class="anim-hw" style="margin:0 0 5px 0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>expect our verdict within two weeks</p>
      <p class="anim-hw" style="margin:0 0 5px 0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>that will be all, human</p>
      <p class="anim-hw anim-reply-line" style="margin:0;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;letter-spacing:0.03em;color:rgba(255,255,255,0.88);text-align:left;"><span style="display:inline;font-family:'Courier New',Courier,monospace;font-size:15px;color:#89ce8d;">&gt; </span>you may reply to this receipt<sup style="font-size:12px;vertical-align:top;line-height:1;color:rgba(255,255,255,0.88);">*</sup></p>
    </td>
  </tr>`;

  const inner = [
    /* 16px top breathing zone */
    breathingZone(16),
    /* eyes */
    eyesBlock(),
    /* 24px spacer */
    breathingZone(24),
    /* ref number */
    refBlock,
    /* 24px spacer + scissors tearline + 24px spacer */
    `<tr><td style="padding:0 0 24px 0;font-size:1px;line-height:1px;background:#010101;" bgcolor="#000000">&nbsp;</td></tr>`,
    tearLine(),
    /* handwriting */
    hwRows,
    /* 32px spacer */
    breathingZone(32),
    /* date stamp */
    dateStamp,
    /* 16px spacer */
    breathingZone(16),
    /* chat log */
    `<tr><td style="padding:0 0 36px 0;background:#010101;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0"><tbody>${chatRows}</tbody></table></td></tr>`,
    /* stamp */
    stampSvg({ topText: 'query received', midText: 'UNDER REVIEW', refNum, year, id: 'ru' }),
    breathingZone(36),
    /* goblin footnote */
    GOBLIN_FOOTNOTE,
    /* qr + address footer */
    qrFooterBlock(),
  ].join('\n');

  return outerShell({
    title: 'your message has reached the goblins',
    extraFonts: '',
    preheader: preheaderSpan('> expect our verdict within two weeks'),
    innerRows: inner,
  });
}

export function buildText(answers) {
  const name = answers['f-name'] || 'human';
  const lines = FIELD_ORDER
    .filter(k => answers[k])
    .flatMap(k => [`> ${FIELD_LABELS[k] || k}`, `  ${answers[k]}`, '']);
  return [
    `${name}, expect our verdict within two weeks`,
    '',
    'we have received your query',
    'you may reply to this receipt',
    '',
    ...lines,
    '',
    'pressforgoblins.com',
  ].join('\n');
}
