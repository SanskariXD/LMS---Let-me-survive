import type { AttendanceComponentItem } from '@/types/university';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export const TIMES = [
  { start: 540, end: 590, label: '09:00 - 09:50' },
  { start: 595, end: 645, label: '09:55 - 10:45' },
  { start: 650, end: 700, label: '10:50 - 11:40' },
  { start: 705, end: 755, label: '11:45 - 12:35' },
  // Lunch: 12:35 - 13:15 (755 - 795)
  { start: 795, end: 845, label: '13:15 - 14:05' },
  { start: 850, end: 900, label: '14:10 - 15:00' },
  { start: 905, end: 955, label: '15:05 - 15:55' },
  { start: 960, end: 1010, label: '16:00 - 16:50' },
] as const;

/**
 * Official University Master Slot Schedule (Directly mapped from /api/slots)
 * DayIndex: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
 */
export const OFFICIAL_AMITY_SLOTS: Record<
  string,
  { dayIndex: number; startMinutes: number; endMinutes: number; isLab: boolean }[]
> = {
  // --- Standard Letter Theory Slots (4 meetings/week) ---
  'A': [
    { dayIndex: 0, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 0, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 1, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 1, startMinutes: 960, endMinutes: 1010, isLab: false },
    { dayIndex: 3, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 3, startMinutes: 850, endMinutes: 900, isLab: false },
  ],
  'B': [
    { dayIndex: 1, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 1, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 2, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 2, startMinutes: 960, endMinutes: 1010, isLab: false },
    { dayIndex: 4, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 4, startMinutes: 850, endMinutes: 900, isLab: false },
  ],
  'C': [
    { dayIndex: 0, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 0, startMinutes: 905, endMinutes: 955, isLab: false },
    { dayIndex: 2, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 2, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 3, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 3, startMinutes: 960, endMinutes: 1010, isLab: false },
  ],
  'D': [
    { dayIndex: 1, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 1, startMinutes: 905, endMinutes: 955, isLab: false },
    { dayIndex: 3, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 3, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 4, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 4, startMinutes: 960, endMinutes: 1010, isLab: false },
  ],
  'E': [
    { dayIndex: 2, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 2, startMinutes: 905, endMinutes: 955, isLab: false },
    { dayIndex: 4, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 4, startMinutes: 795, endMinutes: 845, isLab: false },
  ],
  'F': [
    { dayIndex: 0, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 0, startMinutes: 850, endMinutes: 900, isLab: false },
    { dayIndex: 3, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 3, startMinutes: 905, endMinutes: 955, isLab: false },
  ],
  'G': [
    { dayIndex: 1, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 1, startMinutes: 850, endMinutes: 900, isLab: false },
    { dayIndex: 4, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 4, startMinutes: 905, endMinutes: 955, isLab: false },
  ],
  'H': [
    { dayIndex: 0, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 0, startMinutes: 960, endMinutes: 1010, isLab: false },
    { dayIndex: 2, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 2, startMinutes: 850, endMinutes: 900, isLab: false },
  ],

  // --- Numbered Split Theory Slots ---
  'A1': [
    { dayIndex: 0, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 2, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 4, startMinutes: 650, endMinutes: 700, isLab: false },
  ],
  'A2': [
    { dayIndex: 0, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 2, startMinutes: 850, endMinutes: 900, isLab: false },
    { dayIndex: 4, startMinutes: 905, endMinutes: 955, isLab: false },
  ],
  'B1': [
    { dayIndex: 1, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 2, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 3, startMinutes: 595, endMinutes: 645, isLab: false },
  ],
  'B2': [
    { dayIndex: 1, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 2, startMinutes: 960, endMinutes: 1010, isLab: false },
    { dayIndex: 3, startMinutes: 850, endMinutes: 900, isLab: false },
  ],
  'C1': [
    { dayIndex: 2, startMinutes: 540, endMinutes: 590, isLab: false },
    { dayIndex: 3, startMinutes: 705, endMinutes: 755, isLab: false },
    { dayIndex: 4, startMinutes: 595, endMinutes: 645, isLab: false },
  ],
  'C2': [
    { dayIndex: 2, startMinutes: 795, endMinutes: 845, isLab: false },
    { dayIndex: 3, startMinutes: 960, endMinutes: 1010, isLab: false },
    { dayIndex: 4, startMinutes: 850, endMinutes: 900, isLab: false },
  ],
  'D1': [
    { dayIndex: 0, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 3, startMinutes: 540, endMinutes: 590, isLab: false },
  ],
  'D2': [
    { dayIndex: 0, startMinutes: 905, endMinutes: 955, isLab: false },
    { dayIndex: 3, startMinutes: 795, endMinutes: 845, isLab: false },
  ],
  'E1': [
    { dayIndex: 1, startMinutes: 650, endMinutes: 700, isLab: false },
    { dayIndex: 4, startMinutes: 540, endMinutes: 590, isLab: false },
  ],
  'E2': [
    { dayIndex: 1, startMinutes: 905, endMinutes: 955, isLab: false },
    { dayIndex: 4, startMinutes: 795, endMinutes: 845, isLab: false },
  ],
  'F1': [
    { dayIndex: 0, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 2, startMinutes: 650, endMinutes: 700, isLab: false },
  ],
  'F2': [
    { dayIndex: 0, startMinutes: 850, endMinutes: 900, isLab: false },
    { dayIndex: 2, startMinutes: 905, endMinutes: 955, isLab: false },
  ],
  'G1': [
    { dayIndex: 1, startMinutes: 595, endMinutes: 645, isLab: false },
    { dayIndex: 3, startMinutes: 650, endMinutes: 700, isLab: false },
  ],
  'G2': [
    { dayIndex: 1, startMinutes: 850, endMinutes: 900, isLab: false },
    { dayIndex: 3, startMinutes: 905, endMinutes: 955, isLab: false },
  ],

  // --- Tutorial Slots ---
  'TA1': [{ dayIndex: 1, startMinutes: 705, endMinutes: 755, isLab: false }],
  'TA2': [{ dayIndex: 1, startMinutes: 960, endMinutes: 1010, isLab: false }],
  'TB1': [{ dayIndex: 4, startMinutes: 705, endMinutes: 755, isLab: false }],
  'TB2': [{ dayIndex: 4, startMinutes: 960, endMinutes: 1010, isLab: false }],
  'TC1': [{ dayIndex: 0, startMinutes: 705, endMinutes: 755, isLab: false }],
  'TC2': [{ dayIndex: 0, startMinutes: 960, endMinutes: 1010, isLab: false }],

  // --- 2-Hour Practical Lab Slots (Spanning 2 consecutive slots = 105 mins) ---
  'L1+L2': [{ dayIndex: 0, startMinutes: 540, endMinutes: 645, isLab: true }],
  'L3+L4': [{ dayIndex: 0, startMinutes: 650, endMinutes: 755, isLab: true }],
  'L21+L22': [{ dayIndex: 0, startMinutes: 795, endMinutes: 900, isLab: true }],
  'L23+L24': [{ dayIndex: 0, startMinutes: 905, endMinutes: 1010, isLab: true }],

  'L5+L6': [{ dayIndex: 1, startMinutes: 540, endMinutes: 645, isLab: true }],
  'L7+L8': [{ dayIndex: 1, startMinutes: 650, endMinutes: 755, isLab: true }],
  'L25+L26': [{ dayIndex: 1, startMinutes: 795, endMinutes: 900, isLab: true }],
  'L27+L28': [{ dayIndex: 1, startMinutes: 905, endMinutes: 1010, isLab: true }],

  'L9+L10': [{ dayIndex: 2, startMinutes: 540, endMinutes: 645, isLab: true }],
  'L11+L12': [{ dayIndex: 2, startMinutes: 650, endMinutes: 755, isLab: true }],
  'L29+L30': [{ dayIndex: 2, startMinutes: 795, endMinutes: 900, isLab: true }],
  'L31+L32': [{ dayIndex: 2, startMinutes: 905, endMinutes: 1010, isLab: true }],

  'L13+L14': [{ dayIndex: 3, startMinutes: 540, endMinutes: 645, isLab: true }],
  'L15+L16': [{ dayIndex: 3, startMinutes: 650, endMinutes: 755, isLab: true }],
  'L33+L34': [{ dayIndex: 3, startMinutes: 795, endMinutes: 900, isLab: true }],
  'L35+L36': [{ dayIndex: 3, startMinutes: 905, endMinutes: 1010, isLab: true }],

  'L17+L18': [{ dayIndex: 4, startMinutes: 540, endMinutes: 645, isLab: true }],
  'L19+L20': [{ dayIndex: 4, startMinutes: 650, endMinutes: 755, isLab: true }],
  'L37+L38': [{ dayIndex: 4, startMinutes: 795, endMinutes: 900, isLab: true }],
  'L39+L40': [{ dayIndex: 4, startMinutes: 905, endMinutes: 1010, isLab: true }],
};

export interface TimetableEvent {
  dayIndex: number; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
  dayName: string;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  courseCode: string;
  courseName: string;
  slotName: string;
  venue: string;
  type: 'Theory' | 'Lab';
  rawItem: AttendanceComponentItem;
}

export function formatTimeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Parse an enrolled course component and return its scheduled weekly time blocks
 * using the official Amity University slot mapping.
 */
export function getEventsForComponent(item: AttendanceComponentItem): TimetableEvent[] {
  const events: TimetableEvent[] = [];
  const slotRaw = (item.slot_name || '').trim();
  if (!slotRaw) return events;

  // Split composite slot names e.g. "L3+L4,L23+L24" or "B1,B2"
  const subSlots = slotRaw.includes(',')
    ? slotRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [slotRaw];

  for (const slot of subSlots) {
    // 1. Direct match in official master slot table
    if (OFFICIAL_AMITY_SLOTS[slot]) {
      for (const s of OFFICIAL_AMITY_SLOTS[slot]) {
        events.push({
          dayIndex: s.dayIndex,
          dayName: DAYS[s.dayIndex],
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          timeLabel: `${formatTimeMinutes(s.startMinutes)} – ${formatTimeMinutes(s.endMinutes)}`,
          courseCode: item.course_code,
          courseName: item.course_name,
          slotName: slot,
          venue: item.venue,
          type: s.isLab ? 'Lab' : 'Theory',
          rawItem: item,
        });
      }
      continue;
    }

    // 2. Tokenized match for combination slots e.g. "B1+B2"
    if (slot.includes('+') && !slot.startsWith('L')) {
      const tokens = slot.split('+').map((s) => s.trim().toUpperCase()).filter(Boolean);
      let matchedAny = false;
      for (const token of tokens) {
        if (OFFICIAL_AMITY_SLOTS[token]) {
          matchedAny = true;
          for (const s of OFFICIAL_AMITY_SLOTS[token]) {
            events.push({
              dayIndex: s.dayIndex,
              dayName: DAYS[s.dayIndex],
              startMinutes: s.startMinutes,
              endMinutes: s.endMinutes,
              timeLabel: `${formatTimeMinutes(s.startMinutes)} – ${formatTimeMinutes(s.endMinutes)}`,
              courseCode: item.course_code,
              courseName: item.course_name,
              slotName: token,
              venue: item.venue,
              type: s.isLab ? 'Lab' : 'Theory',
              rawItem: item,
            });
          }
        }
      }
      if (matchedAny) continue;
    }

    // 3. Fallback for unlisted lab slot pairs (e.g. L41+L42)
    const isLab = item.component_label === 'Lab' || item.component_type === 'P' || slot.startsWith('L');
    if (isLab) {
      const ns = [...slot.matchAll(/L(\d+)/g)].map((m) => Number(m[1]));
      for (let i = 0; i < ns.length; i += 2) {
        const n = ns[i];
        if (!n || n < 1) continue;
        const isMorning = n <= 20;
        const local = (n - 1) % 20;
        const dayIndex = Math.floor(local / 4);
        if (dayIndex < 0 || dayIndex > 4) continue;

        const p = local % 4 === 0 ? 0 : 1;
        const start = isMorning ? (p === 0 ? 540 : 650) : p === 0 ? 795 : 905;
        const end = start + 105;

        events.push({
          dayIndex,
          dayName: DAYS[dayIndex],
          startMinutes: start,
          endMinutes: end,
          timeLabel: `${formatTimeMinutes(start)} – ${formatTimeMinutes(end)}`,
          courseCode: item.course_code,
          courseName: item.course_name,
          slotName: `L${n}+L${n + 1}`,
          venue: item.venue,
          type: 'Lab',
          rawItem: item,
        });
      }
    }
  }

  // Deduplicate any exact identical events
  return events.filter(
    (ev, idx, self) =>
      idx ===
      self.findIndex(
        (e) =>
          e.dayIndex === ev.dayIndex &&
          e.startMinutes === ev.startMinutes &&
          e.courseCode === ev.courseCode
      )
  );
}

/**
 * Generate full weekly schedule from all enrolled components
 */
export function generateWeeklySchedule(items: AttendanceComponentItem[]): TimetableEvent[] {
  const allEvents = items.flatMap(getEventsForComponent);
  // Sort chronologically by day then start time
  return allEvents.sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes);
}

/**
 * Get classes taking place today (or next campus day if weekend)
 */
export function getClassesForToday(items: AttendanceComponentItem[]): {
  dayName: string;
  isToday: boolean;
  events: TimetableEvent[];
} {
  const allEvents = generateWeeklySchedule(items);
  if (!allEvents.length) {
    return { dayName: 'Today', isToday: true, events: [] };
  }

  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const targetDayIndex = jsDay === 0 || jsDay === 6 ? 0 : jsDay - 1; // Default to Monday on weekends

  const todayEvents = allEvents.filter((e) => e.dayIndex === targetDayIndex);

  // If no classes on target day, find the next day with classes
  if (!todayEvents.length) {
    for (let offset = 1; offset <= 5; offset++) {
      const nextDay = (targetDayIndex + offset) % 5;
      const found = allEvents.filter((e) => e.dayIndex === nextDay);
      if (found.length) {
        return {
          dayName: DAYS[nextDay],
          isToday: nextDay === (jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : -1),
          events: found,
        };
      }
    }
  }

  return {
    dayName: DAYS[targetDayIndex],
    isToday: jsDay >= 1 && jsDay <= 5,
    events: todayEvents,
  };
}
