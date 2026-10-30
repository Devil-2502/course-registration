import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { post, remove, request } from '../api'
import type { Course, CoursePage } from '../api'
import { ErrorNotice, Loading } from '../components'
import { useResource } from '../useResource'

// Endpoint danh mục có phân trang; danh sách chọn không được mất các môn sau trang đầu.
async function courseOptions() {
  const items: Course[] = []
  let page = 1
  while (true) {
    const result = await request<CoursePage>(`/courses?q=&page=${page}&pageSize=100`)
    items.push(...result.items)
    if (page * result.pageSize >= result.total || result.items.length === 0) return items
    page += 1
  }
}

// UI-10 Quản lý môn tiên quyết (US-13): xem, thêm, gỡ. Kiểm tra vòng lặp do máy chủ làm.
export default function AdminPrerequisites({ course, back }: { course: Course; back: () => void }) {
  const { data, error, loading, retry } = useResource(useCallback(async () => {
    const [prerequisites, catalog] = await Promise.all([
      request<Course[]>(`/courses/${course.id}/prerequisites`),
      courseOptions(),
    ])
    return { prerequisites, catalog }
  }, [course.id]))
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [actionError, setActionError] = useState<unknown>()
  const [message, setMessage] = useState<string>()

  async function run(action: () => Promise<unknown>, done: string) {
    if (sending.current) return
    sending.current = true
    setBusy(true); setActionError(undefined); setMessage(undefined)
    try {
      await action()
      setMessage(done); setSelected(''); retry()
    } catch (failure) { setActionError(failure) } finally { sending.current = false; setBusy(false) }
  }
  function add(event: FormEvent) {
    event.preventDefault()
    const target = data?.catalog.find(item => item.id === Number(selected))
    if (!target) return
    void run(() => post(`/courses/${course.id}/prerequisites`, { prerequisiteId: target.id }), `Đã thêm ${target.code} làm môn tiên quyết.`)
  }

  // Chỉ bỏ môn đang sửa và các môn đã là tiên quyết; môn có thể tạo vòng vẫn để chọn, máy chủ sẽ từ chối
  const options = data?.catalog.filter(item => item.id !== course.id && !data.prerequisites.some(p => p.id === item.id)) ?? []
  return <section>
    <button disabled={busy} onClick={back}>← Quản lý môn học</button>
    <h1>Môn tiên quyết của {course.code} — {course.name}</h1>
    {message && <p className="notice success" role="status">{message}</p>}
    {actionError !== undefined && <ErrorNotice error={actionError} />}
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
      {data.prerequisites.length === 0 ? <p className="empty">Môn này chưa có môn tiên quyết.</p> :
        <ul className="waitlist">{data.prerequisites.map(item => <li className="card actions" key={item.id}>
          <span><strong>{item.code}</strong> — {item.name}</span>
          <button className="danger" disabled={busy}
            onClick={() => run(() => remove(`/courses/${course.id}/prerequisites/${item.id}`), `Đã gỡ ${item.code}.`)}>
            Gỡ {item.code}
          </button>
        </li>)}</ul>}
      <form className="card admin-form" onSubmit={add}>
        <label htmlFor="prerequisite">Thêm môn tiên quyết</label>
        <select id="prerequisite" value={selected} onChange={event => setSelected(event.target.value)} required>
          <option value="">-- Chọn môn --</option>
          {options.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
        </select>
        <button className="primary" disabled={busy || !selected}>{busy ? 'Đang lưu…' : 'Thêm'}</button>
      </form>
    </>}
  </section>
}
