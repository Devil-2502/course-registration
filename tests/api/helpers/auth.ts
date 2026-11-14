import { request, type APIRequestContext } from '@playwright/test';
import { API_URL } from '../../env';
import { ADMIN_EMAIL, PASSWORD, studentEmail } from './accounts';

// Đăng nhập và trả về một "trình duyệt API" giữ sẵn cookie phiên.
// Nhớ gọi context.dispose() khi dùng xong.
export async function loginAs(email: string, password = PASSWORD): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL: API_URL });
  const response = await context.post('/api/v1/auth/login', { data: { email, password } });
  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${await response.text()}`);
  }
  return context;
}

export const loginAsAdmin = () => loginAs(ADMIN_EMAIL);
export const loginAsStudent = (studentCode: string) => loginAs(studentEmail(studentCode));
