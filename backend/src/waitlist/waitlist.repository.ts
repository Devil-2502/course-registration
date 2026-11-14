import { AppError } from '../common/app-error';
import {
  SECTION_COLUMNS,
  toSection,
  type Queryable,
  type SectionRow,
} from '../courses/courses.repository';
import { findMissingPrerequisites, type CourseAttempt } from '../registration/prerequisite-check';
import type { CourseRef } from '../registration/registration-rules';
import type { WaitlistStatus } from './waitlist-queue';
import type { WaitlistFacts } from './waitlist-rules';
import type { WaitlistEntryResponse, WaitlistStore } from './waitlist.routes';

interface TargetRow {
  course_id: string;
  semester_id: string;
  registration_open: boolean;
  remaining_seats: number;
}

// Một lượt chờ kèm lớp học phần; cột của lớp lấy theo SECTION_COLUMNS.
export interface EntryRow extends SectionRow {
  entry_id: string;
  student_id: string;
  status: WaitlistStatus;
  created_at: Date;
  position: number | null;
}

// Vị trí trong hàng (tính từ 1): số lượt WAITING cùng lớp vào trước hoặc cùng lúc mà id nhỏ hơn hay bằng.
// Cùng thứ tự với orderWaitingEntries trong waitlist-queue.ts. Lượt không còn WAITING thì null.
export const ENTRY_SQL = `
  SELECT w.id AS entry_id, w.student_id, w.status, w.created_at,
    CASE WHEN w.status = 'WAITING' THEN (
      SELECT COUNT(*)::int FROM waitlist_entries o
      WHERE o.section_id = w.section_id AND o.status = 'WAITING'
        AND (o.created_at, o.id) <= (w.created_at, w.id)
    ) END AS position,
    ${SECTION_COLUMNS}
  FROM waitlist_entries w
  JOIN sections s ON s.id = w.section_id`;

export function toEntry(row: EntryRow): WaitlistEntryResponse {
  const section = toSection(row);
  return {
    id: Number(row.entry_id),
    studentId: Number(row.student_id),
    sectionId: section.id,
    section,
    position: row.position,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// Mã lỗi PostgreSQL khi vi phạm ràng buộc UNIQUE.
// Đổi sang isUniqueViolation khi phần CSDL của Phúc merge.
const UNIQUE_VIOLATION = '23505';

// Bản WaitlistStore đọc và ghi PostgreSQL (US-09). Các luật vào hàng chờ xét ở waitlist-rules.ts.
export function createWaitlistRepository(db: Queryable): WaitlistStore {
  async function readEntries(where: string, params: unknown[]) {
    const { rows } = await db.query<EntryRow>(
      `${ENTRY_SQL} WHERE ${where} ORDER BY w.created_at, w.id`,
      params,
    );
    return rows.map(toEntry);
  }

  return {
    async readJoinFacts(studentId, sectionId) {
      const target = await db.query<TargetRow>(
        `SELECT s.course_id, s.semester_id,
           (now() BETWEEN sem.registration_start AND sem.registration_end) AS registration_open,
           GREATEST(s.capacity - s.enrolled_count, 0) AS remaining_seats
         FROM sections s
         JOIN semesters sem ON sem.id = s.semester_id
         WHERE s.id = $1`,
        [sectionId],
      );
      if (target.rows.length === 0) return null;
      const t = target.rows[0];

      // Đang học một lớp của môn này trong cùng học kỳ, và đang chờ ở chính lớp này.
      const status = await db.query<{ enrolled: boolean; waiting: boolean }>(
        `SELECT
           EXISTS (
             SELECT 1 FROM enrolments e JOIN sections es ON es.id = e.section_id
             WHERE e.student_id = $1 AND e.status = 'ENROLLED'
               AND es.course_id = $2 AND es.semester_id = $3
           ) AS enrolled,
           EXISTS (
             SELECT 1 FROM waitlist_entries w
             WHERE w.student_id = $1 AND w.section_id = $4 AND w.status = 'WAITING'
           ) AS waiting`,
        [studentId, t.course_id, t.semester_id, sectionId],
      );

      const attempts = await db.query<{ course_id: string; grade: string; passed: boolean }>(
        'SELECT course_id, grade, passed FROM completed_courses WHERE student_id = $1',
        [studentId],
      );
      const history: CourseAttempt[] = attempts.rows.map((a) => ({
        courseId: Number(a.course_id),
        grade: Number(a.grade),
        passed: a.passed,
      }));
      const prerequisites = await db.query<{ id: string; code: string; name: string }>(
        `SELECT c.id, c.code, c.name FROM prerequisites p
         JOIN courses c ON c.id = p.prerequisite_id
         WHERE p.course_id = $1 ORDER BY c.code`,
        [t.course_id],
      );
      const prerequisiteRefs: CourseRef[] = prerequisites.rows.map((c) => ({
        id: Number(c.id),
        code: c.code,
        name: c.name,
      }));

      const facts: WaitlistFacts = {
        registrationOpen: t.registration_open,
        enrolledInSameCourse: status.rows[0].enrolled,
        alreadyWaiting: status.rows[0].waiting,
        missingPrerequisites: findMissingPrerequisites(prerequisiteRefs, history),
        remainingSeats: t.remaining_seats,
      };
      return facts;
    },

    async join(studentId, sectionId) {
      let entryId: string;
      try {
        const { rows } = await db.query<{ id: string }>(
          'INSERT INTO waitlist_entries (student_id, section_id) VALUES ($1, $2) RETURNING id',
          [studentId, sectionId],
        );
        entryId = rows[0].id;
      } catch (error) {
        // Hai yêu cầu cùng lúc: chỉ mục uq_waitlist_waiting chặn dòng thứ hai.
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new AppError(
            'ALREADY_ON_WAITLIST',
            409,
            'You are already on the waitlist of this section.',
          );
        }
        throw error;
      }
      const [entry] = await readEntries('w.id = $1', [entryId]);
      return entry;
    },

    async listForStudent(studentId, semesterId) {
      return readEntries('w.student_id = $1 AND ($2::bigint IS NULL OR s.semester_id = $2)', [
        studentId,
        semesterId ?? null,
      ]);
    },

    async findEntry(entryId) {
      const { rows } = await db.query<{ student_id: string; status: WaitlistStatus }>(
        'SELECT student_id, status FROM waitlist_entries WHERE id = $1',
        [entryId],
      );
      if (rows.length === 0) return null;
      return { studentId: Number(rows[0].student_id), status: rows[0].status };
    },

    async leave(entryId) {
      // Chỉ đổi lượt còn WAITING; người phía sau tự lên một bậc vì vị trí được tính lại khi đọc.
      await db.query(
        "UPDATE waitlist_entries SET status = 'CANCELLED' WHERE id = $1 AND status = 'WAITING'",
        [entryId],
      );
    },
  };
}
