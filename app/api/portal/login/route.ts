import { consumeAttempt, clientBucket } from '@/lib/security/rate-limit';
import { guardMutation } from '@/lib/security/request';
import { readJson } from '@/lib/security/request';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, decryptSecret } from '@/lib/portal/auth';
import { createSession } from '@/lib/portal/session';
import { getUserById, getUserByEnrollment, saveUniversitySession } from '@/lib/db/queries';
import { loginToUniversity } from '@/lib/university/auth';
import { setCachedUniversityToken } from '@/lib/university/token-store';

export const preferredRegion = 'bom1';

export async function POST(request: NextRequest) {
  const rejected = guardMutation(request);
  if (rejected) return rejected;
  try {
    const body = await readJson(request);
    const pin = body?.pin;
    const userId = body?.userId;
    const enrollment = body?.enrollment;

    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin) || (userId !== undefined && (typeof userId !== 'string' || userId.length > 160)) || (enrollment !== undefined && (typeof enrollment !== 'string' || enrollment.length > 160))) {
      return NextResponse.json(
        { error: 'PIN is required', code: 'MISSING_PIN' },
        { status: 400 },
      );
    }

    // Specific user PIN verification
    if (userId || enrollment) {
      const user = userId ? await getUserById(userId) : await getUserByEnrollment(enrollment);
      if (!await consumeAttempt('pin-ip', clientBucket(request), 30) || !await consumeAttempt('pin-account', user?.id || String(enrollment || userId).trim().toLowerCase(), 5)) {
        return NextResponse.json({error: 'Too many attempts. Try again in 15 minutes.'}, {status: 429, headers: {'Retry-After': '900'}});
      }
      // Use the same expensive verification and response for unknown accounts and wrong PINs.
      const dummyHash = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await verifyPin(pin, user?.pin_hash || dummyHash);
      if (!user || !user.pin_hash || !valid) {
        return NextResponse.json({error: 'University ID or PIN is incorrect.', code: 'INVALID_PIN'}, {status: 401});
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
