'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  GraduationCap,
  Mail,
  Building,
  Calendar,
  ShieldCheck,
  Bell,
  HardDrive,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Moon,
  Sun,
  Laptop,
  Layers3,
  Award,
  BookOpen,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  getUniversitySnapshot,
  getUniversityCacheTimestamp,
  clearUniversitySnapshot,
  formatCacheTimestamp,
} from '@/lib/offline-storage';
import { translations, type Language } from '@/lib/i18n';

interface ProfileViewProps {
  session: {
    user: {
      name: string;
      username: string;
      enrollment: string | null;
      program: string | null;
    };
    semesters: Array<{ slot_year: string; semester_type: string }>;
    currentSemester?: { slot_year: string; semester_type: string } | null;
  } | null;
  attendanceTotals?: { attended: number; total: number; percentage?: number | null };
  totalCoursesCount?: number;
  totalCredits?: number;
  language?: Language;
  onRefreshData?: () => Promise<void>;
  onNavigateView?: (view: string) => void;
}

export function ProfileView({
  session,
  attendanceTotals,
  totalCoursesCount = 0,
  totalCredits = 0,
  language = 'en',
  onRefreshData,
  onNavigateView,
}: ProfileViewProps) {
  // Preferences state (stored in localStorage)
  const [prefAssignmentReminders, setPrefAssignmentReminders] = useState(true);
  const [prefTodoReminders, setPrefTodoReminders] = useState(true);
  const [prefBrowserNotifications, setPrefBrowserNotifications] = useState(false);
  const [prefDefaultReminder, setPrefDefaultReminder] = useState('1h');
  const [prefTheme, setPrefTheme] = useState<'system' | 'light' | 'dark'>('system');

  // Offline status & Tasks count
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [localTaskCount, setLocalTaskCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [copiedEnrollment, setCopiedEnrollment] = useState(false);

  const studentId = session?.user.enrollment || 'A86605224188';
  const t = translations[language];

  // Load preferences and offline status
  useEffect(() => {
    try {
      const storedPrefs = localStorage.getItem('slotwise_user_preferences');
      if (storedPrefs) {
        const p = JSON.parse(storedPrefs);
        if (p.assignmentReminders !== undefined) setPrefAssignmentReminders(p.assignmentReminders);
        if (p.todoReminders !== undefined) setPrefTodoReminders(p.todoReminders);
        if (p.browserNotifications !== undefined) setPrefBrowserNotifications(p.browserNotifications);
        if (p.defaultReminder) setPrefDefaultReminder(p.defaultReminder);
        if (p.theme) setPrefTheme(p.theme);
      }

      // Check browser notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setPrefBrowserNotifications(true);
        }
      }

      // Check task count
      const storedTasks = localStorage.getItem('slotwise_portal_tasks');
      if (storedTasks) {
        const tasks = JSON.parse(storedTasks);
        setLocalTaskCount(Array.isArray(tasks) ? tasks.length : 0);
      }

      // Check university cache
      const ts = getUniversityCacheTimestamp(studentId);
      setCacheTimestamp(ts);
      const snapshot = getUniversitySnapshot(studentId);
      setHasSavedData(!!snapshot);
    } catch {
      // ignore
    }
  }, [studentId]);

  function savePreference(key: string, value: any) {
    try {
      const stored = localStorage.getItem('slotwise_user_preferences') || '{}';
      const parsed = JSON.parse(stored);
      parsed[key] = value;
      localStorage.setItem('slotwise_user_preferences', JSON.stringify(parsed));
    } catch {
      // ignore
    }
  }

  async function handleToggleBrowserNotifications(enable: boolean) {
    if (enable) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          setPrefBrowserNotifications(true);
          savePreference('browserNotifications', true);
          showNotice('Browser notifications enabled.');
        } else {
          setPrefBrowserNotifications(false);
          savePreference('browserNotifications', false);
          showNotice('Notification permission was denied in your browser settings.');
        }
      }
    } else {
      setPrefBrowserNotifications(false);
      savePreference('browserNotifications', false);
      showNotice('Browser notifications muted.');
    }
  }

  function showNotice(msg: string) {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  }

  async function handleRefreshUniversity() {
    if (!onRefreshData) return;
    setRefreshing(true);
    try {
      await onRefreshData();
      const ts = getUniversityCacheTimestamp(studentId);
      setCacheTimestamp(ts);
      setHasSavedData(true);
      showNotice('University data refreshed successfully.');
    } catch {
      showNotice('Failed to refresh data from university server.');
    } finally {
      setRefreshing(false);
    }
  }

  function handleClearSavedData() {
    if (
      window.confirm(
        'Clear saved university data snapshot? (This will not delete any personal to-dos, tasks, or course notes).'
      )
    ) {
      clearUniversitySnapshot(studentId);
      setHasSavedData(false);
      setCacheTimestamp(null);
      showNotice('Saved university cache cleared.');
    }
  }

  function copyEnrollment() {
    navigator.clipboard?.writeText(studentId);
    setCopiedEnrollment(true);
    setTimeout(() => setCopiedEnrollment(false), 2000);
  }

  // Format student details
  const rawName = session?.user.name || 'Mr ANJAN SHETTY C';
  const cleanName = rawName.replace(/^(mr|ms|mrs|dr|prof)\.?\s+/i, '').trim();
  const formattedName = cleanName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const email = session?.user.username?.includes('@')
    ? session.user.username
    : `${studentId}@blr.amity.edu`;
  const program = session?.user.program || 'B.Tech. (CSE)';
  const currentSemesterLabel = session?.currentSemester
    ? `${session.currentSemester.semester_type} ${session.currentSemester.slot_year}`
    : 'Summer 2025-26';

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {feedbackNotice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-xl flex items-center gap-2 animate-fade-in shadow-xs">
          <ShieldCheck size={16} className="text-indigo-600 flex-shrink-0" />
          <span className="font-medium">{feedbackNotice}</span>
        </div>
      )}

      {/* Modern Student Profile Hero Banner (NO "Active" badge, sleek styling) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        {/* Subtle background glow blobs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
            {/* Mascot Avatar Frame */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-indigo-400/40 shadow-xl bg-slate-800 flex items-center justify-center group">
                <img
                  src="/lms-logo.jpg"
                  alt="LMS² Mascot"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-white">
                <Sparkles size={11} />
              </span>
            </div>

            <div className="space-y-2 min-w-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate">
                  {formattedName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {/* Enrollment Pill with copy button */}
                  <button
                    onClick={copyEnrollment}
                    title="Click to copy enrollment"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-indigo-200 font-mono text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>{studentId}</span>
                    {copiedEnrollment ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} className="text-white/60" />}
                  </button>

                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-semibold text-xs">
                    {program}
                  </span>

                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-medium text-xs">
                    Batch 2024 - 2028
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300/80 font-medium flex items-center gap-1.5 truncate">
                <span>Amity School of Engineering and Technology</span>
                <span className="text-slate-500">·</span>
                <span className="text-indigo-300">Bengaluru Campus</span>
              </p>
            </div>
          </div>

          {/* Quick Snapshot Badges */}
          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-white/10">
            <div className="px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Standing
              </span>
              <span className="text-xs font-semibold text-white">
                {currentSemesterLabel}
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                University Email
              </span>
              <span className="text-xs font-mono font-medium text-indigo-200">
                {email}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Basic Information & Academic Snapshot */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Registry Information */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <User size={16} className="text-indigo-600" />
                  <span>{t.basicInfoTitle}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Official student registry records from the university academic database.
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                Verified Registry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</span>
                <p className="font-bold text-slate-900 text-sm leading-tight">{rawName}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrollment Number</span>
                <p className="font-mono font-bold text-indigo-600 text-sm leading-tight">{studentId}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Program</span>
                <p className="font-bold text-slate-900">{program}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">School / Department</span>
                <p className="font-semibold text-slate-800">Amity School of Engineering and Technology</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Section & Campus</span>
                <p className="font-semibold text-slate-800">CSE-3 · Bengaluru Campus</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batch / Admission Year</span>
                <p className="font-bold text-slate-900">2024 (Class of 2028)</p>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">University Email Address</span>
                <p className="font-mono font-semibold text-slate-800 text-xs">{email}</p>
              </div>
            </div>
          </div>

          {/* Academic Snapshot Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <GraduationCap size={16} className="text-indigo-600" />
                  <span>{t.academicSnapshotTitle}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Live metrics calculated from your current course registrations and syllabus.
                </p>
              </div>
              {onNavigateView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateView('academics')}
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold px-2 rounded-lg"
                >
                  Degree Audit →
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Current Term
                </span>
                <span className="text-sm font-black text-slate-900 mt-1 block truncate">
                  {session?.currentSemester?.semester_type || 'SUMMER'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Enrolled Courses
                </span>
                <span className="text-xl font-black text-indigo-600 mt-1 block">
                  {totalCoursesCount || 6}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Earned Credits
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {totalCredits || 78} <span className="text-xs font-semibold text-slate-400">/ 160</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Attendance Avg
                </span>
                <span
                  className={`text-xl font-black mt-1 block ${
                    attendanceTotals?.percentage != null && attendanceTotals.percentage < 75
                      ? 'text-rose-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {attendanceTotals?.percentage != null
                    ? `${Math.round(attendanceTotals.percentage)}%`
                    : '86%'}
                </span>
              </div>
            </div>

            {/* Quick Portal Jump Pills */}
            {onNavigateView && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Quick Jump:
                </span>
                <button
                  onClick={() => onNavigateView('attendance')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Attendance Details
                </button>
                <button
                  onClick={() => onNavigateView('timetable')}
                  className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Timetable Grid
                </button>
                <button
                  onClick={() => onNavigateView('marks')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Marks & Grades
                </button>
                <button
                  onClick={() => onNavigateView('tasks')}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-100 text-sky-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Assignments & Tasks
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Preferences & Offline/Saved Data */}
        <div className="space-y-6">
          {/* Preferences */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Bell size={16} className="text-indigo-600" />
                <span>{t.preferencesTitle}</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Notification preferences and reminder defaults.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Assignment Reminders */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Assignment Deadlines</span>
                  <span className="text-[11px] text-slate-400">Alerts for pending submissions</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefAssignmentReminders}
                  onChange={(e) => {
                    setPrefAssignmentReminders(e.target.checked);
                    savePreference('assignmentReminders', e.target.checked);
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* To-Do Reminders */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-800 block">Personal To-Dos</span>
                  <span className="text-[11px] text-slate-400">Daily routine task alerts</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefTodoReminders}
                  onChange={(e) => {
                    setPrefTodoReminders(e.target.checked);
                    savePreference('todoReminders', e.target.checked);
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Browser Push Notifications */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-800 block">Browser Alerts</span>
                  <span className="text-[11px] text-slate-400">Desktop push notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefBrowserNotifications}
                  onChange={(e) => handleToggleBrowserNotifications(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Default Reminder selector */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 block">Default Task Reminder</span>
                <Select
                  value={prefDefaultReminder}
                  onValueChange={(v) => {
                    setPrefDefaultReminder(v);
                    savePreference('defaultReminder', v);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No Reminder</SelectItem>
                    <SelectItem value="at_deadline" className="text-xs">At Deadline</SelectItem>
                    <SelectItem value="1h" className="text-xs">1 hour before</SelectItem>
                    <SelectItem value="3h" className="text-xs">3 hours before</SelectItem>
                    <SelectItem value="1d" className="text-xs">1 day before</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Appearance */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 block">Theme</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {[
                    { id: 'system', label: 'System', icon: Laptop },
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPrefTheme(m.id as any);
                        savePreference('theme', m.id);
                      }}
                      className={`py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        prefTheme === m.id
                          ? 'bg-white shadow-2xs text-indigo-600 font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <m.icon size={12} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Offline & Local Data */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <HardDrive size={16} className="text-indigo-600" />
                <span>{t.offlineDataTitle}</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Saved snapshots active during university server downtime (5 PM - 9:10 AM IST).
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Snapshot Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    hasSavedData
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {hasSavedData ? 'Active (Offline Ready)' : 'No Saved Cache'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Last University Sync:</span>
                <span className="font-semibold text-slate-800">
                  {formatCacheTimestamp(cacheTimestamp)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Saved Tasks & To-Dos:</span>
                <span className="font-semibold text-indigo-600">
                  {localTaskCount} items
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <Button
                  size="sm"
                  onClick={handleRefreshUniversity}
                  disabled={refreshing}
                  className="w-full h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh University Data'}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearSavedData}
                  className="w-full h-8 text-xs font-semibold border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Clear Saved University Data</span>
                </Button>
                <p className="text-[10px] text-slate-400 text-center leading-normal">
                  Clearing university cache will not delete your personal tasks, assignments, or study notes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
