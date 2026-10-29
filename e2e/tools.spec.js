// The admin's tools around the runs: short URLs, and the printable list of a league's runs.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a short URL is set, and takes anyone to its page', async ({ page, browser, baseURL }) => {
  const short = `e2e${Date.now()}`;
  await open(page, '/admin/short');
  await page.locator('input[ng-model="name"]').fill('Results');
  await page.locator('input[ng-model="short"]').fill(short);
  await page.locator('input[ng-model="transfer"]').fill('/home');
  await page.locator('button[ng-click="set()"]').click();
  await expect(page.getByText(short).first()).toBeVisible();

  const visitor = await browser.newContext({ baseURL });
  const res = await visitor.request.get(`/s/${short}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers().location).toBe('/home');
  // Unknown ones say so
  const unknown = await visitor.newPage();
  const missing = await unknown.goto(`/s/${short}x`);
  expect(missing.status()).toBeLessThan(500);
  await visitor.close();
});

test('the printable list of runs is filtered by round and team, with the columns asked for', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [r1, r2, field] = await Promise.all([
    api.round(request, competition, 'Day 1'), api.round(request, competition, 'Day 2'), api.field(request, competition, 'Arena'),
  ]);
  const [kiwi, lime] = await Promise.all([api.team(request, competition, 'Maze', 'Kiwi', 'K1'), api.team(request, competition, 'Maze', 'Lime', 'L1')]);
  const map = await api.mazeMap(request, competition, 'Maze', 'Print Map', [{}, { checkpoint: true }]);
  for (const [team, round] of [[kiwi, r1], [kiwi, r2], [lime, r1], [lime, r2]]) {
    await api.run(request, 'maze', { competition, round, field, team, map });
  }

  await open(page, `/admin/${competition}/Maze/games/print`);
  const rows = page.locator('tbody tr[ng-repeat]');
  await expect(rows).toHaveCount(4);

  // Only the second day
  await page.locator('button.chip', { hasText: 'Day 2' }).click();
  await expect(rows).toHaveCount(2);
  // Only Lime's
  await page.locator('input[ng-model="teamName"]').fill('Lime');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Lime');

  // The team code shown when asked for, none of the columns when none are
  await expect(page.locator('thead').getByText('Team code')).toHaveCount(0);
  await page.locator('button.chip', { hasText: 'Team code' }).click();
  await expect(rows.first()).toContainText('L1');
  await page.locator('button', { hasText: /^\s*None\s*$/ }).click();
  await expect(rows.first()).not.toContainText('Lime');
});
