/* ═══════════════════════════════════════════════════════
   press for goblins — form submission endpoint
   Vercel serverless function. receives form data, sends
   a confirmation email via Resend to the user.

   env vars required (set in Vercel dashboard):
     RESEND_API_KEY  — from resend.com
   ═══════════════════════════════════════════════════════ */

const FIELD_LABELS = {
  'writer-type': 'project type',
  'service':     'service',
  'genre':       'genre',
  'stage':       'stage',
  'wordcount':   'word count',
  'f-pitch':     'pitch',
  'f-name':      'name',
  'f-email':     'email',
  'f-message':   'anything else',
};

const FIELD_ORDER = [
  'writer-type', 'service', 'genre', 'stage',
  'wordcount', 'f-pitch', 'f-name', 'f-email', 'f-message',
];

function buildEmailHtml(answers) {
  const rows = FIELD_ORDER
    .filter(k => answers[k])
    .map(k => `
      <tr>
        <td style="padding:6px 16px 6px 0;color:#888;font-size:12px;text-transform:lowercase;white-space:nowrap;vertical-align:top;">${FIELD_LABELS[k] || k}</td>
        <td style="padding:6px 0;color:#e8e8e8;font-size:14px;vertical-align:top;">${escapeHtml(String(answers[k]))}</td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>your enquiry — press for goblins</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- header -->
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid #2a2a2a;">
              <p style="margin:0;color:#7bbf7b;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">press for goblins</p>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:32px 0 24px;">
              <p style="margin:0 0 20px;color:#c8c8c8;font-size:15px;line-height:1.7;">
                something has been received.
              </p>
              <p style="margin:0 0 20px;color:#c8c8c8;font-size:15px;line-height:1.7;">
                the details you submitted are below. this is an initial enquiry only — no manuscript has been submitted yet. noah will be in touch.
              </p>
            </td>
          </tr>

          <!-- answers table -->
          <tr>
            <td style="padding:0 0 32px;">
              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a;">
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td>
              <p style="margin:0 0 8px;color:#555;font-size:12px;line-height:1.6;">we aim to respond within 2–3 weeks.</p>
              <p style="margin:0;color:#555;font-size:12px;">
                <a href="https://pressforgoblins.com" style="color:#7bbf7b;text-decoration:none;">pressforgoblins.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailText(answers) {
  const lines = FIELD_ORDER
    .filter(k => answers[k])
    .map(k => `${FIELD_LABELS[k] || k}: ${answers[k]}`);

  return [
    'press for goblins',
    '─────────────────',
    '',
    'something has been received.',
    '',
    'the details you submitted are below. this is an initial enquiry only —',
    'no manuscript has been submitted yet. noah will be in touch.',
    '',
    '─────────────────',
    ...lines,
    '─────────────────',
    '',
    'we aim to respond within 2–3 weeks.',
    'pressforgoblins.com',
  ].join('\n');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  /* only POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  /* CORS — allow the live site and localhost for testing */
  const allowed = [
    'https://pressforgoblins.com',
    'https://www.pressforgoblins.com',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  /* parse body */
  let answers;
  try {
    answers = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'invalid json' });
  }

  const email = answers['f-email'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'missing or invalid email' });
  }

  /* send via Resend */
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'email service not configured' });
  }

  const payload = {
    from: 'Press for Goblins <hello@pressforgoblins.com>',
    to: [email],
    subject: 'your enquiry has been noted',
    html: buildEmailHtml(answers),
    text: buildEmailText(answers),
  };

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('Resend error:', err);
    return res.status(502).json({ error: 'email delivery failed' });
  }

  return res.status(200).json({ ok: true });
}
