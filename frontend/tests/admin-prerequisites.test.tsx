import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import AdminPrerequisites from '../src/admin/AdminPrerequisites'
import { json, mockApi } from './fixtures'

const cs101 = { id: 1, code: 'CS101', name: 'Introduction to Programming', credits: 4 }
const cs201 = { id: 2, code: 'CS201', name: 'Data Structures and Algorithms', credits: 4 }
const cs301 = { id: 3, code: 'CS301', name: 'Design and Analysis of Algorithms', credits: 4 }
const catalog = { items: [cs101, cs201, cs301], page: 1, pageSize: 100, total: 3 }

describe('US-13: Quản lý môn tiên quyết (UI-10)', () => {
  it('lấy đủ các trang để chọn môn ngoài 100 kết quả đầu', async () => {
    const fetch = mockApi(path => {
      if (path.includes('/prerequisites')) return json([])
      const second = new URL(path, 'http://localhost').searchParams.get('page') === '2'
      return json({ items: second ? [cs301] : [cs101, cs201], page: second ? 2 : 1, pageSize: 100, total: 101 })
    })
    render(<AdminPrerequisites course={cs101} back={() => {}} />)
    expect(await screen.findByRole('option', { name: 'CS301 — Design and Analysis of Algorithms' })).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/courses?q=&page=2&pageSize=100', expect.anything())
  })
  it('liệt kê tiên quyết, không cho chọn chính môn đó hay môn đã có', async () => {
    mockApi(path => path.includes('/prerequisites') ? json([cs101]) : json(catalog))
    render(<AdminPrerequisites course={cs201} back={() => {}} />)
    expect(await screen.findByText('CS101')).toBeVisible()
    const options = screen.getAllByRole('option').map(option => option.textContent)
    expect(options).toEqual(['-- Chọn môn --', 'CS301 — Design and Analysis of Algorithms'])
  })
  it('thêm tiên quyết gửi prerequisiteId', async () => {
    let added = false
    const fetch = mockApi((path, options) => {
      if (options?.method === 'POST') { added = true; return json([cs101, cs301], 201) }
      return path.includes('/prerequisites') ? json(added ? [cs101, cs301] : [cs101]) : json(catalog)
    })
    render(<AdminPrerequisites course={cs201} back={() => {}} />)
    await userEvent.selectOptions(await screen.findByLabelText('Thêm môn tiên quyết'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(await screen.findByText('Đã thêm CS301 làm môn tiên quyết.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/courses/2/prerequisites', expect.objectContaining({ method: 'POST', body: '{"prerequisiteId":3}' }))
  })
  it('máy chủ từ chối vì tạo vòng lặp thì báo lý do', async () => {
    mockApi((path, options) => options?.method === 'POST' ?
      json({ code: 'PREREQUISITE_CYCLE', message: 'This prerequisite would create a cycle.' }, 409) :
      path.includes('/prerequisites') ? json([]) : json(catalog))
    render(<AdminPrerequisites course={cs101} back={() => {}} />)
    await userEvent.selectOptions(await screen.findByLabelText('Thêm môn tiên quyết'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('tạo vòng lặp môn tiên quyết')
  })
  it('gỡ tiên quyết gửi DELETE', async () => {
    const fetch = mockApi((path, options) => options?.method === 'DELETE' ? new Response(null, { status: 204 }) :
      path.includes('/prerequisites') ? json([cs101]) : json(catalog))
    render(<AdminPrerequisites course={cs201} back={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Gỡ CS101' }))
    expect(await screen.findByText('Đã gỡ CS101.')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/courses/2/prerequisites/1', expect.objectContaining({ method: 'DELETE' }))
  })
})
