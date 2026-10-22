import { Router } from 'express';
import { notFound } from '../common/app-error';
import { parseId } from '../common/validation';
import { parseCourseQuery, type CourseQuery } from './course-query';
import type { Course, CourseDetail, CoursePage } from './courses.types';

// Nguồn dữ liệu môn học. Router chỉ biết interface này, không biết CSDL:
// test dùng bản giả trong bộ nhớ, còn bản thật (truy vấn PostgreSQL) viết sau khi có kết nối CSDL.
export interface CourseReader {
  search(query: CourseQuery): Promise<{ items: Course[]; total: number }>;
  // semesterId không truyền thì lấy học kỳ hiện tại; studentId để tính passed của từng môn tiên quyết.
  findDetail(
    courseId: number,
    options: { semesterId?: number; studentId?: number },
  ): Promise<CourseDetail | null>;
}

// US-02 (tìm kiếm môn) và US-03 (chi tiết môn). Gắn vào app tại /api/v1/courses.
export function createCoursesRouter(reader: CourseReader): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseCourseQuery(req.query);
    const { items, total } = await reader.search(query);
    const body: CoursePage = { items, page: query.page, pageSize: query.pageSize, total };
    res.json(body);
  });

  router.get('/:courseId', async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const semesterId =
      req.query.semesterId === undefined ? undefined : parseId(req.query.semesterId, 'semesterId');
    const course = await reader.findDetail(courseId, { semesterId });
    if (!course) throw notFound('Course');
    res.json(course);
  });

  return router;
}
