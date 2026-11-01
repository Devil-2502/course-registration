import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { clearStudent, enroll, passCourse, resetDatabase, sectionId } from './helpers/db';

// US-07: cần POST /registrations của M2 (dùng hàm checkCreditLimit của M3).
// Lớp đích CS301-01 (4 tín chỉ, thứ Năm 1-3); các lớp dựng sẵn không trùng lịch với nó.
let student: APIRequestContext;

test.beforeAll(async () => {
  await resetDatabase();
  await passCourse('std_402', 'CS201'); // CS301-01 cần CS201
  student = await loginAsStudent('std_402');
});
test.afterAll(async () => {
  await student.dispose();
});
test.beforeEach(async () => {
  await clearStudent('std_402');
});

test.fixme('Exceeding the credit limit: đang có 22, thêm 4 thì 422 CREDIT_LIMIT_EXCEEDED', async () => {
  // 4 + 4 + 4 + 4 + 3 + 3 = 22 tín chỉ
  await enroll('std_402', 'CS201-02', 'CS101-01', 'CS202-01', 'CS230-01', 'MA101-01', 'MA201-01');
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS301-01') } });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.code).toBe('CREDIT_LIMIT_EXCEEDED');
  expect(body.details).toMatchObject({ currentCredits: 22, limit: 24 });
});

test.fixme('Reaching exactly the credit limit: đang có 20, thêm 4 thì 201', async () => {
  // 4 x 5 = 20 tín chỉ
  await enroll('std_402', 'CS201-02', 'CS101-01', 'CS202-01', 'CS230-01', 'CS310-01');
  const response = await student.post('/api/v1/registrations', { data: { sectionId: await sectionId('CS301-01') } });
  expect(response.status()).toBe(201);
  const schedule = await (await student.get('/api/v1/students/me/schedule')).json();
  expect(schedule.totalCredits).toBe(24);
});
