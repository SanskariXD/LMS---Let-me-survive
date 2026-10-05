// Request-scoped diagnostics only. Never keep a cross-account server log or persist traces.
export type DebugEntry = {id: string; timestamp: string; stage: string; courseCode?: string; data: unknown};
export type DebugReport = {traceId: string; events: DebugEntry[]};
const sensitiveKey = /token|password|authorization|cookie|secret|credential|session|(^|_)pin($|_)/i;
export function sanitizeDebug(value: unknown, secrets: string[] = []): unknown {
  const seen = new WeakSet<object>();
  const cleanString = (input: string) => {
    let result = input;
    for (const secret of secrets) if (secret) result = result.split(secret).join('[REDACTED]');
    result = result.replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED JWT]')
      .replace(/((?:token|password|secret|authorization|cookie|credential|pin)[\w-]*["']?\s*[:=]\s*["']?)[^\s,"'<>}]+/gi, '$1[REDACTED]');
    return result.length > 16_000 ? `${result.slice(0,16_000)}… [truncated]` : result;
  };
  function visit(input: unknown, depth: number): unknown {
    if (typeof input === 'string') return cleanString(input);
    if (input === null || typeof input === 'number' || typeof input === 'boolean') return input;
    if (input === undefined) return null;
    if (depth > 7) return '[depth limit]';
    if (typeof input !== 'object') return String(input);
    if (seen.has(input)) return '[circular]';
    seen.add(input);
    if (Array.isArray(input)) return input.slice(0,100).map(item => visit(item, depth + 1)).concat(input.length > 100 ? [`[${input.length-100} more items truncated]`] : []);
    return Object.fromEntries(Object.entries(input).slice(0,100).map(([key,item]) => [key,sensitiveKey.test(key) ? '[REDACTED]' : visit(item,depth + 1)]));
  }
  const result = visit(value,0);
  const json = JSON.stringify(result);
  return json && json.length > 32_000 ? {truncated:true, preview:json.slice(0,32_000)} : result;
}
export function createDebugTrace(enabled: boolean) {
  const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const events: DebugEntry[] = [];
  return {
    enabled,
    record(stage: string, data: unknown, courseCode?: string) {
      if (!enabled) return;
      const entry = {id:`${traceId}-${events.length}`, timestamp:new Date().toISOString(), stage, ...(courseCode ? {courseCode} : {}), data:sanitizeDebug(data)};
      if (events.length < 120) events.push(entry);
      if (process.env.NODE_ENV === 'development') console.debug('[LMS² Registration]', entry);
    },
    report(): DebugReport | undefined {return enabled ? {traceId, events} : undefined;},
  };
}
export type DebugTrace = ReturnType<typeof createDebugTrace>;
export function debugForRequest(request: {headers?: {get: (key: string) => string | null}}) {
  return createDebugTrace(process.env.NODE_ENV === 'development' || request.headers?.get('x-registration-debug') === '1');
}
