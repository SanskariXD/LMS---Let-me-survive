import { NextRequest, NextResponse } from 'next/server';
import { prepareSchema, buildPlan } from '@/lib/registration/payload';
import { registrationIdentity, livePreflight } from '@/lib/registration/server';
import { createPlan, previousAttempts } from '@/lib/registration/store';
export const preferredRegion = 'bom1';
export async function POST(request: NextRequest) {
  try {
    const identity = await registrationIdentity(request);
    const raw = await request.text();
    if (raw.length > 64_000) throw new Error('Registration plan is too large.');
    const { courses } = prepareSchema.parse(JSON.parse(raw));
    const items = buildPlan(courses);
    const registered = await livePreflight(identity.userId);
    const previous = await previousAttempts(identity.userId);
    const plan = await createPlan(identity.userId, items);
    return NextResponse.json({ planId: plan.id, expiresAt: plan.expiresAt, account: {name: identity.name, enrollment: identity.enrollment},
      items: items.map((item) => ({...item, alreadyRegistered: registered.has(item.payload.course_code), previousResult: previous[item.payload.course_code] || null})) }, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Could not review registration.'}, {status: 400});
  }
}
