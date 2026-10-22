import { validationError } from '../common/app-error';

// Tham số Page và PageSize trong docs/openapi-spec.yaml.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface CourseQuery {
  q: string; // chuỗi rỗng nghĩa là không lọc
  page: number;
  pageSize: number;
}

// Đọc một số nguyên trong khoảng [min, max]; không truyền thì lấy giá trị mặc định.
// Trả về null khi sai để hàm gọi gom đủ lỗi của mọi tham số rồi báo một lần.
function readInteger(value: unknown, fallback: number, min: number, max: number): number | null {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

// GET /courses?q=&page=&pageSize=
export function parseCourseQuery(query: Record<string, unknown>): CourseQuery {
  const errors: Record<string, string> = {};

  const q = query.q ?? '';
  if (typeof q !== 'string') errors.q = 'must be a single string';

  const page = readInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  if (page === null) errors.page = 'must be an integer of at least 1';

  const pageSize = readInteger(query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  if (pageSize === null) errors.pageSize = `must be an integer from 1 to ${MAX_PAGE_SIZE}`;

  if (Object.keys(errors).length > 0) throw validationError(errors);
  return { q: (q as string).trim(), page: page as number, pageSize: pageSize as number };
}
