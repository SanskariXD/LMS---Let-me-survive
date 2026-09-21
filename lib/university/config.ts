export const universityConfig = {
  get baseUrl() {
    return process.env.UNIVERSITY_BASE_URL || 'http://35.200.229.112';
  },
  get username() {
    return process.env.UNIVERSITY_USERNAME || 'A86605224188@blr.amity.edu';
  },
  get password() {
    return process.env.UNIVERSITY_PASSWORD || 'A86605224188@blr.amity.edu';
  },
  get studentId() {
    return process.env.UNIVERSITY_STUDENT_ID || 'A86605224188';
  },
  get authMode() {
    return (process.env.UNIVERSITY_AUTH_MODE ?? 'bearer') as 'bearer' | 'x-access-token';
  },
};
