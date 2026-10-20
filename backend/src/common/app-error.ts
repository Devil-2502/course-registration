// Lỗi nghiệp vụ có mã lỗi và mã HTTP, khớp cấu trúc Error trong docs/openapi-spec.yaml.
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(resource: string): AppError {
  return new AppError('NOT_FOUND', 404, `${resource} not found.`);
}

export function validationError(fields: Record<string, string>): AppError {
  return new AppError('VALIDATION_ERROR', 400, 'The request is invalid.', { fields });
}