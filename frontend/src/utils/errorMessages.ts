import { ApiError } from '../api/client';

interface NamedCourse {
  code?: string;
  name?: string;
}

// Đổi mã lỗi của API thành câu tiếng Việt (bảng mục 4 của docs/ui-screen-list.md).
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  const d = error.details ?? {};
  switch (error.code) {
    case 'PREREQUISITE_NOT_MET': {
      const missing = (d.missingCourses as NamedCourse[] | undefined) ?? [];
      return `Bạn chưa đạt môn tiên quyết: ${missing.map((c) => c.code).join(', ') || 'chưa rõ'}.`;
    }
    case 'SCHEDULE_CLASH': {
      const list = (d.conflictsWith as { sectionCode?: string }[] | undefined) ?? [];
      return `Trùng lịch với lớp ${list.map((c) => c.sectionCode).join(', ') || 'đã đăng ký'}.`;
    }
    case 'CREDIT_LIMIT_EXCEEDED':
      return `Vượt giới hạn tín chỉ: đang có ${d.currentCredits ?? '?'}, giới hạn ${d.limit ?? '?'}.`;
    case 'SECTION_FULL':
      return 'Lớp đã đủ sĩ số. Bạn có thể vào hàng chờ.';
    case 'ALREADY_ENROLLED':
      return 'Bạn đã đăng ký một lớp của môn này.';
    case 'COURSE_ALREADY_PASSED':
      return 'Bạn đã đạt môn này rồi.';
    case 'REGISTRATION_CLOSED':
      return 'Hiện không trong thời gian đăng ký.';
    case 'ALREADY_ON_WAITLIST':
      return 'Bạn đã ở trong hàng chờ của lớp này.';
    case 'SECTION_NOT_FULL':
      return 'Lớp vẫn còn chỗ, hãy đăng ký trực tiếp.';
    case 'INVALID_CREDENTIALS':
      return 'Email hoặc mật khẩu không đúng.';
    case 'UNAUTHENTICATED':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 'FORBIDDEN':
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 'NOT_FOUND':
      return 'Không tìm thấy dữ liệu.';
    case 'COURSE_CODE_EXISTS':
      return 'Mã môn đã tồn tại.';
    case 'SECTION_CODE_EXISTS':
      return 'Mã lớp đã tồn tại trong môn và học kỳ này.';
    case 'CAPACITY_BELOW_ENROLLED':
      return `Sức chứa mới thấp hơn số sinh viên đã đăng ký (${d.enrolledCount ?? '?'}).`;
    case 'PREREQUISITE_CYCLE':
      return 'Không thể thêm: quan hệ này tạo vòng lặp môn tiên quyết.';
    case 'PREREQUISITE_EXISTS':
      return 'Môn này đã là môn tiên quyết rồi.';
    case 'VALIDATION_ERROR': {
      const fields = (d.fields as Record<string, string> | undefined) ?? {};
      const list = Object.entries(fields).map(([field, reason]) => `${field}: ${reason}`);
      return list.length > 0 ? `Dữ liệu nhập chưa hợp lệ (${list.join('; ')}).` : 'Dữ liệu nhập chưa hợp lệ.';
    }
    case 'NETWORK_ERROR':
      return 'Không kết nối được tới máy chủ. Kiểm tra backend đã chạy chưa.';
    default:
      return error.message;
  }
}
