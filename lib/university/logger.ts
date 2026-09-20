type LogEvent =
  | 'AUTH_START' | 'AUTH_SUCCESS' | 'AUTH_FAILED'
  | 'TOKEN_CACHE_HIT' | 'TOKEN_EXPIRED' | 'TOKEN_REFRESH'
  | 'REQUEST_START' | 'REQUEST_SUCCESS' | 'REQUEST_FAILED'
  | 'RETRY_AFTER_401';

function timestamp(): string {
  return new Date().toISOString();
}

export function universityLog(event: LogEvent, data?: Record<string, unknown>): void {
  const safe = data ? { ...data } : {};
  // Never log sensitive values
  delete safe['password'];
  delete safe['token'];
  delete safe['jwt'];
  delete safe['pin'];
  delete safe['secret'];
  
  const parts = [`[University] ${event}`];
  for (const [key, value] of Object.entries(safe)) {
    parts.push(`${key}=${value}`);
  }
  console.log(`${timestamp()} ${parts.join(' ')}`);
}
