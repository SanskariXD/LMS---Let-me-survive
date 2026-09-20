import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

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

    const endpoint = UNIVERSITY_ENDPOINTS.myTimetable(slotYear, semesterType);
    const data = await universityRequest<any>(endpoint);

    return NextResponse.json({
      student: data.student,
      semester_info: data.semester_info,
      registrations: data.registrations || [],
      allRegistrations: data.allRegistrations || [],
      projectRegistrations: data.projectRegistrations || [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timetable registrations' },
      { status: 502 },
    );
  }
}
