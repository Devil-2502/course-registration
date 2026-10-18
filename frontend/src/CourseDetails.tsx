import { useCallback, useRef, useState } from 'react'
import { post, request } from './api'
import type { CourseDetail, Section, ValidationResult, WeeklySchedule } from './api'
import { ErrorNotice, Loading, ViolationNotice } from './components'
import { days } from './days'
import { useResource } from './useResource'
import { Timetable } from './Schedule'

function SectionPreview({ course, section, onRegistered }: {
  course: CourseDetail; section: Section; onRegistered: () => void
}) {
  const result = useResource(useCallback(async () => {
    const [schedule, validation] = await Promise.all([
      request<WeeklySchedule>(`/students/me/schedule?semesterId=${section.semesterId}`),
      post<ValidationResult>('/registrations/validate', { sectionId: section.id }),
    ])
    return { schedule, validation }
  }, [section.id, section.semesterId]))
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState<unknown>()
  const [success, setSuccess] = useState(false)
  async function register() {
    if (sending.current || !result.data?.validation.valid || success) return
    sending.current = true; setBusy(true); setError(undefined)
    try {
      await post('/registrations', { sectionId: section.id })
      setSuccess(true); onRegistered(); result.retry()
    } catch (failure) {
      setError(failure); result.retry()
    } finally { sending.current = false; setBusy(false) }
  }
  const validation = result.data?.validation
  const clash = validation?.violations.some(violation => violation.code === 'SCHEDULE_CLASH') ?? false
  return <section className="preview-panel" aria-label={`Xem trước ${section.code}`}>
    <h2>Xem trước và đăng ký {section.code}</h2>
    <p>Kết quả kiểm tra do máy chủ cung cấp; xem trước không giữ chỗ.</p>
    {result.loading ? <Loading /> : result.error ? <ErrorNotice error={result.error} retry={result.retry} /> : result.data && <>
      {validation?.violations.map((violation, index) => <ViolationNotice violation={violation} key={`${violation.code}-${index}`} />)}
      <Timetable schedule={result.data.schedule} preview={success ? undefined : { course, section }} conflict={clash} />
    </>}
    {error !== undefined && <ErrorNotice error={error} />}
    {success && <p className="notice success" role="status">Đăng ký thành công lớp {section.code}.</p>}
    <button onClick={register} disabled={busy || success || result.loading || !validation?.valid}>
      {busy ? 'Đang đăng ký…' : success ? 'Đã đăng ký' : 'Xác nhận đăng ký'}
    </button>
    {validation && !validation.valid && <p>Chưa thể đăng ký: {validation.violations.map(item => item.message).join('; ')}</p>}
  </section>
}

export default function CourseDetails({ id, back }: { id: number; back: () => void }) {
  const { data, error, loading, retry } = useResource(useCallback(() => request<CourseDetail>(`/courses/${id}`), [id]))
  const [selected, setSelected] = useState<Section>()
  const [refreshing, setRefreshing] = useState(false)
  const [updated, setUpdated] = useState<CourseDetail>()
  const [refreshError, setRefreshError] = useState<unknown>()
  const course = updated ?? data
  async function refreshSeats() {
    setRefreshing(true); setRefreshError(undefined)
    try { setUpdated(await request<CourseDetail>(`/courses/${id}`)) }
    catch (failure) { setRefreshError(failure) }
    finally { setRefreshing(false) }
  }
  return <section>
    <button onClick={back}>← Danh mục môn học</button>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : course && <>
      <p className="eyebrow">{course.code} · {course.credits} tín chỉ</p><h1>{course.name}</h1>
      {course.description && <p>{course.description}</p>}
      <h2>Môn tiên quyết</h2>
      {course.prerequisites.length === 0 ? <p>Không có môn tiên quyết.</p> : <ul>{course.prerequisites.map(item =>
        <li key={item.id}>{item.code} — {item.name} <span className="badge">{item.passed === true ? 'Đã đạt (Passed)' : item.passed === false ? 'Chưa đạt' : 'Chưa có trạng thái'}</span></li>,
      )}</ul>}
      <div className="actions"><h2>Lớp học phần đang mở</h2><button disabled={refreshing} onClick={refreshSeats}>Cập nhật số chỗ</button></div>
      {refreshError !== undefined && <ErrorNotice error={refreshError} retry={refreshSeats} />}
      {course.sections.length === 0 ? <p className="empty">Chưa có lớp học phần trong học kỳ hiện tại.</p> :
        <div className="course-list">{course.sections.map(section => <article className="card" key={section.id}>
          <h3>{section.code}</h3><p>Giảng viên: {section.lecturerName ?? 'Chưa cập nhật'}</p>
          <p>Sĩ số: {section.enrolledCount}/{section.capacity} · Còn {section.remainingSeats ?? Math.max(0, section.capacity - section.enrolledCount)} chỗ</p>
          <ul>{section.slots.map((slot, index) => <li key={index}>{days[slot.dayOfWeek - 1]} · Tiết {slot.startPeriod}–{slot.endPeriod}{slot.room && ` · Phòng ${slot.room}`}</li>)}</ul>
          <button onClick={() => setSelected(section)}>Xem trước {section.code}</button>
        </article>)}</div>}
      {selected && <SectionPreview key={selected.id} course={course} section={selected} onRegistered={refreshSeats} />}
    </>}
  </section>
}
