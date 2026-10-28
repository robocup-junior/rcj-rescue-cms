// End-to-end tests in a real browser against the whole app (e2e/server.js). Run with `npm run e2e`.
const { defineConfig, devices } = require('@playwright/test');

const PORT = parseInt(process.env.E2E_PORT, 10) || 3100;

module.exports = defineConfig({
  testDir: 'e2e',
  // All tests share one server and database
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalTeardown: './e2e/teardown.js',
  webServer: {
    command: 'node e2e/server.js',
    url: `http://localhost:${PORT}/home`,
    env: { E2E_PORT: String(PORT) },
    timeout: 120 * 1000,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
