import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

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

async function loadSeen(enabled) {
  process.env.ANALYTICS_COLLECTION_ENABLED = enabled ? 'true' : 'false';
  return import(`../api/seen.js?enabled=${enabled}&at=${Date.now()}-${Math.random()}`);
}

const session = '123e4567-e89b-42d3-a456-426614174000';
const request = (body = { metric:'page', value:'home', session }) => ({
  method:'POST', body, headers:{ origin:'https://pressforgoblins.com', 'sec-fetch-site':'same-origin', 'x-forwarded-for':'203.0.113.9' }
});

test('paused analytics rejects before any provider call', async () => {
  const { default: seen, COLLECTION_ENABLED } = await loadSeen(false);
  assert.equal(COLLECTION_ENABLED, false);
  const originalFetch = globalThis.fetch;
  let called = false; globalThis.fetch = async () => { called = true; throw new Error(); };
  try { const res=responseRecorder(); await seen(request(),res); assert.equal(res.statusCode,410); assert.equal(called,false); }
  finally { globalThis.fetch=originalFetch; }
});

test('rejects unknown fields, free text and foreign origins', async () => {
  const { default: seen } = await loadSeen(true);
  for (const req of [
    request({ metric:'gate', value:'yes', session, pitch:'secret words' }),
    request({ metric:'pitch', value:'secret words', session }),
    request({ metric:'gate', value:'yes', session:'recognisable-person' }),
    { ...request(), headers:{ origin:'https://evil.example', 'sec-fetch-site':'cross-site' } },
  ]) { const res=responseRecorder(); await seen(req,res); assert.ok([400,403].includes(res.statusCode)); }
});

test('accepts only the fixed session and opportunity vocabulary', () => {
  return import('../shared/analytics.mjs').then(({ normaliseMetric }) => {
    assert.deepEqual(normaliseMetric('session', 'start'), { metric:'session', value:'start' });
    assert.deepEqual(normaliseMetric('opportunity', 'email_rune'), { metric:'opportunity', value:'email_rune' });
    assert.equal(normaliseMetric('session', 'person-123'), null);
  });
});

test('fails closed when rate-limit storage is unavailable', async () => {
  const { default: seen } = await loadSeen(true);
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const res=responseRecorder(); await seen(request(),res); assert.equal(res.statusCode,503);
});

test('only forwards allowlisted aggregates and an optional owner token', async () => {
  const { default: seen } = await loadSeen(true);
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL:'https://redis.test', UPSTASH_REDIS_REST_TOKEN:'redis', SUPABASE_URL:'https://db.test', SUPABASE_ANON_KEY:'public-key', ANALYTICS_INGEST_CAPABILITY:'capability' });
  const originalFetch=globalThis.fetch; const calls=[];
  globalThis.fetch=async (url,options) => { calls.push({url:String(url),options}); return String(url).includes('redis') ? {ok:true,json:async()=>[{result:1}]} : {ok:true}; };
  try {
    const req=request({metric:'gate',value:'yes',session}); req.headers.cookie='pfg_owner=abc123';
    const res=responseRecorder(); await seen(req,res); assert.equal(res.statusCode,204);
    const forwarded=JSON.parse(calls.at(-1).options.body);
    assert.deepEqual(forwarded,{p_metric:'gate',p_value:'yes',p_capability:'capability',p_owner_token:'abc123',p_session_hash:createHmac('sha256','capability').update(session).digest('hex')});
    assert.doesNotMatch(JSON.stringify(forwarded),/123e4567|pitch|email|name|referrer|ip/i);
  } finally { globalThis.fetch=originalFetch; }
});
