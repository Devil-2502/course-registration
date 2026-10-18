export type WaitlistStatus = 'WAITING' | 'PROMOTED' | 'SKIPPED' | 'CANCELLED';

export interface WaitlistEntry {
  id: number;
  studentId: number;
  createdAt: Date;
  status: WaitlistStatus;
}

export interface PromotionResult {
  promoted: WaitlistEntry | null; // người được xếp vào lớp, null nếu không ai đủ điều kiện
  skipped: WaitlistEntry[]; // những người bị bỏ qua vì không còn đủ điều kiện
}

// Thứ tự hàng chờ: vào trước ra trước theo createdAt; cùng thời điểm thì id nhỏ đứng trước.
export function orderWaitingEntries(entries: WaitlistEntry[]): WaitlistEntry[] {
  return entries
    .filter((entry) => entry.status === 'WAITING')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
}

// Vị trí của sinh viên trong hàng chờ, tính từ 1. Trả về null nếu sinh viên không đang chờ.
export function getQueuePosition(entries: WaitlistEntry[], studentId: number): number | null {
  const index = orderWaitingEntries(entries).findIndex((entry) => entry.studentId === studentId);
  return index === -1 ? null : index + 1;
}

// BR-08: khi lớp có một chỗ trống, xét lần lượt từ đầu hàng.
// Người đầu tiên còn đủ điều kiện (tiên quyết, trùng lịch, tín chỉ) được xếp vào lớp;
// những người đứng trước mà không đủ điều kiện bị bỏ qua.
// isEligible do tầng gọi truyền vào, để hàm này không phụ thuộc cơ sở dữ liệu.
export function pickNextEligible(
  entries: WaitlistEntry[],
  isEligible: (entry: WaitlistEntry) => boolean,
): PromotionResult {
  const skipped: WaitlistEntry[] = [];
  for (const entry of orderWaitingEntries(entries)) {
    if (isEligible(entry)) {
      return { promoted: entry, skipped };
    }
    skipped.push(entry);
  }
  return { promoted: null, skipped };
}