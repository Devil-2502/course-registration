import { apiFetch, jsonBody } from './client';
import { mockApi } from '../mocks/mockApi';
import type {
  CompletedCourse,
  Course,
  CourseDetail,
  CourseInput,
  CoursePage,
  Registration,
  Section,
  SectionEnrolment,
  SectionInput,
  SectionWaitlistEntry,
  Semester,
  User,
  ValidationResult,
  WaitlistEntry,
  WeeklySchedule,
} from './types';

// Mỗi hàm ứng với một endpoint trong docs/openapi-spec.yaml.
const realApi = {
  login: (email: string, password: string) =>
    apiFetch<User>('/auth/login', { method: 'POST', body: jsonBody({ email, password }) }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  me: () => apiFetch<User>('/auth/me'),
  currentSemester: () => apiFetch<Semester>('/semesters/current'),

  searchCourses: (q: string, page: number, pageSize = 20) =>
    apiFetch<CoursePage>(`/courses?${new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) })}`),
  getCourse: (courseId: number) => apiFetch<CourseDetail>(`/courses/${courseId}`),

  mySchedule: () => apiFetch<WeeklySchedule>('/students/me/schedule'),
  myRegistrations: () => apiFetch<Registration[]>('/registrations'),
  validateRegistration: (sectionId: number) =>
    apiFetch<ValidationResult>('/registrations/validate', { method: 'POST', body: jsonBody({ sectionId }) }),
  register: (sectionId: number) =>
    apiFetch<Registration>('/registrations', { method: 'POST', body: jsonBody({ sectionId }) }),
  drop: (registrationId: number) => apiFetch<void>(`/registrations/${registrationId}`, { method: 'DELETE' }),

  myWaitlist: () => apiFetch<WaitlistEntry[]>('/waitlist'),
  joinWaitlist: (sectionId: number) =>
    apiFetch<WaitlistEntry>('/waitlist', { method: 'POST', body: jsonBody({ sectionId }) }),
  leaveWaitlist: (entryId: number) => apiFetch<void>(`/waitlist/${entryId}`, { method: 'DELETE' }),

  completedCourses: () => apiFetch<CompletedCourse[]>('/students/me/completed-courses'),

  createCourse: (input: CourseInput) =>
    apiFetch<Course>('/courses', { method: 'POST', body: jsonBody(input) }),
  updateCourse: (courseId: number, input: CourseInput) =>
    apiFetch<Course>(`/courses/${courseId}`, { method: 'PUT', body: jsonBody(input) }),

  listPrerequisites: (courseId: number) => apiFetch<Course[]>(`/courses/${courseId}/prerequisites`),
  addPrerequisite: (courseId: number, prerequisiteId: number) =>
    apiFetch<Course[]>(`/courses/${courseId}/prerequisites`, { method: 'POST', body: jsonBody({ prerequisiteId }) }),
  removePrerequisite: (courseId: number, prerequisiteId: number) =>
    apiFetch<void>(`/courses/${courseId}/prerequisites/${prerequisiteId}`, { method: 'DELETE' }),

  createSection: (input: SectionInput) =>
    apiFetch<Section>('/sections', { method: 'POST', body: jsonBody(input) }),
  updateSection: (sectionId: number, input: SectionInput) =>
    apiFetch<Section>(`/sections/${sectionId}`, { method: 'PUT', body: jsonBody(input) }),
  sectionEnrolments: (sectionId: number) => apiFetch<SectionEnrolment[]>(`/sections/${sectionId}/enrolments`),
  sectionWaitlist: (sectionId: number) => apiFetch<SectionWaitlistEntry[]>(`/sections/${sectionId}/waitlist`),
};

export type Api = typeof realApi;

// VITE_USE_MOCK=true trong frontend/.env: dùng dữ liệu giả, không cần backend.
export const api: Api = import.meta.env.VITE_USE_MOCK === 'true' ? mockApi : realApi;
