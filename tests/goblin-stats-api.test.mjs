import test from 'node:test';
import assert from 'node:assert/strict';
import goblinStats from '../api/goblin-stats.js';

function responseRecorder() {
  return {
    statusCode:200, headers:{}, body:null,
    setHeader(key,value){this.headers[key]=value;return this;},
    status(code){this.statusCode=code;return this;},
    json(value){this.body=value;return this;},
    send(value){this.body=value;return this;},
    end(){return this;},
  };
}

const correctToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const request = (token=correctToken) => ({
  method:'GET',
  headers:{host:'pressforgoblins.com',authorization:`Bearer ${token}`},
  query:{minutes:'60',limit:'5',days:'30'},
});

test('machine stats rejects missing and incorrect credentials before provider access', async () => {
  process.env.GOBLIN_STATS_READ_TOKEN=correctToken;
  const originalFetch=globalThis.fetch; let called=false;
  globalThis.fetch=async()=>{called=true;throw new Error();};
  try {
    for (const token of ['', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']) {
      const req=request(token); if(!token) delete req.headers.authorization;
      const res=responseRecorder(); await goblinStats(req,res); assert.equal(res.statusCode,401);
    }
    assert.equal(called,false);
  } finally { globalThis.fetch=originalFetch; }
});

test('machine stats returns the bounded private snapshot', async () => {
  Object.assign(process.env,{
    GOBLIN_STATS_READ_TOKEN:correctToken,
    SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public-key',ANALYTICS_INGEST_CAPABILITY:'capability',
  });
  const originalFetch=globalThis.fetch; let forwarded;
  globalThis.fetch=async(_url,options)=>{forwarded=JSON.parse(options.body);return{ok:true,text:async()=>'{"sessions":[],"counts":[]}'};};
  try {
    const res=responseRecorder(); await goblinStats(request(),res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(forwarded,{p_days:30,p_minutes:60,p_limit:5,p_capability:'capability'});
    assert.equal(res.body,'{"sessions":[],"counts":[]}');
  } finally { globalThis.fetch=originalFetch; }
});
