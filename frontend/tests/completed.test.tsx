import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CompletedCourses from '../src/CompletedCourses'
import { json, mockApi } from './fixtures'

describe('UI-08: Kết quả học tập', () => {
  it('liệt kê môn đã học, điểm và trạng thái đạt', async () => {
    mockApi(() => json([
      { course: { id: 1, code: 'CS101', name: 'Introduction to Programming', credits: 4 }, semesterCode: '2025-2', grade: 8, passed: true },
      { course: { id: 13, code: 'MA101', name: 'Calculus 1', credits: 3 }, semesterCode: '2025-2', grade: 4, passed: false },
    ]))
    render(<CompletedCourses />)
    const rows = within(await screen.findByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('CS101')
    expect(rows[1]).toHaveTextContent('Đã đạt (Passed)')
    expect(rows[2]).toHaveTextContent('Chưa đạt')
  })
  it('chưa có kết quả nào', async () => {
    mockApi(() => json([]))
    render(<CompletedCourses />)
    expect(await screen.findByText('Chưa có kết quả học tập nào.')).toBeVisible()
  })
})
