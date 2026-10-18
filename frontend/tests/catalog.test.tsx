import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Catalog from '../src/Catalog'
import { course, json, mockApi } from './fixtures'

describe('US-02: Danh mục môn học', () => {
  it('tìm theo từ khóa, phân trang 20 môn và mở chi tiết', async () => {
    const fetch = mockApi(path => {
      const page = Number(new URL(path, 'http://localhost').searchParams.get('page'))
      return json({ items: [course], page, pageSize: 20, total: 45 })
    })
    const open = vi.fn()
    render(<Catalog openCourse={open} />)
    expect(await screen.findByText(course.name)).toBeVisible()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/v1/courses?q=&page=2&pageSize=20', expect.objectContaining({ credentials: 'include' })))
    await user.type(screen.getByLabelText('Mã hoặc tên môn học'), 'data')
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/v1/courses?q=data&page=1&pageSize=20', expect.anything()))
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết CS201' }))
    expect(open).toHaveBeenCalledWith(2)
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()
  })
  it('hiển thị kết quả rỗng', async () => {
    mockApi(() => json({ items: [], page: 1, pageSize: 20, total: 0 }))
    render(<Catalog openCourse={() => {}} />)
    expect(await screen.findByText(/No courses found/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  })
  it('báo lỗi kết nối và tải lại', async () => {
    let failed = true
    mockApi(() => { if (failed) throw new Error('Mất kết nối'); return json({ items: [course], page: 1, pageSize: 20, total: 1 }) })
    render(<Catalog openCourse={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối')
    failed = false
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText(course.name)).toBeVisible()
  })
})
