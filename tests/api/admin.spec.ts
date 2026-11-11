import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsAdmin, loginAsStudent } from './helpers/auth';
import { courseId, fillSection, query, resetDatabase, sectionId, semesterId } from './helpers/db';

// US-12: Manage Courses and Sections, US-13: Manage Prerequisite Relationships
let admin: APIRequestContext;

test.beforeAll(async () => {
  await resetDatabase();
  admin = await loginAsAdmin();
});
test.afterAll(async () => {
  await admin.dispose();
});

test('Create a course: 201', async () => {
  const response = await admin.post('/api/v1/courses', {
    data: { code: 'CS401', name: 'Machine Learning', credits: 3 },
  });
  expect(response.status()).toBe(201);
  const course = await response.json();
  expect(course).toMatchObject({ code: 'CS401', name: 'Machine Learning', credits: 3 });
});

test('Duplicate course code: 409 COURSE_CODE_EXISTS', async () => {
  const response = await admin.post('/api/v1/courses', {
    data: { code: 'CS201', name: 'Duplicate', credits: 4 },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('COURSE_CODE_EXISTS');
});

test('Create a section with a schedule: 201', async () => {
  const response = await admin.post('/api/v1/sections', {
    data: {
      courseId: await courseId('CS201'),
      semesterId: await semesterId('2026-1'),
      code: 'CS201-04',
      capacity: 40,
      slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' }],
    },
  });
  expect(response.status()).toBe(201);
  const section = await response.json();
  expect(section.capacity).toBe(40);
  expect(section.remainingSeats).toBe(40);
  expect(section.slots).toEqual([{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' }]);
});

// “kiểm tra lại qua GET /courses/{id}”
test('Create a section with a schedule: lớp mới hiện trong chi tiết môn CS201', async () => {
  await admin.post('/api/v1/sections', {
    data: {
      courseId: await courseId('CS201'), semesterId: await semesterId('2026-1'),
      code: 'CS201-VIEW', capacity: 40,
      slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' }],
    },
  });
  const detail = await (await admin.get(`/api/v1/courses/${await courseId('CS201')}`)).json();
  expect(detail.sections.map((s: { code: string }) => s.code)).toContain('CS201-VIEW');
});

test('Reduce capacity below the number of enrolled students: 409 CAPACITY_BELOW_ENROLLED', async () => {
  await fillSection('CS201-01', 35);
  const response = await admin.put(`/api/v1/sections/${await sectionId('CS201-01')}`, {
    data: {
      courseId: await courseId('CS201'),
      semesterId: await semesterId('2026-1'),
      code: 'CS201-01',
      capacity: 30,
      slots: [{ dayOfWeek: 1, startPeriod: 2, endPeriod: 4 }],
    },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('CAPACITY_BELOW_ENROLLED');
  await fillSection('CS201-01', 0);
});

test('A student calls an admin endpoint: 403', async () => {
  const student = await loginAsStudent('std_402');
  const response = await student.post('/api/v1/courses', { data: { code: 'CS999', name: 'X', credits: 3 } });
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe('FORBIDDEN');
  await student.dispose();
});

test('Danh sách lớp và hàng chờ của EN101-01 (admin)', async () => {
  const id = await sectionId('EN101-01');
  const enrolments = await (await admin.get(`/api/v1/sections/${id}/enrolments`)).json();
  expect(enrolments).toHaveLength(30);
  const waitlist = await (await admin.get(`/api/v1/sections/${id}/waitlist`)).json();
  expect(waitlist.map((w: { studentCode: string }) => w.studentCode)).toEqual(['std_610', 'std_611', 'std_170']);
  expect(waitlist.map((w: { position: number }) => w.position)).toEqual([1, 2, 3]);
});

// ---------- US-13: các API tiên quyết  ----------

test('Add a prerequisite: 201', async () => {
  // Seed đã có CS301 cần CS201, gỡ trước để thêm lại
  await query('DELETE FROM prerequisites WHERE course_id = $1 AND prerequisite_id = $2', [
    await courseId('CS301'),
    await courseId('CS201'),
  ]);
  const response = await admin.post(`/api/v1/courses/${await courseId('CS301')}/prerequisites`, {
    data: { prerequisiteId: await courseId('CS201') },
  });
  expect(response.status()).toBe(201);
  const list = await response.json();
  expect(list.map((c: { code: string }) => c.code)).toContain('CS201');
});

test('Reject a relationship that creates a cycle: 409 PREREQUISITE_CYCLE', async () => {
  const response = await admin.post(`/api/v1/courses/${await courseId('CS101')}/prerequisites`, {
    data: { prerequisiteId: await courseId('CS301') },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('PREREQUISITE_CYCLE');
});

test('A course cannot require itself: 409 PREREQUISITE_CYCLE', async () => {
  const id = await courseId('CS201');
  const response = await admin.post(`/api/v1/courses/${id}/prerequisites`, { data: { prerequisiteId: id } });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe('PREREQUISITE_CYCLE');
});

test('Remove a prerequisite: 204', async () => {
  const response = await admin.delete(
    `/api/v1/courses/${await courseId('CS301')}/prerequisites/${await courseId('CS201')}`,
  );
  expect(response.status()).toBe(204);
});
