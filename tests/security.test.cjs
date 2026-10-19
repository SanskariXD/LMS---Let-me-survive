/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness transpiles isolated server modules. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@libsql/client');
const { NextRequest, NextResponse } = require('next/server');
const secret = 'test-only-random-secret-for-local-security-regressions';
const env = { NODE_ENV: 'test', SESSION_SECRET: secret, DATABASE_URL: 'file::memory:' };
function load(file, mocks = {}, globals = {}, customEnv = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {
    exports, require: name => name in mocks ? mocks[name] : require(name),
    process: { env: {...env, ...customEnv} }, console: {log(){},warn(){},error(){}},
    Buffer, Headers, Request, Response, File, URL, TextEncoder, AbortSignal,
    crypto: require('node:crypto').webcrypto, atob, btoa, ...globals,
  }, {filename: file});
  return exports;
}
const auth = load('lib/portal/auth.ts');
const urls = load('lib/security/urls.ts');
const requestSecurity = load('lib/security/request.ts', {'next/server': {NextResponse}});
function req(route, method = 'POST', body = {}, headers = {}) {
  return new NextRequest(`https://portal.test${route}`, {
    method, headers: {origin: 'https://portal.test', 'content-type': 'application/json', ...headers},
    ...(!['GET','HEAD'].includes(method) ? {body: JSON.stringify(body)} : {}),
  });
}
async function database() {
  const client = createClient({url: 'file::memory:'});
  const schema = load('db/schema.ts');
  const dbModule = load('db/index.ts', {
    './schema': schema, '@/lib/portal/auth': auth,
    '@libsql/client': {createClient: () => client},
  });
  await dbModule.ensureDbInitialized();
  const queries = load('lib/db/queries.ts', {'@/db': dbModule, '@/db/schema': schema, '@/lib/portal/auth': auth, '@/lib/security/urls': urls});
  return {client, dbModule, queries};
}

test('credential encryption is randomized, authenticated and backward compatible', () => {
  const a = auth.encryptSecret('private-password');
  assert.match(a, /^v2:/); assert.notEqual(a, auth.encryptSecret('private-password'));
  assert.equal(auth.decryptSecret(a), 'private-password');
  const parts = a.split(':'); parts[2] = '00'.repeat(16);
  assert.equal(auth.decryptSecret(parts.join(':')), null);
  const crypto = require('node:crypto');
  const key = Buffer.alloc(32); Buffer.from(secret).copy(key,0,0,32);
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext = Buffer.concat([cipher.update('old-password'),cipher.final()]);
  const legacy = [iv.toString('hex'),cipher.getAuthTag().toString('hex'),ciphertext.toString('hex')].join(':');
  assert.equal(auth.decryptSecret(legacy), 'old-password');
  const production = load('lib/portal/auth.ts', {}, {}, {NODE_ENV:'production',SESSION_SECRET:'short'});
  assert.throws(() => production.encryptSecret('secret'), /at least 32/);
});

test('signed remembered identity rejects unsigned cookies, tampering and session-token substitution', async () => {
  const jar = new Map(), options = new Map();
  const session = load('lib/portal/session.ts', {'next/headers': {cookies: async () => ({get: k => jar.has(k) ? {value:jar.get(k)} : undefined,set:(k,v,o)=>{jar.set(k,v);options.set(k,o);}})}});
  jar.set('slotwise_device_user', Buffer.from(JSON.stringify({userId:'victim',enrollment:'123'})).toString('base64url'));
  assert.equal(await session.getRememberedUser(), null);
  await session.setRememberedUser({userId:'owner',enrollment:'456'});
  const remembered = jar.get('slotwise_device_user');
  assert.equal((await session.getRememberedUser()).userId, 'owner');
  assert.equal(options.get('slotwise_device_user').httpOnly, true);
  assert.equal(session.parseSessionToken(remembered), null);
  jar.set('slotwise_device_user', remembered.replace(/.$/, remembered.endsWith('a') ? 'b' : 'a'));
  assert.equal(await session.getRememberedUser(), null);
  const token = session.createSessionToken('owner');
  assert.equal(session.parseSessionToken(token).userId, 'owner');
  assert.equal(session.parseSessionToken(token + '.extra'), null);
  assert.notEqual(session.createSessionToken('owner'), token);
});

test('logout revokes a copied signed session token in persistent storage', async () => {
  const {client,dbModule} = await database();
  try {
    const jar = new Map();
    const session = load('lib/portal/session.ts', {'@/db':dbModule,'next/headers': {cookies: async () => ({get:k=>jar.has(k)?{value:jar.get(k)}:undefined,set:(k,v)=>jar.set(k,v)})}});
    const stolen = session.createSessionToken('owner'); jar.set('slotwise_session', stolen);
    assert.equal((await session.validateSession()).userId,'owner');
    await session.clearSession(); jar.set('slotwise_session', stolen);
    assert.equal(await session.validateSession(), null);
  } finally {client.close();}
});

test('task update cannot read or modify another account and rejects script links', async () => {
  const {client,queries} = await database();
  try {
    const alice = await queries.upsertUser({enrollmentNumber:'alice',studentName:'Alice'});
    const bob = await queries.upsertUser({enrollmentNumber:'bob',studentName:'Bob'});
    const task = await queries.createTask(alice.id,{title:'Private task'});
    assert.equal(await queries.updateTask(bob.id,task.id,{title:'Changed'}), null);
    assert.equal((await queries.getUserTasks(alice.id))[0].title,'Private task');
    await assert.rejects(queries.createTask(alice.id,{title:'unsafe',submissionUrl:'javascript:alert(1)'}));
    await assert.rejects(queries.createResource(alice.id,'Alice',{title:'unsafe',course:'CSE',semester:'FALL',resourceType:'Notes',fileName:'x',fileUrl:'data:text/html,<script>alert(1)</script>'}));
  } finally {client.close();}
});

test('upstream tokens are encrypted at rest and cleared on invalidation', async () => {
  const {client,queries} = await database();
  try {
    const user = await queries.upsertUser({enrollmentNumber:'alice',studentName:'Alice'});
    await queries.saveUniversitySession(user.id,'private-access-token',Date.now()+60000);
    const raw = await client.execute('SELECT token FROM university_sessions');
    assert.match(String(raw.rows[0].token),/^v2:/);
    assert.ok(!String(raw.rows[0].token).includes('private-access-token'));
    assert.equal((await queries.getUniversitySession(user.id)).token,'private-access-token');
    await queries.invalidateUniversitySession(user.id);
    assert.equal((await client.execute('SELECT token FROM university_sessions')).rows[0].token,'');
  } finally {client.close();}
});

test('atomic rate limits resist concurrent attempts and survive module reloads', async () => {
  const {client,dbModule} = await database();
  try {
    const limiter = load('lib/security/rate-limit.ts', {'@/db':dbModule});
    const attempts = await Promise.all(Array.from({length:20},()=>limiter.consumeAttempt('pin','owner',5)));
    assert.equal(attempts.filter(Boolean).length,5);
    const reloaded = load('lib/security/rate-limit.ts', {'@/db':dbModule});
    assert.equal(await reloaded.consumeAttempt('pin','owner',5),false);
    assert.equal(await reloaded.consumeAttempt('pin','other-owner',5),true);
    const rows = await client.execute('SELECT key FROM security_rate_limits');
    assert.ok(rows.rows.every(row=>!String(row.key).includes('owner')));
  } finally {client.close();}
});

test('mutation guards reject absent/cross-site origins and oversized requests', () => {
  assert.equal(requestSecurity.guardMutation(req('/api/user/pin')), null);
  for (const headers of [{origin:''},{origin:'https://attacker.test'},{'sec-fetch-site':'cross-site'},{'content-length':'200000'}]) {
    assert.ok([403,413].includes(requestSecurity.guardMutation(req('/api/user/pin','POST',{},headers)).status));
  }
});

test('streaming request limit also rejects bodies without Content-Length', async () => {
  const oversized = new Request('https://portal.test',{method:'POST',body:'x'.repeat(131073),headers:{'content-type':'application/json'}});
  await assert.rejects(requestSecurity.readJson(oversized), /BODY_TOO_LARGE/);
  const parsed = await requestSecurity.readJson(req('/api/tasks','POST',{title:'safe'}));
  assert.equal(parsed.title,'safe');
});

test('direct route calls reject spoofed identity headers even if middleware is bypassed', async () => {
  const routes = [
    ['app/api/tasks/route.ts','GET'],['app/api/user/pin/route.ts','GET'],
    ['app/api/university/courses/route.ts','GET'],['app/api/resources/upload/route.ts','POST'],
  ];
  for (const [file,method] of routes) {
    let accessed = false;
    const trap = new Proxy({}, {get:()=>async()=>{accessed=true;throw Error('data accessed');}});
    const mocks = {
      'next/server':{NextResponse}, '@/lib/security/request':requestSecurity,
      '@/lib/portal/session':{validateSession:async()=>null}, '@/lib/db/queries':trap,
      '@/lib/portal/auth':auth, '@/lib/security/rate-limit':{consumeAttempt:async()=>true},
      '@/lib/university/client':trap, '@/lib/university/endpoints':{UNIVERSITY_ENDPOINTS:{}},
      '@vercel/blob':{put:async()=>{accessed=true;}},
    };
    const route = load(file,mocks);
    const response = await route[method](req('/api/test',method,{}, {'x-user-id':'victim'}));
    assert.equal(response.status,401,file); assert.equal(accessed,false,file);
  }
});

test('anonymous resource listing ignores spoofed identity and public health never fetches upstream', async () => {
  let identity = 'not-called', fetched=false;
  const resources = load('app/api/resources/route.ts', {
    'next/server':{NextResponse}, '@/lib/security/request':requestSecurity,
    '@/lib/portal/session':{validateSession:async()=>null},
    '@/lib/db/queries':{getResources:async id=>{identity=id;return [];}}});
  assert.equal((await resources.GET(req('/api/resources','GET',{}, {'x-user-id':'victim'}))).status,200);
  assert.equal(identity,undefined);
  const health = load('app/api/university/diagnostics/route.ts', {'next/server':{NextResponse}}, {fetch:async()=>{fetched=true;}});
  const body = await (await health.GET()).json();
  assert.deepEqual(body,{status:'ok'}); assert.equal(fetched,false);
});

test('PIN login has uniform failures, account throttling and six-digit validation', async () => {
  const {client,dbModule,queries} = await database();
  try {
    const user = await queries.upsertUser({enrollmentNumber:'alice',studentName:'Alice',pinHash:await auth.hashPin('123456')});
    const limiter = load('lib/security/rate-limit.ts', {'@/db':dbModule});
    const route = load('app/api/portal/login/route.ts', {
      'next/server':{NextResponse}, '@/lib/security/request':requestSecurity,
      '@/lib/security/rate-limit':limiter, '@/lib/portal/auth':auth,
      '@/lib/portal/session':{createSession:async()=>{}}, '@/lib/db/queries':queries,
      '@/lib/university/auth':{loginToUniversity:async()=>{throw Error('must not call university');}},
      '@/lib/university/token-store':{setCachedUniversityToken:()=>{}},
    });
    const wrong = await route.POST(req('/api/portal/login','POST',{enrollment:'alice',pin:'000000'}));
    const unknown = await route.POST(req('/api/portal/login','POST',{enrollment:'unknown',pin:'000000'}));
    assert.equal(wrong.status,401);assert.deepEqual(await wrong.json(),await unknown.json());
    for(let i=0;i<4;i++) await route.POST(req('/api/portal/login','POST',{userId:user.id,pin:'000000'}));
    assert.equal((await route.POST(req('/api/portal/login','POST',{enrollment:'alice',pin:'123456'}))).status,429);
    assert.equal((await route.POST(req('/api/portal/login','POST',{enrollment:'alice',pin:'abcdef'}))).status,400);
  } finally {client.close();}
});

test('upstream configuration refuses remote HTTP, embedded credentials and URL suffixes', () => {
  for(const url of ['http://university.test','https://user:password@university.test','https://university.test/?token=x','https://university.test/other']) {
    const config = load('lib/university/config.ts',{}, {}, {UNIVERSITY_BASE_URL:url,NODE_ENV:'production'});
    assert.throws(()=>config.universityConfig.baseUrl);
  }
  const config = load('lib/university/config.ts',{}, {}, {UNIVERSITY_BASE_URL:'https://university.test',NODE_ENV:'production'});
  assert.equal(config.universityConfig.baseUrl,'https://university.test');
});

test('upstream client never falls back to an operator account or follows redirects', async () => {
  let fetched=false, options;
  const client = load('lib/university/client.ts', {
    '@/lib/registration/debug':{sanitizeDebug:value=>value}, './config':{universityConfig:{baseUrl:'https://university.test'}},
    './logger':{universityLog(){}}, './auth':{loginToUniversity:async()=>{throw Error('operator account used');}},
    './token-store':{}, '@/lib/db/queries':{}, '@/lib/portal/auth':auth,
  }, {fetch:async(url,opts)=>{fetched=true;options=opts;return Response.json({ok:true});}});
  await assert.rejects(client.universityRequest('/api/auth/me'),/SESSION_REQUIRED/);
  assert.equal(fetched,false);
  await client.universityRequest('/api/auth/me',{upstreamToken:'newly-authenticated-token'});
  assert.equal(options.redirect,'error'); assert.equal(options.cache,'no-store');
  assert.equal(options.upstreamToken,undefined);
});
