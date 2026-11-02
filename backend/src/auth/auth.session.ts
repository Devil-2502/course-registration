import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../db/pool';

export const SESSION_COOKIE_NAME = 'sid';

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Chỉ lưu mã băm của session ID trong database.
function hashSessionId(sessionId: string): string {
  return createHash('sha256')
    .update(sessionId)
    .digest('hex');
}

// Tạo session mới khi đăng nhập thành công.
export async function createSession(
  userId: string,
): Promise<string> {
  const sessionId = randomBytes(32).toString('hex');
  const storedId = hashSessionId(sessionId);

  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_MS,
  );

  await pool.query(
    `
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES ($1, $2, $3)
    `,
    [storedId, userId, expiresAt],
  );

  return sessionId;
}

// Kiểm tra session có tồn tại và còn hạn hay không.
export async function findSessionUserId(
  sessionId: string,
): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(sessionId)) {
    return null;
  }

  const result = await pool.query<{ user_id: string }>(
    `
    SELECT user_id
    FROM sessions
    WHERE id = $1
      AND expires_at > NOW()
    `,
    [hashSessionId(sessionId)],
  );

  return result.rows[0]?.user_id ?? null;
}

// Xóa session khi người dùng đăng xuất.
export async function deleteSession(
  sessionId: string,
): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(sessionId)) {
    return;
  }

  await pool.query(
    'DELETE FROM sessions WHERE id = $1',
    [hashSessionId(sessionId)],
  );
}