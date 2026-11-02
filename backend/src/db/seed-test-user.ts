import { pool } from './pool';
import { hashPassword } from '../auth/auth.password';

async function main() {
   const email = 'std_402@student.edu.vn';
  const password = process.env.TEST_STUDENT_PASSWORD;

  if (!password) {
    throw new Error(
      'TEST_STUDENT_PASSWORD environment variable is required.',
    );
  }

  const passwordHash = await hashPassword(password);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO NOTHING
       RETURNING id`,
      [email, passwordHash, 'Test Student 402', 'STUDENT'],
    );

    if (result.rows.length === 0) {
      throw new Error('Test account already exists. No changes made.');
    }

    const userId = result.rows[0].id;

    await client.query(
      `INSERT INTO students (user_id, student_code, program)
       VALUES ($1, $2, $3)`,
      [userId, 'STD402', 'Computer Networks'],
    );

    await client.query('COMMIT');

    console.log('Test student created successfully!');
    console.log('Email:', email);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});