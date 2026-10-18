import { ApiError } from './api'
import type { Violation } from './api'

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  let message = error instanceof Error ? error.message : 'Không thể kết nối đến máy chủ.'
  if (error instanceof ApiError && error.status === 403 && error.code === 'FORBIDDEN') message = 'Bạn không có quyền truy cập chức năng này.'
  if (error instanceof ApiError && error.status === 404) message = 'Không tìm thấy dữ liệu được yêu cầu.'
  return <div className="notice error" role="alert"><p>{message}</p>{retry && <button onClick={retry}>Thử lại</button>}</div>
}
export function Loading() {
  return <p role="status">Đang tải dữ liệu…</p>
}

function detailText(value: unknown): string {
  if (Array.isArray(value)) return value.map(detailText).join(', ')
  if (value && typeof value === 'object') return Object.values(value).map(detailText).join(' · ')
  return value == null ? '' : String(value)
}

export function ViolationNotice({ violation }: { violation: Violation }) {
  const labels: Record<string, string> = {
    missingCourses: 'Môn tiên quyết còn thiếu', conflictsWith: 'Lớp bị trùng lịch',
    currentCredits: 'Số tín chỉ hiện tại', limit: 'Giới hạn tín chỉ',
  }
  return <div className="notice error" role="alert"><p>{violation.message}</p>
    {Object.entries(violation.details ?? {}).filter(([key]) => key in labels).map(([key, value]) =>
      <p key={key}>{labels[key]}: {detailText(value)}</p>,
    )}
  </div>
}
