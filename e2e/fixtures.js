// Playwright fixtures: every page records script errors, console errors and failed requests,
// and the test fails if any were recorded. Tests that expect some call page.allowErrors().
const base = require('@playwright/test');

const USERS = {
  admin: { username: 'admin', password: 'adminpass' },
  judge: { username: 'judge', password: 'judgepass' },
};

const test = base.test.extend({
  // Log in through the API before the test when set, e.g. test.use({ user: 'admin' })
  user: [null, { option: true }],

  page: async ({ page, user, baseURL }, use, testInfo) => {
    const errors = [];
    const allowed = [];
    const isAllowed = (text) => allowed.some((re) => re.test(text));

    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('requestfailed', (req) => {
      // Requests cut off by leaving the page are not errors
      const failure = req.failure()?.errorText ?? '';
      if (failure.includes('ERR_ABORTED')) return;
      errors.push(`requestfailed: ${req.method()} ${req.url()} ${failure}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().startsWith(baseURL)) {
        errors.push(`HTTP ${res.status()}: ${res.request().method()} ${res.url()}`);
      }
    });

    /** Ignore errors matching the pattern for the rest of the test. */
    page.allowErrors = (re) => allowed.push(re);

    if (user) {
      const res = await page.request.post('/api/auth/login', { data: USERS[user] });
      base.expect(res.ok(), `login as ${user}`).toBeTruthy();
    }

    await use(page);

    const unexpected = errors.filter((e) => !isAllowed(e));
    if (unexpected.length) await testInfo.attach('browser errors', { body: unexpected.join('\n') });
    base.expect(unexpected, 'errors in the browser').toEqual([]);
  },
});

/**
 * Open a page and wait until Angular has rendered it and its API calls are done.
 * Angular apps keep working after the load event, so wait for the network to go quiet as well.
 */
async function open(page, path) {
  const res = await page.goto(path);
  base.expect(res.status(), `status of ${path}`).toBeLessThan(400);
  await page.waitForLoadState('networkidle');
  return res;
}

module.exports = { test, expect: base.expect, open, USERS };
