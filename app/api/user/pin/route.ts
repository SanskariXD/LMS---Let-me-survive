import { consumeAttempt } from '@/lib/security/rate-limit';
import { guardMutation } from '@/lib/security/request';
import { readJson } from '@/lib/security/request';
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getUserById, updateUserPin } from '@/lib/db/queries';
import { hashPin, verifyPin } from '@/lib/portal/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(userId);
    return NextResponse.json({
      hasPin: !!user?.pin_hash,
    });
  } catch (error) {
    return NextResponse.json({ hasPin: false });
  }
}

export async function POST(request: NextRequest) {
  const rejected = guardMutation(request);
  if (rejected) return rejected;
  try {
    const session = await validateSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    const { currentPin, newPin } = body;
    if (!await consumeAttempt('pin-change', userId, 5)) return NextResponse.json({error: 'Too many attempts. Try again later.'}, {status: 429});

    if (!newPin || typeof newPin !== 'string' || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ error: 'New PIN must be exactly 6 digits.' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user already has a PIN, verify current PIN
    if (user.pin_hash) {
      if (!currentPin || typeof currentPin !== 'string' || !/^\d{6}$/.test(currentPin)) {
        return NextResponse.json({ error: 'Please enter your current 6-digit PIN.' }, { status: 400 });
      }
      const valid = await verifyPin(currentPin.trim(), user.pin_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 400 });
      }
    }

    const newHash = await hashPin(newPin.trim());
    await updateUserPin(userId, newHash);

    return NextResponse.json({
      success: true,
      hasPin: true,
      message: user.pin_hash ? 'PIN changed successfully.' : 'PIN created successfully.',
    });
  } catch (error: any) {
    console.error('[UserPinAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 });
  }
}
