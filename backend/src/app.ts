import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './common/error-handler';
import { authRouter } from './auth/auth.routes';
import { requireAuth } from './auth/auth.middleware';

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

  // Bảo vệ API đăng ký học phần.
  // Registration Router sẽ được gắn sau middleware này.
  app.use('/api/v1/registrations', requireAuth);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}