import type { UniversityToken } from '@/types/university';

const TOKEN_SAFETY_WINDOW = 60_000; // 1 minute early expiry

let tokenCache: UniversityToken | null = null;

export function getCachedUniversityToken(): UniversityToken | null {
  return tokenCache;
}

export function setCachedUniversityToken(token: UniversityToken): void {
  tokenCache = token;
}

export function clearUniversityToken(): void {
  tokenCache = null;
}

export function isTokenValid(): boolean {
  if (!tokenCache) return false;
  return tokenCache.expiresAt > Date.now() + TOKEN_SAFETY_WINDOW;
}
