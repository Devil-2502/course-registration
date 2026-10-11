export interface ScheduleSlot {
  dayOfWeek: number; // 1 = thứ Hai ... 7 = Chủ nhật
  startPeriod: number;
  endPeriod: number;
}

export interface SectionSchedule {
  sectionId: number;
  slots: ScheduleSlot[];
}

// Hai buổi học trùng nhau khi cùng thứ và có chung ít nhất một tiết.
// Hai buổi liền kề (buổi trước hết tiết 3, buổi sau bắt đầu tiết 4) không tính là trùng.
export function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  return a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod;
}

export function sectionsClash(a: SectionSchedule, b: SectionSchedule): boolean {
  return a.slots.some((slotA) => b.slots.some((slotB) => slotsOverlap(slotA, slotB)));
}

// Trả về id của các lớp đã đăng ký bị trùng lịch với lớp đang muốn đăng ký.
// Mảng rỗng nghĩa là sinh viên có thể đăng ký lớp mới.
export function findClashes(
  target: SectionSchedule,
  enrolled: SectionSchedule[],
): number[] {
  return enrolled
    .filter((section) => section.sectionId !== target.sectionId)
    .filter((section) => sectionsClash(target, section))
    .map((section) => section.sectionId);
}