import { NextRequest, NextResponse } from 'next/server';
import { clearSession, clearRememberedUser, validateSession } from '@/lib/portal/session';
import { clearUniversityToken } from '@/lib/university/token-store';

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (session?.userId) {
      clearUniversityToken(session.userId);
    }
    await clearSession();

    const { searchParams } = new URL(request.url);
    if (searchParams.get('clearDevice') === 'true') {
      await clearRememberedUser();
    }

    return NextResponse.json({ unlocked: false });
  } catch (error) {
    console.error('[Portal] Logout error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}
