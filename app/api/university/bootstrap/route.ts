import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { normalizeSemesters } from '@/lib/university/normalize';
import { validateSession } from '@/lib/portal/session';
import { getUserById, getUniversityCachedData, saveUniversityCachedData, updateUserEmail } from '@/lib/db/queries';

export const preferredRegion = 'bom1';

interface ProbeResult {
  endpoint: string;
  received: boolean;
  httpStatus?: number;
  responseType?: string;
  itemCount?: number;
  topLevelFields?: number;
  rawResponse?: unknown;
}

const DEFAULT_FALLBACK_SEMESTERS = [
  { slot_year: '2026-27', semester_type: 'FALL' },
  { slot_year: '2025-26', semester_type: 'SUMMER' },
  { slot_year: '2025-26', semester_type: 'WINTER' },
  { slot_year: '2025-26', semester_type: 'FALL' },
  { slot_year: '2024-25', semester_type: 'SUMMER' },
  { slot_year: '2024-25', semester_type: 'WINTER' },
  { slot_year: '2024-25', semester_type: 'FALL' },
];

async function probe(name: string, path: string, userId?: string): Promise<ProbeResult> {
  try {
    const data = await universityRequest<any>(path, { userId, timeoutMs: 4000 });
    return {
      endpoint: name,
      received: true,
      responseType: Array.isArray(data) ? 'array' : typeof data,
      itemCount: Array.isArray(data) ? data.length : undefined,
      topLevelFields: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).length : undefined,
      rawResponse: data,
    };
  } catch (error: unknown) {
    const err = error as {
      status?: number;
      code?: string;
      message?: string;
      cause?: unknown;
    };

    console.error(`[bootstrap] ${name} failed`, {
      path,
      userId,
      status: err.status,
      code: err.code,
      message: err.message,
      cause: err.cause,
    });

    return {
      endpoint: name,
      received: false,
      httpStatus: err.status,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id') || undefined;
    const dbUser = userId ? await getUserById(userId) : null;
    const enrollment = dbUser?.enrollment_number || session?.enrollment || process.env.UNIVERSITY_STUDENT_ID || '';
    if (!enrollment) {
      return NextResponse.json({ error: 'Unauthorized or no enrollment found' }, { status: 401 });
    }

    const [meProbe, semestersProbe, studentProbe, regStatusProbe, withdrawalProbe, slotsProbe, schoolsProbe, programsProbe] = await Promise.all([
      probe('auth/me', UNIVERSITY_ENDPOINTS.me, userId),
      probe('semesters', UNIVERSITY_ENDPOINTS.semesters, userId),
      probe('student', UNIVERSITY_ENDPOINTS.student(enrollment), userId),
      probe('registration-status', UNIVERSITY_ENDPOINTS.registrationStatus, userId),
      probe('withdrawal-status', UNIVERSITY_ENDPOINTS.withdrawalStatus, userId),
      probe('slots', UNIVERSITY_ENDPOINTS.slots, userId),
      probe('schools', UNIVERSITY_ENDPOINTS.schools, userId),
      probe('programs', UNIVERSITY_ENDPOINTS.programs, userId),
    ]);

    // If live university endpoints are offline or failed, return cached/fallback data with 200 OK
    if (!meProbe.received && !semestersProbe.received) {
      let cachedSemesters = DEFAULT_FALLBACK_SEMESTERS;
      let cachedAt: string | undefined;

      if (userId) {
        const cached = await getUniversityCachedData(userId);
        if (cached?.semesters_json) {
          try {
            cachedSemesters = JSON.parse(cached.semesters_json);
            cachedAt = new Date(cached.updated_at).toISOString();
          } catch {}
        }
      }

      const probes = [meProbe, semestersProbe, studentProbe, regStatusProbe, withdrawalProbe, slotsProbe, schoolsProbe, programsProbe]
        .map(({ rawResponse, ...rest }) => rest);

      return NextResponse.json({
        user: {
          name: dbUser?.student_name || 'Student',
          username: enrollment,
          enrollment,
          email: dbUser?.email || null,
          program: dbUser?.program_code || null,
          hasPin: !!dbUser?.pin_hash,
        },
        semesters: cachedSemesters,
        currentSemester: cachedSemesters[0] || null,
        profileAvailable: false,
        isOfflineCache: true,
        cachedAt,
        probes,
      });
    }

    // Build user info from /auth/me response
    const meData = meProbe.rawResponse as any;
    const studentData = studentProbe.rawResponse as any;

    const officialEmail =
      meData?.email ||
      meData?.user?.email ||
      studentData?.email ||
      studentData?.student_email ||
      dbUser?.email ||
      null;

    if (userId && officialEmail && (!dbUser?.email || dbUser.email !== officialEmail)) {
      updateUserEmail(userId, officialEmail).catch(() => {});
    }

    const user = {
      name: dbUser?.student_name || meData?.full_name || meData?.user?.full_name || 'Student',
      username: meData?.username || meData?.user?.username || enrollment,
      enrollment: enrollment,
      email: officialEmail || (enrollment ? `${enrollment}@s.amity.edu` : null),
      program: dbUser?.program_code || studentData?.program_name || studentData?.program || null,
      hasPin: !!dbUser?.pin_hash,
    };

    // Normalize semesters
    let semesters: any[] = [];
    try {
      if (semestersProbe.received && semestersProbe.rawResponse) {
        semesters = normalizeSemesters(semestersProbe.rawResponse);
        if (userId) {
          saveUniversityCachedData(userId, { semestersJson: JSON.stringify(semesters) }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[Bootstrap] Failed to normalize semesters:', e);
    }

    // Detect the current active semester
    const currentSemester =
      semesters.find((s) => s.slot_year === '2025-26' && s.semester_type.toUpperCase() === 'SUMMER') ||
      semesters.find((s) => s.semester_type.toUpperCase() === 'SUMMER') ||
      semesters[0] ||
      null;

    const probes = [meProbe, semestersProbe, studentProbe, regStatusProbe, withdrawalProbe, slotsProbe, schoolsProbe, programsProbe]
      .map(({ rawResponse, ...rest }) => rest);

    return NextResponse.json({
      user,
      semesters,
      currentSemester,
      profileAvailable: studentProbe.received,
      probes,
    });
  } catch (error) {
    console.error('[Bootstrap] Error:', error);
    return NextResponse.json({
      user: { name: 'Student', username: 'student', enrollment: '' },
      semesters: DEFAULT_FALLBACK_SEMESTERS,
      currentSemester: DEFAULT_FALLBACK_SEMESTERS[0],
      profileAvailable: false,
      isOfflineCache: true,
      probes: [],
    });
  }
}
