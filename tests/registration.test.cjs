const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const {createClient} = require('@libsql/client');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {exports,require:(name)=>name in mocks ? mocks[name] : require(name.startsWith('.') ? require('node:path').resolve(require('node:path').dirname(file), name) : name),process,console,AbortSignal,...globals}, {filename:file});
  return exports;
}
const payloads = load('lib/registration/payload.ts');
const blank = {course_code:'CSE2008',course_name:'Computer Networks',type:'THEORY_LAB',theory_slot:'G2',theory_venue:'330',theory_faculty:'Dr. Varikuti Harinadh',practical_slot:'L19+L20',practical_venue:'429',practical_faculty:'Dr. Varikuti Harinadh'};
const base = {course_code:'CSE2008',slot_year:'2026-27',semester_type:'FALL'};
const plain = value => JSON.parse(JSON.stringify(value));
test('exact theory + lab, lab-only, theory-only and project payloads', () => {
  assert.deepEqual(plain(payloads.buildRegistrationPayload(blank)), {...base,theory_slot:'G2',theory_venue:'330',theory_faculty:blank.theory_faculty,practical_slot:'L19+L20',practical_venue:'429',practical_faculty:blank.practical_faculty});
  assert.deepEqual(plain(payloads.buildRegistrationPayload({...blank,type:'LAB',course_code:'SSK3001',practical_slot:'L3+L4',practical_venue:'509',practical_faculty:'Ms. Selshiya Arputharaj Sharmi'})), {course_code:'SSK3001',slot_year:'2026-27',semester_type:'FALL',slot_name:'L3+L4',venue:'509',faculty_name:'Ms. Selshiya Arputharaj Sharmi'});
  assert.deepEqual(plain(payloads.buildRegistrationPayload({...blank,type:'THEORY',course_code:'CSE3008',theory_slot:'A2',theory_venue:'324',theory_faculty:'Dr. Geetha V'})), {course_code:'CSE3008',slot_year:'2026-27',semester_type:'FALL',slot_name:'A2',venue:'324',faculty_name:'Dr. Geetha V'});
  assert.deepEqual(plain(payloads.buildRegistrationPayload({...blank,type:'PROJECT',course_code:'CSE6004',theory_venue:''})), {course_code:'CSE6004',slot_year:'2026-27',semester_type:'FALL',slot_name:'PROJECT',venue:'N/A',faculty_name:blank.theory_faculty,course_type:'PRJ'});
});
test('rejects missing fields, ambiguous labs/codes, duplicate courses and extra action fields', () => {
  for (const invalid of [{...blank,theory_venue:''},{...blank,practical_slot:'L19+L21'},{...blank,practical_slot:'L11+L12 & L21+L22'},{...blank,course_code:'CSE2008/CSE2009'},{...blank,theory_faculty:'TBA'},{...blank,action:'withdraw'}]) assert.throws(()=>payloads.buildRegistrationPayload(invalid));
  assert.throws(()=>payloads.buildPlan([blank,blank]), /Duplicate/);
  assert.equal(payloads.executeSchema.safeParse({planId:'a',courseCode:'CSE2008',payload:base}).success,false);
});
test('HTTP errors and inconclusive responses are never treated as successful', () => {
  for (const [status,body,expected] of [[200,{message:'Course registered successfully'},'success'],[200,{success:false,message:'registered successfully'},'rejected'],[404,{message:'not found'},'rejected'],[200,'<html>login</html>','uncertain'],[200,{},'uncertain'],[500,{success:true},'uncertain'],[408,{},'uncertain']]) assert.equal(payloads.classifyRegistrationResponse(status,body),expected);
});
test('durable store binds plans to account, expires reviews, locks across tabs and blocks uncertain/successful retries', async () => {
  const client=createClient({url:'file::memory:'});
  const store=load('lib/registration/store.ts',{'@/db':{databaseClient:client}});
  const items=payloads.buildPlan([blank]), plan=await store.createPlan('user-a',items);
  assert.equal((await store.getPlan(plan.id,'user-a')).length,1);
  await assert.rejects(store.getPlan(plan.id,'user-b'), /expired/);
  await client.execute({sql:'UPDATE registration_plans SET expires_at = 0 WHERE id = ?',args:[plan.id]});
  await assert.rejects(store.getPlan(plan.id,'user-a'), /expired/);
  const release=await store.acquireUserLock('user-a');
  await assert.rejects(store.acquireUserLock('user-a'), /running/);await release();
  const release2=await store.acquireUserLock('user-a');await release2();
  const payload=items[0].payload;
  assert.equal(await store.claimAttempt('user-a','CSE2008',payload),null);
  assert.equal((await store.claimAttempt('user-a','CSE2008',payload,true)).outcome,'uncertain');
  await store.finishAttempt('user-a','CSE2008','success','Done');
  assert.equal((await store.claimAttempt('user-a','CSE2008',payload,true)).outcome,'success');
  await store.finishAttempt('user-a','CSE2008','rejected','No seats');
  assert.equal((await store.claimAttempt('user-a','CSE2008',payload)).outcome,'rejected');
  assert.equal(await store.claimAttempt('user-a','CSE2008',payload,true),null);
  client.close();
});
function serverHarness(fetch, extra = {}) {
  let claims=0, finishes=[];
  const api=load('lib/registration/server.ts',{
    '@/lib/portal/session':{validateSession:async()=>({userId:'user-a'})},
    '@/lib/db/queries':{getUserById:async()=>({student_name:'Test',enrollment_number:'TEST123'})},
    '@/lib/university/client':{getValidTokenForUser:async(id)=>{assert.equal(id,'user-a');return 'private-test-token'},universityRequest:extra.read || (async()=>({enabled:true}))},
    '@/lib/university/config':{universityConfig:{baseUrl:'http://university.test',authMode:'bearer'}},
    '@/lib/university/endpoints':{UNIVERSITY_ENDPOINTS:{registrationStatus:'/status',myTimetable:()=>'/timetable'}},
    './payload':payloads,
    './store':{claimAttempt:async()=>{claims++;return extra.previous || null},finishAttempt:async(...args)=>finishes.push(args)}
  },{fetch});
  return {api,get claims(){return claims},finishes};
}
test('same-origin and signed-in identity required; closed or unverifiable registration fails before sending', async () => {
  const h=serverHarness(async()=>{throw Error('must not send')});
  await assert.rejects(h.api.registrationIdentity({headers:new Headers({origin:'https://evil.test'}),nextUrl:new URL('https://lms.test/api')}),/portal/);
  assert.equal((await h.api.registrationIdentity({headers:new Headers({origin:'https://lms.test'}),nextUrl:new URL('https://lms.test/api')})).userId,'user-a');
  await assert.rejects(serverHarness(()=>{}, {read:async()=>({enabled:false})}).api.livePreflight('user-a'),/closed/);
  await assert.rejects(h.api.livePreflight('user-a'),/verified/);
});
test('one authenticated fixed POST; timeouts are uncertain with no auto retry; duplicates send nothing', async () => {
  const calls=[];
  const h=serverHarness(async(url,options)=>{calls.push({url,options});throw Error('timeout after commit')});
  const result=await h.api.sendRegistration('user-a',payloads.buildRegistrationPayload(blank));
  assert.equal(result.outcome,'uncertain');assert.equal(calls.length,1);
  assert.equal(calls[0].url,'http://university.test/api/course-registration/register');
  assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.headers.Authorization,'Bearer private-test-token');
  assert.equal(h.finishes[0][2],'uncertain');assert.ok(!result.message.includes('private-test-token'));
  const duplicate=serverHarness(async()=>{throw Error('must not send')},{previous:{outcome:'success',sent:false,message:'Done'}});
  assert.equal((await duplicate.api.sendRegistration('user-a',payloads.buildRegistrationPayload(blank))).sent,false);
});
test('execute route uses only the saved payload and skips existing courses; injected payloads are rejected', async () => {
  let sent=0, releases=0;
  const items=payloads.buildPlan([blank]);
  const mocks={
    'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
    '@/lib/registration/payload':payloads,
    '@/lib/registration/server':{registrationIdentity:async()=>({userId:'owner'}),livePreflight:async()=>new Set(),sendRegistration:async(user,payload)=>{assert.equal(user,'owner');assert.deepEqual(plain(payload),plain(items[0].payload));sent++;return {outcome:'success'}}},
    '@/lib/registration/store':{getPlan:async(id,user)=>{assert.equal(user,'owner');return items},acquireUserLock:async()=>async()=>{releases++},finishAttempt:async()=>{}}
  };
  const route=load('app/api/course-registration/execute/route.ts',mocks);
  const input={planId:require('node:crypto').randomUUID(),courseCode:'CSE2008'};
  assert.equal((await route.POST({text:async()=>JSON.stringify(input)})).body.outcome,'success');
  assert.equal(sent,1);assert.equal(releases,1);
  assert.equal((await route.POST({text:async()=>JSON.stringify({...input,payload:{...base,slot_name:'A1'}})})).status,400);
  assert.equal(sent,1);
  mocks['@/lib/registration/server'].livePreflight=async()=>new Set(['CSE2008']);
  assert.equal((await route.POST({text:async()=>JSON.stringify(input)})).body.outcome,'skipped');assert.equal(sent,1);
});
test('Slotwise exports the displayed option with chosen lab pair, account and no credentials', () => {
  const source=fs.readFileSync('public/slotwise/app.mjs','utf8');
  const fn=source.slice(source.indexOf('function exportRegistrationPlan(){'));
  const storage=new Map([['slotwise_device_user',JSON.stringify({enrollment:'TEST123',token:'never-export'})]]);
  let posted;
  const context={results:[[{code:'CSE2008',name:'Network',theory:'G2',lab:'L19+L20',theoryFaculty:'Theory Professor',labFaculty:'Lab Professor'}]],index:0,Date,
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},window:{location:{origin:'https://lms.test'},parent:{postMessage:(value,target)=>posted={value,target}}},$:()=>({}),esc:x=>x};
  vm.runInNewContext(fn,context);vm.runInNewContext('exportRegistrationPlan()',context);
  assert.equal(posted.target,'https://lms.test');assert.equal(posted.value.plan.enrollment,'TEST123');
  assert.equal(posted.value.plan.courses[0].practical_slot,'L19+L20');assert.equal(posted.value.plan.courses[0].theory_venue,'');
  assert.equal(posted.value.plan.courses[0].practical_faculty,'Lab Professor');assert.ok(!storage.get('slotwise_registration_plan_v1').includes('never-export'));
});

test('edited slots are checked against the same Slotwise engine before review', () => {
  assert.throws(()=>payloads.buildPlan([{...blank,type:'THEORY',theory_slot:'A2'},{...blank,type:'THEORY',course_code:'CSE3008',theory_slot:'A2'}]), /clash/);
  assert.throws(()=>payloads.buildPlan([{...blank,type:'THEORY',theory_slot:'TG2'}]), /Unknown theory slot/);
});
