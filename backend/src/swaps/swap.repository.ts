import type { PoolClient } from 'pg';
import { AppError, notFound } from '../common/app-error';
import { CURRENT_SEMESTER_SQL, type Queryable } from '../courses/courses.repository';
import { withTransaction } from '../db/transaction';
import {
  lockSection,
  lockStudent,
  promoteFromWaitlist,
  type Database,
} from '../registration/enrolment.repository';
import type { SectionRef } from '../registration/registration-rules';
import { findClashes, type SectionSchedule } from '../registration/schedule-clash';
import { planSwap, swapViolation } from './swap-rules';

// Schema SwapRequest trong docs/openapi-spec.yaml.
export interface SwapRequestView {
  id: number;
  courseCode: string;
  courseName: string;
  fromSection: { id: number; code: string };
  toSection: { id: number; code: string };
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  outcome: 'MOVED' | 'SWAPPED' | null;
  createdAt: string;
  resolvedAt: string | null;
}

// MOVED: đã chuyển sang lớp mới; SWAPPED: đã đổi chéo với một bạn; PENDING: đang chờ người đổi ngược.
export interface SwapResult {
  outcome: 'MOVED' | 'SWAPPED' | 'PENDING';
  request: SwapRequestView;
}

export interface SwapStore {
  request(studentId: number, toSectionId: number): Promise<SwapResult>;
  list(studentId: number): Promise<SwapRequestView[]>;
  cancel(studentId: number, requestId: number): Promise<void>;
}

interface RequestRow {
  id: string;
  course_code: string;
  course_name: string;
  from_section_id: string;
  from_code: string;
  to_section_id: string;
  to_code: string;
  status: SwapRequestView['status'];
  outcome: SwapRequestView['outcome'];
  created_at: Date;
  resolved_at: Date | null;
}

const REQUEST_SQL = `
  SELECT r.id, c.code AS course_code, c.name AS course_name,
    r.from_section_id, fs.code AS from_code, r.to_section_id, ts.code AS to_code,
    r.status, r.outcome, r.created_at, r.resolved_at
  FROM swap_requests r
  JOIN sections fs ON fs.id = r.from_section_id
  JOIN sections ts ON ts.id = r.to_section_id
  JOIN courses c ON c.id = fs.course_id`;

function toView(row: RequestRow): SwapRequestView {
  return {
    id: Number(row.id),
    courseCode: row.course_code,
    courseName: row.course_name,
    fromSection: { id: Number(row.from_section_id), code: row.from_code },
    toSection: { id: Number(row.to_section_id), code: row.to_code },
    status: row.status,
    outcome: row.outcome,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  };
}

async function readRequest(db: Queryable, id: number | string): Promise<SwapRequestView> {
  const { rows } = await db.query<RequestRow>(`${REQUEST_SQL} WHERE r.id = $1`, [id]);
  return toView(rows[0]);
}

// Lịch của các lớp, mỗi lớp một SectionSchedule (lớp chưa có lịch thì slots rỗng).
async function readSchedules(
  client: PoolClient,
  sectionIds: number[],
): Promise<(SectionSchedule & SectionRef)[]> {
  const { rows } = await client.query<{
    id: string;
    code: string;
    day_of_week: number | null;
    start_period: number | null;
    end_period: number | null;
  }>(
    `SELECT s.id, s.code, sl.day_of_week, sl.start_period, sl.end_period
     FROM sections s LEFT JOIN section_slots sl ON sl.section_id = s.id
     WHERE s.id = ANY($1::bigint[]) ORDER BY s.code`,
    [sectionIds],
  );
  const sections = new Map<number, SectionSchedule & SectionRef>();
  for (const row of rows) {
    const id = Number(row.id);
    const section = sections.get(id) ?? { sectionId: id, sectionCode: row.code, slots: [] };
    if (row.day_of_week !== null && row.start_period !== null && row.end_period !== null) {
      section.slots.push({
        dayOfWeek: row.day_of_week,
        startPeriod: row.start_period,
        endPeriod: row.end_period,
      });
    }
    sections.set(id, section);
  }
  return [...sections.values()];
}

// Các lớp khác (ngoài lớp đang đổi) của sinh viên trong học kỳ mà lớp `sectionId` bị trùng lịch.
async function clashesFor(
  client: PoolClient,
  studentId: number,
  semesterId: number,
  sectionId: number,
  leavingSectionId: number,
): Promise<SectionRef[]> {
  const others = await client.query<{ section_id: string }>(
    `SELECT e.section_id FROM enrolments e JOIN sections s ON s.id = e.section_id
     WHERE e.student_id = $1 AND e.status = 'ENROLLED' AND s.semester_id = $2
       AND e.section_id <> $3`,
    [studentId, semesterId, leavingSectionId],
  );
  const schedules = await readSchedules(client, [
    sectionId,
    ...others.rows.map((r) => Number(r.section_id)),
  ]);
  const target = schedules.find((s) => s.sectionId === sectionId) ?? { sectionId, slots: [] };
  const enrolled = schedules.filter((s) => s.sectionId !== sectionId);
  const ids = new Set(findClashes(target, enrolled));
  return enrolled
    .filter((s) => ids.has(s.sectionId))
    .map(({ sectionId: id, sectionCode }) => ({ sectionId: id, sectionCode }));
}

interface TargetRow {
  id: string;
  course_id: string;
  semester_id: string;
  remaining_seats: number;
  registration_open: boolean;
}

interface CurrentRow {
  enrolment_id: string;
  section_id: string;
  code: string;
}

async function readCurrent(
  db: Queryable,
  studentId: number,
  target: TargetRow,
): Promise<CurrentRow | null> {
  const { rows } = await db.query<CurrentRow>(
    `SELECT e.id AS enrolment_id, s.id AS section_id, s.code
     FROM enrolments e JOIN sections s ON s.id = e.section_id
     WHERE e.student_id = $1 AND e.status = 'ENROLLED' AND s.course_id = $2 AND s.semester_id = $3`,
    [studentId, target.course_id, target.semester_id],
  );
  return rows[0] ?? null;
}

async function readTarget(db: Queryable, sectionId: number): Promise<TargetRow | null> {
  const { rows } = await db.query<TargetRow>(
    `SELECT s.id, s.course_id, s.semester_id,
       GREATEST(s.capacity - s.enrolled_count, 0) AS remaining_seats,
       (now() BETWEEN sem.registration_start AND sem.registration_end) AS registration_open
     FROM sections s JOIN semesters sem ON sem.id = s.semester_id
     WHERE s.id = $1`,
    [sectionId],
  );
  return rows[0] ?? null;
}

// Vào lớp mới thì không cần chờ ở hàng chờ của lớp đó nữa.
async function leaveWaitlist(client: PoolClient, studentId: number, sectionId: number) {
  await client.query(
    `UPDATE waitlist_entries SET status = 'CANCELLED'
     WHERE student_id = $1 AND section_id = $2 AND status = 'WAITING'`,
    [studentId, sectionId],
  );
}

// Khóa hai lớp theo thứ tự id tăng dần: mọi giao dịch đổi lớp cùng khóa theo một thứ tự nên không deadlock.
async function lockSections(client: PoolClient, ids: number[]) {
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) await lockSection(client, id);
}

export function createSwapRepository(db: Database): SwapStore {
  return {
    async request(studentId, toSectionId) {
      return withTransaction(async (client) => {
        const before = await readTarget(client, toSectionId);
        if (!before) throw notFound('Section');
        const guess = await readCurrent(client, studentId, before);

        // Khóa cả lớp cũ và lớp mới, rồi mới khóa sinh viên (cùng thứ tự với đăng ký: lớp trước, sinh viên sau).
        await lockSections(client, guess ? [Number(guess.section_id), toSectionId] : [toSectionId]);
        await lockStudent(client, studentId);

        // Đọc lại sau khi khóa: không ai đổi được sĩ số hay lớp của sinh viên cho tới khi commit.
        const target = (await readTarget(client, toSectionId)) as TargetRow;
        const current = await readCurrent(client, studentId, target);
        if ((current?.section_id ?? null) !== (guess?.section_id ?? null)) {
          throw new AppError(
            'REGISTRATION_CHANGED',
            409,
            'Your registration changed while processing. Please try again.',
          );
        }

        const semesterId = Number(target.semester_id);
        const fromId = current ? Number(current.section_id) : 0;
        const open = current
          ? await client.query(
              `SELECT 1 FROM swap_requests
               WHERE student_id = $1 AND from_section_id = $2 AND status = 'OPEN'`,
              [studentId, fromId],
            )
          : { rows: [] };
        const violation = swapViolation({
          registrationOpen: target.registration_open,
          fromSection: current ? { sectionId: fromId, sectionCode: current.code } : null,
          targetSectionId: toSectionId,
          openRequestExists: open.rows.length > 0,
          clashesWith:
            current && fromId !== toSectionId
              ? await clashesFor(client, studentId, semesterId, toSectionId, fromId)
              : [],
        });
        if (violation) throw violation;
        const mine = current as CurrentRow;

        // Tìm người ở lớp mới đang chờ đổi về lớp cũ, ai đến trước xét trước.
        const candidates = await client.query<{
          id: string;
          student_id: string;
          enrolment_id: string | null;
        }>(
          `SELECT r.id, r.student_id, e.id AS enrolment_id
           FROM swap_requests r
           LEFT JOIN enrolments e ON e.student_id = r.student_id
             AND e.section_id = r.from_section_id AND e.status = 'ENROLLED'
           WHERE r.from_section_id = $1 AND r.to_section_id = $2 AND r.status = 'OPEN'
             AND r.student_id <> $3
           ORDER BY r.created_at, r.id`,
          [toSectionId, fromId, studentId],
        );
        let partner: { id: string; studentId: number; enrolmentId: string } | null = null;
        for (const candidate of candidates.rows) {
          const partnerId = Number(candidate.student_id);
          await lockStudent(client, partnerId);
          const stillValid =
            candidate.enrolment_id !== null &&
            (await clashesFor(client, partnerId, semesterId, fromId, toSectionId)).length === 0;
          if (stillValid) {
            partner = {
              id: candidate.id,
              studentId: partnerId,
              enrolmentId: candidate.enrolment_id as string,
            };
            break;
          }
          // Yêu cầu không còn thực hiện được (đã rời lớp hoặc nay bị trùng lịch): hủy để không xét lại.
          await client.query(
            `UPDATE swap_requests SET status = 'CANCELLED', resolved_at = now() WHERE id = $1`,
            [candidate.id],
          );
        }

        const plan = planSwap(partner !== null, target.remaining_seats);
        const insert = (status: string, outcome: string | null, partnerRequestId: string | null) =>
          client.query<{ id: string }>(
            `INSERT INTO swap_requests
               (student_id, from_section_id, to_section_id, status, outcome, partner_request_id,
                resolved_at)
             VALUES ($1, $2, $3, $4::varchar, $5, $6, CASE WHEN $4::varchar = 'OPEN' THEN NULL ELSE now() END)
             RETURNING id`,
            [studentId, fromId, toSectionId, status, outcome, partnerRequestId],
          );

        if (plan === 'SWAP' && partner) {
          // Đổi chéo hai dòng đăng ký; sĩ số hai lớp giữ nguyên.
          await client.query('UPDATE enrolments SET section_id = $2 WHERE id = $1', [
            mine.enrolment_id,
            toSectionId,
          ]);
          await client.query('UPDATE enrolments SET section_id = $2 WHERE id = $1', [
            partner.enrolmentId,
            fromId,
          ]);
          const { rows } = await insert('COMPLETED', 'SWAPPED', partner.id);
          await client.query(
            `UPDATE swap_requests SET status = 'COMPLETED', outcome = 'SWAPPED',
               partner_request_id = $2, resolved_at = now()
             WHERE id = $1`,
            [partner.id, rows[0].id],
          );
          await leaveWaitlist(client, studentId, toSectionId);
          await leaveWaitlist(client, partner.studentId, fromId);
          return { outcome: 'SWAPPED', request: await readRequest(client, rows[0].id) };
        }

        if (plan === 'MOVE') {
          // Chuyển thẳng: rời lớp cũ và vào lớp mới trong cùng giao dịch, rồi đôn người chờ vào lớp cũ.
          await client.query('UPDATE enrolments SET section_id = $2 WHERE id = $1', [
            mine.enrolment_id,
            toSectionId,
          ]);
          await client.query(
            'UPDATE sections SET enrolled_count = enrolled_count - 1 WHERE id = $1',
            [fromId],
          );
          await client.query(
            'UPDATE sections SET enrolled_count = enrolled_count + 1 WHERE id = $1',
            [toSectionId],
          );
          await leaveWaitlist(client, studentId, toSectionId);
          const { rows } = await insert('COMPLETED', 'MOVED', null);
          await promoteFromWaitlist(client, fromId);
          return { outcome: 'MOVED', request: await readRequest(client, rows[0].id) };
        }

        const { rows } = await insert('OPEN', null, null);
        return { outcome: 'PENDING', request: await readRequest(client, rows[0].id) };
      }, db);
    },

    async list(studentId) {
      const { rows } = await db.query<RequestRow>(
        `${REQUEST_SQL}
         WHERE r.student_id = $1 AND fs.semester_id = (${CURRENT_SEMESTER_SQL})
         ORDER BY r.created_at DESC, r.id DESC`,
        [studentId],
      );
      return rows.map(toView);
    },

    async cancel(studentId, requestId) {
      await withTransaction(async (client) => {
        const found = await client.query<{
          student_id: string;
          from_section_id: string;
          to_section_id: string;
        }>('SELECT student_id, from_section_id, to_section_id FROM swap_requests WHERE id = $1', [
          requestId,
        ]);
        if (found.rows.length === 0) throw notFound('Swap request');
        const row = found.rows[0];
        if (Number(row.student_id) !== studentId) {
          throw new AppError('FORBIDDEN', 403, 'You can only cancel your own swap requests.');
        }
        // Khóa hai lớp như lúc ghép cặp, để không hủy đúng lúc yêu cầu đang được ghép.
        await lockSections(client, [Number(row.from_section_id), Number(row.to_section_id)]);
        const updated = await client.query(
          `UPDATE swap_requests SET status = 'CANCELLED', resolved_at = now()
           WHERE id = $1 AND status = 'OPEN'`,
          [requestId],
        );
        if (updated.rowCount === 0) {
          throw new AppError('SWAP_REQUEST_NOT_OPEN', 409, 'This swap request is no longer open.');
        }
      }, db);
    },
  };
}
