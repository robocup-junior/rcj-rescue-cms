// Leaving a judge's page by the browser's own back, as by the page's back button: once the run is
// under way, the judge is asked first; before that, the browser goes back as it was told.
const { test, expect, open } = require('./fixtures');
const ids = require('./ids');
const api = require('./api');

test.use({ user: 'admin' });

/** Answer the run's saves here, so the seeded run stays as other tests expect it. */
async function keepRunUnsaved(page, path) {
  await page.route(`**/api/runs/${path}`, (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"score": 0}' });
  });
}

async function checkTeam(page) {
  await page.locator('.rv-check').nth(0).click();
  await page.locator('.rv-check').nth(1).click();
  await page.locator('.rv-photo-check').nth(0).click();
  await page.locator('.rv-photo-check').nth(1).click();
  await page.locator('button[ng-click="infochecked()"]').click();
}

for (const [kind, league] of [['line', 'Line'], ['maze', 'Maze']]) {
  const list = `/${kind}/${ids.competition}/${league}`;
  const judge = `/${kind}/judge/${ids.runs[league]}?return=${encodeURIComponent(list)}`;
  const leave = (page) => page.locator('.rv-overlay', { has: page.locator('#rv-leave-title') });

  test(`${kind}: the browser's back asks first once the timer has been started`, async ({ page }) => {
    await keepRunUnsaved(page, `${kind}/${ids.runs[league]}`);
    await open(page, list);
    await open(page, judge);
    await checkTeam(page);
    await page.locator('.rv-stat-start').click();

    // Back: asked, and staying keeps the page
    await page.goBack();
    await expect(leave(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${kind}/judge/`));
    await leave(page).locator('.rv-stop-keep').click();
    await expect(leave(page)).toBeHidden();
    // Nothing to go forward to
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/${kind}/judge/`));
    await expect(leave(page)).toBeHidden();

    // Asked again, as often as back is pressed; left, the run list
    await page.goBack();
    await expect(leave(page)).toBeVisible();
    await leave(page).locator('.rv-stop-now').click();
    await expect(page).toHaveURL(new RegExp(`/${kind}/${ids.competition}/${league}$`));
  });

  test(`${kind}: before the run is under way, the browser's back just goes back`, async ({ page }) => {
    // A run of its own, not yet under way (the seeded one may have been taken by other tests)
    const competition = await api.competition(page.request);
    const [round, field, team] = await Promise.all([
      api.round(page.request, competition, 'R1'), api.field(page.request, competition, 'F1'),
      api.team(page.request, competition, league, `${league} Waiting`),
    ]);
    const map = kind === 'maze'
      ? await api.mazeMap(page.request, competition, league, 'Waiting Map', [{}])
      : await api.lineMap(page.request, competition, league, 'Waiting Map');
    const run = await api.run(page.request, kind, { competition, round, field, team, map });
    await open(page, '/home');
    await open(page, `/${kind}/judge/${run}`);
    // Touched, but nothing started
    await page.locator('.rv-check').nth(0).click();
    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);
  });
}
