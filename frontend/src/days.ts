import type { Slot } from './api'

export const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

// Mô tả một buổi học, ví dụ "Thứ 2 · Tiết 2–4 · Phòng A101"
export function slotText(slot: Slot) {
  return `${days[slot.dayOfWeek - 1]} · Tiết ${slot.startPeriod}–${slot.endPeriod}${slot.room ? ` · Phòng ${slot.room}` : ''}`
}
