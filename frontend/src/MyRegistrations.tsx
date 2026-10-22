import { useCallback, useRef, useState } from 'react'
import { remove, request } from './api'
import type { Registration, WaitlistEntry } from './api'
import { ErrorNotice, Loading } from './components'
import { slotText } from './days'
import { useResource } from './useResource'

const waitlistLabels: Record<WaitlistEntry['status'], string> = {
  WAITING: 'Đang chờ', PROMOTED: 'Đã được xếp lớp', SKIPPED: 'Đã bỏ qua', CANCELLED: 'Đã rời hàng chờ',
}

// UI-07 Môn đã đăng ký: hủy môn (US-10), xem và rời hàng chờ (US-09)
export default function MyRegistrations({ catalog }: { catalog: () => void }) {
  const { data, error, loading, retry } = useResource(useCallback(async () => {
    const [registrations, waitlist] = await Promise.all([
      request<Registration[]>('/registrations'),
      request<WaitlistEntry[]>('/waitlist'),
    ])
    return { registrations, waitlist }
  }, []))
  const [confirming, setConfirming] = useState<number>()
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [actionError, setActionError] = useState<unknown>()
  const [message, setMessage] = useState<string>()

  // Gửi một thao tác, khóa nút trong lúc chờ, rồi tải lại vì máy chủ có thể vừa đẩy người chờ vào lớp
  async function run(action: () => Promise<unknown>, done: string) {
    if (sending.current) return
    sending.current = true
    setBusy(true); setActionError(undefined); setMessage(undefined)
    try {
      await action()
      setMessage(done)
      retry()
    } catch (failure) { setActionError(failure) } finally { sending.current = false; setBusy(false); setConfirming(undefined) }
  }

  const registrations = data?.registrations.filter(item => item.status === 'ENROLLED') ?? []

  return <section>
    <h1>Môn đã đăng ký</h1>
    {message && <p className="notice success" role="status">{message}</p>}
    {actionError !== undefined && <ErrorNotice error={actionError} />}
    {loading ? <Loading /> : error ? <ErrorNotice error={error} retry={retry} /> : data && <>
      <h2>Lớp đã đăng ký</h2>
      {registrations.length === 0 ? <div className="empty">
        <p>Bạn chưa đăng ký lớp nào trong học kỳ này.</p><button onClick={catalog}>Tìm môn học</button>
      </div> : <div className="course-list">{registrations.map(item => <article className="card" key={item.id}>
        <p className="eyebrow">{item.course ? `${item.course.code} · ${item.course.credits} tín chỉ` : `Môn #${item.section.courseId}`}</p>
        <h3>{item.section.code}{item.course && ` — ${item.course.name}`}</h3>
        <ul>{item.section.slots.map((slot, index) => <li key={index}>{slotText(slot)}</li>)}</ul>
        {confirming === item.id ? <div className="notice" role="group" aria-label={`Xác nhận hủy ${item.section.code}`}>
          <p>Hủy lớp {item.section.code}? Chỗ của bạn có thể được chuyển ngay cho người đầu hàng chờ.</p>
          <div className="actions">
            <button className="danger" disabled={busy}
              onClick={() => run(() => remove(`/registrations/${item.id}`), `Đã hủy lớp ${item.section.code}.`)}>
              {busy ? 'Đang hủy…' : 'Xác nhận hủy'}
            </button>
            <button disabled={busy} onClick={() => setConfirming(undefined)}>Không hủy</button>
          </div>
        </div> : <button disabled={busy} onClick={() => setConfirming(item.id)}>Hủy lớp {item.section.code}</button>}
      </article>)}</div>}

      <h2>Hàng chờ</h2>
      {data.waitlist.length === 0 ? <p className="empty">Bạn không ở trong hàng chờ nào.</p> :
        <ul className="waitlist">{data.waitlist.map(entry => {
          const code = entry.section?.code ?? `Lớp #${entry.sectionId}`
          return <li className="card actions" key={entry.id}>
            <span><strong>{code}</strong> · Vị trí {entry.position ?? '—'} · <span className="badge">{waitlistLabels[entry.status]}</span></span>
            {entry.status === 'WAITING' && <button disabled={busy} onClick={() => run(() => remove(`/waitlist/${entry.id}`), `Đã rời hàng chờ ${code}.`)}>
              Rời hàng chờ {code}
            </button>}
          </li>
        })}</ul>}
    </>}
  </section>
}
