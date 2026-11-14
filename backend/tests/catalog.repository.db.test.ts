import type { Pool } from 'pg';
import { createCatalogRepository } from '../src/admin/catalog.repository';
import { describeDb, insertReturningId, openFreshTestDatabase } from './helpers/test-db';

// Quản lý môn, lớp và môn tiên quyết trên PostgreSQL thật, theo Gherkin US-12 và US-13.
describeDb('createCatalogRepository trên PostgreSQL', () => {
  let pool: Pool;
  const id: Record<string, number> = {};
  const insert = (sql: string, params: unknown[] = []) => insertReturningId(pool, sql, params);
  const repo = () => createCatalogRepository(pool);
  const slots = [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' }];

  beforeAll(async () => {
    pool = await openFreshTestDatabase();
    id.semester = await insert(
      `INSERT INTO semesters (code, name, registration_start, registration_end, max_credits)
       VALUES ('2026-1', 'Hiện tại', now() - interval '7 days', now() + interval '60 days', 24)`,
    );
    for (const code of ['CS101', 'CS201', 'CS301', 'EN101']) {
      id[code] = await insert(`INSERT INTO courses (code, name, credits) VALUES ($1, $1, 4)`, [
        code,
      ]);
    }
    // CS201 cần CS101, CS301 cần CS201
    for (const [course, prerequisite] of [
      ['CS201', 'CS101'],
      ['CS301', 'CS201'],
    ]) {
      await pool.query('INSERT INTO prerequisites (course_id, prerequisite_id) VALUES ($1, $2)', [
        id[course],
        id[prerequisite],
      ]);
    }
    // 4 sinh viên: std_1, std_2 đang học EN101-01 (sức chứa 2, đầy); std_3, std_4 đang chờ.
    for (const code of ['std_1', 'std_2', 'std_3', 'std_4']) {
      const userId = await insert(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, 'x', $2, 'STUDENT')`,
        [`${code}@student.edu.vn`, `Sinh viên ${code}`],
      );
      id[code] = await insert(`INSERT INTO students (user_id, student_code) VALUES ($1, $2)`, [
        userId,
        code,
      ]);
    }
    id['EN101-01'] = await insert(
      `INSERT INTO sections (course_id, semester_id, code, capacity, enrolled_count)
       VALUES ($1, $2, 'EN101-01', 2, 2)`,
      [id.EN101, id.semester],
    );
    for (const student of ['std_1', 'std_2']) {
      await pool.query('INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)', [
        id[student],
        id['EN101-01'],
      ]);
    }
    for (const student of ['std_3', 'std_4']) {
      await pool.query('INSERT INTO waitlist_entries (student_id, section_id) VALUES ($1, $2)', [
        id[student],
        id['EN101-01'],
      ]);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('Gherkin "Create a course" và "Duplicate course code"', async () => {
    const created = await repo().createCourse({
      code: 'CS401',
      name: 'Machine Learning',
      credits: 3,
      description: null,
    });
    expect(created).toMatchObject({ code: 'CS401', credits: 3 });
    id.CS401 = created.id;
    await expect(
      repo().createCourse({ code: 'CS201', name: 'D', credits: 4, description: null }),
    ).rejects.toMatchObject({ code: 'COURSE_CODE_EXISTS', status: 409 });
  });

  it('Sửa môn: đổi tên; đổi sang mã đã có thì 409; môn không tồn tại thì null', async () => {
    const input = { code: 'CS401', name: 'ML', credits: 4, description: 'Học máy' };
    expect(await repo().updateCourse(id.CS401, input)).toMatchObject({ name: 'ML', credits: 4 });
    await expect(repo().updateCourse(id.CS401, { ...input, code: 'CS101' })).rejects.toMatchObject({
      code: 'COURSE_CODE_EXISTS',
    });
    expect(await repo().updateCourse(999999, input)).toBeNull();
  });

  it('Gherkin "Add a prerequisite": trả danh sách tiên quyết mới; thêm lần hai thì 409', async () => {
    const list = await repo().addPrerequisite(id.CS401, id.CS301);
    expect(list.map((c) => c.code)).toEqual(['CS301']);
    await expect(repo().addPrerequisite(id.CS401, id.CS301)).rejects.toMatchObject({
      code: 'PREREQUISITE_EXISTS',
      status: 409,
    });
  });

  it('Gherkin "Reject a relationship that creates a cycle": nêu đường đi của vòng', async () => {
    await expect(repo().addPrerequisite(id.CS101, id.CS301)).rejects.toMatchObject({
      code: 'PREREQUISITE_CYCLE',
      status: 409,
      details: { path: ['CS101', 'CS301', 'CS201', 'CS101'] },
    });
    await expect(repo().addPrerequisite(id.CS201, id.CS201)).rejects.toMatchObject({
      code: 'PREREQUISITE_CYCLE',
    });
    await expect(repo().addPrerequisite(id.CS201, 999999)).rejects.toMatchObject({ status: 404 });
  });

  it('Gherkin "Remove a prerequisite"; gỡ quan hệ không có thì false', async () => {
    expect(await repo().removePrerequisite(id.CS401, id.CS301)).toBe(true);
    expect(await repo().removePrerequisite(id.CS401, id.CS301)).toBe(false);
    expect(await repo().listPrerequisites(id.CS401)).toEqual([]);
    expect(await repo().listPrerequisites(999999)).toBeNull();
  });

  it('Gherkin "Create a section with a schedule"; trùng mã lớp thì 409', async () => {
    const input = {
      courseId: id.CS201,
      semesterId: id.semester,
      code: 'CS201-04',
      lecturerName: 'TS. A',
      capacity: 40,
      slots,
    };
    const section = await repo().createSection(input);
    expect(section).toMatchObject({ code: 'CS201-04', capacity: 40, remainingSeats: 40, slots });
    id['CS201-04'] = section.id;
    await expect(repo().createSection(input)).rejects.toMatchObject({
      code: 'SECTION_CODE_EXISTS',
    });
    await expect(repo().createSection({ ...input, courseId: 999999 })).rejects.toMatchObject({
      status: 404,
    });
    const listed = await repo().listSections({ courseId: id.CS201 });
    expect(listed.map((s) => s.code)).toEqual(['CS201-04']);
  });

  it('Sửa lớp: đổi lịch; lớp không tồn tại thì null', async () => {
    const input = {
      courseId: id.CS201,
      semesterId: id.semester,
      code: 'CS201-04',
      lecturerName: null,
      capacity: 35,
      slots: [{ dayOfWeek: 3, startPeriod: 7, endPeriod: 9, room: null }],
    };
    expect(await repo().updateSection(id['CS201-04'], input)).toMatchObject({
      capacity: 35,
      lecturerName: null,
      slots: input.slots,
    });
    expect(await repo().updateSection(999999, input)).toBeNull();
  });

  it('Danh sách lớp và hàng chờ kèm mã, tên sinh viên', async () => {
    const enrolments = await repo().listEnrolments(id['EN101-01']);
    expect(enrolments?.map((e) => [e.studentCode, e.studentName])).toEqual([
      ['std_1', 'Sinh viên std_1'],
      ['std_2', 'Sinh viên std_2'],
    ]);
    const waitlist = await repo().listWaitlist(id['EN101-01']);
    expect(waitlist?.map((w) => [w.studentCode, w.position])).toEqual([
      ['std_3', 1],
      ['std_4', 2],
    ]);
    expect(await repo().listEnrolments(999999)).toBeNull();
  });

  it('Gherkin "Reduce capacity below the number of enrolled students": 409', async () => {
    await expect(
      repo().updateSection(id['EN101-01'], {
        courseId: id.EN101,
        semesterId: id.semester,
        code: 'EN101-01',
        lecturerName: null,
        capacity: 1,
        slots,
      }),
    ).rejects.toMatchObject({
      code: 'CAPACITY_BELOW_ENROLLED',
      details: { capacity: 1, enrolledCount: 2 },
    });
  });

  it('Tăng sức chứa trong đợt đăng ký: người đầu hàng chờ được xếp vào chỗ mới', async () => {
    const section = await repo().updateSection(id['EN101-01'], {
      courseId: id.EN101,
      semesterId: id.semester,
      code: 'EN101-01',
      lecturerName: null,
      capacity: 3,
      slots,
    });
    expect(section).toMatchObject({ capacity: 3, enrolledCount: 3, waitlistCount: 1 });
    const waitlist = await repo().listWaitlist(id['EN101-01']);
    expect(waitlist?.map((w) => [w.studentCode, w.status, w.position])).toEqual([
      ['std_4', 'WAITING', 1],
      ['std_3', 'PROMOTED', null],
    ]);
  });
});
