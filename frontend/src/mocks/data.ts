import type { CompletedCourse, Course, Section, Semester, User } from '../api/types';

// Dữ liệu giả, khớp một phần backend/db/seeds/001_seed.sql.
export const mockStudent: User = {
  id: 1,
  email: 'std_402@student.edu.vn',
  fullName: 'Nguyễn Văn An',
  role: 'STUDENT',
  studentCode: 'std_402',
};

export const mockAdmin: User = {
  id: 2,
  email: 'admin1@tdtu.edu.vn',
  fullName: 'Quản trị viên 1',
  role: 'ADMIN',
  studentCode: null,
};

// Mật khẩu chung của mọi tài khoản giả, giống dữ liệu mẫu ở backend.
export const MOCK_PASSWORD = 'Password@123';

// Người đang chờ ở các lớp đầy (sectionId -> mã sinh viên theo thứ tự vào hàng).
export const mockOtherWaiting: Record<number, string[]> = { 6: ['std_610', 'std_611', 'std_170'] };

export const mockSemester: Semester = {
  id: 2,
  code: '2026-1',
  name: 'Học kỳ 1 năm học 2026-2027',
  registrationStart: '2026-10-10T00:00:00.000Z',
  registrationEnd: '2026-12-16T00:00:00.000Z',
  maxCredits: 24,
  registrationOpen: true,
};

export const mockCourses: Course[] = [
  { id: 1, code: 'CS101', name: 'Introduction to Programming', credits: 4 },
  { id: 2, code: 'CS201', name: 'Data Structures and Algorithms', credits: 4 },
  { id: 3, code: 'CS301', name: 'Design and Analysis of Algorithms', credits: 4 },
  { id: 13, code: 'MA101', name: 'Calculus 1', credits: 3 },
  { id: 17, code: 'EN101', name: 'English 1', credits: 2 },
];

// Môn tiên quyết trực tiếp: courseId -> các courseId phải đạt trước
export const mockPrerequisites: Record<number, number[]> = { 2: [1], 3: [2] };

export const mockSections: Section[] = [
  { id: 1, courseId: 13, semesterId: 2, code: 'MA101-01', lecturerName: 'ThS. Nguyễn Văn Toán', capacity: 40, enrolledCount: 1, slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'A101' }] },
  { id: 2, courseId: 2, semesterId: 2, code: 'CS201-01', lecturerName: 'TS. Trần Minh Khoa', capacity: 40, enrolledCount: 35, slots: [{ dayOfWeek: 1, startPeriod: 2, endPeriod: 4, room: 'B201' }] },
  { id: 3, courseId: 2, semesterId: 2, code: 'CS201-02', lecturerName: 'TS. Trần Minh Khoa', capacity: 40, enrolledCount: 10, slots: [{ dayOfWeek: 1, startPeriod: 4, endPeriod: 6, room: 'B202' }] },
  { id: 4, courseId: 2, semesterId: 2, code: 'CS201-03', lecturerName: 'ThS. Lê Thu Hà', capacity: 40, enrolledCount: 0, slots: [{ dayOfWeek: 2, startPeriod: 1, endPeriod: 3, room: 'B203' }] },
  { id: 5, courseId: 3, semesterId: 2, code: 'CS301-01', lecturerName: 'PGS. TS. Đỗ Văn Nam', capacity: 40, enrolledCount: 12, slots: [{ dayOfWeek: 4, startPeriod: 1, endPeriod: 3, room: 'B301' }] },
  { id: 6, courseId: 17, semesterId: 2, code: 'EN101-01', lecturerName: 'ThS. Mai Anh', capacity: 30, enrolledCount: 30, waitlistCount: 3, slots: [{ dayOfWeek: 3, startPeriod: 4, endPeriod: 5, room: 'D101' }, { dayOfWeek: 5, startPeriod: 1, endPeriod: 2, room: 'D101' }] },
];

export const mockCompleted: CompletedCourse[] = [
  { course: mockCourses[0], semesterCode: '2025-2', grade: 8, passed: true },
];
