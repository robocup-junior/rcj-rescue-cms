// End-to-end tests in a real browser against the whole app (e2e/server.js). Run with `npm run e2e`.
const { defineConfig, devices } = require('@playwright/test');
const { IPAD_MINI_2 } = require('./e2e/safari12');

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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The whole runs again on the iPad mini 2 that judges still use, on a stand-in for its Safari 12
    // (e2e/safari12.js). Its page served again, Chromium takes it for one from elsewhere and keeps
    // it from reaching localhost (the socket.io connection) without the flag
    {
      name: 'ios12',
      testMatch: 'scenarios.spec.js',
      use: {
        ...IPAD_MINI_2,
        safari12: true,
        launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] },
      },
    },
  ],
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
