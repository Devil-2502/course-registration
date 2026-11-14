import { expect, test } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { clearStudent, passCourse, resetDatabase, sectionId } from './helpers/db';

// US-05: POST /registrations.
test.beforeAll(async () => {
  await resetDatabase();
});

test('Missing prerequisite: std_500 chưa học CS101, 422 PREREQUISITE_NOT_MET', async () => {
  const student = await loginAsStudent('std_500');
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-01') } });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.code).toBe('PREREQUISITE_NOT_MET');
  expect(body.details.missingCourses.map((c: { code: string }) => c.code)).toContain('CS101');
  await student.dispose();
});

test('Failed prerequisite does not count: std_501 được 4.0 môn CS101', async () => {
  const student = await loginAsStudent('std_501');
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-01') } });
  expect(response.status()).toBe(422);
  expect((await response.json()).code).toBe('PREREQUISITE_NOT_MET');
  await student.dispose();
});

test('Multi-level prerequisite chain satisfied: std_402 đăng ký CS301-01', async () => {
  await clearStudent('std_402');
  await passCourse('std_402', 'CS201'); // std_402 đã có CS101 trong dữ liệu mẫu
  const student = await loginAsStudent('std_402');
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS301-01') } });
  expect(response.status()).toBe(201);
  await student.dispose();
});
