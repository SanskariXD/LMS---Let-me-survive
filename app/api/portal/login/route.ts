import { NextRequest, NextResponse } from 'next/server';
import { verifyPin } from '@/lib/portal/auth';
import { createSession } from '@/lib/portal/session';
import { clearUniversityToken } from '@/lib/university/token-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pin = body?.pin;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required', code: 'MISSING_PIN' },
        { status: 400 },
      );
    }

    const valid = await verifyPin(pin);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid PIN', code: 'INVALID_PIN' },
        { status: 401 },
      );
    }

    await createSession('portal-user');

    return NextResponse.json({ unlocked: true });
  } catch (error) {
    console.error('[Portal] Login error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
