import {
  createCourseRepository,
  toLikePattern,
  type Queryable,
} from '../src/courses/courses.repository';

// CSDL giả: trả dòng theo câu SQL nhận được, để kiểm tra phần chuyển đổi dữ liệu mà không cần PostgreSQL.
// Câu SQL thật được kiểm tra trên PostgreSQL ở courses.repository.db.test.ts.
function fakeDb(answer: (sql: string, params: unknown[]) => unknown[]) {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => ({
    rows: answer(sql, params),
  }));
  return { db: { query } as unknown as Queryable, query };
}

const cs201 = {
  id: '2',
  code: 'CS201',
  name: 'Data Structures and Algorithms',
  credits: 4,
  description: null,
};
const cs101 = {
  id: '1',
  code: 'CS101',
  name: 'Introduction to Programming',
  credits: 4,
  description: null,
};

describe('toLikePattern', () => {
  it('Bọc từ khóa bằng % để tìm chuỗi con', () => {
    expect(toLikePattern('data')).toBe('%data%');
  });

  it('Thoát ký tự đặc biệt của LIKE: %, _ và \\', () => {
    expect(toLikePattern('100%_a\\b')).toBe('%100\\%\\_a\\\\b%');
  });
});

describe('createCourseRepository (CSDL giả)', () => {
  it('search: đổi id sang số, trả total, tính OFFSET theo trang', async () => {
    const { db, query } = fakeDb((sql) => (sql.includes('COUNT(*)') ? [{ total: 45 }] : [cs201]));
    const result = await createCourseRepository(db).search({ q: 'data', page: 3, pageSize: 20 });
    expect(result).toEqual({
      items: [
        {
          id: 2,
          code: 'CS201',
          name: 'Data Structures and Algorithms',
          credits: 4,
          description: null,
        },
      ],
      total: 45,
    });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT $3 OFFSET $4'), [
      'data',
      '%data%',
      20,
      40,
    ]);
  });

  it('findDetail: môn không tồn tại thì null, không truy vấn tiếp', async () => {
    const { db, query } = fakeDb(() => []);
    expect(await createCourseRepository(db).findDetail(999, {})).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  const detailDb = () =>
    fakeDb((sql) => {
      if (sql.includes('FROM prerequisites')) return [{ ...cs101, passed: true }];
      if (sql.includes('FROM sections')) {
        return [
          {
            id: '21',
            course_id: '2',
            semester_id: '2',
            code: 'CS201-01',
            lecturer_name: null,
            capacity: 40,
            enrolled_count: 40,
            waitlist_count: 2,
            slots: [{ dayOfWeek: 1, startPeriod: 4, endPeriod: 6, room: 'A101' }],
          },
        ];
      }
      return [cs201];
    });

  it('findDetail của sinh viên: có passed, lớp đầy thì remainingSeats 0', async () => {
    const { db, query } = detailDb();
    const detail = await createCourseRepository(db).findDetail(2, { studentId: 402 });
    expect(detail?.prerequisites).toEqual([{ ...cs101, id: 1, passed: true }]);
    expect(detail?.sections[0]).toMatchObject({
      id: 21,
      courseId: 2,
      semesterId: 2,
      remainingSeats: 0,
      waitlistCount: 2,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM prerequisites'), [2, 402]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM sections'), [2, null]);
  });

  it('findDetail của quản trị viên (không có studentId): bỏ trường passed', async () => {
    const { db } = detailDb();
    const detail = await createCourseRepository(db).findDetail(2, { semesterId: 1 });
    expect(detail?.prerequisites[0]).not.toHaveProperty('passed');
  });
});
