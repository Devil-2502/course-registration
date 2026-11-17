import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import MyRegistrations from '../src/MyRegistrations'
import type { CourseDetail, Registration, SwapRequest } from '../src/api'
import { json, mockApi } from './fixtures'

const course: CourseDetail = {
  id: 2, code: 'CS201', name: 'Data Structures and Algorithms', credits: 4, prerequisites: [],
  sections: [
    { id: 21, courseId: 2, semesterId: 1, code: 'CS201-01', capacity: 40, enrolledCount: 40, remainingSeats: 0, slots: [{ dayOfWeek: 1, startPeriod: 2, endPeriod: 4 }] },
    { id: 22, courseId: 2, semesterId: 1, code: 'CS201-02', capacity: 40, enrolledCount: 30, remainingSeats: 10, slots: [{ dayOfWeek: 1, startPeriod: 4, endPeriod: 6 }] },
    { id: 23, courseId: 2, semesterId: 1, code: 'CS201-03', capacity: 40, enrolledCount: 39, remainingSeats: 1, slots: [{ dayOfWeek: 2, startPeriod: 1, endPeriod: 3 }] },
  ],
}
const registration: Registration = {
  id: 7, studentId: 1, section: course.sections[1], status: 'ENROLLED', createdAt: '2026-11-17T00:00:00Z',
  course: { id: 2, code: 'CS201', name: course.name, credits: 4 },
}
function swap(status: SwapRequest['status'], outcome: SwapRequest['outcome'] = null, to = course.sections[0]): SwapRequest {
  return {
    id: 5, courseCode: 'CS201', courseName: course.name, fromSection: { id: 22, code: 'CS201-02' },
    toSection: { id: to.id, code: to.code }, status, outcome, createdAt: '2026-11-17T00:00:00Z', resolvedAt: null,
  }
}

// API giả: /swap-requests trả `swaps`, POST trả `answer`; ghi lại các yêu cầu gửi đi.
function api(swaps: SwapRequest[], answer: () => Response = () => json({ outcome: 'MOVED', request: swap('COMPLETED', 'MOVED', course.sections[2]) }, 201)) {
  return mockApi((path, options) => {
    if (path.endsWith('/swap-requests') && options?.method === 'POST') return answer()
    if (options?.method === 'DELETE') return new Response(null, { status: 204 })
    if (path.endsWith('/swap-requests')) return json(swaps)
    if (path.endsWith('/registrations')) return json([registration])
    if (path.endsWith('/courses/2')) return json(course)
    return json([])
  })
}

async function openPicker() {
  const controls = userEvent.setup()
  render(<MyRegistrations catalog={() => {}} />)
  await controls.click(await screen.findByRole('button', { name: 'Đổi lớp CS201-02' }))
  return { controls, picker: await screen.findByRole('group', { name: 'Đổi lớp CS201-02' }) }
}

describe('Cải tiến 2: Đổi lớp an toàn', () => {
  it('liệt kê các lớp khác của môn kèm lịch và số chỗ, không có lớp đang học', async () => {
    api([])
    const { picker } = await openPicker()
    expect(await within(picker).findByText(/đã đầy/)).toHaveTextContent('CS201-01 · Thứ 2 · Tiết 2–4 · đã đầy')
    expect(within(picker).getByText(/còn 1 chỗ/)).toHaveTextContent('CS201-03 · Thứ 3 · Tiết 1–3 · còn 1 chỗ')
    expect(within(picker).queryByRole('button', { name: 'Đổi sang CS201-02' })).toBeNull()
  })

  it('chuyển thẳng: gửi toSectionId, báo kết quả và tải lại danh sách', async () => {
    const fetch = api([])
    const { controls, picker } = await openPicker()
    await controls.click(await within(picker).findByRole('button', { name: 'Đổi sang CS201-03' }))
    expect(await screen.findByText('Đã chuyển từ CS201-02 sang CS201-03.')).toBeVisible()
    const post = fetch.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(post?.[0]).toBe('/api/v1/swap-requests')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ toSectionId: 23 })
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/registrations')).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('group', { name: 'Đổi lớp CS201-02' })).toBeNull()
  })

  it('lớp đầy: báo đã lưu yêu cầu, vẫn giữ chỗ cũ', async () => {
    api([], () => json({ outcome: 'PENDING', request: swap('OPEN') }, 201))
    const { controls, picker } = await openPicker()
    await controls.click(await within(picker).findByRole('button', { name: 'Đổi sang CS201-01' }))
    expect(await screen.findByText(/Lớp CS201-01 đã đầy. Đã lưu yêu cầu: bạn vẫn giữ chỗ ở CS201-02/)).toBeVisible()
  })

  it('đổi chéo: báo đã đổi với một bạn', async () => {
    api([], () => json({ outcome: 'SWAPPED', request: swap('COMPLETED', 'SWAPPED') }, 201))
    const { controls, picker } = await openPicker()
    await controls.click(await within(picker).findByRole('button', { name: 'Đổi sang CS201-01' }))
    expect(await screen.findByText('Đã đổi chéo với một bạn ở CS201-01: bạn đã sang CS201-01.')).toBeVisible()
  })

  it('trùng lịch: hiện lớp bị trùng, giữ khung chọn để chọn lớp khác', async () => {
    api([], () => json({
      code: 'SCHEDULE_CLASH', message: 'Schedule clash with MA101-01',
      details: { conflictsWith: [{ sectionId: 11, sectionCode: 'MA101-01' }] },
    }, 409))
    const { controls, picker } = await openPicker()
    await controls.click(await within(picker).findByRole('button', { name: 'Đổi sang CS201-01' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Trùng lịch với lớp bạn đã đăng ký.')
    expect(alert).toHaveTextContent('Lớp bị trùng lịch: MA101-01')
    expect(screen.getByRole('group', { name: 'Đổi lớp CS201-02' })).toBeVisible()
  })

  it('danh sách yêu cầu: hủy được yêu cầu đang chờ, yêu cầu đã xong thì không', async () => {
    const fetch = api([swap('OPEN'), { ...swap('COMPLETED', 'SWAPPED'), id: 4, fromSection: { id: 21, code: 'CS201-01' }, toSection: { id: 22, code: 'CS201-02' } }])
    const controls = userEvent.setup()
    render(<MyRegistrations catalog={() => {}} />)
    expect(await screen.findByRole('heading', { name: 'Yêu cầu đổi lớp' })).toBeVisible()
    expect(screen.getByText('Đang chờ người đổi ngược')).toBeVisible()
    expect(screen.getByText('Đã đổi chéo')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu CS201-01 → CS201-02' })).toBeNull()
    await controls.click(screen.getByRole('button', { name: 'Hủy yêu cầu CS201-02 → CS201-01' }))
    expect(await screen.findByText('Đã hủy yêu cầu đổi CS201-02 → CS201-01.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/swap-requests/5', expect.objectContaining({ method: 'DELETE' }))
  })

  it('đóng khung chọn mà không gửi gì', async () => {
    const fetch = api([])
    const { controls } = await openPicker()
    await controls.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.getByRole('button', { name: 'Đổi lớp CS201-02' })).toBeVisible()
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })
})
