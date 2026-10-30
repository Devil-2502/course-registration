import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminSections from '../src/admin/AdminSections'
import SectionRoster from '../src/admin/SectionRoster'
import { course, json, mockApi } from './fixtures'

const semester = { id: 1, code: '2026-1', name: 'Học kỳ 1 năm học 2026-2027', registrationStart: '', registrationEnd: '', maxCredits: 24 }

describe('US-12: Quản lý lớp học phần (UI-11) và danh sách lớp (UI-12)', () => {
  it('bỏ trường giảng viên trống khỏi JSON để khớp SectionInput của OpenAPI', async () => {
    const fetch = mockApi((path, options) => options?.method === 'POST' ? json(course.sections[0], 201) :
      path.includes('/semesters/current') ? json(semester) : json(course))
    render(<AdminSections course={course} back={() => {}} openRoster={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Mã lớp'), 'CS201-10')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm lớp' }))
    expect(await screen.findByText('Đã tạo lớp CS201-10.')).toBeVisible()
    const body = JSON.parse(String(fetch.mock.calls.find(([, options]) => options?.method === 'POST')?.[1]?.body))
    expect(body).not.toHaveProperty('lecturerName')
  })
  it('danh sách lớp dùng mã sinh viên dự phòng khi API không có trường mở rộng', async () => {
    mockApi(path => path.endsWith('/enrolments') ?
      json([{ id: 1, studentId: 5, section: course.sections[0], status: 'ENROLLED', createdAt: '2026-10-18T00:00:00Z' }]) : json([]))
    render(<SectionRoster section={course.sections[0]} back={() => {}} />)
    expect(await screen.findByText('#5')).toBeVisible()
    expect(screen.getByText('Không có ai trong hàng chờ.')).toBeVisible()
  })
  it('tạo lớp có hai buổi học, gửi đúng SectionInput', async () => {
    const fetch = mockApi((path, options) => options?.method === 'POST' ? json({ ...course.sections[0], id: 99 }, 201) :
      path.includes('/semesters/current') ? json(semester) : json(course))
    render(<AdminSections course={course} back={() => {}} openRoster={() => {}} />)
    const controls = userEvent.setup()
    await controls.type(await screen.findByLabelText('Mã lớp'), 'CS201-09')
    await controls.type(screen.getByLabelText('Giảng viên'), 'ThS. Thử')
    await controls.click(screen.getByRole('button', { name: '+ Thêm buổi' }))
    const second = screen.getByRole('group', { name: 'Buổi 2' })
    await controls.selectOptions(within(second).getByLabelText('Thứ'), '4')
    await controls.selectOptions(within(second).getByLabelText('Từ tiết'), '7')
    await controls.selectOptions(within(second).getByLabelText('Đến tiết'), '9')
    await controls.type(within(second).getByLabelText('Phòng'), 'C305')
    await controls.click(screen.getByRole('button', { name: 'Thêm lớp' }))
    expect(await screen.findByText('Đã tạo lớp CS201-09.')).toBeVisible()
    const body = JSON.parse(String(fetch.mock.calls.find(([, options]) => options?.method === 'POST')?.[1]?.body))
    expect(body).toEqual({
      courseId: 2, semesterId: 1, code: 'CS201-09', lecturerName: 'ThS. Thử', capacity: 40,
      slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: null }, { dayOfWeek: 4, startPeriod: 7, endPeriod: 9, room: 'C305' }],
    })
  })
  it('giảm sức chứa dưới sĩ số thì báo lỗi, sửa dùng PUT', async () => {
    const fetch = mockApi((path, options) => options?.method === 'PUT' ?
      json({ code: 'CAPACITY_BELOW_ENROLLED', message: 'x', details: { capacity: 10, enrolledCount: 39 } }, 409) :
      path.includes('/semesters/current') ? json(semester) : json(course))
    render(<AdminSections course={course} back={() => {}} openRoster={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa CS201-01' }))
    const capacity = screen.getByLabelText('Sức chứa')
    await userEvent.clear(capacity)
    await userEvent.type(capacity, '10')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sức chứa mới thấp hơn số sinh viên đã đăng ký.')
    expect(fetch).toHaveBeenCalledWith('/api/v1/sections/21', expect.objectContaining({ method: 'PUT' }))
  })
  it('lỗi dữ liệu nhập liệt kê trường sai', async () => {
    mockApi((path, options) => options?.method === 'POST' ?
      json({ code: 'VALIDATION_ERROR', message: 'x', details: { fields: { 'slots[0]': 'endPeriod must not be lower than startPeriod' } } }, 400) :
      path.includes('/semesters/current') ? json(semester) : json(course))
    render(<AdminSections course={course} back={() => {}} openRoster={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Mã lớp'), 'CS201-10')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm lớp' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('slots[0]: endPeriod must not be lower than startPeriod')
  })
  it('mở danh sách lớp', async () => {
    mockApi(path => path.includes('/semesters/current') ? json(semester) : json(course))
    const roster = vi.fn()
    render(<AdminSections course={course} back={() => {}} openRoster={roster} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Danh sách CS201-01' }))
    expect(roster).toHaveBeenCalledWith(course.sections[0])
  })
  it('UI-12 hiện sinh viên đã đăng ký và hàng chờ theo thứ tự', async () => {
    mockApi(path => path.endsWith('/enrolments') ?
      json([{ id: 1, studentId: 5, studentCode: 'std_140', studentName: 'Sinh viên 140', section: course.sections[0], status: 'ENROLLED', createdAt: '2026-10-18T00:00:00Z' }]) :
      json([
        { id: 2, studentId: 6, studentCode: 'std_610', sectionId: 21, position: 1, status: 'WAITING', createdAt: '2026-10-18T00:00:00Z' },
        { id: 3, studentId: 7, studentCode: 'std_611', sectionId: 21, position: null, status: 'PROMOTED', createdAt: '2026-10-18T00:00:00Z' },
      ]))
    render(<SectionRoster section={course.sections[0]} back={() => {}} />)
    expect(await screen.findByRole('heading', { name: 'Đã đăng ký (1)' })).toBeVisible()
    expect(screen.getByText('std_140')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Hàng chờ (1 người đang chờ)' })).toBeVisible()
    expect(screen.getByText('Đã được xếp lớp')).toBeVisible()
  })
})
