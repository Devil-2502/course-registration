import {
  parseCourseInput,
  parsePrerequisiteInput,
  parseSectionInput,
} from '../src/admin/catalog-input';
import { findPath } from '../src/admin/catalog.repository';

const fieldsOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { details: { fields: Record<string, string> } }).details.fields;
  }
  throw new Error('expected a validation error');
};

describe('parseCourseInput', () => {
  it('Cắt khoảng trắng, mã môn viết hoa, mô tả rỗng thành null', () => {
    expect(
      parseCourseInput({
        code: ' cs401 ',
        name: ' Machine Learning ',
        credits: 3,
        description: '',
      }),
    ).toEqual({ code: 'CS401', name: 'Machine Learning', credits: 3, description: null });
  });

  it('Báo đủ mọi trường sai cùng lúc', () => {
    expect(Object.keys(fieldsOf(() => parseCourseInput({ credits: 0, description: 5 })))).toEqual([
      'code',
      'name',
      'credits',
      'description',
    ]);
    expect(fieldsOf(() => parseCourseInput(null))).toHaveProperty('code');
  });

  it('Mã môn dài quá 20 ký tự bị từ chối', () => {
    expect(
      fieldsOf(() => parseCourseInput({ code: 'X'.repeat(21), name: 'A', credits: 1 })),
    ).toEqual({ code: 'must be at most 20 characters' });
  });
});

describe('parseSectionInput', () => {
  const valid = {
    courseId: 2,
    semesterId: 5,
    code: 'cs201-04',
    capacity: 40,
    slots: [
      { dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' },
      { dayOfWeek: 1, startPeriod: 4, endPeriod: 6 },
    ],
  };

  it('Lớp hợp lệ: mã viết hoa, giảng viên thiếu thành null, phòng thiếu thành null', () => {
    expect(parseSectionInput(valid)).toEqual({
      ...valid,
      code: 'CS201-04',
      lecturerName: null,
      slots: [valid.slots[0], { ...valid.slots[1], room: null }],
    });
  });

  it('Lịch sai: thứ ngoài 1-7, tiết ngoài 1-15, tiết kết thúc trước tiết bắt đầu', () => {
    const fields = fieldsOf(() =>
      parseSectionInput({
        ...valid,
        slots: [
          { dayOfWeek: 8, startPeriod: 0, endPeriod: 16 },
          { dayOfWeek: 2, startPeriod: 5, endPeriod: 3 },
        ],
      }),
    );
    expect(fields).toEqual({
      'slots[0].dayOfWeek': 'must be an integer from 1 to 7',
      'slots[0].startPeriod': 'must be an integer from 1 to 15',
      'slots[0].endPeriod': 'must be an integer from 1 to 15',
      'slots[1].endPeriod': 'must not be lower than startPeriod',
    });
  });

  it('Không có buổi nào, hoặc hai buổi chồng giờ nhau, đều bị từ chối', () => {
    expect(fieldsOf(() => parseSectionInput({ ...valid, slots: [] }))).toHaveProperty('slots');
    expect(fieldsOf(() => parseSectionInput({ ...valid, slots: 'x' }))).toHaveProperty('slots');
    expect(
      fieldsOf(() =>
        parseSectionInput({
          ...valid,
          slots: [
            { dayOfWeek: 1, startPeriod: 1, endPeriod: 3 },
            { dayOfWeek: 1, startPeriod: 3, endPeriod: 5 },
          ],
        }),
      ),
    ).toEqual({ 'slots[1]': 'overlaps another slot of this section' });
  });

  it('Thiếu courseId, semesterId, capacity', () => {
    expect(
      Object.keys(fieldsOf(() => parseSectionInput({ code: 'A', slots: valid.slots }))).sort(),
    ).toEqual(['capacity', 'courseId', 'semesterId']);
  });
});

describe('parsePrerequisiteInput', () => {
  it('Nhận số nguyên dương, từ chối chuỗi', () => {
    expect(parsePrerequisiteInput({ prerequisiteId: 3 })).toEqual({ prerequisiteId: 3 });
    expect(fieldsOf(() => parsePrerequisiteInput({ prerequisiteId: '3' }))).toHaveProperty(
      'prerequisiteId',
    );
  });
});

describe('findPath (phát hiện vòng lặp tiên quyết)', () => {
  // 3 cần 2, 2 cần 1, 4 cần 2
  const edges = new Map([
    [3, [2]],
    [2, [1]],
    [4, [2]],
  ]);

  it('Tìm được đường đi theo chuỗi tiên quyết', () => {
    expect(findPath(edges, 3, 1)).toEqual([3, 2, 1]);
    expect(findPath(edges, 1, 1)).toEqual([1]);
  });

  it('Không có đường đi thì null (thêm cạnh không tạo vòng)', () => {
    expect(findPath(edges, 1, 3)).toBeNull();
    expect(findPath(edges, 4, 3)).toBeNull();
  });
});
