import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';

export async function GET(request: NextRequest) {
  try {
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

    const marksEndpoint = UNIVERSITY_ENDPOINTS.myMarks(slotYear, semesterType, courseCode, slotName);
    const consolidatedEndpoint = UNIVERSITY_ENDPOINTS.myConsolidated(slotYear, semesterType, courseCode, slotName);

    // Call both marks and consolidated endpoints in parallel
    const [marksResult, consolidatedResult] = await Promise.allSettled([
      universityRequest<any>(marksEndpoint),
      universityRequest<any>(consolidatedEndpoint),
    ]);

    const marksData = marksResult.status === 'fulfilled' ? marksResult.value : null;
    const consolidatedData = consolidatedResult.status === 'fulfilled' ? consolidatedResult.value : null;

    return NextResponse.json({
      marks: marksData?.courses?.[0] || null,
      consolidated: consolidatedData || null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch marks details' },
      { status: 502 },
    );
  }
}
