import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

// Dùng chung cho các test chạy trên PostgreSQL thật.
// Chỉ chạy khi có TEST_DATABASE_URL; tên CSDL phải kết thúc bằng _test vì test xóa sạch và tạo lại bảng.
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const describeDb = testDatabaseUrl ? describe : describe.skip;

export async function openFreshTestDatabase(): Promise<Pool> {
  const database = new URL(testDatabaseUrl as string).pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL phải trỏ tới CSDL tên kết thúc bằng _test (đang là ${database}).`,
    );
  }
  const pool = new Pool({ connectionString: testDatabaseUrl });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pool.query(readFileSync(join(dir, file), 'utf8'));
  }
  return pool;
}

// Chèn một dòng và trả về id.
export async function insertReturningId(
  pool: Pool,
  sql: string,
  params: unknown[],
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(`${sql} RETURNING id`, params);
  return Number(rows[0].id);
}
