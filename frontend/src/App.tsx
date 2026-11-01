import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { post, request } from './api'
import type { User } from './api'
import { ErrorNotice, Loading } from './components'
import { useResource } from './useResource'
import Admin from './admin/Admin'
import Catalog from './Catalog'
import CompletedCourses from './CompletedCourses'
import CourseDetails from './CourseDetails'
import MyRegistrations from './MyRegistrations'
import Schedule from './Schedule'
import './App.css'

type Page = 'catalog' | 'schedule' | 'registrations' | 'completed'

function App() {
  const session = useResource(useCallback(() => request<User>('/auth/me'), []))
  const [signedInUser, setUser] = useState<User>()
  const [loginRequired, setLoginRequired] = useState(false)
  const user = signedInUser ?? (loginRequired ? undefined : session.data)
  const [page, setPage] = useState<Page>('catalog')
  const [courseId, setCourseId] = useState<number>()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    function expire() { setUser(undefined); setLoginRequired(true); setCourseId(undefined); setPage('catalog') }
    window.addEventListener('session-expired', expire)
    return () => window.removeEventListener('session-expired', expire)
  }, [])
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true); setError(undefined)
    try {
      setUser(await post<User>('/auth/login', { email: form.get('email'), password: form.get('password') }))
      setLoginRequired(false)
    } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  function open(next: Page) { setPage(next); setCourseId(undefined) }
  async function logout() {
    setBusy(true); setError(undefined)
    try {
      await request('/auth/logout', { method: 'POST' })
      setUser(undefined); setCourseId(undefined); setPage('catalog'); setLoginRequired(true)
    } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  if (!user) return <main className="login card">
    <p className="eyebrow">CỔNG ĐĂNG KÝ HỌC PHẦN</p><h1>Đăng nhập sinh viên</h1>
    {session.loading && !loginRequired ? <Loading /> : <>
      {session.error && !loginRequired && <ErrorNotice error={session.error} retry={session.retry} />}
      <form onSubmit={login}>
        <label htmlFor="email">Email trường</label><input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Mật khẩu</label><input id="password" name="password" type="password" autoComplete="current-password" required />
        <button disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      {error !== undefined && <ErrorNotice error={error} />}
    </>}
  </main>
  return <>
    <header><div><strong>Đăng ký học phần</strong><p>{user.fullName}</p></div><nav aria-label="Điều hướng chính">
      {user.role === 'STUDENT' && <>
        <button aria-current={page === 'catalog' ? 'page' : undefined} onClick={() => open('catalog')}>Danh mục môn học</button>
        <button aria-current={page === 'schedule' ? 'page' : undefined} onClick={() => open('schedule')}>Thời khóa biểu tuần</button>
        <button aria-current={page === 'registrations' ? 'page' : undefined} onClick={() => open('registrations')}>Môn đã đăng ký</button>
        <button aria-current={page === 'completed' ? 'page' : undefined} onClick={() => open('completed')}>Kết quả học tập</button>
      </>}
      <button disabled={busy} onClick={logout}>Đăng xuất</button>
    </nav></header>
    <main>{error !== undefined && <ErrorNotice error={error} />}
      {user.role === 'ADMIN' ? <Admin /> : page === 'schedule' ?
        <Schedule catalog={() => open('catalog')} /> : page === 'registrations' ?
        <MyRegistrations catalog={() => open('catalog')} /> : page === 'completed' ?
        <CompletedCourses /> : courseId !== undefined ?
          <CourseDetails key={courseId} id={courseId} back={() => setCourseId(undefined)} /> : <Catalog openCourse={setCourseId} />}
    </main>
  </>
}
export default App
