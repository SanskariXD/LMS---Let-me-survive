'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, UserCheck, Users, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import Portal from './portal';

interface DeviceUser {
  id: string;
  name: string;
  enrollment: string;
  program?: string;
}

async function triggerLegacyDataMigration(userId: string) {
  const markerKey = `slotwise_migrated_v1_${userId}`;
  if (localStorage.getItem(markerKey) === 'true') return;

  try {
    const rawTasks = localStorage.getItem('slotwise_portal_tasks');
    const rawManualCourses = localStorage.getItem('slotwise_manual_courses');
    const rawPreferences = localStorage.getItem('slotwise_user_preferences');
    const rawSharedResources = localStorage.getItem('slotwise_shared_resources');

    const payload: Record<string, any> = {};
    if (rawTasks) {
      try { payload.tasks = JSON.parse(rawTasks); } catch {}
    }
    if (rawManualCourses) {
      try { payload.manualCourses = JSON.parse(rawManualCourses); } catch {}
    }
    if (rawPreferences) {
      try { payload.preferences = JSON.parse(rawPreferences); } catch {}
    }
    if (rawSharedResources) {
      try { payload.sharedResources = JSON.parse(rawSharedResources); } catch {}
    }

    if (Object.keys(payload).length > 0) {
      const res = await fetch('/api/sync/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        localStorage.setItem(markerKey, 'true');
        console.info('[Migration] Legacy localStorage data successfully synchronized to server.');
      }
    } else {
      localStorage.setItem(markerKey, 'true');
    }
  } catch (err) {
    console.warn('[Migration] Non-fatal migration check error:', err);
  }
}

export default function PortalGate() {
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<DeviceUser | null>(null);
  const [deviceUser, setDeviceUser] = useState<DeviceUser | null>(null);

  // Form mode: 'pin' (quick unlock) or 'connect' (university credentials)
  const [mode, setMode] = useState<'pin' | 'connect'>('pin');

  // PIN Form State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Connect Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connectSubmitting, setConnectSubmitting] = useState(false);

  useEffect(() => {
    let live = true;

    // Check remembered device user
    try {
      const stored = localStorage.getItem('slotwise_device_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) setDeviceUser(parsed);
      }
    } catch {}

    // Check active session cookie
    fetch('/api/portal/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (live && data.unlocked === true) {
          setUnlocked(true);
          if (data.user) {
            setCurrentUser(data.user);
            setDeviceUser(data.user);
            localStorage.setItem('slotwise_device_user', JSON.stringify(data.user));
            triggerLegacyDataMigration(data.user.id);
          }
        } else {
          // If no active session and no device user, default to connect mode
          const stored = localStorage.getItem('slotwise_device_user');
          if (!stored) setMode('connect');
        }
      })
      .catch(() => {
        if (live) {
          const stored = localStorage.getItem('slotwise_device_user');
          if (!stored) setMode('connect');
        }
      })
      .finally(() => {
        if (live) setChecking(false);
      });

    return () => { live = false; };
  }, []);

  // Handle Quick PIN Unlock
  async function handlePinUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (pinSubmitting || pin.length !== 6) return;
    setPinSubmitting(true);
    setPinError('');

    try {
      const body: Record<string, any> = { pin };
      if (deviceUser?.id) body.userId = deviceUser.id;
      if (deviceUser?.enrollment) body.enrollment = deviceUser.enrollment;

      const response = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Incorrect PIN.');
      }

      setPin('');
      setUnlocked(true);
      if (data.user) {
        setCurrentUser(data.user);
        setDeviceUser(data.user);
        localStorage.setItem('slotwise_device_user', JSON.stringify(data.user));
        triggerLegacyDataMigration(data.user.id);
      }
    } catch (err: any) {
      setPin('');
      setPinError(err.message || 'Unable to unlock portal.');
    } finally {
      setPinSubmitting(false);
    }
  }

  // Handle University Credentials Connect
  async function handleUniversityConnect(event: React.FormEvent) {
    event.preventDefault();
    if (connectSubmitting || !username.trim() || !password) return;
    setConnectSubmitting(true);
    setConnectError('');

    try {
      const response = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          pin: setupPin.length === 6 ? setupPin : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect university account.');
      }

      setUnlocked(true);
      if (data.user) {
        setCurrentUser(data.user);
        setDeviceUser(data.user);
        localStorage.setItem('slotwise_device_user', JSON.stringify(data.user));
        triggerLegacyDataMigration(data.user.id);
      }
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect university account.');
    } finally {
      setConnectSubmitting(false);
    }
  }

  // Lock portal (keeps device PIN user)
  async function handleLock() {
    try {
      await fetch('/api/portal/logout', { method: 'POST' });
    } catch (err) {
      console.error('[Portal] Lock failed:', err);
    }
    setUnlocked(false);
    setPin('');
    setPinError('');
    if (deviceUser) setMode('pin');
  }

  // Full switch user / sign out
  async function handleSwitchUser() {
    try {
      await fetch('/api/portal/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('slotwise_device_user');
    setDeviceUser(null);
    setCurrentUser(null);
    setUnlocked(false);
    setPin('');
    setUsername('');
    setPassword('');
    setSetupPin('');
    setMode('connect');
  }

  if (checking) {
    return (
      <main className="pin-shell">
        <div className="pin-card pin-loading">
          <RefreshCw className="spinning text-indigo-500" />
          <p className="text-slate-600 font-medium">Checking your portal…</p>
        </div>
      </main>
    );
  }

  if (unlocked) {
    return (
      <Portal
        onLock={handleLock}
        onSwitchUser={handleSwitchUser}
      />
    );
  }

  return (
    <main className="pin-shell min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100">
      <section className="pin-card max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* LMS² Logo */}
        <div className="flex items-center justify-center mb-6">
          <img src="/lms-logo.jpg" alt="LMS² Logo" className="w-full max-h-20 object-contain rounded-xl" />
        </div>

        {mode === 'pin' ? (
          /* QUICK PIN UNLOCK VIEW */
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <LockKeyhole size={24} />
            </div>

            <h1 className="text-xl font-bold text-center text-white mb-1">
              {deviceUser?.name ? `Welcome back, ${deviceUser.name.split(' ')[0]}` : 'Enter your portal PIN'}
            </h1>
            <p className="text-xs text-center text-slate-400 mb-6 font-mono">
              {deviceUser?.enrollment || 'Enter your 6-digit PIN to unlock LMS²'}
            </p>

            <form onSubmit={handlePinUnlock} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={setPin}
                  disabled={pinSubmitting}
                  autoFocus
                  aria-label="Six-digit portal PIN"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="w-11 h-13 text-lg font-bold border-slate-700 bg-slate-800/80 text-white rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                  {pinError}
                </div>
              )}

              <Button
                type="submit"
                disabled={pinSubmitting || pin.length !== 6}
                className="w-full py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {pinSubmitting ? (
                  <><RefreshCw className="animate-spin mr-2" size={18} />Unlocking…</>
                ) : (
                  <>Open portal<ArrowRight size={18} className="ml-2" /></>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setMode('connect')}
                className="hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn size={14} /> Connect with password
              </button>

              <button
                type="button"
                onClick={handleSwitchUser}
                className="hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Users size={14} /> Switch account
              </button>
            </div>
          </div>
        ) : (
          /* UNIVERSITY ACCOUNT CONNECT VIEW */
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <UserCheck size={24} />
            </div>

            <h1 className="text-xl font-bold text-center text-white mb-1">
              Connect University Account
            </h1>
            <p className="text-xs text-center text-slate-400 mb-6">
              Sign in with your Amity student portal credentials.
            </p>

            <form onSubmit={handleUniversityConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Enrollment Number or Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="A86605224188 or student@blr.amity.edu"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={connectSubmitting}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Amizone / Portal Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={connectSubmitting}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Quick Unlock PIN (Optional)
                  </label>
                  <span className="text-[10px] text-indigo-400 font-medium">6 digits for fast unlock</span>
                </div>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                  disabled={connectSubmitting}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {connectError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                  {connectError}
                </div>
              )}

              <Button
                type="submit"
                disabled={connectSubmitting || !username.trim() || !password}
                className="w-full py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {connectSubmitting ? (
                  <><RefreshCw className="animate-spin mr-2" size={18} />Connecting to university…</>
                ) : (
                  <>Connect & Enter<ArrowRight size={18} className="ml-2" /></>
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setMode('pin')}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound size={13} /> Already have a PIN? Unlock with PIN
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>AES-256 encrypted • Direct university connection</span>
        </div>

        <div className="text-[11px] text-center font-medium text-slate-400 mt-4 flex items-center justify-center gap-1">
          <span>Made with</span>
          <span className="text-rose-500">❤️</span>
          <span>by <strong className="text-slate-300">Sanskari</strong></span>
        </div>
      </section>
    </main>
  );
}
