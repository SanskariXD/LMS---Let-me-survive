type LogEvent =
  | 'AUTH_START' | 'AUTH_SUCCESS' | 'AUTH_FAILED'
  | 'TOKEN_CACHE_HIT' | 'TOKEN_EXPIRED' | 'TOKEN_REFRESH'
  | 'REQUEST_START' | 'REQUEST_SUCCESS' | 'REQUEST_FAILED'
  | 'RETRY_AFTER_401' | 'TIMEOUT' | 'GEO_BLOCKED' | 'OFFLINE_FALLBACK';

export interface DiagnosticEntry {
  timestamp: string;
  event: LogEvent;
  userId?: string;
  details: Record<string, unknown>;
}

const diagnosticRingBuffer: DiagnosticEntry[] = [];
const MAX_DIAGNOSTICS = 50;

function timestamp(): string {
  return new Date().toISOString();
}

export function universityLog(event: LogEvent, data?: Record<string, unknown>): void {
  const safe = data ? { ...data } : {};
  // Strictly redact all sensitive data
  delete safe['password'];
  delete safe['token'];
  delete safe['jwt'];
  delete safe['pin'];
  delete safe['secret'];
  delete safe['university_password_encrypted'];

  const entry: DiagnosticEntry = {
    timestamp: timestamp(),
    event,
    details: safe,
  };

  diagnosticRingBuffer.unshift(entry);
  if (diagnosticRingBuffer.length > MAX_DIAGNOSTICS) {
    diagnosticRingBuffer.pop();
  }

  const parts = [`[University] ${event}`];
  for (const [key, value] of Object.entries(safe)) {
    parts.push(`${key}=${value}`);
  }
  console.log(`${entry.timestamp} ${parts.join(' ')}`);
}

export function getDiagnostics(): DiagnosticEntry[] {
  return [...diagnosticRingBuffer];
}
