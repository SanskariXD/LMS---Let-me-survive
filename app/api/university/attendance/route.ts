import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeAttendance } from '@/lib/university/normalize';
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

    const params = new URLSearchParams({ slot_year: slotYear, semester_type: semesterType });
    const data = await universityRequest<any>(
      `${UNIVERSITY_ENDPOINTS.attendance}?${params}`,
      { userId },
    );

    const courses = normalizeAttendance(data);

    if (userId && courses.length > 0) {
      saveUniversityCachedData(userId, {
        attendanceJson: JSON.stringify(courses),
      }).catch(() => {});
    }

    return NextResponse.json({
      courses,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    // Attempt database cache fallback
    if (userId) {
      const cached = await getUniversityCachedData(userId);
      if (cached?.attendance_json) {
        try {
          const courses = JSON.parse(cached.attendance_json);
          return NextResponse.json({
            courses,
            isOffline: true,
            fetchedAt: new Date(cached.updated_at).toISOString(),
          });
        } catch {}
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendance', isOffline: true },
      { status: 502 },
    );
  }
}
