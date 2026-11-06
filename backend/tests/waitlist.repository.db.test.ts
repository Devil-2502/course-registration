import type { Pool } from 'pg';
import { createWaitlistRepository } from '../src/waitlist/waitlist.repository';
import { checkJoinWaitlist } from '../src/waitlist/waitlist-rules';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Hàng chờ trên PostgreSQL thật, theo Gherkin US-09.
describeDb('createWaitlistRepository trên PostgreSQL', () => {
  let pool: Pool;
  const id: Record<string, number> = {};
  const insert = (sql: string, params: unknown[] = []) => insertReturningId(pool, sql, params);
  const repo = () => createWaitlistRepository(pool);
  const codeOf = async (student: string, section: string) => {
    const facts = await repo().readJoinFacts(id[student], id[section]);
    return facts ? (checkJoinWaitlist(facts)?.code ?? null) : 'NOT_FOUND';
  };

  beforeAll(async () => {
    pool = await openFreshTestDatabase();

    // std_402 đã đạt CS101; std_403, std_404 chưa học gì; std_405 đang học CS201-02.
    for (const code of ['std_402', 'std_403', 'std_404', 'std_405']) {
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
    for (const code of ['CS101', 'CS201']) {
      id[code] = await insert(`INSERT INTO courses (code, name, credits) VALUES ($1, $1, 4)`, [
        code,
      ]);
    }
    await pool.query('INSERT INTO prerequisites (course_id, prerequisite_id) VALUES ($1, $2)', [
      id.CS201,
      id.CS101,
    ]);
    for (const student of ['std_402', 'std_404', 'std_405']) {
      await pool.query(
        `INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
         VALUES ($1, $2, '2025-2', 8, true)`,
        [id[student], id.CS101],
      );
    }

    // CS201-01 đầy (40/40), có lịch thứ Ba; CS201-02 còn 3 chỗ; CS201-OLD thuộc học kỳ đã đóng.
    const section = async (key: string, semester: number, enrolled: number) => {
      id[key] = await insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity, enrolled_count)
         VALUES ($1, $2, $3, 40, $4)`,
        [id.CS201, semester, key, enrolled],
      );
    };
    await section('CS201-01', id.semester, 40);
    await section('CS201-02', id.semester, 37);
    await section('CS201-OLD', id.closedSemester, 40);
    await pool.query(
      `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room)
       VALUES ($1, 2, 1, 3, 'A101')`,
      [id['CS201-01']],
    );
    await pool.query('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
      id.std_405,
      id['CS201-02'],
    ]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('Lớp không tồn tại: null (route trả 404)', async () => {
    expect(await repo().readJoinFacts(id.std_402, 999999)).toBeNull();
  });

  it('Gherkin "Section still has seats": CS201-02 còn 3 chỗ thì SECTION_NOT_FULL', async () => {
    expect(await codeOf('std_402', 'CS201-02')).toBe('SECTION_NOT_FULL');
  });

  it('Chưa đạt CS101: PREREQUISITE_NOT_MET', async () => {
    expect(await codeOf('std_403', 'CS201-01')).toBe('PREREQUISITE_NOT_MET');
  });

  it('Đang học lớp khác của CS201: ALREADY_ENROLLED', async () => {
    expect(await codeOf('std_405', 'CS201-01')).toBe('ALREADY_ENROLLED');
  });

  it('Học kỳ đã đóng đăng ký: REGISTRATION_CLOSED', async () => {
    expect(await codeOf('std_402', 'CS201-OLD')).toBe('REGISTRATION_CLOSED');
  });

  it('Gherkin "Join the waitlist": vào hàng theo thứ tự, trả vị trí và lớp kèm lịch', async () => {
    expect(await codeOf('std_402', 'CS201-01')).toBeNull();
    const first = await repo().join(id.std_402, id['CS201-01']);
    expect(first).toMatchObject({
      studentId: id.std_402,
      sectionId: id['CS201-01'],
      status: 'WAITING',
      position: 1,
      section: {
        code: 'CS201-01',
        remainingSeats: 0,
        waitlistCount: 1,
        slots: [{ dayOfWeek: 2, startPeriod: 1, endPeriod: 3, room: 'A101' }],
      },
    });
    const second = await repo().join(id.std_404, id['CS201-01']);
    expect(second.position).toBe(2);
  });

  it('Gherkin "Join the same waitlist twice": đã chờ thì ALREADY_ON_WAITLIST', async () => {
    expect(await codeOf('std_402', 'CS201-01')).toBe('ALREADY_ON_WAITLIST');
  });

  it('Hai yêu cầu cùng lúc: chỉ một lượt được ghi, lượt kia 409', async () => {
    await pool.query(
      "UPDATE waitlist_entries SET status = 'CANCELLED' WHERE student_id = $1 AND section_id = $2",
      [id.std_404, id['CS201-01']],
    );
    const results = await Promise.allSettled([
      repo().join(id.std_404, id['CS201-01']),
      repo().join(id.std_404, id['CS201-01']),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'ALREADY_ON_WAITLIST', status: 409 });
  });

  it('listForStudent: lượt của chính sinh viên, lọc được theo học kỳ', async () => {
    const all = await repo().listForStudent(id.std_404);
    expect(all.map((e) => [e.status, e.position])).toEqual([
      ['CANCELLED', null],
      ['WAITING', 2],
    ]);
    expect(await repo().listForStudent(id.std_404, id.closedSemester)).toEqual([]);
  });

  it('Rời hàng: chuyển CANCELLED, người phía sau lên vị trí 1', async () => {
    const [mine] = await repo().listForStudent(id.std_402);
    expect(await repo().findEntry(mine.id)).toEqual({ studentId: id.std_402, status: 'WAITING' });
    await repo().leave(mine.id);
    expect(await repo().findEntry(mine.id)).toEqual({
      studentId: id.std_402,
      status: 'CANCELLED',
    });
    const others = await repo().listForStudent(id.std_404);
    expect(others.find((e) => e.status === 'WAITING')?.position).toBe(1);
  });

  it('findEntry: lượt không tồn tại thì null', async () => {
    expect(await repo().findEntry(999999)).toBeNull();
  });
});
