import { Router, type Request } from 'express';
import { notFound } from '../common/app-error';
import { parseId } from '../common/validation';
import type { Course, Section } from '../courses/courses.types';
import { parseRegistrationRequest } from './registration-request';
import { collectViolations, type RegistrationFacts, type Violation } from './registration-rules';

// Nguồn dữ kiện cho một lần đăng ký. Bản thật đọc PostgreSQL (học kỳ, đăng ký hiện có, kết quả học,
// lịch học, tín chỉ, chỗ trống) rồi gọi findMissingPrerequisites, findClashes, checkCreditLimit.
export interface RegistrationFactsReader {
  // null khi lớp học phần không tồn tại (bước 3 trong docs/api-endpoints-draft.md)
  readFacts(studentId: number, sectionId: number): Promise<RegistrationFacts | null>;
}

// Schema Registration trong docs/openapi-spec.yaml.
export interface RegistrationResponse {
  id: number;
  studentId: number;
  section: Section;
  course: Course;
  status: 'ENROLLED' | 'DROPPED';
  createdAt: string;
}

// Đăng ký và hủy thật (US-08, US-10). Bản PostgreSQL chạy trong transaction, có khóa dòng,
// và ném AppError khi vi phạm (mã lỗi theo docs/api-endpoints-draft.md mục 3 và 4).
export interface EnrolmentStore {
  // Các lần đăng ký của sinh viên; không truyền semesterId thì lấy học kỳ hiện tại.
  list(studentId: number, semesterId?: number): Promise<RegistrationResponse[]>;
  register(studentId: number, sectionId: number): Promise<RegistrationResponse>;
  // Hủy rồi đẩy người đủ điều kiện đầu tiên trong hàng chờ vào lớp, trong cùng transaction.
  drop(studentId: number, registrationId: number): Promise<void>;
}

export type RegistrationStore = RegistrationFactsReader & EnrolmentStore;

// Lấy id sinh viên của request. Sau khi có đăng nhập (P5), hàm này đọc req.user;
// route được gắn sau requireAuth và requireRole('STUDENT') nên đã chặn 401, 403 từ trước.
export type StudentIdOf = (req: Request) => number;

// Schema ValidationResult: Violation chỉ gồm code, message, details; bỏ status
// vì status chỉ dùng khi POST /registrations trả lỗi.
export function toValidationResult(violations: Violation[]) {
  return {
    valid: violations.length === 0,
    violations: violations.map(({ code, message, details }) =>
      details === undefined ? { code, message } : { code, message, details },
    ),
  };
}

// Gắn vào app tại /api/v1/registrations.
export function createRegistrationsRouter(
  store: RegistrationStore,
  studentIdOf: StudentIdOf,
): Router {
  const router = Router();

  // Các lớp sinh viên đã đăng ký (kể cả đã hủy, status DROPPED).
  router.get('/', async (req, res) => {
    const studentId = studentIdOf(req);
    const semesterId =
      req.query.semesterId === undefined ? undefined : parseId(req.query.semesterId, 'semesterId');
    res.json(await store.list(studentId, semesterId));
  });

  // Đăng ký thật (US-08): kiểm tra theo thứ tự, trả vi phạm đầu tiên; giữ chỗ trong transaction.
  router.post('/', async (req, res) => {
    const studentId = studentIdOf(req);
    const { sectionId } = parseRegistrationRequest(req.body);
    res.status(201).json(await store.register(studentId, sectionId));
  });

  // Kiểm tra thử: không lưu gì, không giữ chỗ, trả về mọi vi phạm theo thứ tự (US-04 đến US-07).
  router.post('/validate', async (req, res) => {
    const studentId = studentIdOf(req);
    const { sectionId } = parseRegistrationRequest(req.body);
    const facts = await store.readFacts(studentId, sectionId);
    if (!facts) throw notFound('Section');
    res.json(toValidationResult(collectViolations(facts)));
  });

  // Hủy đăng ký (US-10): chỉ chủ của lần đăng ký, khi còn trong thời gian đăng ký.
  router.delete('/:registrationId', async (req, res) => {
    const studentId = studentIdOf(req);
    const registrationId = parseId(req.params.registrationId, 'registrationId');
    await store.drop(studentId, registrationId);
    res.status(204).end();
  });

  return router;
}
