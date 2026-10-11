import { test, expect } from '@playwright/test';

test('GET /api/v1/health returns 200', async ({ request }) => {
  const response = await request.get('/api/v1/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
