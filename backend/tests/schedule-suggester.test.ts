import {
  measure,
  penaltyOf,
  suggestSchedules,
  type Candidate,
  type Preferences,
} from '../src/suggestions/schedule-suggester';

const none: Preferences = { avoidMorning: false, compactDays: false, freeDays: [] };

// Một lớp chỉ có một buổi: thứ, tiết bắt đầu, tiết kết thúc.
function section(code: string, courseId: number, day: number, start: number, end: number) {
  return {
    sectionId: Number(code.replace(/\D/g, '')),
    sectionCode: code,
    courseId,
    slots: [{ dayOfWeek: day, startPeriod: start, endPeriod: end }],
  } satisfies Candidate;
}

const codes = (sections: Candidate[]) => sections.map((s) => s.sectionCode);

describe('measure: đo một tuần học', () => {
  it('đếm ngày học, buổi sáng và tiết trống trong cùng ngày', () => {
    const metrics = measure(
      [
        { dayOfWeek: 1, startPeriod: 1, endPeriod: 3 },
        { dayOfWeek: 1, startPeriod: 7, endPeriod: 9 }, // trống tiết 4, 5, 6
        { dayOfWeek: 3, startPeriod: 4, endPeriod: 6 },
      ],
      { ...none, freeDays: [3, 5] },
    );
    expect(metrics).toEqual({ studyDays: 2, morningSessions: 2, gapPeriods: 3, busyFreeDays: [3] });
  });

  it('hai buổi liền kề hoặc lồng nhau không tính tiết trống', () => {
    const metrics = measure(
      [
        { dayOfWeek: 2, startPeriod: 1, endPeriod: 6 },
        { dayOfWeek: 2, startPeriod: 2, endPeriod: 3 },
        { dayOfWeek: 2, startPeriod: 7, endPeriod: 8 },
      ],
      none,
    );
    expect(metrics.gapPeriods).toBe(0);
  });

  it('tuần trống thì mọi chỉ số bằng 0', () => {
    expect(measure([], none)).toEqual({
      studyDays: 0,
      morningSessions: 0,
      gapPeriods: 0,
      busyFreeDays: [],
    });
  });
});

describe('penaltyOf: chỉ phạt tiêu chí sinh viên đã chọn', () => {
  const metrics = { studyDays: 3, morningSessions: 2, gapPeriods: 1, busyFreeDays: [6] };
  it('không chọn gì: chỉ phạt tiết trống và ngày muốn nghỉ', () => {
    expect(penaltyOf(metrics, none)).toBe(40 + 2);
  });
  it('chọn tránh học sáng và dồn lịch', () => {
    expect(penaltyOf(metrics, { ...none, avoidMorning: true, compactDays: true })).toBe(
      40 + 2 * 10 + 3 * 10 + 2,
    );
  });
});

describe('suggestSchedules: quay lui tìm các phương án không trùng lịch', () => {
  const cs201 = [
    section('CS201-01', 2, 1, 2, 4),
    section('CS201-02', 2, 1, 4, 6),
    section('CS201-03', 2, 2, 1, 3),
  ];
  const ma101 = { sectionId: 100, slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3 }] };

  it('bỏ lớp trùng lịch với lớp đang học', () => {
    const result = suggestSchedules([cs201], [ma101], none, 5);
    expect(result.totalCombinations).toBe(2);
    expect(result.suggestions.map((s) => codes(s.sections))).toEqual([['CS201-02'], ['CS201-03']]);
  });

  it('bỏ tổ hợp mà hai lớp mới trùng nhau', () => {
    const en101 = [section('EN101-01', 3, 1, 5, 6), section('EN101-02', 3, 4, 1, 2)];
    const result = suggestSchedules([cs201, en101], [], none, 10);
    // 3 x 2 = 6 tổ hợp, trừ CS201-02 + EN101-01 (thứ Hai tiết 5-6)
    expect(result.totalCombinations).toBe(5);
    expect(result.suggestions.flatMap((s) => codes(s.sections).join('+'))).not.toContain(
      'CS201-02+EN101-01',
    );
  });

  it('dồn lịch: ưu tiên phương án ít ngày học', () => {
    const pe101 = [section('PE101-01', 4, 1, 7, 8), section('PE101-02', 4, 6, 1, 2)];
    const result = suggestSchedules([pe101], [ma101], { ...none, compactDays: true }, 5);
    expect(codes(result.suggestions[0].sections)).toEqual(['PE101-01']);
    expect(result.suggestions[0].metrics.studyDays).toBe(1);
  });

  it('ngày muốn nghỉ: đẩy phương án có học ngày đó xuống cuối', () => {
    const result = suggestSchedules([cs201], [], { ...none, freeDays: [1] }, 5);
    expect(codes(result.suggestions[0].sections)).toEqual(['CS201-03']);
    expect(result.suggestions[2].metrics.busyFreeDays).toEqual([1]);
  });

  it('tránh học sáng: ưu tiên lớp buổi chiều', () => {
    const cs101 = [section('CS101-01', 1, 2, 7, 9), section('CS101-02', 1, 5, 1, 3)];
    const result = suggestSchedules([cs101], [], { ...none, avoidMorning: true }, 5);
    expect(codes(result.suggestions[0].sections)).toEqual(['CS101-01']);
  });

  it('cắt theo limit nhưng vẫn báo tổng số phương án', () => {
    const result = suggestSchedules([cs201], [], none, 1);
    expect(result.suggestions).toHaveLength(1);
    expect(result.totalCombinations).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('dừng khi đạt số phương án tối đa và báo truncated', () => {
    const many = Array.from({ length: 5 }, (_, i) => section(`X-0${i + 1}`, 9, i + 1, 1, 2));
    const result = suggestSchedules([many], [], none, 10, 3);
    expect(result.totalCombinations).toBe(3);
    expect(result.truncated).toBe(true);
  });

  it('không có môn nào hoặc có môn không còn lớp thì trả rỗng', () => {
    expect(suggestSchedules([], [], none, 5).suggestions).toEqual([]);
    expect(suggestSchedules([cs201, []], [], none, 5).totalCombinations).toBe(0);
  });

  it('cùng dữ liệu luôn cho cùng thứ tự (xếp theo mã lớp khi hòa điểm)', () => {
    const tied = [section('B-02', 7, 3, 1, 2), section('B-01', 7, 4, 1, 2)];
    const result = suggestSchedules([tied], [], none, 5);
    expect(result.suggestions.map((s) => codes(s.sections)[0])).toEqual(['B-01', 'B-02']);
  });
});
