import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Schedule, { Timetable } from '../src/Schedule'
import { course, json, mockApi, schedule } from './fixtures'

describe('US-11: Thời khóa biểu tuần', () => {
  it('đặt lớp đúng thứ, đủ các tiết và hiển thị tổng tín chỉ từ API', async () => {
    mockApi(() => json(schedule))
    render(<Schedule catalog={() => {}} />)
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(16)
    for (const period of [1, 2, 3]) expect(within(rows[period]).getAllByRole('cell')[0]).toHaveTextContent('MA101-01')
    expect(within(rows[4]).getAllByRole('cell')[0]).not.toHaveTextContent('MA101-01')
    for (const period of [4, 5, 6]) expect(within(rows[period]).getAllByRole('cell')[2]).toHaveTextContent('CS201-02')
    expect(screen.getByText('7 / 24')).toBeVisible()
  })
  it('lịch rỗng có lối tới danh mục', async () => {
    mockApi(() => json({ ...schedule, entries: [], totalCredits: 0 }))
    const catalog = vi.fn()
    render(<Schedule catalog={catalog} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tìm môn học' }))
    expect(catalog).toHaveBeenCalledOnce()
    expect(screen.getByRole('table')).toBeVisible()
  })
  it('chỉ tô đỏ phần giao nhau khi API báo trùng lịch', () => {
    const view = render(<Timetable schedule={schedule} preview={{ course, section: course.sections[0] }} conflict />)
    expect(view.container.querySelectorAll('td.clash')).toHaveLength(2)
    view.rerender(<Timetable schedule={schedule} preview={{ course, section: course.sections[0] }} />)
    expect(view.container.querySelectorAll('td.clash')).toHaveLength(0)
  })
})
