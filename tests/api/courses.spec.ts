import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { courseId, query, resetDatabase } from './helpers/db';

// US-02, US-03: GET /courses và GET /courses/{id}.
let student: APIRequestContext;

test.beforeAll(async () => {
  await resetDatabase();
  student = await loginAsStudent('std_402');
});
test.afterAll(async () => {
  await student.dispose();
});

test('Search by keyword: "data" tìm ra CS201', async () => {
  const response = await student.get('/api/v1/courses?q=data');
  expect(response.status()).toBe(200);
  const body = await response.json();
  const cs201 = body.items.find((c: { code: string }) => c.code === 'CS201');
  expect(cs201).toMatchObject({ name: 'Data Structures and Algorithms', credits: 4 });
});

test('Search with no matching course: danh sách rỗng', async () => {
  const response = await student.get('/api/v1/courses?q=zzzz');
  expect(response.status()).toBe(200);
  expect((await response.json()).items).toEqual([]);
});

// Gherkin dùng 45 môn; dữ liệu mẫu có 20 môn nên kiểm tra theo tổng thật trong CSDL.
test('Paginated catalog: trang 2, mỗi trang 10 môn', async () => {
  const [{ total }] = await query<{ total: string }>('SELECT count(*) AS total FROM courses');
  const body = await (await student.get('/api/v1/courses?page=2&pageSize=10')).json();
  expect(body.page).toBe(2);
  expect(body.pageSize).toBe(10);
  expect(body.total).toBe(Number(total));
  expect(body.items).toHaveLength(Math.min(10, Number(total) - 10));
});

test('View course details: CS201 có tiên quyết CS101 và các lớp kèm lịch, số chỗ', async () => {
  const response = await student.get(`/api/v1/courses/${await courseId('CS201')}`);
  expect(response.status()).toBe(200);
  const detail = await response.json();
  expect(detail.prerequisites.map((p: { code: string }) => p.code)).toEqual(['CS101']);
  expect(detail.sections.length).toBeGreaterThanOrEqual(2);
  for (const section of detail.sections) {
    expect(section.slots.length).toBeGreaterThan(0);
    expect(section).toHaveProperty('capacity');
    expect(section).toHaveProperty('remainingSeats');
  }
});

test('Prerequisite status for the signed-in student: std_402 đã đạt CS101', async () => {
  const detail = await (await student.get(`/api/v1/courses/${await courseId('CS201')}`)).json();
  expect(detail.prerequisites[0]).toMatchObject({ code: 'CS101', passed: true });
});

test('Course does not exist: 404', async () => {
  expect((await student.get('/api/v1/courses/999999')).status()).toBe(404);
});
