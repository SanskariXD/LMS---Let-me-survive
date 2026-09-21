'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  BookOpen,
  CalendarDays,
  SquareCheckBig,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  Layers3,
  AlertCircle,
  LockKeyhole,
  ChevronRight,
  Bell,
  TrendingUp,
  FileText,
  User,
  Clock,
  MapPin,
  Quote,
  Compass,
  Award,
  CheckCircle2,
  Target,
  Sparkles,
  BarChart3,
  CheckCircle,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { getCurriculumCourse, auditDegreeProgress } from '@/lib/university/curriculum';

import { TasksView, type TaskItem } from '@/components/portal/tasks-view';
import { ProfileView } from '@/components/portal/profile-view';
import { ResourcesView } from '@/components/portal/resources-view';
import {
  saveUniversitySnapshot,
  getUniversitySnapshot,
  clearUniversitySnapshot,
  formatCacheTimestamp,
  isUniversityExpectedDowntime,
} from '@/lib/offline-storage';
import { translations, type Language } from '@/lib/i18n';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { attendanceAdvice } from '@/lib/university/normalize';
import {
  DAYS,
  TIMES,
  generateWeeklySchedule,
  getClassesForToday,
  type TimetableEvent,
} from '@/lib/university/timetable';
import type { AttendanceComponentItem, AttendanceReport } from '@/types/university';

const SARCASTIC_QUOTES = [
  {
    quote: "Due tomorrow? Do tomorrow. You've survived worse crises created entirely by your own terrible decisions.",
    author: "The Art of Procrastination",
  },
  {
    quote: "Attendance doesn't measure intelligence, but it definitely measures your tolerance for PowerPoint being read aloud word-for-word.",
    author: "8:30 AM Lecture Victim",
  },
  {
    quote: "College is where you pay lakhs of rupees to teach yourself the entire syllabus in 47 minutes from an Indian guy on YouTube.",
    author: "Final Exam Preparation Guide",
  },
  {
    quote: "They say hard work pays off in the future. But laziness pays off right now. Choose your regrets wisely.",
    author: "Bedtime Rationalizations",
  },
  {
    quote: "Your degree will look magnificent framed above the desk where you frantically Google 'how to center a div'.",
    author: "Computer Science Reality Check",
  },
  {
    quote: "Nothing haunts a human soul like the sleep they sacrificed to procrastinate until 4 AM without doing any actual work.",
    author: "Midnight Regrets, Vol. 4",
  },
  {
    quote: "Remember: 75% attendance doesn't make you educated, it just makes you legally present.",
    author: "The Biometric Machine",
  },
  {
    quote: "The syllabus said '10 hours of self-study per week' with a completely straight face.",
    author: "Academic Fiction Weekly",
  },
  {
    quote: "God gives his toughest battles to his sleepiest soldiers who spent 5 hours watching reels about restoring rusty knives.",
    author: "Morning Lecture Chronicles",
  },
  {
    quote: "A deadline is merely a polite recommendation until exactly 23 minutes before the submission portal locks you out.",
    author: "Adrenaline & Caffeine Dept.",
  },
  {
    quote: "Attending class purely to avoid an attendance debarment is the purest form of character development.",
    author: "Campus Matrix Survivor",
  },
];

type Semester = { slot_year: string; semester_type: string };
type Session = {
  user: { name: string; username: string; enrollment: string | null; program: string | null };
  semesters: Semester[];
  currentSemester?: Semester | null;
  profileAvailable: boolean;
};

const navigation = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: ChartNoAxesCombined },
  { id: 'marks', label: 'Marks', icon: Award },
  { id: 'timetable', label: 'Timetable', icon: CalendarDays },
  { id: 'academics', label: 'Academics', icon: GraduationCap },
  { id: 'tasks', label: 'Tasks', icon: SquareCheckBig },
  { id: 'resources', label: 'Resource Hub', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
];

const key = (s: Semester) => `${s.slot_year}|${s.semester_type}`;

function formatName(rawName?: string): string {
  if (!rawName) return 'Student';
  const clean = rawName.replace(/^(mr|ms|mrs|dr|prof)\.?\s+/i, '').trim();
  return clean
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return isoString;
  }
}

// Consistent colors for timetable subjects
const COURSE_COLORS = [
  { bg: '#EFF6FF', border: '#DBEAFE', text: '#1D4ED8', badge: '#2563EB' }, // Blue
  { bg: '#FAF5FF', border: '#F3E8FF', text: '#7E22CE', badge: '#9333EA' }, // Purple
  { bg: '#F0FDF4', border: '#DCFCE7', text: '#15803D', badge: '#16A34A' }, // Green
  { bg: '#FFFBEB', border: '#FEF3C7', text: '#B45309', badge: '#D97706' }, // Amber
  { bg: '#FDF2F8', border: '#FCE7F3', text: '#BE185D', badge: '#DB2777' }, // Pink
  { bg: '#F0FDFA', border: '#CCFBF1', text: '#0F766E', badge: '#0D9488' }, // Teal
];

async function request(path: string, body?: object) {
  const method = body ? 'POST' : 'GET', url = '/api/university/' + path;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data: any;
  try { data = await res.json(); } catch { data = { error: 'Invalid response format.' }; }
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status, code: data.code });
  }
  return data;
}

export default function Portal({ onLock, onSwitchUser }: { onLock: () => void; onSwitchUser?: () => void }) {
  const [view, setView] = useState('overview');
  const [session, setSession] = useState<Session | null>(null);
  const [activeSemester, setActiveSemester] = useState('');
  const [attendanceItems, setAttendanceItems] = useState<AttendanceComponentItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [greeting, setGreeting] = useState('Good Afternoon');
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Language Pack State (English vs Gen-Z)
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('slotwise_portal_lang') as Language;
      if (savedLang === 'en' || savedLang === 'genz') {
        setLanguage(savedLang);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    try {
      localStorage.setItem('slotwise_portal_lang', newLang);
    } catch {
      // ignore
    }
  };

  const t = translations[language];

  const activeNavigation = useMemo(() => [
    { id: 'overview', label: t.navOverview, icon: LayoutDashboard },
    { id: 'attendance', label: t.navAttendance, icon: ChartNoAxesCombined },
    { id: 'marks', label: t.navMarks, icon: Award },
    { id: 'timetable', label: t.navTimetable, icon: CalendarDays },
    { id: 'academics', label: t.navAcademics, icon: GraduationCap, badge: 'Beta' },
    { id: 'tasks', label: t.navTasks, icon: SquareCheckBig },
    { id: 'resources', label: t.navResources, icon: BookOpen, badge: 'Beta' },
    { id: 'profile', label: t.navProfile, icon: User },
  ], [t]);

  // Offline / Saved University Data Mode State
  const [isUsingSavedData, setIsUsingSavedData] = useState(false);
  const [savedDataTimestamp, setSavedDataTimestamp] = useState<string | null>(null);

  // Real Tasks State for Dashboard deadlines synchronization
  const [portalTasks, setPortalTasks] = useState<TaskItem[]>([]);

  // Detailed Attendance Report Popup State
  const [selectedReportTarget, setSelectedReportTarget] = useState<AttendanceComponentItem | null>(null);
  const [reportData, setReportData] = useState<AttendanceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  // Marks Page State
  const [marksSemesters, setMarksSemesters] = useState<Array<{ slot_year: string; semester_type: string }>>([]);
  const [activeMarksSemester, setActiveMarksSemester] = useState('');
  const [marksCourses, setMarksCourses] = useState<any[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [marksError, setMarksError] = useState('');

  // Detailed Marks Inspection Modal State
  const [selectedCourseForMarks, setSelectedCourseForMarks] = useState<any | null>(null);
  const [marksDetailsData, setMarksDetailsData] = useState<{ marks: any; consolidated: any } | null>(null);
  const [marksDetailsLoading, setMarksDetailsLoading] = useState(false);
  const [marksDetailsError, setMarksDetailsError] = useState('');

  // Academics Degree Tracker State
  const [academicsData, setAcademicsData] = useState<{
    audit: any;
    recommendations: any[];
    semesters: any[];
    semesterHistory: any[];
  } | null>(null);
  const [activeAcademicsSemester, setActiveAcademicsSemester] = useState('');
  const [academicsLoading, setAcademicsLoading] = useState(false);
  const [academicsError, setAcademicsError] = useState('');

  // Manual courses for past semesters (e.g. Fall 2024-25, Winter 2024-25) stored in localStorage
  const [manualCourses, setManualCourses] = useState<Record<string, Array<{
    course_code: string;
    course_name: string;
    credits: number;
    component_type: string;
    category?: string;
  }>>>({});
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCredits, setNewCourseCredits] = useState('3');
  const [newCourseType, setNewCourseType] = useState('Theory');

  // Load custom courses and tasks from localStorage and backend on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('slotwise_manual_courses');
      if (stored) {
        setManualCourses(JSON.parse(stored));
      }
      const storedTasks = localStorage.getItem('slotwise_portal_tasks');
      if (storedTasks) {
        setPortalTasks(JSON.parse(storedTasks));
      }
    } catch {}

    // Fetch persistent manual courses from server
    fetch('/api/user/manual-courses')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.courses) && data.courses.length > 0) {
          const grouped: Record<string, any[]> = {};
          data.courses.forEach((c: any) => {
            if (!grouped[c.semester]) grouped[c.semester] = [];
            grouped[c.semester].push({
              course_code: c.course_code,
              course_name: c.course_name,
              credits: c.credits,
              component_type: c.component_type,
            });
          });
          setManualCourses((prev) => ({ ...prev, ...grouped }));
          try {
            localStorage.setItem('slotwise_manual_courses', JSON.stringify(grouped));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const serial = useRef(0);

  async function loadMarksSemesters() {
    const studentId = session?.user?.enrollment || 'student';
    try {
      setMarksLoading(true);
      setMarksError('');
      const res = await fetch('/api/university/marks/semesters', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load semesters');
      const sems: Array<{ slot_year: string; semester_type: string }> = data.semesters || [];
      setMarksSemesters(sems);
      saveUniversitySnapshot(studentId, { marksData: { semesters: sems } });
      if (sems.length > 0) {
        const preferred = sems.find((s) => s.slot_year === '2025-26' && s.semester_type === 'SUMMER') || sems[0];
        const semKey = `${preferred.slot_year}|${preferred.semester_type}`;
        setActiveMarksSemester(semKey);
        await loadMarksTimetable(preferred.slot_year, preferred.semester_type);
      }
    } catch (err: any) {
      const snap = getUniversitySnapshot(studentId);
      if (snap?.marksData?.semesters) {
        setMarksSemesters(snap.marksData.semesters);
        setIsUsingSavedData(true);
        setSavedDataTimestamp(snap.timestamp);
      } else {
        setMarksError('Marks records are currently unreachable.');
      }
    } finally {
      setMarksLoading(false);
    }
  }

  async function loadMarksTimetable(slotYear: string, semesterType: string) {
    const studentId = session?.user?.enrollment || 'student';
    try {
      setMarksLoading(true);
      setMarksError('');
      const res = await fetch(
        `/api/university/marks/timetable?slot_year=${encodeURIComponent(slotYear)}&semester_type=${encodeURIComponent(semesterType)}`,
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load courses');
      const list = data.allRegistrations?.length ? data.allRegistrations : (data.registrations || []);
      setMarksCourses(list);
    } catch (err: any) {
      const snap = getUniversitySnapshot(studentId);
      if (snap?.marksData?.courses) {
        setMarksCourses(snap.marksData.courses);
        setIsUsingSavedData(true);
        setSavedDataTimestamp(snap.timestamp);
      } else {
        setMarksError('Marks courses are currently unreachable.');
      }
    } finally {
      setMarksLoading(false);
    }
  }

  async function openMarksModal(course: any) {
    setSelectedCourseForMarks(course);
    setMarksDetailsData(null);
    setMarksDetailsLoading(true);
    setMarksDetailsError('');
    try {
      const [slotYear, semType] = (activeMarksSemester || '').split('|');
      const y = slotYear || course.slot_year;
      const s = semType || course.semester_type;
      const res = await fetch(
        `/api/university/marks/details?slot_year=${encodeURIComponent(y)}&semester_type=${encodeURIComponent(s)}&course_code=${encodeURIComponent(course.course_code)}&slot_name=${encodeURIComponent(course.slot_name)}`,
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch marks report');
      setMarksDetailsData(data);
    } catch (err: any) {
      setMarksDetailsError(err.message || 'Failed to load marks report');
    } finally {
      setMarksDetailsLoading(false);
    }
  }

  async function loadAcademicsData() {
    const studentId = session?.user?.enrollment || 'student';
    try {
      setAcademicsLoading(true);
      setAcademicsError('');
      const res = await fetch('/api/university/academics/history', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load academics audit');

      // Inject Fall 2024-25 and Winter 2024-25 into semesters if not present
      const existingSems = data.semesters || [];
      const extraSems = [
        { slot_year: '2024-25', semester_type: 'WINTER' },
        { slot_year: '2024-25', semester_type: 'FALL' },
      ];
      const mergedSems = [...existingSems];
      for (const extra of extraSems) {
        if (!mergedSems.some((s: any) => s.slot_year === extra.slot_year && s.semester_type === extra.semester_type)) {
          mergedSems.push(extra);
        }
      }
      data.semesters = mergedSems;

      setAcademicsData(data);
      saveUniversitySnapshot(studentId, { academicsData: data });
      if (mergedSems.length > 0 && !activeAcademicsSemester) {
        const preferred = mergedSems.find((s: any) => s.slot_year === '2025-26' && s.semester_type === 'SUMMER') || mergedSems[0];
        setActiveAcademicsSemester(`${preferred.slot_year}|${preferred.semester_type}`);
      }
    } catch (err: any) {
      const snap = getUniversitySnapshot(studentId);
      if (snap?.academicsData) {
        setAcademicsData(snap.academicsData);
        setIsUsingSavedData(true);
        setSavedDataTimestamp(snap.timestamp);
      } else {
        setAcademicsError('Degree audit records are currently unreachable.');
      }
    } finally {
      setAcademicsLoading(false);
    }
  }

  function handleAddManualCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseName.trim()) return;
    const cur = getCurriculumCourse(newCourseCode.trim().toUpperCase());
    const courseObj = {
      course_code: newCourseCode.trim().toUpperCase(),
      course_name: newCourseName.trim(),
      credits: Number(newCourseCredits) || (cur?.credits ?? 3),
      component_type: newCourseType,
      category: cur?.category,
    };
    const currentList = manualCourses[activeAcademicsSemester] || [];
    const updated = {
      ...manualCourses,
      [activeAcademicsSemester]: [...currentList, courseObj],
    };
    setManualCourses(updated);
    try {
      localStorage.setItem('slotwise_manual_courses', JSON.stringify(updated));
    } catch {}

    // Persist to server
    fetch('/api/user/manual-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseCode: courseObj.course_code,
        courseName: courseObj.course_name,
        credits: courseObj.credits,
        semester: activeAcademicsSemester,
        componentType: courseObj.component_type,
      }),
    }).catch(() => {});

    setNewCourseCode('');
    setNewCourseName('');
    setNewCourseCredits('3');
    setNewCourseType('Theory');
    setShowAddCourseModal(false);
  }

  function handleRemoveManualCourse(semKey: string, code: string) {
    const currentList = manualCourses[semKey] || [];
    const updated = {
      ...manualCourses,
      [semKey]: currentList.filter((c) => c.course_code !== code),
    };
    setManualCourses(updated);
    try {
      localStorage.setItem('slotwise_manual_courses', JSON.stringify(updated));
    } catch {}

    fetch(`/api/user/manual-courses?code=${encodeURIComponent(code)}&semester=${encodeURIComponent(semKey)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }

  // Recalculate audit with manual courses factored in
  const effectiveAcademicsAudit = useMemo(() => {
    if (!academicsData?.audit) return null;
    const allCourses: Array<{ course_code: string; course_name: string; credits?: number; semester?: string }> = [];

    // From API semester history
    for (const sem of academicsData.semesterHistory || []) {
      for (const reg of sem.courses || []) {
        if (!reg.course_code) continue;
        allCourses.push({
          course_code: reg.course_code,
          course_name: reg.course_name,
          credits: reg.credits,
          semester: `${sem.semester_type} ${sem.slot_year}`,
        });
      }
    }

    // From manual courses
    for (const [semKey, list] of Object.entries(manualCourses)) {
      for (const mc of list) {
        allCourses.push({
          course_code: mc.course_code,
          course_name: mc.course_name,
          credits: mc.credits,
          semester: semKey.replace('|', ' '),
        });
      }
    }

    return auditDegreeProgress(allCourses);
  }, [academicsData, manualCourses]);


  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    if (view === 'marks' && marksSemesters.length === 0) {
      void loadMarksSemesters();
    } else if (view === 'academics' && !academicsData) {
      void loadAcademicsData();
    }
  }, [view]);


  function clearSession() {
    serial.current++;
    setSession(null);
    setActiveSemester('');
    setAttendanceItems(null);
    setLoading(false);
  }

  async function fetchAttendance(semKey: string) {
    if (!semKey) return;
    const ticket = ++serial.current;
    setLoading(true);
    setError('');
    const [year, type] = semKey.split('|');
    const studentId = session?.user?.enrollment || 'student';

    try {
      const data = await request('attendance?' + new URLSearchParams({ slot_year: year, semester_type: type }));
      if (ticket !== serial.current) return;
      setAttendanceItems(data.courses);
      setIsUsingSavedData(false);
      saveUniversitySnapshot(studentId, { attendanceItems: data.courses });
    } catch (e: any) {
      if (ticket !== serial.current) return;
      if (e.status === 401) {
        clearSession();
        return;
      }
      // Check if snapshot exists
      const snap = getUniversitySnapshot(studentId);
      if (snap?.attendanceItems && snap.attendanceItems.length > 0) {
        setAttendanceItems(snap.attendanceItems);
        setIsUsingSavedData(true);
        setSavedDataTimestamp(snap.timestamp);
        setError(''); // Do NOT show technical error
      } else {
        setError('University attendance records are currently unreachable.');
      }
    } finally {
      if (ticket === serial.current) setLoading(false);
    }
  }

  function applySession(data: Session) {
    setSession(data);
    const active =
      data.currentSemester ||
      data.semesters.find((s) => s.slot_year === '2025-26' && s.semester_type.toUpperCase() === 'SUMMER') ||
      data.semesters[0];
    const initialSemKey = active ? key(active) : '';
    if (initialSemKey) {
      setActiveSemester(initialSemKey);
      void fetchAttendance(initialSemKey);
    }
  }

  useEffect(() => {
    let live = true;
    let activeEnrollment = '';
    try {
      const u = JSON.parse(localStorage.getItem('slotwise_device_user') || '{}');
      if (u?.enrollment) activeEnrollment = u.enrollment;
    } catch {}
    const studentId = activeEnrollment || session?.user?.enrollment || 'student';

    // 1. Immediately restore cached snapshot if available so there is zero initial blank screen
    const snapshot = getUniversitySnapshot(studentId);
    if (snapshot && snapshot.user) {
      setSession({
        user: snapshot.user,
        semesters: snapshot.semesters || [],
        currentSemester: snapshot.currentSemester || null,
        profileAvailable: true,
      });
      const active =
        snapshot.currentSemester ||
        (snapshot.semesters || []).find((s) => s.slot_year === '2025-26' && s.semester_type.toUpperCase() === 'SUMMER') ||
        (snapshot.semesters || [])[0];
      if (active) {
        setActiveSemester(key(active));
      }
      if (snapshot.attendanceItems && snapshot.attendanceItems.length > 0) {
        setAttendanceItems(snapshot.attendanceItems);
      }
      setIsUsingSavedData(true);
      setSavedDataTimestamp(snapshot.timestamp);
    }

    // 2. Fetch live data from university API
    request('bootstrap')
      .then((data) => {
        if (!live) return;
        // Verify that data is genuinely populated and not an offline empty shell
        if (!data || !data.user?.name || !data.semesters || data.semesters.length === 0) {
          const snap = getUniversitySnapshot(studentId);
          if (snap) {
            setIsUsingSavedData(true);
            setSavedDataTimestamp(snap.timestamp);
            if (snap.attendanceItems && snap.attendanceItems.length > 0) {
              setAttendanceItems(snap.attendanceItems);
            }
          }
          return;
        }
        applySession(data);
        setIsUsingSavedData(false);
        saveUniversitySnapshot(studentId, {
          user: data.user,
          semesters: data.semesters,
          currentSemester: data.currentSemester,
        });
      })
      .catch((e: any) => {
        if (!live) return;
        if (e.status === 401) {
          clearSession();
          return;
        }
        const snap = getUniversitySnapshot(studentId);
        if (snap) {
          setIsUsingSavedData(true);
          setSavedDataTimestamp(snap.timestamp);
          if (snap.attendanceItems && snap.attendanceItems.length > 0) {
            setAttendanceItems(snap.attendanceItems);
          }
          if (snap.user) {
            setSession({
              user: snap.user,
              semesters: snap.semesters || [],
              currentSemester: snap.currentSemester || null,
              profileAvailable: true,
            });
          }
          setError(''); // Do NOT show technical API error!
        } else {
          setError('University services are currently unavailable.');
        }
      });

    return () => {
      live = false;
      serial.current++;
    };
  }, []);

  // Silent background token and data refresh (keeps session active without disturbing user)
  useEffect(() => {
    if (!activeSemester || isUsingSavedData) return;
    const interval = setInterval(() => {
      const [year, type] = activeSemester.split('|');
      request('attendance?' + new URLSearchParams({ slot_year: year, semester_type: type }))
        .then((data) => {
          if (data?.courses && data.courses.length > 0) {
            setAttendanceItems(data.courses);
            setIsUsingSavedData(false);
            saveUniversitySnapshot(session?.user?.enrollment || 'student', { attendanceItems: data.courses });
          }
        })
        .catch((e: any) => {
          if (e.status === 401) {
            request('bootstrap').then(applySession).catch(() => {});
          }
        });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeSemester, session, isUsingSavedData]);

  async function refresh() {
    const studentId = session?.user?.enrollment || 'student';
    setLoading(true);
    setError('');
    try {
      const bootData = await request('bootstrap');
      if (!bootData?.user?.name || !bootData?.semesters || bootData.semesters.length === 0) {
        throw new Error('University server offline');
      }
      applySession(bootData);
      setIsUsingSavedData(false);
      saveUniversitySnapshot(studentId, {
        user: bootData.user,
        semesters: bootData.semesters,
        currentSemester: bootData.currentSemester,
      });
      if (activeSemester) {
        await fetchAttendance(activeSemester);
      }
    } catch (e: any) {
      if (e.status === 401) clearSession();
      const snap = getUniversitySnapshot(studentId);
      if (snap) {
        setIsUsingSavedData(true);
        setSavedDataTimestamp(snap.timestamp);
        if (snap.attendanceItems && snap.attendanceItems.length > 0) {
          setAttendanceItems(snap.attendanceItems);
        }
        if (snap.user) {
          setSession({
            user: snap.user,
            semesters: snap.semesters || [],
            currentSemester: snap.currentSemester || null,
            profileAvailable: true,
          });
        }
        setError('');
      } else {
        setError('University services are currently unavailable.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Open detailed report modal
  async function openReport(item: AttendanceComponentItem) {
    setSelectedReportTarget(item);
    setReportData(null);
    setReportError('');
    setReportLoading(true);

    try {
      const semYear = item.slot_year || activeSemester.split('|')[0];
      const semType = item.semester_type || activeSemester.split('|')[1];
      const params = new URLSearchParams({
        course_code: item.course_code,
        slot_year: semYear,
        semester_type: semType,
      });
      if (item.slot_name) {
        params.set('slot_name', item.slot_name);
      }

      const data = await request(`attendance/report?${params.toString()}`);
      setReportData(data);
    } catch (err: any) {
      setReportError(err.message || 'Unable to fetch attendance log.');
    } finally {
      setReportLoading(false);
    }
  }

  // Fixed 75% threshold for Theory
  const TARGET_THRESHOLD = 75;

  // Lab components have no 75% limit
  const isLabItem = (item: AttendanceComponentItem) =>
    item.component_label === 'Lab' || item.component_type === 'P' || item.slot_name.startsWith('L');

  const totals = (attendanceItems || []).reduce(
    (acc, c) => ({ attended: acc.attended + c.present_classes, total: acc.total + c.total_classes }),
    { attended: 0, total: 0 }
  );
  const overall = totals.total ? (100 * totals.attended) / totals.total : null;

  // Stat badges (only count labs as at risk if < 60%)
  const onTrackCount = (attendanceItems || []).filter((c) => {
    if (c.total_classes === 0) return true;
    if (isLabItem(c)) return c.attendance_percentage! >= 60;
    return c.attendance_percentage! >= TARGET_THRESHOLD;
  }).length;

  const needsAttentionCount = (attendanceItems || []).filter((c) => {
    if (c.total_classes === 0) return false;
    if (isLabItem(c)) return c.attendance_percentage! < 60 && c.attendance_percentage! >= 50;
    return c.attendance_percentage! < TARGET_THRESHOLD && c.attendance_percentage! >= TARGET_THRESHOLD - 10;
  }).length;

  const atRiskCount = (attendanceItems || []).filter((c) => {
    if (c.total_classes === 0) return false;
    if (isLabItem(c)) return c.attendance_percentage! < 50;
    return c.attendance_percentage! < TARGET_THRESHOLD - 10;
  }).length;

  const formattedFullName = formatName(session?.user.name || 'Student');
  const firstName = formattedFullName.split(' ')[0] || 'Student';

  // Course list formatted for Tasks & Resource Hub filters
  const enrolledCourseList = useMemo(() => {
    const map = new Map<string, { code: string; name: string; slot?: string; venue?: string }>();
    (attendanceItems || []).forEach((c) => {
      if (!map.has(c.course_code)) {
        map.set(c.course_code, {
          code: c.course_code,
          name: c.course_name,
          slot: c.slot_name,
          venue: c.venue,
        });
      }
    });
    return Array.from(map.values());
  }, [attendanceItems]);

  // Derive real upcoming deadlines from tasks
  const upcomingDeadlines = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const pending = portalTasks.filter((t) => !t.completed && t.dueDate);
    pending.sort((a, b) =>
      `${a.dueDate} ${a.dueTime || ''}`.localeCompare(`${b.dueDate} ${b.dueTime || ''}`)
    );
    if (pending.length > 0) {
      return pending.slice(0, 5).map((t) => {
        const isUrgent = t.priority === 'URGENT' || (t.dueDate ? t.dueDate <= todayStr : false);
        const color =
          t.priority === 'URGENT'
            ? 'text-rose-600 bg-rose-50 border-rose-200'
            : t.priority === 'HIGH'
            ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-blue-600 bg-blue-50 border-blue-200';
        const dueText =
          t.dueDate === todayStr
            ? `Today ${t.dueTime || ''}`.trim()
            : `${t.dueDate} ${t.dueTime || ''}`.trim();
        return {
          title: t.title,
          course: t.courseName || t.courseCode || t.category || 'Task',
          code: t.courseCode || t.category || 'Task',
          due: dueText,
          urgent: isUrgent,
          color,
        };
      });
    }
    // Initial friendly sample if tasks not yet added
    return [
      { title: 'Design AVL Tree & Red-Black Tree Implementation', course: 'Data Structures and Algorithms', code: 'CSE2001', due: 'Today 23:59', urgent: true, color: 'text-amber-600 bg-amber-50 border-amber-200' },
      { title: 'E-Commerce Database Schema & 3NF Normalization', course: 'Relational Database Management System', code: 'CSE2007', due: 'In 2 days 17:00', urgent: false, color: 'text-blue-600 bg-blue-50 border-blue-200' },
      { title: 'Print Course Registration Confirmation Form', course: 'College', code: 'College', due: 'In 3 days 15:00', urgent: false, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    ];
  }, [portalTasks]);

  // Derive Today's Classes using the exact Slotwise slotting engine
  const todaySchedule = useMemo(() => {
    if (!attendanceItems || !attendanceItems.length) return null;
    return getClassesForToday(attendanceItems);
  }, [attendanceItems]);

  // Full weekly schedule calculated via Slotwise engine
  const weeklySchedule = useMemo(() => {
    if (!attendanceItems || !attendanceItems.length) return [];
    return generateWeeklySchedule(attendanceItems);
  }, [attendanceItems]);

  // Layout engine for timetable: positions each event with automatic clash handling and row spanning
  const timetableLayout = useMemo(() => {
    return weeklySchedule.map((ev) => {
      const pIdx = TIMES.findIndex(
        (t) => ev.startMinutes >= t.start && ev.startMinutes < t.end
      );
      const safePIdx = pIdx >= 0 ? pIdx : 0;
      const isMultiSpan =
        ev.type === 'Lab' &&
        ev.endMinutes > TIMES[safePIdx].end &&
        safePIdx + 1 < TIMES.length;
      const span = isMultiSpan ? 2 : 1;

      // Detect any events on the same day that overlap in time
      const clashes = weeklySchedule
        .filter(
          (other) =>
            other.dayIndex === ev.dayIndex &&
            ev.startMinutes < other.endMinutes &&
            other.startMinutes < ev.endMinutes
        )
        .sort(
          (a, b) =>
            a.startMinutes - b.startMinutes ||
            a.courseCode.localeCompare(b.courseCode)
        );

      const clashIdx = clashes.indexOf(ev);
      const clashTotal = clashes.length;

      return {
        event: ev,
        pIdx: safePIdx,
        rowStart: safePIdx + 2, // Header is row 1
        rowSpan: span,
        col: ev.dayIndex + 2,   // Time is col 1
        isMultiSpan,
        widthPct: clashTotal > 1 ? 100 / clashTotal : 100,
        leftPct: clashTotal > 1 ? (clashIdx * 100) / clashTotal : 0,
      };
    });
  }, [weeklySchedule]);

  // Unique course list color map
  const courseColorMap = useMemo(() => {
    const map = new Map<string, typeof COURSE_COLORS[0]>();
    const uniqueCodes = Array.from(new Set((attendanceItems || []).map((x) => x.course_code)));
    uniqueCodes.forEach((code, i) => {
      map.set(code, COURSE_COLORS[i % COURSE_COLORS.length]);
    });
    return map;
  }, [attendanceItems]);

  // Deduplicate courses purely for the Courses catalog page (NO ATTENDANCE OR PERCENTAGE)
  const uniqueCoursesCatalog = Array.from(
    new Map(
      (attendanceItems || []).map((item) => [
        item.course_code,
        {
          course_code: item.course_code,
          course_name: item.course_name,
          course_type: item.course_type || 'TEL',
          theory_hours: item.theory,
          practical_hours: item.practical,
          slots: Array.from(
            new Set(
              (attendanceItems || [])
                .filter((x) => x.course_code === item.course_code)
                .map((x) => `${x.component_label} (${x.slot_name}${x.venue ? `, ${x.venue}` : ''})`)
            )
          ).join(' · '),
        },
      ])
    ).values()
  );

  return (
    <SidebarProvider style={{ '--sidebar-width': '240px' } as React.CSSProperties}>
      {/* Sleek Sidebar */}
      <Sidebar className="bg-white border-r border-slate-200/80" collapsible="offcanvas">
        <SidebarHeader className="px-4 py-3 border-b border-slate-100/80 flex items-center justify-center">
          <a href="/portal" className="w-full flex items-center justify-center no-underline py-1.5 px-1">
            <img
              src="/logo.png"
              alt="LMS² — Let Me Survive"
              className="w-full max-w-[210px] h-auto max-h-16 object-contain"
            />
          </a>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Menu</div>
          <SidebarMenu className="gap-0.5">
            {activeNavigation.map((n) => (
              <SidebarMenuItem key={n.id}>
                <SidebarMenuButton
                  className={`h-10 px-3 rounded-xl font-medium text-xs transition-colors flex items-center justify-between ${
                    view === n.id
                      ? 'bg-indigo-50 text-indigo-600 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                  }`}
                  isActive={view === n.id}
                  onClick={() => setView(n.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <n.icon className={`w-4 h-4 flex-shrink-0 ${view === n.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="truncate">{n.label}</span>
                  </div>
                  {n.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-indigo-100/80 text-indigo-700 tracking-wider uppercase font-mono">
                      {n.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          <div className="px-3 mt-7 mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Tools</div>
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton className="h-10 px-3 rounded-xl font-medium text-xs text-slate-600 hover:bg-slate-100/70 flex items-center justify-between" asChild>
                <a href="/slotwise/index.html">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <span>{t.openSlotwise}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 -rotate-45" />
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3.5 border-t border-slate-100 bg-slate-50/50">
          {/* Language Switcher: English vs Gen-Z */}
          <div className="mb-3 p-1 bg-slate-200/70 rounded-xl flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-white text-indigo-700 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageChange('genz')}
              className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                language === 'genz'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Gen-Z</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-900 font-black">FR</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
              {firstName.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-semibold text-slate-900 text-xs truncate leading-tight">
                {formattedFullName}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {session?.user.program || 'B.Tech CSE'}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {onSwitchUser && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onSwitchUser}
                  title="Switch Account / Sign Out"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Users size={14} />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={onLock}
                title="Lock Portal"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <LockKeyhole size={14} />
              </Button>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-center font-medium text-slate-400 border-t border-slate-200/60 pt-2 flex items-center justify-center gap-1">
            <span>Made with</span>
            <span className="text-rose-500 text-xs">❤️</span>
            <span>by <strong className="text-slate-700 font-semibold">Sanskari</strong></span>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-slate-50/50 min-h-screen">
        {/* Top Header — Modern, Prominent & Bold */}
        <header className="h-20 bg-white border-b border-slate-200/70 sticky top-0 z-20 px-6 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-slate-400 hover:text-slate-700 w-9 h-9" />
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {language === 'genz' ? `${t.greetingEvening}, ${firstName}` : `${greeting}, ${firstName}`}
              </h1>
              {language === 'genz' ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs flex-shrink-0">
                  survival mode 💀
                </span>
              ) : (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs flex-shrink-0">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification Bell */}
            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <Bell size={18} />
            </Button>
          </div>
        </header>

        {/* Main Dashboard Space — Full width, properly fits page with no compressed cards or extra side whitespace */}
        <main className="w-full px-6 sm:px-8 py-6 space-y-6 animate-fade-in">

          {/* Offline / Saved university data notice */}
          {isUsingSavedData && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-center justify-between gap-4 text-amber-900 text-xs shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                <span className="truncate">
                  University services are currently offline. Showing your last saved data.{savedDataTimestamp ? ` · Last updated: ${savedDataTimestamp}` : ''}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={refresh} className="h-7 px-3 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 flex-shrink-0">
                Retry
              </Button>
            </div>
          )}

          {!isUsingSavedData && error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-4 text-rose-800 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={17} className="text-rose-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <Button size="sm" variant="outline" onClick={refresh} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
                Retry
              </Button>
            </div>
          )}

          {/* VIEW: OVERVIEW / DASHBOARD — Adaptive Balanced Bento Layout */}
          {view === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

              {/* LEFT COLUMN: Today's Schedule & Attendance Overview */}
              <div className="space-y-6 flex flex-col">

                {/* Today's Schedule Bento Box */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col min-h-[300px]">
                  <div className="flex items-center justify-between mb-3.5 flex-shrink-0">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        {todaySchedule?.isToday ? t.todayScheduleTitle : `${todaySchedule?.dayName || 'Upcoming'} ${language === 'genz' ? 'Lineup' : 'Schedule'}`}
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium">{t.todayScheduleSub}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setView('timetable')} className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 rounded-lg font-medium">
                      {t.viewAll}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[360px] scrollbar-thin">
                    {todaySchedule?.events && todaySchedule.events.length > 0 ? (
                      todaySchedule.events.map((ev, idx) => (
                        <div
                          key={idx}
                          onClick={() => openReport(ev.rawItem)}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 cursor-pointer hover:border-indigo-100"
                        >
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${ev.type === 'Lab' ? 'bg-purple-500' : 'bg-indigo-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-0.5">
                              <span className="flex items-center gap-1 text-slate-600 font-semibold">
                                <Clock size={11} />
                                {ev.timeLabel}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                ev.type === 'Lab'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}>
                                {ev.type}
                              </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ev.courseName}</h3>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono text-indigo-600 font-semibold">{ev.courseCode}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1 font-medium">
                                <MapPin size={11} className="text-slate-400" />
                                {ev.venue || 'Campus'} ({ev.slotName})
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400">
                        <span>{loading ? 'Calculating schedule...' : t.noClassesToday}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attendance Overview Bento Box */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[190px]">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{t.attendanceOverviewTitle}</h2>
                      <p className="text-[11px] text-slate-400 font-medium">{t.attendanceOverviewSub}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 flex-1 my-auto pt-1">
                    {/* SVG Donut Ring Meter */}
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={overall !== null && overall >= TARGET_THRESHOLD ? 'text-emerald-500' : 'text-amber-500'}
                          strokeDasharray={`${overall ?? 80}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                          {overall === null ? '—' : `${Math.round(overall)}%`}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{t.overallAttendance}</span>
                      </div>
                    </div>

                    {/* Stat Badges */}
                    <div className="flex-1 grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
                      <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-center flex flex-col justify-center">
                        <span className="text-xl sm:text-2xl font-black text-emerald-700 block leading-tight">{onTrackCount}</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 flex items-center justify-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t.onTrack}
                        </span>
                      </div>
                      <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50/80 border border-amber-100 text-center flex flex-col justify-center">
                        <span className="text-xl sm:text-2xl font-black text-amber-700 block leading-tight">{needsAttentionCount}</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 flex items-center justify-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning
                        </span>
                      </div>
                      <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50/80 border border-rose-100 text-center flex flex-col justify-center">
                        <span className="text-xl sm:text-2xl font-black text-rose-700 block leading-tight">{atRiskCount}</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 flex items-center justify-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {t.needsAttention}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Quick Actions + Upcoming Deadlines + Reality Check */}
              <div className="space-y-6 flex flex-col">

                {/* Quick Actions Bento Box */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
                  <div className="flex items-center justify-between mb-3.5 flex-shrink-0">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t.quickActionsTitle}</h2>
                      <p className="text-[11px] text-slate-400 font-medium">{t.quickActionsSub}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-500">Shortcuts</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {/* View Timetable */}
                    <button
                      onClick={() => setView('timetable')}
                      className="p-3 rounded-xl bg-[#FAF5FF] hover:bg-[#F3E8FF] border border-[#F3E8FF] transition-all text-left group flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
                          <CalendarDays size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 truncate">{t.actionTimetable}</span>
                      </div>
                      <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
                    </button>

                    {/* Check Attendance */}
                    <button
                      onClick={() => setView('attendance')}
                      className="p-3 rounded-xl bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#DCFCE7] transition-all text-left group flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
                          <ChartNoAxesCombined size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 truncate">{t.actionAttendance}</span>
                      </div>
                      <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
                    </button>

                    {/* Marks */}
                    <button
                      onClick={() => setView('marks')}
                      className="p-3 rounded-xl bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FEF3C7] transition-all text-left group flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <Award size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 truncate">{t.actionMarks}</span>
                      </div>
                      <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
                    </button>

                    {/* My To-Do */}
                    <button
                      onClick={() => setView('tasks')}
                      className="p-3 rounded-xl bg-[#F0F9FF] hover:bg-[#E0F2FE] border border-[#E0F2FE] transition-all text-left group flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center flex-shrink-0">
                          <SquareCheckBig size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 truncate">{t.actionTasks}</span>
                      </div>
                      <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
                    </button>
                  </div>
                </div>

                {/* Upcoming Deadlines Bento Box */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[220px]">
                  <div className="flex items-center justify-between mb-3.5 flex-shrink-0">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{t.upcomingDeadlinesTitle}</h2>
                      <p className="text-[11px] text-slate-400 font-medium">{t.upcomingDeadlinesSub}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setView('tasks')} className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 rounded-lg font-medium">
                      {t.viewAll}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[250px] scrollbar-thin">
                    {upcomingDeadlines.length > 0 ? (
                      upcomingDeadlines.map((task, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100/80 hover:bg-slate-100/60 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${task.color}`}>
                              <FileText size={15} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate leading-tight">{task.title}</h4>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{task.course}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold whitespace-nowrap pl-2 ${task.urgent ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {task.due}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400 text-center">
                        <span>{t.noDeadlines}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Brutally Sarcastic Quote of the Day Bento Box */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-700/60 flex flex-col justify-between relative overflow-hidden min-h-[140px]">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                      <Quote size={13} className="text-indigo-400 rotate-180" />
                      <span>{t.realityCheckTitle}</span>
                    </div>
                    <button
                      onClick={() => setQuoteIndex((prev) => (prev + 1) % SARCASTIC_QUOTES.length)}
                      title="Shuffle brutal quote"
                      className="text-[10px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-slate-800/80 cursor-pointer"
                    >
                      <RefreshCw size={10} />
                      <span>Shuffle</span>
                    </button>
                  </div>

                  <p className="text-xs sm:text-[13px] font-medium text-slate-200 leading-snug italic my-2">
                    "{SARCASTIC_QUOTES[quoteIndex].quote}"
                  </p>

                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
                    <span>— {SARCASTIC_QUOTES[quoteIndex].author}</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* VIEW: ATTENDANCE (Separated Theory & Lab, no limit for labs unless <60%, clean headers, no "Rm") */}
          {view === 'attendance' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Attendance Records</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Click any course to view date-wise class records.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="spinning" size={16} /> Syncing university attendance...
                </div>
              ) : attendanceItems && attendanceItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attendanceItems.map((item, i) => {
                    const isLab = isLabItem(item);
                    const advice = attendanceAdvice(item.present_classes, item.total_classes, TARGET_THRESHOLD, isLab);
                    const low = isLab
                      ? item.total_classes > 0 && item.attendance_percentage! < 60
                      : item.total_classes > 0 && item.attendance_percentage! < TARGET_THRESHOLD;

                    return (
                      <div
                        key={i}
                        onClick={() => openReport(item)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-xs hover:border-indigo-200 ${
                          low ? 'bg-amber-50/20 border-amber-200/80' : 'bg-white border-slate-200/70'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-indigo-600">{item.course_code}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isLab
                                  ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}>
                                {item.component_label} ({item.slot_name})
                              </span>
                            </div>
                            <h3 className="text-xs font-bold text-slate-800 mt-1 truncate">{item.course_name}</h3>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin size={11} /> {item.venue || 'Campus'}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-xl font-black ${low ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {item.attendance_percentage === null ? '—' : `${item.attendance_percentage.toFixed(1)}%`}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-medium">
                              {item.present_classes}/{item.total_classes} attended
                            </span>
                          </div>
                        </div>

                        <Progress value={item.attendance_percentage ?? 0} className="h-1.5 mb-3" />

                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="flex items-center gap-1.5">
                            {low ? <AlertCircle size={13} className="text-amber-500" /> : <ShieldCheck size={13} className="text-emerald-500" />}
                            <span>{advice}</span>
                          </span>
                          <span className="text-indigo-600 font-bold text-[10px] hover:underline">
                            View Log &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No attendance records found for this semester.
                </div>
              )}
            </div>
          )}

          {/* VIEW: MARKS (EXAMINATIONS, CONTINUOUS ASSESSMENTS & CONSOLIDATED BREAKDOWNS) */}
          {view === 'marks' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-6">
              {/* Header with Semester Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Marks & Assessments</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700">
                      University Registry
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Continuous assessments, internal component weightages, and grading standing.
                  </p>
                </div>

                {/* Semester Selector */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">Semester:</span>
                  {marksSemesters.length > 0 && (
                    <Select
                      value={activeMarksSemester}
                      onValueChange={(v) => {
                        setActiveMarksSemester(v);
                        const [y, s] = v.split('|');
                        void loadMarksTimetable(y, s);
                      }}
                    >
                      <SelectTrigger className="h-8 min-w-[150px] bg-slate-100 border-0 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/70 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {marksSemesters.map((s) => {
                          const semK = `${s.slot_year}|${s.semester_type}`;
                          return (
                            <SelectItem key={semK} value={semK} className="text-xs">
                              {s.semester_type} {s.slot_year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                    {marksCourses.length} Registered
                  </span>
                </div>
              </div>

              {/* Course Cards Grid */}
              {marksLoading ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="spinning text-indigo-500" size={22} />
                  <span>Loading enrolled courses...</span>
                </div>
              ) : marksError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
                    <span>{marksError}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadMarksSemesters()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
                    Retry
                  </Button>
                </div>
              ) : marksCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {marksCourses.map((c, i) => {
                    const isLab = c.component_type === 'P' || c.course_type === 'P';
                    const isSingle = c.component_type === 'SINGLE';
                    const typeLabel = isSingle ? 'Single' : isLab ? 'Practical' : 'Theory';

                    return (
                      <div
                        key={c.id || i}
                        onClick={() => openMarksModal(c)}
                        className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {c.course_code}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  isLab
                                    ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}
                              >
                                {typeLabel}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {c.credits} Credits
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                              {c.course_name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-[11px] text-slate-400 mt-1">
                              <span className="font-semibold text-slate-600">Slot {c.slot_name}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1 font-medium text-slate-500">
                                <MapPin size={11} className="text-slate-400" />
                                {c.venue || 'Campus'}
                              </span>
                              {c.faculty_name && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-600 font-medium truncate max-w-[160px]">
                                    {c.faculty_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Click to inspect breakdown
                          </span>
                          <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            <span>Inspect Marks</span>
                            <ArrowRight size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No courses found for this semester.
                </div>
              )}
            </div>
          )}

          {/* VIEW: TIMETABLE (SLOTWISE TABLE STYLE & LOGIC INTEGRATION) */}
          {view === 'timetable' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Weekly Timetable</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Generated from your official university course slots.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                  <a href="/slotwise/index.html" target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                    <span>Open Clash-Free Planner</span>
                    <ArrowRight size={13} />
                  </a>
                </Button>
              </div>

              {/* Slotwise Timetable CSS Grid — Seamless time-frame filling with zero whitespace */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white shadow-xs">
                <div
                  className="min-w-[720px] grid text-xs"
                  style={{
                    gridTemplateColumns: '120px repeat(5, 1fr)',
                    gridTemplateRows: '40px repeat(8, 70px)',
                  }}
                >
                  {/* Header: Time Column */}
                  <div
                    className="bg-slate-50 border-b border-r border-slate-200/80 p-2.5 font-bold text-slate-500 text-xs flex items-center"
                    style={{ gridColumn: 1, gridRow: 1 }}
                  >
                    Time
                  </div>

                  {/* Header: Days Mon-Fri */}
                  {DAYS.map((day, dayIdx) => (
                    <div
                      key={day}
                      className={`bg-slate-50 border-b border-slate-200/80 p-2.5 font-bold text-slate-500 text-xs text-center flex items-center justify-center ${
                        dayIdx === DAYS.length - 1 ? '' : 'border-r'
                      }`}
                      style={{ gridColumn: dayIdx + 2, gridRow: 1 }}
                    >
                      {day}
                    </div>
                  ))}

                  {/* Period Time Labels Column (Rows 2..9) */}
                  {TIMES.map((period, periodIdx) => (
                    <div
                      key={periodIdx}
                      className={`bg-slate-50/50 border-r border-slate-200/80 p-2 font-semibold text-slate-600 text-[11px] whitespace-nowrap flex items-center ${
                        periodIdx === TIMES.length - 1 ? '' : 'border-b'
                      }`}
                      style={{ gridColumn: 1, gridRow: periodIdx + 2 }}
                    >
                      {period.label}
                    </div>
                  ))}

                  {/* Background Grid Slots (8 rows x 5 days) */}
                  {DAYS.map((day, dayIdx) =>
                    TIMES.map((period, periodIdx) => (
                      <div
                        key={`bg-${dayIdx}-${periodIdx}`}
                        className={`border-slate-200/80 hover:bg-slate-50/40 transition-colors ${
                          dayIdx === DAYS.length - 1 ? '' : 'border-r'
                        } ${periodIdx === TIMES.length - 1 ? '' : 'border-b'}`}
                        style={{
                          gridColumn: dayIdx + 2,
                          gridRow: periodIdx + 2,
                        }}
                      />
                    ))
                  )}

                  {/* Scheduled Events Layer */}
                  {timetableLayout.map((item, idx) => {
                    const ev = item.event;
                    const theme = courseColorMap.get(ev.courseCode) || COURSE_COLORS[0];

                    return (
                      <div
                        key={idx}
                        className="p-1 z-10 pointer-events-auto transition-all"
                        style={{
                          gridColumn: item.col,
                          gridRow: `${item.rowStart} / span ${item.rowSpan}`,
                          width: `${item.widthPct}%`,
                          marginLeft: `${item.leftPct}%`,
                        }}
                      >
                        <div
                          onClick={() => openReport(ev.rawItem)}
                          style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
                          className="h-full w-full p-2.5 rounded-xl border text-left cursor-pointer hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                          title={`${ev.courseName} (${ev.courseCode}) · ${ev.slotName} · ${ev.venue} (${ev.timeLabel})`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-extrabold text-[11px] truncate leading-tight">
                                {ev.courseCode}
                              </span>
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                                style={{ backgroundColor: theme.border }}
                              >
                                {ev.slotName}
                              </span>
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-semibold line-clamp-2 leading-snug opacity-95">
                              {ev.courseName}
                            </div>
                          </div>
                          <div className="mt-2 pt-1 border-t border-black/5 flex items-center justify-between text-[9px] opacity-80">
                            <span className="flex items-center gap-1 font-medium truncate">
                              <MapPin size={9} />
                              {ev.venue || 'Campus'}
                            </span>
                            <span className="font-bold px-1.5 py-0.5 rounded bg-white/70 text-[9px]">
                              {item.isMultiSpan ? 'Lab · 2 Slots' : ev.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: ACADEMICS (CURRICULUM AUDIT, BASKET TRACKER & SMART RECOMMENDATIONS) */}
          {view === 'academics' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Academic Curriculum & Degree Audit</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">
                      B.Tech. CSE 2024
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Target: 160 Credits · Core completion status and basket requirement tracker.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">History Semester:</span>
                  {academicsData?.semesters && (
                    <Select
                      value={activeAcademicsSemester}
                      onValueChange={(v) => setActiveAcademicsSemester(v)}
                    >
                      <SelectTrigger className="h-8 min-w-[150px] bg-slate-100 border-0 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/70 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {academicsData.semesters.map((s: any) => {
                          const k = `${s.slot_year}|${s.semester_type}`;
                          return (
                            <SelectItem key={k} value={k} className="text-xs">
                              {s.semester_type} {s.slot_year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {academicsLoading ? (
                <div className="bg-white p-16 rounded-2xl border border-slate-200/70 shadow-xs text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="spinning text-indigo-500" size={22} />
                  <span>Auditing curriculum records against university degree requirements...</span>
                </div>
              ) : academicsError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
                    <span>{academicsError}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadAcademicsData()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
                    Retry
                  </Button>
                </div>
              ) : academicsData ? (
                <>
                  {/* Top Progress Bento: 5 Degree Audit Cards */}
                  {(() => {
                    const audit = effectiveAcademicsAudit || academicsData.audit;
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          {/* Overall Degree Progress */}
                          <div className="p-5 rounded-2xl bg-indigo-600 text-white shadow-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">Total Degree Progress</span>
                              <div className="text-2xl sm:text-3xl font-black mt-1">
                                {audit.totalEarnedCredits} <span className="text-sm font-normal text-indigo-200">/ 160 cr</span>
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex justify-between text-[11px] font-semibold text-indigo-100 mb-1">
                                <span>Completed</span>
                                <span>{audit.completionPercentage}%</span>
                              </div>
                              <div className="w-full h-2 bg-indigo-900/50 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${audit.completionPercentage}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* School Core */}
                          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">School Core</span>
                              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                {audit.categories.schoolCore.earned} <span className="text-xs font-normal text-slate-400">/ 58 cr</span>
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                <span>Target 58</span>
                                <span>{audit.categories.schoolCore.percentage}%</span>
                              </div>
                              <Progress value={audit.categories.schoolCore.percentage} className="h-1.5 bg-slate-100" />
                            </div>
                          </div>

                          {/* Program Core */}
                          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Program Core</span>
                              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                {audit.categories.programCore.earned} <span className="text-xs font-normal text-slate-400">/ 42 cr</span>
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                <span>Target 42</span>
                                <span>{audit.categories.programCore.percentage}%</span>
                              </div>
                              <Progress value={audit.categories.programCore.percentage} className="h-1.5 bg-slate-100" />
                            </div>
                          </div>

                          {/* Discipline Electives */}
                          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Discipline Electives</span>
                              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                {audit.categories.disciplineElective.earned} <span className="text-xs font-normal text-slate-400">/ 42 cr</span>
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                <span>Target 42</span>
                                <span>{audit.categories.disciplineElective.percentage}%</span>
                              </div>
                              <Progress value={audit.categories.disciplineElective.percentage} className="h-1.5 bg-slate-100" />
                            </div>
                          </div>

                          {/* Open Electives */}
                          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Open Electives</span>
                              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                {audit.categories.openElective.earned} <span className="text-xs font-normal text-slate-400">/ 18 cr</span>
                              </div>
                            </div>
                            <div className="mt-4">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                <span>Target 18</span>
                                <span>{audit.categories.openElective.percentage}%</span>
                              </div>
                              <Progress value={audit.categories.openElective.percentage} className="h-1.5 bg-slate-100" />
                            </div>
                          </div>
                        </div>

                        {/* 9 Specialized Elective Baskets Matrix */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <Layers3 size={16} className="text-indigo-600" />
                                <span>Specialized Elective Baskets</span>
                              </h3>
                              <p className="text-[11px] text-slate-400 font-medium">
                                Official CSE requirement: Earn at least 3 credits from each specialized domain (24 credits total).
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {audit.specializedBaskets.map((b: any) => (
                              <div
                                key={b.basketId}
                                className={`p-4 rounded-xl border transition-all ${
                                  b.satisfied
                                    ? 'bg-emerald-50/40 border-emerald-200/80'
                                    : 'bg-slate-50/70 border-slate-200/80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className="text-xs font-bold text-slate-800 line-clamp-1">{b.basketName}</span>
                                  <span
                                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0 ${
                                      b.satisfied
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {b.satisfied ? (
                                      <>
                                        <CheckCircle2 size={10} />
                                        <span>Fulfilled ({b.earnedCredits} cr)</span>
                                      </>
                                    ) : (
                                      <span>Needed (0/{b.minCredits} cr)</span>
                                    )}
                                  </span>
                                </div>

                                {b.courses.length > 0 ? (
                                  <div className="space-y-1 mt-2 pt-2 border-t border-black/5">
                                    {b.courses.map((c: any, cIdx: number) => (
                                      <div key={cIdx} className="text-[11px] flex items-center justify-between text-slate-600">
                                        <span className="font-mono font-bold text-indigo-600 truncate max-w-[180px]">{c.code} · {c.name}</span>
                                        <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">{c.credits} cr</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 mt-1">No courses taken yet in this basket.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Course Recommendations for Next Semester - ONLY shown in latest semester (Fall 2026-27) */}
                  {activeAcademicsSemester === '2026-27|FALL' && academicsData.recommendations && academicsData.recommendations.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-500" />
                            <span>Recommended Courses for Next Semester</span>
                          </h3>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Algorithmically selected from B.Tech. CSE curriculum requirements based on your completed subjects.
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {academicsData.recommendations.length} Recommendations
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {academicsData.recommendations.slice(0, 6).map((rec: any, idx: number) => {
                          const isHigh = rec.priority === 'HIGH';

                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-xl border transition-all ${
                                isHigh
                                  ? 'bg-amber-50/30 border-amber-200/70'
                                  : 'bg-slate-50/60 border-slate-200/80'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-extrabold text-indigo-600 bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                                    {rec.code}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      isHigh
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {isHigh ? 'Mandatory Core' : 'Specialized Basket'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {rec.credits} cr
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{rec.name}</h4>
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {rec.reason}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Semester Course History Table */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          Registered Courses · {activeAcademicsSemester ? activeAcademicsSemester.replace('|', ' ') : 'Semester'}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Registry records and syllabus classification.
                        </p>
                      </div>

                      {/* Add Completed Course button for semesters with manual input support */}
                      {(activeAcademicsSemester === '2024-25|FALL' || activeAcademicsSemester === '2024-25|WINTER') && (
                        <Button
                          size="sm"
                          onClick={() => setShowAddCourseModal(true)}
                          className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          <span>Add Completed Course</span>
                        </Button>
                      )}
                    </div>

                    {(() => {
                      const semRecord = academicsData.semesterHistory.find(
                        (s: any) => s.semesterKey === activeAcademicsSemester
                      );
                      const rawCourses = semRecord?.courses || [];

                      // Deduplicate portal courses by course_code so Theory + Practical are unified
                      const dedupedMap = new Map<string, any>();
                      for (const c of rawCourses) {
                        if (!c.course_code) continue;
                        const code = c.course_code.trim().toUpperCase();
                        if (!dedupedMap.has(code)) {
                          const cur = getCurriculumCourse(code);
                          dedupedMap.set(code, {
                            ...c,
                            course_code: code,
                            course_name: cur?.name || c.course_name,
                            credits: cur?.credits || c.credits || 3,
                            component_type: c.component_type || c.course_type,
                            isManual: false,
                          });
                        } else {
                          const existing = dedupedMap.get(code);
                          const cur = getCurriculumCourse(code);
                          const existingType = existing.component_type || existing.course_type || '';
                          const newType = c.component_type || c.course_type || '';
                          if (existingType !== newType && !existingType.includes('+')) {
                            existing.component_type = 'Theory + Practical';
                          }
                          if (cur) {
                            existing.credits = cur.credits;
                          }
                        }
                      }

                      // Append manual courses for this semester
                      const addedList = manualCourses[activeAcademicsSemester] || [];
                      for (const m of addedList) {
                        const code = m.course_code.trim().toUpperCase();
                        if (!dedupedMap.has(code)) {
                          const cur = getCurriculumCourse(code);
                          dedupedMap.set(code, {
                            course_code: code,
                            course_name: cur?.name || m.course_name,
                            credits: m.credits || cur?.credits || 3,
                            component_type: m.component_type || 'Theory',
                            category: cur?.category,
                            isManual: true,
                          });
                        }
                      }

                      const courses = Array.from(dedupedMap.values());

                      if (courses.length === 0) {
                        return (
                          <div className="py-10 text-center space-y-2">
                            <p className="text-xs text-slate-400">No courses recorded for this semester.</p>
                            {(activeAcademicsSemester === '2024-25|FALL' || activeAcademicsSemester === '2024-25|WINTER') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowAddCourseModal(true)}
                                className="h-8 text-xs border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                              >
                                <Plus size={14} className="mr-1" />
                                Add your first course for this semester
                              </Button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                          <Table>
                            <TableHeader className="bg-slate-50/80">
                              <TableRow>
                                <TableHead className="text-[11px] font-semibold w-[110px]">Code</TableHead>
                                <TableHead className="text-[11px] font-semibold">Course Name</TableHead>
                                <TableHead className="text-[11px] font-semibold">Category</TableHead>
                                <TableHead className="text-[11px] font-semibold">Type</TableHead>
                                <TableHead className="text-[11px] font-semibold text-right">Credits</TableHead>
                                {(activeAcademicsSemester === '2024-25|FALL' || activeAcademicsSemester === '2024-25|WINTER') && (
                                  <TableHead className="text-[11px] font-semibold w-[60px] text-center">Action</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {courses.map((c: any, i: number) => {
                                const cur = getCurriculumCourse(c.course_code);
                                const catLabel = cur
                                  ? cur.category === 'SCHOOL_CORE'
                                    ? 'School Core'
                                    : cur.category === 'PROGRAM_CORE'
                                    ? 'Program Core'
                                    : 'Discipline Elective'
                                  : 'Elective / Other';

                                return (
                                  <TableRow key={i} className="text-xs">
                                    <TableCell className="font-mono font-bold text-indigo-600">
                                      {c.course_code}
                                    </TableCell>
                                    <TableCell className="font-semibold text-slate-800">
                                      {c.course_name}
                                    </TableCell>
                                    <TableCell className="text-slate-500 font-medium">
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
                                        {catLabel}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-slate-600 font-medium">
                                      {c.component_type || c.course_type}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-slate-800">
                                      {c.credits}
                                    </TableCell>
                                    {(activeAcademicsSemester === '2024-25|FALL' || activeAcademicsSemester === '2024-25|WINTER') && (
                                      <TableCell className="text-center">
                                        {c.isManual && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveManualCourse(activeAcademicsSemester, c.course_code)}
                                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            title="Delete course"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : null}
            </div>

          )}

          {/* VIEW: TASKS */}
          {view === 'tasks' && (
            <TasksView
              enrolledCourses={enrolledCourseList}
              onTasksUpdated={setPortalTasks}
            />
          )}

          {/* VIEW: RESOURCE HUB */}
          {view === 'resources' && (
            <ResourcesView
              enrolledCourses={enrolledCourseList}
            />
          )}

          {/* VIEW: PROFILE */}
          {view === 'profile' && (
            <ProfileView
              session={session}
              attendanceTotals={{ ...totals, percentage: overall }}
              totalCoursesCount={uniqueCoursesCatalog.length}
              totalCredits={effectiveAcademicsAudit?.totalEarnedCredits || academicsData?.audit?.totalEarnedCredits || 0}
              language={language}
              onRefreshData={refresh}
              onNavigateView={(targetView) => setView(targetView as any)}
              onSwitchUser={onSwitchUser}
              onLock={onLock}
            />
          )}

        </main>
      </SidebarInset>

      {/* DETAILED ATTENDANCE REPORT MODAL (NO "RM", CLEAN HEADERS) */}
      <Dialog open={!!selectedReportTarget} onOpenChange={(open) => { if (!open) setSelectedReportTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl bg-white">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-indigo-600">
                    {selectedReportTarget?.course_code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                    {selectedReportTarget?.component_label} ({selectedReportTarget?.slot_name})
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedReportTarget?.venue || '510'}
                  </span>
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {selectedReportTarget?.course_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Date-wise attendance log.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {reportLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="spinning text-indigo-500" size={22} />
              <span>Fetching attendance sheet...</span>
            </div>
          ) : reportError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-3">
              <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
              <span>{reportError}</span>
            </div>
          ) : reportData ? (
            <div className="space-y-5 pt-2">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-lg font-black text-slate-800 block">
                    {reportData.summary.total_classes}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Classes</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                  <span className="text-lg font-black text-emerald-700 block">
                    {reportData.summary.present_classes}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase">Present</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
                  <span className="text-lg font-black text-rose-700 block">
                    {reportData.summary.absent_classes}
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 uppercase">Absent</span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                  <span className="text-lg font-black text-indigo-700 block">
                    {reportData.summary.attendance_percentage}%
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-600 uppercase">
                    {selectedReportTarget && isLabItem(selectedReportTarget)
                      ? 'Lab Session'
                      : reportData.summary.meets_requirement
                      ? 'Safe (>=75%)'
                      : 'Below 75%'}
                  </span>
                </div>
              </div>

              {/* Records List Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2.5">
                  Class Log ({reportData.attendance_records?.length ?? 0} Sessions Recorded)
                </h4>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="text-[11px] font-semibold">Date & Day</TableHead>
                        <TableHead className="text-[11px] font-semibold">Slot & Time</TableHead>
                        <TableHead className="text-[11px] font-semibold">Venue</TableHead>
                        <TableHead className="text-[11px] font-semibold">Faculty</TableHead>
                        <TableHead className="text-[11px] font-semibold text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.attendance_records && reportData.attendance_records.length > 0 ? (
                        reportData.attendance_records.map((rec, i) => {
                          const isPresent = rec.status?.toLowerCase() === 'present';
                          const isOD = rec.is_od || rec.status?.toLowerCase() === 'od';

                          return (
                            <TableRow key={i} className="text-xs">
                              <TableCell className="font-semibold text-slate-800">
                                {formatDate(rec.attendance_date)}
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  {rec.slot_day}
                                </span>
                              </TableCell>
                              <TableCell className="text-slate-600">
                                <span>{rec.slot_time}</span>
                                <span className="block text-[10px] text-slate-400">
                                  Slot {rec.slot_name}
                                </span>
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {rec.venue || '510'}
                              </TableCell>
                              <TableCell className="text-slate-700 font-medium">
                                {rec.faculty_name || 'Department Faculty'}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    isOD
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : isPresent
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {isOD ? 'OD' : isPresent ? 'Present' : 'Absent'}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-6">
                            No session records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* DETAILED MARKS & ASSESSMENTS INSPECTION MODAL */}
      <Dialog open={!!selectedCourseForMarks} onOpenChange={(open) => { if (!open) setSelectedCourseForMarks(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl bg-white">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {selectedCourseForMarks?.course_code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    Slot {selectedCourseForMarks?.slot_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedCourseForMarks?.venue || 'Campus'}
                  </span>
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {selectedCourseForMarks?.course_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Examination, continuous assessment, and internal marks summary.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {marksDetailsLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="spinning text-indigo-500" size={22} />
              <span>Fetching official marks registry and weightages...</span>
            </div>
          ) : marksDetailsError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-3">
              <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
              <span>{marksDetailsError}</span>
            </div>
          ) : marksDetailsData ? (
            <div className="space-y-5 pt-2">
              {/* Grand Total & Assessment Banner */}
              {(() => {
                const student = marksDetailsData.consolidated?.students?.[0];
                const grandTotal = student?.grand_total ?? null;
                const gradingType = student?.grading_type || marksDetailsData.consolidated?.stats?.grading_type || 'Relative';
                const assessmentType = marksDetailsData.consolidated?.assessment_type || 'UG_INTEGRATED';

                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">Assessment Standing</span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-black text-slate-900">
                          {grandTotal !== null ? grandTotal : 'In Progress'}
                        </span>
                        {grandTotal !== null && (
                          <span className="text-xs font-semibold text-slate-400">points recorded</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-indigo-700 shadow-2xs border border-indigo-200/60">
                        {gradingType} Grading
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 shadow-2xs border border-slate-200/60">
                        {assessmentType}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Assessment Components Weightage Breakdown Grid (CA1, CA2, CA3, IM, LAB) */}
              {marksDetailsData.consolidated?.students?.[0]?.components && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2.5">
                    Component Breakdown & Weightages
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {Object.entries(marksDetailsData.consolidated.students[0].components).map(
                      ([compKey, compVal]: [string, any]) => {
                        const isPublished = compVal.published;
                        const isEntered = compVal.entered;
                        const actualScore = compVal.actual !== null ? `${compVal.actual} / ${compVal.actual_max}` : 'Not entered';
                        const convertedScore = compVal.converted !== null ? `${compVal.converted}` : '—';

                        return (
                          <div
                            key={compKey}
                            className={`p-3 rounded-xl border text-center flex flex-col justify-between ${
                              isPublished
                                ? 'bg-emerald-50/40 border-emerald-200/80'
                                : isEntered
                                ? 'bg-amber-50/40 border-amber-200/80'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                              <span className="text-slate-800 font-mono">{compKey}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] ${
                                  isPublished
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isEntered
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isPublished ? 'Published' : isEntered ? 'Entered' : 'Pending'}
                              </span>
                            </div>

                            <div className="my-1.5">
                              <span className="text-base font-black text-slate-900 block leading-none">
                                {actualScore}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                Raw Marks
                              </span>
                            </div>

                            <div className="pt-1.5 border-t border-black/5 text-[10px] text-slate-500 flex items-center justify-between">
                              <span>Weight {compVal.weightage}%</span>
                              <span className="font-bold text-indigo-600">Pts {convertedScore}</span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {/* Itemized Marks from my-marks (Assignments, CA tests) */}
              {marksDetailsData.marks?.marks && marksDetailsData.marks.marks.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2.5">
                    Continuous Assessments & Submissions
                  </h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="text-[11px] font-semibold">Component</TableHead>
                          <TableHead className="text-[11px] font-semibold text-center">Marks Obtained</TableHead>
                          <TableHead className="text-[11px] font-semibold text-center">Max Marks</TableHead>
                          <TableHead className="text-[11px] font-semibold text-right">Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marksDetailsData.marks.marks.map((m: any, idx: number) => {
                          const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
                          return (
                            <TableRow key={idx} className="text-xs">
                              <TableCell className="font-semibold text-slate-800">
                                {m.component}
                              </TableCell>
                              <TableCell className="text-center font-bold text-indigo-600">
                                {m.marks_obtained}
                              </TableCell>
                              <TableCell className="text-center text-slate-400">
                                {m.max_marks}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                                  pct >= 75 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {pct}%
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Pending Components Notice */}
              {marksDetailsData.consolidated?.students?.[0]?.pending && marksDetailsData.consolidated.students[0].pending.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
                  <span>
                    Pending assessment evaluation: <strong>{marksDetailsData.consolidated.students[0].pending.join(', ')}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add Completed Course Modal (For Fall/Winter 2024-25) */}
      <Dialog open={showAddCourseModal} onOpenChange={setShowAddCourseModal}>
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Add Completed Course
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Register completed subjects for {activeAcademicsSemester ? activeAcademicsSemester.replace('|', ' ') : 'Semester'} into your degree audit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddManualCourse} className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Course Code</label>
              <Input
                placeholder="e.g. CSE1017 or MAT1001"
                value={newCourseCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setNewCourseCode(val);
                  const cur = getCurriculumCourse(val.trim());
                  if (cur) {
                    setNewCourseName(cur.name);
                    setNewCourseCredits(String(cur.credits));
                  }
                }}
                className="text-xs h-9 font-mono"
                required
              />
              <span className="text-[10px] text-slate-400">
                Tip: Enter curriculum course codes to automatically populate name and credits.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Course Name</label>
              <Input
                placeholder="e.g. Programming in C and C++"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Credits</label>
                <Input
                  type="number"
                  min="0"
                  max="12"
                  step="1"
                  value={newCourseCredits}
                  onChange={(e) => setNewCourseCredits(e.target.value)}
                  className="text-xs h-9 font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Component Type</label>
                <Select value={newCourseType} onValueChange={setNewCourseType}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Theory" className="text-xs">Theory</SelectItem>
                    <SelectItem value="Practical" className="text-xs">Practical</SelectItem>
                    <SelectItem value="Theory + Practical" className="text-xs">Theory + Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddCourseModal(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Add to Semester
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>

  );
}
