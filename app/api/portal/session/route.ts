import { NextResponse } from 'next/server';
import { validateSession, getRememberedUser } from '@/lib/portal/session';
import { getUserById, getUserByEnrollment } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      // Check if user is remembered via persistent device cookie
      const remembered = await getRememberedUser();
      if (remembered?.enrollment) {
        const user = (remembered.userId ? await getUserById(remembered.userId) : null) || await getUserByEnrollment(remembered.enrollment);
        if (user) {
          return NextResponse.json({
            unlocked: false,
            rememberedUser: {
              id: user.id,
              enrollment: user.enrollment_number,
              name: user.student_name,
              email: user.email,
              program: user.program_code,
              hasPin: !!user.pin_hash,
            },
          });
        }
      }
      return NextResponse.json({ unlocked: false });
    }

    const user = await getUserById(session.userId);

    return NextResponse.json({
      unlocked: true,
      user: {
        id: session.userId,
        enrollment: user?.enrollment_number || session.enrollment,
        name: user?.student_name || session.name,
        email: user?.email,
        program: user?.program_code,
        hasPin: !!user?.pin_hash,
      },
    });
  } catch (error) {
    console.error('[Portal] Session check error:', error);
    return NextResponse.json({ unlocked: false });
  }
}
