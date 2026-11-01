export interface Course {
  id: number
  code: string
  name: string
  credits: number
  description?: string | null
}
export interface Slot {
  dayOfWeek: number
  startPeriod: number
  endPeriod: number
  room?: string | null
}
export interface Section {
  id: number
  courseId: number
  semesterId: number
  code: string
  lecturerName?: string | null
  capacity: number
  enrolledCount: number
  remainingSeats?: number
  waitlistCount?: number
  slots: Slot[]
}
export interface CourseDetail extends Course {
  prerequisites: (Course & { passed?: boolean })[]
  sections: Section[]
}
export interface CoursePage {
  items: Course[]
  page: number
  pageSize: number
  total: number
}
export interface Violation {
  code: string
  message: string
  details?: Record<string, unknown>
}
export interface ValidationResult {
  valid: boolean
  violations: Violation[]
}
export interface ScheduleEntry extends Slot {
  sectionId: number
  sectionCode: string
  courseCode: string
  courseName: string
  credits: number
}
export interface WeeklySchedule {
  semesterId: number
  totalCredits: number
  maxCredits: number
  entries: ScheduleEntry[]
}
export interface Registration {
  id: number
  studentId: number
  section: Section
  course?: Course
  status: 'ENROLLED' | 'DROPPED'
  createdAt: string
}
export interface WaitlistEntry {
  id: number
  studentId: number
  sectionId: number
  section?: Section // backend có thể trả kèm lớp để hiện mã lớp
  position?: number | null
  status: 'WAITING' | 'PROMOTED' | 'SKIPPED' | 'CANCELLED'
  createdAt: string
}
export interface CompletedCourse {
  course: Course
  semesterCode?: string
  grade: number
  passed: boolean
}
export interface User {
  id: number
  email: string
  fullName: string
  role: 'STUDENT' | 'ADMIN'
}
export interface Semester {
  id: number
  code: string
  name: string
  registrationStart: string
  registrationEnd: string
  maxCredits: number
  registrationOpen?: boolean
}
export interface CourseInput {
  code: string
  name: string
  credits: number
  description?: string
}
export interface SectionInput {
  courseId: number
  semesterId: number
  code: string
  lecturerName?: string
  capacity: number
  slots: Slot[]
}
export interface SectionEnrolment extends Registration {
  studentCode?: string
  studentName?: string
}
export interface SectionWaitlistEntry extends WaitlistEntry {
  studentCode?: string
}
export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>
  constructor(status: number, error: Violation) {
    super(error.message)
    this.status = status
    this.code = error.code
    this.details = error.details
  }
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Giữ header ở mọi dạng hợp lệ của RequestInit, kể cả Headers và mảng cặp.
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      code: 'HTTP_ERROR', message: `Yêu cầu thất bại (${response.status}).`,
    })) as Violation
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(response.status, error)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}
export function remove(path: string) {
  return request<void>(path, { method: 'DELETE' })
}
export function put<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}
