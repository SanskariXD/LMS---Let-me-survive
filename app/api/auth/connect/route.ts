import { NextRequest, NextResponse } from 'next/server';
import { loginToUniversity } from '@/lib/university/auth';
import { universityRequest } from '@/lib/university/client';
import { UNIVERSITY_ENDPOINTS } from '@/lib/university/endpoints';
import { upsertUser, saveUniversitySession } from '@/lib/db/queries';
import { hashPin, encryptSecret } from '@/lib/portal/auth';
import { createSession } from '@/lib/portal/session';

export const preferredRegion = 'bom1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, pin } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'University username/enrollment and password are required.' },
        { status: 400 },
      );
    }

    // 1. Authenticate with university upstream
    const loginResult = await loginToUniversity({
      username: username.trim(),
      password,
    });

    const studentEnrollment = loginResult.user?.username?.split('@')[0] || username.trim().split('@')[0];

    // 2. Try to fetch rich student info from university profile
    let fullName = loginResult.user?.full_name || '';
    let officialEmail = loginResult.user?.email || '';
    let programCode = '';
    let yearAdmitted: number | undefined;

    try {
      const meData = await universityRequest<any>(UNIVERSITY_ENDPOINTS.me, {
        headers: { Authorization: `Bearer ${loginResult.token}` },
      });
      if (meData?.full_name) fullName = meData.full_name;
      if (meData?.email) officialEmail = meData.email;
      else if (meData?.user?.email) officialEmail = meData.user.email;

      const studentData = await universityRequest<any>(UNIVERSITY_ENDPOINTS.student(studentEnrollment), {
        headers: { Authorization: `Bearer ${loginResult.token}` },
      });
      if (studentData?.student_name) fullName = studentData.student_name;
      if (studentData?.email || studentData?.student_email) {
        officialEmail = studentData.email || studentData.student_email;
      }
      if (studentData?.program_name || studentData?.program_code) {
        programCode = studentData.program_name || studentData.program_code;
      }
      if (studentData?.year_admitted) yearAdmitted = studentData.year_admitted;
    } catch {
      // Non-fatal if extended profile probe fails
    }

    if (!fullName) {
      fullName = studentEnrollment;
    }

    // 3. Hash optional PIN and encrypt university password
    let pinHash: string | undefined;
    if (pin && typeof pin === 'string' && pin.trim().length === 6) {
      pinHash = await hashPin(pin.trim());
    }

    const universityPasswordEncrypted = encryptSecret(password);

    // 4. Upsert user in database
    const user = await upsertUser({
      enrollmentNumber: studentEnrollment,
      studentName: fullName,
      email: officialEmail || (username.includes('@') && !username.endsWith('@blr.amity.edu') ? username : undefined),
      programCode,
      yearAdmitted,
      pinHash,
      universityPasswordEncrypted,
    });

    // 5. Save university session token
    await saveUniversitySession(
      user.id,
      loginResult.token,
      loginResult.expiresAt,
      'active',
    );

    // 6. Create LMS² session cookie
    await createSession(user.id, {
      enrollment: user.enrollment_number,
      name: user.student_name,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.student_name,
        enrollment: user.enrollment_number,
        email: user.email,
        program: user.program_code,
        hasPin: !!user.pin_hash,
      },
    });
  } catch (error: any) {
    console.error('[AuthConnect] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to connect university account.' },
      { status: 401 },
    );
  }
}
