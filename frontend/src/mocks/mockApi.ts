import { ApiError } from '../api/client';
import type { Api } from '../api/api';
import type { Registration, Section, SectionInput, User, WaitlistEntry } from '../api/types';
import { slotsOverlap } from '../utils/timetable';
import {
  MOCK_PASSWORD,
  mockAdmin,
  mockCompleted,
  mockCourses,
  mockOtherWaiting,
  mockPrerequisites,
  mockSections,
  mockSemester,
  mockStudent,
} from './data';

// API giả chạy hoàn toàn trong trình duyệt, dùng khi VITE_USE_MOCK=true.
// Chỉ mô phỏng các quy tắc chính để làm giao diện; quy tắc thật nằm ở backend.

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));
const sections: Section[] = mockSections.map((s) => ({ ...s }));
let registrations: Registration[] = [
  { id: 1, studentId: 1, section: sections[0], course: mockCourses[3], status: 'ENROLLED', createdAt: new Date().toISOString() },
];
let waitlist: WaitlistEntry[] = [];
let currentUser: User | null = null;
let nextId = 100;

const withSeats = (s: Section): Section => ({ ...s, remainingSeats: s.capacity - s.enrolledCount });
const courseOf = (courseId: number) => mockCourses.find((c) => c.id === courseId);
const sectionOf = (id: number) => {
  const section = sections.find((s) => s.id === id);
  if (!section) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Section not found.' });
  return section;
};
const requireLogin = (): User => {
  if (!currentUser) throw new ApiError(401, { code: 'UNAUTHENTICATED', message: 'You need to sign in.' });
  return currentUser;
};
const courseOrThrow = (courseId: number) => {
  const course = courseOf(courseId);
  if (!course) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Course not found.' });
  return course;
};
const passed = (courseId: number) => mockCompleted.some((c) => c.course.id === courseId && c.passed);

// Thêm quan hệ course -> prerequisite có tạo vòng không:
// có, nếu đi theo các môn tiên quyết bắt đầu từ prerequisite mà quay về được course.
function createsCycle(courseId: number, prerequisiteId: number): boolean {
  const stack = [prerequisiteId];
  const visited = new Set<number>();
  for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
    if (current === courseId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(mockPrerequisites[current] ?? []));
  }
  return false;
}

// Kiểm tra giống backend (section-input.ts): buổi học hợp lệ, mã lớp không trùng.
function checkSectionInput(input: SectionInput, exceptId?: number) {
  const fields: Record<string, string> = {};
  input.slots.forEach((slot, index) => {
    if (slot.endPeriod < slot.startPeriod) fields[`slots[${index}]`] = 'endPeriod must not be lower than startPeriod';
  });
  if (Object.keys(fields).length > 0) {
    throw new ApiError(400, { code: 'VALIDATION_ERROR', message: 'The request is invalid.', details: { fields } });
  }
  const duplicate = sections.some(
    (s) => s.id !== exceptId && s.courseId === input.courseId && s.semesterId === input.semesterId && s.code === input.code,
  );
  if (duplicate) {
    throw new ApiError(409, { code: 'SECTION_CODE_EXISTS', message: 'Section code already exists for this course and semester.' });
  }
}

function checkRules(section: Section): ApiError[] {
  const errors: ApiError[] = [];
  if (registrations.some((r) => r.section.courseId === section.courseId)) {
    errors.push(new ApiError(409, { code: 'ALREADY_ENROLLED', message: 'Already enrolled.' }));
  }
  const missing = (mockPrerequisites[section.courseId] ?? []).filter((id) => !passed(id));
  if (missing.length > 0) {
    errors.push(new ApiError(422, { code: 'PREREQUISITE_NOT_MET', message: 'Missing prerequisites.', details: { missingCourses: missing.map(courseOf) } }));
  }
  const clashes = registrations.filter((r) => r.section.slots.some((a) => section.slots.some((b) => slotsOverlap(a, b))));
  if (clashes.length > 0) {
    errors.push(new ApiError(409, { code: 'SCHEDULE_CLASH', message: 'Schedule clash.', details: { conflictsWith: clashes.map((r) => ({ sectionId: r.section.id, sectionCode: r.section.code })) } }));
  }
  const current = registrations.reduce((sum, r) => sum + (r.course?.credits ?? 0), 0);
  const credits = courseOf(section.courseId)?.credits ?? 0;
  if (current + credits > mockSemester.maxCredits) {
    errors.push(new ApiError(422, { code: 'CREDIT_LIMIT_EXCEEDED', message: 'Credit limit exceeded.', details: { currentCredits: current, requestedCredits: credits, limit: mockSemester.maxCredits } }));
  }
  if (section.enrolledCount >= section.capacity) {
    errors.push(new ApiError(409, { code: 'SECTION_FULL', message: 'Section is full.' }));
  }
  return errors;
}

export const mockApi: Api = {
  async login(email, password) {
    await delay();
    const user = [mockStudent, mockAdmin].find((u) => u.email === email);
    if (!user || password !== MOCK_PASSWORD) {
      throw new ApiError(401, { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    }
    currentUser = user;
    return user;
  },
  async logout() {
    currentUser = null;
  },
  async me() {
    await delay(50);
    return requireLogin();
  },
  async currentSemester() {
    return mockSemester;
  },
  async searchCourses(q, page, pageSize = 20) {
    await delay();
    const keyword = q.trim().toLowerCase();
    const found = mockCourses.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(keyword));
    return { items: found.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: found.length };
  },
  async getCourse(courseId) {
    await delay();
    const course = courseOf(courseId);
    if (!course) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Course not found.' });
    return {
      ...course,
      prerequisites: mockCourses
        .filter((c) => (mockPrerequisites[courseId] ?? []).includes(c.id))
        .map((c) => ({ ...c, passed: passed(c.id) })),
      sections: sections.filter((s) => s.courseId === courseId).map(withSeats),
    };
  },
  async mySchedule() {
    await delay();
    const entries = registrations.flatMap((r) =>
      r.section.slots.map((slot) => ({
        sectionId: r.section.id,
        sectionCode: r.section.code,
        courseCode: r.course?.code ?? '',
        courseName: r.course?.name ?? '',
        credits: r.course?.credits ?? 0,
        ...slot,
      })),
    );
    const totalCredits = registrations.reduce((sum, r) => sum + (r.course?.credits ?? 0), 0);
    return { semesterId: mockSemester.id, totalCredits, maxCredits: mockSemester.maxCredits, entries };
  },
  async myRegistrations() {
    await delay();
    return registrations.map((r) => ({ ...r, section: withSeats(sectionOf(r.section.id)) }));
  },
  async validateRegistration(sectionId) {
    await delay(100);
    const violations = checkRules(sectionOf(sectionId)).map((e) => ({ code: e.code, message: e.message, details: e.details }));
    return { valid: violations.length === 0, violations };
  },
  async register(sectionId) {
    await delay();
    const section = sectionOf(sectionId);
    const errors = checkRules(section);
    if (errors.length > 0) throw errors[0];
    section.enrolledCount += 1;
    const registration: Registration = { id: nextId++, studentId: 1, section: withSeats(section), course: courseOf(section.courseId), status: 'ENROLLED', createdAt: new Date().toISOString() };
    registrations.push(registration);
    return registration;
  },
  async drop(registrationId) {
    await delay();
    const registration = registrations.find((r) => r.id === registrationId);
    if (!registration) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Registration not found.' });
    sectionOf(registration.section.id).enrolledCount -= 1;
    registrations = registrations.filter((r) => r.id !== registrationId);
  },
  async myWaitlist() {
    await delay();
    return waitlist;
  },
  async joinWaitlist(sectionId) {
    await delay();
    const section = sectionOf(sectionId);
    if (section.enrolledCount < section.capacity) throw new ApiError(409, { code: 'SECTION_NOT_FULL', message: 'Section still has seats.' });
    if (waitlist.some((w) => w.sectionId === sectionId)) throw new ApiError(409, { code: 'ALREADY_ON_WAITLIST', message: 'Already waiting.' });
    const entry: WaitlistEntry = { id: nextId++, studentId: 1, sectionId, position: 4, status: 'WAITING', createdAt: new Date().toISOString() };
    waitlist.push(entry);
    return entry;
  },
  async leaveWaitlist(entryId) {
    await delay();
    waitlist = waitlist.filter((w) => w.id !== entryId);
  },
  async completedCourses() {
    await delay();
    return mockCompleted;
  },
  async createCourse(input) {
    await delay();
    if (mockCourses.some((c) => c.code === input.code)) throw new ApiError(409, { code: 'COURSE_CODE_EXISTS', message: 'Course code already exists.' });
    const course = { id: nextId++, ...input };
    mockCourses.push(course);
    return course;
  },
  async updateCourse(courseId, input) {
    await delay();
    const course = courseOrThrow(courseId);
    Object.assign(course, input);
    return course;
  },
  async listPrerequisites(courseId) {
    await delay();
    courseOrThrow(courseId);
    return mockCourses.filter((c) => (mockPrerequisites[courseId] ?? []).includes(c.id));
  },
  async addPrerequisite(courseId, prerequisiteId) {
    await delay();
    courseOrThrow(courseId);
    courseOrThrow(prerequisiteId);
    const current = mockPrerequisites[courseId] ?? [];
    if (current.includes(prerequisiteId)) {
      throw new ApiError(409, { code: 'PREREQUISITE_EXISTS', message: 'This prerequisite already exists.' });
    }
    if (createsCycle(courseId, prerequisiteId)) {
      throw new ApiError(409, { code: 'PREREQUISITE_CYCLE', message: 'This prerequisite would create a cycle.' });
    }
    mockPrerequisites[courseId] = [...current, prerequisiteId];
    return mockApi.listPrerequisites(courseId);
  },
  async removePrerequisite(courseId, prerequisiteId) {
    await delay();
    const current = mockPrerequisites[courseId] ?? [];
    if (!current.includes(prerequisiteId)) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Prerequisite not found.' });
    mockPrerequisites[courseId] = current.filter((id) => id !== prerequisiteId);
  },
  async createSection(input) {
    await delay();
    courseOrThrow(input.courseId);
    checkSectionInput(input);
    const section: Section = { id: nextId++, enrolledCount: 0, waitlistCount: 0, ...input };
    sections.push(section);
    return withSeats(section);
  },
  async updateSection(sectionId, input) {
    await delay();
    const section = sectionOf(sectionId);
    if (input.capacity < section.enrolledCount) {
      throw new ApiError(409, {
        code: 'CAPACITY_BELOW_ENROLLED',
        message: 'New capacity is lower than the number of enrolled students.',
        details: { capacity: input.capacity, enrolledCount: section.enrolledCount },
      });
    }
    checkSectionInput(input, sectionId);
    Object.assign(section, input);
    return withSeats(section);
  },
  // Dữ liệu giả: tạo đủ số dòng bằng enrolledCount, mã sinh viên đặt theo thứ tự.
  async sectionEnrolments(sectionId) {
    await delay();
    const section = withSeats(sectionOf(sectionId));
    return Array.from({ length: section.enrolledCount }, (_, i) => ({
      id: 1000 + i,
      studentId: 1000 + i,
      studentCode: `std_${101 + i}`,
      studentName: `Sinh viên ${101 + i}`,
      section,
      status: 'ENROLLED' as const,
      createdAt: new Date().toISOString(),
    }));
  },
  async sectionWaitlist(sectionId) {
    await delay();
    sectionOf(sectionId);
    const codes = [...(mockOtherWaiting[sectionId] ?? []), ...waitlist.filter((w) => w.sectionId === sectionId).map(() => mockStudent.studentCode ?? '')];
    return codes.map((studentCode, i) => ({
      id: 2000 + i,
      studentId: 2000 + i,
      studentCode,
      sectionId,
      position: i + 1,
      status: 'WAITING' as const,
      createdAt: new Date().toISOString(),
    }));
  },
};
