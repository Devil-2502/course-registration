import {
  findClashes,
  sectionsClash,
  slotsOverlap,
  SectionSchedule,
} from '../src/registration/schedule-clash';

const slot = (dayOfWeek: number, startPeriod: number, endPeriod: number) => ({
  dayOfWeek,
  startPeriod,
  endPeriod,
});

describe('slotsOverlap', () => {
  it('Hai buổi giao nhau một phần thì trùng', () => {
    expect(slotsOverlap(slot(1, 1, 3), slot(1, 3, 5))).toBe(true);
  });

  it('Buổi nằm lồng trong buổi khác thì trùng', () => {
    expect(slotsOverlap(slot(2, 1, 6), slot(2, 3, 4))).toBe(true);
  });

  it('Hai buổi giống hệt nhau thì trùng', () => {
    expect(slotsOverlap(slot(3, 4, 6), slot(3, 4, 6))).toBe(true);
  });

  it('Hai buổi liền kề thì không trùng', () => {
    expect(slotsOverlap(slot(1, 1, 3), slot(1, 4, 6))).toBe(false);
  });

  it('Cùng tiết nhưng khác thứ thì không trùng', () => {
    expect(slotsOverlap(slot(1, 1, 3), slot(2, 1, 3))).toBe(false);
  });

  it('Đổi thứ tự hai buổi vẫn cho cùng kết quả', () => {
    expect(slotsOverlap(slot(1, 3, 5), slot(1, 1, 3))).toBe(true);
    expect(slotsOverlap(slot(1, 4, 6), slot(1, 1, 3))).toBe(false);
  });
});

describe('sectionsClash', () => {
  it('Chỉ cần một cặp buổi trùng là hai lớp trùng lịch', () => {
    const a: SectionSchedule = { sectionId: 1, slots: [slot(1, 1, 3), slot(4, 7, 9)] };
    const b: SectionSchedule = { sectionId: 2, slots: [slot(2, 1, 3), slot(4, 9, 11)] };
    expect(sectionsClash(a, b)).toBe(true);
  });

  it('Không cặp buổi nào trùng thì hai lớp không trùng lịch', () => {
    const a: SectionSchedule = { sectionId: 1, slots: [slot(1, 1, 3), slot(4, 7, 9)] };
    const b: SectionSchedule = { sectionId: 2, slots: [slot(1, 4, 6), slot(5, 7, 9)] };
    expect(sectionsClash(a, b)).toBe(false);
  });

  it('Lớp chưa có buổi học nào thì không trùng với ai', () => {
    const a: SectionSchedule = { sectionId: 1, slots: [slot(1, 1, 3)] };
    expect(sectionsClash(a, { sectionId: 2, slots: [] })).toBe(false);
  });
});

describe('findClashes', () => {
  const enrolled: SectionSchedule[] = [
    { sectionId: 10, slots: [slot(1, 1, 3)] },
    { sectionId: 11, slots: [slot(3, 4, 6), slot(5, 4, 6)] },
    { sectionId: 12, slots: [slot(2, 7, 9)] },
  ];

  it('Sinh viên chưa đăng ký lớp nào thì không có lớp trùng', () => {
    expect(findClashes({ sectionId: 20, slots: [slot(1, 1, 3)] }, [])).toEqual([]);
  });

  it('Không trùng lớp nào thì trả mảng rỗng', () => {
    expect(findClashes({ sectionId: 20, slots: [slot(1, 4, 6)] }, enrolled)).toEqual([]);
  });

  it('Trả về id của lớp bị trùng', () => {
    expect(findClashes({ sectionId: 20, slots: [slot(5, 6, 8)] }, enrolled)).toEqual([11]);
  });

  it('Trùng nhiều lớp thì trả về đủ các lớp', () => {
    const target = { sectionId: 20, slots: [slot(1, 2, 4), slot(2, 9, 10)] };
    expect(findClashes(target, enrolled)).toEqual([10, 12]);
  });

  it('Không so lớp với chính nó', () => {
    expect(findClashes({ sectionId: 10, slots: [slot(1, 1, 3)] }, enrolled)).toEqual([]);
  });
});