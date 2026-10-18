import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CourseDetails from '../src/CourseDetails'
import { course, json, mockApi, schedule } from './fixtures'

describe('US-03 và xem trước đăng ký', () => {
  it('hiển thị tiên quyết đã đạt, các lớp, lịch học và số chỗ', async () => {
    mockApi(() => json(course))
    render(<CourseDetails id={2} back={() => {}} />)
    expect(await screen.findByRole('heading', { name: course.name })).toBeVisible()
    expect(screen.getByText('Đã đạt (Passed)')).toBeVisible()
    expect(screen.getByText(/Còn 1 chỗ/)).toBeVisible()
    expect(screen.getByText(/Còn 5 chỗ/)).toBeVisible()
    expect(screen.getByText(/Thứ 2 · Tiết 2–4 · Phòng A101/)).toBeVisible()
  })
  it('báo môn không tồn tại', async () => {
    mockApi(() => json({ code: 'NOT_FOUND', message: 'Course not found' }, 404))
    render(<CourseDetails id={999999} back={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy dữ liệu')
  })
  it('tô đỏ tiết trùng, hiển thị lớp xung đột và khóa nút theo API', async () => {
    mockApi(path => path.includes('/courses/') ? json(course) : path.includes('/schedule') ? json(schedule) : json({
      valid: false, violations: [{ code: 'SCHEDULE_CLASH', message: 'Schedule clash with MA101-01', details: { conflictsWith: ['MA101-01'] } }],
    }))
    const view = render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-01' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Schedule clash with MA101-01')
    expect(screen.getByRole('button', { name: 'Xác nhận đăng ký' })).toBeDisabled()
    expect(view.container.querySelectorAll('td.clash')).toHaveLength(2)
  })
  it('không cho đăng ký khi kiểm tra thất bại hoặc còn đang chờ', async () => {
    mockApi(path => path.includes('/courses/') ? json(course) : path.includes('/schedule') ? json(schedule) : json({ code: 'FORBIDDEN', message: 'Forbidden' }, 403))
    render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-02' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn không có quyền')
    expect(screen.getByRole('button', { name: 'Xác nhận đăng ký' })).toBeDisabled()
  })
  it('gửi đúng một yêu cầu khi nhấn nhiều lần và tải lại lịch, số chỗ', async () => {
    let finish: (response: Response) => void = () => {}
    const fetch = mockApi((path, options) => {
      if (path.includes('/courses/')) return json(course)
      if (path.includes('/schedule')) return json(schedule)
      if (path.endsWith('/validate')) return json({ valid: true, violations: [] })
      if (path.endsWith('/registrations') && options?.method === 'POST') return new Promise(resolve => { finish = resolve })
      throw new Error(`Unexpected path ${path}`)
    })
    render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-02' }))
    const button = screen.getByRole('button', { name: 'Xác nhận đăng ký' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.dblClick(button)
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/registrations'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Đang đăng ký…' })).toBeDisabled()
    finish(json({ id: 1, status: 'ENROLLED' }, 201))
    expect(await screen.findByText('Đăng ký thành công lớp CS201-02.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/registrations', expect.objectContaining({ body: '{"sectionId":22}', credentials: 'include' }))
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/schedule')).length).toBeGreaterThanOrEqual(2)
  })
  it('hiển thị từ chối cấp chỗ dù xem trước hợp lệ', async () => {
    mockApi(path => path.includes('/courses/') ? json(course) : path.includes('/schedule') ? json(schedule) : path.endsWith('/validate') ?
      json({ valid: true, violations: [] }) : json({ code: 'SECTION_FULL', message: 'Lớp đã đủ sĩ số' }, 409))
    render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-02' }))
    const button = screen.getByRole('button', { name: 'Xác nhận đăng ký' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Lớp đã đủ sĩ số')
    expect(screen.queryByText(/Đăng ký thành công/)).not.toBeInTheDocument()
  })
})
