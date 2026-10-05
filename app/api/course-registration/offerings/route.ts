import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { termSchema } from '@/lib/registration/payload';
import { registrationIdentity } from '@/lib/registration/server';
import { fetchOfferings } from '@/lib/registration/lookup';
export const preferredRegion = 'bom1';
export async function POST(request: NextRequest) {
  try {
    const identity = await registrationIdentity(request);
    const raw = await request.text();
    if (raw.length > 2_000) throw new Error('Invalid lookup request.');
    const {courseCode, term} = z.object({courseCode:z.string().regex(/^[A-Z]{2,6}[0-9]{3,6}$/), term:termSchema}).strict().parse(JSON.parse(raw));
    return NextResponse.json(await fetchOfferings(identity.userId, courseCode, term), {headers:{'Cache-Control':'no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof Error ? error.message : 'Offerings unavailable.'}, {status:400});}
}
