import { databaseClient } from '@/db';
import { randomUUID } from 'node:crypto';
import { defaultTerm, type RegistrationTerm, type buildPlan, type Outcome } from './payload';
const termKey = (term: RegistrationTerm) => `${term.slot_year}|${term.semester_type}`;

type PlanItems = ReturnType<typeof buildPlan>;
let ready: Promise<void> | undefined;
export async function initializeStore() {
  if ((process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) && ![process.env.TURSO_DATABASE_URL, process.env.DATABASE_URL, process.env.LIBSQL_URL].some((url) => url && !url.startsWith('file:'))) {
    throw new Error('Registration needs the persistent database configured before requests can be sent.');
  }
  if (!ready) ready = databaseClient.executeMultiple(`
    CREATE TABLE IF NOT EXISTS registration_plans (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, items_json TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS registration_attempts (user_id TEXT NOT NULL, term TEXT NOT NULL, course_code TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id, term, course_code));
    CREATE TABLE IF NOT EXISTS registration_user_locks (user_id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `).then(() => {}).catch((error) => { ready = undefined; throw error; });
  await ready;
}
export async function createPlan(userId: string, items: PlanItems) {
  await initializeStore();
  const id = randomUUID(), expiresAt = Date.now() + 10 * 60_000;
  await databaseClient.execute({sql: 'INSERT INTO registration_plans VALUES (?, ?, ?, ?, ?)', args: [id, userId, JSON.stringify(items), Date.now(), expiresAt]});
  return { id, expiresAt };
}
export async function getPlan(id: string, userId: string) {
  await initializeStore();
  const result = await databaseClient.execute({sql: 'SELECT * FROM registration_plans WHERE id = ? AND user_id = ?', args: [id, userId]});
  const row = result.rows[0];
  if (!row || Number(row.expires_at) < Date.now()) throw new Error('This review expired. Review the selected courses again.');
  return JSON.parse(String(row.items_json)) as PlanItems;
}
export async function acquireUserLock(userId: string) {
  await initializeStore();
  const owner = randomUUID();
  const result = await databaseClient.execute({sql: `INSERT INTO registration_user_locks VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE registration_user_locks.expires_at < ?`, args: [userId, owner, Date.now() + 120_000, Date.now()]});
  if (!result.rowsAffected) throw new Error('Another registration request is running for this account. Wait for its result.');
  return async () => { await databaseClient.execute({sql: 'DELETE FROM registration_user_locks WHERE user_id = ? AND owner = ?', args: [userId, owner]}); };
}
export async function claimAttempt(userId: string, courseCode: string, payload: Record<string, string>, retryRejected = false, term: RegistrationTerm = defaultTerm) {
  const payloadJson = JSON.stringify(payload);
  const result = await databaseClient.execute({sql: 'INSERT OR IGNORE INTO registration_attempts VALUES (?, ?, ?, ?, ?, ?, ?)', args: [userId, termKey(term), courseCode, payloadJson, 'pending', 'Request outcome not yet confirmed. Verify in the university portal before retrying.', Date.now()]});
  if (result.rowsAffected) return null;
  if (retryRejected) {
    const retry = await databaseClient.execute({sql: `UPDATE registration_attempts SET status = 'pending', message = ?, payload_json = ?, updated_at = ? WHERE user_id = ? AND term = ? AND course_code = ? AND status = 'rejected'`, args: ['Retry outcome not yet confirmed.', payloadJson, Date.now(), userId, termKey(term), courseCode]});
    if (retry.rowsAffected) return null;
  }
  const previous = await databaseClient.execute({sql: 'SELECT status, message FROM registration_attempts WHERE user_id = ? AND term = ? AND course_code = ?', args: [userId, termKey(term), courseCode]});
  const row = previous.rows[0];
  return { outcome: row.status === 'pending' ? 'uncertain' : String(row.status) as Outcome, message: String(row.message), sent: false };
}
export async function finishAttempt(userId: string, courseCode: string, outcome: Outcome, message: string, term: RegistrationTerm = defaultTerm) {
  await databaseClient.execute({sql: 'UPDATE registration_attempts SET status = ?, message = ?, updated_at = ? WHERE user_id = ? AND term = ? AND course_code = ?', args: [outcome, message, Date.now(), userId, termKey(term), courseCode]});
}

export async function previousAttempts(userId: string, term: RegistrationTerm = defaultTerm) {
  await initializeStore();
  const result = await databaseClient.execute({sql: 'SELECT course_code, status, message FROM registration_attempts WHERE user_id = ? AND term = ?', args: [userId, termKey(term)]});
  return Object.fromEntries(result.rows.map((row) => [String(row.course_code), {outcome: row.status === 'pending' ? 'uncertain' : String(row.status), message: String(row.message)}]));
}
