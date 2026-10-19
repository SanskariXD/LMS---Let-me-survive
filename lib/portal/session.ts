import { createHmac, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'slotwise_session';
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds for persistent student login

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && (process.env.NODE_ENV === 'production' || process.env.VERCEL) && Buffer.byteLength(secret) < 32) throw new Error('SESSION_SECRET must contain at least 32 random bytes.');
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
  nonce?: string;
}

export const REMEMBER_COOKIE_NAME = 'slotwise_device_user';
const REMEMBER_DURATION = 365 * 24 * 60 * 60; // 1 year

export async function setRememberedUser(data: { enrollment: string; name?: string; userId: string }): Promise<void> {
  const cookieStore = await cookies();
  const payload = Buffer.from(JSON.stringify({...data, expires: Math.floor(Date.now()/1000) + REMEMBER_DURATION})).toString('base64url');
  cookieStore.set(REMEMBER_COOKIE_NAME, `${payload}.${sign('remember:' + payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REMEMBER_DURATION,
  });
}

export async function getRememberedUser(): Promise<{ enrollment: string; name?: string; userId: string } | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(REMEMBER_COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const [payload, signature, extra] = cookie.value.split('.');
    if (!payload || !signature || extra || !verifySignature('remember:' + payload, signature)) return null;
    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (raw && typeof raw.enrollment === 'string' && typeof raw.userId === 'string' && typeof raw.expires === 'number' && raw.expires > Date.now()/1000) return raw;
  } catch {}
  return null;
}

export async function clearRememberedUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function createSession(userId: string, metadata?: { enrollment?: string; name?: string }): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const payloadData: SessionPayload = {
    userId,
    nonce: randomUUID(),
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

  // Automatically remember device user across sessions if enrollment is present
  if (metadata?.enrollment) {
    await setRememberedUser({
      userId,
      enrollment: metadata.enrollment,
      name: metadata.name,
    });
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const current = cookieStore.get(COOKIE_NAME)?.value;
  const parsed = current ? parseSessionToken(current) : null;
  if (parsed && current) {
    const {databaseClient, ensureDbInitialized} = await import('@/db');
    await ensureDbInitialized();
    await databaseClient.execute({sql: 'INSERT OR REPLACE INTO revoked_sessions (token_hash, expires_at) VALUES (?, ?)', args: [createHash('sha256').update(current).digest('hex'), parsed.expires * 1000]});
    await databaseClient.execute({sql: 'DELETE FROM revoked_sessions WHERE expires_at < ?', args: [Date.now()]});
  }
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
    nonce: randomUUID(),
    enrollment: metadata?.enrollment,
    name: metadata?.name,
    expires,
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string): SessionPayload | null {
  try {
    if (token.length > 4096) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    if (!verifySignature(payload, signature)) return null;

    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SessionPayload;
    if (typeof raw.userId !== 'string' || !raw.userId || typeof raw.expires !== 'number' || !Number.isFinite(raw.expires)) return null;
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
  const parsed = parseSessionToken(cookie.value);
  if (!parsed) return null;
  const {databaseClient, ensureDbInitialized} = await import('@/db');
  await ensureDbInitialized();
  const revoked = await databaseClient.execute({sql: 'SELECT 1 FROM revoked_sessions WHERE token_hash = ?', args: [createHash('sha256').update(cookie.value).digest('hex')]});
  if (revoked.rows.length) return null;
  return parsed;
}

