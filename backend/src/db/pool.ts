import { Pool } from 'pg';

// Tạo pool kết nối PostgreSQL dùng chung cho backend.
// Không yêu cầu DATABASE_URL ngay khi import module.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});