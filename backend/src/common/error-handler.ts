import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './app-error';

// Đường dẫn không tồn tại.
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 404, 'Route not found.'));
};

// Mọi lỗi đều trả về cùng một cấu trúc { code, message, details }.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res
      .status(error.status)
      .json({ code: error.code, message: error.message, details: error.details });
    return;
  }
  // Body không phải JSON hợp lệ (express.json báo lỗi).
  if (error?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' });
    return;
  }
  console.error(error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
};