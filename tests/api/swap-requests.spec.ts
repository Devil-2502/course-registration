import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAsAdmin, loginAsStudent } from './helpers/auth';
import { clearStudent, enroll, fillSection, query, resetDatabase, sectionId, setCapacity } from './helpers/db';

// Cải tiến 2 (US-15): đổi lớp an toàn qua /swap-requests trên dữ liệu mẫu.
// CS201-01 thứ Hai tiết 2-4 (trùng MA101-01), CS201-02 thứ Hai tiết 4-6, CS201-03 thứ Ba tiết 1-3.
const students = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `std_${from + i}`);

async function membersOf(code: string): Promise<string[]> {
  const rows = await query<{ student_code: string }>(
    `SELECT st.student_code FROM enrolments e JOIN students st ON st.id = e.student_id
     JOIN sections s ON s.id = e.section_id
     WHERE s.code = $1 AND e.status = 'ENROLLED' ORDER BY st.student_code`,
    [code],
  );
  return rows.map((r) => r.student_code);
}

async function countOf(code: string) {
  const [row] = await query<{ enrolled_count: number; actual: number }>(
    `SELECT s.enrolled_count,
       (SELECT count(*)::int FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ENROLLED') AS actual
     FROM sections s WHERE s.code = $1`,
    [code],
  );
  return row;
}

test.beforeAll(async () => {
  await resetDatabase();
});
test.beforeEach(async () => {
  for (const code of ['CS201-01', 'CS201-02', 'CS201-03']) {
    await fillSection(code, 0);
    await setCapacity(code, 40);
  }
  await query('DELETE FROM swap_requests');
  await clearStudent('std_402');
  await enroll('std_402', 'MA101-01');
});

test('Lớp mới còn chỗ: 201 MOVED, chuyển ngay sang lớp mới', async () => {
  await enroll('std_402', 'CS201-03');
  const student = await loginAsStudent('std_402');
  const response = await student.post('/api/v1/swap-requests', { data: { toSectionId: await sectionId('CS201-02') } });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.outcome).toBe('MOVED');
  expect(body.request).toMatchObject({ status: 'COMPLETED', fromSection: { code: 'CS201-03' }, toSection: { code: 'CS201-02' } });
  expect(await membersOf('CS201-02')).toEqual(['std_402']);
  expect(await countOf('CS201-03')).toEqual({ enrolled_count: 0, actual: 0 });
  await student.dispose();
});

test('Lớp mới trùng lịch với lớp khác đang học: 409 SCHEDULE_CLASH', async () => {
  await enroll('std_402', 'CS201-03');
  const student = await loginAsStudent('std_402');
  const response = await student.post('/api/v1/swap-requests', { data: { toSectionId: await sectionId('CS201-01') } });
  expect(response.status()).toBe(409);
  const body = await response.json();
  expect(body.code).toBe('SCHEDULE_CLASH');
  expect(body.details.conflictsWith[0].sectionCode).toBe('MA101-01');
  expect(await membersOf('CS201-03')).toEqual(['std_402']);
  await student.dispose();
});

test('Hai lớp đầy: người đầu tiên chờ (PENDING), người đổi ngược được đổi chéo (SWAPPED)', async () => {
  await enroll('std_101', 'CS201-02');
  await enroll('std_102', 'CS201-03');
  await setCapacity('CS201-02', 1);
  await setCapacity('CS201-03', 1);
  const first = await loginAsStudent('std_101');
  const second = await loginAsStudent('std_102');
  const waiting = await first.post('/api/v1/swap-requests', { data: { toSectionId: await sectionId('CS201-03') } });
  expect((await waiting.json()).outcome).toBe('PENDING');
  expect(await membersOf('CS201-02')).toEqual(['std_101']);
  const swapped = await second.post('/api/v1/swap-requests', { data: { toSectionId: await sectionId('CS201-02') } });
  expect((await swapped.json()).outcome).toBe('SWAPPED');
  expect(await membersOf('CS201-02')).toEqual(['std_102']);
  expect(await membersOf('CS201-03')).toEqual(['std_101']);
  const [mine] = await (await first.get('/api/v1/swap-requests')).json();
  expect(mine).toMatchObject({ status: 'COMPLETED', outcome: 'SWAPPED' });
  await first.dispose();
  await second.dispose();
});

test('Hủy yêu cầu đang chờ: 204, hủy lần nữa 409 SWAP_REQUEST_NOT_OPEN', async () => {
  await enroll('std_101', 'CS201-02');
  await setCapacity('CS201-03', 1);
  await enroll('std_102', 'CS201-03');
  const student = await loginAsStudent('std_101');
  const { request } = await (
    await student.post('/api/v1/swap-requests', { data: { toSectionId: await sectionId('CS201-03') } })
  ).json();
  expect((await student.delete(`/api/v1/swap-requests/${request.id}`)).status()).toBe(204);
  const again = await student.delete(`/api/v1/swap-requests/${request.id}`);
  expect(again.status()).toBe(409);
  expect((await again.json()).code).toBe('SWAP_REQUEST_NOT_OPEN');
  await student.dispose();
});

test('Quản trị viên không dùng được: 403', async () => {
  const admin = await loginAsAdmin();
  expect((await admin.post('/api/v1/swap-requests', { data: { toSectionId: 1 } })).status()).toBe(403);
  await admin.dispose();
});

test('20 sinh viên ở hai lớp đầy cùng xin đổi chéo: tất cả đổi xong, sĩ số không lệch', async () => {
  const left = students(101, 110);
  const right = students(111, 120);
  for (const code of left) await enroll(code, 'CS201-02');
  for (const code of right) await enroll(code, 'CS201-03');
  await setCapacity('CS201-02', 10);
  await setCapacity('CS201-03', 10);
  const [toLeft, toRight] = [await sectionId('CS201-02'), await sectionId('CS201-03')];
  const sessions = await Promise.all([...left, ...right].map(loginAsStudent));
  const responses = await Promise.all(
    sessions.map((s, i) => s.post('/api/v1/swap-requests', { data: { toSectionId: i < 10 ? toRight : toLeft } })),
  );
  expect(responses.map((r) => r.status())).toEqual(Array(20).fill(201));
  const outcomes = await Promise.all(responses.map(async (r) => (await r.json()).outcome));
  expect(outcomes.filter((o) => o === 'SWAPPED')).toHaveLength(10);
  expect(await membersOf('CS201-02')).toEqual(right);
  expect(await membersOf('CS201-03')).toEqual(left);
  expect(await countOf('CS201-02')).toEqual({ enrolled_count: 10, actual: 10 });
  expect(await countOf('CS201-03')).toEqual({ enrolled_count: 10, actual: 10 });
  await Promise.all(sessions.map((s) => s.dispose()));
});
