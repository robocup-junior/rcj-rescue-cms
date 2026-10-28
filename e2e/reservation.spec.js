// Bookings: a booking master with a slot for one team, made by the admin; a team books it from its
// own page, another finds it taken, and the booking is seen by the admin, then cancelled. The other
// team's page and the admin's are open all along, and follow without a reload.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a slot is set up, booked by a team, taken for the others, and cancelled', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [first, second] = [await api.team(request, competition, 'Maze', 'Early Team', 'E1'), await api.team(request, competition, 'Maze', 'Late Team', 'E2')];
  const tokens = Object.fromEntries((await (await request.get(`/api/competitions/${competition}/teams/documents`)).json())
    .map((t) => [t._id, t.document.token]));

  // The booking master: open for the maze league, one slot for one team
  await open(page, `/admin/${competition}/reservation/edit`);
  await page.locator('input[ng-model="i18n.name"]:visible').first().fill('Interview');
  await page.locator('input[ng-model="resv.deadline"]').fill('2099-12-31T23:59');
  await page.locator('select[ng-model="resv.enable"]').selectOption({ label: 'Enable' });
  await page.locator('[ng-model="resv.league"] .ui-select-search').click();
  await page.locator('.ui-select-choices-row', { hasText: /^\s*Rescue Maze\s*$/ }).click();
  await page.locator('button[ng-click="addSlot()"]').click();
  await page.locator('input[ng-model="slot.start"]').fill('2099-07-01T10:00');
  await page.locator('input[ng-model="slot.duration"]').fill('15');
  await page.locator('input[ng-model="slot.max"]').fill('1');
  await page.locator('button.btn-hero-action[ng-click="save()"]').click();
  await page.waitForURL(new RegExp(`/admin/${competition}/reservation/edit/[0-9a-f]{24}$`));
  const resvId = page.url().split('/').pop();

  // Open before anyone books
  await open(page, `/admin/${competition}/reservation/admin/${resvId}`);
  const team = await browser.newContext({ baseURL });
  const other = await team.newPage();
  await open(other, `/mypage/${second}/${tokens[second]}/reservation/${resvId}`);
  await expect(other.locator('[ng-click^="book("]:visible')).toHaveCount(1);

  // A team books it from its page
  const myPage = await team.newPage();
  await open(myPage, `/mypage/${first}/${tokens[first]}`);
  // Opened in a tab of its own
  const [teamPage] = await Promise.all([team.waitForEvent('page'), myPage.locator('.comp-card', { hasText: 'Interview' }).click()]);
  await teamPage.waitForURL(new RegExp(`/mypage/${first}/${tokens[first]}/reservation/${resvId}$`));
  await teamPage.waitForLoadState('networkidle');
  await teamPage.locator('[ng-click^="book("]').first().click();
  await expect(teamPage.locator('.swal2-popup')).toBeVisible();
  await teamPage.locator('.swal2-confirm').click();
  await expect(teamPage.locator('[ng-click^="cancel("]').first()).toBeVisible();

  // The other team finds it taken, the admin sees who booked it
  await expect(other.locator('[ng-click^="book("]:visible')).toHaveCount(0);
  await expect(page.getByText('Early Team').first()).toBeVisible();

  // Cancelled by the team, it is free again
  await teamPage.locator('[ng-click^="cancel("]').first().click();
  await teamPage.locator('.swal2-confirm').click();
  await expect(teamPage.locator('.swal2-popup')).toContainText(/./);
  await teamPage.locator('.swal2-confirm').click();
  await expect(other.locator('[ng-click^="book("]:visible')).toHaveCount(1);
  await team.close();
});
