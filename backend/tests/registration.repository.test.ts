import type { Queryable } from '../src/courses/courses.repository';
import { createRegistrationRepository } from '../src/registration/registration.repository';

// CSDL giả: kiểm tra phần gom dữ kiện mà không cần PostgreSQL.
// Câu SQL thật được kiểm tra ở registration.repository.db.test.ts.
function fakeDb(rowsFor: (sql: string) => unknown[]) {
  const query = jest.fn(async (sql: string) => ({ rows: rowsFor(sql) }));
  return { db: { query } as unknown as Queryable, query };
}

const target = {
  section_id: '22',
  section_code: 'CS201-02',
  course_id: '2',
  course_credits: 4,
  semester_id: '5',
  max_credits: 24,
  registration_open: true,
  remaining_seats: 3,
};

// Mỗi dòng là một buổi học; lớp chưa có lịch thì cột lịch là null (LEFT JOIN).
const slot = (
  sectionId: string,
  code: string,
  courseId: string,
  credits: number,
  day: number | null,
) => ({
  section_id: sectionId,
  section_code: code,
  course_id: courseId,
  credits,
  day_of_week: day,
  start_period: day === null ? null : 4,
  end_period: day === null ? null : 6,
});

function answer(sql: string): unknown[] {
  if (sql.includes('max_credits')) return [target];
  if (sql.includes('FROM completed_courses'))
    return [{ course_id: '1', grade: '4.50', passed: false }];
  if (sql.includes('FROM prerequisites'))
    return [{ id: '1', code: 'CS101', name: 'Introduction to Programming' }];
  return [
    slot('22', 'CS201-02', '2', 4, 1),
    slot('22', 'CS201-02', '2', 4, 3),
    slot('11', 'MA101-01', '3', 3, 1),
    slot('12', 'PE101-01', '4', 2, null),
  ];
}

describe('createRegistrationRepository (CSDL giả)', () => {
  it('Lớp không tồn tại: null, không truy vấn tiếp', async () => {
    const { db, query } = fakeDb(() => []);
    expect(await createRegistrationRepository(db).readFacts(402, 999)).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('Gom dữ kiện: rớt môn tiên quyết, trùng lịch, cộng tín chỉ các lớp đang học', async () => {
    const { db, query } = fakeDb(answer);
    const facts = await createRegistrationRepository(db).readFacts(402, 22);
    expect(facts).toEqual({
      registrationOpen: true,
      enrolledInSameCourse: false,
      alreadyPassed: false,
      // Điểm 4.5 không đạt nên CS101 vẫn thiếu
      missingPrerequisites: [{ id: 1, code: 'CS101', name: 'Introduction to Programming' }],
      // MA101-01 cùng thứ Hai tiết 4-6; PE101-01 chưa có lịch nên không trùng
      clashesWith: [{ sectionId: 11, sectionCode: 'MA101-01' }],
      credit: { allowed: true, currentCredits: 5, requestedCredits: 4, limit: 24 },
      remainingSeats: 3,
    });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("e.status = 'ENROLLED'"), [
      22,
      402,
      '5',
    ]);
  });

  it('Lớp muốn đăng ký chưa có lịch: không trùng với lớp nào', async () => {
    const { db } = fakeDb((sql) =>
      sql.includes('LEFT JOIN section_slots') ? [slot('11', 'MA101-01', '3', 3, 1)] : answer(sql),
    );
    const facts = await createRegistrationRepository(db).readFacts(402, 22);
    expect(facts?.clashesWith).toEqual([]);
  });
});
