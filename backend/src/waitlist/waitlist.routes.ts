import { Router } from 'express';
import { AppError, notFound } from '../common/app-error';
import { parseId } from '../common/validation';
import type { Section } from '../courses/courses.types';
import { parseRegistrationRequest } from '../registration/registration-request';
import type { StudentIdOf } from '../registration/registrations.routes';
import type { WaitlistStatus } from './waitlist-queue';
import { checkJoinWaitlist, type WaitlistFacts } from './waitlist-rules';

// Schema WaitlistEntry trong docs/openapi-spec.yaml.
export interface WaitlistEntryResponse {
  id: number;
  studentId: number;
  sectionId: number;
  section?: Section;
  position: number | null; // vị trí trong hàng, tính từ 1; null khi không còn WAITING
  status: WaitlistStatus;
  createdAt: string;
}

// Nơi đọc và ghi hàng chờ. Bản thật dùng PostgreSQL (bảng waitlist_entries) sau khi có kết nối CSDL.
export interface WaitlistStore {
  // Dữ kiện cho checkJoinWaitlist; null khi lớp học phần không tồn tại.
  readJoinFacts(studentId: number, sectionId: number): Promise<WaitlistFacts | null>;
  // Thêm lượt WAITING. Hai yêu cầu cùng lúc: chỉ mục uq_waitlist_waiting chặn dòng thứ hai,
  // bản thật bắt lỗi trùng đó và ném AppError ALREADY_ON_WAITLIST (409).
  join(studentId: number, sectionId: number): Promise<WaitlistEntryResponse>;
  listForStudent(studentId: number, semesterId?: number): Promise<WaitlistEntryResponse[]>;
  findEntry(entryId: number): Promise<{ studentId: number; status: WaitlistStatus } | null>;
  // Chuyển sang CANCELLED. Vị trí được tính lại theo thời điểm vào hàng,
  // nên những người phía sau tự lên một bậc.
  leave(entryId: number): Promise<void>;
}

// US-09. Gắn vào app tại /api/v1/waitlist, sau requireAuth và requireRole('STUDENT').
export function createWaitlistRouter(store: WaitlistStore, studentIdOf: StudentIdOf): Router {
  const router = Router();

  // Các lượt chờ của chính sinh viên đang đăng nhập.
  router.get('/', async (req, res) => {
    const studentId = studentIdOf(req);
    const semesterId =
      req.query.semesterId === undefined ? undefined : parseId(req.query.semesterId, 'semesterId');
    res.json(await store.listForStudent(studentId, semesterId));
  });

  // Vào hàng chờ của một lớp đã đầy.
  router.post('/', async (req, res) => {
    const studentId = studentIdOf(req);
    const { sectionId } = parseRegistrationRequest(req.body);
    const facts = await store.readJoinFacts(studentId, sectionId);
    if (!facts) throw notFound('Section');
    const violation = checkJoinWaitlist(facts);
    if (violation) {
      throw new AppError(violation.code, violation.status, violation.message, violation.details);
    }
    res.status(201).json(await store.join(studentId, sectionId));
  });

  // Rời hàng chờ. Chỉ chủ của lượt chờ mới được rời, và chỉ khi lượt đó còn WAITING.
  router.delete('/:entryId', async (req, res) => {
    const studentId = studentIdOf(req);
    const entryId = parseId(req.params.entryId, 'entryId');
    const entry = await store.findEntry(entryId);
    if (!entry) throw notFound('Waitlist entry');
    if (entry.studentId !== studentId) {
      throw new AppError('FORBIDDEN', 403, 'You can only leave your own waitlist entries.');
    }
    // Đã được xếp lớp, bị bỏ qua hoặc đã rời: không còn lượt chờ nào để rời.
    if (entry.status !== 'WAITING') throw notFound('Active waitlist entry');
    await store.leave(entryId);
    res.status(204).end();
  });

  return router;
}
