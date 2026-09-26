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

    if (!marksData && !consolidatedData) {
      throw new Error('Could not fetch marks or consolidated score from university.');
    }

    const payload = {
      marks: marksData?.courses?.[0] || null,
      consolidated: consolidatedData || null,
      fetchedAt: new Date().toISOString(),
    };

    // Cache in database for offline viewing
    if (userId) {
      ensureDbInitialized().then(async () => {
        const existing = await getUniversityCachedData(userId);
        let marksObj: any = { registrations: [], details: {} };
        if (existing?.marks_json) {
          try {
            const p = JSON.parse(existing.marks_json);
            if (Array.isArray(p)) {
              marksObj.registrations = p;
            } else if (p && typeof p === 'object') {
              marksObj = p;
              if (!marksObj.details) marksObj.details = {};
            }
          } catch {}
        }
        marksObj.details[courseKey] = payload;
        await saveUniversityCachedData(userId, {
          marksJson: JSON.stringify(marksObj),
        });
      }).catch((err) => console.warn('[MarksDetails] Cache save failed:', err));
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.warn('[MarksDetails] Fetch failed, checking cache fallback:', error?.message);

    if (userId) {
      try {
        await ensureDbInitialized();
        const cached = await getUniversityCachedData(userId);
        if (cached?.marks_json) {
          const p = JSON.parse(cached.marks_json);
          const cachedDetail = p?.details?.[courseKey];
          if (cachedDetail) {
            return NextResponse.json({
              ...cachedDetail,
              isOffline: true,
              fetchedAt: new Date(cached.updated_at).toISOString(),
            });
          }
        }
      } catch (cacheErr) {
        console.warn('[MarksDetails] Cache fallback failed:', cacheErr);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch marks details' },
      { status: 502 },
    );
  }
}
