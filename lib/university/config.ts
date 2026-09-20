function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const universityConfig = {
  get baseUrl() { return required('UNIVERSITY_BASE_URL'); },
  get username() { return required('UNIVERSITY_USERNAME'); },
  get password() { return required('UNIVERSITY_PASSWORD'); },
  get studentId() { return required('UNIVERSITY_STUDENT_ID'); },
  get authMode() { return (process.env.UNIVERSITY_AUTH_MODE ?? 'bearer') as 'bearer' | 'x-access-token'; },
};
