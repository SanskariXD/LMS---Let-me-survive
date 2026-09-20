import { NextResponse } from 'next/server';
import { clearSession, validateSession } from '@/lib/portal/session';
import { clearUniversityToken } from '@/lib/university/token-store';

export async function POST() {
  try {
    const session = await validateSession();
    if (session?.userId) {
      clearUniversityToken(session.userId);
    }
    await clearSession();
    return NextResponse.json({ unlocked: false });
  } catch (error) {
    console.error('[Portal] Logout error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}
