import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorHandler } from '../src/common/error-handler';
import { createCoursesRouter, type CourseReader } from '../src/courses/courses.routes';
import type { Course, CourseDetail } from '../src/courses/courses.types';

// Danh mục giả theo Gherkin US-02: CS201 và 44 môn khác, tổng 45 môn.
const cs201: Course = {
  id: 2,
  code: 'CS201',
  name: 'Data Structures and Algorithms',
  credits: 4,
  description: null,
};
const catalog: Course[] = [
  cs201,
  ...Array.from({ length: 44 }, (_, i) => ({
    id: 100 + i,
    code: `GE${100 + i}`,
    name: `General Course ${i + 1}`,
    credits: 3,
    description: null,
  })),
];

// Gherkin US-03: CS201 cần CS101, có 2 lớp trong học kỳ hiện tại.
const cs201Detail: CourseDetail = {
  ...cs201,
  prerequisites: [
    { id: 1, code: 'CS101', name: 'Introduction to Programming', credits: 4, description: null },
  ],
  sections: [1, 2].map((n) => ({
    id: 20 + n,
    courseId: 2,
    semesterId: 2,
    code: `CS201-0${n}`,
    lecturerName: null,
    capacity: 40,
    enrolledCount: 37,
    remainingSeats: 3,
    waitlistCount: 0,
    slots: [{ dayOfWeek: n, startPeriod: 4, endPeriod: 6, room: 'A101' }],
  })),
};

// Bản giả của CourseReader: tìm theo mã hoặc tên, không phân biệt hoa thường, như câu SQL sẽ làm.
const reader: CourseReader = {
  search: jest.fn(async ({ q, page, pageSize }) => {
    const keyword = q.toLowerCase();
    const matched = catalog.filter(
      (c) => c.code.toLowerCase().includes(keyword) || c.name.toLowerCase().includes(keyword),
    );
    const start = (page - 1) * pageSize;
    return { items: matched.slice(start, start + pageSize), total: matched.length };
  }),
  findDetail: jest.fn(async (courseId) => (courseId === 2 ? cs201Detail : null)),
};

let server: Server;
let baseUrl: string;

// Chạy router thật trên một cổng ngẫu nhiên, gửi request bằng fetch có sẵn của Node.
beforeAll(async () => {
  const app = express();
  app.use('/api/v1/courses', createCoursesRouter(reader));
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/v1/courses`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => jest.clearAllMocks());

async function get(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: await response.json() };
}

describe('GET /api/v1/courses (US-02)', () => {
  it('Gherkin "Search by keyword": q=data tìm thấy CS201 kèm tên và tín chỉ', async () => {
    const { status, body } = await get('?q=data');
    expect(status).toBe(200);
    expect(body.items).toEqual([cs201]);
    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
  });

  it('Gherkin "Search with no matching course": danh sách rỗng, vẫn 200', async () => {
    const { status, body } = await get('?q=zzzz');
    expect(status).toBe(200);
    expect(body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('Gherkin "Paginated catalog": trang 2 có 20 môn, total 45', async () => {
    const { body } = await get('?page=2&pageSize=20');
    expect(body.items).toHaveLength(20);
    expect(body.total).toBe(45);
    expect(reader.search).toHaveBeenCalledWith({ q: '', page: 2, pageSize: 20 });
  });

  it('Tham số sai: 400 VALIDATION_ERROR, không gọi tới CSDL', async () => {
    const { status, body } = await get('?page=0&pageSize=500');
    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.fields).toHaveProperty('page');
    expect(body.details.fields).toHaveProperty('pageSize');
    expect(reader.search).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/courses/:courseId (US-03)', () => {
  it('Gherkin "View course details": có tiên quyết CS101 và 2 lớp kèm lịch, sĩ số, chỗ còn', async () => {
    const { status, body } = await get('/2');
    expect(status).toBe(200);
    expect(body.prerequisites.map((p: Course) => p.code)).toEqual(['CS101']);
    expect(body.sections).toHaveLength(2);
    expect(body.sections[0]).toMatchObject({ capacity: 40, remainingSeats: 3 });
    expect(body.sections[0].slots[0]).toEqual({
      dayOfWeek: 1,
      startPeriod: 4,
      endPeriod: 6,
      room: 'A101',
    });
    expect(reader.findDetail).toHaveBeenCalledWith(2, { semesterId: undefined });
  });

  it('Truyền semesterId thì chuyển xuống nguồn dữ liệu', async () => {
    await get('/2?semesterId=1');
    expect(reader.findDetail).toHaveBeenCalledWith(2, { semesterId: 1 });
  });

  it('Gherkin "Course does not exist": 404 NOT_FOUND', async () => {
    const { status, body } = await get('/999999');
    expect(status).toBe(404);
    expect(body).toEqual({ code: 'NOT_FOUND', message: 'Course not found.' });
  });

  it('courseId hoặc semesterId không phải số nguyên dương: 400 VALIDATION_ERROR', async () => {
    const bad = await get('/abc');
    expect(bad.status).toBe(400);
    expect(bad.body.details.fields).toHaveProperty('courseId');
    const badSemester = await get('/2?semesterId=0');
    expect(badSemester.status).toBe(400);
    expect(badSemester.body.details.fields).toHaveProperty('semesterId');
  });
});
