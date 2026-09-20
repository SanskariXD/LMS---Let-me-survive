import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserById, updateUserPin } from '@/lib/db/queries';
import { hashPin, verifyPin } from '@/lib/portal/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPin, newPin } = body;

    if (!newPin || typeof newPin !== 'string' || newPin.trim().length !== 6) {
      return NextResponse.json({ error: 'New PIN must be exactly 6 digits.' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user already has a PIN, verify current PIN
    if (user.pin_hash) {
      const valid = await verifyPin(currentPin, user.pin_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 400 });
      }
    }

    const newHash = await hashPin(newPin.trim());
    await updateUserPin(userId, newHash);

    return NextResponse.json({ success: true, message: 'PIN updated successfully.' });
  } catch (error: any) {
    console.error('[UserPinAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 });
  }
}
