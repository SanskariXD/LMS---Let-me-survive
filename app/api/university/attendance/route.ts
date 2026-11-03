import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeAttendance } from '@/lib/university/normalize';
import { validateSession } from '@/lib/portal/session';
import { getAttendanceCacheEntry, saveAttendanceCacheEntry } from '@/lib/db/queries';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  if (!session?.userId) return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  const userId = session.userId;
  const params = request.nextUrl.searchParams;
  const year = params.get('slot_year'), type = params.get('semester_type');
  if (!year || !type) return NextResponse.json({error: 'slot_year and semester_type are required'}, {status: 400});
  const entryKey = JSON.stringify([year, type.toUpperCase()]);
  let cached: any = null;
  try { cached = await getAttendanceCacheEntry(userId, entryKey); } catch {}
  try {
    if (params.get('cache_only') === '1') throw new Error('Cached data requested');
    const data = await universityRequest<any>(`${UNIVERSITY_ENDPOINTS.attendance}?${new URLSearchParams({slot_year: year, semester_type: type})}`, {userId});
    const courses = normalizeAttendance(data);
    // An empty array during an outage must not erase a known populated term.
    if (!courses.length && cached?.courses?.length) throw new Error('University returned empty attendance');
    const payload = {courses, fetchedAt: new Date().toISOString()};
    try { await saveAttendanceCacheEntry(userId, entryKey, payload); }
    catch (error) { console.warn('[Attendance] Cache persistence failed:', error); }
    return NextResponse.json(payload);
  } catch {
    if (cached) return NextResponse.json({...cached, isOffline: true});
    return NextResponse.json({isOffline: true, error: 'Attendance is unavailable and no saved records exist for this semester.'}, {status: 503});
  }
}
