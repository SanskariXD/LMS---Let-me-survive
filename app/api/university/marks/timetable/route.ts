import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';
import { getUniversityCachedData, saveUniversityCachedData } from '@/lib/db/queries';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  const userId = session?.userId || request.headers.get('x-user-id') || undefined;

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

    const payload = {
      student: data.student,
      semester_info: data.semester_info,
      registrations: data.registrations || [],
      allRegistrations: data.allRegistrations || [],
      projectRegistrations: data.projectRegistrations || [],
      fetchedAt: new Date().toISOString(),
    };

    if (userId) {
      saveUniversityCachedData(userId, {
        timetableJson: JSON.stringify(payload),
      }).catch(() => {});
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    // Attempt database cache fallback
    if (userId) {
      const cached = await getUniversityCachedData(userId);
      if (cached?.timetable_json) {
        try {
          const payload = JSON.parse(cached.timetable_json);
          return NextResponse.json({
            ...payload,
            isOffline: true,
            fetchedAt: new Date(cached.updated_at).toISOString(),
          });
        } catch {}
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch timetable registrations', isOffline: true },
      { status: 502 },
    );
  }
}
