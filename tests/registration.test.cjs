const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const commonMocks = {};
const {createClient} = require('@libsql/client');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {exports,require:(name)=>name in mocks ? mocks[name] : name in commonMocks ? commonMocks[name] : require(name.startsWith('.') ? require('node:path').resolve(require('node:path').dirname(file), name) : name),process,console,AbortSignal,Buffer,Headers,Response,...globals}, {filename:file});
  return exports;
}
const debug = load('lib/registration/debug.ts');
commonMocks['./debug'] = debug;
commonMocks['@/lib/registration/debug'] = debug;
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
  const store=load('lib/registration/store.ts',{'@/db':{databaseClient:client},'./payload':payloads});
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
    '@/lib/university/config':{universityConfig:{baseUrl:extra.baseUrl || 'http://university.test',authMode:'bearer'}},
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
test('execute route uses the saved intent and official payload and skips existing courses; injected payloads are rejected', async () => {
  let sent=0, releases=0;
  const items=payloads.buildPlan([blank]);
  const mocks={
    'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
    '@/lib/registration/payload':payloads,
    '@/lib/registration/server':{registrationIdentity:async()=>({userId:'owner'}),livePreflight:async()=>new Set(),sendRegistration:async(user,payload)=>{assert.equal(user,'owner');assert.deepEqual(plain(payload),plain(items[0].payload));sent++;return {outcome:'success'}}},
    '@/lib/registration/lookup':{resolveOfficialCourse:async(user,course,term)=>{assert.equal(user,'owner');assert.equal(course.course_code,'CSE2008');assert.equal(term.semester_type,'FALL');return {...items[0],seats:[]}}},
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
  const context={results:[[{code:'CSE2008',name:'Network',theory:'G2',lab:'L19+L20',theoryFaculty:'Theory Professor',labFaculty:'Lab Professor'}]],index:0,Date,term:{slot_year:'2026-27',semester_type:'WINTER'},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},window:{location:{origin:'https://lms.test'},parent:{postMessage:(value,target)=>posted={value,target}}},$:()=>({}),esc:x=>x};
  vm.runInNewContext(fn,context);vm.runInNewContext('exportRegistrationPlan()',context);
  assert.equal(posted.target,'https://lms.test');assert.equal(posted.value.plan.enrollment,'TEST123');
  assert.equal(posted.value.plan.semester_type,'WINTER');
  assert.equal(posted.value.plan.courses[0].practical_slot,'L19+L20');assert.equal(posted.value.plan.courses[0].theory_venue,'');
  assert.equal(posted.value.plan.courses[0].practical_faculty,'Lab Professor');assert.ok(!storage.get('slotwise_registration_plan_v1').includes('never-export'));
});

test('edited slots are checked against the same Slotwise engine before review', () => {
  assert.throws(()=>payloads.buildPlan([{...blank,type:'THEORY',theory_slot:'A2'},{...blank,type:'THEORY',course_code:'CSE3008',theory_slot:'A2'}]), /clash/);
  assert.throws(()=>payloads.buildPlan([{...blank,type:'THEORY',theory_slot:'TG2'}]), /Unknown theory slot/);
});

const offerings=load('lib/registration/offerings.ts', {'./payload':payloads});
commonMocks['@/lib/registration/offerings'] = offerings;
const official={course_info:{course_code:'CSE2033',course_name:'Cloud Computing for IoT',theory:3,practical:0,credits:3,course_type:'T'},offerings:[{course_code:'CSE2033',course_title:'Cloud Computing for IoT',course_type:'T',slots_offered:'B1',venue:'515',faculty_name:'Dr. Varikuti Harinadh',available_seats:'3'}]};
const cloud={...blank,course_code:'CSE2033',type:'THEORY',theory_slot:'B1',theory_venue:'wrong room',theory_faculty:'old misspelling'};
test('official course + slot matching replaces catalogue metadata and carries Winter through payload',()=>{
  const resolved=offerings.resolveSelection(cloud,{slot_year:'2026-27',semester_type:'WINTER'},official);
  assert.equal(resolved.payload.venue,'515');assert.equal(resolved.payload.faculty_name,'Dr. Varikuti Harinadh');assert.equal(resolved.payload.semester_type,'WINTER');
  assert.throws(()=>offerings.resolveSelection({...cloud,theory_slot:'A2'},payloads.defaultTerm,official),/not in/);
  assert.throws(()=>offerings.resolveSelection({...cloud,course_code:'CSE2034'},payloads.defaultTerm,official),/unavailable/);
  assert.throws(()=>offerings.resolveSelection({...cloud,type:'LAB'},payloads.defaultTerm,official),/type differs/);
});
test('ambiguous faculty and missing rooms are blocked without guessing',()=>{
  const multiple={...official,offerings:[...official.offerings,{...official.offerings[0],venue:'516',faculty_name:'Dr. Other Person'}]};
  assert.throws(()=>offerings.resolveSelection(cloud,payloads.defaultTerm,multiple),/Multiple sections/);
  assert.equal(offerings.resolveSelection({...cloud,theory_faculty:'Varikuti Harinadh'},payloads.defaultTerm,multiple).payload.venue,'515');
  for (const change of [{venue:''},{faculty_name:''}]) assert.throws(()=>offerings.resolveSelection(cloud,payloads.defaultTerm,{...official,offerings:[{...official.offerings[0],...change}]}));
});
test('theory and lab keep their own official rooms and professors',()=>{
  const combined={course_info:{course_code:'CSE2008',course_name:'Networks',theory:3,practical:2,credits:4,course_type:'TP'},offerings:[{course_code:'CSE2008',course_title:'Networks',course_type:'T',slots_offered:'G2',venue:'330',faculty_name:'Theory Professor'},{course_code:'CSE2008',course_title:'Networks',course_type:'P',slots_offered:'L19+L20',venue:'429',faculty_name:'Lab Professor'}]};
  const payload=offerings.resolveSelection(blank,payloads.defaultTerm,combined).payload;
  assert.equal(payload.theory_venue,'330');assert.equal(payload.practical_venue,'429');assert.equal(payload.theory_faculty,'Theory Professor');assert.equal(payload.practical_faculty,'Lab Professor');
});
test('lookup URL uses the selected term and cannot target arbitrary endpoints',async()=>{
  let called;
  const lookup=load('lib/registration/lookup.ts',{'./payload':payloads,'./offerings':offerings,'@/lib/university/client':{universityRequest:async(path,options)=>{called={path,options};return official}}});
  await lookup.fetchOfferings('owner','CSE2033',{slot_year:'2027-28',semester_type:'WINTER'});
  assert.equal(called.path,'/api/course-registration/course-offerings/CSE2033/2027-28/WINTER');assert.equal(called.options.userId,'owner');assert.equal(called.options.cache,'no-store');
  await assert.rejects(lookup.fetchOfferings('owner','../withdraw',{slot_year:'2026-27',semester_type:'FALL'}));
});
test('attempts are isolated by academic term',async()=>{
  const client=createClient({url:'file::memory:'});
  const store=load('lib/registration/store.ts',{'@/db':{databaseClient:client},'./payload':payloads});
  await store.initializeStore();
  const fall=payloads.buildRegistrationPayload(cloud),winter=payloads.buildRegistrationPayload(cloud,{slot_year:'2026-27',semester_type:'WINTER'});
  assert.equal(await store.claimAttempt('owner','CSE2033',fall,false,payloads.defaultTerm),null);
  await store.finishAttempt('owner','CSE2033','success','Done',payloads.defaultTerm);
  assert.equal(await store.claimAttempt('owner','CSE2033',winter,false,{slot_year:'2026-27',semester_type:'WINTER'}),null);
  assert.equal((await store.previousAttempts('owner',payloads.defaultTerm)).CSE2033.outcome,'success');
  assert.equal((await store.previousAttempts('owner',{slot_year:'2026-27',semester_type:'WINTER'})).CSE2033.outcome,'uncertain');client.close();
});
test('unresolved official lookup prevents mutation and releases account lock',async()=>{
  let sent=0,released=0;
  const route=load('app/api/course-registration/execute/route.ts',{
    'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
    '@/lib/registration/payload':payloads,
    '@/lib/registration/server':{registrationIdentity:async()=>({userId:'owner'}),livePreflight:async()=>new Set(),sendRegistration:async()=>{sent++}},
    '@/lib/registration/lookup':{resolveOfficialCourse:async()=>{throw Error('No official venue')}},
    '@/lib/registration/store':{getPlan:async()=>payloads.buildPlan([cloud],payloads.defaultTerm,true),acquireUserLock:async()=>async()=>{released++},finishAttempt:async()=>{}}
  });
  const result=await route.POST({text:async()=>JSON.stringify({planId:require('node:crypto').randomUUID(),courseCode:'CSE2033'})});
  assert.equal(result.body.outcome,'blocked');assert.equal(result.body.sent,false);assert.equal(sent,0);assert.equal(released,1);
});
test('Slotwise can add missing official courses; combined links are not invented',async()=>{
  const {catalogueFromOfferings}=await import('../public/slotwise/offerings.mjs');
  const course=catalogueFromOfferings(official,'CSE2033');
  assert.equal(course.options[0].theory,'B1');assert.equal(course.options[0].theoryVenue,'515');assert.equal(course.options[0].theoryFaculty,'Dr. Varikuti Harinadh');
  const bad={...official,course_info:{...official.course_info,theory:3,practical:2},offerings:[...official.offerings,{...official.offerings[0],slots_offered:'B2'},{...official.offerings[0],slots_offered:'L1+L2'}]};
  assert.throws(()=>catalogueFromOfferings(bad,'CSE2033'),/links/);
});

test('seat availability parsing separates known zero from missing or descriptive values',()=>{
  for (const value of ['3',3,' 3 ','3.0']) {
    const parsed=offerings.parseSeatAvailability(value);assert.equal(parsed.state,'available');assert.equal(parsed.count,3);
  }
  for (const value of [null,undefined,'','Unknown','Available',-1,'3 seats']) assert.equal(offerings.parseSeatAvailability(value).state,'unknown');
  for (const value of [0,'0',' 0 ','0.0']) {
    const resolved=offerings.resolveSelection(cloud,payloads.defaultTerm,{...official,offerings:[{...official.offerings[0],available_seats:value}]});
    assert.equal(resolved.payload.venue,'515');assert.equal(resolved.seats[0].state,'full');
    assert.throws(()=>offerings.assertSeatsAvailable(resolved.seats),/university reported 0/);
  }
  const unknown=offerings.resolveSelection(cloud,payloads.defaultTerm,{...official,offerings:[{...official.offerings[0],available_seats:null}]});
  assert.equal(unknown.payload.venue,'515');assert.doesNotThrow(()=>offerings.assertSeatsAvailable(unknown.seats));
});
test('pre-send validation rejects nested, missing, placeholder and unexpected payloads before a POST or pending marker',async()=>{
  let sent=0;
  const h=serverHarness(async()=>{sent++;return new Response('{}')});
  const valid=payloads.buildRegistrationPayload(cloud);
  for (const bad of [{payload:valid},{...valid,venue:''},{...valid,course_code:undefined},{...valid,faculty_name:'Official lookup pending'},{...valid,action:'withdraw'}]) await assert.rejects(h.api.sendRegistration('user-a',bad),/incomplete or invalid/);
  assert.equal(sent,0);assert.equal(h.claims,0);
  assert.deepEqual(plain(payloads.validateRegistrationPayload(payloads.buildRegistrationPayload(blank))),plain(payloads.buildRegistrationPayload(blank)));
});
test('debug logs show exact JSON, HTTP rejection and missing-field diagnosis without leaking auth',async()=>{
  const trace=debug.createDebugTrace(true),calls=[];
  const error='Missing required fields: course_code, slot_name, slot_year, semester_type, venue, faculty_name';
  const h=serverHarness(async(url,options)=>{calls.push(options);return new Response(JSON.stringify({message:error,token:'private-test-token',nested:{authorization:'Bearer private-test-token'},detail:'token=private-test-token'}),{status:400,headers:{'Content-Type':'application/json'}})});
  const payload=payloads.buildRegistrationPayload(cloud);
  const result=await h.api.sendRegistration('user-a',payload,false,trace);
  assert.equal(result.outcome,'rejected');assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].body),plain(payload));
  const events=trace.report().events;
  assert.equal(events.find(e=>e.stage==='registration.response').data.status,400);
  assert.equal(events.find(e=>e.stage==='registration.format-diagnosis').data.locallyValidated,true);
  assert.equal(events.find(e=>e.stage==='registration.request').data.bodyText,calls[0].body);
  const report=JSON.stringify(events);assert.ok(report.includes(error));assert.ok(!report.includes('private-test-token'));
});
test('debug is opt-in, bounded, handles nested credentials and is request-scoped',()=>{
  assert.equal(debug.createDebugTrace(false).report(),undefined);
  const a=debug.createDebugTrace(true),b=debug.createDebugTrace(true);
  a.record('response',{password:'p',nested:{jwt:'j',cookie:'c',pin:'1234'},text:'Bearer abc.def.ghi',course_code:'CSE2033'});
  const data=a.report().events[0].data;
  assert.equal(data.password,'[REDACTED]');assert.equal(data.nested.pin,'[REDACTED]');assert.equal(data.course_code,'CSE2033');assert.ok(!JSON.stringify(data).includes('abc.def.ghi'));
  assert.equal(b.report().events.length,0);
  for(let i=0;i<200;i++)a.record('event',{body:'a'.repeat(50_000)});
  assert.equal(a.report().events.length,120);assert.ok(JSON.stringify(a.report().events[1].data).length<33_000);
});
test('overall Register rechecks blocked courses without resending successful, rejected or uncertain courses',()=>{
  const queue=load('lib/registration/queue.ts');
  const items=['CSE2001','CSE2002','CSE2003','CSE2004','CSE2005'].map(course_code=>({course:{course_code}}));
  const results={CSE2001:{outcome:'success'},CSE2002:{outcome:'blocked'},CSE2003:{outcome:'uncertain'},CSE2004:{outcome:'rejected'}};
  assert.deepEqual(plain(queue.registrationQueue(items,results)).map(item=>item.course.course_code),['CSE2002','CSE2005']);
  assert.deepEqual(plain(queue.registrationQueue(items,results,'CSE2004')).map(item=>item.course.course_code),['CSE2004']);
});
test('an unavailable import lookup is retried fresh when registration opens, then immediately POSTed with that course metadata',async()=>{
  let opened=false,reads=0;
  const lookup=load('lib/registration/lookup.ts',{'./payload':payloads,'./offerings':offerings,'@/lib/university/client':{universityRequest:async(path)=>{reads++;if(!opened)throw Error('Registration closed');return official}}});
  await assert.rejects(lookup.resolveOfficialCourse('owner',cloud,payloads.defaultTerm),/closed/);
  opened=true;
  const order=[];
  const route=load('app/api/course-registration/execute/route.ts',{
    'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
    '@/lib/registration/payload':payloads,
    '@/lib/registration/server':{registrationIdentity:async()=>({userId:'owner'}),livePreflight:async()=>new Set(),sendRegistration:async(user,payload)=>{order.push('POST');assert.equal(payload.venue,'515');assert.equal(payload.faculty_name,'Dr. Varikuti Harinadh');return {outcome:'success',sent:true}}},
    '@/lib/registration/lookup':{resolveOfficialCourse:async(...args)=>{order.push('GET');return lookup.resolveOfficialCourse(...args)}},
    '@/lib/registration/store':{getPlan:async()=>payloads.buildPlan([cloud],payloads.defaultTerm,true),acquireUserLock:async()=>async()=>{},finishAttempt:async()=>{}}
  });
  const result=await route.POST({text:async()=>JSON.stringify({planId:require('node:crypto').randomUUID(),courseCode:'CSE2033'})});
  assert.equal(result.body.outcome,'success');assert.deepEqual(order,['GET','POST']);assert.equal(reads,2);
});
test('known full seats block execution but preserve resolved venue details',async()=>{
  let sent=0;
  const resolved=offerings.resolveSelection(cloud,payloads.defaultTerm,{...official,offerings:[{...official.offerings[0],available_seats:'0'}]});
  const route=load('app/api/course-registration/execute/route.ts',{
    'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
    '@/lib/registration/payload':payloads,
    '@/lib/registration/server':{registrationIdentity:async()=>({userId:'owner'}),livePreflight:async()=>new Set(),sendRegistration:async()=>{sent++}},
    '@/lib/registration/lookup':{resolveOfficialCourse:async()=>resolved},
    '@/lib/registration/store':{getPlan:async()=>payloads.buildPlan([cloud],payloads.defaultTerm,true),acquireUserLock:async()=>async()=>{},finishAttempt:async()=>{}}
  });
  const result=await route.POST({text:async()=>JSON.stringify({planId:require('node:crypto').randomUUID(),courseCode:'CSE2033'})});
  assert.equal(result.body.outcome,'blocked');assert.equal(result.body.official.payload.venue,'515');assert.equal(sent,0);
});

test('real HTTP transport delivers a flat JSON body with content type and all required fields',async()=>{
  const http=require('node:http');
  const received=[];
  const server=http.createServer(async(request,response)=>{
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString('utf8');
    received.push({method:request.method,path:request.url,headers:request.headers,raw});
    response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({success:true}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const h=serverHarness(fetch,{baseUrl:`http://127.0.0.1:${server.address().port}`});
    const payload=offerings.resolveSelection(cloud,payloads.defaultTerm,official).payload;
    const result=await h.api.sendRegistration('user-a',payload,false,debug.createDebugTrace(true));
    assert.equal(result.outcome,'success');assert.equal(received.length,1);
    const sent=received[0];assert.equal(sent.method,'POST');assert.equal(sent.path,'/api/course-registration/register');assert.equal(sent.headers['content-type'],'application/json');
    assert.equal(Number(sent.headers['content-length']),Buffer.byteLength(sent.raw));
    const body=JSON.parse(sent.raw);
    assert.deepEqual(Object.keys(body).sort(),['course_code','slot_name','slot_year','semester_type','venue','faculty_name'].sort());
    assert.equal(body.course_code,'CSE2033');assert.equal(body.slot_name,'B1');assert.equal(body.venue,'515');
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('read-only university diagnostics retain non-2xx bodies but strip tokens and custom fetch options',async()=>{
  const callbacks=[];
  const client=load('lib/university/client.ts',{
    './config':{universityConfig:{baseUrl:'http://university.test',authMode:'bearer'}},
    './logger':{universityLog:()=>{}},
    './auth':{loginToUniversity:async()=>{throw Error('not needed')}},
    './token-store':{isTokenValid:()=>true,getCachedUniversityToken:()=>({token:'private-test-token'}),setCachedUniversityToken:()=>{},clearUniversityToken:()=>{}},
    '@/lib/db/queries':{},'@/lib/portal/auth':{},
  },{fetch:async(url,options)=>{
    assert.equal(options.onResponse,undefined);assert.equal(options.userId,undefined);
    return new Response(JSON.stringify({message:'Registration closed',token:'private-test-token',detail:'private-test-token'}),{status:403,headers:{'Content-Type':'application/json'}});
  }});
  await assert.rejects(client.universityRequest('/api/course-registration/course-offerings/CSE2033/2026-27/FALL',{userId:'owner',onResponse:event=>callbacks.push(event)}),/forbidden/);
  assert.equal(callbacks.length,1);assert.equal(callbacks[0].status,403);assert.equal(callbacks[0].body.message,'Registration closed');assert.ok(!JSON.stringify(callbacks).includes('private-test-token'));
});

test('readiness check is read-only, term-aware and returns a trace for closed registration',async()=>{
  let term;
  const mocks={
    'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
    '@/lib/registration/payload':payloads,
    '@/lib/registration/server':{registrationIdentity:async()=>({userId:'owner'}),livePreflight:async(user,input,trace)=>{term=input;trace.record('preflight.status',{enabled:true});return new Set(['CSE3008'])}}
  };
  const route=load('app/api/course-registration/check/route.ts',mocks);
  const request={headers:new Headers({'x-registration-debug':'1'}),text:async()=>JSON.stringify({term:{slot_year:'2026-27',semester_type:'WINTER'}})};
  let result=await route.POST(request);
  assert.equal(result.body.ready,true);assert.equal(term.semester_type,'WINTER');assert.deepEqual(plain(result.body.registeredCourseCodes),['CSE3008']);assert.equal(result.body.debug.events[0].data.enabled,true);
  mocks['@/lib/registration/server'].livePreflight=async()=>{throw Error('University course registration is closed.')};
  result=await route.POST(request);assert.equal(result.body.ready,false);assert.equal(result.status,400);assert.equal(result.body.debug.events[0].stage,'check.failed');
});
