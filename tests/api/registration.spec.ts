import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { clearStudent, enroll, fillSection, query, resetDatabase, sectionId, setRegistrationOpen } from './helpers/db';

// US-04: cần POST /registrations của M2.
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
  await setRegistrationOpen(true);
});

test('Successful registration: 201, ENROLLED, lớp còn 4 chỗ', async () => {
  await fillSection('CS201-01', 35); // còn 5 chỗ
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-01') } });
  expect(response.status()).toBe(201);
  const registration = await response.json();
  expect(registration.status).toBe('ENROLLED');
  expect(registration.section.remainingSeats).toBe(4);
});

test('Already enrolled in another section of the same course: 409 ALREADY_ENROLLED', async () => {
  await enroll('std_402', 'CS201-01');
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-02') } });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('ALREADY_ENROLLED');
});

// Backend trả 403 REGISTRATION_CLOSED, đúng như Gherkin.
test('Registration period is closed: 403 REGISTRATION_CLOSED', async () => {
  await setRegistrationOpen(false);
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-01') } });
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe('REGISTRATION_CLOSED');
});

test('Sau khi đăng ký, enrolled_count khớp số dòng ENROLLED', async () => {
  await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS201-02') } });
  const [row] = await query<{ enrolled_count: number; actual: string }>(
    `SELECT s.enrolled_count,
            (SELECT count(*) FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ENROLLED') AS actual
     FROM sections s WHERE s.code = 'CS201-02'`,
  );
  expect(row.enrolled_count).toBe(Number(row.actual));
});
