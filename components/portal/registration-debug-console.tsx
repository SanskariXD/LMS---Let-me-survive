'use client';

import { useMemo, useState } from 'react';
import { Bug, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DebugEntry } from '@/lib/registration/debug';

export function RegistrationDebugConsole({enabled, events, onToggle, onClear}: {enabled: boolean; events: DebugEntry[]; onToggle: (value: boolean) => void; onClear: () => void}) {
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => events.filter(entry => `${entry.courseCode || ''} ${entry.stage}`.toLowerCase().includes(filter.toLowerCase())), [events,filter]);
  async function copy() {
    try {await navigator.clipboard.writeText(JSON.stringify({exportedAt:new Date().toISOString(), events:filtered},null,2)); setNotice('Debug report copied.');}
    catch {setNotice('Clipboard is unavailable. Expand an entry to select and copy its details.');}
  }
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Bug size={18} className="text-indigo-600"/><h3 className="text-sm font-bold text-slate-900">Registration debug console</h3></div><label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={enabled} onChange={event => onToggle(event.target.checked)} className="accent-indigo-600"/>Debug mode</label></div>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">{enabled ? 'Capturing API responses, slot matching, seat values, outgoing JSON and results. Also logged to the browser developer console.' : 'Enable before refreshing details or registering to capture the full request flow.'} Credentials are redacted. Keeps the latest 250 events in this tab.</p>
    {(enabled || events.length > 0) && <>
      <div className="mt-4 flex flex-wrap gap-2"><input aria-label="Filter registration debug logs" placeholder="Filter by course code or stage" value={filter} onChange={event => setFilter(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"/><Button size="sm" variant="outline" disabled={!filtered.length} onClick={copy} className="gap-1"><Copy size={13}/>Copy report</Button><Button size="sm" variant="outline" disabled={!events.length} onClick={() => {onClear();setNotice('');}} className="gap-1"><Trash2 size={13}/>Clear</Button></div>
      {notice && <p role="status" className="mt-2 text-xs text-indigo-600">{notice}</p>}
      <div role="log" aria-label="Registration debug events" className="mt-3 max-h-[28rem] min-w-0 space-y-2 overflow-y-auto rounded-xl bg-slate-950 p-3 text-slate-200">
        {!filtered.length ? <p className="p-2 text-xs text-slate-400">{events.length ? 'No matching events.' : 'Waiting for an API request. Click Refresh official details to check venues without registering.'}</p> : filtered.map(entry => <details key={entry.id} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <summary className="cursor-pointer break-words text-xs"><time className="mr-2 text-slate-500">{entry.timestamp.slice(11,23)} UTC</time><span className="mr-2 font-semibold text-indigo-300">{entry.courseCode || 'Plan'}</span><span className={/error|blocked|unresolved|diagnosis/.test(entry.stage) ? 'text-rose-300' : 'text-emerald-300'}>{entry.stage}</span></summary>
          <pre className="mt-3 whitespace-pre-wrap break-all text-[11px] leading-relaxed text-slate-300">{JSON.stringify(entry.data,null,2)}</pre>
        </details>)}
      </div>
    </>}
  </section>;
}
