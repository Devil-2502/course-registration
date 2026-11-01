import { ensureSchema, resetDatabase, closeDb } from './api/helpers/db';

// Chạy một lần trước toàn bộ test: tạo bảng nếu chưa có, rồi nạp lại dữ liệu mẫu.
export default async function globalSetup() {
  await ensureSchema();
  await resetDatabase();
  await closeDb();
}
