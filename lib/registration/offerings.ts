import type { DebugTrace } from './debug';
import { buildRegistrationPayload, type RegistrationSelection, type RegistrationTerm } from './payload';

export type Offering = {course_code: string; course_title: string; course_type: string; slots_offered: string; venue: string; faculty_name: string; available_seats?: string | number};
export type OfferingResponse = {course_info: {course_code: string; course_name: string; theory: number; practical: number; credits: number; course_type: string}; offerings: Offering[]};
const slot = (value: string) => value.toUpperCase().replace(/\s+/g, '');
const name = (value: string) => value.toLowerCase().replace(/\b(dr|prof|mr|ms|mrs)\b/g, '').replace(/[^a-z0-9]/g, '');
export function validateOfferings(raw: unknown, code: string): OfferingResponse {
  const data = raw as OfferingResponse;
  if (!data?.course_info || data.course_info.course_code !== code || !Array.isArray(data.offerings) || !data.offerings.length) throw new Error('Official offerings are unavailable for this course and semester.');
  if (typeof data.course_info.course_name !== 'string' || ![data.course_info.theory, data.course_info.practical, data.course_info.credits].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new Error('Official course information could not be verified.');
  for (const row of data.offerings) {
    if (row.course_code !== code || typeof row.slots_offered !== 'string' || typeof row.venue !== 'string' || typeof row.faculty_name !== 'string') throw new Error('The university offering format could not be verified.');
  }
  return data;
}
function match(data: OfferingResponse, selectedSlot: string, faculty: string, trace?: DebugTrace): Offering {
  const candidates = data.offerings.filter(row => slot(row.slots_offered) === slot(selectedSlot));
  trace?.record('offering.candidates', {selectedSlot, selectedFaculty:faculty, candidates}, data.course_info.course_code);
  if (!candidates.length) throw new Error(`Selected slot ${selectedSlot} is not in the official offerings.`);
  // A unique slot identifies its section even if the old catalogue abbreviated or misspelled the name.
  // Multiple sections require a unique faculty match; never choose the first venue arbitrarily.
  const matching = candidates.length === 1 ? candidates : candidates.filter(row => name(row.faculty_name) === name(faculty) && name(faculty));
  const unique = [...new Map(matching.map(row => [`${row.slots_offered}|${row.venue}|${row.faculty_name}`, row])).values()];
  if (unique.length !== 1) throw new Error(`Multiple sections for ${selectedSlot}. Choose the official professor in Slotwise.`);
  const row = unique[0];
  if (!row.venue.trim() || !row.faculty_name.trim()) throw new Error(`Venue or faculty is not yet added for ${selectedSlot}.`);
  trace?.record('offering.matched', {selectedSlot, offering:row, seats:parseSeatAvailability(row.available_seats)}, data.course_info.course_code);
  return row;
}
export function resolveSelection(course: RegistrationSelection, term: RegistrationTerm, raw: unknown, trace?: DebugTrace) {
  const data = validateOfferings(raw, course.course_code);
  const info = data.course_info;
  const actualType = info.course_type === 'PRJ' ? 'PROJECT' : Number(info.theory) > 0 && Number(info.practical) > 0 ? 'THEORY_LAB' : Number(info.practical) > 0 ? 'LAB' : Number(info.theory) > 0 ? 'THEORY' : null;
  if (actualType !== course.type) throw new Error('Course type differs from the official listing. Reload this course in Slotwise.');
  const seats: SeatDetail[] = [];
  const resolved = {...course, course_name: info.course_name || course.course_name};
  if (course.type !== 'LAB') {
    const row = match(data, course.type === 'PROJECT' ? 'PROJECT' : course.theory_slot, course.theory_faculty, trace);
    seats.push({component:course.type === 'PROJECT' ? 'Project' : 'Theory', slot:row.slots_offered, ...parseSeatAvailability(row.available_seats)});
    resolved.theory_venue = row.venue; resolved.theory_faculty = row.faculty_name;
  }
  if (course.type === 'LAB' || course.type === 'THEORY_LAB') {
    const row = match(data, course.practical_slot, course.practical_faculty, trace);
    seats.push({component:'Lab', slot:row.slots_offered, ...parseSeatAvailability(row.available_seats)});
    resolved.practical_venue = row.venue; resolved.practical_faculty = row.faculty_name;
  }
  const payload = buildRegistrationPayload(resolved, term);
  trace?.record('payload.built', {type:course.type, payload, seats}, course.course_code);
  return {course: resolved, payload, seats};
}

export type SeatDetail = {component: string; slot: string; state: 'available' | 'full' | 'unknown'; count: number | null; raw: unknown};
export function parseSeatAvailability(raw: unknown): Pick<SeatDetail, 'state' | 'count' | 'raw'> {
  // Missing/null/empty and descriptive values are unknown, rather than falsely reported as zero.
  const text = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
  const count = /^\d+(?:\.0+)?$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(count) || count < 0) return {state:'unknown', count:null, raw:raw ?? null};
  return {state:count === 0 ? 'full' : 'available', count, raw};
}
export function assertSeatsAvailable(seats: SeatDetail[]) {
  const full = seats.find(seat => seat.state === 'full');
  if (full) throw new Error(`No seats available for ${full.slot} (${full.component.toLowerCase()}; university reported 0). No registration request was sent.`);
  // An unknown display count is not an eligibility decision. The university POST validates capacity.
}
