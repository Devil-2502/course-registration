import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './common/error-handler';
import { authRouter } from './auth/auth.routes';
import { requireAuth, requireRole } from './auth/auth.middleware';
import { createCourseRepository } from './courses/courses.repository';
import { createCoursesRouter } from './courses/courses.routes';
import { pool } from './db/pool';
import { createEnrolmentRepository } from './registration/enrolment.repository';
import { createRegistrationRepository } from './registration/registration.repository';
import { createRegistrationsRouter } from './registration/registrations.routes';
import { createSemesterRepository, createSemestersRouter } from './semesters/semesters';
import { createStudentRepository, createStudentsMeRouter } from './students/students';
import { createWaitlistRepository } from './waitlist/waitlist.repository';
import { createWaitlistRouter } from './waitlist/waitlist.routes';

// Các địa chỉ frontend được phép gọi API kèm cookie (Vite dev và bản Docker).
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://localhost:8080'
)
  .split(',')
  .map((origin) => origin.trim());

export function createApp() {
  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mỗi thành viên gắn router của mình ở đây, ví dụ:
  app.use('/api/v1/auth', authRouter);

  // Danh mục và chi tiết môn (M2): phải đăng nhập.
  app.use('/api/v1/courses', requireAuth, createCoursesRouter(createCourseRepository(pool)));

  // Đăng ký học phần (M2): phải đăng nhập và là sinh viên (bước 1, 2 trong api-endpoints-draft.md).
  // studentId trong req.user là chuỗi (BIGINT của pg) nên đổi sang số.
  app.use(
    '/api/v1/registrations',
    requireAuth,
    requireRole('STUDENT'),
    createRegistrationsRouter(
      { ...createRegistrationRepository(pool), ...createEnrolmentRepository(pool) },
      (req) => Number(req.user?.studentId),
    ),
  );

  // Hàng chờ (M2, US-09): phải đăng nhập và là sinh viên.
  app.use(
    '/api/v1/waitlist',
    requireAuth,
    requireRole('STUDENT'),
    createWaitlistRouter(createWaitlistRepository(pool), (req) => Number(req.user?.studentId)),
  );

  // Học kỳ: sinh viên và quản trị viên đều cần.
  app.use('/api/v1/semesters', requireAuth, createSemestersRouter(createSemesterRepository(pool)));

  // Thời khóa biểu và kết quả học của sinh viên đang đăng nhập.
  app.use(
    '/api/v1/students/me',
    requireAuth,
    requireRole('STUDENT'),
    createStudentsMeRouter(createStudentRepository(pool), (req) => Number(req.user?.studentId)),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
