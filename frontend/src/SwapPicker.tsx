import { useCallback } from 'react'
import { ApiError, request } from './api'
import type { CourseDetail, Registration } from './api'
import { ErrorNotice, Loading, ViolationNotice } from './components'
import { slotText } from './days'
import { useResource } from './useResource'

// Lỗi trùng lịch hiện kèm lớp bị trùng; lỗi khác dùng ErrorNotice như các trang còn lại.
export function SwapError({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.code === 'SCHEDULE_CLASH') {
    return <ViolationNotice violation={{ code: error.code, message: error.message, details: error.details }} />
  }
  return <ErrorNotice error={error} />
}

// Chọn lớp muốn sang: các lớp khác của cùng môn, kèm lịch và số chỗ còn lại.
export default function SwapPicker({ registration, busy, choose, close }: {
  registration: Registration
  busy: boolean
  choose: (sectionId: number) => void
  close: () => void
}) {
  const courseId = registration.course?.id ?? registration.section.courseId
  const { data, error, loading, retry } = useResource(useCallback(() => request<CourseDetail>(`/courses/${courseId}`), [courseId]))
  const others = data?.sections.filter(section => section.id !== registration.section.id) ?? []
  return <div className="notice swap-picker" role="group" aria-label={`Đổi lớp ${registration.section.code}`}>
    <p><strong>Đổi {registration.section.code} sang lớp khác.</strong> Lớp mới còn chỗ thì chuyển ngay; lớp đầy thì hệ thống ghép với bạn muốn đổi ngược. Bạn không mất chỗ cũ trong lúc chờ.</p>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : others.length === 0 ? <p>Môn này không có lớp nào khác.</p> :
      <ul className="swap-options">{others.map(section => {
        const seats = section.remainingSeats ?? section.capacity - section.enrolledCount
        return <li key={section.id} className="actions">
          <span><strong>{section.code}</strong> · {section.slots.map(slotText).join('; ')} · {seats > 0 ? `còn ${seats} chỗ` : 'đã đầy'}</span>
          <button className="primary" disabled={busy} onClick={() => choose(section.id)}>Đổi sang {section.code}</button>
        </li>
      })}</ul>}
    <button disabled={busy} onClick={close}>Đóng</button>
  </div>
}
