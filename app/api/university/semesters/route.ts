import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeSemesters } from '@/lib/university/normalize';
import { validateSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id') || undefined;
    const data = await universityRequest<unknown>(UNIVERSITY_ENDPOINTS.semesters, { userId });
    const semesters = normalizeSemesters(data);
    return NextResponse.json({ semesters });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch semesters' },
      { status: 502 },
    );
  }
}
