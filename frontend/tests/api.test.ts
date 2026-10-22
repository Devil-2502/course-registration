import { expect, it, vi } from 'vitest'
import { post, remove, request } from '../src/api'

it.each([
  new Headers({ 'X-Request-ID': 'request-1', 'Content-Type': 'application/custom+json' }),
  [['X-Request-ID', 'request-1'], ['Content-Type', 'application/custom+json']] as [string, string][],
])('giữ header của nơi gọi khi truyền qua RequestInit', async headers => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
  await request('/registrations', { method: 'POST', body: '{}', headers })
  const sent = new Headers(fetch.mock.calls[0][1]?.headers)
  expect(sent.get('X-Request-ID')).toBe('request-1')
  expect(sent.get('Content-Type')).toBe('application/custom+json')
})

it('post gửi JSON, remove gửi DELETE cùng cookie và chấp nhận phản hồi 204', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 204 }))
  await post('/waitlist', { sectionId: 6 })
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Content-Type')).toBe('application/json')
  await expect(remove('/waitlist/9')).resolves.toBeUndefined()
  expect(fetch).toHaveBeenLastCalledWith('/api/v1/waitlist/9', expect.objectContaining({ method: 'DELETE', credentials: 'include' }))
})
