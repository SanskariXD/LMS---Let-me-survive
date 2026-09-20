import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeAttendance } from '@/lib/university/normalize';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const slotYear = searchParams.get('slot_year');
    const semesterType = searchParams.get('semester_type');

    if (!slotYear || !semesterType) {
      return NextResponse.json(
        { error: 'slot_year and semester_type are required' },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({ slot_year: slotYear, semester_type: semesterType });
    const data = await universityRequest<any>(
      `${UNIVERSITY_ENDPOINTS.attendance}?${params}`,
    );

    const courses = normalizeAttendance(data);

    return NextResponse.json({
      courses,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendance' },
      { status: 502 },
    );
  }
}
