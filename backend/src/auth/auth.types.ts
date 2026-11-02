// Dữ liệu frontend gửi lên khi đăng nhập.
export interface LoginRequest {
  email: string;
  password: string;
}

// Vai trò của người dùng trong hệ thống.
export type UserRole = 'STUDENT' | 'ADMIN';

// Thông tin người dùng được phép trả về cho frontend.
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  studentCode?: string | null;
}