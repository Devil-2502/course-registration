import { useCallback } from 'react'
import { request } from './api'
import type { CompletedCourse } from './api'
import { ErrorNotice, Loading } from './components'
import { useResource } from './useResource'

// UI-08 Kết quả học tập: để sinh viên tự đối chiếu môn tiên quyết (US-05)
export default function CompletedCourses() {
  const { data, error, loading, retry } = useResource(useCallback(() => request<CompletedCourse[]>('/students/me/completed-courses'), []))
  return <section>
    <h1>Kết quả học tập</h1>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && (data.length === 0 ?
      <p className="empty">Chưa có kết quả học tập nào.</p> :
      <div className="table-scroll"><table className="data-table">
        <caption>Các môn đã học và kết quả</caption>
        <thead><tr><th scope="col">Mã môn</th><th scope="col">Tên môn</th><th scope="col">Tín chỉ</th>
          <th scope="col">Học kỳ</th><th scope="col">Điểm</th><th scope="col">Kết quả</th></tr></thead>
        <tbody>{data.map(item => <tr key={`${item.course.id}-${item.semesterCode ?? ''}`}>
          <td>{item.course.code}</td><td>{item.course.name}</td><td>{item.course.credits}</td>
          <td>{item.semesterCode ?? '—'}</td><td>{item.grade}</td>
          <td><span className="badge">{item.passed ? 'Đã đạt (Passed)' : 'Chưa đạt'}</span></td>
        </tr>)}</tbody>
      </table></div>)}
  </section>
}
