import { Router } from 'express';
import { notFound } from '../common/app-error';
import { CURRENT_SEMESTER_SQL, type Queryable } from '../courses/courses.repository';

// Schema Semester trong docs/openapi-spec.yaml.
export interface Semester {
  id: number;
  code: string;
  name: string;
  registrationStart: string;
  registrationEnd: string;
  maxCredits: number;
  registrationOpen: boolean;
}

export interface SemesterReader {
  // Mọi học kỳ, mới nhất trước.
  list(): Promise<Semester[]>;
  // Học kỳ đang mở đăng ký; nếu không có thì học kỳ bắt đầu gần nhất. null khi chưa có học kỳ nào.
  current(): Promise<Semester | null>;
}

interface SemesterRow {
  id: string;
  code: string;
  name: string;
  registration_start: Date;
  registration_end: Date;
  max_credits: number;
  registration_open: boolean;
}

const SEMESTER_SQL = `
  SELECT id, code, name, registration_start, registration_end, max_credits,
    (now() BETWEEN registration_start AND registration_end) AS registration_open
  FROM semesters`;

function toSemester(row: SemesterRow): Semester {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    registrationStart: new Date(row.registration_start).toISOString(),
    registrationEnd: new Date(row.registration_end).toISOString(),
    maxCredits: row.max_credits,
    registrationOpen: row.registration_open,
  };
}

export function createSemesterRepository(db: Queryable): SemesterReader {
  return {
    async list() {
      const { rows } = await db.query<SemesterRow>(
        `${SEMESTER_SQL} ORDER BY registration_start DESC, id DESC`,
      );
      return rows.map(toSemester);
    },
    async current() {
      const { rows } = await db.query<SemesterRow>(
        `${SEMESTER_SQL} WHERE id = (${CURRENT_SEMESTER_SQL})`,
      );
      return rows.length === 0 ? null : toSemester(rows[0]);
    },
  };
}

// Gắn vào app tại /api/v1/semesters, sau requireAuth (sinh viên và quản trị viên đều dùng).
export function createSemestersRouter(reader: SemesterReader): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await reader.list());
  });

  router.get('/current', async (_req, res) => {
    const semester = await reader.current();
    if (!semester) throw notFound('Semester');
    res.json(semester);
  });

  return router;
}
