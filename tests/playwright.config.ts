import { defineConfig } from '@playwright/test';
import { API_URL } from './env';

export default defineConfig({
  testDir: './api',
  // Các test dùng chung một CSDL nên chạy lần lượt, không song song.
  workers: 1,
  fullyParallel: false,
  globalSetup: process.env.RUN_DB_TESTS === '1' ? './global-setup.ts' : undefined,
  testMatch: process.env.RUN_DB_TESTS === '1' ? '**/*.spec.ts' : '**/health.spec.ts',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: API_URL,
  },
  webServer: {
    command: 'npm start',
    cwd: '../backend',
    url: `${API_URL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
  },
});
