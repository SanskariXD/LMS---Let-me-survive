import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserById } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ unlocked: false });
    }

    const user = await getUserById(session.userId);

    return NextResponse.json({
      unlocked: true,
      user: {
        id: session.userId,
        enrollment: user?.enrollment_number || session.enrollment,
        name: user?.student_name || session.name,
        program: user?.program_code,
        hasPin: !!user?.pin_hash,
      },
    });
  } catch (error) {
    console.error('[Portal] Session check error:', error);
    return NextResponse.json({ unlocked: false });
  }
}
