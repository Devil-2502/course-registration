// Một lần học một môn, lấy từ bảng completed_courses.
// passed do CSDL lưu sẵn (điểm từ mức đạt trở lên), nên hàm này không tự so điểm.
export interface CourseAttempt {
  courseId: number;
  grade: number;
  passed: boolean;
}

// Tập id các môn sinh viên đã đạt. Một môn học nhiều lần chỉ cần đạt một lần.
export function passedCourseIds(attempts: CourseAttempt[]): Set<number> {
  return new Set(attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.courseId));
}

// BR-09: sinh viên đã đạt môn này chưa (dùng để chặn đăng ký lại môn đã đạt).
export function hasPassed(attempts: CourseAttempt[], courseId: number): boolean {
  return passedCourseIds(attempts).has(courseId);
}

// BR-01: trả về các môn tiên quyết TRỰC TIẾP mà sinh viên chưa đạt, giữ nguyên thứ tự truyền vào.
// Mảng rỗng nghĩa là đủ điều kiện tiên quyết.
// Chỉ xét tiên quyết trực tiếp: muốn đạt CS201 thì trước đó đã phải đạt CS101,
// nên khi đăng ký CS301 (cần CS201) không cần kiểm tra lại CS101.
export function findMissingPrerequisites<T extends { id: number }>(
  prerequisites: T[],
  attempts: CourseAttempt[],
): T[] {
  const passed = passedCourseIds(attempts);
  return prerequisites.filter((course) => !passed.has(course.id));
}