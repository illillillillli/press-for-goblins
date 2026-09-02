import test from 'node:test';
import assert from 'node:assert/strict';
import dashboardData from '../api/dashboard-data.js';
import dashboardOwner from '../api/dashboard-owner.js';

function responseRecorder() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; },
  };
}

const bearer = 'Bearer header.payload.signature';

test('dashboard data accepts a same-origin browser GET without requiring an Origin header', async () => {
  Object.assign(process.env, { SUPABASE_URL:'https://db.test', SUPABASE_ANON_KEY:'public-key' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:true, status:200, text:async () => '{"counts":[]}' });
  try {
    const req = { method:'GET', headers:{ host:'pressforgoblins.com', 'sec-fetch-site':'same-origin', authorization:bearer } };
    const res = responseRecorder();
    await dashboardData(req,res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body,'{"counts":[]}');
  } finally { globalThis.fetch = originalFetch; }
});

test('dashboard data rejects foreign hosts and cross-site requests before provider access', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error(); };
  try {
    for (const headers of [
      { host:'evil.example', 'sec-fetch-site':'same-origin', authorization:bearer },
      { host:'pressforgoblins.com', origin:'https://evil.example', 'sec-fetch-site':'cross-site', authorization:bearer },
    ]) {
      const res = responseRecorder();
      await dashboardData({ method:'GET', headers },res);
      assert.equal(res.statusCode,403);
    }
    assert.equal(called,false);
  } finally { globalThis.fetch = originalFetch; }
});

test('each owner device receives an independent anonymous marker', async () => {
  Object.assign(process.env, { SUPABASE_URL:'https://db.test', SUPABASE_ANON_KEY:'public-key' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:true, json:async () => ({ token:'a'.repeat(64), device:'12abef' }) });
  try {
    const req = { method:'POST', headers:{ origin:'https://pressforgoblins.com', authorization:bearer } };
    const res = responseRecorder();
    await dashboardOwner(req,res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.body,{ device:'12abef' });
    assert.match(res.headers['Set-Cookie'],/^pfg_owner=a{64};/);
    assert.doesNotMatch(res.headers['Set-Cookie'],/12abef/);
  } finally { globalThis.fetch = originalFetch; }
});
