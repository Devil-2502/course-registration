import { Router, type Request } from 'express';
import { notFound } from '../common/app-error';
import { parseRegistrationRequest } from './registration-request';
import { collectViolations, type RegistrationFacts, type Violation } from './registration-rules';

// Nguồn dữ kiện cho một lần đăng ký. Bản thật đọc PostgreSQL (học kỳ, đăng ký hiện có, kết quả học,
// lịch học, tín chỉ, chỗ trống) rồi gọi findMissingPrerequisites, findClashes, checkCreditLimit.
export interface RegistrationFactsReader {
  // null khi lớp học phần không tồn tại (bước 3 trong docs/api-endpoints-draft.md)
  readFacts(studentId: number, sectionId: number): Promise<RegistrationFacts | null>;
}

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
  reader: RegistrationFactsReader,
  studentIdOf: StudentIdOf,
): Router {
  const router = Router();

  // Kiểm tra thử: không lưu gì, không giữ chỗ, trả về mọi vi phạm theo thứ tự (US-04 đến US-07).
  router.post('/validate', async (req, res) => {
    const studentId = studentIdOf(req);
    const { sectionId } = parseRegistrationRequest(req.body);
    const facts = await reader.readFacts(studentId, sectionId);
    if (!facts) throw notFound('Section');
    res.json(toValidationResult(collectViolations(facts)));
  });

  return router;
}
