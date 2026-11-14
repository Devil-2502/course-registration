import { expect, test } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { resetDatabase } from './helpers/db';

test.beforeAll(async () => {
  await resetDatabase();
});

test('GET /semesters/current trả học kỳ đang mở đăng ký', async () => {
  const student = await loginAsStudent('std_402');
  const response = await student.get('/api/v1/semesters/current');
  expect(response.status()).toBe(200);
  const semester = await response.json();
  expect(semester.code).toBe('2026-1');
  expect(semester.registrationOpen).toBe(true);
  expect(semester.maxCredits).toBe(24);
  await student.dispose();
});

test('GET /semesters liệt kê học kỳ, mới nhất trước', async () => {
  const student = await loginAsStudent('std_402');
  const semesters = await (await student.get('/api/v1/semesters')).json();
  expect(semesters.map((s: { code: string }) => s.code)).toEqual(['2026-1', '2025-2']);
  await student.dispose();
});
