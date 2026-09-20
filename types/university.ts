export interface UniversityToken {
  token: string;
  expiresAt: number;
}

export interface UniversityUser {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
}

export interface UniversityLoginResponse {
  message: string;
  user: UniversityUser;
  token: string;
}

export interface Semester {
  slot_year: string;
  semester_type: string;
}

export interface AttendanceComponentItem {
  course_code: string;
  course_name: string;
  slot_year: string;
  semester_type: string;
  component_type: string; // 'T' | 'P' | 'SINGLE'
  slot_name: string;
  venue: string;
  theory: number;
  practical: number;
  course_type: string;
  attendance_percentage: number | null;
  total_classes: number;
  present_classes: number;
  absent_classes: number;
  original_slot_name?: string | null;
  component_label: string; // "Theory" | "Lab" | "Lecture"
}

export interface AttendanceRecord {
  attendance_date: string;
  slot_day: string;
  slot_name: string;
  slot_time: string;
  venue: string;
  status: string; // "present" | "absent" | "od"
  is_od: boolean;
  faculty_name: string;
}

export interface AttendanceReport {
  course_details: {
    course_name: string;
    theory: number;
    practical: number;
    course_type: string;
    course_code: string;
    slot_year: string;
    semester_type: string;
    slot_name: string;
    component_label: string | null;
  };
  summary: {
    total_classes: number;
    present_classes: number;
    absent_classes: number;
    attendance_percentage: number;
    minimum_required: number;
    meets_requirement: boolean;
  };
  attendance_records: AttendanceRecord[];
}

export interface RegistrationStatus {
  enabled: boolean;
  message: string;
  lastUpdated?: string;
}

export interface WithdrawalStatus {
  enabled: boolean;
  message: string;
}
