import type { Pool, PoolClient } from 'pg';
import { AppError, notFound } from '../common/app-error';
import {
  CURRENT_SEMESTER_SQL,
  SECTION_COLUMNS,
  toSection,
  type Queryable,
  type SectionRow,
} from '../courses/courses.repository';
import { isUniqueViolation } from '../db/pg-error';
import { withTransaction } from '../db/transaction';
import { createRegistrationRepository } from './registration.repository';
import { firstViolation, type Violation } from './registration-rules';
import type { EnrolmentStore, RegistrationResponse } from './registrations.routes';

// Cần query để đọc và connect để mở transaction.
export type Database = Pick<Pool, 'query' | 'connect'>;

// Một lần đăng ký kèm lớp và môn; cột của lớp lấy theo SECTION_COLUMNS.
interface RegistrationRow extends SectionRow {
  registration_id: string;
  student_id: string;
  status: 'ENROLLED' | 'DROPPED';
  created_at: Date;
  course_code: string;
  course_name: string;
  course_credits: number;
  course_description: string | null;
}

const REGISTRATION_SQL = `
  SELECT e.id AS registration_id, e.student_id, e.status, e.created_at,
    c.code AS course_code, c.name AS course_name, c.credits AS course_credits,
    c.description AS course_description,
    ${SECTION_COLUMNS}
  FROM enrolments e
  JOIN sections s ON s.id = e.section_id
  JOIN courses c ON c.id = s.course_id`;

function toRegistration(row: RegistrationRow): RegistrationResponse {
  const section = toSection(row);
  return {
    id: Number(row.registration_id),
    studentId: Number(row.student_id),
    section,
    course: {
      id: section.courseId,
      code: row.course_code,
      name: row.course_name,
      credits: row.course_credits,
      description: row.course_description,
    },
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function readRegistrations(db: Queryable, where: string, params: unknown[]) {
  const { rows } = await db.query<RegistrationRow>(
    `${REGISTRATION_SQL} WHERE ${where} ORDER BY e.created_at, e.id`,
    params,
  );
  return rows.map(toRegistration);
}

function toAppError(violation: Violation): AppError {
  return new AppError(violation.code, violation.status, violation.message, violation.details);
}

// Khóa dòng để các transaction cùng lớp hoặc cùng sinh viên chạy lần lượt.
// Luôn khóa lớp trước rồi mới khóa sinh viên, ở cả đăng ký lẫn hủy, để tránh deadlock.
async function lockSection(client: PoolClient, sectionId: number): Promise<boolean> {
  const { rows } = await client.query('SELECT id FROM sections WHERE id = $1 FOR UPDATE', [
    sectionId,
  ]);
  return rows.length > 0;
}

async function lockStudent(client: PoolClient, studentId: number): Promise<void> {
  await client.query('SELECT id FROM students WHERE id = $1 FOR UPDATE', [studentId]);
}

// Ghi đăng ký và tăng số đã đăng ký. Gọi sau khi đã khóa lớp và đã kiểm tra còn chỗ.
async function enrol(client: PoolClient, studentId: number, sectionId: number): Promise<string> {
  let registrationId: string;
  try {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2) RETURNING id',
      [studentId, sectionId],
    );
    registrationId = rows[0].id;
  } catch (error) {
    // Lớp chặn cuối: chỉ mục uq_enrolments_active không cho đăng ký trùng cùng một lớp.
    if (isUniqueViolation(error)) {
      throw new AppError('ALREADY_ENROLLED', 409, 'You are already enrolled in this section.');
    }
    throw error;
  }
  await client.query('UPDATE sections SET enrolled_count = enrolled_count + 1 WHERE id = $1', [
    sectionId,
  ]);
  return registrationId;
}

export interface PromotionOutcome {
  promotedStudentId: number | null;
  skippedStudentIds: number[];
}

// BR-08, docs/api-endpoints-draft.md mục 4 bước 3-7: xét hàng chờ từ đầu (vào trước ra trước).
// Người đầu tiên còn đủ mọi điều kiện được xếp vào lớp (PROMOTED);
// những người đứng trước mà không còn đủ điều kiện bị bỏ qua (SKIPPED). Hết hàng thì chỗ để trống.
export async function promoteFromWaitlist(
  client: PoolClient,
  sectionId: number,
): Promise<PromotionOutcome> {
  const waiting = await client.query<{ id: string; student_id: string }>(
    `SELECT id, student_id FROM waitlist_entries
     WHERE section_id = $1 AND status = 'WAITING'
     ORDER BY created_at, id`,
    [sectionId],
  );
  const reader = createRegistrationRepository(client);
  const skippedStudentIds: number[] = [];
  for (const entry of waiting.rows) {
    const studentId = Number(entry.student_id);
    await lockStudent(client, studentId);
    const facts = await reader.readFacts(studentId, sectionId);
    if (facts && firstViolation(facts) === null) {
      await enrol(client, studentId, sectionId);
      await client.query("UPDATE waitlist_entries SET status = 'PROMOTED' WHERE id = $1", [
        entry.id,
      ]);
      return { promotedStudentId: studentId, skippedStudentIds };
    }
    await client.query("UPDATE waitlist_entries SET status = 'SKIPPED' WHERE id = $1", [entry.id]);
    skippedStudentIds.push(studentId);
  }
  return { promotedStudentId: null, skippedStudentIds };
}

// Bản EnrolmentStore chạy trên PostgreSQL (US-08, US-10).
export function createEnrolmentRepository(db: Database): EnrolmentStore {
  return {
    async list(studentId, semesterId) {
      return readRegistrations(
        db,
        `e.student_id = $1 AND s.semester_id = COALESCE($2::bigint, (${CURRENT_SEMESTER_SQL}))`,
        [studentId, semesterId ?? null],
      );
    },

    // docs/api-endpoints-draft.md mục 3. Khóa lớp và sinh viên rồi mới đọc dữ kiện, nên các bước 5, 8, 9
    // và số chỗ (bước 10) được xét lại trên dữ liệu không ai đổi được cho tới khi commit.
    async register(studentId, sectionId) {
      return withTransaction(async (client) => {
        if (!(await lockSection(client, sectionId))) throw notFound('Section');
        await lockStudent(client, studentId);
        const facts = await createRegistrationRepository(client).readFacts(studentId, sectionId);
        if (!facts) throw notFound('Section');
        const violation = firstViolation(facts);
        if (violation) throw toAppError(violation);
        const registrationId = await enrol(client, studentId, sectionId);
        const [registration] = await readRegistrations(client, 'e.id = $1', [registrationId]);
        return registration;
      }, db);
    },

    // docs/api-endpoints-draft.md mục 4.
    async drop(studentId, registrationId) {
      await withTransaction(async (client) => {
        const found = await client.query<{
          student_id: string;
          section_id: string;
          registration_open: boolean;
        }>(
          `SELECT e.student_id, e.section_id,
             (now() BETWEEN sem.registration_start AND sem.registration_end) AS registration_open
           FROM enrolments e
           JOIN sections s ON s.id = e.section_id
           JOIN semesters sem ON sem.id = s.semester_id
           WHERE e.id = $1`,
          [registrationId],
        );
        if (found.rows.length === 0) throw notFound('Registration');
        const registration = found.rows[0];
        if (Number(registration.student_id) !== studentId) {
          throw new AppError('FORBIDDEN', 403, 'You can only drop your own registrations.');
        }
        if (!registration.registration_open) {
          throw new AppError('REGISTRATION_CLOSED', 403, 'Registration is closed.');
        }
        const sectionId = Number(registration.section_id);
        await lockSection(client, sectionId);
        // Đặt điều kiện status trong UPDATE: hai yêu cầu hủy cùng lúc thì yêu cầu sau không đổi được dòng nào.
        const dropped = await client.query(
          `UPDATE enrolments SET status = 'DROPPED', dropped_at = now()
           WHERE id = $1 AND status = 'ENROLLED'`,
          [registrationId],
        );
        if (dropped.rowCount === 0) throw notFound('Active registration');
        await client.query(
          'UPDATE sections SET enrolled_count = enrolled_count - 1 WHERE id = $1',
          [sectionId],
        );
        await promoteFromWaitlist(client, sectionId);
      }, db);
    },
  };
}
