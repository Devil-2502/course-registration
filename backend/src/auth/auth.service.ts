import { scryptSync } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { AppError } from '../common/app-error';
import { findUserByEmail } from './auth.repository';
import { verifyPassword } from './auth.password';
import { createSession } from './auth.session';
import type { AuthUser, LoginRequest } from './auth.types';

// Hash giả dùng khi email không tồn tại.
const dummySalt = randomBytes(16).toString('hex');

const dummyHash = `scrypt:${dummySalt}:${scryptSync(
  'dummy-password-not-used',
  dummySalt,
  64,
).toString('hex')}`;


export interface LoginResult {
  user: AuthUser;
  sessionId: string;
}

export async function login(
  credentials: LoginRequest,
): Promise<LoginResult> {
  const email = credentials.email.trim().toLowerCase();

  // Bước 1: Tìm tài khoản.
 const user = await findUserByEmail(email);

// Luôn thực hiện kiểm tra mật khẩu,
// kể cả khi không tìm thấy tài khoản.
const passwordValid = await verifyPassword(
  credentials.password,
  user?.password_hash ?? dummyHash,
);

if (!user || !passwordValid) {
  throw new AppError(
    'INVALID_CREDENTIALS',
    401,
    'Invalid email or password.',
  );
}

  // Bước 3: Kiểm tra ID trước khi tạo session.
const userId = Number(user.id);

if (!Number.isSafeInteger(userId) || userId <= 0) {
  throw new AppError(
    'INTERNAL_ERROR',
    500,
    'User ID is outside the safe integer range.',
  );
}

// Bước 4: Tạo session sau khi dữ liệu hợp lệ.
const sessionId = await createSession(user.id);

  // Bước 5: Trả về thông tin người dùng.
  return {
    sessionId,
    user: {
      id: userId,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      studentCode: user.student_code,
    },
  };
}
