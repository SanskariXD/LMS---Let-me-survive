import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, decryptSecret } from '@/lib/portal/auth';
import { createSession } from '@/lib/portal/session';
import { getUserById, getUserByEnrollment, saveUniversitySession } from '@/lib/db/queries';
import { loginToUniversity } from '@/lib/university/auth';
import { setCachedUniversityToken } from '@/lib/university/token-store';

export const preferredRegion = 'bom1';

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

    // Specific user PIN verification
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

      // Create LMS² session cookie
      await createSession(user.id, {
        enrollment: user.enrollment_number,
        name: user.student_name,
      });

      // Contact university API to acquire a fresh upstream token
      let freshTokenAcquired = false;
      let universityOffline = false;

      if (user.university_password_encrypted) {
        try {
          const decryptedPassword = decryptSecret(user.university_password_encrypted);
          if (decryptedPassword) {
            const username = user.enrollment_number.includes('@')
              ? user.enrollment_number
              : `${user.enrollment_number}@blr.amity.edu`;

            const fresh = await loginToUniversity({
              username,
              password: decryptedPassword,
            });

            setCachedUniversityToken(user.id, fresh);
            await saveUniversitySession(user.id, fresh.token, fresh.expiresAt, 'active');
            freshTokenAcquired = true;
          }
        } catch (univErr: any) {
          console.warn('[Portal Login] Could not refresh university token on PIN login:', univErr?.message);
          universityOffline = true;
          // Graceful fallback: Still allow unlock so offline cached data can be accessed
        }
      }

      return NextResponse.json({
        unlocked: true,
        freshTokenAcquired,
        universityOffline,
        user: {
          id: user.id,
          name: user.student_name,
          enrollment: user.enrollment_number,
          email: user.email,
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
