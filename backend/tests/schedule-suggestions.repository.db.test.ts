import type { Pool } from 'pg';
import { createSuggestionRepository } from '../src/suggestions/schedule-suggestions';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Đọc dữ liệu cho gợi ý thời khóa biểu trên PostgreSQL thật.
describeDb('Dữ liệu gợi ý thời khóa biểu trên PostgreSQL', () => {
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
      ['CS201', 4],
      ['MA101', 3],
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
       VALUES ($1, $2, '2025-2', 8, TRUE)`,
      [id.student, id.CS101],
    );
    const section = async (code: string, course: string, semester: number, capacity = 40) => {
      id[code] = await insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity) VALUES ($1, $2, $3, $4)`,
        [id[course], semester, code, capacity],
      );
    };
    await section('MA101-01', 'MA101', id.current);
    await section('CS201-01', 'CS201', id.current, 2);
    await section('CS201-02', 'CS201', id.current);
    await section('CS201-OLD', 'CS201', id.old);
    for (const [code, day, start, end] of [
      ['MA101-01', 1, 1, 3],
      ['CS201-01', 1, 2, 4],
      ['CS201-02', 3, 7, 9],
      ['CS201-02', 1, 4, 6],
    ] as const) {
      await pool.query(
        `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room)
         VALUES ($1, $2, $3, $4, 'A1')`,
        [id[code], day, start, end],
      );
    }
    await pool.query('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
      id.student,
      id['MA101-01'],
    ]);
    await pool.query('UPDATE sections SET enrolled_count = 1 WHERE id = $1', [id['MA101-01']]);
    await pool.query('UPDATE sections SET enrolled_count = 2 WHERE id = $1', [id['CS201-01']]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('đọc môn, tiên quyết, lớp đang học và các lớp của học kỳ hiện tại', async () => {
    const data = await createSuggestionRepository(pool).read(id.student, [id.CS201, 999]);
    expect(data).toMatchObject({ semesterId: id.current, maxCredits: 24 });
    expect(data?.courses).toEqual([{ id: id.CS201, code: 'CS201', name: 'CS201', credits: 4 }]);
    expect(data?.passedCourseIds).toEqual([id.CS101]);
    expect(data?.prerequisites).toEqual([
      { courseId: id.CS201, prerequisite: { id: id.CS101, code: 'CS101', name: 'CS101' } },
    ]);
    expect(data?.enrolled.map((s) => s.sectionCode)).toEqual(['MA101-01']);
    // Lớp của học kỳ cũ không xuất hiện; lớp đầy vẫn đọc ra với remainingSeats = 0.
    expect(data?.sections.map((s) => [s.sectionCode, s.remainingSeats])).toEqual([
      ['CS201-01', 0],
      ['CS201-02', 40],
    ]);
    // Lịch sắp theo thứ rồi tiết.
    expect(data?.sections[1].slots).toEqual([
      { dayOfWeek: 1, startPeriod: 4, endPeriod: 6, room: 'A1' },
      { dayOfWeek: 3, startPeriod: 7, endPeriod: 9, room: 'A1' },
    ]);
  });

  it('chưa có học kỳ nào thì trả null', async () => {
    const empty = await openFreshTestDatabase();
    try {
      expect(await createSuggestionRepository(empty).read(id.student, [id.CS201])).toBeNull();
    } finally {
      await empty.end();
    }
  });
});
