// Kiểu dữ liệu theo docs/openapi-spec.yaml. Sửa spec thì sửa file này theo.

export type Role = 'STUDENT' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  studentCode?: string | null;
}

export interface Semester {
  id: number;
  code: string;
  name: string;
  registrationStart: string;
  registrationEnd: string;
  maxCredits: number;
  registrationOpen?: boolean;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  credits: number;
  description?: string | null;
}

export interface CoursePage {
  items: Course[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ScheduleSlot {
  dayOfWeek: number; // 1 = thứ Hai ... 7 = Chủ nhật
  startPeriod: number;
  endPeriod: number;
  room?: string | null;
}

export interface Section {
  id: number;
  courseId: number;
  semesterId: number;
  code: string;
  lecturerName?: string | null;
  capacity: number;
  enrolledCount: number;
  remainingSeats?: number;
  waitlistCount?: number;
  slots: ScheduleSlot[];
}

export interface PrerequisiteStatus extends Course {
  passed?: boolean;
}

export interface CourseDetail extends Course {
  prerequisites: PrerequisiteStatus[];
  sections: Section[];
}

export interface Registration {
  id: number;
  studentId: number;
  section: Section;
  course?: Course;
  status: 'ENROLLED' | 'DROPPED';
  createdAt: string;
}

export interface Violation {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface WaitlistEntry {
  id: number;
  studentId: number;
  sectionId: number;
  position?: number | null;
  status: 'WAITING' | 'PROMOTED' | 'SKIPPED' | 'CANCELLED';
  createdAt: string;
}

export interface ScheduleEntry {
  sectionId: number;
  sectionCode: string;
  courseCode: string;
  courseName: string;
  credits: number;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  room?: string | null;
}

export interface WeeklySchedule {
  semesterId: number;
  totalCredits: number;
  maxCredits: number;
  entries: ScheduleEntry[];
}

export interface CompletedCourse {
  course: Course;
  semesterCode?: string;
  grade: number;
  passed: boolean;
}

export interface CourseInput {
  code: string;
  name: string;
  credits: number;
  description?: string;
}

// Body của POST /sections và PUT /sections/{sectionId} (schema SectionInput)
export interface SectionInput {
  courseId: number;
  semesterId: number;
  code: string;
  lecturerName?: string;
  capacity: number;
  slots: ScheduleSlot[];
}

// Một dòng của GET /sections/{sectionId}/enrolments (admin)
export interface SectionEnrolment extends Registration {
  studentCode?: string;
  studentName?: string;
}

// Một dòng của GET /sections/{sectionId}/waitlist (admin)
export interface SectionWaitlistEntry extends WaitlistEntry {
  studentCode?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
