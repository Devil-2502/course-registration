import { afterEach, expect, it, vi } from 'vitest';
import { apiFetch, jsonBody } from '../src/api/client';

afterEach(() => vi.unstubAllEnvs());

it('gửi body JSON và cookie qua đường dẫn cùng nguồn', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":7}', { status: 201 }));
  await expect(apiFetch('/registrations', { method: 'POST', body: jsonBody({ sectionId: 22 }) })).resolves.toEqual({ id: 7 });
  expect(fetch).toHaveBeenCalledWith('/api/v1/registrations', expect.objectContaining({
    credentials: 'include', method: 'POST', body: '{"sectionId":22}',
  }));
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Content-Type')).toBe('application/json');
});

it.each([
  new Headers({ 'X-Request-ID': 'request-1', 'Content-Type': 'application/custom+json' }),
  [['X-Request-ID', 'request-1'], ['Content-Type', 'application/custom+json']] as [string, string][],
])('giữ header do nơi gọi truyền vào qua các dạng RequestInit', async (headers) => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  await apiFetch('/registrations', { method: 'POST', body: '{}', headers });
  const sent = new Headers(fetch.mock.calls[0][1]?.headers);
  expect(sent.get('X-Request-ID')).toBe('request-1');
  expect(sent.get('Content-Type')).toBe('application/custom+json');
});

it('không đọc JSON khi phản hồi là 204', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
});

it('giữ mã lỗi và chi tiết nghiệp vụ từ backend', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    code: 'PREREQUISITE_NOT_MET', message: 'Missing courses', details: { missingCourses: [{ code: 'CS101' }] },
  }), { status: 422 }));
  await expect(apiFetch('/registrations')).rejects.toMatchObject({
    status: 422, code: 'PREREQUISITE_NOT_MET', details: { missingCourses: [{ code: 'CS101' }] },
  });
});

it('đổi lỗi kết nối thành lỗi có mã NETWORK_ERROR', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
});

it('xử lý lỗi HTTP khi proxy trả về nội dung không phải JSON', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<h1>Bad gateway</h1>', { status: 502, statusText: 'Bad Gateway' }));
  await expect(apiFetch('/courses')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN', message: 'Bad Gateway' });
});

it('cho phép đổi địa chỉ API và bỏ dấu gạch chéo cuối', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1/');
  vi.resetModules();
  const { apiFetch: customFetch } = await import('../src/api/client');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  await customFetch('/auth/me');
  expect(fetch).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/me', expect.objectContaining({ credentials: 'include' }));
});
