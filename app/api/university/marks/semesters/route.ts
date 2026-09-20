import { NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

export async function GET() {
  try {
    const data = await universityRequest<Array<{ slot_year: string; semester_type: string }>>(
      UNIVERSITY_ENDPOINTS.mySemesters,
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
