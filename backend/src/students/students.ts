import { Router } from 'express';
import { notFound } from '../common/app-error';
import { parseId } from '../common/validation';
import { CURRENT_SEMESTER_SQL, type Queryable } from '../courses/courses.repository';
import type { Course } from '../courses/courses.types';
import type { StudentIdOf } from '../registration/registrations.routes';

// Schema ScheduleEntry: một buổi học của một lớp đang học.
export interface ScheduleEntry {
  sectionId: number;
  sectionCode: string;
  courseCode: string;
  courseName: string;
  credits: number;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  room: string | null;
}

// Schema WeeklySchedule.
export interface WeeklySchedule {
  semesterId: number;
  totalCredits: number;
  maxCredits: number;
  entries: ScheduleEntry[];
}

// Schema CompletedCourse.
export interface CompletedCourse {
  course: Course;
  semesterCode: string;
  grade: number;
  passed: boolean;
}

export interface StudentRecordReader {
  // null khi học kỳ không tồn tại (hoặc chưa có học kỳ nào).
  schedule(studentId: number, semesterId?: number): Promise<WeeklySchedule | null>;
  completedCourses(studentId: number): Promise<CompletedCourse[]>;
}

export function createStudentRepository(db: Queryable): StudentRecordReader {
  return {
    async schedule(studentId, semesterId) {
      const semester = await db.query<{ id: string; max_credits: number }>(
        `SELECT id, max_credits FROM semesters
         WHERE id = COALESCE($1::bigint, (${CURRENT_SEMESTER_SQL}))`,
        [semesterId ?? null],
      );
      if (semester.rows.length === 0) return null;
      const { id, max_credits: maxCredits } = semester.rows[0];

      // Các lớp ENROLLED trong học kỳ, mỗi dòng một buổi học (lớp chưa có lịch vẫn tính tín chỉ).
      const { rows } = await db.query<{
        section_id: string;
        section_code: string;
        course_code: string;
        course_name: string;
        credits: number;
        day_of_week: number | null;
        start_period: number | null;
        end_period: number | null;
        room: string | null;
      }>(
        `SELECT s.id AS section_id, s.code AS section_code, c.code AS course_code,
           c.name AS course_name, c.credits,
           sl.day_of_week, sl.start_period, sl.end_period, sl.room
         FROM enrolments e
         JOIN sections s ON s.id = e.section_id
         JOIN courses c ON c.id = s.course_id
         LEFT JOIN section_slots sl ON sl.section_id = s.id
         WHERE e.student_id = $1 AND e.status = 'ENROLLED' AND s.semester_id = $2
         ORDER BY sl.day_of_week, sl.start_period, s.code`,
        [studentId, id],
      );

      const credits = new Map<string, number>();
      const entries: ScheduleEntry[] = [];
      for (const row of rows) {
        credits.set(row.section_id, row.credits);
        if (row.day_of_week === null || row.start_period === null || row.end_period === null) {
          continue;
        }
        entries.push({
          sectionId: Number(row.section_id),
          sectionCode: row.section_code,
          courseCode: row.course_code,
          courseName: row.course_name,
          credits: row.credits,
          dayOfWeek: row.day_of_week,
          startPeriod: row.start_period,
          endPeriod: row.end_period,
          room: row.room,
        });
      }
      return {
        semesterId: Number(id),
        totalCredits: [...credits.values()].reduce((sum, c) => sum + c, 0),
        maxCredits,
        entries,
      };
    },

    async completedCourses(studentId) {
      const { rows } = await db.query<{
        id: string;
        code: string;
        name: string;
        credits: number;
        description: string | null;
        semester_code: string;
        grade: string;
        passed: boolean;
      }>(
        `SELECT c.id, c.code, c.name, c.credits, c.description, cc.semester_code, cc.grade, cc.passed
         FROM completed_courses cc
         JOIN courses c ON c.id = cc.course_id
         WHERE cc.student_id = $1
         ORDER BY cc.semester_code, c.code`,
        [studentId],
      );
      return rows.map((row) => ({
        course: {
          id: Number(row.id),
          code: row.code,
          name: row.name,
          credits: row.credits,
          description: row.description,
        },
        semesterCode: row.semester_code,
        // NUMERIC của pg trả về chuỗi
        grade: Number(row.grade),
        passed: row.passed,
      }));
    },
  };
}

// Gắn vào app tại /api/v1/students/me, sau requireAuth và requireRole('STUDENT').
export function createStudentsMeRouter(reader: StudentRecordReader, studentIdOf: StudentIdOf) {
  const router = Router();

  // Thời khóa biểu tuần và tổng tín chỉ; mặc định học kỳ hiện tại.
  router.get('/schedule', async (req, res) => {
    const studentId = studentIdOf(req);
    const semesterId =
      req.query.semesterId === undefined ? undefined : parseId(req.query.semesterId, 'semesterId');
    const schedule = await reader.schedule(studentId, semesterId);
    if (!schedule) throw notFound('Semester');
    res.json(schedule);
  });

  // Kết quả học các môn đã học.
  router.get('/completed-courses', async (req, res) => {
    res.json(await reader.completedCourses(studentIdOf(req)));
  });

  return router;
}
