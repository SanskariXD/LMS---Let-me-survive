import type { DebugTrace } from './debug';
import { universityRequest } from '@/lib/university/client';
import { termSchema, type RegistrationSelection, type RegistrationTerm } from './payload';
import { validateOfferings, resolveSelection } from './offerings';
export async function fetchOfferings(userId: string, code: string, term: RegistrationTerm, trace?: DebugTrace) {
  termSchema.parse(term);
  if (!/^[A-Z]{2,6}[0-9]{3,6}$/.test(code)) throw new Error('Enter one exact course code, for example CSE2033.');
  const path = `/api/course-registration/course-offerings/${encodeURIComponent(code)}/${encodeURIComponent(term.slot_year)}/${encodeURIComponent(term.semester_type)}`;
  trace?.record('offerings.request', {method:'GET', path, term}, code);
  const raw = await universityRequest(path, {userId, cache:'no-store', ...(trace?.enabled ? {onResponse:event => trace.record('offerings.response', event, code)} : {})});
  return validateOfferings(raw, code);
}
export async function resolveOfficialCourse(userId: string, course: RegistrationSelection, term: RegistrationTerm, trace?: DebugTrace) {
  return resolveSelection(course, term, await fetchOfferings(userId, course.course_code, term, trace), trace);
}
