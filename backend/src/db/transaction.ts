import type { Pool, PoolClient } from 'pg';
import { pool } from './pool';

// db mặc định là pool dùng chung; test trên CSDL thật truyền Pool riêng của nó.
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  db: Pick<Pool, 'connect'> = pool,
): Promise<T> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Giữ lại lỗi gốc nếu ROLLBACK cũng thất bại.
    }

    throw error;
  } finally {
    client.release();
  }
}
