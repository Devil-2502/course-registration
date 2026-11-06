import type { Queryable } from '../src/courses/courses.repository';
import { createWaitlistRepository } from '../src/waitlist/waitlist.repository';

// CSDL giả: kiểm tra phần chuyển đổi dữ liệu và xử lý lỗi mà không cần PostgreSQL.
// Câu SQL thật được kiểm tra ở waitlist.repository.db.test.ts.
function fakeDb(answer: (sql: string) => unknown[]) {
  const query = jest.fn(async (sql: string) => ({ rows: answer(sql) }));
  return { db: { query } as unknown as Queryable, query };
}

const entryRow = {
  entry_id: '30',
  student_id: '402',
  status: 'WAITING',
  created_at: new Date('2026-10-23T10:00:00.000Z'),
  position: 2,
  id: '21',
  course_id: '2',
  semester_id: '5',
  code: 'CS201-01',
  lecturer_name: null,
  capacity: 40,
  enrolled_count: 40,
  waitlist_count: 3,
  slots: [{ dayOfWeek: 2, startPeriod: 1, endPeriod: 3, room: 'A101' }],
};

describe('createWaitlistRepository (CSDL giả)', () => {
  it('readJoinFacts: lớp không tồn tại thì null, không truy vấn tiếp', async () => {
    const { db, query } = fakeDb(() => []);
    expect(await createWaitlistRepository(db).readJoinFacts(402, 999)).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('readJoinFacts: gom dữ kiện, môn tiên quyết rớt (điểm 4.5) vẫn tính là thiếu', async () => {
    const { db } = fakeDb((sql) => {
      if (sql.includes('remaining_seats'))
        return [{ course_id: '2', semester_id: '5', registration_open: true, remaining_seats: 0 }];
      if (sql.includes('AS waiting')) return [{ enrolled: false, waiting: true }];
      if (sql.includes('FROM completed_courses'))
        return [{ course_id: '1', grade: '4.50', passed: false }];
      return [{ id: '1', code: 'CS101', name: 'Introduction to Programming' }];
    });
    expect(await createWaitlistRepository(db).readJoinFacts(402, 21)).toEqual({
      registrationOpen: true,
      enrolledInSameCourse: false,
      alreadyWaiting: true,
      missingPrerequisites: [{ id: 1, code: 'CS101', name: 'Introduction to Programming' }],
      remainingSeats: 0,
    });
  });

  it('listForStudent: đổi id sang số, kèm lớp học phần và vị trí', async () => {
    const { db, query } = fakeDb(() => [entryRow]);
    const [entry] = await createWaitlistRepository(db).listForStudent(402);
    expect(entry).toMatchObject({
      id: 30,
      studentId: 402,
      sectionId: 21,
      position: 2,
      status: 'WAITING',
      createdAt: '2026-10-23T10:00:00.000Z',
      section: { id: 21, code: 'CS201-01', remainingSeats: 0, waitlistCount: 3 },
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('w.student_id = $1'), [402, null]);
  });

  it('join: trùng chỉ mục uq_waitlist_waiting (mã 23505) thì 409 ALREADY_ON_WAITLIST', async () => {
    const query = jest.fn(async () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    });
    const repository = createWaitlistRepository({ query } as unknown as Queryable);
    await expect(repository.join(402, 21)).rejects.toMatchObject({
      code: 'ALREADY_ON_WAITLIST',
      status: 409,
    });
  });

  it('join: lỗi CSDL khác thì ném nguyên lỗi', async () => {
    const query = jest.fn(async () => {
      throw new Error('connection lost');
    });
    const repository = createWaitlistRepository({ query } as unknown as Queryable);
    await expect(repository.join(402, 21)).rejects.toThrow('connection lost');
  });

  it('findEntry: không có thì null; có thì đổi studentId sang số', async () => {
    const empty = fakeDb(() => []);
    expect(await createWaitlistRepository(empty.db).findEntry(99)).toBeNull();
    const found = fakeDb(() => [{ student_id: '402', status: 'WAITING' }]);
    expect(await createWaitlistRepository(found.db).findEntry(30)).toEqual({
      studentId: 402,
      status: 'WAITING',
    });
  });
});
