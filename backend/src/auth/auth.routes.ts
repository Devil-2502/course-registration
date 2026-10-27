import { Router } from 'express';
import { AppError } from '../common/app-error';
import { login } from './auth.service';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  deleteSession,
} from './auth.session';
import type { LoginRequest } from './auth.types';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = (req.body ?? {}) as Partial<LoginRequest>;

  // Kiểm tra dữ liệu đầu vào.
  if (
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Email and password are required.',
    );
  }

  // Gọi Auth Service để đăng nhập.
  const result = await login({ email, password });

  // Gửi cookie phiên đăng nhập về trình duyệt.
  res.cookie(SESSION_COOKIE_NAME, result.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });

  // Trả về thông tin người dùng, không trả mật khẩu.
  res.status(200).json(result.user);
});
// POST /api/v1/auth/logout
authRouter.post('/logout', async (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  // Xóa session trong PostgreSQL nếu có cookie hợp lệ.
  if (typeof sessionId === 'string' && sessionId) {
    await deleteSession(sessionId);
  }

  // Yêu cầu trình duyệt xóa cookie.
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(204).send();
});