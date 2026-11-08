import type { Pool } from 'pg';
import { createEnrolmentRepository } from '../src/registration/enrolment.repository';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Đăng ký và hủy thật trên PostgreSQL, theo Gherkin US-08 và US-10.
describeDb('createEnrolmentRepository trên PostgreSQL', () => {
  let pool: Pool;
  const id: Record<string, number> = {};
  const insert = (sql: string, params: unknown[] = []) => insertReturningId(pool, sql, params);
  const repo = () => createEnrolmentRepository(pool);
  const students = Array.from({ length: 30 }, (_, i) => `std_${300 + i}`);

  // Số đã đăng ký và số dòng ENROLLED thật của một lớp.
  async function seats(section: string) {
    const { rows } = await pool.query<{ enrolled_count: number; actual: number }>(
      `SELECT s.enrolled_count,
         (SELECT COUNT(*)::int FROM enrolments e
           WHERE e.section_id = s.id AND e.status = 'ENROLLED') AS actual
       FROM sections s WHERE s.id = $1`,
      [id[section]],
    );
    return rows[0];
  }

  async function waitlistStatus(student: string, section: string) {
    const { rows } = await pool.query<{ status: string }>(
      `SELECT status FROM waitlist_entries WHERE student_id = $1 AND section_id = $2
       ORDER BY id DESC LIMIT 1`,
      [id[student], id[section]],
    );
    return rows[0]?.status;
  }

  async function isEnrolled(student: string, section: string) {
    const { rows } = await pool.query(
      `SELECT 1 FROM enrolments WHERE student_id = $1 AND section_id = $2 AND status = 'ENROLLED'`,
      [id[student], id[section]],
    );
    return rows.length === 1;
  }

  beforeAll(async () => {
    pool = await openFreshTestDatabase();

    // std_300..std_329 đã đạt CS101; std_400 chưa học gì.
    for (const code of [...students, 'std_400']) {
      const userId = await insert(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, 'x', $1, 'STUDENT')`,
        [`${code}@student.edu.vn`],
      );
      id[code] = await insert(`INSERT INTO students (user_id, student_code) VALUES ($1, $2)`, [
        userId,
        code,
      ]);
    }
    id.semester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2026-1', 'Hiện tại', now() - interval '7 days', now() + interval '60 days', 24)`,
    );
    id.closedSemester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2025-2', 'Cũ', now() - interval '200 days', now() - interval '170 days', 24)`,
    );
    for (const [code, credits] of [
      ['CS101', 4],
      ['CS201', 4],
      ['MA101', 3],
      ['EN101', 2],
    ] as const) {
      id[code] = await insert(`INSERT INTO courses (code, name, credits) VALUES ($1, $1, $2)`, [
        code,
        credits,
      ]);
    }
    await pool.query('INSERT INTO prerequisites (course_id, prerequisite_id) VALUES ($1, $2)', [
      id.CS201,
      id.CS101,
    ]);
    for (const student of students) {
      await pool.query(
        `INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
         VALUES ($1, $2, '2025-2', 8, true)`,
        [id[student], id.CS101],
      );
    }

    // [mã lớp, môn, học kỳ, sức chứa, thứ, tiết bắt đầu, tiết kết thúc]
    const sections = [
      ['CS201-01', 'CS201', id.semester, 40, 2, 1, 3],
      ['CS201-02', 'CS201', id.semester, 40, 4, 1, 3],
      ['MA101-01', 'MA101', id.semester, 40, 2, 2, 4],
      ['EN101-01', 'EN101', id.semester, 3, 6, 1, 2],
      ['MA101-OLD', 'MA101', id.closedSemester, 40, 3, 1, 3],
    ] as const;
    for (const [code, course, semester, capacity, day, start, end] of sections) {
      id[code] = await insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity) VALUES ($1, $2, $3, $4)`,
        [id[course], semester, code, capacity],
      );
      await pool.query(
        `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period)
         VALUES ($1, $2, $3, $4)`,
        [id[code], day, start, end],
      );
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('Gherkin "Successful registration": 1 chỗ được giữ, trả lớp và môn', async () => {
    const registration = await repo().register(id.std_300, id['CS201-01']);
    expect(registration).toMatchObject({
      studentId: id.std_300,
      status: 'ENROLLED',
      course: { code: 'CS201', credits: 4 },
      section: { code: 'CS201-01', enrolledCount: 1, remainingSeats: 39 },
    });
    expect(await seats('CS201-01')).toEqual({ enrolled_count: 1, actual: 1 });
  });

  it('Vi phạm đầu tiên quyết định mã lỗi, không ghi gì', async () => {
    await expect(repo().register(id.std_400, id['CS201-02'])).rejects.toMatchObject({
      code: 'PREREQUISITE_NOT_MET',
      status: 422,
    });
    await expect(repo().register(id.std_300, id['CS201-02'])).rejects.toMatchObject({
      code: 'ALREADY_ENROLLED',
      status: 409,
    });
    await expect(repo().register(id.std_300, id['MA101-01'])).rejects.toMatchObject({
      code: 'SCHEDULE_CLASH',
      status: 409,
    });
    await expect(repo().register(id.std_300, id['MA101-OLD'])).rejects.toMatchObject({
      code: 'REGISTRATION_CLOSED',
      status: 403,
    });
    await expect(repo().register(id.std_300, 999999)).rejects.toMatchObject({ status: 404 });
    expect(await seats('CS201-02')).toEqual({ enrolled_count: 0, actual: 0 });
  });

  it('Giành chỗ cuối: lớp còn 1 chỗ, 20 sinh viên gửi cùng lúc thì đúng 1 người vào', async () => {
    await pool.query('UPDATE sections SET enrolled_count = 39 WHERE id = $1', [id['CS201-02']]);
    const results = await Promise.allSettled(
      students.slice(1, 21).map((s) => repo().register(id[s], id['CS201-02'])),
    );
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rejected.map((r) => r.reason.code)).toEqual(Array(19).fill('SECTION_FULL'));
    const { enrolled_count } = await seats('CS201-02');
    expect(enrolled_count).toBe(40);
  });

  it('Bấm hai lần: một sinh viên gửi 5 yêu cầu cùng lúc thì chỉ giữ 1 chỗ', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => repo().register(id.std_329, id['EN101-01'])),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await seats('EN101-01')).toEqual({ enrolled_count: 1, actual: 1 });
  });

  it('listForStudent: học kỳ hiện tại mặc định; lọc được theo học kỳ', async () => {
    const mine = await repo().list(id.std_300);
    expect(mine.map((r) => r.section.code)).toEqual(['CS201-01']);
    expect(await repo().list(id.std_300, id.closedSemester)).toEqual([]);
  });

  it('Hủy lần đăng ký của người khác: 403; không tồn tại: 404', async () => {
    const [mine] = await repo().list(id.std_300);
    await expect(repo().drop(id.std_301, mine.id)).rejects.toMatchObject({ status: 403 });
    await expect(repo().drop(id.std_300, 999999)).rejects.toMatchObject({ status: 404 });
  });

  it('Gherkin "Drop a section": DROPPED, trả lại chỗ; hủy lần hai thì 404', async () => {
    const [mine] = await repo().list(id.std_300);
    await repo().drop(id.std_300, mine.id);
    expect(await isEnrolled('std_300', 'CS201-01')).toBe(false);
    expect(await seats('CS201-01')).toEqual({ enrolled_count: 0, actual: 0 });
    await expect(repo().drop(id.std_300, mine.id)).rejects.toMatchObject({ status: 404 });
  });

  it('Gherkin US-10: người đầu hàng không còn đủ điều kiện bị bỏ qua, người kế tiếp vào lớp', async () => {
    // EN101-01 đầy (3/3). Hàng chờ: std_322 (trùng lịch vì đang học lớp thứ Sáu tiết 1-2), rồi std_323.
    await repo().register(id.std_320, id['EN101-01']);
    await repo().register(id.std_321, id['EN101-01']);
    id['FR-01'] = await insert(
      `INSERT INTO sections (course_id, semester_id, code, capacity) VALUES ($1, $2, 'FR-01', 40)`,
      [id.CS101, id.semester],
    );
    await pool.query(
      `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period)
       VALUES ($1, 6, 1, 2)`,
      [id['FR-01']],
    );
    await pool.query('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
      id.std_322,
      id['FR-01'],
    ]);
    for (const student of ['std_322', 'std_323']) {
      await pool.query('INSERT INTO waitlist_entries (student_id, section_id) VALUES ($1, $2)', [
        id[student],
        id['EN101-01'],
      ]);
    }

    const [leaving] = await repo().list(id.std_320);
    await repo().drop(id.std_320, leaving.id);

    expect(await waitlistStatus('std_322', 'EN101-01')).toBe('SKIPPED');
    expect(await waitlistStatus('std_323', 'EN101-01')).toBe('PROMOTED');
    expect(await isEnrolled('std_323', 'EN101-01')).toBe(true);
    expect(await seats('EN101-01')).toEqual({ enrolled_count: 3, actual: 3 });
  });

  it('Hủy cùng lúc: 2 người hủy, 2 người đầu hàng được đẩy lên, không ai bị đẩy hai lần', async () => {
    for (const student of ['std_324', 'std_325', 'std_326']) {
      await pool.query('INSERT INTO waitlist_entries (student_id, section_id) VALUES ($1, $2)', [
        id[student],
        id['EN101-01'],
      ]);
    }
    const [a] = await repo().list(id.std_321);
    const [b] = await repo().list(id.std_329);
    await Promise.all([repo().drop(id.std_321, a.id), repo().drop(id.std_329, b.id)]);

    expect(await waitlistStatus('std_324', 'EN101-01')).toBe('PROMOTED');
    expect(await waitlistStatus('std_325', 'EN101-01')).toBe('PROMOTED');
    expect(await waitlistStatus('std_326', 'EN101-01')).toBe('WAITING');
    expect(await seats('EN101-01')).toEqual({ enrolled_count: 3, actual: 3 });
  });

  it('Hết hàng chờ thì chỗ để trống', async () => {
    await pool.query("UPDATE waitlist_entries SET status = 'CANCELLED' WHERE status = 'WAITING'");
    const [mine] = await repo().list(id.std_323);
    await repo().drop(id.std_323, mine.id);
    expect(await seats('EN101-01')).toEqual({ enrolled_count: 2, actual: 2 });
  });

  it('Học kỳ đã đóng đăng ký thì không hủy được: 403 REGISTRATION_CLOSED', async () => {
    const oldId = await insert('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
      id.std_310,
      id['MA101-OLD'],
    ]);
    await expect(repo().drop(id.std_310, oldId)).rejects.toMatchObject({
      code: 'REGISTRATION_CLOSED',
      status: 403,
    });
  });
});
