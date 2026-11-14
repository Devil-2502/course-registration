// Truy cập CSDL cho stress test: đặt lại dữ liệu và kiểm tra kết quả.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { assertTestDatabase } from '../db-safety.cjs';

const seedFile = resolve(import.meta.dirname, '..', '..', 'backend', 'db', 'seeds', '001_seed.sql');

export function createPool(databaseUrl) {
  return new pg.Pool({ connectionString: databaseUrl });
}

export async function resetDatabase(pool) {
  assertTestDatabase(pool.options.connectionString, seedFile);
  await pool.query(`
    TRUNCATE sessions, waitlist_entries, enrolments, completed_courses, section_slots,
             sections, prerequisites, courses, semesters, students, users
    RESTART IDENTITY CASCADE`);
  await pool.query(readFileSync(seedFile, 'utf8'));
}

export async function recount(pool) {
  await pool.query(`
    UPDATE sections s SET enrolled_count =
      (SELECT count(*) FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ENROLLED')`);
}

export async function sectionIdOf(pool, code) {
  const { rows } = await pool.query('SELECT id FROM sections WHERE code = $1', [code]);
  return Number(rows[0].id);
}

// Cho đúng `count` sinh viên (std_221 trở đi) vào lớp, bỏ hết người cũ.
export async function fillSection(pool, sectionCode, count) {
  const id = await sectionIdOf(pool, sectionCode);
  await pool.query('DELETE FROM enrolments WHERE section_id = $1', [id]);
  await pool.query(
    `INSERT INTO enrolments (student_id, section_id)
     SELECT st.id, $1 FROM students st
     WHERE st.student_code BETWEEN 'std_221' AND 'std_260'
     ORDER BY st.student_code LIMIT $2`,
    [id, count],
  );
  await recount(pool);
}

// Số liệu thật trong CSDL sau khi chạy: enrolled_count phải bằng số dòng ENROLLED và không vượt capacity.
export async function sectionState(pool, sectionCode) {
  const { rows } = await pool.query(
    `SELECT s.capacity, s.enrolled_count,
            (SELECT count(*) FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ENROLLED') AS actual
     FROM sections s WHERE s.code = $1`,
    [sectionCode],
  );
  const row = rows[0];
  return { capacity: row.capacity, enrolledCount: row.enrolled_count, actualEnrolled: Number(row.actual) };
}
