// Tài khoản trong backend/db/seeds/001_seed.sql. Mọi tài khoản dùng chung mật khẩu.
export const PASSWORD = 'Password@123';
export const ADMIN_EMAIL = 'admin1@tdtu.edu.vn';

export function studentEmail(studentCode: string): string {
  return `${studentCode}@student.edu.vn`;
}
