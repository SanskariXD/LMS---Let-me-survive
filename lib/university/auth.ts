import { universityConfig } from './config';
import { universityLog } from './logger';
import { UNIVERSITY_ENDPOINTS } from './endpoints';
import { setCachedUniversityToken } from './token-store';
import type { UniversityToken, UniversityLoginResponse } from '@/types/university';

function decodeJwtExpiry(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = JSON.parse(
    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  );
  if (typeof payload.exp !== 'number') throw new Error('JWT missing exp claim');
  return payload.exp * 1000; // convert to ms
}

export async function loginToUniversity(): Promise<UniversityToken> {
  universityLog('AUTH_START');

  const url = `${universityConfig.baseUrl}${UNIVERSITY_ENDPOINTS.login}`;

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: universityConfig.username,
      password: universityConfig.password,
    }),
  });

  if (!response.ok) {
    universityLog('AUTH_FAILED', { status: response.status });
    throw new Error(`University login failed with status ${response.status}`);
  }

  const data: UniversityLoginResponse = await response.json();

  if (!data.token || typeof data.token !== 'string') {
    universityLog('AUTH_FAILED', { reason: 'no_token_in_response' });
    throw new Error('University login response did not contain a valid token');
  }

  if (data.message !== 'Login successful') {
    universityLog('AUTH_FAILED', { message: data.message });
    throw new Error(`University login returned unexpected message: ${data.message}`);
  }

  const expiresAt = decodeJwtExpiry(data.token);
  const expiresInSeconds = Math.round((expiresAt - Date.now()) / 1000);

  const universityToken: UniversityToken = {
    token: data.token,
    expiresAt,
  };

  setCachedUniversityToken(universityToken);

  universityLog('AUTH_SUCCESS', {
    userRole: data.user.role,
    expiresIn: `${expiresInSeconds}s`,
    tokenPresent: true,
  });

  return universityToken;
}
