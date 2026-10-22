import type { ApiErrorBody } from './types';

// Địa chỉ gốc của API. Đổi bằng biến VITE_API_URL trong file frontend/.env (không commit).
const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

// Lỗi từ API. Giữ nguyên code để giao diện chọn thông báo (utils/errorMessages.ts).
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // RequestInit chấp nhận cả Headers, mảng cặp và object; không trải Headers thành object.
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include', // gửi kèm cookie phiên đăng nhập
      headers,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Không kết nối được tới máy chủ.' });
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body ?? { code: 'UNKNOWN', message: response.statusText });
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const jsonBody = (data: unknown): RequestInit['body'] => JSON.stringify(data);
