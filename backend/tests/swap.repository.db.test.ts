import type { Pool } from 'pg';
import { createEnrolmentRepository } from '../src/registration/enrolment.repository';
import { createSwapRepository } from '../src/swaps/swap.repository';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Đổi lớp an toàn (cải tiến 2) trên PostgreSQL thật, kể cả nhiều yêu cầu cùng lúc.
describeDb('Đổi lớp trên PostgreSQL', () => {
  let pool: Pool;
  const id: Record<string, number> = {};
  const student: number[] = []; // student[1] .. student[20]
  const insert = (sql: string, params: unknown[] = []) => insertReturningId(pool, sql, params);
  const swaps = () => createSwapRepository(pool);

  beforeAll(async () => {
    pool = await openFreshTestDatabase();
    for (let i = 1; i <= 20; i += 1) {
      const userId = await insert(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, 'x', $1, 'STUDENT')`,
        [`s${i}@student.edu.vn`],
      );
      student[i] = await insert(`INSERT INTO students (user_id, student_code) VALUES ($1, $2)`, [
        userId,
        `s${i}`,
      ]);
    }
    id.semester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2026-1', 'Hiện tại', now() - interval '7 days', now() + interval '60 days', 24)`,
    );
    id.CS201 = await insert(`INSERT INTO courses (code, name, credits) VALUES ('CS201', 'DSA', 4)`);
    id.MA101 = await insert(
      `INSERT INTO courses (code, name, credits) VALUES ('MA101', 'Calc', 3)`,
    );
    // A thứ Hai, B thứ Tư, C thứ Sáu, D thứ Ba tiết 2-4 (trùng MA101-01 thứ Ba tiết 1-3).
    for (const [code, course, day, start, end] of [
      ['A', 'CS201', 1, 1, 3],
      ['B', 'CS201', 3, 1, 3],
      ['C', 'CS201', 5, 1, 3],
      ['D', 'CS201', 2, 2, 4],
      ['MA101-01', 'MA101', 2, 1, 3],
    ] as const) {
      id[code] = await insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity) VALUES ($1, $2, $3, 40)`,
        [id[course], id.semester, code],
      );
      await pool.query(
        `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period)
         VALUES ($1, $2, $3, $4)`,
        [id[code], day, start, end],
      );
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  // Đặt sức chứa và người học cho từng lớp, xóa yêu cầu đổi và hàng chờ cũ.
  async function setup(sections: Record<string, { capacity: number; students: number[] }>) {
    await pool.query('TRUNCATE swap_requests, waitlist_entries, enrolments RESTART IDENTITY');
    await pool.query(`UPDATE sections SET enrolled_count = 0, capacity = 40`);
    await pool.query(
      `UPDATE semesters SET registration_end = now() + interval '60 days' WHERE id = $1`,
      [id.semester],
    );
    for (const [code, { capacity, students }] of Object.entries(sections)) {
      for (const s of students) {
        await pool.query('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
          student[s],
          id[code],
        ]);
      }
      await pool.query('UPDATE sections SET capacity = $2, enrolled_count = $3 WHERE id = $1', [
        id[code],
        capacity,
        students.length,
      ]);
    }
  }

  async function sectionOf(s: number): Promise<string[]> {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT sec.code FROM enrolments e JOIN sections sec ON sec.id = e.section_id
       WHERE e.student_id = $1 AND e.status = 'ENROLLED' ORDER BY sec.code`,
      [student[s]],
    );
    return rows.map((r) => r.code);
  }

  async function counts() {
    const { rows } = await pool.query<{ code: string; enrolled_count: number; actual: number }>(
      `SELECT s.code, s.enrolled_count,
         (SELECT count(*)::int FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ENROLLED')
           AS actual
       FROM sections s ORDER BY s.code`,
    );
    for (const row of rows) expect(row.enrolled_count).toBe(row.actual);
    return Object.fromEntries(rows.map((r) => [r.code, r.actual]));
  }

  it('lớp mới còn chỗ: chuyển thẳng, sĩ số hai lớp cập nhật', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, C: { capacity: 5, students: [] } });
    const result = await swaps().request(student[1], id.C);
    expect(result.outcome).toBe('MOVED');
    expect(result.request).toMatchObject({
      status: 'COMPLETED',
      outcome: 'MOVED',
      fromSection: { code: 'A' },
      toSection: { code: 'C' },
    });
    expect(await sectionOf(1)).toEqual(['C']);
    expect(await counts()).toMatchObject({ A: 1, C: 1 });
  });

  it('chuyển thẳng thì người đầu hàng chờ của lớp cũ được vào', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, C: { capacity: 5, students: [] } });
    await pool.query(`INSERT INTO waitlist_entries (student_id, section_id) VALUES ($1, $2)`, [
      student[3],
      id.A,
    ]);
    await swaps().request(student[1], id.C);
    expect(await sectionOf(3)).toEqual(['A']);
    expect(await counts()).toMatchObject({ A: 2, C: 1 });
  });

  it('lớp mới đầy và chưa ai đổi ngược: lưu yêu cầu, vẫn giữ lớp cũ', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    const result = await swaps().request(student[1], id.B);
    expect(result.outcome).toBe('PENDING');
    expect(result.request).toMatchObject({ status: 'OPEN', outcome: null, resolvedAt: null });
    expect(await sectionOf(1)).toEqual(['A']);
  });

  it('có người đổi ngược: đổi chéo cả hai, sĩ số giữ nguyên', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    const first = await swaps().request(student[1], id.B);
    const second = await swaps().request(student[3], id.A);
    expect(second.outcome).toBe('SWAPPED');
    expect(await sectionOf(1)).toEqual(['B']);
    expect(await sectionOf(3)).toEqual(['A']);
    expect(await counts()).toMatchObject({ A: 2, B: 2 });
    const [mine] = (await swaps().list(student[1])).filter((r) => r.id === first.request.id);
    expect(mine).toMatchObject({ status: 'COMPLETED', outcome: 'SWAPPED' });
  });

  it('ưu tiên người đến trước khi có nhiều yêu cầu ngược chiều', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    await swaps().request(student[1], id.B);
    await swaps().request(student[2], id.B);
    await swaps().request(student[3], id.A);
    expect(await sectionOf(1)).toEqual(['B']);
    expect(await sectionOf(2)).toEqual(['A']);
  });

  it('bỏ qua và hủy yêu cầu ngược chiều không còn hiệu lực', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    const stale = await swaps().request(student[3], id.A);
    // s3 bị chuyển khỏi B bằng cách khác (không qua API), yêu cầu của s3 thành vô hiệu.
    await pool.query(`UPDATE enrolments SET status = 'DROPPED' WHERE student_id = $1`, [
      student[3],
    ]);
    await pool.query(`UPDATE sections SET enrolled_count = 1 WHERE id = $1`, [id.B]);
    const result = await swaps().request(student[1], id.B);
    expect(result.outcome).toBe('MOVED');
    const { rows } = await pool.query('SELECT status FROM swap_requests WHERE id = $1', [
      stale.request.id,
    ]);
    expect(rows[0].status).toBe('CANCELLED');
  });

  it('hủy lớp thì yêu cầu đổi từ lớp đó tự hủy', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    const pending = await swaps().request(student[1], id.B);
    const { rows } = await pool.query(
      'SELECT id FROM enrolments WHERE student_id = $1 AND status = $2',
      [student[1], 'ENROLLED'],
    );
    await createEnrolmentRepository(pool).drop(student[1], Number(rows[0].id));
    const [request] = await swaps().list(student[1]);
    expect(request).toMatchObject({ id: pending.request.id, status: 'CANCELLED' });
  });

  it.each([
    ['trùng lịch với lớp khác đang học', 'D', 'SCHEDULE_CLASH', 409],
    ['đang ở đúng lớp đó', 'A', 'SAME_SECTION', 409],
  ])('từ chối khi %s', async (_name, target, code, status) => {
    await setup({ A: { capacity: 2, students: [1] }, 'MA101-01': { capacity: 40, students: [1] } });
    await expect(swaps().request(student[1], id[target])).rejects.toMatchObject({ code, status });
  });

  it('báo lớp bị trùng lịch', async () => {
    await setup({ A: { capacity: 2, students: [1] }, 'MA101-01': { capacity: 40, students: [1] } });
    await expect(swaps().request(student[1], id.D)).rejects.toMatchObject({
      details: { conflictsWith: [{ sectionId: id['MA101-01'], sectionCode: 'MA101-01' }] },
    });
  });

  it('từ chối khi chưa học môn này, đã có yêu cầu đang chờ, hết hạn đăng ký hoặc lớp không tồn tại', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    await expect(swaps().request(student[5], id.B)).rejects.toMatchObject({
      code: 'NOT_ENROLLED_IN_COURSE',
    });
    await swaps().request(student[1], id.B);
    await expect(swaps().request(student[1], id.C)).rejects.toMatchObject({
      code: 'SWAP_REQUEST_EXISTS',
    });
    await expect(swaps().request(student[1], 999999)).rejects.toMatchObject({ status: 404 });
    await pool.query(`UPDATE semesters SET registration_end = now() - interval '1 day'`);
    await expect(swaps().request(student[2], id.C)).rejects.toMatchObject({
      code: 'REGISTRATION_CLOSED',
      status: 403,
    });
  });

  it('hủy yêu cầu: chỉ chủ yêu cầu, chỉ khi đang chờ', async () => {
    await setup({ A: { capacity: 2, students: [1, 2] }, B: { capacity: 2, students: [3, 4] } });
    const { request } = await swaps().request(student[1], id.B);
    await expect(swaps().cancel(student[2], request.id)).rejects.toMatchObject({ status: 403 });
    await swaps().cancel(student[1], request.id);
    await expect(swaps().cancel(student[1], request.id)).rejects.toMatchObject({
      code: 'SWAP_REQUEST_NOT_OPEN',
    });
    await expect(swaps().cancel(student[1], 999999)).rejects.toMatchObject({ status: 404 });
    // Đã hủy thì không còn được ghép.
    expect((await swaps().request(student[3], id.A)).outcome).toBe('PENDING');
  });

  it('20 sinh viên ở hai lớp đầy cùng xin đổi chéo: tất cả đổi xong, không ai mất chỗ', async () => {
    const left = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const right = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    await setup({ A: { capacity: 10, students: left }, B: { capacity: 10, students: right } });
    const results = await Promise.all([
      ...left.map((s) => swaps().request(student[s], id.B)),
      ...right.map((s) => swaps().request(student[s], id.A)),
    ]);
    expect(results.filter((r) => r.outcome === 'SWAPPED')).toHaveLength(10);
    for (const s of left) expect(await sectionOf(s)).toEqual(['B']);
    for (const s of right) expect(await sectionOf(s)).toEqual(['A']);
    expect(await counts()).toMatchObject({ A: 10, B: 10 });
    const { rows } = await pool.query(
      `SELECT status, count(*)::int AS n FROM swap_requests GROUP BY status`,
    );
    expect(rows).toEqual([{ status: 'COMPLETED', n: 20 }]);
  });

  it('5 sinh viên cùng xin chuyển vào lớp còn đúng 1 chỗ: 1 người chuyển, 4 người chờ', async () => {
    await setup({
      A: { capacity: 10, students: [1, 2, 3, 4, 5] },
      C: { capacity: 1, students: [] },
    });
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((s) => swaps().request(student[s], id.C)),
    );
    expect(results.filter((r) => r.outcome === 'MOVED')).toHaveLength(1);
    expect(results.filter((r) => r.outcome === 'PENDING')).toHaveLength(4);
    expect(await counts()).toMatchObject({ A: 4, C: 1 });
  });
});
