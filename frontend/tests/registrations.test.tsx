import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MyRegistrations from '../src/MyRegistrations'
import type { Registration, WaitlistEntry } from '../src/api'
import { course, json, mockApi } from './fixtures'

const registration: Registration = {
  id: 7, studentId: 1, section: course.sections[1], status: 'ENROLLED', createdAt: '2026-10-18T00:00:00Z',
  course: { id: course.id, code: course.code, name: course.name, credits: course.credits },
}
const entry: WaitlistEntry = { id: 9, studentId: 1, sectionId: 30, position: 2, status: 'WAITING', createdAt: '2026-10-18T00:00:00Z' }

describe('US-10 và US-09: Môn đã đăng ký và hàng chờ', () => {
  it('không cho hủy lại môn đã hủy hoặc rời mục đã được xếp lớp', async () => {
    mockApi(path => path.endsWith('/registrations') ? json([{ ...registration, status: 'DROPPED' }]) : json([{ ...entry, status: 'PROMOTED', position: null }]))
    render(<MyRegistrations catalog={() => {}} />)
    expect(await screen.findByText('Bạn chưa đăng ký lớp nào trong học kỳ này.')).toBeVisible()
    expect(screen.getByText('Đã được xếp lớp')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Rời hàng chờ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hủy lớp/ })).not.toBeInTheDocument()
  })
  it('khóa thao tác hủy trong lúc chờ, không gửi DELETE lặp', async () => {
    let finish: (response: Response) => void = () => {}
    const fetch = mockApi((path, options) => {
      if (options?.method === 'DELETE') return new Promise(resolve => { finish = resolve })
      return path.endsWith('/registrations') ? json([registration]) : json([entry])
    })
    render(<MyRegistrations catalog={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Hủy lớp CS201-02' }))
    await userEvent.dblClick(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Đang hủy…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rời hàng chờ Lớp #30' })).toBeDisabled()
    finish(new Response(null, { status: 204 }))
    expect(await screen.findByText('Đã hủy lớp CS201-02.')).toBeVisible()
  })
  it('hiển thị lớp đã đăng ký kèm lịch và hàng chờ kèm vị trí', async () => {
    mockApi(path => path.endsWith('/registrations') ? json([registration]) : json([entry]))
    render(<MyRegistrations catalog={() => {}} />)
    expect(await screen.findByRole('heading', { name: 'CS201-02 — Data Structures and Algorithms' })).toBeVisible()
    expect(screen.getByText('Thứ 4 · Tiết 4–6')).toBeVisible()
    expect(screen.getByText(/Vị trí 2/)).toBeVisible()
    expect(screen.getByText('Lớp #30')).toBeVisible()
  })
  it('hủy môn phải xác nhận, gửi DELETE rồi tải lại danh sách', async () => {
    let dropped = false
    const fetch = mockApi((path, options) => {
      if (options?.method === 'DELETE') { dropped = true; return new Response(null, { status: 204 }) }
      if (path.endsWith('/registrations')) return json(dropped ? [] : [registration])
      return json([])
    })
    render(<MyRegistrations catalog={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Hủy lớp CS201-02' }))
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    expect(await screen.findByText('Đã hủy lớp CS201-02.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/registrations/7', expect.objectContaining({ method: 'DELETE', credentials: 'include' }))
    expect(await screen.findByText('Bạn chưa đăng ký lớp nào trong học kỳ này.')).toBeVisible()
  })
  it('bấm "Không hủy" thì không gửi yêu cầu', async () => {
    const fetch = mockApi(path => path.endsWith('/registrations') ? json([registration]) : json([]))
    render(<MyRegistrations catalog={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Hủy lớp CS201-02' }))
    await userEvent.click(screen.getByRole('button', { name: 'Không hủy' }))
    expect(screen.getByRole('button', { name: 'Hủy lớp CS201-02' })).toBeVisible()
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
  })
  it('rời hàng chờ và báo lỗi khi máy chủ từ chối', async () => {
    let fail = true
    const fetch = mockApi((path, options) => {
      if (options?.method === 'DELETE') {
        if (fail) return json({ code: 'FORBIDDEN', message: 'Not your entry.' }, 403)
        return new Response(null, { status: 204 })
      }
      return path.endsWith('/registrations') ? json([]) : json([{ ...entry, section: { ...course.sections[0], code: 'EN101-01' } }])
    })
    render(<MyRegistrations catalog={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Rời hàng chờ EN101-01' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn không có quyền')
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Rời hàng chờ EN101-01' }))
    expect(await screen.findByText('Đã rời hàng chờ EN101-01.')).toBeVisible()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/waitlist/9', expect.objectContaining({ method: 'DELETE' })))
  })
  it('chưa có lớp nào thì có lối tới danh mục', async () => {
    mockApi(() => json([]))
    const catalog = vi.fn()
    render(<MyRegistrations catalog={catalog} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tìm môn học' }))
    expect(catalog).toHaveBeenCalledOnce()
    expect(screen.getByText('Bạn không ở trong hàng chờ nào.')).toBeVisible()
  })
})
