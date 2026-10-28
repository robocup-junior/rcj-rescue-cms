// Finding one's way as the public and as a judge: from the home page to a competition, a league and
// its runs, a run's view page and the ranking; the judges also go to a run's judge page from there.
const { test, expect, open } = require('./fixtures');
const ids = require('./ids');

test('the public goes from the home page to a finished run and the ranking', async ({ page }) => {
  await open(page, '/home');
  await page.locator('.comp-card', { hasText: 'E2E Open' }).click();
  await page.waitForURL(new RegExp(`/home/${ids.competition}$`));
  await page.locator('.league-card-premium', { hasText: /Rescue Maze(?! Entry)/ }).click();
  await page.waitForURL(new RegExp(`/maze/${ids.competition}/Maze$`));
  await page.waitForLoadState('networkidle');

  // Not judges: nothing to judge from here
  await expect(page.locator('.btn-run-judge')).toHaveCount(0);
  // The finished runs are what the public sees first
  // (a run not finished nor signed yet is not the public's to see: its view says so)
  const finished = page.locator('tr[ng-repeat]', { hasText: 'Maze Team' })
    .filter({ has: page.locator(`.btn-run-view[ng-click="go('/maze/view/' + run._id)"]`) });
  await expect(page.locator(`.btn-run-view[ng-click="go('/home/access_denied')"]`).first()).toBeVisible();
  await expect(page.locator('[ng-click^="show_ended = !show_ended"]')).toHaveClass(/active-green/);
  await expect(finished.first()).toBeVisible();
  await finished.first().locator('.btn-run-view').click();
  await page.waitForURL(/\/maze\/view\/[0-9a-f]{24}$/);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rv-summary-item.is-score')).toBeVisible();

  await open(page, `/maze/${ids.competition}/Maze`);
  await page.locator('.ranking-card').click();
  await page.waitForURL(new RegExp(`/maze/${ids.competition}/Maze/ranking$`));
  await expect(page.locator('tr[ng-repeat^="team in ranking"]', { hasText: 'Maze Team' })).toBeVisible();
});

test.describe('as a judge', () => {
  test.use({ user: 'judge' });

  test('the runs waiting are judged from the league page, asked first', async ({ page }) => {
    await open(page, `/maze/${ids.competition}/Maze`);
    const judge = page.locator('tr[ng-repeat]', { hasText: 'Maze Team' }).locator('.btn-run-judge').first();
    await expect(judge).toBeVisible();
    await judge.click();
    const dialog = page.locator('.swal2-popup');
    await expect(dialog).toContainText('Maze Team');
    await dialog.locator('.swal2-confirm').click();
    await page.waitForURL(/\/maze\/judge\/[0-9a-f]{24}/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.rv-check').first()).toBeVisible();
  });
});
