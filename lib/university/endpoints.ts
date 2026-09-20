export const UNIVERSITY_ENDPOINTS = {
  login: '/api/auth/login',
  me: '/api/auth/me',
  semesters: '/api/course-registration/semesters',
  attendance: '/api/attendance/student/courses',
  attendanceReport: (courseCode: string, slotYear: string, semesterType: string, slotName?: string) =>
    `/api/attendance/student/report/${encodeURIComponent(courseCode)}/${encodeURIComponent(slotYear)}/${encodeURIComponent(semesterType)}${
      slotName ? `?slot_name=${encodeURIComponent(slotName)}` : ''
    }`,
  student: (id: string) => `/api/students/${id}`,
  courses: '/api/courses',
  slots: '/api/slots',
  schools: '/api/schools',
  programs: '/api/programs',
  registrationStatus: '/api/system-config/course-registration-status',
  withdrawalStatus: '/api/course-withdrawal/withdrawal-status',
  blockStatus: '/api/course-registration/block-status',
  mySemesters: '/api/course-registration/my-semesters',
  myTimetable: (slotYear: string, semesterType: string) =>
    `/api/course-registration/my-timetable?slot_year=${encodeURIComponent(slotYear)}&semester_type=${encodeURIComponent(semesterType)}`,
  myMarks: (slotYear: string, semesterType: string, courseCode: string, slotName: string) =>
    `/api/marks/student/my-marks?slot_year=${encodeURIComponent(slotYear)}&semester_type=${encodeURIComponent(semesterType)}&course_code=${encodeURIComponent(courseCode)}&slot_name=${encodeURIComponent(slotName)}`,
  myConsolidated: (slotYear: string, semesterType: string, courseCode: string, slotName: string) =>
    `/api/marks/student/my-consolidated?slot_year=${encodeURIComponent(slotYear)}&semester_type=${encodeURIComponent(semesterType)}&course_code=${encodeURIComponent(courseCode)}&slot_name=${encodeURIComponent(slotName)}`,
} as const;

