import { useCallback, useRef, useState } from 'react'
import { post, remove, request } from './api'
import type { Registration, SwapRequest, SwapResult, WaitlistEntry } from './api'
import { ErrorNotice, Loading } from './components'
import { slotText } from './days'
import SwapPicker, { SwapError } from './SwapPicker'
import { useResource } from './useResource'

// Câu báo kết quả sau khi xin đổi lớp (cải tiến 2).
function swapMessage(result: SwapResult): string {
  const { fromSection, toSection } = result.request
  if (result.outcome === 'MOVED') return `Đã chuyển từ ${fromSection.code} sang ${toSection.code}.`
  if (result.outcome === 'SWAPPED') return `Đã đổi chéo với một bạn ở ${toSection.code}: bạn đã sang ${toSection.code}.`
  return `Lớp ${toSection.code} đã đầy. Đã lưu yêu cầu: bạn vẫn giữ chỗ ở ${fromSection.code}, hệ thống tự đổi khi có người muốn đổi ngược.`
}

const swapLabels: Record<SwapRequest['status'], string> = {
  OPEN: 'Đang chờ người đổi ngược', COMPLETED: 'Đã đổi xong', CANCELLED: 'Đã hủy',
}

const waitlistLabels: Record<WaitlistEntry['status'], string> = {
  WAITING: 'Đang chờ', PROMOTED: 'Đã được xếp lớp', SKIPPED: 'Đã bỏ qua', CANCELLED: 'Đã rời hàng chờ',
}

// UI-07 Môn đã đăng ký: hủy môn (US-10), xem và rời hàng chờ (US-09), đổi lớp (cải tiến 2)
export default function MyRegistrations({ catalog }: { catalog: () => void }) {
  const { data, error, loading, retry } = useResource(useCallback(async () => {
    const [registrations, waitlist, swaps] = await Promise.all([
      request<Registration[]>('/registrations'),
      request<WaitlistEntry[]>('/waitlist'),
      request<SwapRequest[]>('/swap-requests'),
    ])
    return { registrations, waitlist, swaps }
  }, []))
  const [confirming, setConfirming] = useState<number>()
  const [swapping, setSwapping] = useState<number>()
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [actionError, setActionError] = useState<unknown>()
  const [message, setMessage] = useState<string>()

  // Gửi một thao tác, khóa nút trong lúc chờ, rồi tải lại vì máy chủ có thể vừa đẩy người chờ vào lớp
  async function run<T>(action: () => Promise<T>, done: string | ((result: T) => string)) {
    if (sending.current) return
    sending.current = true
    setBusy(true); setActionError(undefined); setMessage(undefined)
    try {
      const result = await action()
      setMessage(typeof done === 'string' ? done : done(result))
      setSwapping(undefined)
      retry()
    } catch (failure) { setActionError(failure) } finally { sending.current = false; setBusy(false); setConfirming(undefined) }
  }

  const registrations = data?.registrations.filter(item => item.status === 'ENROLLED') ?? []
  const waiting = data?.waitlist.filter(entry => entry.status === 'WAITING') ?? []
  const history = data?.waitlist.filter(entry => entry.status !== 'WAITING') ?? []

  function waitlistCard(entry: WaitlistEntry) {
    const code = entry.section?.code ?? `Lớp #${entry.sectionId}`
    return <li className="card actions" key={entry.id}>
      <span><strong>{code}</strong> · Vị trí {entry.position ?? '—'} · <span className="badge">{waitlistLabels[entry.status]}</span></span>
      {entry.status === 'WAITING' && <button disabled={busy} onClick={() => run(() => remove(`/waitlist/${entry.id}`), `Đã rời hàng chờ ${code}.`)}>
        Rời hàng chờ {code}
      </button>}
    </li>
  }

  return <section>
    <h1>Môn đã đăng ký</h1>
    {message && <p className="notice success" role="status">{message}</p>}
    {actionError !== undefined && <SwapError error={actionError} />}
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
        </div> : swapping === item.id ? <SwapPicker registration={item} busy={busy} close={() => setSwapping(undefined)}
          choose={sectionId => run(() => post<SwapResult>('/swap-requests', { toSectionId: sectionId }), swapMessage)} /> :
          <div className="actions">
            <button disabled={busy} onClick={() => setConfirming(item.id)}>Hủy lớp {item.section.code}</button>
            <button disabled={busy} onClick={() => { setSwapping(item.id); setActionError(undefined); setMessage(undefined) }}>Đổi lớp {item.section.code}</button>
          </div>}
      </article>)}</div>}

      {data.swaps.length > 0 && <>
        <h2>Yêu cầu đổi lớp</h2>
        <ul className="waitlist">{data.swaps.map(swap => <li className="card actions" key={swap.id}>
          <span><strong>{swap.fromSection.code} → {swap.toSection.code}</strong> · <span className="badge">
            {swap.outcome === 'SWAPPED' ? 'Đã đổi chéo' : swap.outcome === 'MOVED' ? 'Đã chuyển lớp' : swapLabels[swap.status]}
          </span></span>
          {swap.status === 'OPEN' && <button disabled={busy}
            onClick={() => run(() => remove(`/swap-requests/${swap.id}`), `Đã hủy yêu cầu đổi ${swap.fromSection.code} → ${swap.toSection.code}.`)}>
            Hủy yêu cầu {swap.fromSection.code} → {swap.toSection.code}
          </button>}
        </li>)}</ul>
      </>}

      <h2>Hàng chờ</h2>
      {waiting.length === 0 ? <p className="empty">Bạn không ở trong hàng chờ nào.</p> :
        <ul className="waitlist">{waiting.map(waitlistCard)}</ul>}
      {history.length > 0 && <>
        <h2>Lịch sử hàng chờ</h2>
        <ul className="waitlist">{history.map(waitlistCard)}</ul>
      </>}
    </>}
  </section>
}
