import {
  getQueuePosition,
  orderWaitingEntries,
  pickNextEligible,
  WaitlistEntry,
  WaitlistStatus,
} from '../src/waitlist/waitlist-queue';

const entry = (
  id: number,
  studentId: number,
  minute: number,
  status: WaitlistStatus = 'WAITING',
): WaitlistEntry => ({
  id,
  studentId,
  createdAt: new Date(Date.UTC(2026, 9, 20, 8, minute)),
  status,
});

describe('orderWaitingEntries', () => {
  it('Xếp theo thời điểm vào hàng, ai vào trước đứng trước', () => {
    const queue = [entry(1, 101, 30), entry(2, 102, 10), entry(3, 103, 20)];
    expect(orderWaitingEntries(queue).map((e) => e.studentId)).toEqual([102, 103, 101]);
  });

  it('Cùng thời điểm thì id nhỏ đứng trước', () => {
    const queue = [entry(5, 105, 10), entry(4, 104, 10)];
    expect(orderWaitingEntries(queue).map((e) => e.id)).toEqual([4, 5]);
  });

  it('Chỉ giữ những người đang WAITING', () => {
    const queue = [
      entry(1, 101, 1, 'PROMOTED'),
      entry(2, 102, 2, 'SKIPPED'),
      entry(3, 103, 3, 'CANCELLED'),
      entry(4, 104, 4),
    ];
    expect(orderWaitingEntries(queue).map((e) => e.id)).toEqual([4]);
  });

  it('Không làm thay đổi mảng đầu vào', () => {
    const queue = [entry(1, 101, 30), entry(2, 102, 10)];
    orderWaitingEntries(queue);
    expect(queue.map((e) => e.id)).toEqual([1, 2]);
  });
});

describe('getQueuePosition', () => {
  const queue = [entry(1, 101, 30), entry(2, 102, 10), entry(3, 103, 20, 'CANCELLED')];

  it('Trả về vị trí tính từ 1', () => {
    expect(getQueuePosition(queue, 102)).toBe(1);
    expect(getQueuePosition(queue, 101)).toBe(2);
  });

  it('Sinh viên đã rời hàng chờ thì trả null', () => {
    expect(getQueuePosition(queue, 103)).toBeNull();
  });

  it('Sinh viên không có trong hàng chờ thì trả null', () => {
    expect(getQueuePosition(queue, 999)).toBeNull();
  });
});

describe('pickNextEligible', () => {
  const queue = [entry(1, 101, 10), entry(2, 102, 20), entry(3, 103, 30)];

  it('Người đầu hàng đủ điều kiện thì được xếp vào lớp', () => {
    const result = pickNextEligible(queue, () => true);
    expect(result.promoted?.studentId).toBe(101);
    expect(result.skipped).toEqual([]);
  });

  it('Bỏ qua người không đủ điều kiện và xét người kế tiếp', () => {
    const result = pickNextEligible(queue, (e) => e.studentId !== 101);
    expect(result.promoted?.studentId).toBe(102);
    expect(result.skipped.map((e) => e.studentId)).toEqual([101]);
  });

  it('Không ai đủ điều kiện thì không đẩy ai, tất cả bị bỏ qua', () => {
    const result = pickNextEligible(queue, () => false);
    expect(result.promoted).toBeNull();
    expect(result.skipped.map((e) => e.studentId)).toEqual([101, 102, 103]);
  });

  it('Hàng chờ rỗng thì không đẩy ai', () => {
    expect(pickNextEligible([], () => true)).toEqual({ promoted: null, skipped: [] });
  });

  it('Không xét người đã PROMOTED, SKIPPED hay CANCELLED', () => {
    const mixed = [entry(1, 101, 1, 'SKIPPED'), entry(2, 102, 2, 'CANCELLED'), entry(3, 103, 3)];
    const checked: number[] = [];
    const result = pickNextEligible(mixed, (e) => {
      checked.push(e.studentId);
      return true;
    });
    expect(checked).toEqual([103]);
    expect(result.promoted?.studentId).toBe(103);
  });

  it('Dừng ngay khi tìm được người đủ điều kiện, không xét những người sau', () => {
    const checked: number[] = [];
    pickNextEligible(queue, (e) => {
      checked.push(e.studentId);
      return true;
    });
    expect(checked).toEqual([101]);
  });
});