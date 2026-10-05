import { debugForRequest } from '@/lib/registration/debug';
import { NextRequest, NextResponse } from 'next/server';
import { executeSchema, termSchema } from '@/lib/registration/payload';
import { registrationIdentity, livePreflight, sendRegistration } from '@/lib/registration/server';
import { resolveOfficialCourse } from '@/lib/registration/lookup';
import { assertSeatsAvailable } from '@/lib/registration/offerings';
import { acquireUserLock, getPlan, finishAttempt } from '@/lib/registration/store';
export const preferredRegion = 'bom1';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const trace = debugForRequest(request);
  let release: (() => Promise<void>) | undefined;
  try {
    const identity = await registrationIdentity(request);
    const raw = await request.text();
    if (raw.length > 2_000) throw new Error('Invalid registration request.');
    const input = executeSchema.parse(JSON.parse(raw));
    const plan = await getPlan(input.planId, identity.userId);
    const item = plan.find((entry) => entry.payload.course_code === input.courseCode);
    if (!item) throw new Error('This course is not in your reviewed plan.');
    release = await acquireUserLock(identity.userId);
    const term = termSchema.parse({slot_year: item.payload.slot_year, semester_type: item.payload.semester_type});
    const registered = await livePreflight(identity.userId, term, trace);
    if (registered.has(input.courseCode)) {
      await finishAttempt(identity.userId, input.courseCode, 'skipped', 'Already registered. No request was sent.', term);
      return NextResponse.json({outcome: 'skipped', message: 'Already registered. No request was sent.', sent: false, debug:trace.report()});
    }
    let resolved: Awaited<ReturnType<typeof resolveOfficialCourse>> | undefined;
    try { resolved = await resolveOfficialCourse(identity.userId, item.course, term, trace); assertSeatsAvailable(resolved.seats); }
    catch (error) {trace.record('registration.blocked', {message:error instanceof Error ? error.message : 'Lookup failed.'}, input.courseCode); return NextResponse.json({debug:trace.report(), ...(resolved ? {official:resolved} : {}), outcome:'blocked', message:error instanceof Error ? error.message : 'Venue not yet added.', sent:false}, {headers:{'Cache-Control':'no-store'}});}
    // Use only this course's fresh official metadata, keeping the saved slot and professor intent.
    return NextResponse.json({...await sendRegistration(identity.userId, resolved.payload, input.retryRejected, trace), official:resolved, debug:trace.report()}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    trace.record('error', {message:error instanceof Error ? error.message : 'Request failed.'});
    return NextResponse.json({debug:trace.report(), error: error instanceof Error ? error.message : 'Registration could not proceed.'}, {status: 400});
  } finally {
    if (release) await release().catch(() => {});
  }
}
