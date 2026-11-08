// The judge's timer through a reload or the page opened again (what the browser cannot be kept
// from on iPads): it runs on from where it was, for the run it was started for only. Another run
// opened on the same device starts with its own time, its timer not running.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

async function checkTeam(page) {
  await page.locator('.rv-check').nth(0).click();
  await page.locator('.rv-check').nth(1).click();
  await page.locator('.rv-photo-check').nth(0).click();
  await page.locator('.rv-photo-check').nth(1).click();
  await page.locator('button[ng-click="infochecked()"]').click();
}

/** Seconds of the time in the bar (m:ss). */
async function shownSeconds(page) {
  const text = await page.locator('.rv-topbar-stats .rv-stat-value').nth(1).textContent();
  const [m, s] = text.trim().split(':').map(Number);
  return m * 60 + s;
}

for (const [kind, league] of [['line', 'Line'], ['line', 'LineNL'], ['maze', 'Maze'], ['maze', 'MazeNL']]) {
  /** Two runs of a competition of its own, not yet under way. */
  async function twoRuns(request) {
    const competition = await api.competition(request);
    const [round, field] = await Promise.all([api.round(request, competition, 'R1'), api.field(request, competition, 'F1')]);
    const map = kind === 'maze'
      ? await api.mazeMap(request, competition, league, 'Timer Map', [{}])
      : await api.lineMap(request, competition, league, 'Timer Map');
    const runs = [];
    for (const name of ['Timer A', 'Timer B']) {
      const team = await api.team(request, competition, league, name);
      runs.push(await api.run(request, kind, { competition, round, field, team, map }));
    }
    return runs;
  }
  const stop = (page) => page.locator('.rv-stat-stop');
  const start = (page) => page.locator('.rv-stat-start');

  test(`${league}: the timer runs on through a reload, and only for its own run`, async ({ page }) => {
    const [a, b] = await twoRuns(page.request);
    await open(page, `/${kind}/judge/${a}`);
    await checkTeam(page);
    await start(page).click();
    await expect(stop(page)).toBeVisible();
    await expect.poll(() => shownSeconds(page)).toBeGreaterThanOrEqual(2);

    // Reloaded: running still, on from where it was, the team not to be checked again
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(stop(page)).toBeVisible();
    expect(await shownSeconds(page)).toBeGreaterThanOrEqual(2);

    // Another run opened on the device: its own time, not running
    await open(page, `/${kind}/judge/${b}`);
    await expect(page.locator('.rv-check').first()).toBeVisible();
    await expect(stop(page)).toHaveCount(0);
    await checkTeam(page);
    await expect(start(page)).toBeVisible();
    expect(await shownSeconds(page)).toBe(0);
    await page.waitForTimeout(1500);
    await expect(stop(page)).toHaveCount(0);
    expect(await shownSeconds(page)).toBe(0);

    // The first opened again: still running
    await open(page, `/${kind}/judge/${a}`);
    await expect(stop(page)).toBeVisible();
    expect(await shownSeconds(page)).toBeGreaterThanOrEqual(3);

    // Stopped, it stays stopped through a reload
    await stop(page).click();
    await page.locator('button.rv-stop-now[ng-click="confirmStop()"]').click();
    await expect(start(page)).toBeVisible();
    const stoppedAt = await shownSeconds(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(stop(page)).toHaveCount(0);
    await checkTeam(page);
    expect(await shownSeconds(page)).toBe(stoppedAt);
  });

  test(`${league}: a run set back by the admin is not timed on from before`, async ({ page }) => {
    const [a] = await twoRuns(page.request);
    await open(page, `/${kind}/judge/${a}`);
    await checkTeam(page);
    await start(page).click();
    await expect.poll(() => shownSeconds(page)).toBeGreaterThanOrEqual(1);
    // Set back on the admin's page (another device), its time to 0
    expect((await page.request.put(`/api/runs/${kind}/${a}`, { data: { status: 0, time: { minutes: 0, seconds: 0 } } })).ok()).toBeTruthy();

    await open(page, `/${kind}/judge/${a}`);
    await expect(page.locator('.rv-check').first()).toBeVisible();
    await expect(stop(page)).toHaveCount(0);
  });
}
