import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserManualCourses, addManualCourse, deleteManualCourse } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const courses = await getUserManualCourses(userId);
    return NextResponse.json({ courses });
  } catch (error: any) {
    console.error('[ManualCoursesAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch manual courses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body?.courseCode || !body?.courseName || !body?.semester) {
      return NextResponse.json(
        { error: 'Course code, name, and semester are required' },
        { status: 400 },
      );
    }

    const course = await addManualCourse(userId, {
      courseCode: body.courseCode,
      courseName: body.courseName,
      credits: body.credits || 3,
      semester: body.semester,
      componentType: body.componentType || 'Theory',
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    console.error('[ManualCoursesAPI] POST error:', error);
    return NextResponse.json({ error: 'Failed to add course' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const courseId = searchParams.get('id');

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    await deleteManualCourse(userId, courseId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ManualCoursesAPI] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}
