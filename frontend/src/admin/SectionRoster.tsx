import { useCallback } from 'react'
import { request } from '../api'
import type { Section, SectionEnrolment, SectionWaitlistEntry, WaitlistEntry } from '../api'
import { ErrorNotice, Loading } from '../components'
import { useResource } from '../useResource'

const statusText: Record<WaitlistEntry['status'], string> = {
  WAITING: 'Đang chờ', PROMOTED: 'Đã được xếp lớp', SKIPPED: 'Bị bỏ qua', CANCELLED: 'Đã rời hàng chờ',
}
const time = (iso: string) => new Date(iso).toLocaleString('vi-VN')

// UI-12 Danh sách lớp (US-12): sinh viên đã đăng ký và hàng chờ theo thứ tự
export default function SectionRoster({ section, back }: { section: Section; back: () => void }) {
  const { data, error, loading, retry } = useResource(useCallback(async () => {
    const [enrolments, waitlist] = await Promise.all([
      request<SectionEnrolment[]>(`/sections/${section.id}/enrolments`),
      request<SectionWaitlistEntry[]>(`/sections/${section.id}/waitlist`),
    ])
    return { enrolments, waitlist }
  }, [section.id]))
  return <section>
    <button onClick={back}>← Lớp học phần</button>
    <h1>Danh sách lớp {section.code}</h1>
    <p>Sĩ số {section.enrolledCount}/{section.capacity}</p>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
      <h2>Đã đăng ký ({data.enrolments.length})</h2>
      {data.enrolments.length === 0 ? <p className="empty">Chưa có sinh viên nào đăng ký lớp này.</p> :
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th scope="col">STT</th><th scope="col">Mã sinh viên</th><th scope="col">Họ tên</th><th scope="col">Thời điểm đăng ký</th></tr></thead>
          <tbody>{data.enrolments.map((row, index) => <tr key={row.id}>
            <td>{index + 1}</td><td>{row.studentCode ?? `#${row.studentId}`}</td><td>{row.studentName ?? '—'}</td><td>{time(row.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
      <h2>Hàng chờ ({data.waitlist.filter(row => row.status === 'WAITING').length} người đang chờ)</h2>
      {data.waitlist.length === 0 ? <p className="empty">Không có ai trong hàng chờ.</p> :
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th scope="col">Vị trí</th><th scope="col">Mã sinh viên</th><th scope="col">Trạng thái</th><th scope="col">Vào hàng lúc</th></tr></thead>
          <tbody>{data.waitlist.map(row => <tr key={row.id}>
            <td>{row.position ?? '—'}</td><td>{row.studentCode ?? `#${row.studentId}`}</td><td>{statusText[row.status]}</td><td>{time(row.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
    </>}
  </section>
}
