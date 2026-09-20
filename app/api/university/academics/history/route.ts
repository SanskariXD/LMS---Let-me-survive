import { NextRequest, NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { auditDegreeProgress, getRecommendedCourses } from '@/lib/university/curriculum';
import { validateSession } from '@/lib/portal/session';
import { getUserManualCourses, getUniversityCachedData, saveUniversityCachedData } from '@/lib/db/queries';

export const preferredRegion = 'bom1';

export async function GET(request: NextRequest) {
  const session = await validateSession();
  const userId = session?.userId || request.headers.get('x-user-id') || undefined;

  try {
    // 1. Fetch all student semesters
    const semesters = await universityRequest<Array<{ slot_year: string; semester_type: string }>>(
      UNIVERSITY_ENDPOINTS.mySemesters,
      { userId },
    );

    if (!semesters || !Array.isArray(semesters)) {
      return NextResponse.json({ error: 'Could not fetch semesters' }, { status: 502 });
    }

    // 2. Fetch registrations for all semesters concurrently
    const semesterTimetablePromises = semesters.map(async (sem) => {
      try {
        const endpoint = UNIVERSITY_ENDPOINTS.myTimetable(sem.slot_year, sem.semester_type);
        const data = await universityRequest<any>(endpoint, { userId });
        const list = data.allRegistrations || data.registrations || [];
        return {
          semesterKey: `${sem.slot_year}|${sem.semester_type}`,
          slot_year: sem.slot_year,
          semester_type: sem.semester_type,
          courses: list,
        };
      } catch {
        return {
          semesterKey: `${sem.slot_year}|${sem.semester_type}`,
          slot_year: sem.slot_year,
          semester_type: sem.semester_type,
          courses: [],
        };
      }
    });

    const semesterResults = await Promise.all(semesterTimetablePromises);

    // 3. Flatten all unique enrolled courses across all semesters
    const allCoursesEnrolled: Array<{ course_code: string; course_name: string; credits?: number; semester?: string }> = [];
    const enrolledCodesSet = new Set<string>();

    for (const semResult of semesterResults) {
      for (const reg of semResult.courses) {
        if (!reg.course_code) continue;
        allCoursesEnrolled.push({
          course_code: reg.course_code,
          course_name: reg.course_name,
          credits: reg.credits,
          semester: `${semResult.semester_type} ${semResult.slot_year}`,
        });
        enrolledCodesSet.add(reg.course_code.trim().toUpperCase());
      }
    }

    // 4. Merge user's server-stored manual past courses (e.g. Fall 2024-25, Winter 2024-25)
    if (userId) {
      const manualCourses = await getUserManualCourses(userId);
      for (const mc of manualCourses) {
        if (!enrolledCodesSet.has(mc.course_code)) {
          allCoursesEnrolled.push({
            course_code: mc.course_code,
            course_name: mc.course_name,
            credits: mc.credits || 3,
            semester: mc.semester,
          });
          enrolledCodesSet.add(mc.course_code);
        }
      }
    }

    // 5. Audit progress against official B.Tech CSE 2024 Curriculum
    const audit = auditDegreeProgress(allCoursesEnrolled);

    // 6. Generate smart recommendations for upcoming semesters
    const recommendations = getRecommendedCourses(Array.from(enrolledCodesSet));

    const responsePayload = {
      audit,
      recommendations,
      semesters,
      semesterHistory: semesterResults,
      fetchedAt: new Date().toISOString(),
    };

    if (userId) {
      saveUniversityCachedData(userId, {
        academicsJson: JSON.stringify(responsePayload),
      }).catch(() => {});
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    // Database cache fallback
    if (userId) {
      const cached = await getUniversityCachedData(userId);
      if (cached?.academics_json) {
        try {
          const payload = JSON.parse(cached.academics_json);
          return NextResponse.json({
            ...payload,
            isOffline: true,
            fetchedAt: new Date(cached.updated_at).toISOString(),
          });
        } catch {}
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate academic degree audit', isOffline: true },
      { status: 502 },
    );
  }
}
