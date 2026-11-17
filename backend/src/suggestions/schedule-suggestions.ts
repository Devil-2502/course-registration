import { Router } from 'express';
import { notFound } from '../common/app-error';
import { CURRENT_SEMESTER_SQL, type Queryable } from '../courses/courses.repository';
import type { Course, ScheduleSlot } from '../courses/courses.types';
import type { CourseRef } from '../registration/registration-rules';
import type { StudentIdOf } from '../registration/registrations.routes';
import { sectionsClash } from '../registration/schedule-clash';
import { suggestSchedules, type Metrics } from './schedule-suggester';
import { parseSuggestionRequest, type SuggestionRequest } from './suggestion-request';

// Một lớp trong phương án gợi ý (schema SuggestedSection).
export interface SuggestedSection {
  sectionId: number;
  sectionCode: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  credits: number;
  remainingSeats: number;
  slots: ScheduleSlot[];
}

type CourseInfo = Omit<Course, 'description'>;

// Dữ liệu repository đọc từ CSDL cho một yêu cầu gợi ý; hàm buildSuggestions chỉ xử lý trên đó.
export interface SuggestionData {
  semesterId: number;
  maxCredits: number;
  courses: CourseInfo[]; // các môn tìm thấy trong số courseIds
  passedCourseIds: number[];
  prerequisites: { courseId: number; prerequisite: CourseRef }[];
  enrolled: SuggestedSection[]; // các lớp đang học trong học kỳ, giữ nguyên trong mọi phương án
  sections: SuggestedSection[]; // mọi lớp của các môn được chọn trong học kỳ
}

// Lý do một môn được đưa vào hay bị loại khỏi việc xếp lịch.
export type CourseStatus =
  | 'INCLUDED'
  | 'ALREADY_ENROLLED'
  | 'COURSE_ALREADY_PASSED'
  | 'PREREQUISITE_NOT_MET'
  | 'NO_AVAILABLE_SECTION'
  | 'CLASHES_WITH_ENROLLED';

export interface CourseOutcome {
  course: CourseInfo;
  status: CourseStatus;
  missingCourses?: CourseRef[];
}

export interface Suggestion {
  rank: number;
  penalty: number;
  metrics: Metrics;
  sections: SuggestedSection[];
}

// Schema ScheduleSuggestionResult.
export interface SuggestionResponse {
  semesterId: number;
  maxCredits: number;
  currentCredits: number;
  requestedCredits: number;
  exceedsCreditLimit: boolean;
  courses: CourseOutcome[];
  enrolled: SuggestedSection[];
  totalCombinations: number;
  truncated: boolean;
  suggestions: Suggestion[];
}

// Xét từng môn theo đúng thứ tự kiểm tra khi đăng ký, giữ lại các lớp còn chỗ và
// không trùng các lớp đang học, rồi chạy thuật toán xếp lịch.
export function buildSuggestions(
  data: SuggestionData,
  request: SuggestionRequest,
): SuggestionResponse {
  const courses = new Map(data.courses.map((course) => [course.id, course]));
  if (request.courseIds.some((id) => !courses.has(id))) throw notFound('Course');

  const passed = new Set(data.passedCourseIds);
  const enrolledCourses = new Set(data.enrolled.map((section) => section.courseId));
  const outcomes: CourseOutcome[] = [];
  const groups: SuggestedSection[][] = [];

  for (const id of request.courseIds) {
    const course = courses.get(id) as CourseInfo;
    const missingCourses = data.prerequisites
      .filter((p) => p.courseId === id && !passed.has(p.prerequisite.id))
      .map((p) => p.prerequisite);
    const open = data.sections.filter((s) => s.courseId === id && s.remainingSeats > 0);
    const fits = open.filter((s) => !data.enrolled.some((other) => sectionsClash(s, other)));

    let status: CourseStatus = 'INCLUDED';
    if (enrolledCourses.has(id)) status = 'ALREADY_ENROLLED';
    else if (passed.has(id)) status = 'COURSE_ALREADY_PASSED';
    else if (missingCourses.length > 0) status = 'PREREQUISITE_NOT_MET';
    else if (open.length === 0) status = 'NO_AVAILABLE_SECTION';
    else if (fits.length === 0) status = 'CLASHES_WITH_ENROLLED';

    outcomes.push(
      status === 'PREREQUISITE_NOT_MET' ? { course, status, missingCourses } : { course, status },
    );
    if (status === 'INCLUDED') groups.push(fits);
  }

  const result = suggestSchedules(groups, data.enrolled, request.preferences, request.limit);
  const currentCredits = data.enrolled.reduce((sum, section) => sum + section.credits, 0);
  const requestedCredits = outcomes
    .filter((outcome) => outcome.status === 'INCLUDED')
    .reduce((sum, outcome) => sum + outcome.course.credits, 0);

  return {
    semesterId: data.semesterId,
    maxCredits: data.maxCredits,
    currentCredits,
    requestedCredits,
    exceedsCreditLimit: currentCredits + requestedCredits > data.maxCredits,
    courses: outcomes,
    enrolled: data.enrolled,
    totalCombinations: result.totalCombinations,
    truncated: result.truncated,
    suggestions: result.suggestions.map((ranked, index) => ({
      rank: index + 1,
      penalty: ranked.penalty,
      metrics: ranked.metrics,
      sections: ranked.sections,
    })),
  };
}

export interface SuggestionDataReader {
  // null khi chưa có học kỳ nào.
  read(studentId: number, courseIds: number[]): Promise<SuggestionData | null>;
}

interface SectionRow {
  id: string;
  code: string;
  course_id: string;
  course_code: string;
  course_name: string;
  credits: number;
  remaining_seats: number;
  slots: ScheduleSlot[];
}

const SUGGESTED_SECTION_SQL = `
  SELECT s.id, s.code, s.course_id, c.code AS course_code, c.name AS course_name, c.credits,
    GREATEST(s.capacity - s.enrolled_count, 0) AS remaining_seats,
    COALESCE((
      SELECT json_agg(json_build_object(
        'dayOfWeek', sl.day_of_week, 'startPeriod', sl.start_period,
        'endPeriod', sl.end_period, 'room', sl.room
      ) ORDER BY sl.day_of_week, sl.start_period)
      FROM section_slots sl WHERE sl.section_id = s.id
    ), '[]'::json) AS slots
  FROM sections s
  JOIN courses c ON c.id = s.course_id`;

function toSuggestedSection(row: SectionRow): SuggestedSection {
  return {
    sectionId: Number(row.id),
    sectionCode: row.code,
    courseId: Number(row.course_id),
    courseCode: row.course_code,
    courseName: row.course_name,
    credits: row.credits,
    remainingSeats: row.remaining_seats,
    slots: row.slots,
  };
}

// Chỉ đọc, không khóa gì: gợi ý không giữ chỗ, sinh viên vẫn đăng ký từng lớp như bình thường.
export function createSuggestionRepository(db: Queryable): SuggestionDataReader {
  return {
    async read(studentId, courseIds) {
      const semester = await db.query<{ id: string; max_credits: number }>(
        `SELECT id, max_credits FROM semesters WHERE id = (${CURRENT_SEMESTER_SQL})`,
      );
      if (semester.rows.length === 0) return null;
      const semesterId = Number(semester.rows[0].id);

      const courses = await db.query<{ id: string; code: string; name: string; credits: number }>(
        'SELECT id, code, name, credits FROM courses WHERE id = ANY($1::bigint[])',
        [courseIds],
      );
      const passed = await db.query<{ course_id: string }>(
        'SELECT DISTINCT course_id FROM completed_courses WHERE student_id = $1 AND passed',
        [studentId],
      );
      const prerequisites = await db.query<{
        course_id: string;
        id: string;
        code: string;
        name: string;
      }>(
        `SELECT p.course_id, c.id, c.code, c.name FROM prerequisites p
         JOIN courses c ON c.id = p.prerequisite_id
         WHERE p.course_id = ANY($1::bigint[]) ORDER BY c.code`,
        [courseIds],
      );
      const enrolled = await db.query<SectionRow>(
        `${SUGGESTED_SECTION_SQL}
         JOIN enrolments e ON e.section_id = s.id
         WHERE e.student_id = $1 AND e.status = 'ENROLLED' AND s.semester_id = $2
         ORDER BY s.code`,
        [studentId, semesterId],
      );
      const sections = await db.query<SectionRow>(
        `${SUGGESTED_SECTION_SQL}
         WHERE s.course_id = ANY($1::bigint[]) AND s.semester_id = $2
         ORDER BY s.code`,
        [courseIds, semesterId],
      );

      return {
        semesterId,
        maxCredits: semester.rows[0].max_credits,
        courses: courses.rows.map((c) => ({
          id: Number(c.id),
          code: c.code,
          name: c.name,
          credits: c.credits,
        })),
        passedCourseIds: passed.rows.map((row) => Number(row.course_id)),
        prerequisites: prerequisites.rows.map((row) => ({
          courseId: Number(row.course_id),
          prerequisite: { id: Number(row.id), code: row.code, name: row.name },
        })),
        enrolled: enrolled.rows.map(toSuggestedSection),
        sections: sections.rows.map(toSuggestedSection),
      };
    },
  };
}

// Gắn vào app tại /api/v1/schedule-suggestions, sau requireAuth và requireRole('STUDENT').
export function createSuggestionsRouter(reader: SuggestionDataReader, studentIdOf: StudentIdOf) {
  const router = Router();

  // Chỉ tính toán, không ghi gì vào CSDL, nên trả 200 thay vì 201.
  router.post('/', async (req, res) => {
    const request = parseSuggestionRequest(req.body);
    const data = await reader.read(studentIdOf(req), request.courseIds);
    if (!data) throw notFound('Semester');
    res.json(buildSuggestions(data, request));
  });

  return router;
}
