import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { json, mockApi } from './fixtures'

const student = { id: 1, email: 'std_402@student.edu.vn', fullName: 'Nguyễn Văn An', role: 'STUDENT' }

describe('Điều hướng các trang của sinh viên', () => {
  it('mở trang môn đã đăng ký và kết quả học tập từ thanh điều hướng', async () => {
    mockApi(path => path.endsWith('/auth/me') ? json(student) : path.includes('/courses') ?
      json({ items: [], page: 1, pageSize: 20, total: 0 }) : json([]))
    render(<App />)
    const controls = userEvent.setup()
    await controls.click(await screen.findByRole('button', { name: 'Môn đã đăng ký' }))
    expect(await screen.findByRole('heading', { name: 'Môn đã đăng ký' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Môn đã đăng ký' })).toHaveAttribute('aria-current', 'page')
    await controls.click(screen.getByRole('button', { name: 'Kết quả học tập' }))
    expect(await screen.findByRole('heading', { name: 'Kết quả học tập' })).toBeVisible()
    await controls.click(screen.getByRole('button', { name: 'Danh mục môn học' }))
    expect(await screen.findByRole('heading', { name: 'Tìm kiếm môn học' })).toBeVisible()
  })
})
