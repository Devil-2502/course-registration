import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './api',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.API_URL || 'http://localhost:3000',
  },
  webServer: {
    command: 'npm start',
    cwd: '../backend',
    url: 'http://localhost:3000/api/v1/health',
    reuseExistingServer: true,
  },
});
