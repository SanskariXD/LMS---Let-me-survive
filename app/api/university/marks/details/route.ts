import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { validateSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  const userId = session?.userId;
    if (!userId) return NextResponse.json({error: 'Unauthorized'}, {status: 401});

  const { searchParams } = request.nextUrl;
  const slotYear = searchParams.get('slot_year');
  const semesterType = searchParams.get('semester_type');
  const courseCode = searchParams.get('course_code');
  const slotName = searchParams.get('slot_name');

  if (!slotYear || !semesterType || !courseCode || !slotName) {
    return NextResponse.json(
      { error: 'slot_year, semester_type, course_code, and slot_name are required' },
      { status: 400 },
    );
  }

  const courseKey = `${courseCode}_${slotName}`;

  try {
    const marksEndpoint = UNIVERSITY_ENDPOINTS.myMarks(slotYear, semesterType, courseCode, slotName);
    const consolidatedEndpoint = UNIVERSITY_ENDPOINTS.myConsolidated(slotYear, semesterType, courseCode, slotName);

    // Call both marks and consolidated endpoints in parallel
    const [marksResult, consolidatedResult] = await Promise.allSettled([
      universityRequest<any>(marksEndpoint, { userId }),
      universityRequest<any>(consolidatedEndpoint, { userId }),
    ]);

    const marksData = marksResult.status === 'fulfilled' ? marksResult.value : null;
    const consolidatedData = consolidatedResult.status === 'fulfilled' ? consolidatedResult.value : null;

    if (marksResult.status !== 'fulfilled' || consolidatedResult.status !== 'fulfilled' || !marksData || !consolidatedData) {
      throw new Error('Could not fetch marks or consolidated score from university.');
    }

    const payload = {
      marks: marksData?.courses?.[0] || null,
      consolidated: consolidatedData || null,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.warn('[MarksDetails] Fetch failed, checking cache fallback:', error?.message);

    return NextResponse.json(
      { error: error.message || 'Failed to fetch marks details' },
      { status: 502 },
    );
  }
}
