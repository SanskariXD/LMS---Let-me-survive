/**
 * Local offline cache manager for student portal university data.
 * Protects student privacy: never caches passwords, PINs, or auth secrets.
 * Caching is keyed strictly by student enrollment number.
 */

export interface UniversitySnapshot {
  studentId: string;
  timestamp: string; // ISO string of last successful fetch
  user?: {
    name: string;
    username: string;
    enrollment: string | null;
    program: string | null;
  };
  semesters?: Array<{ slot_year: string; semester_type: string }>;
  currentSemester?: { slot_year: string; semester_type: string } | null;
  attendanceItems?: any[];
  attendanceReports?: Record<string, any>;
  timetableEvents?: any[];
  academicsData?: any;
  marksData?: {
    semesters?: Array<{ slot_year: string; semester_type: string }>;
    courses?: any[];
    courseDetails?: Record<string, { marks: any; consolidated: any }>;
    [key: string]: any;
  };
}

const CACHE_PREFIX = 'slotwise_univ_cache_';
const TIMESTAMP_PREFIX = 'slotwise_univ_synced_at_';

/**
 * Returns true if current India Standard Time (IST, UTC+5:30) is within
 * the expected university API downtime (approx 5:00 PM to 9:10 AM).
 */
export function isUniversityExpectedDowntime(): boolean {
  try {
    const now = new Date();
    // Compute current time in Asia/Kolkata (IST)
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // 5:00 PM is 17 * 60 = 1020 minutes
    // 9:10 AM is 9 * 60 + 10 = 550 minutes
    // Downtime is from 17:00 (1020m) through midnight until 09:10 (550m)
    return timeInMinutes >= 1020 || timeInMinutes < 550;
  } catch {
    return false;
  }
}

/**
 * Saves university data snapshot into localStorage.
 */
export function saveUniversitySnapshot(studentId: string, data: Partial<UniversitySnapshot>): void {
  if (typeof window === 'undefined' || !studentId) return;
  try {
    const existing = getUniversitySnapshot(studentId) || { studentId, timestamp: new Date().toISOString() };
    const merged: UniversitySnapshot = {
      ...existing,
      ...data,
      studentId,
      attendanceReports: {
        ...(existing.attendanceReports || {}),
        ...(data.attendanceReports || {}),
      },
      marksData: {
        ...(existing.marksData || {}),
        ...(data.marksData || {}),
        courseDetails: {
          ...(existing.marksData?.courseDetails || {}),
          ...(data.marksData?.courseDetails || {}),
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Never persist sensitive auth fields
    if (merged.user) {
      delete (merged.user as any).password;
      delete (merged.user as any).token;
    }

    localStorage.setItem(`${CACHE_PREFIX}${studentId}`, JSON.stringify(merged));
    localStorage.setItem(`${TIMESTAMP_PREFIX}${studentId}`, merged.timestamp);
  } catch (err) {
    console.warn('[OfflineCache] Failed to save snapshot to localStorage:', err);
  }
}

/**
 * Retrieves the saved university data snapshot from localStorage.
 */
export function getUniversitySnapshot(studentId: string): UniversitySnapshot | null {
  if (typeof window === 'undefined' || !studentId) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${studentId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Returns the ISO timestamp of the last successful refresh.
 */
export function getUniversityCacheTimestamp(studentId: string): string | null {
  if (typeof window === 'undefined' || !studentId) return null;
  try {
    return localStorage.getItem(`${TIMESTAMP_PREFIX}${studentId}`) || null;
  } catch {
    return null;
  }
}

/**
 * Clears cached university data for the student without removing personal tasks or custom additions.
 */
export function clearUniversitySnapshot(studentId: string): void {
  if (typeof window === 'undefined' || !studentId) return;
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${studentId}`);
    localStorage.removeItem(`${TIMESTAMP_PREFIX}${studentId}`);
  } catch (err) {
    console.warn('[OfflineCache] Failed to clear snapshot:', err);
  }
}

/**
 * Formats a snapshot timestamp into a human-readable Indian time string.
 */
export function formatCacheTimestamp(isoString: string | null): string {
  if (!isoString) return 'Never';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });

    return `${dateStr}, ${timeStr}`;
  } catch {
    return isoString;
  }
}
