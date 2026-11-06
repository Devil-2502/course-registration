const { existsSync } = require('node:fs');

// Reset chỉ dành cho DB kiểm thử được chỉ định rõ, không dùng DB phát triển mặc định.
function assertTestDatabase(databaseUrl, seedFile) {
  const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (process.env.ALLOW_TEST_DB_RESET !== '1' || !database.endsWith('_test')) {
    throw new Error('Reset requires ALLOW_TEST_DB_RESET=1 and a DATABASE_URL ending in _test.');
  }
  if (!existsSync(seedFile)) {
    throw new Error(`Missing M3 seed: ${seedFile}. No data has been deleted.`);
  }
}
exports.assertTestDatabase = assertTestDatabase;
