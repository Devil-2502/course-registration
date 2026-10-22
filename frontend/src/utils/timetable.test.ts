import { describe, expect, it } from 'vitest';
import type { ScheduleEntry } from '../api/types';
import { buildGrid, dayName, findPreviewClashes, formatSlot, slotsOverlap } from './timetable';

const entry = (sectionCode: string, dayOfWeek: number, startPeriod: number, endPeriod: number): ScheduleEntry => ({
  sectionId: 1,
  sectionCode,
  courseCode: sectionCode.slice(0, 5),
  courseName: 'Course',
  credits: 3,
  dayOfWeek,
  startPeriod,
  endPeriod,
});

describe('slotsOverlap', () => {
  it('Cùng thứ, giao nhau thì trùng', () => {
    expect(slotsOverlap({ dayOfWeek: 1, startPeriod: 1, endPeriod: 3 }, { dayOfWeek: 1, startPeriod: 2, endPeriod: 4 })).toBe(true);
  });

  it('Liền kề thì không trùng', () => {
    expect(slotsOverlap({ dayOfWeek: 1, startPeriod: 1, endPeriod: 3 }, { dayOfWeek: 1, startPeriod: 4, endPeriod: 6 })).toBe(false);
  });

  it('Khác thứ thì không trùng', () => {
    expect(slotsOverlap({ dayOfWeek: 1, startPeriod: 1, endPeriod: 3 }, { dayOfWeek: 2, startPeriod: 1, endPeriod: 3 })).toBe(false);
  });
});

describe('findPreviewClashes', () => {
  it('Kịch bản US-11: xem trước CS201-01 (thứ Hai 2-4) báo trùng MA101-01', () => {
    const entries = [entry('MA101-01', 1, 1, 3)];
    expect(findPreviewClashes(entries, [{ dayOfWeek: 1, startPeriod: 2, endPeriod: 4 }])).toEqual(['MA101-01']);
  });

  it('Không trùng thì trả mảng rỗng', () => {
    expect(findPreviewClashes([entry('MA101-01', 1, 1, 3)], [{ dayOfWeek: 3, startPeriod: 1, endPeriod: 3 }])).toEqual([]);
  });
});

describe('buildGrid', () => {
  it('Đặt buổi học vào đúng ô và che các tiết phía dưới', () => {
    const grid = buildGrid([entry('MA101-01', 1, 1, 3)]);
    expect(grid[0][0]).toMatchObject({ rowSpan: 3 });
    expect(grid[1][0]).toBe('covered');
    expect(grid[2][0]).toBe('covered');
    expect(grid[3][0]).toBeNull();
  });

  it('Lưới có 15 tiết và 7 thứ', () => {
    const grid = buildGrid([]);
    expect(grid).toHaveLength(15);
    expect(grid[0]).toHaveLength(7);
  });
});

describe('định dạng', () => {
  it('Tên thứ và mô tả buổi học', () => {
    expect(dayName(1)).toBe('Thứ Hai');
    expect(dayName(7)).toBe('Chủ nhật');
    expect(formatSlot({ dayOfWeek: 3, startPeriod: 4, endPeriod: 5, room: 'D101' })).toBe('Thứ Tư, tiết 4-5, phòng D101');
  });
});
