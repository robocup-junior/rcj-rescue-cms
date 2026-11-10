// Signage: a pattern of contents made on its editor, listed with the patterns, and shown by a
// display of its group in turn.
const { test, expect, open } = require('./fixtures');

test.use({ user: 'admin' });

test('a signage pattern is made, listed, and shown on a display', async ({ page }) => {
  const name = `Hall ${Date.now()}`;
  await open(page, '/signage/setting/editor');
  await page.locator('input[ng-model="name"]').fill(name);
  // One web page for every group, for a few seconds
  await page.locator('button[ng-click="addContents(0)"]').click();
  await page.locator('select[ng-model="content.type"]').selectOption({ label: 'WEB content' });
  await page.locator('input[ng-model="content.duration"]').fill('5');
  await page.locator('input[ng-model="content.url"]').fill('/home');
  await page.locator('button.btn-hero-action[ng-click="save()"]').click();
  await page.waitForURL(/\/signage\/setting\/editor\/[0-9a-f]{24}$/);
  const sigId = page.url().split('/').pop();
  const saved = await (await page.request.get(`/api/signage/${sigId}`)).json();
  expect(saved).toMatchObject({ name });
  expect(saved.content.map((c) => c.url)).toEqual(['/home']);

  await open(page, '/signage/setting');
  await expect(page.getByText(name).first()).toBeVisible();

  // A display of group 1 shows it
  await page.goto(`/signage/display/${sigId}/1`);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src'))), { timeout: 15000 })
    .toContain('/home');
});
