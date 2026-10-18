import { vi } from 'vitest'
import type { CourseDetail, WeeklySchedule } from '../src/api'

export const course: CourseDetail = {
  id: 2, code: 'CS201', name: 'Data Structures and Algorithms', credits: 4,
  description: 'Cấu trúc dữ liệu và giải thuật.',
  prerequisites: [{ id: 1, code: 'CS101', name: 'Introduction to Programming', credits: 4, passed: true }],
  sections: [
    { id: 21, courseId: 2, semesterId: 1, code: 'CS201-01', capacity: 40, enrolledCount: 39, remainingSeats: 1,
      slots: [{ dayOfWeek: 1, startPeriod: 2, endPeriod: 4, room: 'A101' }] },
    { id: 22, courseId: 2, semesterId: 1, code: 'CS201-02', capacity: 40, enrolledCount: 35,
      slots: [{ dayOfWeek: 3, startPeriod: 4, endPeriod: 6 }] },
  ],
}
export const schedule: WeeklySchedule = {
  semesterId: 1, totalCredits: 7, maxCredits: 24,
  entries: [
    { sectionId: 11, sectionCode: 'MA101-01', courseCode: 'MA101', courseName: 'Calculus 1', credits: 3, dayOfWeek: 1, startPeriod: 1, endPeriod: 3 },
    { sectionId: 22, sectionCode: 'CS201-02', courseCode: 'CS201', courseName: course.name, credits: 4, dayOfWeek: 3, startPeriod: 4, endPeriod: 6 },
  ],
}
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
export function mockApi(handler: (path: string, options?: RequestInit) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => Promise.resolve(handler(String(input), options)))
}
