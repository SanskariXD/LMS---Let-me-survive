export const universityConfig = {
  get baseUrl() {
    const raw = process.env.UNIVERSITY_BASE_URL;
    if (!raw) throw new Error('Configure UNIVERSITY_BASE_URL with the university endpoint.');
    const url = new URL(raw);
    const localDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    // The institution currently serves this origin over HTTP only. Explicit opt-in
    // is limited to that exact origin; it must not enable arbitrary HTTP targets.
    const legacyUniversity = process.env.UNIVERSITY_ALLOW_LEGACY_HTTP === 'true' && url.origin === 'http://35.200.229.112';
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && (localDevelopment || legacyUniversity))) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('University connection requires HTTPS or the explicitly enabled legacy university origin. Credentials were not sent.');
    }
    return url.origin;
  },
  get username() {
    const val = process.env.UNIVERSITY_USERNAME;
    if (!val) throw new Error('UNIVERSITY_USERNAME environment variable is not set.');
    return val;
  },
  get password() {
    const val = process.env.UNIVERSITY_PASSWORD;
    if (!val) throw new Error('UNIVERSITY_PASSWORD environment variable is not set.');
    return val;
  },
  get studentId() {
    const val = process.env.UNIVERSITY_STUDENT_ID;
    if (!val) throw new Error('UNIVERSITY_STUDENT_ID environment variable is not set.');
    return val;
  },
  get authMode() {
    return (process.env.UNIVERSITY_AUTH_MODE ?? 'bearer') as 'bearer' | 'x-access-token';
  },
};
