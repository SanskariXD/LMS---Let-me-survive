import { NextRequest, NextResponse } from 'next/server';
import { verifyPin } from '@/lib/portal/auth';
import { createSession } from '@/lib/portal/session';
import { getUserById, getUserByEnrollment, upsertUser } from '@/lib/db/queries';
import { universityConfig } from '@/lib/university/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pin = body?.pin;
    const userId = body?.userId;
    const enrollment = body?.enrollment;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required', code: 'MISSING_PIN' },
        { status: 400 },
      );
    }

    // Case 1: Specific user PIN verification
    if (userId || enrollment) {
      const user = userId ? await getUserById(userId) : await getUserByEnrollment(enrollment);
      if (!user) {
        return NextResponse.json(
          { error: 'User account not found on this device.', code: 'USER_NOT_FOUND' },
          { status: 404 },
        );
      }

      const valid = await verifyPin(pin, user.pin_hash || undefined);
      if (!valid) {
        return NextResponse.json(
          { error: 'Incorrect PIN. Please try again.', code: 'INVALID_PIN' },
          { status: 401 },
        );
      }

      await createSession(user.id, {
        enrollment: user.enrollment_number,
        name: user.student_name,
      });

      return NextResponse.json({
        unlocked: true,
        user: {
          id: user.id,
          name: user.student_name,
          enrollment: user.enrollment_number,
          program: user.program_code,
        },
      });
    }

    // Case 2: Dev fallback / default environment PIN verification
    const valid = await verifyPin(pin);
    if (!valid) {
      return NextResponse.json(
        { error: 'Incorrect PIN. Please try again.', code: 'INVALID_PIN' },
        { status: 401 },
      );
    }

    // Ensure default user exists
    const defaultEnrollment = process.env.UNIVERSITY_STUDENT_ID || 'A86605224188';
    const defaultUser = await upsertUser({
      enrollmentNumber: defaultEnrollment,
      studentName: 'Mr ANJAN SHETTY C',
      email: `${defaultEnrollment}@blr.amity.edu`,
      programCode: 'B.Tech. (CSE)',
    });

    await createSession(defaultUser.id, {
      enrollment: defaultUser.enrollment_number,
      name: defaultUser.student_name,
    });

    return NextResponse.json({
      unlocked: true,
      user: {
        id: defaultUser.id,
        name: defaultUser.student_name,
        enrollment: defaultUser.enrollment_number,
        program: defaultUser.program_code,
      },
    });
  } catch (error) {
    console.error('[Portal] Login error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
