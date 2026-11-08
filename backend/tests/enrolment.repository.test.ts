import type { Database } from '../src/registration/enrolment.repository';
import { createEnrolmentRepository } from '../src/registration/enrolment.repository';

// CSDL giả: một client duy nhất, trả dòng theo câu SQL nhận được.
// Kiểm tra luồng transaction và cách đổi lỗi; câu SQL thật được kiểm tra ở enrolment.repository.db.test.ts.
function fakeDb(answer: (sql: string, params: unknown[]) => unknown[] | Error) {
  const sqls: string[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    sqls.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
    const rows = answer(sql, params);
    if (rows instanceof Error) throw rows;
    return { rows, rowCount: rows.length };
  });
  const release = jest.fn();
  const db = { query, connect: jest.fn(async () => ({ query, release })) };
  return { db: db as unknown as Database, query, release, sqls };
}

// Dữ kiện hợp lệ cho lớp 21 (môn 2, học kỳ 5): còn chỗ, không trùng lịch, đủ tín chỉ.
function validFacts(sql: string): unknown[] | null {
  if (sql.includes('max_credits'))
    return [
      {
        section_id: '21',
        section_code: 'CS201-01',
        course_id: '2',
        course_credits: 4,
        semester_id: '5',
        max_credits: 24,
        registration_open: true,
        remaining_seats: 3,
      },
    ];
  if (sql.includes('FROM completed_courses')) return [];
  if (sql.includes('FROM prerequisites')) return [];
  if (sql.includes('LEFT JOIN section_slots')) return [];
  return null;
}

const registrationRow = {
  registration_id: '70',
  student_id: '402',
  status: 'ENROLLED',
  created_at: new Date('2026-11-08T10:00:00.000Z'),
  course_code: 'CS201',
  course_name: 'Data Structures',
  course_credits: 4,
  course_description: null,
  id: '21',
  course_id: '2',
  semester_id: '5',
  code: 'CS201-01',
  lecturer_name: null,
  capacity: 40,
  enrolled_count: 38,
  waitlist_count: 0,
  slots: [],
};

describe('createEnrolmentRepository (CSDL giả)', () => {
  it('register: khóa lớp rồi khóa sinh viên, ghi đăng ký, tăng số đã đăng ký, COMMIT', async () => {
    const { db, sqls, release } = fakeDb((sql) => {
      if (sql.includes('FOR UPDATE')) return [{ id: '1' }];
      if (sql.includes('INSERT INTO enrolments')) return [{ id: '70' }];
      if (sql.includes('course_description')) return [registrationRow];
      return validFacts(sql) ?? [];
    });
    const registration = await createEnrolmentRepository(db).register(402, 21);
    expect(registration).toMatchObject({
      id: 70,
      studentId: 402,
      status: 'ENROLLED',
      course: { id: 2, code: 'CS201' },
      section: { id: 21, remainingSeats: 2 },
      createdAt: '2026-11-08T10:00:00.000Z',
    });
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls.slice(1, 3)).toEqual(['SELECT id FROM', 'SELECT id FROM']);
    expect(sqls).toContain('UPDATE sections SET');
    expect(sqls.at(-1)).toBe('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('register: lớp không tồn tại thì 404 và ROLLBACK', async () => {
    const { db, sqls } = fakeDb(() => []);
    await expect(createEnrolmentRepository(db).register(402, 999)).rejects.toMatchObject({
      status: 404,
    });
    expect(sqls.at(-1)).toBe('ROLLBACK');
  });

  it('register: vi phạm đầu tiên thành lỗi (lớp đầy: 409 SECTION_FULL), không ghi gì', async () => {
    const { db, sqls } = fakeDb((sql) => {
      if (sql.includes('FOR UPDATE')) return [{ id: '1' }];
      const rows = validFacts(sql);
      if (sql.includes('max_credits')) return [{ ...(rows?.[0] as object), remaining_seats: 0 }];
      return rows ?? [];
    });
    await expect(createEnrolmentRepository(db).register(402, 21)).rejects.toMatchObject({
      code: 'SECTION_FULL',
      status: 409,
    });
    expect(sqls).not.toContain('INSERT INTO enrolments');
    expect(sqls.at(-1)).toBe('ROLLBACK');
  });

  it('register: trùng chỉ mục uq_enrolments_active (23505) thì 409 ALREADY_ENROLLED', async () => {
    const { db } = fakeDb((sql) => {
      if (sql.includes('FOR UPDATE')) return [{ id: '1' }];
      if (sql.includes('INSERT INTO enrolments')) {
        return Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      return validFacts(sql) ?? [];
    });
    await expect(createEnrolmentRepository(db).register(402, 21)).rejects.toMatchObject({
      code: 'ALREADY_ENROLLED',
      status: 409,
    });
  });

  const dropRow = (overrides: object = {}) => ({
    student_id: '402',
    section_id: '21',
    registration_open: true,
    ...overrides,
  });

  it('drop: lần đăng ký không tồn tại 404, của người khác 403, học kỳ đã đóng 403', async () => {
    const missing = fakeDb(() => []);
    await expect(createEnrolmentRepository(missing.db).drop(402, 1)).rejects.toMatchObject({
      status: 404,
    });
    const other = fakeDb(() => [dropRow({ student_id: '500' })]);
    await expect(createEnrolmentRepository(other.db).drop(402, 70)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    const closed = fakeDb(() => [dropRow({ registration_open: false })]);
    await expect(createEnrolmentRepository(closed.db).drop(402, 70)).rejects.toMatchObject({
      code: 'REGISTRATION_CLOSED',
      status: 403,
    });
  });

  it('drop: yêu cầu hủy thứ hai cùng lúc không đổi được dòng nào thì 404', async () => {
    const { db } = fakeDb((sql) => {
      if (sql.includes('UPDATE enrolments')) return [];
      if (sql.includes('FOR UPDATE')) return [{ id: '21' }];
      return [dropRow()];
    });
    await expect(createEnrolmentRepository(db).drop(402, 70)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('drop: người đầu hàng đã đạt môn thì SKIPPED, người kế tiếp PROMOTED', async () => {
    const statuses: [string, unknown][] = [];
    const { db, sqls } = fakeDb((sql, params) => {
      if (sql.includes('FROM enrolments e') && sql.includes('registration_open'))
        return [dropRow()];
      if (sql.includes('UPDATE enrolments')) return [{}];
      if (sql.includes('FROM waitlist_entries') && sql.includes('ORDER BY created_at'))
        return [
          { id: '1', student_id: '610' },
          { id: '2', student_id: '611' },
        ];
      if (sql.includes('UPDATE waitlist_entries')) {
        statuses.push([sql.includes('PROMOTED') ? 'PROMOTED' : 'SKIPPED', params[0]]);
        return [];
      }
      if (sql.includes('INSERT INTO enrolments')) return [{ id: '71' }];
      if (sql.includes('FROM completed_courses'))
        // std_610 đã đạt CS201 (môn 2) nên không còn đủ điều kiện
        return params[0] === 610 ? [{ course_id: '2', grade: '8', passed: true }] : [];
      if (sql.includes('FOR UPDATE')) return [{ id: '1' }];
      return validFacts(sql) ?? [];
    });
    await createEnrolmentRepository(db).drop(402, 70);
    expect(statuses).toEqual([
      ['SKIPPED', '1'],
      ['PROMOTED', '2'],
    ]);
    expect(sqls.at(-1)).toBe('COMMIT');
  });

  it('list: không truyền học kỳ thì truyền null để lấy học kỳ hiện tại', async () => {
    const { db, query } = fakeDb(() => [registrationRow]);
    const [registration] = await createEnrolmentRepository(db).list(402);
    expect(registration.id).toBe(70);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('COALESCE($2::bigint'), [402, null]);
  });
});
