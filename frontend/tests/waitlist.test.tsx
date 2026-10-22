import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CourseDetails from '../src/CourseDetails'
import { course, json, mockApi, schedule } from './fixtures'

const full = { valid: false, violations: [{ code: 'SECTION_FULL', message: 'Section is full.' }] }

describe('US-09: Vào hàng chờ khi lớp đầy', () => {
  it('lớp đầy thì hiện nút vào hàng chờ, gửi đúng sectionId và báo vị trí', async () => {
    const fetch = mockApi((path, options) => {
      if (path.includes('/courses/')) return json(course)
      if (path.includes('/schedule')) return json(schedule)
      if (path.endsWith('/validate')) return json(full)
      if (path.endsWith('/waitlist') && options?.method === 'POST') {
        return json({ id: 9, studentId: 1, sectionId: 21, position: 4, status: 'WAITING', createdAt: '2026-10-18T00:00:00Z' }, 201)
      }
      throw new Error(`Unexpected path ${path}`)
    })
    render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-01' }))
    expect(screen.getByRole('button', { name: 'Xác nhận đăng ký' })).toBeDisabled()
    await userEvent.click(await screen.findByRole('button', { name: 'Vào hàng chờ CS201-01' }))
    expect(await screen.findByText('Đã vào hàng chờ lớp CS201-01, vị trí 4.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/waitlist', expect.objectContaining({ method: 'POST', body: '{"sectionId":21}' }))
    expect(screen.queryByRole('button', { name: 'Vào hàng chờ CS201-01' })).not.toBeInTheDocument()
  })
  it('không hiện nút vào hàng chờ khi lớp còn chỗ', async () => {
    mockApi(path => path.includes('/courses/') ? json(course) : path.includes('/schedule') ? json(schedule) : json({ valid: true, violations: [] }))
    render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-02' }))
    expect(await screen.findByRole('button', { name: 'Xác nhận đăng ký' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Vào hàng chờ/ })).not.toBeInTheDocument()
  })
  it('báo lỗi tiếng Việt khi đã ở trong hàng chờ', async () => {
    mockApi((path, options) => {
      if (path.includes('/courses/')) return json(course)
      if (path.includes('/schedule')) return json(schedule)
      if (path.endsWith('/validate')) return json(full)
      if (options?.method === 'POST') return json({ code: 'ALREADY_ON_WAITLIST', message: 'Already on the waitlist.' }, 409)
      throw new Error(`Unexpected path ${path}`)
    })
    render(<CourseDetails id={2} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước CS201-01' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Vào hàng chờ CS201-01' }))
    expect(await screen.findByText('Bạn đã ở trong hàng chờ của lớp này.')).toBeVisible()
  })
})
