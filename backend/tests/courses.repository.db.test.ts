import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createCourseRepository } from '../src/courses/courses.repository';

// Test trên PostgreSQL thật. Chỉ chạy khi có TEST_DATABASE_URL trỏ tới một CSDL tên kết thúc bằng _test
// (test xóa sạch và tạo lại bảng). Không có biến này (ví dụ trên CI hiện tại) thì bỏ qua.
const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('createCourseRepository trên PostgreSQL', () => {
  let pool: Pool;
  const ids: Record<string, number> = {};

  // Chèn một dòng và trả về id.
  async function insert(sql: string, params: unknown[]): Promise<number> {
    const { rows } = await pool.query<{ id: string }>(`${sql} RETURNING id`, params);
    return Number(rows[0].id);
  }

  beforeAll(async () => {
    const database = new URL(url as string).pathname.slice(1);
    if (!database.endsWith('_test')) {
      throw new Error(
        `TEST_DATABASE_URL phải trỏ tới CSDL tên kết thúc bằng _test (đang là ${database}).`,
      );
    }
    pool = new Pool({ connectionString: url });

    // Tạo lại toàn bộ bảng từ các file migration của Phúc.
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const dir = join(__dirname, '../db/migrations');
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await pool.query(readFileSync(join(dir, file), 'utf8'));
    }

    // Dữ liệu tối thiểu theo Gherkin US-02, US-03.
    const userId = await insert(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, 'x', 'Student 402', 'STUDENT')`,
      ['std_402@student.edu.vn'],
    );
    ids.student = await insert(
      `INSERT INTO students (user_id, student_code) VALUES ($1, 'std_402')`,
      [userId],
    );
    ids.oldSemester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end)
       VALUES ('2025-2', 'Học kỳ cũ', now() - interval '200 days', now() - interval '170 days')`,
      [],
    );
    ids.currentSemester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end)
       VALUES ('2026-1', 'Học kỳ hiện tại', now() - interval '7 days', now() + interval '60 days')`,
      [],
    );
    for (const [code, name] of [
      ['CS101', 'Introduction to Programming'],
      ['CS201', 'Data Structures and Algorithms'],
      ['CS301', 'Design and Analysis of Algorithms'],
      ['MA101', 'Calculus 1'],
    ]) {
      ids[code] = await insert(`INSERT INTO courses (code, name, credits) VALUES ($1, $2, 4)`, [
        code,
        name,
      ]);
    }
    // Thêm 41 môn để danh mục có 45 môn (Gherkin "Paginated catalog").
    for (let i = 1; i <= 41; i++) {
      await pool.query(`INSERT INTO courses (code, name, credits) VALUES ($1, $2, 3)`, [
        `GE${String(i).padStart(3, '0')}`,
        `General Education ${i}`,
      ]);
    }
    await pool.query(
      'INSERT INTO prerequisites (course_id, prerequisite_id) VALUES ($1, $2), ($3, $4)',
      [ids.CS201, ids.CS101, ids.CS301, ids.CS201],
    );
    await pool.query(
      `INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
       VALUES ($1, $2, '2025-2', 8.5, true)`,
      [ids.student, ids.CS101],
    );

    // CS201 có 2 lớp ở học kỳ hiện tại và 1 lớp ở học kỳ cũ.
    const section = (code: string, semesterId: number, enrolled: number) =>
      insert(
        `INSERT INTO sections (course_id, semester_id, code, capacity, enrolled_count)
         VALUES ($1, $2, $3, 40, $4)`,
        [ids.CS201, semesterId, code, enrolled],
      );
    ids.s01 = await section('CS201-01', ids.currentSemester, 40);
    ids.s02 = await section('CS201-02', ids.currentSemester, 37);
    ids.sOld = await section('CS201-01', ids.oldSemester, 10);
    await pool.query(
      `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room) VALUES
       ($1, 3, 1, 3, 'B202'), ($1, 1, 4, 6, 'A101'), ($2, 1, 4, 6, 'A102')`,
      [ids.s01, ids.s02],
    );
    // Lớp 01 đầy: 1 người đang chờ, 1 người đã rời hàng (không tính).
    await pool.query(
      `INSERT INTO waitlist_entries (student_id, section_id, status) VALUES ($1, $2, 'WAITING'), ($1, $2, 'CANCELLED')`,
      [ids.student, ids.s01],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  const repo = () => createCourseRepository(pool);

  it('Gherkin "Search by keyword": q=data tìm thấy CS201 kèm tên và tín chỉ', async () => {
    const { items, total } = await repo().search({ q: 'data', page: 1, pageSize: 20 });
    expect(total).toBe(1);
    expect(items).toEqual([
      {
        id: ids.CS201,
        code: 'CS201',
        name: 'Data Structures and Algorithms',
        credits: 4,
        description: null,
      },
    ]);
  });

  it('Tìm theo mã, không phân biệt hoa thường', async () => {
    const { items } = await repo().search({ q: 'cs2', page: 1, pageSize: 20 });
    expect(items.map((c) => c.code)).toEqual(['CS201']);
  });

  it('Gherkin "Search with no matching course": danh sách rỗng; ký tự % được tìm theo nghĩa đen', async () => {
    expect(await repo().search({ q: 'zzzz', page: 1, pageSize: 20 })).toEqual({
      items: [],
      total: 0,
    });
    expect((await repo().search({ q: '%', page: 1, pageSize: 20 })).total).toBe(0);
  });

  it('Gherkin "Paginated catalog": 45 môn, trang 2 có 20 môn, trang 3 còn 5 môn', async () => {
    const page2 = await repo().search({ q: '', page: 2, pageSize: 20 });
    expect(page2.total).toBe(45);
    expect(page2.items).toHaveLength(20);
    expect((await repo().search({ q: '', page: 3, pageSize: 20 })).items).toHaveLength(5);
  });

  it('Gherkin "View course details": tiên quyết CS101, 2 lớp học kỳ hiện tại kèm lịch, sĩ số, chỗ còn', async () => {
    const detail = await repo().findDetail(ids.CS201, {});
    expect(detail?.prerequisites.map((c) => c.code)).toEqual(['CS101']);
    expect(detail?.sections.map((s) => s.code)).toEqual(['CS201-01', 'CS201-02']);
    const [full, open] = detail?.sections ?? [];
    expect(full).toMatchObject({
      capacity: 40,
      enrolledCount: 40,
      remainingSeats: 0,
      waitlistCount: 1,
    });
    // Lịch xếp theo thứ trong tuần rồi theo tiết.
    expect(full.slots).toEqual([
      { dayOfWeek: 1, startPeriod: 4, endPeriod: 6, room: 'A101' },
      { dayOfWeek: 3, startPeriod: 1, endPeriod: 3, room: 'B202' },
    ]);
    expect(open).toMatchObject({
      remainingSeats: 3,
      waitlistCount: 0,
      semesterId: ids.currentSemester,
    });
  });

  it('Gherkin "Prerequisite status": sinh viên đã đạt CS101 thì passed true; chưa học CS201 thì false', async () => {
    const cs201 = await repo().findDetail(ids.CS201, { studentId: ids.student });
    expect(cs201?.prerequisites).toEqual([
      expect.objectContaining({ code: 'CS101', passed: true }),
    ]);
    const cs301 = await repo().findDetail(ids.CS301, { studentId: ids.student });
    expect(cs301?.prerequisites).toEqual([
      expect.objectContaining({ code: 'CS201', passed: false }),
    ]);
  });

  it('Truyền semesterId thì lấy lớp của học kỳ đó; môn không có lớp thì sections rỗng', async () => {
    const old = await repo().findDetail(ids.CS201, { semesterId: ids.oldSemester });
    expect(old?.sections.map((s) => [s.id, s.semesterId])).toEqual([[ids.sOld, ids.oldSemester]]);
    expect((await repo().findDetail(ids.MA101, {}))?.sections).toEqual([]);
  });

  it('Gherkin "Course does not exist": trả null (route chuyển thành 404)', async () => {
    expect(await repo().findDetail(999999, {})).toBeNull();
  });
});
