import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const courseCode = searchParams.get('course_code');
    const slotYear = searchParams.get('slot_year');
    const semesterType = searchParams.get('semester_type');
    const slotName = searchParams.get('slot_name') || undefined;

    if (!courseCode || !slotYear || !semesterType) {
      return NextResponse.json(
        { error: 'course_code, slot_year, and semester_type are required' },
        { status: 400 },
      );
    }

    const endpointPath = UNIVERSITY_ENDPOINTS.attendanceReport(
      courseCode,
      slotYear,
      semesterType,
      slotName,
    );

    const data = await universityRequest<any>(endpointPath);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendance report' },
      { status: 502 },
    );
  }
}
