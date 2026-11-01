import { expect, test } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { enroll, query, resetDatabase, sectionId } from './helpers/db';

// US-10: cần DELETE /registrations/{id} của M2.
// Dữ liệu mẫu: EN101-01 đầy (std_140..std_169), hàng chờ std_610 (1), std_611 (2).
test.beforeEach(async () => {
  await resetDatabase();
});

async function registrationIdOf(studentCode: string, sectionCode: string): Promise<number> {
  const [row] = await query<{ id: string }>(
    `SELECT e.id FROM enrolments e
     JOIN students st ON st.id = e.student_id JOIN sections s ON s.id = e.section_id
     WHERE st.student_code = $1 AND s.code = $2 AND e.status = 'ENROLLED'`,
    [studentCode, sectionCode],
  );
  return Number(row.id);
}

async function statusOf(studentCode: string, sectionCode: string) {
  const [row] = await query<{ enrolled: boolean; waitlist: string | null }>(
    `SELECT EXISTS (SELECT 1 FROM enrolments e WHERE e.student_id = st.id AND e.section_id = s.id
                    AND e.status = 'ENROLLED') AS enrolled,
            (SELECT w.status FROM waitlist_entries w WHERE w.student_id = st.id AND w.section_id = s.id
             ORDER BY w.id DESC LIMIT 1) AS waitlist
     FROM students st, sections s WHERE st.student_code = $1 AND s.code = $2`,
    [studentCode, sectionCode],
  );
  return row;
}

test.fixme('Drop a section: 204, đăng ký chuyển sang DROPPED', async () => {
  const student = await loginAsStudent('std_402');
  const id = await registrationIdOf('std_402', 'MA101-01');
  expect((await student.delete(`/api/v1/registrations/${id}`)).status()).toBe(204);
  const [row] = await query<{ status: string }>('SELECT status FROM enrolments WHERE id = $1', [id]);
  expect(row.status).toBe('DROPPED');
  await student.dispose();
});

test.fixme('First student on the waitlist is promoted: std_610 vào lớp, lớp vẫn đầy', async () => {
  const leaving = await loginAsStudent('std_140');
  const response = await leaving.delete(`/api/v1/registrations/${await registrationIdOf('std_140', 'EN101-01')}`);
  expect(response.status()).toBe(204);
  expect(await statusOf('std_610', 'EN101-01')).toEqual({ enrolled: true, waitlist: 'PROMOTED' });
  const [section] = await query<{ enrolled_count: number; capacity: number }>(
    'SELECT enrolled_count, capacity FROM sections WHERE id = $1',
    [await sectionId('EN101-01')],
  );
  expect(section.enrolled_count).toBe(section.capacity);
  await leaving.dispose();
});

test.fixme('A waiting student who is no longer eligible is skipped: std_610 bị bỏ qua, std_611 vào lớp', async () => {
  // CS101-02 học thứ Sáu tiết 1-3, trùng buổi thứ Sáu 1-2 của EN101-01
  await enroll('std_610', 'CS101-02');
  const leaving = await loginAsStudent('std_140');
  await leaving.delete(`/api/v1/registrations/${await registrationIdOf('std_140', 'EN101-01')}`);
  expect((await statusOf('std_610', 'EN101-01')).waitlist).toBe('SKIPPED');
  expect(await statusOf('std_611', 'EN101-01')).toEqual({ enrolled: true, waitlist: 'PROMOTED' });
  await leaving.dispose();
});

test.fixme("Drop someone else's registration: 403", async () => {
  const other = await registrationIdOf('std_101', 'CS210-01');
  const student = await loginAsStudent('std_402');
  expect((await student.delete(`/api/v1/registrations/${other}`)).status()).toBe(403);
  await student.dispose();
});
