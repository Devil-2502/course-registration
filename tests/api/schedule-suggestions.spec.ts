import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsAdmin, loginAsStudent } from './helpers/auth';
import { clearStudent, courseId, enroll, fillSection, resetDatabase, setCapacity } from './helpers/db';

// Cải tiến 1: POST /schedule-suggestions trên dữ liệu mẫu.
// std_402 đã đạt CS101 và đang học MA101-01 (thứ Hai tiết 1-3).
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

const suggest = async (codes: string[], preferences: Record<string, unknown> = {}) =>
  student.post('/api/v1/schedule-suggestions', {
    data: { courseIds: await Promise.all(codes.map(courseId)), preferences },
  });

const sectionCodes = (suggestion: { sections: { sectionCode: string }[] }) =>
  suggestion.sections.map((section) => section.sectionCode);

test('Bỏ lớp trùng lịch với lớp đang học, giữ MA101-01 trong mọi phương án', async () => {
  const response = await suggest(['CS201', 'PE101']);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.enrolled.map((s: { sectionCode: string }) => s.sectionCode)).toEqual(['MA101-01']);
  expect(body.totalCombinations).toBe(2);
  const all = body.suggestions.flatMap(sectionCodes);
  expect(all).not.toContain('CS201-01'); // thứ Hai tiết 2-4, trùng MA101-01
  expect(all).toEqual(expect.arrayContaining(['CS201-02', 'CS201-03', 'PE101-01']));
});

test('Dồn lịch: phương án đầu là CS201-02 học cùng thứ Hai với MA101-01', async () => {
  const body = await (await suggest(['CS201'], { compactDays: true })).json();
  expect(sectionCodes(body.suggestions[0])).toEqual(['CS201-02']);
  expect(body.suggestions[0].metrics.studyDays).toBe(1);
});

test('Muốn nghỉ thứ Ba: CS101-02 (thứ Sáu) lên đầu thay cho CS101-01 (thứ Ba)', async () => {
  // std_500 chưa học gì, chưa đăng ký lớp nào: CS101 không cần tiên quyết.
  const fresh = await loginAsStudent('std_500');
  await clearStudent('std_500');
  const ids = [await courseId('CS101')];
  const plain = await (await fresh.post('/api/v1/schedule-suggestions', { data: { courseIds: ids } })).json();
  expect(plain.suggestions.map(sectionCodes)).toEqual([['CS101-01'], ['CS101-02']]);
  const freeTuesday = await (
    await fresh.post('/api/v1/schedule-suggestions', { data: { courseIds: ids, preferences: { freeDays: [2] } } })
  ).json();
  expect(freeTuesday.suggestions.map(sectionCodes)).toEqual([['CS101-02'], ['CS101-01']]);
  expect(freeTuesday.suggestions[1].metrics.busyFreeDays).toEqual([2]);
  await fresh.dispose();
});

test('Ghi lý do loại từng môn', async () => {
  await fillSection('PE101-01', 40);
  await setCapacity('PE101-01', 40); // lớp đầy
  const body = await (await suggest(['CS101', 'CS301', 'PE101', 'MA101'])).json();
  expect(body.courses.map((c: { course: { code: string }; status: string }) => [c.course.code, c.status])).toEqual([
    ['CS101', 'COURSE_ALREADY_PASSED'],
    ['CS301', 'PREREQUISITE_NOT_MET'],
    ['PE101', 'NO_AVAILABLE_SECTION'],
    ['MA101', 'ALREADY_ENROLLED'],
  ]);
  expect(body.suggestions).toEqual([]);
});

test('Body sai: 400 VALIDATION_ERROR', async () => {
  const response = await student.post('/api/v1/schedule-suggestions', { data: { courseIds: [] } });
  expect(response.status()).toBe(400);
  expect((await response.json()).code).toBe('VALIDATION_ERROR');
});

test('Quản trị viên không dùng được: 403', async () => {
  const admin = await loginAsAdmin();
  const response = await admin.post('/api/v1/schedule-suggestions', { data: { courseIds: [1] } });
  expect(response.status()).toBe(403);
  await admin.dispose();
});
