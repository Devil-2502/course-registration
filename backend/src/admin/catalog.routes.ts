import { Router } from 'express';
import { requireRole } from '../auth/auth.middleware';
import { notFound } from '../common/app-error';
import { parseId } from '../common/validation';
import type { Course, Section } from '../courses/courses.types';
import type { RegistrationResponse } from '../registration/registrations.routes';
import type { WaitlistEntryResponse } from '../waitlist/waitlist.routes';
import {
  parseCourseInput,
  parsePrerequisiteInput,
  parseSectionInput,
  type CourseInput,
  type SectionInput,
} from './catalog-input';

// Danh sách lớp cho admin: lần đăng ký kèm mã và tên sinh viên.
export interface SectionEnrolment extends RegistrationResponse {
  studentCode: string | null;
  studentName: string | null;
}

export interface SectionWaitlistEntry extends WaitlistEntryResponse {
  studentCode: string | null;
  studentName: string | null;
}

// Nơi đọc và ghi danh mục (US-12, US-13). Bản PostgreSQL ném AppError cho các lỗi 409
// (COURSE_CODE_EXISTS, SECTION_CODE_EXISTS, CAPACITY_BELOW_ENROLLED, PREREQUISITE_EXISTS,
// PREREQUISITE_CYCLE) và 404 khi môn, học kỳ trong input không tồn tại.
// Các hàm trả null khi đối tượng trên đường dẫn không tồn tại, để route trả 404.
export interface CatalogStore {
  createCourse(input: CourseInput): Promise<Course>;
  updateCourse(courseId: number, input: CourseInput): Promise<Course | null>;
  listPrerequisites(courseId: number): Promise<Course[] | null>;
  addPrerequisite(courseId: number, prerequisiteId: number): Promise<Course[]>;
  // false khi không có quan hệ này.
  removePrerequisite(courseId: number, prerequisiteId: number): Promise<boolean>;
  listSections(filter: { semesterId?: number; courseId?: number }): Promise<Section[]>;
  getSection(sectionId: number): Promise<Section | null>;
  createSection(input: SectionInput): Promise<Section>;
  updateSection(sectionId: number, input: SectionInput): Promise<Section | null>;
  listEnrolments(sectionId: number): Promise<SectionEnrolment[] | null>;
  listWaitlist(sectionId: number): Promise<SectionWaitlistEntry[] | null>;
}

const adminOnly = requireRole('ADMIN');

function optionalId(value: unknown, name: string): number | undefined {
  return value === undefined ? undefined : parseId(value, name);
}

// Gắn vào /api/v1/courses sau router đọc danh mục (GET / và GET /:courseId), cùng sau requireAuth.
export function createCourseAdminRouter(store: CatalogStore): Router {
  const router = Router();

  router.post('/', adminOnly, async (req, res) => {
    res.status(201).json(await store.createCourse(parseCourseInput(req.body)));
  });

  router.put('/:courseId', adminOnly, async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const course = await store.updateCourse(courseId, parseCourseInput(req.body));
    if (!course) throw notFound('Course');
    res.json(course);
  });

  // Ai đã đăng nhập cũng xem được môn tiên quyết trực tiếp.
  router.get('/:courseId/prerequisites', async (req, res) => {
    const prerequisites = await store.listPrerequisites(parseId(req.params.courseId, 'courseId'));
    if (!prerequisites) throw notFound('Course');
    res.json(prerequisites);
  });

  router.post('/:courseId/prerequisites', adminOnly, async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const { prerequisiteId } = parsePrerequisiteInput(req.body);
    res.status(201).json(await store.addPrerequisite(courseId, prerequisiteId));
  });

  router.delete('/:courseId/prerequisites/:prerequisiteId', adminOnly, async (req, res) => {
    const removed = await store.removePrerequisite(
      parseId(req.params.courseId, 'courseId'),
      parseId(req.params.prerequisiteId, 'prerequisiteId'),
    );
    if (!removed) throw notFound('Prerequisite relationship');
    res.status(204).end();
  });

  return router;
}

// Gắn vào /api/v1/sections sau requireAuth.
export function createSectionsRouter(store: CatalogStore): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(
      await store.listSections({
        semesterId: optionalId(req.query.semesterId, 'semesterId'),
        courseId: optionalId(req.query.courseId, 'courseId'),
      }),
    );
  });

  router.post('/', adminOnly, async (req, res) => {
    res.status(201).json(await store.createSection(parseSectionInput(req.body)));
  });

  router.get('/:sectionId', async (req, res) => {
    const section = await store.getSection(parseId(req.params.sectionId, 'sectionId'));
    if (!section) throw notFound('Section');
    res.json(section);
  });

  router.put('/:sectionId', adminOnly, async (req, res) => {
    const sectionId = parseId(req.params.sectionId, 'sectionId');
    const section = await store.updateSection(sectionId, parseSectionInput(req.body));
    if (!section) throw notFound('Section');
    res.json(section);
  });

  router.get('/:sectionId/enrolments', adminOnly, async (req, res) => {
    const enrolments = await store.listEnrolments(parseId(req.params.sectionId, 'sectionId'));
    if (!enrolments) throw notFound('Section');
    res.json(enrolments);
  });

  router.get('/:sectionId/waitlist', adminOnly, async (req, res) => {
    const waitlist = await store.listWaitlist(parseId(req.params.sectionId, 'sectionId'));
    if (!waitlist) throw notFound('Section');
    res.json(waitlist);
  });

  return router;
}
