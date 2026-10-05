import { debugForRequest } from '@/lib/registration/debug';
import { NextRequest, NextResponse } from 'next/server';
import { prepareSchema, buildPlan } from '@/lib/registration/payload';
import { registrationIdentity, livePreflight } from '@/lib/registration/server';
import { createPlan, previousAttempts } from '@/lib/registration/store';
export const preferredRegion = 'bom1';
export async function POST(request: NextRequest) {
  const trace = debugForRequest(request);
  try {
    const identity = await registrationIdentity(request);
    const raw = await request.text();
    if (raw.length > 64_000) throw new Error('Registration plan is too large.');
    const { courses, term } = prepareSchema.parse(JSON.parse(raw));
    const items = buildPlan(courses, term, true);
    trace.record('plan.validated', {term, courses:courses.map(course => ({course_code:course.course_code, type:course.type, theory_slot:course.theory_slot, practical_slot:course.practical_slot})), metadata:'Will be resolved fresh at execution; pending placeholders are never sent.'});
    const registered = await livePreflight(identity.userId, term, trace);
    const previous = await previousAttempts(identity.userId, term);
    const plan = await createPlan(identity.userId, items);
    return NextResponse.json({ debug:trace.report(), planId: plan.id, expiresAt: plan.expiresAt, account: {name: identity.name, enrollment: identity.enrollment},
      items: items.map((item) => ({...item, alreadyRegistered: registered.has(item.payload.course_code), previousResult: previous[item.payload.course_code] || null})) }, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    trace.record('error', {message:error instanceof Error ? error.message : 'Request failed.'});
    return NextResponse.json({debug:trace.report(), error: error instanceof Error ? error.message : 'Could not review registration.'}, {status: 400});
  }
}
