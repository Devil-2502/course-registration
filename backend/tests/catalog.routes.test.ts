import express from 'express';
import request from 'supertest';
import {
  createCourseAdminRouter,
  createSectionsRouter,
  type CatalogStore,
} from '../src/admin/catalog.routes';
import { AppError } from '../src/common/app-error';
import { errorHandler } from '../src/common/error-handler';

const course = { id: 9, code: 'CS401', name: 'Machine Learning', credits: 3, description: null };
const section = {
  id: 21,
  courseId: 2,
  semesterId: 5,
  code: 'CS201-04',
  lecturerName: null,
  capacity: 40,
  enrolledCount: 0,
  remainingSeats: 40,
  waitlistCount: 0,
  slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' }],
};
const sectionBody = {
  courseId: 2,
  semesterId: 5,
  code: 'CS201-04',
  capacity: 40,
  slots: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 3, room: 'B204' }],
};

// Kho giả: id 999 là không tồn tại.
const store = {
  createCourse: jest.fn(async () => course),
  updateCourse: jest.fn(async (id: number) => (id === 999 ? null : course)),
  listPrerequisites: jest.fn(async (id: number) => (id === 999 ? null : [course])),
  addPrerequisite: jest.fn(async () => [course]),
  removePrerequisite: jest.fn(
    async (_id: number, prerequisiteId: number) => prerequisiteId !== 999,
  ),
  listSections: jest.fn(async () => [section]),
  getSection: jest.fn(async (id: number) => (id === 999 ? null : section)),
  createSection: jest.fn(async () => section),
  updateSection: jest.fn(async (id: number) => (id === 999 ? null : section)),
  listEnrolments: jest.fn(async (id: number) => (id === 999 ? null : [])),
  listWaitlist: jest.fn(async (id: number) => (id === 999 ? null : [])),
} satisfies CatalogStore;

// Giả lập đăng nhập: header X-Test-Role là vai trò; không có header thì như chưa đăng nhập.
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const role = req.header('X-Test-Role');
  if (role === 'ADMIN' || role === 'STUDENT') {
    req.user = { id: 1, email: 'a', fullName: 'A', role, studentId: null, studentCode: null };
  }
  next();
});
app.use('/courses', createCourseAdminRouter(store));
app.use('/sections', createSectionsRouter(store));
app.use(errorHandler);

const as = (role: string) => ({ 'X-Test-Role': role });

beforeEach(() => jest.clearAllMocks());

describe('Quyền', () => {
  it('Chưa đăng nhập không được tạo hoặc cập nhật lớp học phần: 401 UNAUTHENTICATED', async () => {
    const created = await request(app).post('/sections').send(sectionBody);

    expect(created.status).toBe(401);
    expect(created.body.code).toBe('UNAUTHENTICATED');
    expect(store.createSection).not.toHaveBeenCalled();

    const updated = await request(app).put('/sections/21').send(sectionBody);

    expect(updated.status).toBe(401);
    expect(updated.body.code).toBe('UNAUTHENTICATED');
    expect(store.updateSection).not.toHaveBeenCalled();
  });

  it('Chưa đăng nhập không được tạo môn học: 401 UNAUTHENTICATED', async () => {
    const response = await request(app).post('/courses').send({
      code: 'CS999',
      name: 'Test Course',
      credits: 3,
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    expect(store.createCourse).not.toHaveBeenCalled();
  });

  it('Sinh viên không được cập nhật môn học: 403 FORBIDDEN', async () => {
    const response = await request(app).put('/courses/9').set(as('STUDENT')).send({
      code: 'CS401',
      name: 'Updated Course',
      credits: 3,
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(store.updateCourse).not.toHaveBeenCalled();
  });

  it('Sinh viên không được tạo hoặc cập nhật lớp học phần: 403 FORBIDDEN', async () => {
    const created = await request(app).post('/sections').set(as('STUDENT')).send(sectionBody);

    expect(created.status).toBe(403);
    expect(created.body.code).toBe('FORBIDDEN');
    expect(store.createSection).not.toHaveBeenCalled();

    const updated = await request(app).put('/sections/21').set(as('STUDENT')).send(sectionBody);

    expect(updated.status).toBe(403);
    expect(updated.body.code).toBe('FORBIDDEN');
    expect(store.updateSection).not.toHaveBeenCalled();
  });

  it('Sinh viên gọi API ghi của admin: 403 FORBIDDEN, không gọi kho', async () => {
    const response = await request(app)
      .post('/courses')
      .set(as('STUDENT'))
      .send({ code: 'CS999', name: 'X', credits: 3 });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(store.createCourse).not.toHaveBeenCalled();
    for (const path of ['/sections/21/enrolments', '/sections/21/waitlist']) {
      expect((await request(app).get(path).set(as('STUDENT'))).status).toBe(403);
    }
  });

  it('Sinh viên vẫn xem được lớp và môn tiên quyết', async () => {
    expect((await request(app).get('/sections').set(as('STUDENT'))).status).toBe(200);
    expect((await request(app).get('/sections/21').set(as('STUDENT'))).status).toBe(200);
    expect((await request(app).get('/courses/2/prerequisites').set(as('STUDENT'))).status).toBe(
      200,
    );
  });
});

describe('Môn học (US-12)', () => {
  it('Tạo môn: 201; body sai: 400 không gọi kho', async () => {
    const created = await request(app)
      .post('/courses')
      .set(as('ADMIN'))
      .send({ code: 'cs401', name: 'Machine Learning', credits: 3 });
    expect(created.status).toBe(201);
    expect(store.createCourse).toHaveBeenCalledWith({
      code: 'CS401',
      name: 'Machine Learning',
      credits: 3,
      description: null,
    });
    const invalid = await request(app).post('/courses').set(as('ADMIN')).send({ code: 'X' });
    expect(invalid.status).toBe(400);
    expect(store.createCourse).toHaveBeenCalledTimes(1);
  });

  it('Lỗi nghiệp vụ từ kho được trả nguyên mã: 409 COURSE_CODE_EXISTS', async () => {
    store.createCourse.mockRejectedValueOnce(new AppError('COURSE_CODE_EXISTS', 409, 'exists'));
    const response = await request(app)
      .post('/courses')
      .set(as('ADMIN'))
      .send({ code: 'CS201', name: 'D', credits: 4 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('COURSE_CODE_EXISTS');
  });

  it('Sửa môn: 200; môn không tồn tại: 404', async () => {
    const body = { code: 'CS401', name: 'ML', credits: 3 };
    expect((await request(app).put('/courses/9').set(as('ADMIN')).send(body)).status).toBe(200);
    expect((await request(app).put('/courses/999').set(as('ADMIN')).send(body)).status).toBe(404);
  });
});

describe('Môn tiên quyết (US-13)', () => {
  it('Xem: môn không tồn tại 404', async () => {
    expect((await request(app).get('/courses/999/prerequisites').set(as('ADMIN'))).status).toBe(
      404,
    );
  });

  it('Thêm: 201 kèm danh sách mới; vòng lặp do kho báo: 409 PREREQUISITE_CYCLE', async () => {
    const added = await request(app)
      .post('/courses/3/prerequisites')
      .set(as('ADMIN'))
      .send({ prerequisiteId: 2 });
    expect(added.status).toBe(201);
    expect(store.addPrerequisite).toHaveBeenCalledWith(3, 2);
    store.addPrerequisite.mockRejectedValueOnce(
      new AppError('PREREQUISITE_CYCLE', 409, 'cycle', { path: ['CS101', 'CS301', 'CS101'] }),
    );
    const cycle = await request(app)
      .post('/courses/1/prerequisites')
      .set(as('ADMIN'))
      .send({ prerequisiteId: 3 });
    expect(cycle.status).toBe(409);
    expect(cycle.body.details.path).toEqual(['CS101', 'CS301', 'CS101']);
  });

  it('Gỡ: 204; quan hệ không có: 404', async () => {
    expect((await request(app).delete('/courses/3/prerequisites/2').set(as('ADMIN'))).status).toBe(
      204,
    );
    expect(
      (await request(app).delete('/courses/3/prerequisites/999').set(as('ADMIN'))).status,
    ).toBe(404);
  });
});

describe('Lớp học phần (US-12)', () => {
  it('Danh sách lọc theo semesterId và courseId; tham số sai 400', async () => {
    await request(app).get('/sections?semesterId=5&courseId=2').set(as('ADMIN'));
    expect(store.listSections).toHaveBeenCalledWith({ semesterId: 5, courseId: 2 });
    await request(app).get('/sections').set(as('ADMIN'));
    expect(store.listSections).toHaveBeenLastCalledWith({
      semesterId: undefined,
      courseId: undefined,
    });
    expect((await request(app).get('/sections?courseId=x').set(as('ADMIN'))).status).toBe(400);
  });

  it('Tạo lớp: 201; sửa lớp: 200; lớp không tồn tại: 404', async () => {
    const created = await request(app).post('/sections').set(as('ADMIN')).send(sectionBody);
    expect(created.status).toBe(201);
    expect(created.body.remainingSeats).toBe(40);
    expect((await request(app).put('/sections/21').set(as('ADMIN')).send(sectionBody)).status).toBe(
      200,
    );
    expect(
      (await request(app).put('/sections/999').set(as('ADMIN')).send(sectionBody)).status,
    ).toBe(404);
    expect((await request(app).get('/sections/999').set(as('ADMIN'))).status).toBe(404);
  });

  it('Danh sách lớp và hàng chờ: lớp không tồn tại 404', async () => {
    expect((await request(app).get('/sections/21/enrolments').set(as('ADMIN'))).status).toBe(200);
    expect((await request(app).get('/sections/999/enrolments').set(as('ADMIN'))).status).toBe(404);
    expect((await request(app).get('/sections/999/waitlist').set(as('ADMIN'))).status).toBe(404);
  });
});
