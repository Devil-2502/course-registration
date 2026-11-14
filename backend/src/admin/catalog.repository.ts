import type { PoolClient } from 'pg';
import { AppError, notFound } from '../common/app-error';
import {
  CURRENT_SEMESTER_SQL,
  SECTION_COLUMNS,
  toSection,
  type Queryable,
  type SectionRow,
} from '../courses/courses.repository';
import type { Course, Section } from '../courses/courses.types';
import { isUniqueViolation } from '../db/pg-error';
import { withTransaction } from '../db/transaction';
import {
  REGISTRATION_SQL,
  promoteFromWaitlist,
  toRegistration,
  type Database,
  type RegistrationRow,
} from '../registration/enrolment.repository';
import { ENTRY_SQL, toEntry, type EntryRow } from '../waitlist/waitlist.repository';
import type { CourseInput, SectionInput } from './catalog-input';
import type { CatalogStore, SectionEnrolment, SectionWaitlistEntry } from './catalog.routes';

interface CourseRow {
  id: string;
  code: string;
  name: string;
  credits: number;
  description: string | null;
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

const courseCodeExists = (code: string) =>
  new AppError('COURSE_CODE_EXISTS', 409, `Course code ${code} already exists.`);

async function readSection(db: Queryable, sectionId: number): Promise<Section | null> {
  const { rows } = await db.query<SectionRow>(
    `SELECT ${SECTION_COLUMNS} FROM sections s WHERE s.id = $1`,
    [sectionId],
  );
  return rows.length === 0 ? null : toSection(rows[0]);
}

async function exists(db: Queryable, table: 'courses' | 'semesters' | 'sections', id: number) {
  const { rows } = await db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rows.length > 0;
}

// Mã sinh viên và họ tên theo id sinh viên, để danh sách lớp và hàng chờ hiện được người thật.
async function studentNames(db: Queryable, studentIds: number[]) {
  const { rows } = await db.query<{ id: string; student_code: string; full_name: string }>(
    `SELECT st.id, st.student_code, u.full_name
     FROM students st JOIN users u ON u.id = st.user_id
     WHERE st.id = ANY($1::bigint[])`,
    [studentIds],
  );
  return new Map(rows.map((r) => [Number(r.id), { code: r.student_code, name: r.full_name }]));
}

// Ghi đè lịch của một lớp: xóa các buổi cũ rồi thêm lại theo input.
async function replaceSlots(client: PoolClient, sectionId: number, input: SectionInput) {
  await client.query('DELETE FROM section_slots WHERE section_id = $1', [sectionId]);
  for (const slot of input.slots) {
    await client.query(
      `INSERT INTO section_slots (section_id, day_of_week, start_period, end_period, room)
       VALUES ($1, $2, $3, $4, $5)`,
      [sectionId, slot.dayOfWeek, slot.startPeriod, slot.endPeriod, slot.room ?? null],
    );
  }
}

// Môn học và lớp của input phải tồn tại.
async function checkReferences(db: Queryable, input: SectionInput) {
  if (!(await exists(db, 'courses', input.courseId))) throw notFound('Course');
  if (!(await exists(db, 'semesters', input.semesterId))) throw notFound('Semester');
}

const sectionCodeExists = (code: string) =>
  new AppError(
    'SECTION_CODE_EXISTS',
    409,
    `Section code ${code} already exists for this course and semester.`,
  );

// Đường đi theo các cạnh "môn cần môn tiên quyết" từ from tới to (tìm theo chiều sâu), null nếu không có.
export function findPath(
  edges: Map<number, number[]>,
  from: number,
  to: number,
  visited = new Set<number>(),
): number[] | null {
  if (from === to) return [to];
  visited.add(from);
  for (const next of edges.get(from) ?? []) {
    if (visited.has(next)) continue;
    const rest = findPath(edges, next, to, visited);
    if (rest) return [from, ...rest];
  }
  return null;
}

// Bản CatalogStore chạy trên PostgreSQL (US-12, US-13).
export function createCatalogRepository(db: Database): CatalogStore {
  async function listPrerequisites(courseId: number) {
    const { rows } = await db.query<CourseRow>(
      `SELECT c.id, c.code, c.name, c.credits, c.description
       FROM prerequisites p JOIN courses c ON c.id = p.prerequisite_id
       WHERE p.course_id = $1 ORDER BY c.code`,
      [courseId],
    );
    return rows.map(toCourse);
  }

  return {
    async createCourse(input: CourseInput) {
      try {
        const { rows } = await db.query<CourseRow>(
          `INSERT INTO courses (code, name, credits, description) VALUES ($1, $2, $3, $4)
           RETURNING id, code, name, credits, description`,
          [input.code, input.name, input.credits, input.description],
        );
        return toCourse(rows[0]);
      } catch (error) {
        if (isUniqueViolation(error)) throw courseCodeExists(input.code);
        throw error;
      }
    },

    async updateCourse(courseId, input) {
      try {
        const { rows } = await db.query<CourseRow>(
          `UPDATE courses SET code = $2, name = $3, credits = $4, description = $5 WHERE id = $1
           RETURNING id, code, name, credits, description`,
          [courseId, input.code, input.name, input.credits, input.description],
        );
        return rows.length === 0 ? null : toCourse(rows[0]);
      } catch (error) {
        if (isUniqueViolation(error)) throw courseCodeExists(input.code);
        throw error;
      }
    },

    async listPrerequisites(courseId) {
      if (!(await exists(db, 'courses', courseId))) return null;
      return listPrerequisites(courseId);
    },

    // US-13. Khóa bảng prerequisites trong transaction để hai admin thêm cạnh cùng lúc
    // không tạo được vòng lặp mà mỗi người kiểm tra riêng đều không thấy.
    async addPrerequisite(courseId, prerequisiteId) {
      await withTransaction(async (client) => {
        await client.query('LOCK TABLE prerequisites IN SHARE ROW EXCLUSIVE MODE');
        const { rows: courses } = await client.query<{ id: string; code: string }>(
          'SELECT id, code FROM courses WHERE id = ANY($1::bigint[])',
          [[courseId, prerequisiteId]],
        );
        const codeOf = new Map(courses.map((c) => [Number(c.id), c.code]));
        if (!codeOf.has(courseId)) throw notFound('Course');
        if (!codeOf.has(prerequisiteId)) throw notFound('Prerequisite course');

        const { rows } = await client.query<{ course_id: string; prerequisite_id: string }>(
          'SELECT course_id, prerequisite_id FROM prerequisites',
        );
        const edges = new Map<number, number[]>();
        for (const row of rows) {
          const from = Number(row.course_id);
          edges.set(from, [...(edges.get(from) ?? []), Number(row.prerequisite_id)]);
        }
        if (edges.get(courseId)?.includes(prerequisiteId)) {
          throw new AppError(
            'PREREQUISITE_EXISTS',
            409,
            `${codeOf.get(prerequisiteId)} is already a prerequisite of ${codeOf.get(courseId)}.`,
          );
        }
        // Thêm "courseId cần prerequisiteId" tạo vòng khi từ prerequisiteId đi tới được courseId.
        const path = findPath(edges, prerequisiteId, courseId);
        if (path) {
          // Lấy mã của các môn ở giữa vòng để báo lỗi dễ đọc, ví dụ CS101 → CS301 → CS201 → CS101.
          const { rows: middle } = await client.query<{ id: string; code: string }>(
            'SELECT id, code FROM courses WHERE id = ANY($1::bigint[])',
            [path],
          );
          for (const c of middle) codeOf.set(Number(c.id), c.code);
          const cycle = [courseId, ...path].map((id) => codeOf.get(id) ?? String(id));
          throw new AppError(
            'PREREQUISITE_CYCLE',
            409,
            `This would create a prerequisite cycle: ${cycle.join(' → ')}.`,
            { path: cycle },
          );
        }
        await client.query(
          'INSERT INTO prerequisites (course_id, prerequisite_id) VALUES ($1, $2)',
          [courseId, prerequisiteId],
        );
      }, db);
      return listPrerequisites(courseId);
    },

    async removePrerequisite(courseId, prerequisiteId) {
      const result = await db.query(
        'DELETE FROM prerequisites WHERE course_id = $1 AND prerequisite_id = $2',
        [courseId, prerequisiteId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async listSections(filter) {
      const { rows } = await db.query<SectionRow>(
        `SELECT ${SECTION_COLUMNS} FROM sections s
         WHERE s.semester_id = COALESCE($1::bigint, (${CURRENT_SEMESTER_SQL}))
           AND ($2::bigint IS NULL OR s.course_id = $2)
         ORDER BY s.code`,
        [filter.semesterId ?? null, filter.courseId ?? null],
      );
      return rows.map(toSection);
    },

    getSection: (sectionId) => readSection(db, sectionId),

    async createSection(input) {
      return withTransaction(async (client) => {
        await checkReferences(client, input);
        let sectionId: number;
        try {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO sections (course_id, semester_id, code, lecturer_name, capacity)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [input.courseId, input.semesterId, input.code, input.lecturerName, input.capacity],
          );
          sectionId = Number(rows[0].id);
        } catch (error) {
          if (isUniqueViolation(error)) throw sectionCodeExists(input.code);
          throw error;
        }
        await replaceSlots(client, sectionId, input);
        return (await readSection(client, sectionId)) as Section;
      }, db);
    },

    // Khóa lớp như khi đăng ký, để số đã đăng ký không đổi trong lúc so với sức chứa mới.
    // Tăng sức chứa trong thời gian đăng ký thì đẩy người đầu hàng chờ vào các chỗ mới (BR-08).
    async updateSection(sectionId, input) {
      return withTransaction(async (client) => {
        const locked = await client.query<{ enrolled_count: number; registration_open: boolean }>(
          `SELECT s.enrolled_count,
             (now() BETWEEN sem.registration_start AND sem.registration_end) AS registration_open
           FROM sections s JOIN semesters sem ON sem.id = s.semester_id
           WHERE s.id = $1 FOR UPDATE OF s`,
          [sectionId],
        );
        if (locked.rows.length === 0) return null;
        const { enrolled_count: enrolled } = locked.rows[0];
        if (input.capacity < enrolled) {
          throw new AppError(
            'CAPACITY_BELOW_ENROLLED',
            409,
            `Capacity ${input.capacity} is lower than the ${enrolled} students already enrolled.`,
            { capacity: input.capacity, enrolledCount: enrolled },
          );
        }
        await checkReferences(client, input);
        try {
          await client.query(
            `UPDATE sections SET course_id = $2, semester_id = $3, code = $4, lecturer_name = $5,
               capacity = $6
             WHERE id = $1`,
            [
              sectionId,
              input.courseId,
              input.semesterId,
              input.code,
              input.lecturerName,
              input.capacity,
            ],
          );
        } catch (error) {
          if (isUniqueViolation(error)) throw sectionCodeExists(input.code);
          throw error;
        }
        await replaceSlots(client, sectionId, input);

        // Đọc lại trạng thái đợt đăng ký theo học kỳ mới (input có thể đổi học kỳ).
        const open = await client.query<{ registration_open: boolean }>(
          `SELECT (now() BETWEEN registration_start AND registration_end) AS registration_open
           FROM semesters WHERE id = $1`,
          [input.semesterId],
        );
        if (open.rows[0]?.registration_open) {
          for (let seat = enrolled; seat < input.capacity; seat++) {
            const outcome = await promoteFromWaitlist(client, sectionId);
            if (outcome.promotedStudentId === null) break;
          }
        }
        return readSection(client, sectionId);
      }, db);
    },

    async listEnrolments(sectionId) {
      if (!(await exists(db, 'sections', sectionId))) return null;
      const { rows } = await db.query<RegistrationRow>(
        `${REGISTRATION_SQL} WHERE e.section_id = $1 AND e.status = 'ENROLLED'
         ORDER BY e.created_at, e.id`,
        [sectionId],
      );
      const registrations = rows.map(toRegistration);
      const names = await studentNames(
        db,
        registrations.map((r) => r.studentId),
      );
      return registrations.map((r): SectionEnrolment => ({
        ...r,
        studentCode: names.get(r.studentId)?.code ?? null,
        studentName: names.get(r.studentId)?.name ?? null,
      }));
    },

    // Người đang chờ theo thứ tự hàng trước, rồi tới các lượt đã xong (được xếp, bị bỏ qua, đã rời).
    async listWaitlist(sectionId) {
      if (!(await exists(db, 'sections', sectionId))) return null;
      const { rows } = await db.query<EntryRow>(
        `${ENTRY_SQL} WHERE w.section_id = $1
         ORDER BY (w.status = 'WAITING') DESC, w.created_at, w.id`,
        [sectionId],
      );
      const entries = rows.map(toEntry);
      const names = await studentNames(
        db,
        entries.map((e) => e.studentId),
      );
      return entries.map((e): SectionWaitlistEntry => ({
        ...e,
        studentCode: names.get(e.studentId)?.code ?? null,
        studentName: names.get(e.studentId)?.name ?? null,
      }));
    },
  };
}
