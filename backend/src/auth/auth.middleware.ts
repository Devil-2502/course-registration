import type { RequestHandler } from 'express';
import { AppError } from '../common/app-error';

import {
  findSessionUserId,
  SESSION_COOKIE_NAME,
} from './auth.session';

export const requireAuth: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    // Bước 1: Lấy session ID từ cookie.
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    // Bước 2: Kiểm tra cookie có tồn tại không.
    if (typeof sessionId !== 'string' || !sessionId) {
      throw new AppError(
        'UNAUTHENTICATED',
        401,
        'Authentication required.',
      );
    }

    // Bước 3: Kiểm tra session trong PostgreSQL.
    const userId = await findSessionUserId(sessionId);

    if (!userId) {
      throw new AppError(
        'UNAUTHENTICATED',
        401,
        'Invalid or expired session.',
      );
    }

    // Bước 4: Lưu ID người dùng để route phía sau sử dụng.
    res.locals.userId = userId;

    // Bước 5: Cho phép request tiếp tục.
    next();
  } catch (error) {
    next(error);
  }
};