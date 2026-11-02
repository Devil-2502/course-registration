import type { UserRole } from './auth.types';
import type { RequestHandler } from 'express';
import { AppError } from '../common/app-error';
import { findUserById } from './auth.repository';
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

    if (typeof sessionId !== 'string' || !sessionId) {
      throw new AppError(
        'UNAUTHENTICATED',
        401,
        'Authentication required.',
      );
    }

    // Bước 2: Kiểm tra session còn hiệu lực.
    const userId = await findSessionUserId(sessionId);

    if (!userId) {
      throw new AppError(
        'UNAUTHENTICATED',
        401,
        'Invalid or expired session.',
      );
    }

    // Bước 3: Lấy thông tin người dùng.
    const user = await findUserById(userId);

    if (!user) {
      throw new AppError(
        'UNAUTHENTICATED',
        401,
        'User not found.',
      );
    }

    // Bước 4: Kiểm tra ID có thể chuyển sang number an toàn.
    const numericId = Number(user.id);

    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
      throw new AppError(
        'INTERNAL_ERROR',
        500,
        'User ID is outside the safe integer range.',
      );
    }

    // Bước 5: Gắn thông tin người dùng vào request.
    req.user = {
      id: numericId,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      studentId: user.student_id,
      studentCode: user.student_code,
    };

    
    res.locals.userId = userId;

    next();
  } catch (error) {
    next(error);
  }
};


export function requireRole(
  ...allowedRoles: UserRole[]
): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;

    // Chưa được xác thực.
    if (!user) {
      return next(
        new AppError(
          'UNAUTHENTICATED',
          401,
          'Authentication required.',
        ),
      );
    }

    // Đã đăng nhập nhưng không có quyền.
    if (!allowedRoles.includes(user.role)) {
      return next(
        new AppError(
          'FORBIDDEN',
          403,
          'You do not have permission to access this resource.',
        ),
      );
    }

    // Có quyền truy cập.
    next();
  };
}

