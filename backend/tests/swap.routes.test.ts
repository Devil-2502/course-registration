import express from 'express';
import request from 'supertest';
import { AppError } from '../src/common/app-error';
import { errorHandler } from '../src/common/error-handler';
import { planSwap, swapViolation, type SwapFacts } from '../src/swaps/swap-rules';
import type { SwapRequestView, SwapStore } from '../src/swaps/swap.repository';
import { createSwapRouter, parseSwapRequest } from '../src/swaps/swap.routes';

const ok: SwapFacts = {
  registrationOpen: true,
  fromSection: { sectionId: 21, sectionCode: 'CS201-01' },
  targetSectionId: 22,
  openRequestExists: false,
  clashesWith: [],
};

describe('swapViolation: kiểm tra theo thứ tự', () => {
  it('hợp lệ thì trả null', () => {
    expect(swapViolation(ok)).toBeNull();
  });

  it.each([
    [{ registrationOpen: false, fromSection: null }, 'REGISTRATION_CLOSED', 403],
    [{ fromSection: null }, 'NOT_ENROLLED_IN_COURSE', 409],
    [{ targetSectionId: 21, openRequestExists: true }, 'SAME_SECTION', 409],
    [
      { openRequestExists: true, clashesWith: [{ sectionId: 11, sectionCode: 'MA101-01' }] },
      'SWAP_REQUEST_EXISTS',
      409,
    ],
  ])('%j → %s', (change, code, status) => {
    expect(swapViolation({ ...ok, ...change })).toMatchObject({ code, status });
  });

  it('trùng lịch thì kèm danh sách lớp bị trùng', () => {
    const clash = [{ sectionId: 11, sectionCode: 'MA101-01' }];
    expect(swapViolation({ ...ok, clashesWith: clash })).toMatchObject({
      code: 'SCHEDULE_CLASH',
      message: 'Schedule clash with MA101-01',
      details: { conflictsWith: clash },
    });
  });
});

describe('planSwap', () => {
  it('ưu tiên đổi chéo, rồi chuyển thẳng nếu còn chỗ, cuối cùng là chờ', () => {
    expect(planSwap(true, 5)).toBe('SWAP');
    expect(planSwap(true, 0)).toBe('SWAP');
    expect(planSwap(false, 1)).toBe('MOVE');
    expect(planSwap(false, 0)).toBe('QUEUE');
  });
});

describe('parseSwapRequest', () => {
  it('nhận toSectionId nguyên dương', () => {
    expect(parseSwapRequest({ toSectionId: 22 })).toEqual({ toSectionId: 22 });
  });
  it.each([{}, { toSectionId: '22' }, { toSectionId: 0 }, null, [22]])('từ chối %j', (body) => {
    expect(() => parseSwapRequest(body)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});

describe('/swap-requests', () => {
  const view: SwapRequestView = {
    id: 5,
    courseCode: 'CS201',
    courseName: 'DSA',
    fromSection: { id: 21, code: 'CS201-01' },
    toSection: { id: 22, code: 'CS201-02' },
    status: 'OPEN',
    outcome: null,
    createdAt: '2026-11-17T00:00:00.000Z',
    resolvedAt: null,
  };

  function appWith(store: Partial<SwapStore>) {
    const full: SwapStore = {
      request: jest.fn(),
      list: jest.fn(),
      cancel: jest.fn(),
      ...store,
    };
    const app = express();
    app.use(express.json());
    app.use(
      '/swap-requests',
      createSwapRouter(full, () => 402),
    );
    app.use(errorHandler);
    return { app, store: full };
  }

  it('POST: 201 kèm kết quả, dùng id sinh viên đang đăng nhập', async () => {
    const { app, store } = appWith({
      request: jest.fn().mockResolvedValue({ outcome: 'PENDING', request: view }),
    });
    const response = await request(app).post('/swap-requests').send({ toSectionId: 22 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ outcome: 'PENDING', request: view });
    expect(store.request).toHaveBeenCalledWith(402, 22);
  });

  it('POST: body sai thì 400, không gọi store', async () => {
    const { app, store } = appWith({});
    const response = await request(app).post('/swap-requests').send({ toSectionId: 'x' });
    expect(response.status).toBe(400);
    expect(store.request).not.toHaveBeenCalled();
  });

  it('POST: lỗi nghiệp vụ trả đúng mã', async () => {
    const { app } = appWith({
      request: jest.fn().mockRejectedValue(new AppError('SAME_SECTION', 409, 'Same.')),
    });
    const response = await request(app).post('/swap-requests').send({ toSectionId: 22 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SAME_SECTION');
  });

  it('GET: danh sách yêu cầu', async () => {
    const { app, store } = appWith({ list: jest.fn().mockResolvedValue([view]) });
    const response = await request(app).get('/swap-requests');
    expect(response.body).toEqual([view]);
    expect(store.list).toHaveBeenCalledWith(402);
  });

  it('DELETE: 204; id sai thì 400', async () => {
    const { app, store } = appWith({ cancel: jest.fn().mockResolvedValue(undefined) });
    expect((await request(app).delete('/swap-requests/5')).status).toBe(204);
    expect(store.cancel).toHaveBeenCalledWith(402, 5);
    expect((await request(app).delete('/swap-requests/abc')).status).toBe(400);
  });
});
