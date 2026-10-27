import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { AppError } from '../src/common/app-error';
import { errorHandler } from '../src/common/error-handler';
import type { WaitlistStatus } from '../src/waitlist/waitlist-queue';
import type { WaitlistFacts } from '../src/waitlist/waitlist-rules';
import {
  createWaitlistRouter,
  type WaitlistEntryResponse,
  type WaitlistStore,
} from '../src/waitlist/waitlist.routes';

// Gherkin US-09: CS201-01 (id 21) đã đầy; CS201-02 (id 22) còn 3 chỗ.
const full: WaitlistFacts = {
  registrationOpen: true,
  enrolledInSameCourse: false,
  alreadyWaiting: false,
  missingPrerequisites: [],
  remainingSeats: 0,
};
const sections: Record<number, WaitlistFacts> = {
  21: full,
  22: { ...full, remainingSeats: 3 },
};

const entry = (id: number, status: WaitlistStatus, position: number | null) =>
  ({
    id,
    studentId: 402,
    sectionId: 21,
    position,
    status,
    createdAt: '2026-10-23T10:00:00.000Z',
  }) satisfies WaitlistEntryResponse;

// Lượt 30: của std_402, đang chờ. Lượt 31: của sinh viên khác. Lượt 32: của std_402, đã được xếp lớp.
const entries: Record<number, { studentId: number; status: WaitlistStatus }> = {
  30: { studentId: 402, status: 'WAITING' },
  31: { studentId: 403, status: 'WAITING' },
  32: { studentId: 402, status: 'PROMOTED' },
};

const store: WaitlistStore = {
  readJoinFacts: jest.fn(
    async (_studentId: number, sectionId: number) => sections[sectionId] ?? null,
  ),
  join: jest.fn(async () => entry(40, 'WAITING', 3)),
  listForStudent: jest.fn(async () => [entry(30, 'WAITING', 1), entry(32, 'PROMOTED', null)]),
  findEntry: jest.fn(async (entryId: number) => entries[entryId] ?? null),
  leave: jest.fn(async () => undefined),
};

// Giả lập đăng nhập như test của registrations: header X-Test-Student là id sinh viên.
const studentIdOf = (req: express.Request) => {
  const id = Number(req.header('X-Test-Student'));
  if (!id) throw new AppError('UNAUTHENTICATED', 401, 'You need to sign in.');
  return id;
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/waitlist', createWaitlistRouter(store, studentIdOf));
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/v1/waitlist`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => jest.clearAllMocks());

async function call(method: string, path = '', body?: unknown, student: string | null = '402') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (student) headers['X-Test-Student'] = student;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

describe('POST /api/v1/waitlist', () => {
  it('Gherkin "Join the waitlist": lớp đầy thì 201, trạng thái WAITING kèm vị trí', async () => {
    const { status, body } = await call('POST', '', { sectionId: 21 });
    expect(status).toBe(201);
    expect(body).toMatchObject({ status: 'WAITING', position: 3, sectionId: 21 });
    expect(store.join).toHaveBeenCalledWith(402, 21);
  });

  it('Gherkin "Section still has seats": 409 SECTION_NOT_FULL, không ghi gì', async () => {
    const { status, body } = await call('POST', '', { sectionId: 22 });
    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'SECTION_NOT_FULL', details: { remainingSeats: 3 } });
    expect(store.join).not.toHaveBeenCalled();
  });

  it('Gherkin "Join the same waitlist twice": 409 ALREADY_ON_WAITLIST', async () => {
    jest.mocked(store.readJoinFacts).mockResolvedValueOnce({ ...full, alreadyWaiting: true });
    const { status, body } = await call('POST', '', { sectionId: 21 });
    expect(status).toBe(409);
    expect(body.code).toBe('ALREADY_ON_WAITLIST');
    expect(store.join).not.toHaveBeenCalled();
  });

  it('Lớp không tồn tại: 404; sectionId sai kiểu: 400', async () => {
    expect((await call('POST', '', { sectionId: 999 })).status).toBe(404);
    const bad = await call('POST', '', { sectionId: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.details.fields).toHaveProperty('sectionId');
  });

  it('Chưa đăng nhập: 401, không đọc dữ liệu', async () => {
    const { status } = await call('POST', '', { sectionId: 21 }, null);
    expect(status).toBe(401);
    expect(store.readJoinFacts).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/waitlist', () => {
  it('Trả các lượt chờ của chính sinh viên, kèm vị trí và trạng thái', async () => {
    const { status, body } = await call('GET');
    expect(status).toBe(200);
    expect(body.map((e: WaitlistEntryResponse) => [e.id, e.status, e.position])).toEqual([
      [30, 'WAITING', 1],
      [32, 'PROMOTED', null],
    ]);
    expect(store.listForStudent).toHaveBeenCalledWith(402, undefined);
  });

  it('Lọc theo semesterId; semesterId sai thì 400', async () => {
    await call('GET', '?semesterId=2');
    expect(store.listForStudent).toHaveBeenCalledWith(402, 2);
    expect((await call('GET', '?semesterId=abc')).status).toBe(400);
  });
});

describe('DELETE /api/v1/waitlist/:entryId', () => {
  it('Gherkin "Leave the waitlist": 204, lượt chờ được rời', async () => {
    const { status, body } = await call('DELETE', '/30');
    expect(status).toBe(204);
    expect(body).toBeUndefined();
    expect(store.leave).toHaveBeenCalledWith(30);
  });

  it('Lượt chờ của người khác: 403 FORBIDDEN', async () => {
    const { status, body } = await call('DELETE', '/31');
    expect(status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(store.leave).not.toHaveBeenCalled();
  });

  it('Lượt không còn WAITING hoặc không tồn tại: 404', async () => {
    expect((await call('DELETE', '/32')).status).toBe(404);
    expect((await call('DELETE', '/999')).status).toBe(404);
    expect(store.leave).not.toHaveBeenCalled();
  });

  it('entryId không phải số nguyên dương: 400', async () => {
    const { status, body } = await call('DELETE', '/abc');
    expect(status).toBe(400);
    expect(body.details.fields).toHaveProperty('entryId');
  });
});
