// Stress test đăng ký đồng thời (US-08, US-10).
// Cách chạy (ở thư mục tests, backend đang chạy ở API_URL):
//   node load/run.mjs last-seat
//   node load/run.mjs all --runs 5
// Kết quả lưu vào tests/load/results/.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPool, fillSection, recount, resetDatabase, sectionIdOf, sectionState } from './db.mjs';

const envFile = resolve(import.meta.dirname, '..', '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/course_registration';
const PASSWORD = 'Password@123';
const pool = createPool(DATABASE_URL);

// ---------- Gọi API ----------

async function login(studentCode) {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${studentCode}@student.edu.vn`, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`Login failed for ${studentCode}: ${response.status}`);
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith('sid='));
  return cookie.split(';')[0];
}

// Đăng nhập nhiều sinh viên, mỗi đợt 10 người để không làm nghẽn bcrypt.
async function loginMany(studentCodes) {
  const cookies = [];
  for (let i = 0; i < studentCodes.length; i += 10) {
    cookies.push(...(await Promise.all(studentCodes.slice(i, i + 10).map(login))));
  }
  return cookies;
}

async function timed(request) {
  const started = performance.now();
  const response = await request();
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, code: body?.code ?? null, ms: performance.now() - started };
}

const register = (cookie, sectionId) =>
  timed(() =>
    fetch(`${API_URL}/api/v1/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ sectionId }),
    }),
  );

const drop = (cookie, registrationId) =>
  timed(() =>
    fetch(`${API_URL}/api/v1/registrations/${registrationId}`, { method: 'DELETE', headers: { Cookie: cookie } }),
  );

// ---------- Thống kê ----------

function summarize(results) {
  const byOutcome = {};
  for (const r of results) {
    const key = r.code ? `${r.status} ${r.code}` : String(r.status);
    byOutcome[key] = (byOutcome[key] ?? 0) + 1;
  }
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const pick = (p) => Math.round(times[Math.min(times.length - 1, Math.floor(p * times.length))]);
  return {
    byOutcome,
    timeMs: {
      min: Math.round(times[0]),
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      p95: pick(0.95),
      max: Math.round(times[times.length - 1]),
    },
  };
}

const students = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `std_${from + i}`);

// ---------- 4 kịch bản (mục 5 của tests/README.md) ----------

const scenarios = {
  // Lớp 40 chỗ đã có 39; 100 sinh viên cùng giành chỗ cuối.
  async 'last-seat'() {
    await fillSection(pool, 'CS201-01', 39);
    const sectionId = await sectionIdOf(pool, 'CS201-01');
    const cookies = await loginMany(students(101, 200));
    const results = await Promise.all(cookies.map((c) => register(c, sectionId)));
    const summary = summarize(results);
    const state = await sectionState(pool, 'CS201-01');
    const passed =
      summary.byOutcome['201'] === 1 &&
      summary.byOutcome['409 SECTION_FULL'] === 99 &&
      state.enrolledCount === 40 &&
      state.actualEnrolled === 40;
    return { summary, state, expected: '1 x 201, 99 x 409 SECTION_FULL, lớp có đúng 40', passed };
  },

  // Lớp 40 chỗ còn trống; 100 sinh viên đăng ký cùng lúc.
  async 'empty-section'() {
    await fillSection(pool, 'CS201-01', 0);
    const sectionId = await sectionIdOf(pool, 'CS201-01');
    const cookies = await loginMany(students(101, 200));
    const results = await Promise.all(cookies.map((c) => register(c, sectionId)));
    const summary = summarize(results);
    const state = await sectionState(pool, 'CS201-01');
    const passed =
      summary.byOutcome['201'] === 40 &&
      summary.byOutcome['409 SECTION_FULL'] === 60 &&
      state.enrolledCount === 40 &&
      state.actualEnrolled === 40;
    return { summary, state, expected: '40 x 201, 60 x 409 SECTION_FULL, lớp có đúng 40', passed };
  },

  // Một sinh viên gửi cùng một yêu cầu 10 lần cùng lúc.
  async 'double-click'() {
    await fillSection(pool, 'CS201-02', 35);
    const sectionId = await sectionIdOf(pool, 'CS201-02');
    const cookie = await login('std_402');
    const results = await Promise.all(Array.from({ length: 10 }, () => register(cookie, sectionId)));
    const summary = summarize(results);
    const state = await sectionState(pool, 'CS201-02');
    const passed =
      summary.byOutcome['201'] === 1 &&
      summary.byOutcome['409 ALREADY_ENROLLED'] === 9 &&
      state.enrolledCount === 36 &&
      state.actualEnrolled === 36;
    return { summary, state, expected: '1 x 201, 9 x 409 ALREADY_ENROLLED, lớp tăng đúng 1', passed };
  },

  // Lớp đầy, 20 người chờ; 5 sinh viên hủy cùng lúc thì đúng 5 người đầu hàng được vào lớp.
  async 'drop-promotion'() {
    const sectionId = await sectionIdOf(pool, 'EN101-01');
    await pool.query('DELETE FROM waitlist_entries WHERE section_id = $1', [sectionId]);
    await pool.query(
      `INSERT INTO waitlist_entries (student_id, section_id, created_at)
       SELECT st.id, $1, now() - make_interval(mins => 100 - row_number() OVER (ORDER BY st.student_code)::int)
       FROM students st WHERE st.student_code BETWEEN 'std_181' AND 'std_200'`,
      [sectionId],
    );
    await recount(pool);
    const leavers = students(140, 144);
    const { rows } = await pool.query(
      `SELECT st.student_code, e.id FROM enrolments e JOIN students st ON st.id = e.student_id
       WHERE e.section_id = $1 AND e.status = 'ENROLLED' AND st.student_code = ANY($2)`,
      [sectionId, leavers],
    );
    const cookies = await loginMany(rows.map((r) => r.student_code));
    const results = await Promise.all(rows.map((r, i) => drop(cookies[i], Number(r.id))));
    const summary = summarize(results);
    const state = await sectionState(pool, 'EN101-01');
    const promoted = await pool.query(
      `SELECT st.student_code FROM waitlist_entries w JOIN students st ON st.id = w.student_id
       WHERE w.section_id = $1 AND w.status = 'PROMOTED' ORDER BY st.student_code`,
      [sectionId],
    );
    const promotedCodes = promoted.rows.map((r) => r.student_code);
    const passed =
      summary.byOutcome['204'] === 5 &&
      state.enrolledCount === state.capacity &&
      state.actualEnrolled === state.capacity &&
      JSON.stringify(promotedCodes) === JSON.stringify(students(181, 185));
    return {
      summary,
      state,
      promoted: promotedCodes,
      expected: '5 x 204, đúng 5 người đầu hàng (std_181..std_185) PROMOTED, lớp vẫn đầy',
      passed,
    };
  },
};

// ---------- Chạy ----------

async function main() {
  const [name = 'all', ...rest] = process.argv.slice(2);
  const runsIndex = rest.indexOf('--runs');
  const runs = runsIndex >= 0 ? Number(rest[runsIndex + 1]) : 1;
  if (!Number.isSafeInteger(runs) || runs < 1) {
    throw new Error('--runs must be a positive integer');
  }
  const names = name === 'all' ? Object.keys(scenarios) : [name];
  if (!names.every((n) => n in scenarios)) {
    console.error(`Kịch bản không tồn tại. Chọn một trong: ${Object.keys(scenarios).join(', ')}, all`);
    process.exit(2);
  }

  const report = [];
  for (const scenario of names) {
    for (let run = 1; run <= runs; run += 1) {
      await resetDatabase(pool);
      const result = await scenarios[scenario]();
      report.push({ scenario, run, ...result });
      console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${scenario} lần ${run}`, JSON.stringify(result.summary.byOutcome), result.summary.timeMs);
    }
  }

  const dir = resolve(import.meta.dirname, 'results');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ apiUrl: API_URL, runAt: new Date().toISOString(), report }, null, 2));
  console.log(`Đã lưu kết quả: ${file}`);
  await pool.end();
  process.exit(report.every((r) => r.passed) ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
