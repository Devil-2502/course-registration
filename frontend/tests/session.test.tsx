import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { ApiError, request } from '../src/api'
import { json, mockApi, schedule } from './fixtures'

const user = { id: 1, email: 'student@example.edu', fullName: 'Nguyễn Thiên Trí', role: 'STUDENT' }
describe('Phiên đăng nhập và API', () => {
  it('đăng nhập bằng cookie, điều hướng và đăng xuất', async () => {
    const fetch = mockApi(path => {
      if (path.endsWith('/auth/me')) return json({ code: 'UNAUTHENTICATED', message: 'Sign in' }, 401)
      if (path.endsWith('/auth/login')) return json(user)
      if (path.endsWith('/auth/logout')) return new Response(null, { status: 204 })
      if (path.endsWith('/schedule')) return json(schedule)
      return json({ items: [], page: 1, pageSize: 20, total: 0 })
    })
    render(<App />)
    const controls = userEvent.setup()
    await controls.type(await screen.findByLabelText('Email trường'), user.email)
    await controls.type(screen.getByLabelText('Mật khẩu'), 'password')
    await controls.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByText(user.fullName)).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ credentials: 'include', method: 'POST' }))
    await controls.click(screen.getByRole('button', { name: 'Thời khóa biểu tuần' }))
    expect(await screen.findByRole('table')).toBeVisible()
    await controls.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    expect(await screen.findByRole('heading', { name: 'Đăng nhập sinh viên' })).toBeVisible()
  })
  it('phiên hết hạn khi tải môn thì quay về đăng nhập', async () => {
    mockApi(path => path.endsWith('/auth/me') ? json(user) : json({ code: 'UNAUTHENTICATED', message: 'Expired' }, 401))
    render(<App />)
    expect(await screen.findByLabelText('Email trường')).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it('không hiển thị cổng sinh viên cho quản trị', async () => {
    mockApi(() => json({ ...user, role: 'ADMIN' }))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('dành cho sinh viên')
  })
  it('phản hồi không phải JSON vẫn cho thông báo lỗi HTTP', async () => {
    mockApi(() => new Response('Bad gateway', { status: 502 }))
    await expect(request('/courses')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' })
  })
  it('giữ mã lỗi và chi tiết nghiệp vụ của máy chủ', async () => {
    mockApi(() => json({ code: 'CREDIT_LIMIT_EXCEEDED', message: 'Vượt tín chỉ', details: { currentCredits: 22, limit: 24 } }, 422))
    try { await request('/registrations') } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 422, details: { currentCredits: 22, limit: 24 } })
    }
  })
})
