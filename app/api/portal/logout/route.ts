import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/portal/session';
import { clearUniversityToken } from '@/lib/university/token-store';

export async function POST() {
  try {
    clearUniversityToken();
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
