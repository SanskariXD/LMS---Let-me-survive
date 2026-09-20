import { NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { universityConfig } from '@/lib/university/config';
import { normalizeSemesters } from '@/lib/university/normalize';

interface ProbeResult {
  endpoint: string;
  received: boolean;
  httpStatus?: number;
  responseType?: string;
  itemCount?: number;
  topLevelFields?: number;
  rawResponse?: unknown;
}

async function probe(name: string, path: string): Promise<ProbeResult> {
  try {
    const data = await universityRequest<any>(path);
    return {
      endpoint: name,
      received: true,
      responseType: Array.isArray(data) ? 'array' : typeof data,
      itemCount: Array.isArray(data) ? data.length : undefined,
      topLevelFields: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).length : undefined,
      rawResponse: data,
    };
  } catch (error: any) {
    return {
      endpoint: name,
      received: false,
      httpStatus: error?.status,
    };
  }
}

export async function GET() {
  try {
    const [meProbe, semestersProbe, studentProbe, regStatusProbe, withdrawalProbe, slotsProbe, schoolsProbe, programsProbe] = await Promise.all([
      probe('auth/me', UNIVERSITY_ENDPOINTS.me),
      probe('semesters', UNIVERSITY_ENDPOINTS.semesters),
      probe('student', UNIVERSITY_ENDPOINTS.student(universityConfig.studentId)),
      probe('registration-status', UNIVERSITY_ENDPOINTS.registrationStatus),
      probe('withdrawal-status', UNIVERSITY_ENDPOINTS.withdrawalStatus),
      probe('slots', UNIVERSITY_ENDPOINTS.slots),
      probe('schools', UNIVERSITY_ENDPOINTS.schools),
      probe('programs', UNIVERSITY_ENDPOINTS.programs),
    ]);

    if (!meProbe.received && !semestersProbe.received) {
      return NextResponse.json(
        { error: 'University services are currently offline or unreachable.' },
        { status: 503 },
      );
    }

    // Build user info from /auth/me response
    const meData = meProbe.rawResponse as any;
    const studentData = studentProbe.rawResponse as any;

    const user = {
      name: meData?.full_name || meData?.user?.full_name || '',
      username: meData?.username || meData?.user?.username || '',
      enrollment: universityConfig.studentId,
      program: studentData?.program_name || studentData?.program || null,
    };

    // Normalize semesters
    let semesters: any[] = [];
    try {
      if (semestersProbe.received && semestersProbe.rawResponse) {
        semesters = normalizeSemesters(semestersProbe.rawResponse);
      }
    } catch (e) {
      console.error('[Bootstrap] Failed to normalize semesters:', e);
    }

    // Detect the current active semester (not past, not upcoming/future with 0 classes)
    const currentSemester =
      semesters.find((s) => s.slot_year === '2025-26' && s.semester_type.toUpperCase() === 'SUMMER') ||
      semesters.find((s) => s.semester_type.toUpperCase() === 'SUMMER') ||
      semesters[0] ||
      null;

    // Strip rawResponse from probes before sending to frontend
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
    return NextResponse.json(
      { error: 'Failed to initialize university session' },
      { status: 502 },
    );
  }
}
