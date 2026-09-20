import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'slotwise_session';
const SESSION_DURATION = 12 * 60 * 60; // 12 hours in seconds

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = sign(payload);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function createSession(userId: string): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const payload = Buffer.from(JSON.stringify({ userId, expires })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function validateSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const [payload, signature] = cookie.value.split('.');
    if (!payload || !signature) return null;
    if (!verifySignature(payload, signature)) return null;

    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof raw.userId !== 'string' || typeof raw.expires !== 'number') return null;
    if (raw.expires < Date.now() / 1000) return null;

    return { userId: raw.userId };
  } catch {
    return null;
  }
}
