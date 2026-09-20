'use client';

import { useEffect, useState } from 'react';
import { 
  ArrowRight, 
  KeyRound, 
  Lock, 
  LockKeyhole, 
  Mail, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  Users, 
  LogIn, 
  Sparkles, 
  HelpCircle,
  QrCode,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

  // Form mode: 'connect' (university credentials) or 'pin' (quick unlock)
  const [mode, setMode] = useState<'connect' | 'pin'>('connect');

  // Credentials Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [setupPin, setSetupPin] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSubmitting, setConnectSubmitting] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // PIN Form State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  useEffect(() => {
    let live = true;

    // Check remembered device user
    try {
      const stored = localStorage.getItem('slotwise_device_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setDeviceUser(parsed);
          setMode('pin'); // Default to quick PIN unlock for returning users
        }
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
        }
      })
      .catch(() => {})
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
        throw new Error(data.error || 'Incorrect PIN. Try again or login with credentials.');
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
        throw new Error(data.error || 'Failed to connect university account. Check credentials.');
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
      <main className="min-h-screen bg-[#f3f0fb] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-indigo-50 flex flex-col items-center gap-4 text-center max-w-xs w-full animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Loading LMS²</h2>
            <p className="text-xs text-slate-500 mt-1">Preparing your student portal…</p>
          </div>
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
    <main className="min-h-screen w-full bg-[#edeaf7] sm:bg-[#f3f0fb] flex items-center justify-center p-2 sm:p-6 lg:p-10 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Outer Card Container with modern rounded edges and soft glow */}
      <div className="w-full max-w-5xl bg-white rounded-2xl sm:rounded-[36px] shadow-[0_25px_70px_-15px_rgba(99,102,241,0.18)] border border-indigo-100/60 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Mobile Cute Top Banner */}
        <div className="md:hidden relative w-full h-44 sm:h-52 bg-slate-900 overflow-hidden">
          <img 
            src="/cat-study.jpg" 
            alt="LMS² Study Cat" 
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/30" />
          <div className="absolute top-4 left-4">
            <img src="/logo.png" alt="LMS²" className="h-9 w-auto object-contain drop-shadow-md brightness-110" />
          </div>
        </div>

        {/* LEFT PANEL: Clean Modern Login Card */}
        <div className="w-full md:w-[460px] lg:w-[490px] flex-shrink-0 flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-white relative z-10">
          
          {/* Top Branding (Desktop) */}
          <div className="hidden md:block">
            <img 
              src="/logo.png" 
              alt="LMS² — Let Me Survive" 
              className="h-11 sm:h-13 w-auto object-contain"
            />
          </div>

          {/* Form Content */}
          <div className="my-auto py-2 sm:py-4">
            {mode === 'connect' ? (
              /* UNIVERSITY CREDENTIALS MODE */
              <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[#111827] tracking-tight">
                    Welcome back
                  </h1>
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
                    Same semester. Better survival odds.
                  </p>
                </div>

                <form onSubmit={handleUniversityConnect} className="space-y-4">
                  {/* University ID / Email Input */}
                  <div className="space-y-1.5">
                    <div className="relative flex items-center rounded-2xl bg-[#f7f6fc] border border-indigo-100/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                      <Mail className="w-5 h-5 text-indigo-400/90 ml-4 flex-shrink-0" />
                      <input
                        type="text"
                        required
                        placeholder="University ID or Email"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={connectSubmitting}
                        className="w-full py-3.5 pl-3 pr-4 bg-transparent text-slate-800 placeholder:text-slate-400 text-sm font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <div className="relative flex items-center rounded-2xl bg-[#f7f6fc] border border-indigo-100/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                      <Lock className="w-5 h-5 text-indigo-400/90 ml-4 flex-shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={connectSubmitting}
                        className="w-full py-3.5 pl-3 pr-11 bg-transparent text-slate-800 placeholder:text-slate-400 text-sm font-medium focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-slate-400 hover:text-indigo-600 transition-colors p-1"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Optional Quick Unlock PIN Setup Accordion */}
                  <div className="pt-1">
                    {!showPinSetup ? (
                      <button
                        type="button"
                        onClick={() => setShowPinSetup(true)}
                        className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1"
                      >
                        <KeyRound size={12} /> Set up a 6-digit device PIN for quick unlock
                      </button>
                    ) : (
                      <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-indigo-900">Set 6-Digit Device PIN</label>
                          <button
                            type="button"
                            onClick={() => { setShowPinSetup(false); setSetupPin(''); }}
                            className="text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="e.g. 123456"
                          value={setupPin}
                          onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                          disabled={connectSubmitting}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200 text-slate-800 placeholder:text-slate-400 text-sm font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowHelpDialog(true)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Error Notification */}
                  {connectError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 text-xs font-medium animate-in fade-in duration-200">
                      {connectError}
                    </div>
                  )}

                  {/* Primary Login Button */}
                  <button
                    type="submit"
                    disabled={connectSubmitting || !username.trim() || !password}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#1e2538] hover:bg-[#121724] active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting to university…</span>
                      </>
                    ) : (
                      <>
                        <span>Login</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200/90" />
                  </div>
                  <span className="relative bg-white px-3 text-xs uppercase tracking-widest text-slate-400 font-medium">
                    or
                  </span>
                </div>

                {/* Secondary PIN Login Button */}
                <button
                  type="button"
                  onClick={() => setMode('pin')}
                  className="w-full py-3 px-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 active:scale-[0.99] text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <QrCode size={17} className="text-indigo-600" />
                  <span>Login with PIN</span>
                </button>
              </div>
            ) : (
              /* QUICK PIN UNLOCK MODE */
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-semibold mb-2">
                    <Sparkles size={12} /> Fast Device Unlock
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[#111827] tracking-tight">
                    {deviceUser?.name ? `Welcome back, ${deviceUser.name.split(' ')[0]}` : 'Enter your PIN'}
                  </h1>
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
                    {deviceUser?.enrollment || 'Enter your 6-digit portal PIN to unlock.'}
                  </p>
                </div>

                <form onSubmit={handlePinUnlock} className="space-y-5">
                  <div className="flex justify-center py-2">
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
                      <InputOTPGroup className="gap-2 sm:gap-2.5">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="w-11 h-14 sm:w-12 sm:h-14 text-xl font-bold border-indigo-100 bg-[#f7f6fc] text-indigo-950 rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 transition-all shadow-sm"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {pinError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 text-xs font-medium text-center animate-in fade-in duration-200">
                      {pinError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pinSubmitting || pin.length !== 6}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#1e2538] hover:bg-[#121724] active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pinSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Unlocking portal…</span>
                      </>
                    ) : (
                      <>
                        <span>Unlock Portal</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200/90" />
                  </div>
                  <span className="relative bg-white px-3 text-xs uppercase tracking-widest text-slate-400 font-medium">
                    or
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMode('connect')}
                    className="w-full py-3 px-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 active:scale-[0.99] text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LogIn size={16} className="text-indigo-600" />
                    <span>Login with University Credentials</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchUser}
                    className="w-full py-2 text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Users size={13} /> Switch Account / Clear Device
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Left Panel Footer */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="font-normal text-slate-400">Plan less. Learn more.</span>
            <span className="flex items-center gap-1 font-medium">
              Made with <span className="text-rose-500">❤️</span> by <strong className="text-slate-600 font-semibold">Sanskari</strong>
            </span>
          </div>
        </div>

        {/* RIGHT PANEL: Gorgeous Illustration Display (Desktop / Tablet) */}
        <div className="hidden md:flex flex-1 relative bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 items-center justify-center p-6 lg:p-8 overflow-hidden">
          <div className="relative w-full h-full max-h-[580px] rounded-[28px] overflow-hidden shadow-2xl shadow-indigo-500/10 border border-indigo-100/60 group">
            <img 
              src="/cat-study.jpg" 
              alt="LMS² Study Cat at Desk" 
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
            />
            {/* Soft subtle gradient vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

      </div>

      {/* Forgot Password / Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-indigo-100">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-1">
              <GraduationCap size={24} />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">University Portal Login Help</DialogTitle>
            <DialogDescription className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              LMS² connects directly to your official Amity University student account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2 text-xs text-slate-600">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="font-semibold text-slate-800">1. Username Format</p>
              <p className="text-slate-500">Your Enrollment Number (e.g., <code className="text-indigo-600 font-mono">A86605224188</code>) or official Amity email.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="font-semibold text-slate-800">2. Password</p>
              <p className="text-slate-500">Your official Amizone password. If forgotten, reset it via the university Amizone portal or contact your campus IT department.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1">
              <p className="font-semibold text-indigo-900">3. Fast Quick Unlock</p>
              <p className="text-indigo-700">Once connected, you can use a 6-digit PIN on this device to unlock instantly without retyping your password.</p>
            </div>
          </div>

          <Button 
            onClick={() => setShowHelpDialog(false)}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm"
          >
            Got it, take me back
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
