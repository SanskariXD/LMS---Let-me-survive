import { NextRequest, NextResponse } from 'next/server';
import { prepareSchema, buildPlan } from '@/lib/registration/payload';
import { registrationIdentity } from '@/lib/registration/server';
import { resolveOfficialCourse } from '@/lib/registration/lookup';
export const preferredRegion = 'bom1';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const identity = await registrationIdentity(request);
    const raw = await request.text();
    if (raw.length > 64_000) throw new Error('Plan is too large.');
    const {courses, term} = prepareSchema.parse(JSON.parse(raw));
    buildPlan(courses, term, true);
    const items = [];
    const started = Date.now();
    // Bounded parallel GETs speed up the import without flooding the university API.
    for (let i = 0; i < courses.length; i += 4) {
      items.push(...await Promise.all(courses.slice(i, i + 4).map(async course => {
        try {
          if (Date.now() - started > 40_000) throw new Error('Lookup is taking longer than expected. Retry official details before registration.');
          return {...await resolveOfficialCourse(identity.userId, course, term), error: null}; }
        catch (error) { return {course, payload: null, error: error instanceof Error ? error.message : 'Venue not yet added.'}; }
      })));
    }
    return NextResponse.json({items}, {headers: {'Cache-Control':'no-store'}});
  } catch(error) {return NextResponse.json({error: error instanceof Error ? error.message : 'Lookup failed.'}, {status:400});}
}
