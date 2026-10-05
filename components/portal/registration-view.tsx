'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, ShieldCheck, ArrowRight, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RegistrationDebugConsole } from './registration-debug-console';
import { sanitizeDebug, type DebugEntry, type DebugReport } from '@/lib/registration/debug';
import { registrationQueue } from '@/lib/registration/queue';
import type { SeatDetail } from '@/lib/registration/offerings';
import { buildPlan, selectionSchema, termSchema, defaultTerm, type RegistrationTerm, type RegistrationSelection, type RegistrationPayload } from '@/lib/registration/payload';

type Item = {course: RegistrationSelection; payload: RegistrationPayload | null; error?: string | null; seats?: SeatDetail[]; alreadyRegistered?: boolean; previousResult?: Result | null};
type Review = {planId: string; expiresAt: number; account: {name: string; enrollment: string}; items: Item[]};
type Result = {outcome: string; message: string};
const EXPORT_KEY = 'slotwise_registration_plan_v1';
const typeNames = {THEORY_LAB:'Theory + Lab', THEORY:'Theory', LAB:'Lab', PROJECT:'Project'};

export function RegistrationView({enrollment, onRegistered}: {enrollment: string; onRegistered?: () => void}) {
  const [courses, setCourses] = useState<RegistrationSelection[]>([]);
  const [term, setTerm] = useState<RegistrationTerm>(defaultTerm);
  const [items, setItems] = useState<Item[]>([]);
  const [planner, setPlanner] = useState(false);
  const [checking, setChecking] = useState(false);
  const [readiness, setReadiness] = useState<{ready:boolean; message:string} | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(process.env.NODE_ENV === 'development');
  const [debugEvents, setDebugEvents] = useState<DebugEntry[]>([]);
  const debugRef = useRef(debugEnabled), debugSequence = useRef(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, Result>>({});
  const [current, setCurrent] = useState('');
  const [stopRequested, setStopRequested] = useState(false);
  const stopped = useRef(false), sending = useRef(false), frame = useRef<HTMLIFrameElement>(null), revision = useRef(0);
  const importRef = useRef<(value: unknown) => void>(() => {});
  const reviewRef = useRef<Review | null>(null);

  const appendDebug = useCallback((entries: DebugEntry[]) => {
    if (!debugRef.current) return;
    const safeEntries = entries.slice(0,120).map(entry => ({...entry, id:`client-${++debugSequence.current}`, data:sanitizeDebug(entry.data)}));
    setDebugEvents(previous => [...previous,...safeEntries].slice(-250));
    for (const entry of safeEntries) {
      console.groupCollapsed(`[LMS² Registration] ${entry.stage} ${entry.courseCode || ''} · ${entry.timestamp}`);
      console.log(entry.data); console.groupEnd();
    }
  }, []);
  function log(stage: string, data: unknown, courseCode?: string) {
    appendDebug([{id:'', timestamp:new Date().toISOString(), stage, courseCode, data}]);
  }
  const receiveDebug = useCallback((report?: DebugReport) => {
    if (report && Array.isArray(report.events)) appendDebug(report.events);
  }, [appendDebug]);
  async function apiPost(path: string, payload: unknown, courseCode?: string) {
    const started=Date.now();
    log('portal.request', {method:'POST', path, payload}, courseCode);
    try {
      const response=await fetch(path, {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json', ...(debugRef.current ? {'x-registration-debug':'1'} : {})}, body:JSON.stringify(payload)});
      const raw=await response.text();
      let data;
      try {data=JSON.parse(raw);} catch {log('portal.response-error', {path, status:response.status, response:raw}, courseCode); throw new Error('The portal returned a non-JSON response. No automatic retry was made.');}
      receiveDebug(data.debug);
      log('portal.response', {path, status:response.status, elapsedMs:Date.now()-started, error:data.error, outcome:data.outcome, message:data.message}, courseCode);
      return {response,data};
    } catch(e) {log('portal.transport-error', {path, elapsedMs:Date.now()-started, message:(e as Error).message}, courseCode); throw e;}
  }
  useEffect(() => {
    setDebugEvents([]);
    let enabled=process.env.NODE_ENV === 'development';
    try {const saved=sessionStorage.getItem(`registration_debug_${enrollment}`); if (saved !== null) enabled=saved === '1';} catch {}
    debugRef.current=enabled; setDebugEnabled(enabled);
  },[enrollment]);

  async function lookup(selected: RegistrationSelection[], selectedTerm: RegistrationTerm, version: number) {
    setLooking(true);
    try {
      const {response,data} = await apiPost('/api/course-registration/resolve', {courses:selected, term:selectedTerm});
      if (!response.ok) throw new Error(data.error || 'Official offerings are unavailable.');
      if (revision.current === version) {setItems(data.items); setCourses(data.items.map((item: Item) => item.course));}
    } catch(e) {
      if (revision.current === version) setItems(selected.map(course => ({course, payload:null, error:(e as Error).message})));
    } finally {if (revision.current === version) setLooking(false);}
  }
  function importPlan(raw: unknown) {
    if (sending.current) return;
    try {
      const data = raw as {version:number; enrollment:string; slot_year:string; semester_type:string; courses:unknown[]};
      if (!data || data.version !== 1 || data.enrollment !== enrollment || !Array.isArray(data.courses) || !data.courses.length || data.courses.length > 30) throw new Error('Export a timetable while signed in to this account.');
      const selectedTerm = termSchema.parse({slot_year:data.slot_year, semester_type:data.semester_type});
      const parsed = data.courses.map(course => selectionSchema.parse(course));
      buildPlan(parsed, selectedTerm, true);
      log('plan.imported', {term:selectedTerm, courses:parsed.map(course => ({course_code:course.course_code, type:course.type, theory_slot:course.theory_slot, practical_slot:course.practical_slot}))});
      const version = ++revision.current;
      setCourses(parsed); setTerm(selectedTerm); setItems(parsed.map(course => ({course, payload:null}))); setConfirmed(false); setResults({}); setError(''); setPlanner(false); reviewRef.current = null;
      void lookup(parsed, selectedTerm, version);
    } catch(e) {setError((e as Error).message);}
  }
  importRef.current = importPlan;
  useEffect(() => {
    try {const saved=localStorage.getItem(EXPORT_KEY); if (saved) importRef.current(JSON.parse(saved));} catch {setError('Generate and export your Slotwise timetable again.');}
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'SLOTWISE_REGISTRATION_PLAN') importRef.current(event.data.plan);
      if (event.data?.type === 'SLOTWISE_REGISTRATION_DEBUG') receiveDebug(event.data.debug);
    };
    const invalidateRequests = () => {revision.current++;};
    window.addEventListener('message', receive);
    return () => {window.removeEventListener('message', receive); stopped.current=true; invalidateRequests();};
  }, [enrollment, receiveDebug]);

  async function checkReadiness() {
    if (busy || checking) return;
    const version=revision.current;
    setChecking(true);
    try {
      const {response,data}=await apiPost('/api/course-registration/check',{term});
      if (revision.current === version) setReadiness({ready:response.ok && data.ready === true, message:response.ok ? `Registration is open; existing timetable verified (${data.registeredCourseCodes.length} registered courses).` : data.error || 'Readiness could not be verified.'});
    } catch(e) {if (revision.current === version) setReadiness({ready:false,message:(e as Error).message});}
    finally {setChecking(false);}
  }
  async function run(retryCode?: string) {
    if (sending.current || checking || !confirmed || !courses.length) return;
    sending.current=true; stopped.current=false; setStopRequested(false); setBusy(true); setError('');
    // Invalidate background lookup results so they cannot overwrite fresh execution details.
    ++revision.current; setLooking(false);
    try {
      let review = reviewRef.current;
      if (!review || Date.now() >= review.expiresAt) {
        setCurrent('Checking registration');
        const {response,data} = await apiPost('/api/course-registration/prepare', {courses, term});
        if (!response.ok) throw new Error(data.error || 'Could not verify registration.');
        review = data as Review; reviewRef.current = review;
      }
      const queue = registrationQueue(review.items, results, retryCode);
      log('queue.start', {courses:queue.map(item => item.course.course_code), term, retryCode, sequential:true});
      for (const item of queue) {
        if (stopped.current) break;
        const code=item.course.course_code; setCurrent(code);
        if (item.alreadyRegistered || (item.previousResult && !(retryCode && item.previousResult.outcome === 'rejected'))) {
          const result=item.alreadyRegistered ? {outcome:'skipped', message:'Already registered. No request was sent.'} : item.previousResult!;
          setResults(previous => ({...previous, [code]:result}));
          if (result.outcome === 'uncertain') break;
          continue;
        }
        try {
          const {response,data}=await apiPost('/api/course-registration/execute', {planId:review.planId, courseCode:code, ...(retryCode ? {retryRejected:true} : {})}, code);
          if (!response.ok) {setError(data.error || 'Registration stopped.'); break;}
          setResults(previous => ({...previous, [code]:data}));
          if (data.official) setItems(previous => previous.map(entry => entry.course.course_code === code ? {...data.official, error:null} : entry));
          if (data.outcome === 'uncertain') {log('queue.stopped', {reason:'Uncertain university response; verify the timetable before retrying.'}, code); break;}
          if (data.outcome === 'success' || data.outcome === 'skipped') onRegistered?.();
        } catch {
          setResults(previous => ({...previous, [code]:{outcome:'uncertain', message:'Connection interrupted. Check your university timetable before retrying.'}})); break;
        }
      }
    } catch(e) {setError((e as Error).message);}
    finally {sending.current=false; setBusy(false); setCurrent('');}
  }
  const chooseTerm = (next: RegistrationTerm) => {
    ++revision.current; setTerm(next); setCourses([]); setItems([]); setResults({}); setConfirmed(false); setLooking(false); setReadiness(null); reviewRef.current=null;
    localStorage.removeItem(EXPORT_KEY);
  };
  const hasPending = courses.some(course => !results[course.course_code] || results[course.course_code].outcome === 'blocked');
  function toggleDebug(enabled: boolean) {
    debugRef.current=enabled; setDebugEnabled(enabled);
    try {sessionStorage.setItem(`registration_debug_${enrollment}`,enabled ? '1' : '0');} catch {}
    if (enabled && courses.length && !busy) {reviewRef.current=null; void lookup(courses,term,++revision.current);}
  }
  return <div className="min-w-0 space-y-5">
    <section className="rounded-2xl border border-indigo-100 bg-white p-5 sm:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Slotwise → LMS²</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">Course Registration</h2>
      <p className="mt-2 text-sm text-slate-500">Choose your timetable in Slotwise. We’ll fetch the official rooms and faculty, then register each course in order.</p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Year<input aria-label="Registration year" disabled={busy || looking || checking} value={term.slot_year} onChange={event => chooseTerm({...term, slot_year:event.target.value})} className="mt-1 block w-28 rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800"/></label>
        <label className="text-xs text-slate-500">Semester<select aria-label="Registration semester" disabled={busy || looking || checking} value={term.semester_type} onChange={event => chooseTerm({...term, semester_type:event.target.value as RegistrationTerm['semester_type']})} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800">{['FALL','WINTER','SUMMER'].map(value => <option key={value}>{value}</option>)}</select></label>
        <Button disabled={busy || !termSchema.safeParse(term).success} onClick={() => setPlanner(true)} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"><CalendarDays size={16}/>Open Slotwise</Button>
        <Button variant="outline" disabled={busy || checking || !termSchema.safeParse(term).success} onClick={checkReadiness}>{checking ? 'Checking registration…' : 'Check registration'}</Button>
      </div>
      {readiness && <p role="status" className={`mt-3 text-xs ${readiness.ready ? 'text-emerald-700' : 'text-rose-600'}`}>{readiness.message}</p>}
      <p className="mt-3 text-xs text-slate-400">Account: {enrollment} · Change courses and slots inside Slotwise.</p>
    </section>
    <RegistrationDebugConsole enabled={debugEnabled} events={debugEvents} onToggle={toggleDebug} onClear={() => setDebugEvents([])}/>
    {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {!courses.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center"><CalendarDays className="mx-auto text-indigo-300" size={32}/><h3 className="mt-3 font-bold text-slate-800">Start with your final timetable</h3><p className="mt-2 text-sm text-slate-500">Generate a timetable in Slotwise and click “Use this timetable”.</p></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-800">{courses.length} courses · {term.semester_type} {term.slot_year}</h3>{looking ? <span role="status" className="flex items-center gap-2 text-xs text-indigo-600"><Loader2 size={14} className="animate-spin"/>Fetching official offerings…</span> : <Button size="sm" variant="outline" disabled={busy} onClick={() => {reviewRef.current=null; void lookup(courses, term, ++revision.current);}}>Refresh official details</Button>}</div>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">{items.map(item => {
        const course=item.course, code=course.course_code, result=results[code], ready=!!item.payload, full=item.seats?.find(seat => seat.state === 'full'), unknown=item.seats?.some(seat => seat.state === 'unknown');
        return <section key={code} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-indigo-600">{code} · {typeNames[course.type]}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${result?.outcome === 'success' ? 'bg-emerald-50 text-emerald-700' : result || full || (!ready && !looking) ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{current === code ? 'Resolving & registering…' : result?.outcome || (full ? 'No seats available' : ready ? 'Official details ready' : looking ? 'Looking up…' : 'Venue not yet added')}</span></div>
          <h4 className="mt-3 break-words text-sm font-bold text-slate-800">{course.course_name}</h4>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            {course.type !== 'LAB' && <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">{course.type === 'PROJECT' ? 'Project' : `Theory · ${course.theory_slot}`}</p><p className="mt-1 break-words">{ready ? `${course.theory_faculty} · Room ${course.theory_venue}` : 'Faculty and venue awaiting official verification'}</p></div>}
            {(course.type === 'LAB' || course.type === 'THEORY_LAB') && <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">Lab · {course.practical_slot}</p><p className="mt-1 break-words">{ready ? `${course.practical_faculty} · Room ${course.practical_venue}` : 'Faculty and venue awaiting official verification'}</p></div>}
          </div>
          {item.seats && <p className={`mt-3 break-words text-xs ${full ? 'text-rose-600' : unknown ? 'text-amber-700' : 'text-slate-500'}`}>{item.seats.map(seat => `${seat.component} ${seat.slot}: ${seat.count === null ? 'seat count unavailable; university will validate' : `${seat.count} seat${seat.count === 1 ? '' : 's'} reported`}`).join(' · ')}</p>}
          {(result?.message || item.error) && <p role="status" className={`mt-3 break-words text-xs ${result?.outcome === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>{result?.message || item.error}</p>}
          {['rejected','blocked'].includes(result?.outcome || '') && <Button size="sm" variant="outline" className="mt-3" disabled={busy || !confirmed} onClick={() => run(code)}>Retry this course</Button>}
        </section>;
      })}</div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><ShieldCheck size={17} className="shrink-0 text-emerald-600"/><p>Each course gets a fresh official lookup immediately before registration. Unresolved courses are skipped with a reason. Existing courses stay untouched; uncertain responses stop the queue.</p></div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1 accent-indigo-600"/>Register this timetable for {enrollment}, using the university’s verified venue and faculty for each selected slot.</label>
        <div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => run()} disabled={busy || checking || !confirmed || !hasPending} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">{busy ? <Loader2 className="animate-spin" size={16}/> : <ArrowRight size={16}/>} {busy ? current || 'Registering…' : Object.values(results).some(result => result.outcome === 'blocked') ? 'Register remaining courses' : `Register ${courses.length} courses`}</Button>{busy && <Button variant="outline" disabled={stopRequested} onClick={() => {stopped.current=true;setStopRequested(true);}} className="gap-2"><Square size={14}/>{stopRequested ? 'Stopping after this course…' : 'Stop after this course'}</Button>}</div>
      </section>
    </>}
    <Dialog open={planner} onOpenChange={setPlanner}><DialogContent className="flex h-[90dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-2 border-slate-200 bg-white p-3 shadow-2xl sm:max-w-6xl"><DialogHeader className="shrink-0 bg-white pr-6 text-left"><DialogTitle>Choose your timetable</DialogTitle><DialogDescription>Select “Use this timetable” to bring its courses back here.</DialogDescription></DialogHeader><iframe ref={frame} title="Slotwise timetable planner" src={`/slotwise/index.html?registration=1&slot_year=${encodeURIComponent(term.slot_year)}&semester_type=${encodeURIComponent(term.semester_type)}&debug=${debugEnabled ? '1' : '0'}`} className="min-h-0 w-full flex-1 rounded-xl border border-slate-200 bg-white"/></DialogContent></Dialog>
  </div>;
}
