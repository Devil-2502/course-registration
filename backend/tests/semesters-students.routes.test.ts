import express from 'express';
import request from 'supertest';
import { AppError } from '../src/common/app-error';
import { errorHandler } from '../src/common/error-handler';
import { createSemestersRouter, type SemesterReader } from '../src/semesters/semesters';
import { createStudentsMeRouter, type StudentRecordReader } from '../src/students/students';

const semester = {
  id: 2,
  code: '2026-1',
  name: 'Học kỳ 1',
  registrationStart: '2026-11-01T00:00:00.000Z',
  registrationEnd: '2027-01-01T00:00:00.000Z',
  maxCredits: 24,
  registrationOpen: true,
};

const schedule = {
  semesterId: 2,
  totalCredits: 3,
  maxCredits: 24,
  entries: [
    {
      sectionId: 11,
      sectionCode: 'MA101-01',
      courseCode: 'MA101',
      courseName: 'Calculus 1',
      credits: 3,
      dayOfWeek: 1,
      startPeriod: 4,
      endPeriod: 6,
      room: 'A101',
    },
  ],
};

const completed = [
  {
    course: { id: 1, code: 'CS101', name: 'Intro', credits: 4, description: null },
    semesterCode: '2025-2',
    grade: 8,
    passed: true,
  },
];

function appWith(semesters: SemesterReader, students: StudentRecordReader) {
  const app = express();
  app.use('/api/v1/semesters', createSemestersRouter(semesters));
  // Giả lập đăng nhập: header X-Test-Student là id sinh viên.
  app.use(
    '/api/v1/students/me',
    createStudentsMeRouter(students, (req) => {
      const id = Number(req.header('X-Test-Student'));
      if (!id) throw new AppError('UNAUTHENTICATED', 401, 'You need to sign in.');
      return id;
    }),
  );
  app.use(errorHandler);
  return app;
}

const semesters: SemesterReader = {
  list: jest.fn(async () => [semester]),
  current: jest.fn(async () => semester),
};
const students: StudentRecordReader = {
  schedule: jest.fn(async (_studentId: number, semesterId?: number) =>
    semesterId === 99 ? null : schedule,
  ),
  completedCourses: jest.fn(async () => completed),
};
const app = appWith(semesters, students);

beforeEach(() => jest.clearAllMocks());

describe('GET /api/v1/semesters', () => {
  it('Trả danh sách học kỳ', async () => {
    const response = await request(app).get('/api/v1/semesters');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([semester]);
  });

  it('/current: trả học kỳ hiện tại; chưa có học kỳ nào thì 404', async () => {
    expect((await request(app).get('/api/v1/semesters/current')).body).toEqual(semester);
    const empty = appWith({ ...semesters, current: async () => null }, students);
    const response = await request(empty).get('/api/v1/semesters/current');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/students/me/schedule', () => {
  it('Mặc định học kỳ hiện tại; trả thời khóa biểu và tổng tín chỉ', async () => {
    const response = await request(app)
      .get('/api/v1/students/me/schedule')
      .set('X-Test-Student', '402');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(schedule);
    expect(students.schedule).toHaveBeenCalledWith(402, undefined);
  });

  it('Lọc theo semesterId; học kỳ không tồn tại 404; semesterId sai 400', async () => {
    await request(app)
      .get('/api/v1/students/me/schedule?semesterId=2')
      .set('X-Test-Student', '402');
    expect(students.schedule).toHaveBeenCalledWith(402, 2);
    const missing = await request(app)
      .get('/api/v1/students/me/schedule?semesterId=99')
      .set('X-Test-Student', '402');
    expect(missing.status).toBe(404);
    const invalid = await request(app)
      .get('/api/v1/students/me/schedule?semesterId=abc')
      .set('X-Test-Student', '402');
    expect(invalid.status).toBe(400);
  });

  it('Chưa đăng nhập: 401', async () => {
    expect((await request(app).get('/api/v1/students/me/schedule')).status).toBe(401);
    expect(students.schedule).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/students/me/completed-courses', () => {
  it('Trả kết quả học của sinh viên đang đăng nhập', async () => {
    const response = await request(app)
      .get('/api/v1/students/me/completed-courses')
      .set('X-Test-Student', '402');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(completed);
    expect(students.completedCourses).toHaveBeenCalledWith(402);
  });
});
