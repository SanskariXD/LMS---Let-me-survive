import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  const userId = session?.userId;
    if (!userId) return NextResponse.json({error: 'Unauthorized'}, {status: 401});

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
    const data = await universityRequest<any>(endpoint, { userId });

    if (!Array.isArray(data?.registrations) && !Array.isArray(data?.allRegistrations)) throw new Error('Invalid timetable response');
    const payload = {
      student: data.student,
      semester_info: data.semester_info,
      registrations: data.registrations || [],
      allRegistrations: data.allRegistrations || [],
      projectRegistrations: data.projectRegistrations || [],
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timetable registrations', isOffline: true },
      { status: 502 },
    );
  }
}
