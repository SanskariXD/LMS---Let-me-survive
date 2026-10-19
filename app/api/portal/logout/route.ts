import { guardMutation } from '@/lib/security/request';
import { NextRequest, NextResponse } from 'next/server';
import { clearSession, clearRememberedUser, validateSession } from '@/lib/portal/session';
import { invalidateUniversitySession } from '@/lib/db/queries';
import { clearUniversityToken } from '@/lib/university/token-store';

export async function POST(request: NextRequest) {
  const rejected = guardMutation(request);
  if (rejected) return rejected;
  try {
    const session = await validateSession();
    if (session?.userId) {
      clearUniversityToken(session.userId);
      await invalidateUniversitySession(session.userId);
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
