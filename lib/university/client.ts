import { universityConfig } from './config';
import { universityLog } from './logger';
import { loginToUniversity } from './auth';
import {
  getCachedUniversityToken,
  setCachedUniversityToken,
  clearUniversityToken,
  isTokenValid,
} from './token-store';
import { getUserById, getUniversitySession, saveUniversitySession } from '@/lib/db/queries';
import { decryptSecret } from '@/lib/portal/auth';

export interface UniversityRequestOptions extends RequestInit {
  userId?: string;
  timeoutMs?: number;
}

export async function getValidTokenForUser(userId?: string): Promise<string> {
  // 1. If no userId provided, use default university credentials
  if (!userId) {
    if (isTokenValid('__default__')) {
      universityLog('TOKEN_CACHE_HIT', { scope: 'default' });
      return getCachedUniversityToken('__default__')!.token;
    }
    const fresh = await loginToUniversity();
    setCachedUniversityToken('__default__', fresh);
    return fresh.token;
  }

  // 2. Check memory cache for this user
  if (isTokenValid(userId)) {
    universityLog('TOKEN_CACHE_HIT', { userId: userId.slice(0, 8) });
    return getCachedUniversityToken(userId)!.token;
  }

  // 3. Check persistent database session
  try {
    const dbSession = await getUniversitySession(userId);
    if (dbSession && dbSession.token && dbSession.expires_at > Date.now() + 60_000) {
      setCachedUniversityToken(userId, {
        token: dbSession.token,
        expiresAt: dbSession.expires_at,
      });
      universityLog('TOKEN_CACHE_HIT', { source: 'database', userId: userId.slice(0, 8) });
      return dbSession.token;
    }
  } catch (err) {
    console.warn('[UniversityClient] Failed to check db session:', err);
  }

  // 4. Token expired or missing — silently refresh if credentials stored
  universityLog('TOKEN_EXPIRED', { userId: userId.slice(0, 8) });
  const user = await getUserById(userId);
  if (!user || !user.university_password_encrypted) {
    throw new Error('UNIVERSITY_SESSION_EXPIRED');
  }

  const decryptedPassword = decryptSecret(user.university_password_encrypted);
  if (!decryptedPassword) {
    throw new Error('UNIVERSITY_SESSION_EXPIRED');
  }

  // Login with stored credentials
  const username = user.enrollment_number.includes('@')
    ? user.enrollment_number
    : `${user.enrollment_number}@blr.amity.edu`;

  const fresh = await loginToUniversity({
    username,
    password: decryptedPassword,
  });

  setCachedUniversityToken(userId, fresh);
  await saveUniversitySession(userId, fresh.token, fresh.expiresAt, 'active');

  return fresh.token;
}

function buildAuthHeaders(token: string): Record<string, string> {
  const mode = universityConfig.authMode;
  if (mode === 'x-access-token') {
    return { 'x-access-token': token };
  }
  return { 'Authorization': `Bearer ${token}` };
}

export async function universityRequest<T>(
  path: string,
  options?: UniversityRequestOptions,
  retry = true,
): Promise<T> {
  const userId = options?.userId;
  const token = await getValidTokenForUser(userId);
  const url = `${universityConfig.baseUrl}${path}`;
  const method = options?.method ?? 'GET';
  const timeoutMs = options?.timeoutMs || 6000;

  universityLog('REQUEST_START', { method, endpoint: path, userId: userId?.slice(0, 8) });
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      signal: options?.signal || AbortSignal.timeout(timeoutMs),
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(token),
        ...options?.headers,
      },
    });
  } catch (err: any) {
    const duration = Date.now() - started;
    if (err?.name === 'TimeoutError' || err?.message?.includes('timeout')) {
      universityLog('TIMEOUT', { endpoint: path, duration: `${duration}ms` });
      throw new Error('University service connection timed out.');
    }
    universityLog('REQUEST_FAILED', { endpoint: path, error: err?.message, duration: `${duration}ms` });
    throw err;
  }

  const duration = Date.now() - started;

  if (response.status === 401 && retry) {
    universityLog('RETRY_AFTER_401', { endpoint: path });
    clearUniversityToken(userId || '__default__');
    return universityRequest<T>(path, { ...options, userId }, false);
  }

  if (response.status === 403) {
    universityLog('GEO_BLOCKED', { endpoint: path, status: 403 });
    throw new Error('University API access forbidden (India IP required).');
  }

  if (!response.ok) {
    universityLog('REQUEST_FAILED', {
      endpoint: path,
      status: response.status,
      duration: `${duration}ms`,
    });
    throw new Error(`University API request failed: ${method} ${path} → ${response.status}`);
  }

  const data = await response.json() as T;

  universityLog('REQUEST_SUCCESS', {
    endpoint: path,
    status: response.status,
    duration: `${duration}ms`,
  });

  return data;
}
