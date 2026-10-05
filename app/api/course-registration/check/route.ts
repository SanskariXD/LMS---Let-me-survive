import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { debugForRequest } from '@/lib/registration/debug';
import { termSchema } from '@/lib/registration/payload';
import { registrationIdentity, livePreflight } from '@/lib/registration/server';
export const preferredRegion = 'bom1';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const trace=debugForRequest(request);
  try {
    const identity=await registrationIdentity(request);
    const raw=await request.text();
    if (raw.length > 2_000) throw new Error('Invalid readiness check.');
    const {term}=z.object({term:termSchema}).strict().parse(JSON.parse(raw));
    const registered=await livePreflight(identity.userId,term,trace);
    return NextResponse.json({ready:true, checkedAt:new Date().toISOString(), registeredCourseCodes:[...registered], debug:trace.report()}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const message=error instanceof Error ? error.message : 'Registration readiness could not be verified.';
    trace.record('check.failed',{message});
    return NextResponse.json({ready:false, error:message, debug:trace.report()}, {status:400, headers:{'Cache-Control':'no-store'}});
  }
}
