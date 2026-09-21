import { NextRequest, NextResponse } from 'next/server';
import { verifyPin } from '@/lib/portal/auth';
import { createSession } from '@/lib/portal/session';
import { getUserById, getUserByEnrollment } from '@/lib/db/queries';

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
          { error: 'Student account not found. Please login with your university password first.', code: 'USER_NOT_FOUND' },
          { status: 404 },
        );
      }

      if (!user.pin_hash) {
        return NextResponse.json(
          { error: 'No PIN is set for this account yet. Please login with your university password and set your 6-digit PIN in Profile.', code: 'NO_PIN_SET' },
          { status: 400 },
        );
      }

      const valid = await verifyPin(pin, user.pin_hash);
      if (!valid) {
        return NextResponse.json(
          { error: 'Incorrect PIN. Please check and try again.', code: 'INVALID_PIN' },
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
          hasPin: true,
        },
      });
    }

    // No userId or enrollment provided — cannot identify user for PIN login
    return NextResponse.json(
      { error: 'Please provide your University ID to login with PIN.', code: 'MISSING_IDENTITY' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[Portal] Login error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
