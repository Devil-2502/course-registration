import { request } from './api'
import type { Course, Section, WeeklySchedule } from './api'
import { ErrorNotice, Loading } from './components'
import { days } from './days'
import { useResource } from './useResource'

export function Timetable({ schedule, preview, conflict = false }: {
  schedule: WeeklySchedule
  preview?: { course: Course; section: Section }
  conflict?: boolean
}) {
  return <>
    <p className="credits">Tín chỉ đã đăng ký: <strong>{schedule.totalCredits} / {schedule.maxCredits}</strong></p>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Thời khóa biểu tuần, kéo ngang để xem đủ bảy ngày">
      <table className="timetable"><caption>Thời khóa biểu tuần — tiết 1 đến 15</caption>
        <thead><tr><th scope="col">Tiết</th>{days.map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 15 }, (_, index) => index + 1).map(period => <tr key={period}>
          <th scope="row">{period}</th>{days.map((day, index) => {
            const entries = schedule.entries.filter(entry => entry.dayOfWeek === index + 1 && entry.startPeriod <= period && entry.endPeriod >= period)
            const slots = preview?.section.slots.filter(slot => slot.dayOfWeek === index + 1 && slot.startPeriod <= period && slot.endPeriod >= period) ?? []
            // API quyết định có trùng lịch hay không; phần giao nhau chỉ dùng để tô đúng ô.
            const overlapping = conflict && entries.length > 0 && slots.length > 0
            return <td key={day} className={overlapping ? 'clash' : undefined}>
              {entries.map((entry, entryIndex) => <div className="lesson" key={`${entry.sectionId}-${entryIndex}`}>
                <strong>{entry.sectionCode}</strong><span>{entry.courseName}</span><small>Tiết {entry.startPeriod}–{entry.endPeriod}{entry.room && ` · ${entry.room}`}</small>
              </div>)}
              {slots.map((slot, slotIndex) => <div key={slotIndex} className="lesson preview">
                <strong>{preview?.section.code}</strong><span>Xem trước · {preview?.course.name}</span><small>Tiết {slot.startPeriod}–{slot.endPeriod}{slot.room && ` · ${slot.room}`}</small>
                {overlapping && <strong>Trùng lịch</strong>}
              </div>)}
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </>
}

export default function Schedule({ catalog }: { catalog: () => void }) {
  const { data, loading, error, retry } = useResource(useCallback(() => request<WeeklySchedule>('/students/me/schedule'), []))
  return <section><h1>Thời khóa biểu tuần</h1>
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
      {data.entries.length === 0 && <div className="empty"><p>Bạn chưa đăng ký lớp nào trong học kỳ này.</p><button onClick={catalog}>Tìm môn học</button></div>}
      <Timetable schedule={data} />
    </>}
  </section>
}
import { useCallback } from 'react'
