import type { Pool } from 'pg';
import type { CourseQuery } from './course-query';
import type { CourseReader } from './courses.routes';
import type {
  Course,
  CourseDetail,
  PrerequisiteStatus,
  ScheduleSlot,
  Section,
} from './courses.types';

// Chỉ cần hàm query: app truyền pool dùng chung, test truyền pool tới CSDL test.
export type Queryable = Pick<Pool, 'query'>;

// pg trả cột BIGINT dưới dạng chuỗi, nên đổi id sang số trước khi trả cho client.
interface CourseRow {
  id: string;
  code: string;
  name: string;
  credits: number;
  description: string | null;
}

export interface SectionRow {
  id: string;
  course_id: string;
  semester_id: string;
  code: string;
  lecturer_name: string | null;
  capacity: number;
  enrolled_count: number;
  waitlist_count: number;
  slots: ScheduleSlot[];
}

const COURSE_COLUMNS = 'c.id, c.code, c.name, c.credits, c.description';

// Các cột của một lớp học phần (bảng sections, bí danh s), kèm số người đang chờ và lịch học.
// Dùng chung cho chi tiết môn và hàng chờ.
export const SECTION_COLUMNS = `s.id, s.course_id, s.semester_id, s.code, s.lecturer_name,
  s.capacity, s.enrolled_count,
  (SELECT COUNT(*)::int FROM waitlist_entries w
    WHERE w.section_id = s.id AND w.status = 'WAITING') AS waitlist_count,
  COALESCE((
    SELECT json_agg(json_build_object(
      'dayOfWeek', sl.day_of_week, 'startPeriod', sl.start_period,
      'endPeriod', sl.end_period, 'room', sl.room
    ) ORDER BY sl.day_of_week, sl.start_period)
    FROM section_slots sl WHERE sl.section_id = s.id
  ), '[]'::json) AS slots`;

// Học kỳ hiện tại: đang trong thời gian đăng ký; nếu không có thì học kỳ bắt đầu gần nhất.
export const CURRENT_SEMESTER_SQL = `
  SELECT id FROM semesters
  ORDER BY (now() BETWEEN registration_start AND registration_end) DESC, registration_start DESC
  LIMIT 1`;

// Từ khóa người dùng gõ có thể chứa % hoặc _ (ký tự đặc biệt của LIKE): thoát chúng để tìm đúng nghĩa đen.
export function toLikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function toCourse(row: CourseRow): Course {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    credits: row.credits,
    description: row.description,
  };
}

export function toSection(row: SectionRow): Section {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    semesterId: Number(row.semester_id),
    code: row.code,
    lecturerName: row.lecturer_name,
    capacity: row.capacity,
    enrolledCount: row.enrolled_count,
    remainingSeats: Math.max(row.capacity - row.enrolled_count, 0),
    waitlistCount: row.waitlist_count,
    slots: row.slots,
  };
}

// Bản CourseReader đọc PostgreSQL (US-02, US-03).
export function createCourseRepository(db: Queryable): CourseReader {
  return {
    async search({ q, page, pageSize }: CourseQuery) {
      // q rỗng thì không lọc; có q thì tìm trong mã hoặc tên, không phân biệt hoa thường.
      const where = `($1 = '' OR c.code ILIKE $2 OR c.name ILIKE $2)`;
      const params = [q, toLikePattern(q)];
      const count = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM courses c WHERE ${where}`,
        params,
      );
      const rows = await db.query<CourseRow>(
        `SELECT ${COURSE_COLUMNS} FROM courses c WHERE ${where}
         ORDER BY c.code LIMIT $3 OFFSET $4`,
        [...params, pageSize, (page - 1) * pageSize],
      );
      return { items: rows.rows.map(toCourse), total: count.rows[0].total };
    },

    async findDetail(courseId, { semesterId, studentId }) {
      const course = await db.query<CourseRow>(
        `SELECT ${COURSE_COLUMNS} FROM courses c WHERE c.id = $1`,
        [courseId],
      );
      if (course.rows.length === 0) return null;

      // Môn tiên quyết trực tiếp; passed chỉ tính khi người gọi là sinh viên.
      const prerequisites = await db.query<CourseRow & { passed: boolean }>(
        `SELECT ${COURSE_COLUMNS},
           EXISTS (
             SELECT 1 FROM completed_courses cc
             WHERE cc.course_id = c.id AND cc.student_id = $2 AND cc.passed
           ) AS passed
         FROM prerequisites p
         JOIN courses c ON c.id = p.prerequisite_id
         WHERE p.course_id = $1
         ORDER BY c.code`,
        [courseId, studentId ?? null],
      );

      // Các lớp của học kỳ được chọn (mặc định học kỳ hiện tại), kèm lịch học và số người đang chờ.
      const sections = await db.query<SectionRow>(
        `SELECT ${SECTION_COLUMNS}
         FROM sections s
         WHERE s.course_id = $1
           AND s.semester_id = COALESCE($2::bigint, (${CURRENT_SEMESTER_SQL}))
         ORDER BY s.code`,
        [courseId, semesterId ?? null],
      );

      const detail: CourseDetail = {
        ...toCourse(course.rows[0]),
        prerequisites: prerequisites.rows.map(({ passed, ...row }): PrerequisiteStatus =>
          studentId === undefined ? toCourse(row) : { ...toCourse(row), passed },
        ),
        sections: sections.rows.map(toSection),
      };
      return detail;
    },
  };
}
