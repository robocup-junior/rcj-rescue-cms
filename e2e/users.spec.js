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

test('the admin of a competition, not a super admin, gives rights on its settings and picks its interviewers', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const stamp = Date.now();
  const made = async (username, data) => {
    expect((await request.post('/api/users', { data: { username, password: 'pass1234', ...data } })).ok()).toBeTruthy();
  };
  await made(`chief${stamp}`, { admin: true, competitions: [{ id: competition, accessLevel: 10, role: ['ADMIN'] }] });
  await made(`helper${stamp}`, { email: `helper${stamp}@example.com`, competitions: [{ id: competition, accessLevel: 1, role: ['INTERVIEW'] }] });

  const chief = await browser.newContext({ baseURL });
  expect((await chief.request.post('/api/auth/login', { data: { username: `chief${stamp}`, password: 'pass1234' } })).ok()).toBeTruthy();
  // (the fixture's checks of the page: no errors, no refused requests)
  const settings = await chief.newPage();
  const errors = [];
  settings.on('response', (res) => { if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });
  settings.on('pageerror', (err) => errors.push(err.message));

  // The users listed, without their addresses; the helper made a judge
  await open(settings, `/admin/${competition}/settings`);
  const row = settings.locator('tr[ng-repeat="user in users"]', { hasText: `helper${stamp}` });
  await expect(row).toBeVisible();
  await expect(settings.getByText(`helper${stamp}@example.com`)).toHaveCount(0);
  const saved = settings.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/api/users/'));
  await row.locator('button[ng-click="updateAuthority(user._id , 5)"]').click();
  expect((await saved).ok()).toBeTruthy();

  // The interviewers of the competition, to be given teams on the review form's editor
  const editor = await chief.newPage();
  editor.on('response', (res) => { if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });
  editor.on('pageerror', (err) => errors.push(err.message));
  await open(editor, `/admin/${competition}/documents/Maze/review`);
  await expect.poll(() => editor.evaluate(() => angular.element(document.body).scope().users?.map((u) => u.username)))
    .toEqual([`helper${stamp}`]);
  expect(errors).toEqual([]);
  await chief.close();

  const users = await (await request.get('/api/users')).json();
  expect(users.find((u) => u.username === `helper${stamp}`).competitions[0].accessLevel).toBe(5);
});
