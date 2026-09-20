import type { UniversityToken } from '@/types/university';

const TOKEN_SAFETY_WINDOW = 60_000; // 1 minute early expiry
const userTokens = new Map<string, UniversityToken>();

export function getCachedUniversityToken(userId: string): UniversityToken | null {
  return userTokens.get(userId) || null;
}

export function setCachedUniversityToken(userId: string, token: UniversityToken): void {
  userTokens.set(userId, token);
}

export function clearUniversityToken(userId: string): void {
  userTokens.delete(userId);
}

export function isTokenValid(userId: string): boolean {
  const token = userTokens.get(userId);
  if (!token) return false;
  return token.expiresAt > Date.now() + TOKEN_SAFETY_WINDOW;
}
