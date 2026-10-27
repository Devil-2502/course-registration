import { Pool } from 'pg';

// Đọc thông tin kết nối từ biến môi trường.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.');
}

// Tạo pool kết nối dùng chung cho backend.
export const pool = new Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});