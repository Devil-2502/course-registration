import type { Pool } from 'pg';
import { createRegistrationRepository } from '../src/registration/registration.repository';
import { collectViolations, type RegistrationFacts } from '../src/registration/registration-rules';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Đọc dữ kiện đăng ký trên PostgreSQL thật rồi cho qua bộ luật, theo Gherkin US-04 đến US-07, US-11.
describeDb('createRegistrationRepository trên PostgreSQL', () => {
  let pool: Pool;
  const id: Record<string, number> = {};
  const insert = (sql: string, params: unknown[] = []) => insertReturningId(pool, sql, params);

  beforeAll(async () => {
    pool = await openFreshTestDatabase();

    // 2 sinh viên: std_402 (đã đạt CS101, đang học MA101-01), std_403 (chưa học gì).
    for (const code of ['std_402', 'std_403']) {
      const userId = await insert(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, 'x', $1, 'STUDENT')`,
        [`${code}@student.edu.vn`],
      );
      id[code] = await insert(`INSERT INTO students (user_id, student_code) VALUES ($1, $2)`, [
        userId,
        code,
      ]);
    }
    id.closedSemester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2025-2', 'Cũ', now() - interval '200 days', now() - interval '170 days', 24)`,
    );
    id.semester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2026-1', 'Hiện tại', now() - interval '7 days', now() + interval '60 days', 10)`,
    );
    for (const [code, credits] of [
      ['CS101', 4],
      ['CS201', 4],
      ['MA101', 3],
      ['PE101', 4],
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
    await pool.query(
      `INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
       VALUES ($1, $2, '2025-2', 8, true)`,
      [id.std_402, id.CS101],
    );

    // Lịch: MA101-01 và CS201-02 cùng thứ Hai tiết 4-6 (Gherkin US-11); CS201-01 thứ Ba.
    const section = async (
      key: string,
      course: string,
      semester: number,
      enrolled: number,
      slot: number[],
    ) => {
      id[key] = await insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity, enrolled_count) VALUES ($1, $2, $3, 40, $4)`,
        [id[course], semester, key, enrolled],
      );
      await pool.query(
        'INSERT INTO section_slots (section_id, day_of_week, start_period, end_period) VALUES ($1, $2, $3, $4)',
        [id[key], ...slot],
      );
    };
    await section('MA101-01', 'MA101', id.semester, 1, [1, 4, 6]);
    await section('CS201-01', 'CS201', id.semester, 40, [2, 1, 3]);
    await section('CS201-02', 'CS201', id.semester, 10, [1, 4, 6]);
    await section('CS101-01', 'CS101', id.semester, 0, [3, 1, 3]);
    await section('PE101-01', 'PE101', id.semester, 0, [5, 1, 3]);
    await section('CS201-OLD', 'CS201', id.closedSemester, 0, [4, 1, 3]);
    await pool.query(`INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)`, [
      id.std_402,
      id['MA101-01'],
    ]);
    // Lớp đã hủy không được tính vào lịch và tín chỉ.
    await pool.query(
      `INSERT INTO enrolments (student_id, section_id, status, dropped_at) VALUES ($1, $2, 'DROPPED', now())`,
      [id.std_402, id['PE101-01']],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  // Mã các vi phạm theo thứ tự; null khi lớp không tồn tại.
  const codesOf = (facts: RegistrationFacts | null) =>
    facts ? collectViolations(facts).map((v) => v.code) : null;
  const codes = async (student: string, sectionKey: string) =>
    codesOf(await createRegistrationRepository(pool).readFacts(id[student], id[sectionKey]));

  it('Lớp không tồn tại: null (route trả 404)', async () => {
    expect(await createRegistrationRepository(pool).readFacts(id.std_402, 999999)).toBeNull();
  });

  it('Đủ mọi điều kiện: không vi phạm; tín chỉ tính cả lớp đang học, bỏ lớp đã hủy', async () => {
    const facts = await createRegistrationRepository(pool).readFacts(id.std_403, id['CS101-01']);
    expect(codesOf(facts)).toEqual([]);
    const withEnrolled = await createRegistrationRepository(pool).readFacts(
      id.std_402,
      id['PE101-01'],
    );
    expect(withEnrolled?.credit).toEqual({
      allowed: true,
      currentCredits: 3,
      requestedCredits: 4,
      limit: 10,
    });
  });

  it('US-05: chưa đạt CS101 thì PREREQUISITE_NOT_MET kèm môn thiếu', async () => {
    const facts = await createRegistrationRepository(pool).readFacts(id.std_403, id['CS201-02']);
    expect(facts?.missingPrerequisites).toEqual([{ id: id.CS101, code: 'CS101', name: 'CS101' }]);
    expect(await codes('std_403', 'CS201-02')).toEqual(['PREREQUISITE_NOT_MET']);
  });

  it('US-06, US-11: CS201-02 trùng MA101-01 (thứ Hai tiết 4-6)', async () => {
    const facts = await createRegistrationRepository(pool).readFacts(id.std_402, id['CS201-02']);
    expect(facts?.clashesWith).toEqual([{ sectionId: id['MA101-01'], sectionCode: 'MA101-01' }]);
    expect(await codes('std_402', 'CS201-02')).toEqual(['SCHEDULE_CLASH']);
  });

  it('Lớp đầy: SECTION_FULL', async () => {
    expect(await codes('std_402', 'CS201-01')).toEqual(['SECTION_FULL']);
  });

  it('Đã đạt môn: COURSE_ALREADY_PASSED', async () => {
    expect(await codes('std_402', 'CS101-01')).toEqual(['COURSE_ALREADY_PASSED']);
  });

  it('Đang học một lớp của môn này: ALREADY_ENROLLED', async () => {
    const otherMath = await insert(
      `INSERT INTO sections (course_id, semester_id, code, capacity) VALUES ($1, $2, 'MA101-02', 40)`,
      [id.MA101, id.semester],
    );
    const facts = await createRegistrationRepository(pool).readFacts(id.std_402, otherMath);
    expect(codesOf(facts)).toEqual(['ALREADY_ENROLLED']);
  });

  it('US-07: vượt giới hạn tín chỉ của học kỳ (3 + 4 + 4 > 10)', async () => {
    await pool.query(`INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)`, [
      id.std_403,
      id['PE101-01'],
    ]);
    await pool.query(`INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)`, [
      id.std_403,
      id['MA101-01'],
    ]);
    const facts = await createRegistrationRepository(pool).readFacts(id.std_403, id['CS101-01']);
    expect(facts?.credit).toEqual({
      allowed: false,
      currentCredits: 7,
      requestedCredits: 4,
      limit: 10,
    });
    expect(codesOf(facts)).toEqual(['CREDIT_LIMIT_EXCEEDED']);
  });

  it('Học kỳ đã hết hạn đăng ký: REGISTRATION_CLOSED', async () => {
    expect(await codes('std_402', 'CS201-OLD')).toContain('REGISTRATION_CLOSED');
  });
});
