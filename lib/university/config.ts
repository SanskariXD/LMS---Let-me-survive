export const universityConfig = {
  get baseUrl() {
    const raw = process.env.UNIVERSITY_BASE_URL;
    if (!raw) throw new Error('Configure UNIVERSITY_BASE_URL with an HTTPS university endpoint.');
    const url = new URL(raw);
    const localDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(localDevelopment && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('University connection requires HTTPS. Credentials were not sent.');
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
