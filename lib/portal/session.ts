import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'slotwise_session';
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds for persistent student login

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('SESSION_SECRET environment variable is required in production for session signing.');
    }
    return 'slotwise-dev-fallback-secret-for-session-signing-at-least-32-chars';
  }
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

export interface SessionPayload {
  userId: string;
  enrollment?: string;
  name?: string;
  expires: number;
}

export async function createSession(userId: string, metadata?: { enrollment?: string; name?: string }): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const payloadData: SessionPayload = {
    userId,
    enrollment: metadata?.enrollment,
    name: metadata?.name,
    expires,
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
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

export function createSessionToken(userId: string, metadata?: { enrollment?: string; name?: string }): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const payloadData: SessionPayload = {
    userId,
    enrollment: metadata?.enrollment,
    name: metadata?.name,
    expires,
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string): SessionPayload | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    if (!verifySignature(payload, signature)) return null;

    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SessionPayload;
    if (typeof raw.userId !== 'string' || typeof raw.expires !== 'number') return null;
    if (raw.expires < Date.now() / 1000) return null;

    return raw;
  } catch {
    return null;
  }
}

export async function validateSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return parseSessionToken(cookie.value);
}

