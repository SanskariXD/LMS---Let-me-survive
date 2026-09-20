'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Layers3, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import Portal from './portal';

async function accessRequest(path: string, body?: object) {
  const method = body ? 'POST' : 'GET', started = performance.now();
  console.groupCollapsed(`%c[Portal Access] ${method} ${path}`, 'color:#2e8064;font-weight:700');
  try {
    const response = await fetch(`/api/portal/${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    console.info('Response received', { status: response.status, ok: response.ok, durationMs: Math.round(performance.now() - started) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Unable to check portal access.'), { status: response.status, code: data.code });
    console.info('Access request completed', { unlocked: data.unlocked === true });
    return data;
  } catch (error) {
    console.error('Access request failed', { message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally { console.groupEnd(); }
}

export default function PortalGate() {
  const [checking, setChecking] = useState(true), [unlocked, setUnlocked] = useState(false), [pin, setPin] = useState(''), [error, setError] = useState(''), [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    accessRequest('session')
      .then((data) => { if (live) setUnlocked(data.unlocked === true); })
      .catch((issue) => { if (live) setError(issue.message); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || pin.length !== 6) return;
    setSubmitting(true); setError('');
    try {
      const data = await accessRequest('login', { pin });
      setPin('');
      setUnlocked(data.unlocked === true);
    } catch (issue) {
      setPin('');
      setError(issue instanceof Error ? issue.message : 'Unable to unlock the portal.');
    } finally { setSubmitting(false); }
  }

  if (checking) return <main className="pin-shell"><div className="pin-card pin-loading"><RefreshCw className="spinning"/><p>Checking your portal…</p></div></main>;
  if (unlocked) return <Portal onLock={() => { accessRequest('logout', {}).catch((issue) => console.error('[Portal Access] Lock request failed', issue)); setUnlocked(false); }}/>;

  return (
    <main className="pin-shell">
      <section className="pin-card">
        <div className="flex items-center justify-center mb-6">
          <img src="/lms-logo.jpg" alt="LMS² Logo" className="w-full max-h-24 object-contain" />
        </div>
        <div className="pin-lock"><LockKeyhole size={25}/></div>
        <h1>Enter your portal PIN</h1>
        <p>Your university account connects automatically after this step.</p>
        <form onSubmit={unlock}>
          <InputOTP maxLength={6} inputMode="numeric" pattern="[0-9]*" value={pin} onChange={setPin} disabled={submitting} autoFocus aria-label="Six-digit portal PIN">
            <InputOTPGroup>
              {[0,1,2,3,4,5].map((index) => <InputOTPSlot key={index} index={index}/>)}
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="pin-error" role="alert">{error}</p>}
          <Button type="submit" disabled={submitting || pin.length !== 6}>
            {submitting ? <><RefreshCw className="spinning"/>Unlocking…</> : <>Open portal<ArrowRight size={16}/></>}
          </Button>
        </form>
        <div className="pin-note">
          <ShieldCheck size={15}/>
          <span>Your PIN, university password and session token are never printed to the browser console.</span>
        </div>
        <div className="text-[11px] text-center font-medium text-slate-400 mt-4 flex items-center justify-center gap-1">
          <span>Made with</span>
          <span className="text-rose-500">❤️</span>
          <span>by <strong className="text-slate-700">Sanskari</strong></span>
        </div>
      </section>
    </main>
  );
}
