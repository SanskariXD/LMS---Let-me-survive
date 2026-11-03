import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';
import { getAttendanceCacheEntry, saveAttendanceCacheEntry } from '@/lib/db/queries';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  const userId = session?.userId;
    if (!userId) return NextResponse.json({error: 'Unauthorized'}, {status: 401});

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
    if (searchParams.get('cache_only') === '1') throw new Error('Cached data requested');
    const data = await universityRequest<any>(endpointPath, { userId });

    if (!data?.course_details || !Array.isArray(data.attendance_records)) throw new Error('Invalid attendance report');
    try { await saveAttendanceCacheEntry(userId, JSON.stringify([slotYear, semesterType.toUpperCase(), courseCode, slotName || '']), {...data, fetchedAt: new Date().toISOString()}); }
    catch (error) { console.warn('[AttendanceReport] Cache persistence failed:', error); }

    return NextResponse.json(data);
  } catch (error: any) {
    console.warn('[AttendanceReport] Fetch failed, checking cache fallback:', error?.message);

    try {
      const cachedReport = await getAttendanceCacheEntry(userId, JSON.stringify([slotYear, semesterType.toUpperCase(), courseCode, slotName || '']));
      if (cachedReport) return NextResponse.json({...cachedReport, isOffline: true});
    } catch {}

    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendance report' },
      { status: 502 },
    );
  }
}
