import { ApiError } from './api'
import type { Violation } from './api'

// Câu tiếng Việt cho các mã lỗi nghiệp vụ hay gặp; mã khác giữ nguyên message của máy chủ.
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ALREADY_ON_WAITLIST: 'Bạn đã ở trong hàng chờ của lớp này.',
  SECTION_NOT_FULL: 'Lớp vẫn còn chỗ, hãy đăng ký trực tiếp.',
  ALREADY_ENROLLED: 'Bạn đã đăng ký một lớp của môn này.',
  REGISTRATION_CLOSED: 'Hiện không trong thời gian đăng ký.',
  COURSE_CODE_EXISTS: 'Mã môn đã tồn tại.',
  SECTION_CODE_EXISTS: 'Mã lớp đã tồn tại trong môn và học kỳ này.',
  CAPACITY_BELOW_ENROLLED: 'Sức chứa mới thấp hơn số sinh viên đã đăng ký.',
  PREREQUISITE_CYCLE: 'Không thể thêm: quan hệ này tạo vòng lặp môn tiên quyết.',
  PREREQUISITE_EXISTS: 'Môn này đã là môn tiên quyết rồi.',
  SECTION_FULL: 'Lớp đã đủ sĩ số.',
  SCHEDULE_CLASH: 'Trùng lịch với lớp bạn đã đăng ký.',
  PREREQUISITE_NOT_MET: 'Bạn chưa đạt môn tiên quyết.',
  CREDIT_LIMIT_EXCEEDED: 'Vượt giới hạn tín chỉ của học kỳ.',
  COURSE_ALREADY_PASSED: 'Bạn đã đạt môn này rồi.',
}

// Câu tiếng Việt của một vi phạm; mã chưa có trong bảng thì giữ message của máy chủ.
function violationText(violation: Violation): string {
  return messages[violation.code] ?? violation.message
}

function fieldErrors(error: ApiError) {
  const fields = error.details?.fields
  if (!fields || typeof fields !== 'object') return ''
  return Object.entries(fields).map(([field, reason]) => `${field}: ${String(reason)}`).join('; ')
}

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  let message = error instanceof Error ? error.message : 'Không thể kết nối đến máy chủ.'
  if (error instanceof ApiError && messages[error.code]) message = messages[error.code]
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && fieldErrors(error)) message = `Dữ liệu chưa hợp lệ (${fieldErrors(error)}).`
  const path = error instanceof ApiError ? error.details?.path : undefined
  if (error instanceof ApiError && error.code === 'PREREQUISITE_CYCLE' && Array.isArray(path) && path.length > 0 && path.every(item => typeof item === 'string')) {
    message = `${messages.PREREQUISITE_CYCLE} Vòng lặp: ${path.join(' → ')}.`
  }
  if (error instanceof ApiError && error.status === 403 && error.code === 'FORBIDDEN') message = 'Bạn không có quyền truy cập chức năng này.'
  if (error instanceof ApiError && error.status === 404) message = 'Không tìm thấy dữ liệu được yêu cầu.'
  return <div className="notice error" role="alert"><p>{message}</p>{retry && <button onClick={retry}>Thử lại</button>}</div>
}
export function Loading() {
  return <p role="status">Đang tải dữ liệu…</p>
}

// Một mục trong details: môn thì hiện "mã – tên", lớp thì hiện mã lớp; không hiện id nội bộ.
function itemText(value: unknown): string {
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>
    if (typeof item.code === 'string') return typeof item.name === 'string' ? `${item.code} – ${item.name}` : item.code
    if (typeof item.sectionCode === 'string') return item.sectionCode
  }
  return value == null ? '' : String(value)
}

function detailText(value: unknown): string {
  return Array.isArray(value) ? value.map(itemText).join(', ') : itemText(value)
}

export function ViolationNotice({ violation }: { violation: Violation }) {
  const labels: Record<string, string> = {
    missingCourses: 'Môn tiên quyết còn thiếu', conflictsWith: 'Lớp bị trùng lịch',
    currentCredits: 'Số tín chỉ hiện tại', requestedCredits: 'Tín chỉ của môn này', limit: 'Giới hạn tín chỉ',
  }
  return <div className="notice error" role="alert"><p>{violationText(violation)}</p>
    {Object.entries(violation.details ?? {}).filter(([key]) => key in labels).map(([key, value]) =>
      <p key={key}>{labels[key]}: {detailText(value)}</p>,
    )}
  </div>
}

// Một dòng tóm tắt lý do chưa đăng ký được, dưới nút đăng ký.
export function ViolationSummary({ violations }: { violations: Violation[] }) {
  return <p>Chưa thể đăng ký: {violations.map(violationText).join(' ')}</p>
}
