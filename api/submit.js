/* ═══════════════════════════════════════════════════════
   press for goblins — form submission endpoint
   Vercel serverless function. receives form data, sends
   a confirmation email via Resend to the user.

   env vars required (set in Vercel dashboard):
     RESEND_API_KEY  — from resend.com
   ═══════════════════════════════════════════════════════ */

/* simple in-memory rate limiter — max 3 submissions per IP per hour */
const hits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const window = 60 * 60 * 1000; /* 1 hour */
  const max = 3;
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > window) { hits.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= max) return true;
  entry.count++;
  hits.set(ip, entry);
  return false;
}

const FIELD_LABELS = {
  'writer-type': 'project type',
  'service':     'service',
  'genre':       'genre',
  'f-pitch':     'what is the project?',
  'f-title':     'project name',
  'f-name':      'name',
  'f-email':     'email',
  'f-message':   'anything else?',
};

const FIELD_ORDER = [
  'writer-type', 'service', 'genre',
  'f-pitch', 'f-title', 'f-name', 'f-email', 'f-message',
];

function buildEmailHtml(answers) {
  /* chat log rows: goblin prompt left, user answer right */
  const chatRows = FIELD_ORDER
    .filter(k => answers[k])
    .map(k => `
      <tr>
        <td style="background:#0d0d0d;padding:0 0 18px 0;">
          <!-- goblin line -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#0d0d0d;padding:0 0 6px 0;">
                <span style="color:#7bbf7b;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;word-break:break-word;">&gt; ${escapeHtml(FIELD_LABELS[k] || k)}</span>
              </td>
            </tr>
            <tr>
              <td align="right" style="background:#0d0d0d;padding:0;max-width:100%;">
                <span style="color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;word-break:break-word;">${escapeHtml(String(answers[k]))}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>your message has reached the goblins</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#0d0d0d;padding:48px 16px;" align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

          <!-- eyes -->
          <tr>
            <td style="background:#0d0d0d;padding:0 0 24px 0;" align="center">
              <img src="https://pressforgoblins.com/assets/images/eyes-email.png" alt="" width="130" height="108" style="display:block;border:0;outline:0;image-rendering:pixelated;">
            </td>
          </tr>

          <!-- headline -->
          <tr>
            <td style="background:#0d0d0d;padding:0 0 12px 0;">
              <p style="margin:0;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:18px;line-height:1.5;text-align:center;">the goblins are already arguing about your project</p>
            </td>
          </tr>

          <!-- body copy -->
          <tr>
            <td style="background:#0d0d0d;padding:0 0 36px 0;">
              <p style="margin:0 0 14px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:18px;line-height:1.5;text-align:center;">one of them will read it eventually</p>
            </td>
          </tr>

          <!-- chat log -->
          <tr>
            <td style="background:#0d0d0d;padding:0 0 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>${chatRows}</tbody>
              </table>
            </td>
          </tr>

          <!-- reply note -->
          <tr>
            <td style="background:#0d0d0d;padding:0 0 24px 0;">
              <p style="margin:0;color:#aaaaaa;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.7;text-align:center;">want to tell us something else? you can reply to this email.</p>
            </td>
          </tr>

          <!-- response time -->
          <tr>
            <td style="background:#0d0d0d;padding:0 0 24px 0;">
              <p style="margin:0;color:#aaaaaa;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.7;text-align:center;">we aim to respond within 14 days, though some projects take longer to argue about.</p>
            </td>
          </tr>

          <!-- footer link -->
          <tr>
            <td style="background:#0d0d0d;padding:0;">
              <p style="margin:0;text-align:center;"><a href="https://pressforgoblins.com" style="color:#aaaaaa;font-family:'Courier New',Courier,monospace;font-size:15px;text-decoration:none;">pressforgoblins.com</a></p>
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
    .flatMap(k => [
      `> ${FIELD_LABELS[k] || k}`,
      `  ${answers[k]}`,
      '',
    ]);

  return [
    'the goblins are already arguing about your project.',
    '',
    'one of them will read it eventually.',
    '',
    ...lines,
    'want to tell us something else? you can reply to this email.',
    '',
    'we aim to respond within 14 days, though some projects take longer to argue about.',
    '',
    'pressforgoblins.com',
  ].join('\n');
}

function buildNotificationHtml(answers) {
  /* same chat log layout as the receipt */
  const chatRows = FIELD_ORDER
    .filter(k => answers[k])
    .map(k => `
      <tr>
        <td style="background:#0d0d0d;padding:0 0 18px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#0d0d0d;padding:0 0 6px 0;">
                <span style="color:#7bbf7b;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;word-break:break-word;">&gt; ${escapeHtml(FIELD_LABELS[k] || k)}</span>
              </td>
            </tr>
            <tr>
              <td align="right" style="background:#0d0d0d;padding:0;max-width:100%;">
                <span style="color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.6;word-break:break-word;">${escapeHtml(String(answers[k]))}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>new enquiry — press for goblins</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#0d0d0d;padding:48px 16px;" align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

          <!-- chat log -->
          <tr>
            <td style="background:#0d0d0d;padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>${chatRows}</tbody>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildNotificationText(answers) {
  const lines = FIELD_ORDER
    .filter(k => answers[k])
    .flatMap(k => [
      `> ${FIELD_LABELS[k] || k}`,
      `  ${answers[k]}`,
      '',
    ]);

  return ['new query', '', ...lines].join('\n');
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

  /* rate limit by IP */
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'too many requests' });
  }

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

  const sendEmail = (payload) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  /* send both emails in parallel */
  const [notifyRes, receiptRes] = await Promise.all([
    /* notification to noah */
    sendEmail({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: ['hello@pressforgoblins.com'],
      subject: `Query: ${answers['f-title'] || answers['genre'] || answers['service'] || 'unknown'}`,
      html: buildNotificationHtml(answers),
      text: buildNotificationText(answers),
    }),
    /* receipt to submitter */
    sendEmail({
      from: 'Press for Goblins <hello@pressforgoblins.com>',
      to: [email],
      subject: `Query: ${answers['f-title'] || answers['genre'] || answers['service'] || 'your project'}`,
      html: buildEmailHtml(answers),
      text: buildEmailText(answers),
    }),
  ]);

  if (!notifyRes.ok || !receiptRes.ok) {
    const err = await (notifyRes.ok ? receiptRes : notifyRes).text();
    console.error('Resend error:', err);
    return res.status(502).json({ error: 'email delivery failed' });
  }

  return res.status(200).json({ ok: true });
}
