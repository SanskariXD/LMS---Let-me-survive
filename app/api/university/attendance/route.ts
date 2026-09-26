import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeAttendance } from '@/lib/university/normalize';
import { validateSession } from '@/lib/portal/session';
import { getUniversityCachedData, saveUniversityCachedData } from '@/lib/db/queries';
import { ensureDbInitialized } from '@/db';

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
      await ensureDbInitialized();
      getUniversityCachedData(userId).then((existing) => {
        let reports = {};
        if (existing?.attendance_json) {
          try {
            const p = JSON.parse(existing.attendance_json);
            if (!Array.isArray(p) && p?.reports) reports = p.reports;
          } catch {}
        }
        return saveUniversityCachedData(userId, {
          attendanceJson: JSON.stringify({ courses, reports }),
        });
      }).catch((err) => console.warn('[Attendance] Cache save failed:', err));
    }

    return NextResponse.json({
      courses,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Attendance] Fetch failed, attempting cache fallback:', error?.message);

    // Attempt database cache fallback
    if (userId) {
      try {
        await ensureDbInitialized();
        const cached = await getUniversityCachedData(userId);
        if (cached?.attendance_json) {
          const parsed = JSON.parse(cached.attendance_json);
          const courses = Array.isArray(parsed) ? parsed : (parsed.courses || []);
          return NextResponse.json({
            courses,
            isOffline: true,
            fetchedAt: new Date(cached.updated_at).toISOString(),
          });
        }
      } catch (cacheErr) {
        console.error('[Attendance] Cache fallback also failed:', cacheErr);
      }
    }

    // Return empty result with offline flag instead of 502
    return NextResponse.json({
      courses: [],
      isOffline: true,
      error: error?.message || 'University service temporarily unavailable',
      fetchedAt: new Date().toISOString(),
    });
  }
}
