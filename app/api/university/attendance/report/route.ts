import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';
import { getUniversityCachedData, saveUniversityCachedData } from '@/lib/db/queries';
import { ensureDbInitialized } from '@/db';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  const userId = session?.userId || request.headers.get('x-user-id') || undefined;

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

  try {
    const data = await universityRequest<any>(endpointPath, { userId });

    // Cache the report in database for offline viewing
    if (userId && data) {
      ensureDbInitialized().then(async () => {
        const existing = await getUniversityCachedData(userId);
        let attendanceObj: any = { courses: [], reports: {} };
        if (existing?.attendance_json) {
          try {
            const p = JSON.parse(existing.attendance_json);
            if (Array.isArray(p)) {
              attendanceObj.courses = p;
            } else if (p && typeof p === 'object') {
              attendanceObj = p;
              if (!attendanceObj.reports) attendanceObj.reports = {};
            }
          } catch {}
        }
        attendanceObj.reports[courseCode] = data;
        await saveUniversityCachedData(userId, {
          attendanceJson: JSON.stringify(attendanceObj),
        });
      }).catch((err) => console.warn('[AttendanceReport] Cache save failed:', err));
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.warn('[AttendanceReport] Fetch failed, checking cache fallback:', error?.message);

    if (userId) {
      try {
        await ensureDbInitialized();
        const cached = await getUniversityCachedData(userId);
        if (cached?.attendance_json) {
          const p = JSON.parse(cached.attendance_json);
          const cachedReport = p?.reports?.[courseCode];
          if (cachedReport) {
            return NextResponse.json({
              ...cachedReport,
              isOffline: true,
              fetchedAt: new Date(cached.updated_at).toISOString(),
            });
          }
        }
      } catch (cacheErr) {
        console.warn('[AttendanceReport] Cache fallback failed:', cacheErr);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendance report' },
      { status: 502 },
    );
  }
}
