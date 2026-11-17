import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { post, request } from './api'
import type { CourseStatus, CoursePage, ScheduleSuggestion, SuggestedSection, SuggestionPreferences, SuggestionResult, WeeklySchedule } from './api'
import { ErrorNotice, Loading } from './components'
import { days, slotText } from './days'
import { Timetable } from './Schedule'
import { useResource } from './useResource'

const MAX_COURSES = 8

const statusText: Record<CourseStatus, string> = {
  INCLUDED: 'Đã đưa vào xếp lịch',
  ALREADY_ENROLLED: 'Bạn đã đăng ký môn này rồi',
  COURSE_ALREADY_PASSED: 'Bạn đã đạt môn này',
  PREREQUISITE_NOT_MET: 'Chưa đạt môn tiên quyết',
  NO_AVAILABLE_SECTION: 'Các lớp đều đã đủ sĩ số',
  CLASHES_WITH_ENROLLED: 'Mọi lớp đều trùng lịch với lớp bạn đang học',
}

// Tuần học của một phương án: lớp đang học cộng các lớp được gợi ý, dạng WeeklySchedule để dùng lại Timetable.
function weekOf(result: SuggestionResult, suggestion: ScheduleSuggestion): WeeklySchedule {
  const sections: SuggestedSection[] = [...result.enrolled, ...suggestion.sections]
  return {
    semesterId: result.semesterId,
    totalCredits: result.currentCredits + result.requestedCredits,
    maxCredits: result.maxCredits,
    entries: sections.flatMap(section => section.slots.map(slot => ({
      ...slot, sectionId: section.sectionId, sectionCode: section.sectionCode,
      courseCode: section.courseCode, courseName: section.courseName, credits: section.credits,
    }))),
  }
}

function metricsText({ metrics }: ScheduleSuggestion) {
  const parts = [`${metrics.studyDays} ngày đến trường`, `${metrics.morningSessions} buổi sáng`, `${metrics.afternoonSessions} buổi chiều`, `${metrics.gapPeriods} tiết trống`]
  if (metrics.busyFreeDays.length > 0) parts.push(`vẫn học vào ${metrics.busyFreeDays.map(day => days[day - 1]).join(', ')}`)
  return parts.join(' · ')
}

type Outcome = { section: SuggestedSection; error?: unknown }

export default function Suggestions({ schedule }: { schedule: () => void }) {
  const catalog = useResource(useCallback(() => request<CoursePage>('/courses?pageSize=100'), []))
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [preferences, setPreferences] = useState<SuggestionPreferences>({ avoidMorning: false, avoidAfternoon: false, compactDays: false, freeDays: [] })
  const [result, setResult] = useState<SuggestionResult>()
  const [chosen, setChosen] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>()
  const [confirming, setConfirming] = useState(false)
  const [outcomes, setOutcomes] = useState<Outcome[]>()

  function toggleCourse(id: number) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }
  function toggleDay(day: number) {
    setPreferences(current => ({
      ...current,
      freeDays: current.freeDays.includes(day) ? current.freeDays.filter(item => item !== day) : [...current.freeDays, day].sort((a, b) => a - b),
    }))
  }
  async function suggest(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(undefined); setOutcomes(undefined); setConfirming(false)
    try {
      setResult(await post<SuggestionResult>('/schedule-suggestions', { courseIds: selected, preferences }))
      setChosen(0)
    } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  // Đăng ký lần lượt từng lớp bằng API đăng ký thường; lớp nào lỗi thì báo riêng, các lớp khác vẫn tiếp tục.
  async function registerAll(suggestion: ScheduleSuggestion) {
    setBusy(true); setConfirming(false)
    const done: Outcome[] = []
    for (const section of suggestion.sections) {
      try {
        await post('/registrations', { sectionId: section.sectionId })
        done.push({ section })
      } catch (failure) { done.push({ section, error: failure }) }
    }
    setOutcomes(done); setBusy(false)
  }

  const term = filter.trim().toLowerCase()
  const courses = (catalog.data?.items ?? []).filter(course =>
    selected.includes(course.id) || term === '' || `${course.code} ${course.name}`.toLowerCase().includes(term))
  const suggestion = result?.suggestions[chosen]

  return <section>
    <h1>Gợi ý thời khóa biểu</h1>
    <p>Chọn các môn muốn học, hệ thống tìm mọi cách xếp lớp không trùng lịch (kể cả với lớp bạn đang học) và xếp hạng theo sở thích.</p>
    {catalog.loading ? <Loading /> : catalog.error ? <ErrorNotice error={catalog.error} retry={catalog.retry} /> :
      <form className="suggest-form" onSubmit={suggest}>
        <fieldset><legend>Môn muốn học ({selected.length}/{MAX_COURSES})</legend>
          <label htmlFor="course-filter">Lọc theo mã hoặc tên</label>
          <input id="course-filter" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Ví dụ: CS hoặc Calculus" />
          <div className="course-picks">{courses.map(course => <label key={course.id}>
            <input type="checkbox" checked={selected.includes(course.id)} onChange={() => toggleCourse(course.id)}
              disabled={!selected.includes(course.id) && selected.length >= MAX_COURSES} />
            {course.code} – {course.name} ({course.credits} TC)
          </label>)}</div>
        </fieldset>
        <fieldset><legend>Sở thích</legend>
          <div className="inline-options">
            <label><input type="checkbox" checked={preferences.avoidMorning} onChange={event => setPreferences({ ...preferences, avoidMorning: event.target.checked })} />Tránh học buổi sáng (tiết 1–6)</label>
            <label><input type="checkbox" checked={preferences.avoidAfternoon} onChange={event => setPreferences({ ...preferences, avoidAfternoon: event.target.checked })} />Tránh học buổi chiều (tiết 7–12)</label>
            <label><input type="checkbox" checked={preferences.compactDays} onChange={event => setPreferences({ ...preferences, compactDays: event.target.checked })} />Dồn lịch vào ít ngày</label>
          </div>
          <p>Ngày muốn nghỉ:</p>
          <div className="inline-options">{days.map((day, index) => <label key={day}>
            <input type="checkbox" checked={preferences.freeDays.includes(index + 1)} onChange={() => toggleDay(index + 1)} />{day}
          </label>)}</div>
        </fieldset>
        <button className="primary" disabled={busy || selected.length === 0}>{busy ? 'Đang xử lý…' : 'Tìm phương án'}</button>
      </form>}
    {error !== undefined && <ErrorNotice error={error} />}
    {result && <div className="preview-panel">
      <h2>Kết quả</h2>
      <ul className="course-outcomes">{result.courses.map(({ course, status, missingCourses }) =>
        <li key={course.id} className={status === 'INCLUDED' ? undefined : 'skipped'}>
          <strong>{course.code}</strong> – {course.name}: {statusText[status]}
          {missingCourses && missingCourses.length > 0 && ` (${missingCourses.map(item => `${item.code} – ${item.name}`).join(', ')})`}
        </li>)}
      </ul>
      <p className="credits">Tín chỉ: đang học {result.currentCredits} + chọn thêm {result.requestedCredits} = <strong>{result.currentCredits + result.requestedCredits} / {result.maxCredits}</strong></p>
      {result.exceedsCreditLimit && <div className="notice error" role="alert"><p>Vượt giới hạn tín chỉ của học kỳ: hãy bỏ bớt môn trước khi đăng ký.</p></div>}
      {result.suggestions.length === 0 ? <p className="empty">
        {result.courses.some(item => item.status === 'INCLUDED') ? 'Không có cách xếp nào để các môn đã chọn không trùng lịch nhau. Hãy thử bỏ bớt một môn.' : 'Không còn môn nào để xếp lịch.'}
      </p> : <>
        <p role="status">Tìm thấy {result.totalCombinations}{result.truncated ? '+' : ''} cách xếp không trùng lịch, đây là {result.suggestions.length} phương án tốt nhất.</p>
        <div className="option-tabs">{result.suggestions.map((item, index) =>
          <button key={item.rank} aria-pressed={index === chosen} onClick={() => { setChosen(index); setOutcomes(undefined); setConfirming(false) }}>Phương án {item.rank}</button>)}
        </div>
        {suggestion && <article>
          <h3>Phương án {suggestion.rank}</h3>
          <p>{metricsText(suggestion)}</p>
          <table className="data-table"><caption>Các lớp sẽ đăng ký</caption>
            <thead><tr><th scope="col">Lớp</th><th scope="col">Môn</th><th scope="col">Lịch học</th><th scope="col">Còn chỗ</th></tr></thead>
            <tbody>{suggestion.sections.map(section => <tr key={section.sectionId}>
              <td>{section.sectionCode}</td><td>{section.courseName}</td>
              <td>{section.slots.map(slotText).join('; ')}</td><td>{section.remainingSeats}</td>
            </tr>)}</tbody>
          </table>
          <Timetable schedule={weekOf(result, suggestion)} creditsLabel="Tín chỉ nếu đăng ký phương án này" />
          {outcomes ? <div>
            <ul className="course-outcomes">{outcomes.map(({ section, error: failure }) => <li key={section.sectionId}>
              {failure === undefined ? <p className="notice success">Đã đăng ký {section.sectionCode}.</p> :
                <><strong>{section.sectionCode}:</strong><ErrorNotice error={failure} /></>}
            </li>)}</ul>
            <button onClick={schedule}>Xem thời khóa biểu tuần</button>
          </div> : confirming ? <div className="notice actions" role="group" aria-label="Xác nhận đăng ký">
            <p>Đăng ký {suggestion.sections.length} lớp: {suggestion.sections.map(section => section.sectionCode).join(', ')}?</p>
            <button className="primary" disabled={busy} onClick={() => registerAll(suggestion)}>Xác nhận đăng ký</button>
            <button disabled={busy} onClick={() => setConfirming(false)}>Hủy</button>
          </div> : <button className="primary" disabled={busy || result.exceedsCreditLimit} onClick={() => setConfirming(true)}>Đăng ký phương án này</button>}
        </article>}
      </>}
    </div>}
  </section>
}
