// Mã lỗi của các bước kiểm tra khi đăng ký, khớp ErrorCode trong docs/openapi-spec.yaml.
export type RegistrationErrorCode =
  | 'REGISTRATION_CLOSED'
  | 'ALREADY_ENROLLED'
  | 'COURSE_ALREADY_PASSED'
  | 'PREREQUISITE_NOT_MET'
  | 'SCHEDULE_CLASH'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'SECTION_FULL';

// Một vi phạm, khớp schema Violation; status là mã HTTP khi trả lỗi từ POST /registrations.
export interface Violation {
  code: RegistrationErrorCode;
  status: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface CourseRef {
  id: number;
  code: string;
  name?: string;
}

export interface SectionRef {
  sectionId: number;
  sectionCode: string;
}

// Dữ kiện tầng gọi đã chuẩn bị cho một lần đăng ký: đọc từ CSDL và từ các hàm kiểm tra riêng
// (findMissingPrerequisites, findClashes, checkCreditLimit). Hàm ở đây chỉ xếp thứ tự và tạo lỗi.
export interface RegistrationFacts {
  registrationOpen: boolean;
  enrolledInSameCourse: boolean;
  alreadyPassed: boolean;
  missingPrerequisites: CourseRef[];
  clashesWith: SectionRef[];
  credit: { allowed: boolean; currentCredits: number; requestedCredits: number; limit: number };
  remainingSeats: number;
}

type Rule = (facts: RegistrationFacts) => Violation | null;

// Bước 4 đến 10 trong docs/api-endpoints-draft.md, đúng thứ tự.
// 409: xung đột có thể hết khi trạng thái đổi; 422: sinh viên chưa đủ điều kiện theo quy định.
const RULES: Rule[] = [
  (f) =>
    f.registrationOpen
      ? null
      : { code: 'REGISTRATION_CLOSED', status: 403, message: 'Registration is closed.' },
  (f) =>
    f.enrolledInSameCourse
      ? {
          code: 'ALREADY_ENROLLED',
          status: 409,
          message: 'You are already enrolled in a section of this course.',
        }
      : null,
  (f) =>
    f.alreadyPassed
      ? {
          code: 'COURSE_ALREADY_PASSED',
          status: 422,
          message: 'You have already passed this course.',
        }
      : null,
  (f) =>
    f.missingPrerequisites.length === 0
      ? null
      : {
          code: 'PREREQUISITE_NOT_MET',
          status: 422,
          message: `Missing prerequisites: ${f.missingPrerequisites.map((c) => c.code).join(', ')}.`,
          details: { missingCourses: f.missingPrerequisites },
        },
  (f) =>
    f.clashesWith.length === 0
      ? null
      : {
          code: 'SCHEDULE_CLASH',
          status: 409,
          // Giữ đúng câu trong Gherkin US-11, giao diện hiện nguyên message này
          message: `Schedule clash with ${f.clashesWith.map((s) => s.sectionCode).join(', ')}`,
          details: { conflictsWith: f.clashesWith },
        },
  (f) =>
    f.credit.allowed
      ? null
      : {
          code: 'CREDIT_LIMIT_EXCEEDED',
          status: 422,
          message: `Credit limit exceeded: ${f.credit.currentCredits} + ${f.credit.requestedCredits} > ${f.credit.limit}.`,
          details: {
            currentCredits: f.credit.currentCredits,
            requestedCredits: f.credit.requestedCredits,
            limit: f.credit.limit,
          },
        },
  (f) =>
    f.remainingSeats > 0
      ? null
      : { code: 'SECTION_FULL', status: 409, message: 'This section is full.' },
];

// Mọi vi phạm theo thứ tự, dùng cho POST /registrations/validate.
export function collectViolations(facts: RegistrationFacts): Violation[] {
  return RULES.map((rule) => rule(facts)).filter((v): v is Violation => v !== null);
}

// Vi phạm đầu tiên theo thứ tự, dùng cho POST /registrations. null nghĩa là được đăng ký.
export function firstViolation(facts: RegistrationFacts): Violation | null {
  for (const rule of RULES) {
    const violation = rule(facts);
    if (violation) return violation;
  }
  return null;
}