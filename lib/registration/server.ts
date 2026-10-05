import { NextRequest } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserById } from '@/lib/db/queries';
import { universityRequest, getValidTokenForUser } from '@/lib/university/client';
import { universityConfig } from '@/lib/university/config';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { classifyRegistrationResponse, defaultTerm, type RegistrationTerm } from './payload';
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
export async function livePreflight(userId: string, term: RegistrationTerm = defaultTerm) {
  const status = await universityRequest<{enabled?: boolean}>(UNIVERSITY_ENDPOINTS.registrationStatus, {userId, cache: 'no-store'});
  if (status?.enabled !== true) throw new Error('University course registration is closed or its status could not be verified.');
  const timetable = await universityRequest<Record<string, unknown>>(UNIVERSITY_ENDPOINTS.myTimetable(term.slot_year, term.semester_type), {userId, cache: 'no-store'});
  const lists = ['registrations', 'allRegistrations', 'projectRegistrations'].filter((field) => Array.isArray(timetable?.[field]));
  if (!lists.length) throw new Error('Your existing registrations could not be verified. No request was sent.');
  const codes = new Set<string>();
  for (const field of lists) for (const row of timetable[field] as Array<Record<string, unknown>>) {
    if (typeof row.course_code !== 'string' || !row.course_code.trim()) throw new Error('An existing registration could not be identified. Review your university timetable.');
    codes.add(row.course_code.trim().toUpperCase());
  }
  return codes;
}

export async function sendRegistration(userId: string, payload: Record<string, string>, retryRejected = false) {
  // Resolve authentication BEFORE marking a potentially sent request. Never use default credentials.
  const token = await getValidTokenForUser(userId);
  const previous = await claimAttempt(userId, payload.course_code, payload, retryRejected, {slot_year:payload.slot_year, semester_type:payload.semester_type as RegistrationTerm['semester_type']});
  if (previous) return previous;
  let outcome: 'success' | 'rejected' | 'uncertain' = 'uncertain';
  let message = 'No definite response was received. Check the university portal before trying this course again.';
  try {
    // One fixed endpoint, one POST, no retry or redirect following. The general GET client is intentionally not used here.
    const response = await fetch(`${universityConfig.baseUrl}/api/course-registration/register`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', ...(universityConfig.authMode === 'x-access-token' ? {'x-access-token': token} : {Authorization: `Bearer ${token}`}) },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { data = null; }
    outcome = classifyRegistrationResponse(response.status, data) as 'success' | 'rejected' | 'uncertain';
    const body = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    // Only plain user-facing message fields are returned; never expose raw token-bearing responses.
    const detail = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
    message = outcome === 'success' ? 'Registered successfully.' : outcome === 'rejected'
      ? (detail.slice(0, 400) || `University rejected this request (HTTP ${response.status}).`)
      : `The university response was inconclusive (HTTP ${response.status}). Check your university timetable before retrying.`;
    if (message.includes(token)) message = 'University returned an unexpected response. Check your university timetable.';
  } catch {
    // A timeout can happen after the university has committed the registration. Never resubmit it automatically.
  }
  await finishAttempt(userId, payload.course_code, outcome, message, {slot_year:payload.slot_year, semester_type:payload.semester_type as RegistrationTerm['semester_type']});
  return { outcome, message, sent: true };
}
