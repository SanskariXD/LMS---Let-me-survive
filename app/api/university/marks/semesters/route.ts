import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id') || undefined;

    const data = await universityRequest<Array<{ slot_year: string; semester_type: string }>>(
      UNIVERSITY_ENDPOINTS.mySemesters,
      { userId },
    );

    return NextResponse.json({
      semesters: data || [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch semesters' },
      { status: 502 },
    );
  }
}
