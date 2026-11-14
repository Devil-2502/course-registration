import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: import.meta.dirname,
  env: { ...process.env, RUN_DB_TESTS: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
