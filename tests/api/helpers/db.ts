import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { DATABASE_URL } from '../../env';
import { assertTestDatabase } from '../../db-safety.cjs';

// Truy cập thẳng CSDL để chuẩn bị dữ liệu cho từng kịch bản test.
const pool = new Pool({ connectionString: DATABASE_URL });
const DB_DIR = resolve(__dirname, '..', '..', '..', 'backend', 'db');

// Chỉ gọi trong global-setup. Các file test dùng chung pool trong cùng một tiến trình, không đóng giữa chừng.
export async function closeDb(): Promise<void> {
  await pool.end();
}

// Tạo bảng từ các file migration nếu CSDL còn trống (ví dụ trên CI).
export async function ensureSchema(): Promise<void> {
  assertTestDatabase(DATABASE_URL, resolve(DB_DIR, 'seeds', '001_seed.sql'));
  const { rows } = await pool.query("SELECT to_regclass('public.users') AS users");
  if (rows[0].users) return;
  const dir = resolve(DB_DIR, 'migrations');
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    await pool.query(readFileSync(resolve(dir, file), 'utf8'));
  }
}

// Xóa sạch dữ liệu và nạp lại dữ liệu mẫu, đưa CSDL về trạng thái ban đầu.
export async function resetDatabase(): Promise<void> {
  assertTestDatabase(DATABASE_URL, resolve(DB_DIR, 'seeds', '001_seed.sql'));
  await pool.query(`
    TRUNCATE sessions, waitlist_entries, enrolments, completed_courses, section_slots,
             sections, prerequisites, courses, semesters, students, users
    RESTART IDENTITY CASCADE`);
  await pool.query(readFileSync(resolve(DB_DIR, 'seeds', '001_seed.sql'), 'utf8'));
}

async function idOf(table: string, column: string, value: string): Promise<number> {
  const { rows } = await pool.query(`SELECT id FROM ${table} WHERE ${column} = $1`, [value]);
  if (!rows[0]) throw new Error(`${table}.${column} = ${value} not found`);
  return Number(rows[0].id);
}

export const courseId = (code: string) => idOf('courses', 'code', code);
export const sectionId = (code: string) => idOf('sections', 'code', code);
export const studentId = (code: string) => idOf('students', 'student_code', code);

// Cập nhật enrolled_count cho khớp số dòng ENROLLED.
async function recount(): Promise<void> {
  await pool.query(`
    UPDATE sections s SET enrolled_count =
      (SELECT count(*) FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ENROLLED')`);
}

// Hủy mọi đăng ký và hàng chờ của một sinh viên.
export async function clearStudent(studentCode: string): Promise<void> {
  const id = await studentId(studentCode);
  await pool.query('DELETE FROM enrolments WHERE student_id = $1', [id]);
  await pool.query('DELETE FROM waitlist_entries WHERE student_id = $1', [id]);
  await recount();
}

// Ghi thẳng một đăng ký (bỏ qua kiểm tra nghiệp vụ) để dựng tình huống test.
export async function enroll(studentCode: string, ...sectionCodes: string[]): Promise<void> {
  for (const code of sectionCodes) {
    await pool.query(
      'INSERT INTO enrolments (student_id, section_id) VALUES ($1, $2)',
      [await studentId(studentCode), await sectionId(code)],
    );
  }
  await recount();
}

// Đặt số sinh viên đang học một lớp bằng đúng count, lấy từ std_221 trở đi (không đụng std_101..std_200).
export async function fillSection(sectionCode: string, count: number): Promise<void> {
  const id = await sectionId(sectionCode);
  await pool.query('DELETE FROM enrolments WHERE section_id = $1', [id]);
  await pool.query(
    `INSERT INTO enrolments (student_id, section_id)
     SELECT st.id, $1 FROM students st
     WHERE st.student_code BETWEEN 'std_221' AND 'std_260'
     ORDER BY st.student_code LIMIT $2`,
    [id, count],
  );
  await recount();
}

export async function setCapacity(sectionCode: string, capacity: number): Promise<void> {
  await pool.query('UPDATE sections SET capacity = $2 WHERE id = $1', [await sectionId(sectionCode), capacity]);
}

// Đóng hoặc mở lại đợt đăng ký của học kỳ 2026-1.
export async function setRegistrationOpen(open: boolean): Promise<void> {
  const end = open ? "now() + interval '60 days'" : "now() - interval '1 day'";
  await pool.query(`UPDATE semesters SET registration_end = ${end} WHERE code = '2026-1'`);
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export const semesterId = (code: string) => idOf('semesters', 'code', code);

// Ghi kết quả học một môn cho sinh viên (điểm từ 5.0 là đạt).
export async function passCourse(studentCode: string, courseCode: string, grade = 8.0): Promise<void> {
  await pool.query(
    `INSERT INTO completed_courses (student_id, course_id, semester_code, grade, passed)
     VALUES ($1, $2, '2025-2', $3, $3 >= 5.0)
     ON CONFLICT (student_id, course_id, semester_code) DO UPDATE SET grade = $3, passed = $3 >= 5.0`,
    [await studentId(studentCode), await courseId(courseCode), grade],
  );
}
