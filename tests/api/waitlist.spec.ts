import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsAdmin, loginAsStudent } from './helpers/auth';
import { clearStudent, resetDatabase, sectionId } from './helpers/db';

// US-09: POST/DELETE /waitlist.
// Dữ liệu mẫu: EN101-01 đầy 30/30, hàng chờ std_610 (1), std_611 (2), std_170 (3). CS201-02 còn chỗ.
let student: APIRequestContext;

test.beforeAll(async () => {
  await resetDatabase();
  student = await loginAsStudent('std_402');
});
test.afterAll(async () => {
  await student.dispose();
});

test('Join the waitlist: 201, WAITING, vị trí thứ 4', async () => {
  await clearStudent('std_402');
  const response = await student.post('/api/v1/waitlist', { data: { sectionId: await sectionId('EN101-01') } });
  expect(response.status()).toBe(201);
  const entry = await response.json();
  expect(entry.status).toBe('WAITING');
  expect(entry.position).toBe(4);
});

test('Join the same waitlist twice: 409 ALREADY_ON_WAITLIST', async () => {
  const response = await student.post('/api/v1/waitlist', { data: { sectionId: await sectionId('EN101-01') } });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('ALREADY_ON_WAITLIST');
});

test('Section still has seats: 409 SECTION_NOT_FULL', async () => {
  const response = await student.post('/api/v1/waitlist', { data: { sectionId: await sectionId('CS201-02') } });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('SECTION_NOT_FULL');
});

test('Leave the waitlist: 204, người phía sau lên một bậc', async () => {
  await resetDatabase();
  const first = await loginAsStudent('std_610');
  const mine = await (await first.get('/api/v1/waitlist')).json();
  const response = await first.delete(`/api/v1/waitlist/${mine[0].id}`);
  expect(response.status()).toBe(204);

  const admin = await loginAsAdmin();
  const queue = await (await admin.get(`/api/v1/sections/${await sectionId('EN101-01')}/waitlist`)).json();
  const waiting = queue.filter((w: { status: string }) => w.status === 'WAITING');
  expect(waiting.map((w: { studentCode: string }) => w.studentCode)).toEqual(['std_611', 'std_170']);
  expect(waiting[0].position).toBe(1);
  await first.dispose();
  await admin.dispose();
});
