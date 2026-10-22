import type { CourseRef } from '../registration/registration-rules';

// Mã lỗi của POST /waitlist, khớp docs/openapi-spec.yaml.
export type WaitlistErrorCode =
  | 'REGISTRATION_CLOSED'
  | 'ALREADY_ENROLLED'
  | 'ALREADY_ON_WAITLIST'
  | 'PREREQUISITE_NOT_MET'
  | 'SECTION_NOT_FULL';

export interface WaitlistViolation {
  code: WaitlistErrorCode;
  status: number;
  message: string;
  details?: Record<string, unknown>;
}

// Dữ kiện tầng gọi đọc từ CSDL cho một lần vào hàng chờ.
// Trùng lịch và giới hạn tín chỉ không xét ở đây: hai điều này có thể đổi trong lúc chờ,
// nên được xét lại khi có chỗ trống (pickNextEligible trong waitlist-queue.ts).
export interface WaitlistFacts {
  registrationOpen: boolean;
  enrolledInSameCourse: boolean; // đang học một lớp bất kỳ của môn này
  alreadyWaiting: boolean; // đang có lượt WAITING ở chính lớp này
  missingPrerequisites: CourseRef[];
  remainingSeats: number;
}

type Rule = (facts: WaitlistFacts) => WaitlistViolation | null;

// Thứ tự giống khi đăng ký: trạng thái của sinh viên trước, tình trạng chỗ của lớp sau cùng.
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
    f.alreadyWaiting
      ? {
          code: 'ALREADY_ON_WAITLIST',
          status: 409,
          message: 'You are already on the waitlist of this section.',
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
  // Lớp còn chỗ thì đăng ký thẳng, không cần vào hàng chờ
  (f) =>
    f.remainingSeats > 0
      ? {
          code: 'SECTION_NOT_FULL',
          status: 409,
          message: 'This section still has seats. Register for it directly.',
          details: { remainingSeats: f.remainingSeats },
        }
      : null,
];

// Vi phạm đầu tiên theo thứ tự; null nghĩa là được vào hàng chờ.
export function checkJoinWaitlist(facts: WaitlistFacts): WaitlistViolation | null {
  for (const rule of RULES) {
    const violation = rule(facts);
    if (violation) return violation;
  }
  return null;
}