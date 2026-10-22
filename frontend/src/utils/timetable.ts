import type { ScheduleEntry, ScheduleSlot } from '../api/types';

export const DAYS = [1, 2, 3, 4, 5, 6, 7];
export const PERIODS = Array.from({ length: 15 }, (_, i) => i + 1);

const DAY_NAMES: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? `Ngày ${dayOfWeek}`;
}

export function formatSlot(slot: ScheduleSlot): string {
  const room = slot.room ? `, phòng ${slot.room}` : '';
  return `${dayName(slot.dayOfWeek)}, tiết ${slot.startPeriod}-${slot.endPeriod}${room}`;
}

// Hai buổi trùng khi cùng thứ và có chung ít nhất một tiết (giống quy tắc BR-03 ở backend).
// Chỉ dùng để tô màu xem trước; quyết định cuối cùng vẫn là của API.
export function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod;
}

// Các lớp trong thời khóa biểu bị trùng với một lớp đang xem trước.
export function findPreviewClashes(entries: ScheduleEntry[], preview: ScheduleSlot[]): string[] {
  const codes = entries
    .filter((entry) => preview.some((slot) => slotsOverlap(entry, slot)))
    .map((entry) => entry.sectionCode);
  return [...new Set(codes)];
}

export interface GridCell {
  entry: ScheduleEntry;
  rowSpan: number;
}

// Dựng lưới [tiết][thứ] cho bảng thời khóa biểu.
// Ô bắt đầu buổi học chứa GridCell; các ô bị buổi học phía trên che thì là 'covered'; ô trống là null.
export function buildGrid(entries: ScheduleEntry[]): (GridCell | 'covered' | null)[][] {
  const grid: (GridCell | 'covered' | null)[][] = PERIODS.map(() => DAYS.map(() => null));
  for (const entry of entries) {
    const col = entry.dayOfWeek - 1;
    const top = entry.startPeriod - 1;
    if (grid[top]?.[col] !== null) continue; // bỏ qua buổi chồng lên buổi đã đặt
    grid[top][col] = { entry, rowSpan: entry.endPeriod - entry.startPeriod + 1 };
    for (let row = top + 1; row < entry.endPeriod; row += 1) {
      grid[row][col] = 'covered';
    }
  }
  return grid;
}
