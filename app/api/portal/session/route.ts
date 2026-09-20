import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';

export async function GET() {
  try {
    const session = await validateSession();
    return NextResponse.json({ unlocked: session !== null });
  } catch (error) {
    console.error('[Portal] Session check error:', error);
    return NextResponse.json({ unlocked: false });
  }
}
