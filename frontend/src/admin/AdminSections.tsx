import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { post, put, request } from '../api'
import type { Course, CourseDetail, Section, SectionInput, Semester, Slot } from '../api'
import { ErrorNotice, Loading } from '../components'
import { slotText } from '../days'
import { useResource } from '../useResource'
import SlotFields from './SlotFields'

interface Form { code: string; lecturerName: string; capacity: number; slots: Slot[] }
const newSlot = (): Slot => ({ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: '' })
const emptyForm = (): Form => ({ code: '', lecturerName: '', capacity: 40, slots: [newSlot()] })

// UI-11 Quản lý lớp học phần (US-12): lớp của một môn trong học kỳ hiện tại, thêm và sửa lớp
export default function AdminSections({ course, back, openRoster }: {
  course: Course; back: () => void; openRoster: (section: Section) => void
}) {
  const { data, error, loading, retry } = useResource(useCallback(async () => {
    const [detail, semester] = await Promise.all([
      request<CourseDetail>(`/courses/${course.id}`),
      request<Semester>('/semesters/current'),
    ])
    return { sections: detail.sections, semester }
  }, [course.id]))
  const [form, setForm] = useState<Form>(emptyForm)
  const [editing, setEditing] = useState<Section>()
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [saveError, setSaveError] = useState<unknown>()
  const [message, setMessage] = useState<string>()

  function edit(section: Section) {
    setEditing(section); setSaveError(undefined); setMessage(undefined)
    setForm({
      code: section.code, lecturerName: section.lecturerName ?? '', capacity: section.capacity,
      slots: section.slots.map(slot => ({ ...slot, room: slot.room ?? '' })),
    })
  }
  function reset() { setEditing(undefined); setForm(emptyForm()) }
  // Tạo mảng mới thay vì sửa trực tiếp để React vẽ lại
  const updateSlot = (index: number, patch: Partial<Slot>) =>
    setForm({ ...form, slots: form.slots.map((slot, i) => i === index ? { ...slot, ...patch } : slot) })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!data || sending.current) return
    sending.current = true
    setBusy(true); setSaveError(undefined); setMessage(undefined)
    const input: SectionInput = {
      courseId: course.id,
      semesterId: editing?.semesterId ?? data.semester.id,
      code: form.code.trim(),
      lecturerName: form.lecturerName.trim() || undefined,
      capacity: form.capacity,
      slots: form.slots.map(slot => ({ ...slot, room: slot.room?.trim() || null })),
    }
    try {
      if (editing) await put<Section>(`/sections/${editing.id}`, input)
      else await post<Section>('/sections', input)
      setMessage(editing ? `Đã cập nhật lớp ${input.code}.` : `Đã tạo lớp ${input.code}.`)
      reset(); retry()
    } catch (failure) { setSaveError(failure) } finally { sending.current = false; setBusy(false) }
  }

  const title = editing ? `Sửa lớp ${editing.code}` : 'Thêm lớp mới'
  return <section>
    <button disabled={busy} onClick={back}>← Quản lý môn học</button>
    <h1>Lớp học phần {course.code} — {course.name}</h1>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
      <p>{data.semester.name}</p>
      <form className="card admin-form" onSubmit={save} aria-label={title}>
        <h2>{title}</h2>
        <label htmlFor="section-code">Mã lớp</label>
        <input id="section-code" value={form.code} placeholder={`${course.code}-01`}
          onChange={event => setForm({ ...form, code: event.target.value })} required />
        <label htmlFor="section-lecturer">Giảng viên</label>
        <input id="section-lecturer" value={form.lecturerName} onChange={event => setForm({ ...form, lecturerName: event.target.value })} />
        <label htmlFor="section-capacity">Sức chứa</label>
        <input id="section-capacity" type="number" min={1} value={form.capacity}
          onChange={event => setForm({ ...form, capacity: Number(event.target.value) })} required />
        <h3>Buổi học</h3>
        {form.slots.map((slot, index) => <SlotFields key={index} index={index} slot={slot}
          onChange={patch => updateSlot(index, patch)}
          onRemove={form.slots.length > 1 ? () => setForm({ ...form, slots: form.slots.filter((_, i) => i !== index) }) : undefined} />)}
        <button type="button" onClick={() => setForm({ ...form, slots: [...form.slots, newSlot()] })}>+ Thêm buổi</button>
        {saveError !== undefined && <ErrorNotice error={saveError} />}
        <div className="actions">
          <button className="primary" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm lớp'}</button>
          {editing && <button type="button" disabled={busy} onClick={reset}>Hủy sửa</button>}
        </div>
      </form>
      {message && <p className="notice success" role="status">{message}</p>}
      {data.sections.length === 0 ? <p className="empty">Môn này chưa có lớp nào trong học kỳ hiện tại.</p> :
        <div className="table-scroll"><table className="data-table"><caption>Các lớp đang mở</caption>
          <thead><tr><th scope="col">Lớp</th><th scope="col">Giảng viên</th><th scope="col">Lịch học</th>
            <th scope="col">Sĩ số</th><th scope="col">Đang chờ</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{data.sections.map(section => <tr key={section.id}>
            <td>{section.code}</td><td>{section.lecturerName ?? '—'}</td>
            <td>{section.slots.map(slotText).join('; ')}</td>
            <td>{section.enrolledCount}/{section.capacity}</td><td>{section.waitlistCount ?? 0}</td>
            <td><div className="table-actions">
              <button disabled={busy} onClick={() => edit(section)}>Sửa {section.code}</button>
              <button disabled={busy} onClick={() => openRoster(section)}>Danh sách {section.code}</button>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </>}
  </section>
}
