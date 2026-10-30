import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { post, put, request } from '../api'
import type { Course, CourseInput, CoursePage } from '../api'
import { ErrorNotice, Loading } from '../components'
import { useResource } from '../useResource'

const empty: CourseInput = { code: '', name: '', credits: 3, description: '' }

// UI-09 Quản lý môn học (US-12): danh sách, thêm, sửa; lối vào UI-10 và UI-11
export default function AdminCourses({ openSections, openPrerequisites }: {
  openSections: (course: Course) => void; openPrerequisites: (course: Course) => void
}) {
  const [page, setPage] = useState(1)
  const { data, error, loading, retry } = useResource(useCallback(() => request<CoursePage>(`/courses?q=&page=${page}&pageSize=100`), [page]))
  const [form, setForm] = useState<CourseInput>(empty)
  const [editing, setEditing] = useState<Course>()
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [saveError, setSaveError] = useState<unknown>()
  const [message, setMessage] = useState<string>()

  function edit(course: Course) {
    setEditing(course); setSaveError(undefined); setMessage(undefined)
    setForm({ code: course.code, name: course.name, credits: course.credits, description: course.description ?? '' })
  }
  function reset() { setEditing(undefined); setForm(empty) }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    setBusy(true); setSaveError(undefined); setMessage(undefined)
    const input = { ...form, code: form.code.trim(), name: form.name.trim() }
    try {
      if (editing) await put<Course>(`/courses/${editing.id}`, input)
      else await post<Course>('/courses', input)
      setMessage(editing ? `Đã cập nhật môn ${input.code}.` : `Đã tạo môn ${input.code}.`)
      reset(); retry()
    } catch (failure) { setSaveError(failure) } finally { sending.current = false; setBusy(false) }
  }

  const title = editing ? `Sửa môn ${editing.code}` : 'Thêm môn mới'
  return <section>
    <h1>Quản lý môn học</h1>
    <form className="card admin-form" onSubmit={save} aria-label={title}>
      <h2>{title}</h2>
      <label htmlFor="course-code">Mã môn</label>
      <input id="course-code" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} required />
      <label htmlFor="course-name">Tên môn</label>
      <input id="course-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required />
      <label htmlFor="course-credits">Số tín chỉ</label>
      <input id="course-credits" type="number" min={1} value={form.credits}
        onChange={event => setForm({ ...form, credits: Number(event.target.value) })} required />
      <label htmlFor="course-description">Mô tả</label>
      <textarea id="course-description" rows={3} value={form.description ?? ''}
        onChange={event => setForm({ ...form, description: event.target.value })} />
      {saveError !== undefined && <ErrorNotice error={saveError} />}
      <div className="actions">
        <button className="primary" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm môn'}</button>
        {editing && <button type="button" disabled={busy} onClick={reset}>Hủy sửa</button>}
      </div>
    </form>
    {message && <p className="notice success" role="status">{message}</p>}
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
    {data.items.length === 0 && <p className="empty">Chưa có môn học nào.</p>}
    <div className="table-scroll">
      <table className="data-table"><caption>{data.total} môn học</caption>
        <thead><tr><th scope="col">Mã</th><th scope="col">Tên môn</th><th scope="col">Tín chỉ</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{data.items.map(course => <tr key={course.id}>
          <td>{course.code}</td><td>{course.name}</td><td>{course.credits}</td>
          <td><div className="table-actions">
            <button disabled={busy} onClick={() => edit(course)}>Sửa {course.code}</button>
            <button disabled={busy} onClick={() => openSections(course)}>Lớp học phần {course.code}</button>
            <button disabled={busy} onClick={() => openPrerequisites(course)}>Tiên quyết {course.code}</button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <nav className="actions pagination" aria-label="Phân trang quản lý môn học">
      <button disabled={busy || page <= 1} onClick={() => { reset(); setPage(value => value - 1) }}>Trang trước</button>
      <span>Trang {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
      <button disabled={busy || page * data.pageSize >= data.total} onClick={() => { reset(); setPage(value => value + 1) }}>Trang sau</button>
    </nav>
    </>}
  </section>
}
