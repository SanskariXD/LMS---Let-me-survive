import { isUniversityExpectedDowntime } from '@/lib/offline-storage';

const RETRY_AT = 'slotwise_university_retry_at';
export function pauseUniversitySync() {
  try { sessionStorage.setItem(RETRY_AT, String(Date.now() + 5 * 60_000)); } catch {}
}
export function resumeUniversitySync() {
  try { sessionStorage.removeItem(RETRY_AT); } catch {}
}
export function universitySyncPaused() {
  if (isUniversityExpectedDowntime()) return true;
  try { return Number(sessionStorage.getItem(RETRY_AT)) > Date.now(); } catch { return false; }
}

export async function request(path: string, body?: object) {
  const cacheable = path === 'bootstrap' || path.startsWith('attendance?') || path.startsWith('attendance/report?');
  if (universitySyncPaused()) {
    if (!cacheable) throw new Error('University offline; using saved data.');
    path += (path.includes('?') ? '&' : '?') + 'cache_only=1';
  }
  let res: Response;
  try {
    res = await fetch('/api/university/' + path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: body ? {'Content-Type': 'application/json'} : {},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
  } catch (error) { pauseUniversitySync(); throw error; }
  let data: any;
  try { data = await res.json(); }
  catch { pauseUniversitySync(); throw new Error('Invalid university response.'); }
  if (!res.ok) {
    if (res.status >= 500) pauseUniversitySync();
    throw Object.assign(new Error(data.error || 'Request failed.'), {status: res.status, code: data.code});
  }
  if (data.isOffline || data.isOfflineCache) {
    pauseUniversitySync();
    if (!cacheable) throw new Error('University offline; using saved data.');
  }
  return data;
}
