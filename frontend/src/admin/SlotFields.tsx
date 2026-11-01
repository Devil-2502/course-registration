import type { Slot } from '../api'
import { days } from '../days'

const periods = Array.from({ length: 15 }, (_, index) => index + 1)

// Một dòng nhập buổi học: thứ, tiết bắt đầu, tiết kết thúc, phòng
export default function SlotFields({ index, slot, onChange, onRemove }: {
  index: number; slot: Slot; onChange: (patch: Partial<Slot>) => void; onRemove?: () => void
}) {
  const id = (name: string) => `slot-${index}-${name}`
  return <div className="slot-fields" role="group" aria-label={`Buổi ${index + 1}`}>
    <div><label htmlFor={id('day')}>Thứ</label>
      <select id={id('day')} value={slot.dayOfWeek} onChange={event => onChange({ dayOfWeek: Number(event.target.value) })}>
        {days.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{day}</option>)}
      </select></div>
    <div><label htmlFor={id('start')}>Từ tiết</label>
      <select id={id('start')} value={slot.startPeriod} onChange={event => onChange({ startPeriod: Number(event.target.value) })}>
        {periods.map(period => <option key={period} value={period}>{period}</option>)}
      </select></div>
    <div><label htmlFor={id('end')}>Đến tiết</label>
      <select id={id('end')} value={slot.endPeriod} onChange={event => onChange({ endPeriod: Number(event.target.value) })}>
        {periods.map(period => <option key={period} value={period}>{period}</option>)}
      </select></div>
    <div><label htmlFor={id('room')}>Phòng</label>
      <input id={id('room')} value={slot.room ?? ''} onChange={event => onChange({ room: event.target.value })} /></div>
    {onRemove && <button type="button" onClick={onRemove}>Xóa buổi {index + 1}</button>}
  </div>
}
