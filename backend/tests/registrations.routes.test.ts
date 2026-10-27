import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { AppError } from '../src/common/app-error';
import { errorHandler } from '../src/common/error-handler';
import type { RegistrationFacts } from '../src/registration/registration-rules';
import {
  createRegistrationsRouter,
  toValidationResult,
  type RegistrationFactsReader,
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

const reader: RegistrationFactsReader = {
  readFacts: jest.fn(async (_studentId: number, sectionId: number) => sections[sectionId] ?? null),
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
