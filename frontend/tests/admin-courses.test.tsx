import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminCourses from '../src/admin/AdminCourses'
import { course, json, mockApi } from './fixtures'

const page = { items: [{ id: 2, code: 'CS201', name: course.name, credits: 4 }], page: 1, pageSize: 100, total: 1 }

describe('US-12: Quản lý môn học (UI-09)', () => {
  it('quản lý được môn ngoài 100 kết quả đầu tiên', async () => {
    const fetch = mockApi(path => {
      const second = new URL(path, 'http://localhost').searchParams.get('page') === '2'
      return json({ items: second ? [{ ...page.items[0], id: 101, code: 'CS999' }] : page.items, page: second ? 2 : 1, pageSize: 100, total: 101 })
    })
    render(<AdminCourses openSections={() => {}} openPrerequisites={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Trang sau' }))
    expect(await screen.findByRole('button', { name: 'Sửa CS999' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledWith('/api/v1/courses?q=&page=2&pageSize=100', expect.anything())
  })
  it('tạo môn mới bằng POST rồi tải lại danh sách', async () => {
    const fetch = mockApi((path, options) => options?.method === 'POST' ?
      json({ id: 30, code: 'CS999', name: 'Môn thử', credits: 3 }, 201) : json(page))
    render(<AdminCourses openSections={() => {}} openPrerequisites={() => {}} />)
    const controls = userEvent.setup()
    await controls.type(await screen.findByLabelText('Mã môn'), 'CS999')
    await controls.type(screen.getByLabelText('Tên môn'), 'Môn thử')
    await controls.click(screen.getByRole('button', { name: 'Thêm môn' }))
    expect(await screen.findByText('Đã tạo môn CS999.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/courses', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ code: 'CS999', name: 'Môn thử', credits: 3, description: '' }),
    }))
    expect(fetch.mock.calls.filter(([url]) => String(url).startsWith('/api/v1/courses?'))).toHaveLength(2)
  })
  it('báo trùng mã môn bằng tiếng Việt', async () => {
    mockApi((path, options) => options?.method === 'POST' ?
      json({ code: 'COURSE_CODE_EXISTS', message: 'Course code already exists.' }, 409) : json(page))
    render(<AdminCourses openSections={() => {}} openPrerequisites={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Mã môn'), 'CS101')
    await userEvent.type(screen.getByLabelText('Tên môn'), 'Trùng')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm môn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã môn đã tồn tại.')
  })
  it('sửa môn dùng PUT với id của môn', async () => {
    const fetch = mockApi((path, options) => options?.method === 'PUT' ? json(page.items[0]) : json(page))
    render(<AdminCourses openSections={() => {}} openPrerequisites={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa CS201' }))
    expect(screen.getByRole('heading', { name: 'Sửa môn CS201' })).toBeVisible()
    const credits = screen.getByLabelText('Số tín chỉ')
    await userEvent.clear(credits)
    await userEvent.type(credits, '3')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Đã cập nhật môn CS201.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/courses/2', expect.objectContaining({ method: 'PUT' }))
  })
  it('mở trang lớp học phần và tiên quyết của môn', async () => {
    mockApi(() => json(page))
    const sections = vi.fn(); const prerequisites = vi.fn()
    render(<AdminCourses openSections={sections} openPrerequisites={prerequisites} />)
    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]
    await userEvent.click(within(row).getByRole('button', { name: 'Lớp học phần CS201' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Tiên quyết CS201' }))
    expect(sections).toHaveBeenCalledWith(page.items[0])
    expect(prerequisites).toHaveBeenCalledWith(page.items[0])
  })
})
