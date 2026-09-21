export const universityConfig = {
  get baseUrl() {
    return process.env.UNIVERSITY_BASE_URL || 'http://35.200.229.112';
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
