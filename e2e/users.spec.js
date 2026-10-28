// Users and their access: a user added on the user management page, made a judge of a competition
// on its settings, judging there but kept out of its admin pages, then without access, then removed.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a user is added, made a judge of a competition, kept to that, and removed', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [round, field, team] = await Promise.all([
    api.round(request, competition, 'R1'), api.field(request, competition, 'F1'), api.team(request, competition, 'Maze', 'Judged Team'),
  ]);
  const map = await api.mazeMap(request, competition, 'Maze', 'Users Map', [{}, { checkpoint: true }]);
  const runId = await api.run(request, 'maze', { competition, round, field, team, map });

  // Added on the user management page
  const username = `referee${Date.now()}`;
  await open(page, '/admin/user');
  await page.locator('input[ng-model="userName"]').fill(username);
  await page.locator('input[ng-model="userPass"]').fill('refereepass');
  await page.locator('input[ng-model="userEmail"]').fill(`${username}@example.com`);
  await page.locator('button[ng-click="addUser()"]').click();
  const listed = page.locator('tr[ng-repeat]', { hasText: username });
  await expect(listed).toBeVisible();

  // Made a judge of the competition on its settings
  const setAccess = async (level) => {
    await open(page, `/admin/${competition}/settings`);
    const row = page.locator('tr[ng-repeat="user in users"]', { hasText: username });
    const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/api/users/'));
    await row.locator(`button[ng-click="updateAuthority(user._id , ${level})"]`).click();
    expect((await saved).ok()).toBeTruthy();
  };
  await setAccess(5);

  // The user logs in on the login page
  const referee = await browser.newContext({ baseURL });
  const refPage = await referee.newPage();
  await open(refPage, '/login');
  const form = refPage.locator('form[ng-submit="login()"]');
  await form.locator('input[ng-model=username]').fill(username);
  await form.locator('input[ng-model=password]').fill('refereepass');
  await form.locator('button[type=submit]').click();
  await refPage.waitForURL(/\/home/);

  // Judges the competition's runs
  await open(refPage, `/maze/judge/${runId}`);
  await expect(refPage.getByText('Judged Team').first()).toBeVisible();
  expect((await refPage.request.put(`/api/runs/maze/${runId}`, { data: { LoPs: 1 } })).status()).toBe(200);
  // but not its admin pages
  expect((await refPage.request.get(`/api/competitions/${competition}/adminTeams`)).status()).toBeGreaterThanOrEqual(400);
  await refPage.goto(`/admin/${competition}`);
  await expect(refPage).not.toHaveURL(new RegExp(`/admin/${competition}$`));

  // Without access, the runs are no longer the user's to judge
  await setAccess(0);
  expect((await refPage.request.put(`/api/runs/maze/${runId}`, { data: { LoPs: 2 } })).status()).toBe(401);
  await referee.close();

  // Removed: the user is gone, and cannot log in
  await open(page, '/admin/user');
  await listed.locator('[ng-click="removeUser(user)"]').click();
  const confirm = page.locator('.swal2-confirm, .modal.show button[ng-click="ok()"]').first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(listed).toHaveCount(0);
  const again = await browser.newContext({ baseURL });
  expect((await again.request.post('/api/auth/login', { data: { username, password: 'refereepass' } })).ok()).toBeFalsy();
  await again.close();
});
