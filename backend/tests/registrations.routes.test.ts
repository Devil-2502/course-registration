import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { AppError } from '../src/common/app-error';
import { errorHandler } from '../src/common/error-handler';
import type { RegistrationFacts } from '../src/registration/registration-rules';
import {
  createRegistrationsRouter,
  toValidationResult,
  type RegistrationResponse,
  type RegistrationStore,
} from '../src/registration/registrations.routes';

// Một lần đăng ký hợp lệ; mỗi lớp giả chỉ đổi phần cần kiểm tra.
const ok: RegistrationFacts = {
  registrationOpen: true,
  enrolledInSameCourse: false,
  alreadyPassed: false,
  missingPrerequisites: [],
  clashesWith: [],
  credit: { allowed: true, currentCredits: 3, requestedCredits: 4, limit: 24 },
  remainingSeats: 5,
};

// Lớp 21: hợp lệ. Lớp 22: thiếu CS101. Lớp 23: trùng MA101-01 và vượt tín chỉ (Gherkin US-11, US-07).
const sections: Record<number, RegistrationFacts> = {
  21: ok,
  22: { ...ok, missingPrerequisites: [{ id: 1, code: 'CS101' }] },
  23: {
    ...ok,
    clashesWith: [{ sectionId: 11, sectionCode: 'MA101-01' }],
    credit: { allowed: false, currentCredits: 22, requestedCredits: 4, limit: 24 },
  },
};

const registration: RegistrationResponse = {
  id: 70,
  studentId: 402,
  section: {
    id: 21,
    courseId: 2,
    semesterId: 5,
    code: 'CS201-01',
    lecturerName: null,
    capacity: 40,
    enrolledCount: 36,
    remainingSeats: 4,
    waitlistCount: 0,
    slots: [],
  },
  course: { id: 2, code: 'CS201', name: 'Data Structures', credits: 4, description: null },
  status: 'ENROLLED',
  createdAt: '2026-11-08T10:00:00.000Z',
};

// Kho giả: lớp 21 đăng ký được, lớp 24 đầy; lần đăng ký 70 của sinh viên 402.
const reader: RegistrationStore = {
  readFacts: jest.fn(async (_studentId: number, sectionId: number) => sections[sectionId] ?? null),
  list: jest.fn(async () => [registration]),
  register: jest.fn(async (_studentId: number, sectionId: number) => {
    if (sectionId === 24) throw new AppError('SECTION_FULL', 409, 'This section is full.');
    return registration;
  }),
  drop: jest.fn(async (studentId: number, registrationId: number) => {
    if (registrationId !== 70) throw new AppError('NOT_FOUND', 404, 'Registration not found.');
    if (studentId !== 402) {
      throw new AppError('FORBIDDEN', 403, 'You can only drop your own registrations.');
    }
  }),
};

// Giả lập đăng nhập: header X-Test-Student là id sinh viên; không có header thì như chưa đăng nhập.
const studentIdOf = jest.fn((req: express.Request) => {
  const id = Number(req.header('X-Test-Student'));
  if (!id) throw new AppError('UNAUTHENTICATED', 401, 'You need to sign in.');
  return id;
});

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/registrations', createRegistrationsRouter(reader, studentIdOf));
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/v1/registrations`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => jest.clearAllMocks());

async function validate(body: string, student: string | null = '402') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (student) headers['X-Test-Student'] = student;
  const response = await fetch(`${baseUrl}/validate`, { method: 'POST', headers, body });
  return { status: response.status, body: await response.json() };
}

describe('POST /api/v1/registrations/validate', () => {
  it('Đủ mọi điều kiện: valid true, không có vi phạm', async () => {
    const { status, body } = await validate('{"sectionId":21}');
    expect(status).toBe(200);
    expect(body).toEqual({ valid: true, violations: [] });
    expect(reader.readFacts).toHaveBeenCalledWith(402, 21);
  });

  it('Thiếu môn tiên quyết: trả PREREQUISITE_NOT_MET kèm danh sách môn thiếu', async () => {
    const { status, body } = await validate('{"sectionId":22}');
    expect(status).toBe(200);
    expect(body).toEqual({
      valid: false,
      violations: [
        {
          code: 'PREREQUISITE_NOT_MET',
          message: 'Missing prerequisites: CS101.',
          details: { missingCourses: [{ id: 1, code: 'CS101' }] },
        },
      ],
    });
  });

  it('Gherkin US-11: trả mọi vi phạm theo thứ tự, giữ câu "Schedule clash with MA101-01"', async () => {
    const { body } = await validate('{"sectionId":23}');
    expect(body.valid).toBe(false);
    expect(body.violations.map((v: { code: string }) => v.code)).toEqual([
      'SCHEDULE_CLASH',
      'CREDIT_LIMIT_EXCEEDED',
    ]);
    expect(body.violations[0].message).toBe('Schedule clash with MA101-01');
    expect(body.violations[1].details).toEqual({
      currentCredits: 22,
      requestedCredits: 4,
      limit: 24,
    });
  });

  it('Lớp học phần không tồn tại: 404 NOT_FOUND', async () => {
    const { status, body } = await validate('{"sectionId":999}');
    expect(status).toBe(404);
    expect(body).toEqual({ code: 'NOT_FOUND', message: 'Section not found.' });
  });

  it('sectionId sai kiểu: 400 VALIDATION_ERROR, không đọc dữ liệu', async () => {
    const { status, body } = await validate('{"sectionId":"21"}');
    expect(status).toBe(400);
    expect(body.details.fields).toHaveProperty('sectionId');
    expect(reader.readFacts).not.toHaveBeenCalled();
  });

  it('Chưa đăng nhập: 401 trước khi đọc body hay dữ liệu', async () => {
    const { status, body } = await validate('{"sectionId":21}', null);
    expect(status).toBe(401);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(reader.readFacts).not.toHaveBeenCalled();
  });
});

// Gọi một route bất kỳ; student null là chưa đăng nhập.
async function call(method: string, path: string, body?: string, student: string | null = '402') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (student) headers['X-Test-Student'] = student;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

describe('GET /api/v1/registrations', () => {
  it('Trả các lần đăng ký của sinh viên đang đăng nhập', async () => {
    const { status, body } = await call('GET', '');
    expect(status).toBe(200);
    expect(body).toEqual([registration]);
    expect(reader.list).toHaveBeenCalledWith(402, undefined);
  });

  it('Lọc theo semesterId; semesterId sai thì 400', async () => {
    await call('GET', '?semesterId=5');
    expect(reader.list).toHaveBeenCalledWith(402, 5);
    expect((await call('GET', '?semesterId=abc')).status).toBe(400);
  });
});

describe('POST /api/v1/registrations', () => {
  it('Gherkin "Successful registration": 201 kèm lần đăng ký', async () => {
    const { status, body } = await call('POST', '', '{"sectionId":21}');
    expect(status).toBe(201);
    expect(body).toEqual(registration);
    expect(reader.register).toHaveBeenCalledWith(402, 21);
  });

  it('Vi phạm do kho ném ra (lớp đầy): 409 SECTION_FULL', async () => {
    const { status, body } = await call('POST', '', '{"sectionId":24}');
    expect(status).toBe(409);
    expect(body.code).toBe('SECTION_FULL');
  });

  it('sectionId sai kiểu: 400, không gọi kho', async () => {
    expect((await call('POST', '', '{"sectionId":"21"}')).status).toBe(400);
    expect(reader.register).not.toHaveBeenCalled();
  });

  it('Chưa đăng nhập: 401', async () => {
    expect((await call('POST', '', '{"sectionId":21}', null)).status).toBe(401);
    expect(reader.register).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/registrations/:registrationId', () => {
  it('Gherkin "Drop a section": 204', async () => {
    const { status } = await call('DELETE', '/70');
    expect(status).toBe(204);
    expect(reader.drop).toHaveBeenCalledWith(402, 70);
  });

  it('Lần đăng ký của người khác: 403; không tồn tại: 404', async () => {
    expect((await call('DELETE', '/70', undefined, '500')).status).toBe(403);
    expect((await call('DELETE', '/71')).status).toBe(404);
  });

  it('registrationId không phải số: 400, không gọi kho', async () => {
    expect((await call('DELETE', '/abc')).status).toBe(400);
    expect(reader.drop).not.toHaveBeenCalled();
  });
});

describe('toValidationResult', () => {
  it('Bỏ status khỏi từng vi phạm, chỉ giữ code, message và details nếu có', () => {
    expect(
      toValidationResult([{ code: 'SECTION_FULL', status: 409, message: 'This section is full.' }]),
    ).toEqual({
      valid: false,
      violations: [{ code: 'SECTION_FULL', message: 'This section is full.' }],
    });
  });
});
