import { universityConfig } from './config';
import { universityLog } from './logger';
import { loginToUniversity } from './auth';
import {
  getCachedUniversityToken,
  clearUniversityToken,
  isTokenValid,
} from './token-store';

async function getValidToken(): Promise<string> {
  if (isTokenValid()) {
    const cached = getCachedUniversityToken()!;
    universityLog('TOKEN_CACHE_HIT');
    return cached.token;
  }

  universityLog('TOKEN_EXPIRED');
  const fresh = await loginToUniversity();
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
  options?: RequestInit,
  retry = true,
): Promise<T> {
  const token = await getValidToken();
  const url = `${universityConfig.baseUrl}${path}`;
  const method = options?.method ?? 'GET';

  universityLog('REQUEST_START', { method, endpoint: path });
  const started = Date.now();

  const response = await fetch(url, {
    signal: options?.signal || AbortSignal.timeout(5000),
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(token),
      ...options?.headers,
    },
  });

  const duration = Date.now() - started;

  if (response.status === 401 && retry) {
    universityLog('RETRY_AFTER_401', { endpoint: path });
    clearUniversityToken();
    return universityRequest<T>(path, options, false);
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
