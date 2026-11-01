import { expect, request, test } from '@playwright/test';
import { API_URL } from '../env';
import { PASSWORD, studentEmail } from './helpers/accounts';
import { loginAsStudent } from './helpers/auth';
import { resetDatabase } from './helpers/db';

// US-01: Student Login
test.beforeAll(async () => {
  await resetDatabase();
});

test('Successful login: 200, có cookie phiên, role STUDENT', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { email: studentEmail('std_402'), password: PASSWORD },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['set-cookie']).toContain('sid=');
  expect(response.headers()['set-cookie']).toContain('HttpOnly');
  const body = await response.json();
  expect(body.role).toBe('STUDENT');
  expect(body.studentCode).toBe('std_402');
  expect(body).not.toHaveProperty('passwordHash');
});

test('Login with a wrong password: 401 INVALID_CREDENTIALS', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { email: studentEmail('std_402'), password: 'wrong-password' },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe('INVALID_CREDENTIALS');
});

test('Email không tồn tại cũng trả INVALID_CREDENTIALS', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { email: 'nobody@student.edu.vn', password: PASSWORD },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe('INVALID_CREDENTIALS');
});

test('Thiếu mật khẩu: 400 VALIDATION_ERROR', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', { data: { email: studentEmail('std_402') } });
  expect(response.status()).toBe(400);
  expect((await response.json()).code).toBe('VALIDATION_ERROR');
});

test('GET /auth/me trả người đang đăng nhập', async () => {
  const student = await loginAsStudent('std_402');
  const response = await student.get('/api/v1/auth/me');
  expect(response.status()).toBe(200);
  expect((await response.json()).email).toBe(studentEmail('std_402'));
  await student.dispose();
});

test('Đăng xuất xong thì phiên hết hiệu lực', async () => {
  const student = await loginAsStudent('std_402');
  expect((await student.post('/api/v1/auth/logout')).status()).toBe(204);
  expect((await student.get('/api/v1/auth/me')).status()).toBe(401);
  await student.dispose();
});

test('Access a protected endpoint without a session: GET /auth/me trả 401', async () => {
  const anonymous = await request.newContext({ baseURL: API_URL });
  const response = await anonymous.get('/api/v1/auth/me');
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe('UNAUTHENTICATED');
  await anonymous.dispose();
});

// Đúng nguyên văn Gherkin: cần GET /registrations của M2. Bỏ fixme khi API đó đã merge.
test.fixme('Access a protected endpoint without a session: GET /registrations trả 401', async () => {
  const anonymous = await request.newContext({ baseURL: API_URL });
  expect((await anonymous.get('/api/v1/registrations')).status()).toBe(401);
  await anonymous.dispose();
});
