import { universityConfig } from './config';
import { universityLog } from './logger';
import { UNIVERSITY_ENDPOINTS } from './endpoints';
import type { UniversityToken, UniversityLoginResponse } from '@/types/university';

export interface UniversityLoginResult extends UniversityToken {
  user: {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    role: string;
  };
}

function decodeJwtExpiry(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = JSON.parse(
    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  );
  if (typeof payload.exp !== 'number') throw new Error('JWT missing exp claim');
  return payload.exp * 1000; // convert to ms
}

export async function loginToUniversity(credentials?: {
  username: string;
  password: string;
}): Promise<UniversityLoginResult> {
  let username = (credentials?.username || universityConfig.username).trim();
  if (!username.includes('@')) {
    username = `${username}@blr.amity.edu`;
  }
  const password = credentials?.password || universityConfig.password;

  universityLog('AUTH_START', { username: username.split('@')[0] });

  const url = `${universityConfig.baseUrl}${UNIVERSITY_ENDPOINTS.login}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.message?.includes('timeout')) {
      universityLog('TIMEOUT', { endpoint: UNIVERSITY_ENDPOINTS.login });
      throw new Error('University service connection timed out. Services may be offline.');
    }
    universityLog('AUTH_FAILED', { error: err?.message });
    throw new Error('Could not reach university authentication server.');
  }

  if (!response.ok) {
    universityLog('AUTH_FAILED', { status: response.status });
    if (response.status === 401 || response.status === 400) {
      throw new Error('Invalid university enrollment number or password.');
    }
    if (response.status === 403) {
      universityLog('GEO_BLOCKED', { status: 403 });
      throw new Error('University server rejected request (access restricted by region/IP).');
    }
    throw new Error(`University login failed with status ${response.status}`);
  }

  const data: UniversityLoginResponse = await response.json();

  if (!data.token || typeof data.token !== 'string') {
    universityLog('AUTH_FAILED', { reason: 'no_token_in_response' });
    throw new Error('University login response did not contain a valid token');
  }

  const expiresAt = decodeJwtExpiry(data.token);
  const expiresInSeconds = Math.round((expiresAt - Date.now()) / 1000);

  universityLog('AUTH_SUCCESS', {
    userRole: data.user?.role,
    expiresIn: `${expiresInSeconds}s`,
    username: username.split('@')[0],
  });

  return {
    token: data.token,
    expiresAt,
    user: data.user,
  };
}
