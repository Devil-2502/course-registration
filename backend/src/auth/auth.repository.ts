import { pool } from '../db/pool';
import type { UserRole } from './auth.types';

// Kiểu dữ liệu lấy từ PostgreSQL.
export interface AuthUserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  student_code: string | null;
}

// Tìm tài khoản theo email.
export async function findUserByEmail(
  email: string,
): Promise<AuthUserRecord | null> {
  const result = await pool.query<AuthUserRecord>(
    `
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.full_name,
      u.role,
      s.student_code
    FROM users AS u
    LEFT JOIN students AS s
      ON s.user_id = u.id
    WHERE u.email = $1
    LIMIT 1
    `,
    [email],
  );

  return result.rows[0] ?? null;
}