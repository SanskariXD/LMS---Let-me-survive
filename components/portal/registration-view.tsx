'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, ShieldCheck, ArrowRight, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { buildPlan, selectionSchema, termSchema, defaultTerm, type RegistrationTerm, type RegistrationSelection, type RegistrationPayload } from '@/lib/registration/payload';

type Item = {course: RegistrationSelection; payload: RegistrationPayload | null; error?: string | null; alreadyRegistered?: boolean; previousResult?: Result | null};
type Review = {planId: string; expiresAt: number; account: {name: string; enrollment: string}; items: Item[]};
type Result = {outcome: string; message: string};
const EXPORT_KEY = 'slotwise_registration_plan_v1';
const typeNames = {THEORY_LAB:'Theory + Lab', THEORY:'Theory', LAB:'Lab', PROJECT:'Project'};

export function RegistrationView({enrollment, onRegistered}: {enrollment: string; onRegistered?: () => void}) {
  const [courses, setCourses] = useState<RegistrationSelection[]>([]);
  const [term, setTerm] = useState<RegistrationTerm>(defaultTerm);
  const [items, setItems] = useState<Item[]>([]);
  const [planner, setPlanner] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, Result>>({});
  const [current, setCurrent] = useState('');
  const [stopRequested, setStopRequested] = useState(false);
  const stopped = useRef(false), sending = useRef(false), frame = useRef<HTMLIFrameElement>(null), revision = useRef(0);
  const importRef = useRef<(value: unknown) => void>(() => {});
  const reviewRef = useRef<Review | null>(null);

  async function lookup(selected: RegistrationSelection[], selectedTerm: RegistrationTerm, version: number) {
    setLooking(true);
    try {
      const response = await fetch('/api/course-registration/resolve', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({courses:selected, term:selectedTerm})});
      const data = await response.json();
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
      const version = ++revision.current;
      setCourses(parsed); setTerm(selectedTerm); setItems(parsed.map(course => ({course, payload:null}))); setConfirmed(false); setResults({}); setError(''); setPlanner(false); reviewRef.current = null;
      void lookup(parsed, selectedTerm, version);
    } catch(e) {setError((e as Error).message);}
  }
  importRef.current = importPlan;
  useEffect(() => {
    try {const saved=localStorage.getItem(EXPORT_KEY); if (saved) importRef.current(JSON.parse(saved));} catch {setError('Generate and export your Slotwise timetable again.');}
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'SLOTWISE_REGISTRATION_PLAN') importRef.current(event.data.plan);
    };
    window.addEventListener('message', receive);
    return () => {window.removeEventListener('message', receive); stopped.current=true; revision.current++;};
  }, [enrollment]);

  async function run(retryCode?: string) {
    if (sending.current || !confirmed || !courses.length) return;
    sending.current=true; stopped.current=false; setStopRequested(false); setBusy(true); setError('');
    // Invalidate background lookup results so they cannot overwrite fresh execution details.
    ++revision.current; setLooking(false);
    try {
      let review = reviewRef.current;
      if (!review || Date.now() >= review.expiresAt) {
        setCurrent('Checking registration');
        const response = await fetch('/api/course-registration/prepare', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({courses, term})});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not verify registration.');
        review = data as Review; reviewRef.current = review;
      }
      const queue = retryCode ? review.items.filter(item => item.course.course_code === retryCode) : review.items.filter(item => !results[item.course.course_code]);
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
          const response=await fetch('/api/course-registration/execute', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({planId:review.planId, courseCode:code, ...(retryCode ? {retryRejected:true} : {})})});
          const data=await response.json();
          if (!response.ok) {setError(data.error || 'Registration stopped.'); break;}
          setResults(previous => ({...previous, [code]:data}));
          if (data.official) setItems(previous => previous.map(entry => entry.course.course_code === code ? {...data.official, error:null} : entry));
          if (data.outcome === 'uncertain') break;
          if (data.outcome === 'success' || data.outcome === 'skipped') onRegistered?.();
        } catch {
          setResults(previous => ({...previous, [code]:{outcome:'uncertain', message:'Connection interrupted. Check your university timetable before retrying.'}})); break;
        }
      }
    } catch(e) {setError((e as Error).message);}
    finally {sending.current=false; setBusy(false); setCurrent('');}
  }
  const chooseTerm = (next: RegistrationTerm) => {
    ++revision.current; setTerm(next); setCourses([]); setItems([]); setResults({}); setConfirmed(false); setLooking(false); reviewRef.current=null;
    localStorage.removeItem(EXPORT_KEY);
  };
  return <div className="min-w-0 space-y-5">
    <section className="rounded-2xl border border-indigo-100 bg-white p-5 sm:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Slotwise → LMS²</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">Course Registration</h2>
      <p className="mt-2 text-sm text-slate-500">Choose your timetable in Slotwise. We’ll fetch the official rooms and faculty, then register each course in order.</p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Year<input aria-label="Registration year" disabled={busy || looking} value={term.slot_year} onChange={event => chooseTerm({...term, slot_year:event.target.value})} className="mt-1 block w-28 rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800"/></label>
        <label className="text-xs text-slate-500">Semester<select aria-label="Registration semester" disabled={busy || looking} value={term.semester_type} onChange={event => chooseTerm({...term, semester_type:event.target.value as RegistrationTerm['semester_type']})} className="mt-1 block rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800">{['FALL','WINTER','SUMMER'].map(value => <option key={value}>{value}</option>)}</select></label>
        <Button disabled={busy || !termSchema.safeParse(term).success} onClick={() => setPlanner(true)} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"><CalendarDays size={16}/>Open Slotwise</Button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Account: {enrollment} · Change courses and slots inside Slotwise.</p>
    </section>
    {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {!courses.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center"><CalendarDays className="mx-auto text-indigo-300" size={32}/><h3 className="mt-3 font-bold text-slate-800">Start with your final timetable</h3><p className="mt-2 text-sm text-slate-500">Generate a timetable in Slotwise and click “Use this timetable”.</p></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-800">{courses.length} courses · {term.semester_type} {term.slot_year}</h3>{looking ? <span role="status" className="flex items-center gap-2 text-xs text-indigo-600"><Loader2 size={14} className="animate-spin"/>Fetching official offerings…</span> : <Button size="sm" variant="outline" disabled={busy} onClick={() => {reviewRef.current=null; void lookup(courses, term, ++revision.current);}}>Refresh official details</Button>}</div>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">{items.map(item => {
        const course=item.course, code=course.course_code, result=results[code], ready=!!item.payload;
        return <section key={code} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-indigo-600">{code} · {typeNames[course.type]}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${result?.outcome === 'success' ? 'bg-emerald-50 text-emerald-700' : result || (!ready && !looking) ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{current === code ? 'Resolving & registering…' : result?.outcome || (ready ? 'Official details ready' : looking ? 'Looking up…' : 'Venue not yet added')}</span></div>
          <h4 className="mt-3 break-words text-sm font-bold text-slate-800">{course.course_name}</h4>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            {course.type !== 'LAB' && <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">{course.type === 'PROJECT' ? 'Project' : `Theory · ${course.theory_slot}`}</p><p className="mt-1 break-words">{ready ? `${course.theory_faculty} · Room ${course.theory_venue}` : 'Faculty and venue awaiting official verification'}</p></div>}
            {(course.type === 'LAB' || course.type === 'THEORY_LAB') && <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">Lab · {course.practical_slot}</p><p className="mt-1 break-words">{ready ? `${course.practical_faculty} · Room ${course.practical_venue}` : 'Faculty and venue awaiting official verification'}</p></div>}
          </div>
          {(result?.message || item.error) && <p role="status" className={`mt-3 break-words text-xs ${result?.outcome === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>{result?.message || item.error}</p>}
          {['rejected','blocked'].includes(result?.outcome || '') && <Button size="sm" variant="outline" className="mt-3" disabled={busy || !confirmed} onClick={() => run(code)}>Retry this course</Button>}
        </section>;
      })}</div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><ShieldCheck size={17} className="shrink-0 text-emerald-600"/><p>Each course gets a fresh official lookup immediately before registration. Unresolved courses are skipped with a reason. Existing courses stay untouched; uncertain responses stop the queue.</p></div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1 accent-indigo-600"/>Register this timetable for {enrollment}, using the university’s verified venue and faculty for each selected slot.</label>
        <div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => run()} disabled={busy || !confirmed || courses.every(course => !!results[course.course_code])} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">{busy ? <Loader2 className="animate-spin" size={16}/> : <ArrowRight size={16}/>} {busy ? current || 'Registering…' : `Register ${courses.length} courses`}</Button>{busy && <Button variant="outline" disabled={stopRequested} onClick={() => {stopped.current=true;setStopRequested(true);}} className="gap-2"><Square size={14}/>{stopRequested ? 'Stopping after this course…' : 'Stop after this course'}</Button>}</div>
      </section>
    </>}
    <Dialog open={planner} onOpenChange={setPlanner}><DialogContent className="flex h-[90dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-2 border-slate-200 bg-white p-3 shadow-2xl sm:max-w-6xl"><DialogHeader className="shrink-0 bg-white pr-6 text-left"><DialogTitle>Choose your timetable</DialogTitle><DialogDescription>Select “Use this timetable” to bring its courses back here.</DialogDescription></DialogHeader><iframe ref={frame} title="Slotwise timetable planner" src={`/slotwise/index.html?registration=1&slot_year=${encodeURIComponent(term.slot_year)}&semester_type=${encodeURIComponent(term.semester_type)}`} className="min-h-0 w-full flex-1 rounded-xl border border-slate-200 bg-white"/></DialogContent></Dialog>
  </div>;
}
