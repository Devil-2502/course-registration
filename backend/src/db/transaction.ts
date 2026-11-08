import type { PoolClient } from 'pg';
import { pool } from './pool';

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

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
