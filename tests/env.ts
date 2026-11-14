import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Nạp biến môi trường từ file .env ở thư mục gốc repo (nếu có).
// Trên CI không có file này, biến được khai báo trong ci.yml.
const envFile = resolve(__dirname, '..', '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/course_registration';
