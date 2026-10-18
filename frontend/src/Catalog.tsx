import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { request } from './api'
import type { CoursePage } from './api'
import { ErrorNotice, Loading } from './components'
import { useResource } from './useResource'

export default function Catalog({ openCourse }: { openCourse: (id: number) => void }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, error, loading, retry } = useResource(useCallback(
    () => request<CoursePage>(`/courses?${new URLSearchParams({ q: query, page: String(page), pageSize: '20' })}`), [query, page],
  ))
  function search(event: FormEvent) {
    event.preventDefault(); setQuery(input.trim()); setPage(1)
  }
  return <section>
    <h1>Tìm kiếm môn học</h1><p>Tra cứu môn học và các lớp học phần đang mở.</p>
    <form className="search" onSubmit={search}>
      <label htmlFor="course-search">Mã hoặc tên môn học</label>
      <div className="actions"><input id="course-search" value={input} onChange={event => setInput(event.target.value)} placeholder="Ví dụ: CS201 hoặc Data" /><button>Tìm kiếm</button></div>
    </form>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
      <p role="status">{data.total} môn học</p>
      {data.items.length === 0 ? <p className="empty">No courses found — Không tìm thấy môn học.</p> :
        <div className="course-list">{data.items.map(course => <article className="card" key={course.id}>
          <span className="eyebrow">{course.code}</span><h2>{course.name}</h2><p>{course.credits} tín chỉ</p>
          <button onClick={() => openCourse(course.id)}>Xem chi tiết {course.code}</button>
        </article>)}</div>}
      <nav className="actions pagination" aria-label="Phân trang môn học">
        <button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trang trước</button>
        <span>Trang {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
        <button disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Trang sau</button>
      </nav>
    </>}
  </section>
}
