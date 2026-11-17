import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SuggestedSection, SuggestionResult } from '../src/api'
import Suggestions from '../src/Suggestions'
import { json, mockApi } from './fixtures'

const courses = {
  items: [
    { id: 2, code: 'CS201', name: 'Data Structures and Algorithms', credits: 4 },
    { id: 3, code: 'CS301', name: 'Design and Analysis of Algorithms', credits: 4 },
    { id: 19, code: 'PE101', name: 'Physical Education 1', credits: 1 },
  ],
  page: 1, pageSize: 100, total: 3,
}

function section(sectionId: number, sectionCode: string, dayOfWeek: number, startPeriod: number, endPeriod: number): SuggestedSection {
  return {
    sectionId, sectionCode, courseId: sectionId, courseCode: sectionCode.slice(0, 5), courseName: sectionCode.slice(0, 5),
    credits: 4, remainingSeats: 10, slots: [{ dayOfWeek, startPeriod, endPeriod, room: 'A1' }],
  }
}

const result: SuggestionResult = {
  semesterId: 2, maxCredits: 24, currentCredits: 3, requestedCredits: 5, exceedsCreditLimit: false,
  courses: [
    { course: courses.items[0], status: 'INCLUDED' },
    { course: courses.items[1], status: 'PREREQUISITE_NOT_MET', missingCourses: [{ id: 2, code: 'CS201', name: 'Data Structures and Algorithms' }] },
    { course: courses.items[2], status: 'INCLUDED' },
  ],
  enrolled: [section(11, 'MA101-01', 1, 1, 3)],
  totalCombinations: 2, truncated: false,
  suggestions: [
    { rank: 1, penalty: 0, metrics: { studyDays: 2, morningSessions: 3, afternoonSessions: 0, gapPeriods: 0, busyFreeDays: [] }, sections: [section(22, 'CS201-02', 1, 4, 6), section(71, 'PE101-01', 7, 1, 2)] },
    { rank: 2, penalty: 40, metrics: { studyDays: 3, morningSessions: 3, afternoonSessions: 1, gapPeriods: 0, busyFreeDays: [2] }, sections: [section(23, 'CS201-03', 2, 1, 3), section(71, 'PE101-01', 7, 1, 2)] },
  ],
}

function api(overrides: (path: string, options?: RequestInit) => Response | undefined = () => undefined) {
  return mockApi((path, options) => overrides(path, options) ?? (path.includes('/courses') ? json(courses) : json(result)))
}

async function search(controls: ReturnType<typeof userEvent.setup>) {
  await controls.click(await screen.findByRole('checkbox', { name: /CS201/ }))
  await controls.click(screen.getByRole('checkbox', { name: /PE101/ }))
  await controls.click(screen.getByRole('checkbox', { name: 'Dồn lịch vào ít ngày' }))
  await controls.click(screen.getByRole('checkbox', { name: 'Tránh học buổi chiều (tiết 7–12)' }))
  await controls.click(screen.getByRole('checkbox', { name: 'Thứ 3' }))
  await controls.click(screen.getByRole('button', { name: 'Tìm phương án' }))
}

describe('Cải tiến 1: Gợi ý thời khóa biểu', () => {
  it('gửi môn đã chọn và sở thích, hiện lý do từng môn và phương án tốt nhất', async () => {
    const fetch = api()
    const controls = userEvent.setup()
    render(<Suggestions schedule={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Tìm phương án' })).toBeDisabled()
    await search(controls)
    const call = fetch.mock.calls.find(([input]) => String(input).endsWith('/schedule-suggestions'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      courseIds: [2, 19], preferences: { avoidMorning: false, avoidAfternoon: true, compactDays: true, freeDays: [2] },
    })
    expect(await screen.findByText(/Chưa đạt môn tiên quyết/)).toHaveTextContent('CS201 – Data Structures and Algorithms')
    expect(screen.getByText('Tìm thấy 2 cách xếp không trùng lịch, đây là 2 phương án tốt nhất.')).toBeVisible()
    expect(screen.getByText(/chọn thêm 5/)).toHaveTextContent('8 / 24')
    const table = screen.getByRole('table', { name: 'Các lớp sẽ đăng ký' })
    expect(within(table).getByText('CS201-02')).toBeVisible()
    // Thời khóa biểu của phương án có cả lớp đang học
    expect(screen.getByRole('table', { name: /Thời khóa biểu tuần/ })).toHaveTextContent('MA101-01')
  })

  it('chuyển phương án và hiện ngày muốn nghỉ nhưng vẫn phải học', async () => {
    api()
    const controls = userEvent.setup()
    render(<Suggestions schedule={() => {}} />)
    await search(controls)
    await controls.click(await screen.findByRole('button', { name: 'Phương án 2' }))
    expect(screen.getByRole('button', { name: 'Phương án 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/1 buổi chiều · 0 tiết trống · vẫn học vào Thứ 3/)).toBeVisible()
    expect(within(screen.getByRole('table', { name: 'Các lớp sẽ đăng ký' })).getByText('CS201-03')).toBeVisible()
  })

  it('xác nhận rồi đăng ký từng lớp, lớp lỗi được báo riêng', async () => {
    const fetch = api((path, options) => {
      if (!path.endsWith('/registrations')) return undefined
      const { sectionId } = JSON.parse(String(options?.body))
      return sectionId === 71 ? json({ code: 'SECTION_FULL', message: 'This section is full.' }, 409) : json({ id: 1 }, 201)
    })
    const openSchedule = vi.fn()
    const controls = userEvent.setup()
    render(<Suggestions schedule={openSchedule} />)
    await search(controls)
    await controls.click(await screen.findByRole('button', { name: 'Đăng ký phương án này' }))
    expect(screen.getByText('Đăng ký 2 lớp: CS201-02, PE101-01?')).toBeVisible()
    await controls.click(screen.getByRole('button', { name: 'Xác nhận đăng ký' }))
    expect(await screen.findByText('Đã đăng ký CS201-02.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Lớp đã đủ sĩ số.')
    const registrations = fetch.mock.calls.filter(([input]) => String(input).endsWith('/registrations'))
    expect(registrations.map(([, options]) => JSON.parse(String(options?.body)).sectionId)).toEqual([22, 71])
    await controls.click(screen.getByRole('button', { name: 'Xem thời khóa biểu tuần' }))
    expect(openSchedule).toHaveBeenCalledOnce()
  })

  it('không có phương án nào hoặc vượt tín chỉ thì báo rõ và khóa nút đăng ký', async () => {
    api(path => path.endsWith('/schedule-suggestions') ? json({ ...result, suggestions: [], totalCombinations: 0 }) : undefined)
    const controls = userEvent.setup()
    const view = render(<Suggestions schedule={() => {}} />)
    await search(controls)
    expect(await screen.findByText(/Không có cách xếp nào/)).toBeVisible()
    view.unmount()

    api(path => path.endsWith('/schedule-suggestions') ? json({ ...result, exceedsCreditLimit: true, maxCredits: 6 }) : undefined)
    render(<Suggestions schedule={() => {}} />)
    await search(controls)
    expect(await screen.findByText(/Vượt giới hạn tín chỉ/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Đăng ký phương án này' })).toBeDisabled()
  })

  it('lọc danh sách môn và giữ các môn đã chọn', async () => {
    api()
    const controls = userEvent.setup()
    render(<Suggestions schedule={() => {}} />)
    await controls.click(await screen.findByRole('checkbox', { name: /PE101/ }))
    await controls.type(screen.getByLabelText('Lọc theo mã hoặc tên'), 'cs3')
    expect(screen.getByRole('checkbox', { name: /CS301/ })).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /PE101/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /CS201/ })).toBeNull()
  })
})
