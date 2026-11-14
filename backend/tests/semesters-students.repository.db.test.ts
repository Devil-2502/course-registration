import type { Pool } from 'pg';
import { createSemesterRepository } from '../src/semesters/semesters';
import { createStudentRepository } from '../src/students/students';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Học kỳ, thời khóa biểu và kết quả học trên PostgreSQL thật.
describeDb('Học kỳ và dữ liệu sinh viên trên PostgreSQL', () => {
  let pool: Pool;
  const id: Record<string, number> = {};
  const insert = (sql: string, params: unknown[] = []) => insertReturningId(pool, sql, params);

  beforeAll(async () => {
    pool = await openFreshTestDatabase();
    const userId = await insert(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ('std_402@student.edu.vn', 'x', 'An', 'STUDENT')`,
    );
    id.student = await insert(
      `INSERT INTO students (user_id, student_code) VALUES ($1, 'std_402')`,
      [userId],
    );
    id.old = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2025-2', 'Cũ', now() - interval '200 days', now() - interval '170 days', 20)`,
    );
    id.current = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2026-1', 'Hiện tại', now() - interval '7 days', now() + interval '60 days', 24)`,
    );
    for (const [code, credits] of [
      ['CS101', 4],
      ['MA101', 3],
      ['PE101', 1],
    ] as const) {
      id[code] = await insert(`INSERT INTO courses (code, name, credits) VALUES ($1, $1, $2)`, [
        code,
        credits,
      ]);
    }
    // MA101-01 có 2 buổi; PE101-01 chưa có lịch; CS101-OLD thuộc học kỳ cũ; CS101-01 đã hủy.
    const section = async (key: string, course: string, semester: number) => {
      id[key] = await insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity) VALUES ($1, $2, $3, 40)`,
        [id[course], semester, key],
      );
    };
    await section('MA101-01', 'MA101', id.current);
    await section('PE101-01', 'PE101', id.current);
    await section('CS101-01', 'CS101', id.current);
    await section('CS101-OLD', 'CS101', id.old);
    for (const [day, start, end] of [
      [3, 1, 3],
      [1, 4, 6],
    ]) {
      await pool.query(
        `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room)
         VALUES ($1, $2, $3, $4, 'A101')`,
        [id['MA101-01'], day, start, end],
      );
    }
    await pool.query(
      `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period)
       VALUES ($1, 2, 1, 3)`,
      [id['CS101-OLD']],
    );
    for (const key of ['MA101-01', 'PE101-01', 'CS101-OLD']) {
      await pool.query('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
        id.student,
        id[key],
      ]);
    }
    await pool.query(
      `INSERT INTO enrolments (student_id, section_id, status, dropped_at)
       VALUES ($1, $2, 'DROPPED', now())`,
      [id.student, id['CS101-01']],
    );
    await pool.query(
      `INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
       VALUES ($1, $2, '2025-1', 4.5, false), ($1, $2, '2025-2', 8.25, true)`,
      [id.student, id.CS101],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('Danh sách học kỳ: mới nhất trước, có registrationOpen', async () => {
    const semesters = await createSemesterRepository(pool).list();
    expect(semesters.map((s) => [s.code, s.registrationOpen])).toEqual([
      ['2026-1', true],
      ['2025-2', false],
    ]);
    expect(semesters[0]).toMatchObject({ id: id.current, maxCredits: 24 });
  });

  it('Học kỳ hiện tại: đang mở đăng ký', async () => {
    expect(await createSemesterRepository(pool).current()).toMatchObject({
      code: '2026-1',
      registrationOpen: true,
    });
  });

  it('Thời khóa biểu: chỉ lớp ENROLLED của học kỳ, xếp theo thứ và tiết, tín chỉ tính cả lớp chưa có lịch', async () => {
    const schedule = await createStudentRepository(pool).schedule(id.student);
    expect(schedule).toMatchObject({ semesterId: id.current, totalCredits: 4, maxCredits: 24 });
    expect(schedule?.entries.map((e) => [e.sectionCode, e.dayOfWeek, e.startPeriod])).toEqual([
      ['MA101-01', 1, 4],
      ['MA101-01', 3, 1],
    ]);
    expect(schedule?.entries[0]).toMatchObject({ courseCode: 'MA101', credits: 3, room: 'A101' });
  });

  it('Thời khóa biểu theo học kỳ khác; học kỳ không tồn tại thì null', async () => {
    const old = await createStudentRepository(pool).schedule(id.student, id.old);
    expect(old).toMatchObject({ totalCredits: 4, maxCredits: 20 });
    expect(old?.entries.map((e) => e.sectionCode)).toEqual(['CS101-OLD']);
    expect(await createStudentRepository(pool).schedule(id.student, 999999)).toBeNull();
  });

  it('Kết quả học: cả lần rớt và lần đạt, điểm là số', async () => {
    expect(await createStudentRepository(pool).completedCourses(id.student)).toEqual([
      {
        course: { id: id.CS101, code: 'CS101', name: 'CS101', credits: 4, description: null },
        semesterCode: '2025-1',
        grade: 4.5,
        passed: false,
      },
      {
        course: { id: id.CS101, code: 'CS101', name: 'CS101', credits: 4, description: null },
        semesterCode: '2025-2',
        grade: 8.25,
        passed: true,
      },
    ]);
  });
});
