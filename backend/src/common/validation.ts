import { validationError } from './app-error';

// Đọc tham số id trên đường dẫn (ví dụ /courses/:courseId), phải là số nguyên dương.
export function parseId(value: unknown, name: string): number {
  const id = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError({ [name]: 'must be a positive integer' });
  }
  return id;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}