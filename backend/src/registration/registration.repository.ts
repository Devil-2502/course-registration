import type { Queryable } from '../courses/courses.repository';
import { findMissingPrerequisites, type CourseAttempt } from './prerequisite-check';
import type { CourseRef, RegistrationFacts } from './registration-rules';
import type { RegistrationFactsReader } from './registrations.routes';
import { findClashes, type SectionSchedule } from './schedule-clash';

interface TargetRow {
  section_id: string;
  section_code: string;
  course_id: string;
  course_credits: number;
  semester_id: string;
  max_credits: number;
  registration_open: boolean;
  remaining_seats: number;
}

interface SlotRow {
  section_id: string;
  section_code: string;
  course_id: string;
  credits: number;
  day_of_week: number | null;
  start_period: number | null;
  end_period: number | null;
}

// Gom các dòng (mỗi dòng một buổi học) thành từng lớp kèm lịch.
function groupSections(rows: SlotRow[]) {
  const sections = new Map<
    number,
    SectionSchedule & { sectionCode: string; courseId: number; credits: number }
  >();
  for (const row of rows) {
    const id = Number(row.section_id);
    const section = sections.get(id) ?? {
      sectionId: id,
      sectionCode: row.section_code,
      courseId: Number(row.course_id),
      credits: row.credits,
      slots: [],
    };
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

// Bản RegistrationFactsReader đọc PostgreSQL: chỉ đọc, không ghi gì, dùng cho POST /registrations/validate.
// Các luật được xét ở registration-rules.ts; ở đây chỉ gom dữ kiện.
export function createRegistrationRepository(db: Queryable): RegistrationFactsReader {
  return {
    async readFacts(studentId, sectionId) {
      // Lớp muốn đăng ký, môn của lớp, học kỳ của lớp.
      const target = await db.query<TargetRow>(
        `SELECT s.id AS section_id, s.code AS section_code, s.course_id,
           c.credits AS course_credits, s.semester_id, sem.max_credits,
           (now() BETWEEN sem.registration_start AND sem.registration_end) AS registration_open,
           GREATEST(s.capacity - s.enrolled_count, 0) AS remaining_seats
         FROM sections s
         JOIN courses c ON c.id = s.course_id
         JOIN semesters sem ON sem.id = s.semester_id
         WHERE s.id = $1`,
        [sectionId],
      );
      if (target.rows.length === 0) return null;
      const t = target.rows[0];

      // Kết quả học của sinh viên, cho bước 6 (đã đạt môn này) và bước 7 (tiên quyết).
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

      // Lịch của lớp muốn đăng ký và của các lớp sinh viên đang học trong cùng học kỳ.
      const slots = await db.query<SlotRow>(
        `SELECT s.id AS section_id, s.code AS section_code, s.course_id, c.credits,
           sl.day_of_week, sl.start_period, sl.end_period
         FROM sections s
         JOIN courses c ON c.id = s.course_id
         LEFT JOIN section_slots sl ON sl.section_id = s.id
         WHERE s.id = $1
            OR s.id IN (
              SELECT e.section_id FROM enrolments e
              JOIN sections es ON es.id = e.section_id
              WHERE e.student_id = $2 AND e.status = 'ENROLLED' AND es.semester_id = $3
            )`,
        [sectionId, studentId, t.semester_id],
      );
      const sections = groupSections(slots.rows);
      const targetSchedule = sections.find((s) => s.sectionId === sectionId) ?? {
        sectionId,
        slots: [],
      };
      const enrolled = sections.filter((s) => s.sectionId !== sectionId);
      const clashIds = new Set(findClashes(targetSchedule, enrolled));

      const courseId = Number(t.course_id);
      // Giới hạn tín chỉ (US-07). Đổi sang checkCreditLimit khi P3 của Phúc merge.
      const currentCredits = enrolled.reduce((sum, s) => sum + s.credits, 0);
      const requestedCredits = t.course_credits;

      const facts: RegistrationFacts = {
        registrationOpen: t.registration_open,
        enrolledInSameCourse: enrolled.some((s) => s.courseId === courseId),
        alreadyPassed: history.some((a) => a.courseId === courseId && a.passed),
        missingPrerequisites: findMissingPrerequisites(prerequisiteRefs, history),
        clashesWith: enrolled
          .filter((s) => clashIds.has(s.sectionId))
          .map((s) => ({ sectionId: s.sectionId, sectionCode: s.sectionCode })),
        credit: {
          allowed: currentCredits + requestedCredits <= t.max_credits,
          currentCredits,
          requestedCredits,
          limit: t.max_credits,
        },
        remainingSeats: t.remaining_seats,
      };
      return facts;
    },
  };
}
