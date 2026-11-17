// Cải tiến 3 (hướng 6): so sánh 3 cách chống tranh chấp khi nhiều sinh viên cùng đăng ký một lớp.
//   none         READ COMMITTED, đọc sĩ số không khóa rồi ghi (cách làm "ngây thơ")
//   for-update   READ COMMITTED + SELECT ... FOR UPDATE (cách hệ thống đang dùng)
//   serializable SERIALIZABLE, không khóa dòng; gặp lỗi xung đột 40001 thì thử lại
//
// Thí nghiệm chạy thẳng trên PostgreSQL, trong schema riêng lock_experiment, không đụng bảng thật
// và không cần backend. Bảng thí nghiệm cố ý KHÔNG có CHECK (enrolled_count <= capacity) để thấy
// đúng tác dụng của từng cách khóa; bảng thật vẫn có CHECK này làm lớp chặn cuối.
//
// Cách chạy (ở thư mục tests, CSDL tên kết thúc bằng _test):
//   $env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/course_registration_test"
//   $env:ALLOW_TEST_DB_RESET="1"
//   node load/lock-compare.mjs --runs 5
// Tùy chọn: --runs N (mặc định 5), --students N (mặc định 100),
//   --pool N số kết nối CSDL đồng thời (mặc định 10, bằng pool mặc định của backend).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const envFile = resolve(import.meta.dirname, '..', '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/course_registration_test';
const SCHEMA = 'lock_experiment';
const MAX_RETRIES = 10;
// Số truy vấn đọc giữa lúc đọc sĩ số và lúc ghi, giống readFacts của hệ thống thật
// (kết quả học, tiên quyết, lịch học, tín chỉ).
const VALIDATION_QUERIES = 4;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

function assertTestDatabase(url) {
  const database = decodeURIComponent(new URL(url).pathname.slice(1));
  if (process.env.ALLOW_TEST_DB_RESET !== '1' || !database.endsWith('_test')) {
    throw new Error('Cần ALLOW_TEST_DB_RESET=1 và DATABASE_URL trỏ tới CSDL tên kết thúc bằng _test.');
  }
}

// ---------- Chuẩn bị dữ liệu ----------

async function createSchema(pool) {
  await pool.query(`
    DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
    CREATE SCHEMA ${SCHEMA};
    CREATE TABLE ${SCHEMA}.sections (
      id BIGINT PRIMARY KEY,
      capacity INT NOT NULL,
      enrolled_count INT NOT NULL DEFAULT 0
    );
    CREATE TABLE ${SCHEMA}.enrolments (
      id BIGSERIAL PRIMARY KEY,
      student_id BIGINT NOT NULL,
      section_id BIGINT NOT NULL REFERENCES ${SCHEMA}.sections (id),
      UNIQUE (student_id, section_id)
    );
    CREATE INDEX ON ${SCHEMA}.enrolments (section_id);
    CREATE INDEX ON ${SCHEMA}.enrolments (student_id);`);
}

// sections: [{ id, capacity, enrolled }]; người đã có sẵn trong lớp mang id từ 1 000 000 trở đi.
async function resetData(pool, sections) {
  await pool.query(`TRUNCATE ${SCHEMA}.enrolments, ${SCHEMA}.sections RESTART IDENTITY`);
  for (const s of sections) {
    await pool.query(`INSERT INTO ${SCHEMA}.sections (id, capacity, enrolled_count) VALUES ($1, $2, $3)`, [
      s.id,
      s.capacity,
      s.enrolled,
    ]);
    await pool.query(
      `INSERT INTO ${SCHEMA}.enrolments (student_id, section_id)
       SELECT 1000000 + $1 * 1000 + g, $1 FROM generate_series(1, $2) g`,
      [s.id, s.enrolled],
    );
  }
}

// ---------- Một lần đăng ký theo từng cách ----------

const isRetryable = (error) => error?.code === '40001' || error?.code === '40P01';

async function attempt(client, strategy, studentId, sectionId) {
  await client.query(strategy === 'serializable' ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN');
  try {
    const lock = strategy === 'for-update' ? ' FOR UPDATE' : '';
    const { rows } = await client.query(
      `SELECT capacity, enrolled_count FROM ${SCHEMA}.sections WHERE id = $1${lock}`,
      [sectionId],
    );
    // Các bước kiểm tra điều kiện khác (chỉ đọc), tạo khoảng thời gian giữa đọc và ghi như hệ thống thật.
    for (let i = 0; i < VALIDATION_QUERIES; i += 1) {
      await client.query(`SELECT count(*) FROM ${SCHEMA}.enrolments WHERE student_id = $1`, [studentId]);
    }
    if (rows[0].enrolled_count >= rows[0].capacity) {
      await client.query('ROLLBACK');
      return 'FULL';
    }
    await client.query(`INSERT INTO ${SCHEMA}.enrolments (student_id, section_id) VALUES ($1, $2)`, [
      studentId,
      sectionId,
    ]);
    await client.query(`UPDATE ${SCHEMA}.sections SET enrolled_count = enrolled_count + 1 WHERE id = $1`, [
      sectionId,
    ]);
    await client.query('COMMIT');
    return 'ENROLLED';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function register(pool, strategy, studentId, sectionId) {
  const started = performance.now();
  const client = await pool.connect();
  let retries = 0;
  try {
    for (;;) {
      try {
        const outcome = await attempt(client, strategy, studentId, sectionId);
        return { outcome, retries, ms: performance.now() - started };
      } catch (error) {
        if (!isRetryable(error)) return { outcome: `ERROR ${error.code ?? error.message}`, retries, ms: performance.now() - started };
        if (retries >= MAX_RETRIES) return { outcome: 'ABORTED', retries, ms: performance.now() - started };
        retries += 1;
        // Chờ ngẫu nhiên một chút để các giao dịch thử lại không đụng nhau tiếp.
        await new Promise((r) => setTimeout(r, Math.random() * 5 * retries));
      }
    }
  } finally {
    client.release();
  }
}

// ---------- Kịch bản ----------

const scenarios = {
  // Lớp 40 chỗ đã có 39 người; N sinh viên cùng giành chỗ cuối.
  'last-seat': (n) => ({
    sections: [{ id: 1, capacity: 40, enrolled: 39 }],
    requests: Array.from({ length: n }, (_, i) => ({ studentId: i + 1, sectionId: 1 })),
  }),
  // Lớp 40 chỗ còn trống; N sinh viên cùng đăng ký.
  'empty-section': (n) => ({
    sections: [{ id: 1, capacity: 40, enrolled: 0 }],
    requests: Array.from({ length: n }, (_, i) => ({ studentId: i + 1, sectionId: 1 })),
  }),
  // N sinh viên chia đều vào 10 lớp còn nhiều chỗ: ít tranh chấp, để đo chi phí của việc khóa.
  'spread': (n) => ({
    sections: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, capacity: 40, enrolled: 0 })),
    requests: Array.from({ length: n }, (_, i) => ({ studentId: i + 1, sectionId: (i % 10) + 1 })),
  }),
};

const STRATEGIES = ['none', 'for-update', 'serializable'];

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

async function runOnce(pool, strategy, scenario, students) {
  const { sections, requests } = scenarios[scenario](students);
  await resetData(pool, sections);
  const started = performance.now();
  const results = await Promise.all(requests.map((r) => register(pool, strategy, r.studentId, r.sectionId)));
  const wallMs = performance.now() - started;

  const { rows } = await pool.query(
    `SELECT s.id, s.capacity, s.enrolled_count,
       (SELECT count(*)::int FROM ${SCHEMA}.enrolments e WHERE e.section_id = s.id) AS actual
     FROM ${SCHEMA}.sections s ORDER BY s.id`,
  );
  const outcomes = {};
  for (const r of results) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const oversold = rows.reduce((sum, s) => sum + Math.max(0, s.actual - s.capacity), 0);
  // Số chỗ lẽ ra phải được lấp: mỗi lớp nhận tối đa số chỗ trống ban đầu, nếu có đủ người xin.
  const expectedNew = sections.reduce(
    (sum, s) => sum + Math.min(s.capacity - s.enrolled, requests.filter((r) => r.sectionId === s.id).length),
    0,
  );
  const newEnrolments = results.filter((r) => r.outcome === 'ENROLLED').length;
  const counterMismatch = rows.reduce((sum, s) => sum + Math.abs(s.actual - s.enrolled_count), 0);
  return {
    strategy,
    scenario,
    outcomes,
    oversold, // số người vượt sức chứa (phải bằng 0)
    counterMismatch, // chênh lệch giữa enrolled_count và số dòng thật (phải bằng 0)
    // Chỗ còn trống mà sinh viên xin không được (bị hủy vì xung đột quá số lần thử lại)
    missedSeats: Math.max(0, expectedNew - newEnrolments),
    failedRequests: results.filter((r) => r.outcome === 'ABORTED' || r.outcome.startsWith('ERROR')).length,
    correct: oversold === 0 && counterMismatch === 0,
    retries: results.reduce((sum, r) => sum + r.retries, 0),
    timeMs: {
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      p95: Math.round(percentile(times, 0.95)),
      max: Math.round(times[times.length - 1]),
    },
    wallMs: Math.round(wallMs),
  };
}

function aggregate(runs) {
  const groups = new Map();
  for (const run of runs) {
    const key = `${run.scenario}|${run.strategy}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  const mean = (values) => Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return [...groups.values()].map((group) => ({
    scenario: group[0].scenario,
    strategy: group[0].strategy,
    runs: group.length,
    correctRuns: group.filter((r) => r.correct).length,
    oversoldMax: Math.max(...group.map((r) => r.oversold)),
    oversoldAvg: Number((group.reduce((a, r) => a + r.oversold, 0) / group.length).toFixed(1)),
    enrolledAvg: Number((group.reduce((a, r) => a + (r.outcomes.ENROLLED ?? 0), 0) / group.length).toFixed(1)),
    retriesAvg: Number((group.reduce((a, r) => a + r.retries, 0) / group.length).toFixed(1)),
    failedTotal: group.reduce((a, r) => a + r.failedRequests, 0),
    missedSeatsAvg: Number((group.reduce((a, r) => a + r.missedSeats, 0) / group.length).toFixed(1)),
    avgMs: mean(group.map((r) => r.timeMs.avg)),
    p95Ms: mean(group.map((r) => r.timeMs.p95)),
    wallMs: mean(group.map((r) => r.wallMs)),
  }));
}

async function main() {
  assertTestDatabase(DATABASE_URL);
  const runs = option('runs', 5);
  const students = option('students', 100);
  const poolSize = option('pool', 10);
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: poolSize });

  try {
    await createSchema(pool);
    const { rows } = await pool.query('SHOW server_version');
    const report = [];
    for (const scenario of Object.keys(scenarios)) {
      for (const strategy of STRATEGIES) {
        for (let run = 1; run <= runs; run += 1) {
          const result = await runOnce(pool, strategy, scenario, students);
          report.push({ run, ...result });
          console.log(
            `${result.correct ? 'ĐÚNG' : 'SAI '}  ${scenario.padEnd(13)} ${strategy.padEnd(12)} lần ${run}`,
            `vượt=${result.oversold} lệch=${result.counterMismatch} bỏ trống=${result.missedSeats} thử lại=${result.retries}`,
            JSON.stringify(result.outcomes),
            `tb=${result.timeMs.avg}ms p95=${result.timeMs.p95}ms`,
          );
        }
      }
    }
    const summary = aggregate(report);
    console.log('\nTổng hợp (trung bình các lần chạy):');
    console.table(summary);

    const dir = resolve(import.meta.dirname, 'results');
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `lock-compare-pool${poolSize}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(
      file,
      JSON.stringify(
        {
          runAt: new Date().toISOString(),
          postgres: rows[0].server_version,
          settings: { runs, students, poolSize, validationQueries: VALIDATION_QUERIES, maxRetries: MAX_RETRIES },
          summary,
          report,
        },
        null,
        2,
      ),
    );
    console.log(`Đã lưu kết quả: ${file}`);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
