import { AppError } from '../common/app-error';
import type { SectionRef } from '../registration/registration-rules';

// Đổi lớp an toàn (cải tiến 2, US-15): các luật không cần CSDL, để test riêng.

export interface SwapFacts {
  registrationOpen: boolean;
  // Lớp sinh viên đang học của cùng môn, cùng học kỳ với lớp muốn sang; null nếu chưa học môn này.
  fromSection: SectionRef | null;
  targetSectionId: number;
  openRequestExists: boolean; // đã có yêu cầu đang chờ từ lớp hiện tại
  clashesWith: SectionRef[]; // lớp muốn sang trùng lịch với các lớp khác đang học (không tính lớp hiện tại)
}

// Kiểm tra theo thứ tự; trả lỗi đầu tiên, null nghĩa là được xin đổi.
// Không cần xét tiên quyết, đã đạt hay tín chỉ: cùng môn nên các điều kiện đó giữ nguyên.
export function swapViolation(facts: SwapFacts): AppError | null {
  if (!facts.registrationOpen) {
    return new AppError('REGISTRATION_CLOSED', 403, 'Registration is closed.');
  }
  if (!facts.fromSection) {
    return new AppError(
      'NOT_ENROLLED_IN_COURSE',
      409,
      'You are not enrolled in any section of this course.',
    );
  }
  if (facts.fromSection.sectionId === facts.targetSectionId) {
    return new AppError('SAME_SECTION', 409, 'You are already in this section.');
  }
  if (facts.openRequestExists) {
    return new AppError(
      'SWAP_REQUEST_EXISTS',
      409,
      `You already have an open swap request from ${facts.fromSection.sectionCode}.`,
    );
  }
  if (facts.clashesWith.length > 0) {
    return new AppError(
      'SCHEDULE_CLASH',
      409,
      `Schedule clash with ${facts.clashesWith.map((s) => s.sectionCode).join(', ')}`,
      { conflictsWith: facts.clashesWith },
    );
  }
  return null;
}

// SWAP: có người ở lớp muốn sang đang chờ đổi ngược, đổi chéo cho cả hai (ưu tiên vì giúp được hai người
// mà sĩ số không đổi). MOVE: lớp muốn sang còn chỗ, chuyển thẳng. QUEUE: lưu yêu cầu, giữ nguyên lớp cũ.
export type SwapPlan = 'SWAP' | 'MOVE' | 'QUEUE';

export function planSwap(hasPartner: boolean, targetRemainingSeats: number): SwapPlan {
  if (hasPartner) return 'SWAP';
  if (targetRemainingSeats > 0) return 'MOVE';
  return 'QUEUE';
}
