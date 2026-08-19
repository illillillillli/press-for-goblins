import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../api/receipt.js';
import ticket from '../api/ticket.js';
import { buildHtml as buildUserReceipt } from '../api/receipt-user.js';
import { buildHtml as buildAdminReceipt } from '../api/receipt-notif.js';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
process.env.RESEND_API_KEY = 'resend-token';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

function request(method, body, origin = 'https://pressforgoblins.com') {
  return {
    method,
    body,
    headers: { origin, 'x-forwarded-for': '203.0.113.9' },
  };
}

function installFetchMock(providerResults = []) {
  const values = new Map();
  const sets = new Map();
  const providerCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('https://redis.test/pipeline')) {
      const commands = JSON.parse(options.body);
      const results = commands.map(([command, key, ...args]) => {
        if (command === 'GET') return { result: values.get(key) ?? null };
        if (command === 'SET') { values.set(key, args[0]); return { result: 'OK' }; }
        if (command === 'INCR') {
          const next = Number(values.get(key) || 0) + 1;
          values.set(key, next);
          return { result: next };
        }
        if (command === 'EXPIRE') return { result: 1 };
        if (command === 'SADD') {
          if (!sets.has(key)) sets.set(key, new Set());
          const before = sets.get(key).size;
          sets.get(key).add(args[0]);
          return { result: sets.get(key).size > before ? 1 : 0 };
        }
        return { error: `unsupported ${command}` };
      });
      return new Response(JSON.stringify(results), { status: 200 });
    }
    if (String(url) === 'https://api.resend.com/emails') {
      providerCalls.push({
        key: options.headers['Idempotency-Key'],
        payload: JSON.parse(options.body),
      });
      const result = providerResults.shift() || { ok: true, id: `email-${providerCalls.length}` };
      return new Response(JSON.stringify(result.ok ? { id: result.id } : { message: 'provider failed' }), {
        status: result.ok ? 200 : 503,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { providerCalls, sets, values };
}

const receiptBody = {
  gate: 'yes',
  'writer-type': 'novel',
  service: 'editorial assessment',
  genre: 'fantasy',
  'f-pitch': 'A cartographer maps the void.',
  'f-title': 'Into the Void',
  'f-name': 'Elliot Vane',
  'f-email': 'noahsamuelgrey@icloud.com',
  'f-message': '',
  terms: "i'm in",
  _gotcha: '',
  _submissionId: '11111111-1111-4111-8111-111111111111',
};

test('forms reject unknown origins and handle OPTIONS before POST enforcement', async () => {
  installFetchMock();
  const forbidden = responseRecorder();
  await receipt(request('POST', receiptBody, 'https://attacker.example'), forbidden);
  assert.equal(forbidden.statusCode, 403);

  const preflight = responseRecorder();
  await ticket(request('OPTIONS', null), preflight);
  assert.equal(preflight.statusCode, 204);
});

test('receipt rejects unknown fields and oversized bodies before side effects', async () => {
  const { providerCalls } = installFetchMock();
  const unknown = responseRecorder();
  await receipt(request('POST', { ...receiptBody, surprise: 'no' }), unknown);
  assert.equal(unknown.statusCode, 400);

  const oversized = responseRecorder();
  await receipt(request('POST', JSON.stringify({ ...receiptBody, 'f-message': 'x'.repeat(13000) })), oversized);
  assert.equal(oversized.statusCode, 413);
  assert.equal(providerCalls.length, 0);
});

test('receipt retry sends only the missing email and keeps stable idempotency keys', async () => {
  const mock = installFetchMock([
    { ok: true, id: 'admin-1' },
    { ok: false },
    { ok: true, id: 'user-1' },
  ]);
  const first = responseRecorder();
  await receipt(request('POST', receiptBody), first);
  assert.equal(first.statusCode, 502);

  const retry = responseRecorder();
  await receipt(request('POST', receiptBody), retry);
  assert.equal(retry.statusCode, 200);
  assert.deepEqual(retry.body.accepted, { admin: 'admin-1', user: 'user-1' });
  assert.deepEqual(mock.providerCalls.map(call => call.key), [
    'pfg-receipt-admin-11111111-1111-4111-8111-111111111111',
    'pfg-receipt-user-11111111-1111-4111-8111-111111111111',
    'pfg-receipt-user-11111111-1111-4111-8111-111111111111',
  ]);
});

test('ticket persists first, reports admin failure, and retries without duplicating user mail', async () => {
  const mock = installFetchMock([
    { ok: true, id: 'ticket-user-1' },
    { ok: false },
    { ok: true, id: 'ticket-admin-1' },
  ]);
  const body = {
    email: 'reader@example.com',
    _gotcha: '',
    _submissionId: '22222222-2222-4222-8222-222222222222',
  };
  const first = responseRecorder();
  await ticket(request('POST', body), first);
  assert.equal(first.statusCode, 502);
  assert.equal(mock.sets.get('pfg-subscribers').has('reader@example.com'), true);

  const retry = responseRecorder();
  await ticket(request('POST', body), retry);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.subscriberPersisted, true);
  assert.deepEqual(mock.providerCalls.map(call => call.key), [
    'pfg-ticket-user-22222222-2222-4222-8222-222222222222',
    'pfg-ticket-admin-22222222-2222-4222-8222-222222222222',
    'pfg-ticket-admin-22222222-2222-4222-8222-222222222222',
  ]);
});

test('a submission id cannot be reused for a different payload', async () => {
  installFetchMock();
  const first = responseRecorder();
  await ticket(request('POST', {
    email: 'reader@example.com', _gotcha: '',
    _submissionId: '33333333-3333-4333-8333-333333333333',
  }), first);
  assert.equal(first.statusCode, 200);

  const conflict = responseRecorder();
  await ticket(request('POST', {
    email: 'someone-else@example.com', _gotcha: '',
    _submissionId: '33333333-3333-4333-8333-333333333333',
  }), conflict);
  assert.equal(conflict.statusCode, 409);
});

test('receipt emails preserve terms questions and mirror current goblin copy', () => {
  const answers = {
    genre: 'genre blend',
    terms: 'i have questions',
    'terms-concern': 'Can we begin with one chapter?',
    'f-email': 'writer@example.com',
  };
  for (const html of [buildUserReceipt(answers, '#0042'), buildAdminReceipt(answers, '#0042')]) {
    assert.match(html, /of course it is/);
    assert.match(html, /of course you do/);
    assert.match(html, /Can we begin with one chapter\?/);
  }
});
