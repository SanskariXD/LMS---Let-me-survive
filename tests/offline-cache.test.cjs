const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const {createClient} = require('@libsql/client');
const {NextRequest, NextResponse} = require('next/server');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code, {exports,require:n => n in mocks ? mocks[n] : require(n),process:{env:{NODE_ENV:'test',SESSION_SECRET:'a-test-secret-of-at-least-thirty-two-bytes',DATABASE_URL:'file::memory:'}},console,Buffer,URL,URLSearchParams,Headers,Request,Response,AbortSignal,TextEncoder,...globals});
  return exports;
}
async function database() {
  const client=createClient({url:'file::memory:'});
  const auth=load('lib/portal/auth.ts');
  const schema=load('db/schema.ts');
  const db=load('db/index.ts',{'./schema':schema,'@/lib/portal/auth':auth,'@libsql/client':{createClient:()=>client}});
  await db.ensureDbInitialized();
  const q=load('lib/db/queries.ts',{'@/db':db,'@/db/schema':schema,'@/lib/portal/auth':auth,'@/lib/security/urls':{}});
  const user=await q.upsertUser({enrollmentNumber:'alice',studentName:'Alice'});
  return {client,q,id:user.id};
}
const course={course_code:'CS1',slot_year:'2026-27',semester_type:'FALL',total_classes:20,present_classes:18};
const key=JSON.stringify(['2026-27','FALL']);

test('database updates actually persist mapped fields and preserve unrelated sections',async()=>{
  const {client,q,id}=await database();
  try {
    await q.saveUniversityCachedData(id,{attendanceJson:'{"courses":[1]}',marksJson:'{"score":9}'});
    await q.saveUniversityCachedData(id,{attendanceJson:'{"courses":[2]}',semestersJson:'["FALL"]'});
    const row=await q.getUniversityCachedData(id);
    assert.equal(row.attendance_json,'{"courses":[2]}');
    assert.equal(row.marks_json,'{"score":9}');
    assert.equal(row.semesters_json,'["FALL"]');
  } finally {client.close();}
});
test('attendance atomic saves keep concurrent terms and reports isolated by user',async()=>{
  const {client,q,id}=await database();
  try {
    const keys=[key,JSON.stringify(['2025-26','SUMMER']),JSON.stringify(['2026-27','FALL','CS1','A1'])];
    await Promise.all(keys.map((k,i)=>q.saveAttendanceCacheEntry(id,k,{courses:[i],fetchedAt:'2026-11-01T05:00:00Z'})));
    for(let i=0;i<keys.length;i++) assert.equal((await q.getAttendanceCacheEntry(id,keys[i])).courses[0],i);
    assert.equal(await q.getAttendanceCacheEntry('another-user',key),null);
    assert.equal(await q.getAttendanceCacheEntry(id,JSON.stringify(['2026-27','WINTER'])),null);
  } finally {client.close();}
});
test('legacy attendance recovers only when rows identify the requested semester',async()=>{
  const {client,q,id}=await database();
  try {
    await q.saveUniversityCachedData(id,{attendanceJson:JSON.stringify({courses:[course]})});
    assert.equal((await q.getAttendanceCacheEntry(id,key)).courses[0].course_code,'CS1');
    assert.equal(await q.getAttendanceCacheEntry(id,JSON.stringify(['2025-26','SUMMER'])),null);
    await q.saveUniversityCachedData(id,{attendanceJson:JSON.stringify({courses:[{course_code:'unlabelled'}]})});
    assert.equal(await q.getAttendanceCacheEntry(id,key),null);
  } finally {client.close();}
});
function attendanceRoute(upstream, cached, save=async()=>{}) {
  return load('app/api/university/attendance/route.ts', {
    'next/server':{NextResponse}, '@/lib/portal/session':{validateSession:async()=>({userId:'alice'})},
    '@/lib/university/client':{universityRequest:upstream}, '@/lib/university/endpoints':{UNIVERSITY_ENDPOINTS:{attendance:'/attendance'}},
    '@/lib/university/normalize':{normalizeAttendance:x=>{if(!Array.isArray(x))throw Error('malformed');return x;}},
    '@/lib/db/queries':{getAttendanceCacheEntry:async(user,k)=>{assert.equal(user,'alice');assert.equal(k,key);return cached;},saveAttendanceCacheEntry:save},
  });
}
const attendanceReq=(extra='')=>new NextRequest('https://portal.test/api/university/attendance?slot_year=2026-27&semester_type=FALL'+extra);
test('outage, malformed and empty responses preserve the saved attendance and original timestamp',async()=>{
  const saved={courses:[course],fetchedAt:'2026-11-01T05:00:00Z'};
  for(const result of [()=>{throw Error('offline');},()=>({error:'offline'}),()=>[]]) {
    let writes=0;
    const route=attendanceRoute(async()=>result(),saved,async()=>writes++);
    const res=await route.GET(attendanceReq());const data=await res.json();
    assert.equal(res.status,200);assert.deepEqual(data.courses,[course]);assert.equal(data.isOffline,true);assert.equal(data.fetchedAt,saved.fetchedAt);assert.equal(writes,0);
  }
});
test('cache-only attendance never contacts upstream; cache miss is unavailable rather than empty success',async()=>{
  let calls=0;
  const route=attendanceRoute(async()=>{calls++;},null);
  const res=await route.GET(attendanceReq('&cache_only=1'));
  assert.equal(calls,0);assert.equal(res.status,503);assert.equal((await res.json()).courses,undefined);
});
test('successful attendance waits for durable cache before completing the response',async()=>{
  let release,started=false,done=false;
  const gate=new Promise(r=>release=r);
  const route=attendanceRoute(async()=>[course],null,async()=>{started=true;await gate;});
  const pending=route.GET(attendanceReq()).then(r=>{done=true;return r;});
  await new Promise(r=>setImmediate(r));assert.equal(started,true);assert.equal(done,false);
  release();assert.equal((await pending).status,200);
});
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('browser cache retains multiple terms and marks/curriculum across reloads without crossing accounts',()=>{
  const localStorage=storage();const globals={window:{},localStorage};
  const cache=load('lib/offline-storage.ts',{},globals);
  cache.saveUniversitySnapshot('alice',{attendanceItems:[course],attendanceSemester:'2026-27|FALL',marksData:{courses:[{course:'A'}],coursesSemester:'2026-27|FALL'},academicsData:{credits:80}});
  cache.saveUniversitySnapshot('alice',{attendanceItems:[{course_code:'SUMMER'}],attendanceSemester:'2025-26|SUMMER',marksData:{courses:[{course:'B'}],coursesSemester:'2025-26|SUMMER'}});
  const reload=load('lib/offline-storage.ts',{},globals).getUniversitySnapshot('alice');
  assert.equal(reload.attendanceBySemester['2026-27|FALL'].courses[0].course_code,'CS1');
  assert.equal(reload.marksData.coursesBySemester['2026-27|FALL'][0].course,'A');
  assert.equal(reload.academicsData.credits,80);assert.equal(cache.getUniversitySnapshot('bob'),null);
});
test('offline browser pauses university requests; cache-only reads remain available and explicit retry recovers',async()=>{
  const paths=[];let offline=true;
  const api=load('lib/university/browser-request.ts',{'@/lib/offline-storage':{isUniversityExpectedDowntime:()=>false}}, {sessionStorage:storage(),fetch:async path=>{paths.push(path);return Response.json(offline?{courses:[course],isOffline:true}:{courses:[course]});}});
  await api.request('attendance?slot_year=2026-27&semester_type=FALL');
  assert.equal(api.universitySyncPaused(),true);
  await assert.rejects(api.request('marks/semesters'));assert.equal(paths.length,1);
  await api.request('bootstrap');assert.equal(paths[1],'/api/university/bootstrap?cache_only=1');
  api.resumeUniversitySync();offline=false;
  assert.equal(api.universitySyncPaused(),false);
  await api.request('attendance?slot_year=2026-27&semester_type=FALL');assert.ok(!paths[2].includes('cache_only'));
});
test('scheduled downtime uses saved attendance immediately without probing the university',async()=>{
  const paths=[];
  const api=load('lib/university/browser-request.ts',{'@/lib/offline-storage':{isUniversityExpectedDowntime:()=>true}}, {sessionStorage:storage(),fetch:async p=>{paths.push(p);return Response.json({courses:[course],isOffline:true});}});
  await api.request('attendance?slot_year=2026-27&semester_type=FALL');
  assert.ok(paths[0].endsWith('&cache_only=1'));await assert.rejects(api.request('academics/history'));assert.equal(paths.length,1);
});

function extractedPortalFunction(name, globals) {
  const file=ts.createSourceFile('portal.tsx',fs.readFileSync('app/portal.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let fn;
  function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)fn=n;ts.forEachChild(n,visit);}visit(file);
  assert.ok(fn,`missing ${name}`);
  const code=ts.transpileModule(fn.getText(file),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const context=vm.createContext({URLSearchParams,console,...globals});
  vm.runInContext(code,context);return context[name];
}
test('actual attendance UI loader keeps saved rows during refresh and never persists offline emptiness',async()=>{
  let rows=[course],loading=false,offline=false,writes=0,release;
  const gate=new Promise(r=>release=r);
  const loadAttendance=extractedPortalFunction('fetchAttendance',{
    serial:{current:0},displayedAttendanceTerm:{current:'2026-27|FALL'},session:{user:{enrollment:'alice'}},
    setLoading:x=>loading=x,setError:()=>{},setAttendanceItems:x=>rows=typeof x==='function'?x(rows):x,
    setIsUsingSavedData:x=>offline=x,setSavedDataTimestamp:()=>{},pauseUniversitySync:()=>{},
    getUniversitySnapshot:()=>({attendanceItems:[course],timestamp:'2026-11-01T05:00:00Z'}),
    saveUniversitySnapshot:()=>writes++,handleSessionExpired:()=>{},request:async()=>{await gate;return {courses:[],isOffline:true};},
  });
  const pending=loadAttendance('2026-27|FALL');
  assert.equal(rows[0].course_code,'CS1');assert.equal(loading,true);
  release();await pending;
  assert.equal(rows[0].present_classes,18);assert.equal(offline,true);assert.equal(loading,false);assert.equal(writes,0);
});
test('late attendance response cannot overwrite a newer semester selection',async()=>{
  let rows=null,release;
  const gate=new Promise(r=>release=r);
  const loader=extractedPortalFunction('fetchAttendance',{
    serial:{current:0},displayedAttendanceTerm:{current:''},session:{user:{enrollment:'alice'}},
    setLoading:()=>{},setError:()=>{},setAttendanceItems:x=>rows=typeof x==='function'?x(rows):x,
    setIsUsingSavedData:()=>{},setSavedDataTimestamp:()=>{},pauseUniversitySync:()=>{},
    getUniversitySnapshot:()=>null,saveUniversitySnapshot:()=>{},handleSessionExpired:()=>{},
    request:async path=>{if(path.includes('FALL')){await gate;return {courses:[course]};}return {courses:[{course_code:'WINTER'}]};},
  });
  const old=loader('2026-27|FALL');await loader('2026-27|WINTER');release();await old;
  assert.equal(rows[0].course_code,'WINTER');
});
test('partial university curriculum fetch fails instead of publishing an incomplete degree audit',async()=>{
  const route=load('app/api/university/academics/history/route.ts',{
    'next/server':{NextResponse},'@/lib/portal/session':{validateSession:async()=>({userId:'alice'})},
    '@/lib/university/endpoints':{UNIVERSITY_ENDPOINTS:{mySemesters:'/semesters',myTimetable:()=>'/timetable'}},
    '@/lib/university/client':{universityRequest:async path=>{if(path==='/semesters')return [{slot_year:'2026-27',semester_type:'FALL'}];throw Error('offline');}},
    '@/lib/university/curriculum':{auditDegreeProgress:()=>{throw Error('must not audit incomplete data');}},
    '@/lib/db/queries':{getUserManualCourses:async()=>[]},
  });
  const response=await route.GET(new NextRequest('https://portal.test/api/university/academics/history'));
  assert.equal(response.status,502);assert.equal((await response.json()).isOffline,true);
});
test('locking and PIN unlock retain account snapshots; forget-device clears them and unscoped private data',()=>{
  const source=ts.createSourceFile('gate.tsx',fs.readFileSync('app/portal-gate.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='clearPrivateBrowserCache');
  const localStorage={slotwise_univ_cache_alice:'saved',slotwise_univ_synced_at_alice:'then',slotwise_portal_tasks:'private',removeItem(k){delete this[k];}};
  const ctx=vm.createContext({localStorage});vm.runInContext(ts.transpileModule(fn.getText(source),{}).outputText,ctx);
  ctx.clearPrivateBrowserCache();assert.equal(localStorage.slotwise_univ_cache_alice,'saved');assert.equal(localStorage.slotwise_portal_tasks,undefined);
  ctx.clearPrivateBrowserCache(true);assert.equal(localStorage.slotwise_univ_cache_alice,undefined);
});
