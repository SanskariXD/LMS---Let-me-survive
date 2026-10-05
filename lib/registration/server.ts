import { sanitizeDebug, type DebugTrace } from './debug';
import { NextRequest } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserById } from '@/lib/db/queries';
import { universityRequest, getValidTokenForUser } from '@/lib/university/client';
import { universityConfig } from '@/lib/university/config';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { classifyRegistrationResponse, validateRegistrationPayload, defaultTerm, type RegistrationTerm } from './payload';
import { claimAttempt, finishAttempt } from './store';

export async function registrationIdentity(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) throw new Error('Open registration from your LMS² portal.');
  if (Number(request.headers.get('content-length') || 0) > 64_000) throw new Error('Registration plan is too large.');
  const session = await validateSession();
  if (!session?.userId) throw new Error('Sign in to your portal before registering.');
  const user = await getUserById(session.userId);
  if (!user) throw new Error('Account could not be verified.');
  return { userId: session.userId, name: user.student_name, enrollment: user.enrollment_number };
}
export async function livePreflight(userId: string, term: RegistrationTerm = defaultTerm, trace?: DebugTrace) {
  const status = await universityRequest<{enabled?: boolean}>(UNIVERSITY_ENDPOINTS.registrationStatus, {userId, cache:'no-store', ...(trace?.enabled ? {onResponse:event => trace.record('preflight.status.response', event)} : {})});
  trace?.record('preflight.status', {enabled:status?.enabled, term});
  if (status?.enabled !== true) throw new Error('University course registration is closed or its status could not be verified.');
  const timetable = await universityRequest<Record<string, unknown>>(UNIVERSITY_ENDPOINTS.myTimetable(term.slot_year, term.semester_type), {userId, cache:'no-store', ...(trace?.enabled ? {onResponse:event => trace.record('preflight.timetable.response', event)} : {})});
  const lists = ['registrations', 'allRegistrations', 'projectRegistrations'].filter((field) => Array.isArray(timetable?.[field]));
  if (!lists.length) throw new Error('Your existing registrations could not be verified. No request was sent.');
  const codes = new Set<string>();
  for (const field of lists) for (const row of timetable[field] as Array<Record<string, unknown>>) {
    if (typeof row.course_code !== 'string' || !row.course_code.trim()) throw new Error('An existing registration could not be identified. Review your university timetable.');
    codes.add(row.course_code.trim().toUpperCase());
  }
  trace?.record('preflight.registered', {term, courseCodes:[...codes]});
  return codes;
}

export async function sendRegistration(userId: string, payload: Record<string, string>, retryRejected = false, trace?: DebugTrace) {
  payload = validateRegistrationPayload(payload);
  const bodyText = JSON.stringify(payload);
  // Check the exact serialised body too; never send planner objects, placeholders or a nested payload wrapper.
  validateRegistrationPayload(JSON.parse(bodyText));
  trace?.record('payload.validated', {payload, keys:Object.keys(payload), format:'application/json', bodyBytes:Buffer.byteLength(bodyText,'utf8')}, payload.course_code);
  // Resolve authentication BEFORE marking a potentially sent request. Never use default credentials.
  const token = await getValidTokenForUser(userId);
  const previous = await claimAttempt(userId, payload.course_code, payload, retryRejected, {slot_year:payload.slot_year, semester_type:payload.semester_type as RegistrationTerm['semester_type']});
  if (previous) {trace?.record('registration.duplicate', previous, payload.course_code); return previous;}
  let outcome: 'success' | 'rejected' | 'uncertain' = 'uncertain';
  let message = 'No definite response was received. Check the university portal before trying this course again.';
  const started = Date.now();
  try {
    trace?.record('registration.request', {method:'POST', url:`${universityConfig.baseUrl}/api/course-registration/register`, headers:{'Content-Type':'application/json', ...(universityConfig.authMode === 'x-access-token' ? {'x-access-token':'[REDACTED]'} : {Authorization:'Bearer [REDACTED]'})}, payload, bodyText, redirect:'error', automaticRetry:false}, payload.course_code);
    // One fixed endpoint, one POST, no retry or redirect following. The general GET client is intentionally not used here.
    const response = await fetch(`${universityConfig.baseUrl}/api/course-registration/register`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', ...(universityConfig.authMode === 'x-access-token' ? {'x-access-token': token} : {Authorization: `Bearer ${token}`}) },
      body: bodyText,
    });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { data = null; }
    trace?.record('registration.response', {status:response.status, contentType:response.headers.get('content-type'), elapsedMs:Date.now()-started, body:sanitizeDebug(data ?? raw,[token])}, payload.course_code);
    outcome = classifyRegistrationResponse(response.status, data) as 'success' | 'rejected' | 'uncertain';
    const body = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    // Only plain user-facing message fields are returned; never expose raw token-bearing responses.
    const detail = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
    message = outcome === 'success' ? 'Registered successfully.' : outcome === 'rejected'
      ? (detail.slice(0, 400) || `University rejected this request (HTTP ${response.status}).`)
      : `The university response was inconclusive (HTTP ${response.status}). Check your university timetable before retrying.`;
    message = String(sanitizeDebug(message,[token]));
    if (/Missing required fields/i.test(detail)) {
      const reportedFields=(detail.split(':')[1] || '').split(',').map(field => field.trim()).filter(field => /^[a-z_]+$/.test(field));
      trace?.record('registration.format-diagnosis', {universityMessage:sanitizeDebug(detail,[token]), payloadShape:payload.theory_slot ? 'THEORY_LAB' : payload.course_type === 'PRJ' ? 'PROJECT' : 'SINGLE_COMPONENT', reportedRequiredFields:reportedFields, reportedFieldsAbsentFromSentBody:reportedFields.filter(field => !payload[field]), sentKeys:Object.keys(payload), locallyValidated:true, explanation:'Compare the actual body and response. Combined courses use the supplied separate theory/practical format. No alternate shape or automatic retry was sent.'}, payload.course_code);
    }
  } catch (error) {
    trace?.record('registration.transport-error', {elapsedMs:Date.now()-started, message:sanitizeDebug(error instanceof Error ? error.message : 'Network error',[token]), outcome:'uncertain', automaticRetry:false}, payload.course_code);
    // A timeout can happen after the university has committed the registration. Never resubmit it automatically.
  }
  await finishAttempt(userId, payload.course_code, outcome, message, {slot_year:payload.slot_year, semester_type:payload.semester_type as RegistrationTerm['semester_type']});
  trace?.record('registration.result', {outcome, message, sent:true}, payload.course_code);
  return { outcome, message, sent: true };
}
