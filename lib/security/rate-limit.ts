import { createHash } from 'node:crypto';
import { databaseClient, ensureDbInitialized } from '@/db';

// Atomic, shared DB counters survive cold starts and parallel serverless instances.
export async function consumeAttempt(scope: string, identity: string, limit = 5, windowMs = 15 * 60_000): Promise<boolean> {
  await ensureDbInitialized();
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex');
  const result = await databaseClient.execute({
    sql: `INSERT INTO security_rate_limits (key, bucket, attempts, expires_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        attempts = CASE WHEN bucket = excluded.bucket THEN attempts + 1 ELSE 1 END,
        bucket = excluded.bucket, expires_at = excluded.expires_at RETURNING attempts`,
    args: [key, bucket, (bucket + 1) * windowMs],
  });
  // Bound retained identifiers; these keys contain no raw account names or IPs.
  await databaseClient.execute({ sql: 'DELETE FROM security_rate_limits WHERE expires_at < ?', args: [now - windowMs] });
  return Number(result.rows[0]?.attempts) <= limit;
}

export function clientBucket(request: { headers: Headers }): string {
  // Vercel overwrites this header. Do not trust arbitrary X-Forwarded-For values.
  return process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local';
}
