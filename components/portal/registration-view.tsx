'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardCheck, Loader2, ShieldCheck, ArrowRight, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { buildPlan, selectionSchema, type RegistrationSelection, type RegistrationPayload } from '@/lib/registration/payload';

type Item = { course: RegistrationSelection; payload: RegistrationPayload; alreadyRegistered: boolean; previousResult?: Result | null };
type Review = { planId: string; expiresAt: number; account: {name: string; enrollment: string}; items: Item[] };
type Result = { outcome: string; message: string };
const EXPORT_KEY = 'slotwise_registration_plan_v1';
const typeNames = { THEORY_LAB: 'Theory + Lab', THEORY: 'Theory', LAB: 'Lab', PROJECT: 'Project' };

export function RegistrationView({ enrollment, onRegistered }: {enrollment: string; onRegistered?: () => void}) {
  const [courses, setCourses] = useState<RegistrationSelection[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [planner, setPlanner] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, Result>>({});
  const [current, setCurrent] = useState('');
  const [stopRequested, setStopRequested] = useState(false);
  const stopped = useRef(false), sending = useRef(false), frame = useRef<HTMLIFrameElement>(null);
  const importRef = useRef<(value: unknown) => void>(() => {});

  function importPlan(raw: unknown) {
    if (sending.current) return;
    try {
      const data = raw as {version: number; enrollment: string; slot_year: string; semester_type: string; courses: unknown[]};
      if (!data || data.version !== 1 || data.enrollment !== enrollment || data.slot_year !== '2026-27' || data.semester_type !== 'FALL' || !Array.isArray(data.courses) || !data.courses.length || data.courses.length > 30) throw new Error('Export a Fall 2026–27 timetable while signed in to this account.');
      const parsed = data.courses.map((course) => selectionSchema.parse(course));
      setCourses(parsed); setChosen(new Set(parsed.map((_, i) => i))); setReview(null); setConfirmed(false); setResults({}); setError(''); setPlanner(false);
    } catch (e) { setError((e as Error).message); }
  }
  importRef.current = importPlan;
  useEffect(() => {
    try { const saved = localStorage.getItem(EXPORT_KEY); if (saved) importRef.current(JSON.parse(saved)); } catch { setError('The saved Slotwise plan could not be read. Generate and export it again.'); }
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'SLOTWISE_REGISTRATION_PLAN') importRef.current(event.data.plan);
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); stopped.current = true; };
  }, [enrollment]);

  const selected = useMemo(() => courses.filter((_, index) => chosen.has(index)), [courses, chosen]);
  const validation = useMemo(() => {
    if (!selected.length) return 'Select at least one course.';
    try { buildPlan(selected); return ''; } catch (e) { return (e as Error).message; }
  }, [selected]);
  const resetReview = () => {setReview(null); setConfirmed(false); setResults({});};
  function edit(index: number, field: keyof RegistrationSelection, value: string) {
    resetReview(); setCourses((previous) => previous.map((course, i) => i === index ? {...course, [field]: value} as RegistrationSelection : course));
  }
  async function reviewPlan() {
    if (reviewing || busy || validation) return;
    setReviewing(true); setError(''); setConfirmed(false);
    try {
      const response = await fetch('/api/course-registration/prepare', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({courses:selected})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not review these courses.');
      setReview(data); setResults(Object.fromEntries(data.items.filter((item: Item) => item.alreadyRegistered || item.previousResult).map((item: Item) => [item.payload.course_code, item.alreadyRegistered ? {outcome:'skipped', message:'Already registered; will be skipped.'} : item.previousResult])));
    } catch(e) {setError((e as Error).message);} finally {setReviewing(false);}
  }
  async function run(retryCode?: string) {
    if (sending.current || !review || !confirmed) return;
    if (Date.now() >= review.expiresAt) {setError('This review expired. Review the courses again.'); return;}
    sending.current = true; stopped.current = false; setStopRequested(false); setBusy(true); setError('');
    try {
      const queue = retryCode ? review.items.filter((item) => item.payload.course_code === retryCode) : review.items.filter((item) => !item.alreadyRegistered && !results[item.payload.course_code]);
      for (const item of queue) {
        if (stopped.current) break;
        const code = item.payload.course_code; setCurrent(code);
        try {
          const response = await fetch('/api/course-registration/execute', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({planId:review.planId, courseCode:code, ...(retryCode ? {retryRejected:true} : {})})});
          const data = await response.json();
          if (!response.ok) {
            setError(data.error || 'Registration stopped.');
            stopped.current = true;
            break;
          }
          setResults((previous) => ({...previous, [code]:data}));
          if (data.outcome === 'uncertain') {stopped.current = true; break;}
          if (data.outcome === 'success' || data.outcome === 'skipped') onRegistered?.();
        } catch {
          setResults((previous) => ({...previous, [code]:{outcome:'uncertain', message:'Connection interrupted. Check your university timetable before trying this course again.'}}));
          stopped.current = true; break;
        }
      }
    } finally {sending.current=false; setBusy(false); setCurrent('');}
  }
  const field = (index: number, key: keyof RegistrationSelection, label: string, placeholder = '') => (
    <label className="min-w-0 text-xs font-medium text-slate-500">{label}<input aria-label={`${courses[index].course_code} ${label}`} value={courses[index][key]} placeholder={placeholder} disabled={busy || reviewing} onChange={(event) => edit(index,key,event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50" /></label>
  );
  return <div className="min-w-0 space-y-5">
    <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Slotwise → LMS²</p><h2 className="mt-2 text-xl font-bold text-slate-900">Course Registration</h2><p className="mt-1 text-sm text-slate-500">Build your week. Review your selections. Register once.</p></div><span className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700">Fall 2026–27</span></div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">{[[CalendarDays,'01','Choose timetable'],[ClipboardCheck,'02','Review exact requests'],[CheckCircle2,'03','Register & track']].map(([Icon,number,label]) => {const I=Icon as typeof CalendarDays; return <div key={String(number)} className="flex items-center gap-3 rounded-xl border border-white bg-white/80 p-3"><I size={18} className="text-indigo-500"/><span className="text-xs font-semibold text-slate-700">{String(number)} · {String(label)}</span></div>;})}</div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={() => setPlanner(true)} disabled={busy || reviewing} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"><CalendarDays size={16}/>Open Slotwise</Button><Button variant="outline" disabled={busy || reviewing} onClick={() => {try {const saved=localStorage.getItem(EXPORT_KEY); if (!saved) throw new Error('Choose “Use this timetable” in Slotwise first.'); importPlan(JSON.parse(saved));} catch(e) {setError((e as Error).message);}}}>Import saved timetable</Button><span className="text-xs text-slate-400">Account: {enrollment}</span></div>
    </section>
    <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs leading-relaxed text-emerald-900"><ShieldCheck className="shrink-0" size={18}/><p>Only selected courses are added. Existing registrations are skipped. Missing venues and faculty must be completed before review. Requests run one at a time; inconclusive results stop the queue.</p></div>
    {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {!courses.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center"><CalendarDays className="mx-auto text-indigo-300" size={32}/><h3 className="mt-3 font-bold text-slate-800">Start with your final timetable</h3><p className="mt-2 text-sm text-slate-500">Open Slotwise, generate your options, then select “Use this timetable”.</p></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-800">{selected.length} courses selected</h3><span className="text-xs text-slate-500">Check the venue and exact faculty spelling against the official portal.</span></div>
      {courses.map((course,index) => <section key={index} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3"><input type="checkbox" aria-label={`Select ${course.course_code}`} checked={chosen.has(index)} disabled={busy || reviewing} onChange={(event) => {resetReview();setChosen((previous) => {const next=new Set(previous);event.target.checked ? next.add(index) : next.delete(index);return next;});}} className="mt-1 h-4 w-4 accent-indigo-600"/><div className="min-w-0 flex-1"><h4 className="break-words text-sm font-bold text-slate-800">{course.course_name}</h4><p className="mt-0.5 text-xs text-indigo-600">{course.course_code} · {typeNames[course.type]}</p></div></div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{field(index,'course_code','Course code')}<label className="text-xs font-medium text-slate-500">Course type<select disabled={busy || reviewing} value={course.type} onChange={(event) => edit(index,'type',event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">{Object.entries(typeNames).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {course.type !== 'LAB' && <div className="mt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{course.type === 'PROJECT' ? 'Project' : 'Theory'} component</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{course.type !== 'PROJECT' && field(index,'theory_slot','Theory slot','A2')}{field(index,'theory_venue',course.type === 'PROJECT' ? 'Project venue' : 'Theory venue',course.type === 'PROJECT' ? 'N/A' : 'Required')}{field(index,'theory_faculty',course.type === 'PROJECT' ? 'Project faculty' : 'Theory faculty','Exact official name')}</div></div>}
        {(course.type === 'LAB' || course.type === 'THEORY_LAB') && <div className="mt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Lab component</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{field(index,'practical_slot','Lab pair','L19+L20')}{field(index,'practical_venue','Lab venue','Required')}{field(index,'practical_faculty','Lab faculty','Exact official name')}</div></div>}
      </section>)}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        {!review ? <><p className="mb-3 text-xs text-slate-500">{validation || 'Your payloads are complete. Review will check live registration status and existing courses.'}</p><Button onClick={reviewPlan} disabled={!!validation || reviewing || busy} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">{reviewing ? <Loader2 className="animate-spin" size={16}/> : <ClipboardCheck size={16}/>}Review {selected.length} courses</Button></> : <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Final review</h3><p className="mt-1 text-xs text-slate-500">{review.account.name} · {review.account.enrollment} · Fall 2026–27</p></div><Button variant="outline" disabled={busy} onClick={resetReview}>Edit / refresh review</Button></div>
          <div className="mt-4 space-y-3">{review.items.map((item) => {const code=item.payload.course_code,result=results[code];return <div key={code} className="min-w-0 rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{code}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${result?.outcome === 'success' ? 'bg-emerald-50 text-emerald-700' : result?.outcome === 'uncertain' || result?.outcome === 'rejected' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{current === code ? 'Sending…' : result?.outcome || 'Ready'}</span></div><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Exact request payload</summary><pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-[11px]">{JSON.stringify(item.payload,null,2)}</pre></details>{result && <p role="status" className="mt-2 break-words text-xs text-slate-600">{result.message}</p>}{result?.outcome === 'rejected' && <Button size="sm" variant="outline" className="mt-2" disabled={busy || !confirmed} onClick={() => run(code)}>Retry rejected course</Button>}</div>;})}</div>
          <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-600"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-indigo-600"/>I checked this account, course codes, slots, venues and faculty. Register these selected courses.</label>
          <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={() => run()} disabled={busy || !confirmed || review.items.every((item) => !!results[item.payload.course_code])} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">{busy ? <Loader2 className="animate-spin" size={16}/> : <ArrowRight size={16}/>} {busy ? `Registering ${current}…` : 'Register selected courses'}</Button>{busy && <Button variant="outline" disabled={stopRequested} onClick={() => {stopped.current=true;setStopRequested(true);}} className="gap-2"><Square size={14}/>{stopRequested ? 'Stopping after current course…' : 'Stop after current course'}</Button>}</div>
        </>}
      </section>
    </>}
    <Dialog open={planner} onOpenChange={setPlanner}><DialogContent className="flex h-[90dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-3 sm:max-w-6xl"><DialogHeader className="shrink-0 pr-6 text-left"><DialogTitle>Choose your timetable</DialogTitle><DialogDescription>Select “Use this timetable” to bring its courses back here.</DialogDescription></DialogHeader><iframe ref={frame} title="Slotwise timetable planner" src="/slotwise/index.html?registration=1" className="min-h-0 w-full flex-1 rounded-xl border border-slate-100"/></DialogContent></Dialog>
  </div>;
}
