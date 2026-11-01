import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { clearStudent, enroll, resetDatabase, sectionId } from './helpers/db';

// US-06: cần POST /registrations của M2.
// Lịch trong dữ liệu mẫu: MA101-01 thứ Hai 1-3, CS201-01 thứ Hai 2-4, CS201-02 thứ Hai 4-6, CS201-03 thứ Ba 1-3.
let student: APIRequestContext;

test.beforeAll(async () => {
  await resetDatabase();
  student = await loginAsStudent('std_402');
});
test.afterAll(async () => {
  await student.dispose();
});
test.beforeEach(async () => {
  await clearStudent('std_402');
  await enroll('std_402', 'MA101-01');
});

test.fixme('Overlapping time slots: 409 SCHEDULE_CLASH, nêu tên MA101-01', async () => {
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-01') } });
  expect(response.status()).toBe(409);
  const body = await response.json();
  expect(body.code).toBe('SCHEDULE_CLASH');
  expect(JSON.stringify(body.details.conflictsWith)).toContain('MA101-01');
});

test.fixme('Adjacent time slots do not clash: CS201-02 đăng ký được', async () => {
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-02') } });
  expect(response.status()).toBe(201);
});

test.fixme('Same periods on different days do not clash: CS201-03 đăng ký được', async () => {
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-03') } });
  expect(response.status()).toBe(201);
});
