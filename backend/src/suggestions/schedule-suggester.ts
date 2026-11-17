import {
  sectionsClash,
  type ScheduleSlot,
  type SectionSchedule,
} from '../registration/schedule-clash';

// Gợi ý thời khóa biểu (cải tiến 1): sinh viên chọn các môn muốn học, hàm ở đây tìm mọi cách
// chọn mỗi môn một lớp sao cho không lớp nào trùng lịch (kể cả với các lớp đang học),
// rồi xếp hạng các phương án theo sở thích. File này không đọc CSDL nên test được hoàn toàn.

// Tiết 1-6 là buổi sáng (6h50 - 12h00 theo khung giờ của trường).
export const LAST_MORNING_PERIOD = 6;
// Tiết 7-12 là buổi chiều; tiết 13-15 là buổi tối.
export const LAST_AFTERNOON_PERIOD = 12;

// Dừng tìm sau ngần này phương án hợp lệ để một yêu cầu không chạy quá lâu.
export const MAX_COMBINATIONS = 2000;

export interface Preferences {
  avoidMorning: boolean; // tránh các buổi học bắt đầu từ tiết 1 đến tiết 6
  avoidAfternoon: boolean; // tránh các buổi học bắt đầu từ tiết 7 đến tiết 12
  compactDays: boolean; // dồn lịch vào ít ngày nhất
  freeDays: number[]; // các thứ muốn nghỉ (1 = thứ Hai ... 7 = Chủ nhật)
}

// Mức phạt của từng tiêu chí; phương án có tổng điểm phạt thấp hơn đứng trước.
export const PENALTY = {
  busyFreeDay: 40, // mỗi ngày muốn nghỉ nhưng vẫn phải đi học
  morningSession: 10, // mỗi buổi học sáng, khi chọn tránh học sáng
  afternoonSession: 10, // mỗi buổi học chiều, khi chọn tránh học chiều
  studyDay: 10, // mỗi ngày phải đến trường, khi chọn dồn lịch
  gapPeriod: 2, // mỗi tiết trống giữa hai buổi học trong cùng một ngày (luôn tính)
} as const;

export interface Metrics {
  studyDays: number; // số ngày phải đến trường
  morningSessions: number; // số buổi học bắt đầu từ tiết 1 đến tiết 6
  afternoonSessions: number; // số buổi học bắt đầu từ tiết 7 đến tiết 12
  gapPeriods: number; // tổng số tiết trống giữa các buổi trong cùng ngày
  busyFreeDays: number[]; // các ngày muốn nghỉ nhưng vẫn có lịch
}

export interface Candidate extends SectionSchedule {
  courseId: number;
  sectionCode: string;
}

export interface Ranked<T extends Candidate> {
  sections: T[];
  penalty: number;
  metrics: Metrics;
}

export interface SuggestionResult<T extends Candidate> {
  suggestions: Ranked<T>[];
  totalCombinations: number; // số phương án hợp lệ đã tìm thấy
  truncated: boolean; // true khi dừng ở MAX_COMBINATIONS, có thể còn phương án khác
}

// Đo một tuần học gồm các lớp đang học (fixed) và các lớp của phương án.
export function measure(slots: ScheduleSlot[], preferences: Preferences): Metrics {
  const byDay = new Map<number, ScheduleSlot[]>();
  for (const slot of slots) {
    byDay.set(slot.dayOfWeek, [...(byDay.get(slot.dayOfWeek) ?? []), slot]);
  }

  let gapPeriods = 0;
  for (const daySlots of byDay.values()) {
    const sorted = [...daySlots].sort((a, b) => a.startPeriod - b.startPeriod);
    let lastEnd = sorted[0].endPeriod;
    for (const slot of sorted.slice(1)) {
      if (slot.startPeriod > lastEnd + 1) gapPeriods += slot.startPeriod - lastEnd - 1;
      lastEnd = Math.max(lastEnd, slot.endPeriod);
    }
  }

  return {
    studyDays: byDay.size,
    morningSessions: slots.filter((slot) => slot.startPeriod <= LAST_MORNING_PERIOD).length,
    afternoonSessions: slots.filter(
      (slot) => slot.startPeriod > LAST_MORNING_PERIOD && slot.startPeriod <= LAST_AFTERNOON_PERIOD,
    ).length,
    gapPeriods,
    busyFreeDays: [...new Set(preferences.freeDays)]
      .filter((day) => byDay.has(day))
      .sort((a, b) => a - b),
  };
}

export function penaltyOf(metrics: Metrics, preferences: Preferences): number {
  return (
    metrics.busyFreeDays.length * PENALTY.busyFreeDay +
    (preferences.avoidMorning ? metrics.morningSessions * PENALTY.morningSession : 0) +
    (preferences.avoidAfternoon ? metrics.afternoonSessions * PENALTY.afternoonSession : 0) +
    (preferences.compactDays ? metrics.studyDays * PENALTY.studyDay : 0) +
    metrics.gapPeriods * PENALTY.gapPeriod
  );
}

// Thứ tự xếp hạng: điểm phạt, rồi ít tiết trống, rồi ít ngày học, cuối cùng theo mã lớp
// để cùng một dữ liệu luôn cho cùng một kết quả.
function compareRanked<T extends Candidate>(a: Ranked<T>, b: Ranked<T>): number {
  return (
    a.penalty - b.penalty ||
    a.metrics.gapPeriods - b.metrics.gapPeriods ||
    a.metrics.studyDays - b.metrics.studyDays ||
    codesOf(a).localeCompare(codesOf(b))
  );
}

function codesOf(ranked: Ranked<Candidate>): string {
  return ranked.sections.map((section) => section.sectionCode).join(',');
}

// Quay lui (backtracking): chọn lần lượt một lớp cho từng môn, bỏ ngay nhánh nào trùng lịch.
// Môn có ít lớp được xét trước để cắt nhánh sớm. groups: mỗi phần tử là các lớp của một môn.
export function suggestSchedules<T extends Candidate>(
  groups: T[][],
  fixed: SectionSchedule[],
  preferences: Preferences,
  limit: number,
  maxCombinations = MAX_COMBINATIONS,
): SuggestionResult<T> {
  if (groups.length === 0 || groups.some((group) => group.length === 0)) {
    return { suggestions: [], totalCombinations: 0, truncated: false };
  }
  const ordered = [...groups].sort((a, b) => a.length - b.length);
  const fixedSlots = fixed.flatMap((section) => section.slots);
  const found: Ranked<T>[] = [];
  const chosen: T[] = [];
  let truncated = false;

  const search = (index: number): void => {
    if (found.length >= maxCombinations) {
      truncated = true;
      return;
    }
    if (index === ordered.length) {
      const sections = [...chosen].sort((a, b) => a.sectionCode.localeCompare(b.sectionCode));
      const metrics = measure([...fixedSlots, ...sections.flatMap((s) => s.slots)], preferences);
      found.push({ sections, penalty: penaltyOf(metrics, preferences), metrics });
      return;
    }
    for (const section of ordered[index]) {
      const clashes =
        fixed.some((other) => sectionsClash(section, other)) ||
        chosen.some((other) => sectionsClash(section, other));
      if (clashes) continue;
      chosen.push(section);
      search(index + 1);
      chosen.pop();
      if (truncated) return;
    }
  };
  search(0);

  return {
    suggestions: found.sort(compareRanked).slice(0, limit),
    totalCombinations: found.length,
    truncated,
  };
}
