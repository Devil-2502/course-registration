import {
  CourseAttempt,
  findMissingPrerequisites,
  hasPassed,
  passedCourseIds,
} from '../src/registration/prerequisite-check';

// Id môn theo dữ liệu mẫu: CS101 = 1, CS201 = 2, CS301 = 3, MA101 = 13
const CS101 = { id: 1, code: 'CS101' };
const CS201 = { id: 2, code: 'CS201' };
const MA101 = { id: 13, code: 'MA101' };

const attempt = (courseId: number, grade: number): CourseAttempt => ({
  courseId,
  grade,
  passed: grade >= 5,
});

describe('findMissingPrerequisites', () => {
  it('Chưa học môn tiên quyết thì báo thiếu (std_500)', () => {
    expect(findMissingPrerequisites([CS101], [])).toEqual([CS101]);
  });

  it('Học rồi nhưng không đạt thì vẫn thiếu (std_501, CS101 điểm 4.0)', () => {
    expect(findMissingPrerequisites([CS101], [attempt(1, 4)])).toEqual([CS101]);
  });

  it('Rớt rồi học lại đạt thì tính là đã đạt', () => {
    expect(findMissingPrerequisites([CS101], [attempt(1, 4), attempt(1, 7.5)])).toEqual([]);
  });

  it('Chuỗi nhiều cấp: đăng ký CS301 chỉ cần đạt CS201 (std_402)', () => {
    const attempts = [attempt(1, 8), attempt(2, 7)];
    expect(findMissingPrerequisites([CS201], attempts)).toEqual([]);
  });

  it('Chỉ xét tiên quyết trực tiếp, không xét môn của các cấp dưới', () => {
    expect(findMissingPrerequisites([CS201], [attempt(2, 6)])).toEqual([]);
  });

  it('Nhiều tiên quyết thì trả đúng các môn còn thiếu, giữ thứ tự', () => {
    const missing = findMissingPrerequisites([CS101, MA101, CS201], [attempt(13, 9)]);
    expect(missing.map((course) => course.code)).toEqual(['CS101', 'CS201']);
  });

  it('Môn không có tiên quyết thì không thiếu gì', () => {
    expect(findMissingPrerequisites([], [])).toEqual([]);
  });

  it('Đạt môn khác không thay thế được môn tiên quyết', () => {
    expect(findMissingPrerequisites([CS101], [attempt(13, 10)])).toEqual([CS101]);
  });
});

describe('passedCourseIds và hasPassed', () => {
  it('Chỉ gồm các môn đã đạt, môn học nhiều lần chỉ tính một lần', () => {
    const ids = passedCourseIds([attempt(1, 8), attempt(1, 9), attempt(2, 3)]);
    expect([...ids]).toEqual([1]);
  });

  it('hasPassed dùng cho BR-09: đã đạt thì không đăng ký lại', () => {
    const attempts = [attempt(1, 8), attempt(2, 4)];
    expect(hasPassed(attempts, 1)).toBe(true);
    expect(hasPassed(attempts, 2)).toBe(false);
    expect(hasPassed(attempts, 3)).toBe(false);
  });
});