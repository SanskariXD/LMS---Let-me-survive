import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId;
    if (!userId) return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    const data = await universityRequest(UNIVERSITY_ENDPOINTS.registrationStatus, { userId });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Registration status unavailable' },
      { status: 502 },
    );
  }
}
