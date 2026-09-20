import type { AttendanceComponentItem } from '@/types/university';

export function attendanceAdvice(
  attended: number,
  total: number,
  target: number = 75,
  isLab: boolean = false,
): string {
  if (isLab) {
    if (total === 0) return 'No lab sessions held yet.';
    const pct = total > 0 ? (attended / total) * 100 : 0;
    if (pct < 60) {
      return `Low lab attendance (${Math.round(pct)}%). Attend upcoming labs.`;
    }
    return 'Lab component — no 75% requirement.';
  }

  if (
    !Number.isFinite(attended) || !Number.isFinite(total) || !Number.isFinite(target) ||
    attended < 0 || total < 0 || attended > total || target <= 0 || target >= 100
  ) {
    return 'Attendance cannot be calculated.';
  }
  if (total === 0) return 'No classes held yet.';
  const p = target / 100;
  if (attended / total < p) {
    const needed = Math.max(0, Math.ceil((p * total - attended) / (1 - p) - 1e-9));
    return `Attend next ${needed} class${needed === 1 ? '' : 'es'} to reach ${target}%.`;
  }
  const allowance = Math.max(0, Math.floor(attended / p - total + 1e-9));
  return allowance
    ? `${allowance} class${allowance === 1 ? '' : 'es'} buffer above ${target}%.`
    : `On track: attend next class to stay above ${target}%.`;
}

export function normalizeSemesters(data: unknown) {
  if (!Array.isArray(data)) throw new Error('The university semester response has an unexpected format.');
  const list = data.map((s: any) => {
    if (typeof s?.slot_year !== 'string' || typeof s?.semester_type !== 'string' || !s.slot_year || !s.semester_type) {
      throw new Error('The university semester response has an unexpected format.');
    }
    return { slot_year: s.slot_year, semester_type: s.semester_type };
  });
  return [...new Map(list.map((s) => [s.slot_year + '|' + s.semester_type, s])).values()].sort(
    (a, b) => b.slot_year.localeCompare(a.slot_year) || a.semester_type.localeCompare(b.semester_type),
  );
}

function parseCount(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function parsePercentage(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeAttendance(data: unknown): AttendanceComponentItem[] {
  if (!Array.isArray(data)) throw new Error('The university attendance response has an unexpected format.');

  return data
    .filter((raw) => raw && typeof raw === 'object')
    .map((raw: any) => {
      const course_code = String(raw.course_code || raw.courseCode || '').trim();
      const course_name = String(raw.course_name || raw.courseName || '').trim();
      const total_classes = parseCount(raw.total_classes ?? raw.total_lectures);
      const present_classes = parseCount(raw.present_classes ?? raw.attended_lectures);
      const absent_classes = Math.max(0, total_classes - present_classes);

      const compType = String(raw.component_type || 'SINGLE').toUpperCase();
      let label = raw.component_label ? String(raw.component_label).trim() : '';
      if (!label) {
        if (compType === 'T') label = 'Theory';
        else if (compType === 'P') label = 'Lab';
        else label = 'Course';
      }

      const pct = raw.attendance_percentage !== undefined && raw.attendance_percentage !== null
        ? parsePercentage(raw.attendance_percentage)
        : total_classes > 0 ? (present_classes / total_classes) * 100 : null;

      return {
        course_code,
        course_name,
        slot_year: String(raw.slot_year || ''),
        semester_type: String(raw.semester_type || ''),
        component_type: compType,
        slot_name: String(raw.slot_name || ''),
        venue: String(raw.venue || ''),
        theory: parseCount(raw.theory),
        practical: parseCount(raw.practical),
        course_type: String(raw.course_type || ''),
        attendance_percentage: pct !== null ? Math.round(pct * 100) / 100 : null,
        total_classes,
        present_classes,
        absent_classes,
        original_slot_name: raw.original_slot_name ? String(raw.original_slot_name) : null,
        component_label: label,
      };
    });
}
