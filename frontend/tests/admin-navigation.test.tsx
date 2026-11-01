import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Admin from '../src/admin/Admin'
import { course, json, mockApi } from './fixtures'

const page = { items: [{ id: 2, code: 'CS201', name: course.name, credits: 4 }], page: 1, pageSize: 100, total: 1 }
const semester = { id: 1, code: '2026-1', name: 'Học kỳ 1', registrationStart: '', registrationEnd: '', maxCredits: 24 }

describe('Điều hướng khu quản trị', () => {
  it('đi từ môn học sang lớp học phần, danh sách lớp rồi quay lại', async () => {
    mockApi(path => {
      if (path.startsWith('/api/v1/courses?')) return json(page)
      if (path.endsWith('/prerequisites')) return json([])
      if (path.includes('/semesters/current')) return json(semester)
      if (path.includes('/sections/')) return json([])
      return json(course)
    })
    render(<Admin />)
    const controls = userEvent.setup()
    await controls.click(await screen.findByRole('button', { name: 'Lớp học phần CS201' }))
    await controls.click(await screen.findByRole('button', { name: 'Danh sách CS201-01' }))
    expect(await screen.findByRole('heading', { name: 'Danh sách lớp CS201-01' })).toBeVisible()
    await controls.click(screen.getByRole('button', { name: '← Lớp học phần' }))
    await controls.click(await screen.findByRole('button', { name: '← Quản lý môn học' }))
    await controls.click(await screen.findByRole('button', { name: 'Tiên quyết CS201' }))
    expect(await screen.findByRole('heading', { name: /Môn tiên quyết của CS201/ })).toBeVisible()
  })
})
