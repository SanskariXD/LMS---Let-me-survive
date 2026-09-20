import { NextResponse } from 'next/server';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { auditDegreeProgress, getRecommendedCourses } from '@/lib/university/curriculum';

export async function GET() {
  try {
    // 1. Fetch all student semesters
    const semesters = await universityRequest<Array<{ slot_year: string; semester_type: string }>>(
      UNIVERSITY_ENDPOINTS.mySemesters,
    );

    if (!semesters || !Array.isArray(semesters)) {
      return NextResponse.json({ error: 'Could not fetch semesters' }, { status: 502 });
    }

    // 2. Fetch registrations for all semesters concurrently
    const semesterTimetablePromises = semesters.map(async (sem) => {
      try {
        const endpoint = UNIVERSITY_ENDPOINTS.myTimetable(sem.slot_year, sem.semester_type);
        const data = await universityRequest<any>(endpoint);
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

    // 4. Audit progress against official B.Tech CSE 2024 Curriculum
    const audit = auditDegreeProgress(allCoursesEnrolled);

    // 5. Generate smart recommendations for upcoming semesters
    const recommendations = getRecommendedCourses(Array.from(enrolledCodesSet));

    return NextResponse.json({
      audit,
      recommendations,
      semesters,
      semesterHistory: semesterResults,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate academic degree audit' },
      { status: 502 },
    );
  }
}
