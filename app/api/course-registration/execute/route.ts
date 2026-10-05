import { NextRequest, NextResponse } from 'next/server';
import { executeSchema } from '@/lib/registration/payload';
import { registrationIdentity, livePreflight, sendRegistration } from '@/lib/registration/server';
import { acquireUserLock, getPlan, finishAttempt } from '@/lib/registration/store';
export const preferredRegion = 'bom1';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
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
    const registered = await livePreflight(identity.userId);
    if (registered.has(input.courseCode)) {
      await finishAttempt(identity.userId, input.courseCode, 'skipped', 'Already registered. No request was sent.');
      return NextResponse.json({outcome: 'skipped', message: 'Already registered. No request was sent.', sent: false});
    }
    return NextResponse.json(await sendRegistration(identity.userId, item.payload, input.retryRejected), {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Registration could not proceed.'}, {status: 400});
  } finally {
    if (release) await release().catch(() => {});
  }
}
