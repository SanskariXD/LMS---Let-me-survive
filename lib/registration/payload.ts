import { z } from 'zod';
import { events, overlap } from '../../public/slotwise/engine.mjs';

const text = z.string().trim().max(160);
export const selectionSchema = z.object({
  course_code: text.min(1),
  course_name: text.min(1),
  type: z.enum(['THEORY_LAB', 'LAB', 'THEORY', 'PROJECT']),
  theory_slot: text,
  theory_venue: text,
  theory_faculty: text,
  practical_slot: text,
  practical_venue: text,
  practical_faculty: text,
}).strict();
export type RegistrationSelection = z.infer<typeof selectionSchema>;
export type RegistrationPayload = Record<string, string>;
export const termSchema = z.object({slot_year: z.string().regex(/^20\d{2}-\d{2}$/).refine(value => Number(value.slice(5)) === (Number(value.slice(0,4)) + 1) % 100, 'Use a consecutive academic year, for example 2026-27.'), semester_type: z.enum(['FALL', 'WINTER', 'SUMMER'])}).strict();
export type RegistrationTerm = z.infer<typeof termSchema>;
export const defaultTerm: RegistrationTerm = {slot_year: '2026-27', semester_type: 'FALL'};
export const prepareSchema = z.object({ courses: z.array(selectionSchema).min(1).max(30), term: termSchema.default(defaultTerm) }).strict();
export const executeSchema = z.object({ planId: z.string().uuid(), courseCode: z.string().regex(/^[A-Z]{2,6}[0-9]{3,6}$/), retryRejected: z.boolean().optional() }).strict();

function required(value: string, label: string) {
  if (!value || /^(TBA|N\/A|Faculty not listed|Unknown)$/i.test(value)) throw new Error(`${label} must match the official university listing.`);
  return value;
}
function theorySlot(value: string) {
  if (!/^(T?[A-G][12])(\+T?[A-G][12])*$/.test(value)) throw new Error('Select a valid theory slot.');
  return value;
}
function labSlot(value: string) {
  const match = /^L(\d+)\+L(\d+)$/.exec(value);
  if (!match || +match[1] < 1 || +match[1] > 39 || +match[1] % 2 !== 1 || +match[2] !== +match[1] + 1) {
    throw new Error('Select one official adjacent lab pair, for example L19+L20. Combined lab pairs need separate university verification.');
  }
  return value;
}
export function buildRegistrationPayload(raw: unknown, term: RegistrationTerm = defaultTerm): RegistrationPayload {
  const course = selectionSchema.parse(raw);
  if (!/^[A-Z]{2,6}[0-9]{3,6}$/.test(course.course_code)) throw new Error('Choose one exact official course code.');
  const base = {course_code: course.course_code, ...termSchema.parse(term)};
  if (course.type === 'THEORY_LAB') return {
    ...base,
    theory_slot: theorySlot(course.theory_slot),
    theory_venue: required(course.theory_venue, 'Theory venue'),
    theory_faculty: required(course.theory_faculty, 'Theory faculty'),
    practical_slot: labSlot(course.practical_slot),
    practical_venue: required(course.practical_venue, 'Lab venue'),
    practical_faculty: required(course.practical_faculty, 'Lab faculty'),
  };
  if (course.type === 'PROJECT') return {
    ...base, slot_name: 'PROJECT', venue: course.theory_venue || 'N/A',
    faculty_name: required(course.theory_faculty, 'Project faculty'), course_type: 'PRJ',
  };
  const lab = course.type === 'LAB';
  return { ...base, slot_name: lab ? labSlot(course.practical_slot) : theorySlot(course.theory_slot),
    venue: required(lab ? course.practical_venue : course.theory_venue, 'Venue'),
    faculty_name: required(lab ? course.practical_faculty : course.theory_faculty, 'Faculty') };
}

export function buildPlan(courses: RegistrationSelection[], term: RegistrationTerm = defaultTerm, allowUnresolved = false) {
  const codes = new Set<string>();
  const timed: Array<{day: number; start: number; end: number; code: string}> = [];
  return courses.map((rawCourse) => {
    const course = selectionSchema.parse(rawCourse);
    if (codes.has(course.course_code)) throw new Error(`Duplicate course: ${course.course_code}`);
    codes.add(course.course_code);
    try {
      // Validate slot intent independently of catalogue venue/faculty, which are never trusted for sending.
      const intent = {...course, theory_venue: 'Official lookup pending', practical_venue: 'Official lookup pending', theory_faculty: 'Official lookup pending', practical_faculty: 'Official lookup pending'};
      const payload = buildRegistrationPayload(allowUnresolved ? intent : course, term);
      const slots = course.type === 'PROJECT' ? [] : events({
        theory: course.type === 'LAB' ? '' : course.theory_slot,
        lab: course.type === 'THEORY' ? '' : course.practical_slot,
      });
      for (const slot of slots) {
        const conflict = timed.find((previous) => overlap(previous, slot));
        if (conflict) throw new Error(`Timetable clash with ${conflict.code}. Review the selected slots in Slotwise.`);
        timed.push({...slot, code: course.course_code});
      }
      return { course, payload };
    }
    catch (error) { throw new Error(`${course.course_code}: ${(error as Error).message}`); }
  });
}

export type Outcome = 'success' | 'rejected' | 'uncertain' | 'skipped';
export function classifyRegistrationResponse(status: number, body: unknown): Outcome {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (status >= 400 && status < 500 && status !== 408) return 'rejected';
  if (status < 200 || status >= 300) return 'uncertain';
  if (data.success === false || data.error) return 'rejected';
  if (data.success === true || /(?:registered successfully|successfully registered|registration successful)/i.test(String(data.message || ''))) return 'success';
  return 'uncertain';
}

const officialMetadata = text.min(1).refine(value => !/^(TBA|N\/A|Unknown|Faculty not listed|Official lookup pending)$/i.test(value), 'Official venue/faculty is required before sending.');
const payloadBase = {course_code:text.regex(/^[A-Z]{2,6}[0-9]{3,6}$/), ...termSchema.shape};
const checkedSlot = (check: (value: string) => string) => text.min(1).refine(value => {try {check(value); return true;} catch {return false;}}, 'Invalid registration slot.');
export const registrationPayloadSchema = z.union([
  z.object({...payloadBase, theory_slot:checkedSlot(theorySlot), theory_venue:officialMetadata, theory_faculty:officialMetadata, practical_slot:checkedSlot(labSlot), practical_venue:officialMetadata, practical_faculty:officialMetadata}).strict(),
  z.object({...payloadBase, slot_name:z.literal('PROJECT'), venue:text.min(1).refine(value => value === 'N/A' || officialMetadata.safeParse(value).success), faculty_name:officialMetadata, course_type:z.literal('PRJ')}).strict(),
  z.object({...payloadBase, slot_name:checkedSlot(value => value.startsWith('L') ? labSlot(value) : theorySlot(value)), venue:officialMetadata, faculty_name:officialMetadata}).strict(),
]);
export function validateRegistrationPayload(raw: unknown): RegistrationPayload {
  const parsed = registrationPayloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Registration payload is incomplete or invalid. No university request was sent.');
  return parsed.data;
}
