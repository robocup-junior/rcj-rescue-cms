// Teams registering themselves: the league opened for registration with a code on the admin's
// page; a team gives the code and its mail address, follows the link in the mail it gets, and
// registers, which makes it a team of the league and sends it its own page.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a team registers itself with the code, from the link mailed to it', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);

  // Open for the maze league until the deadline, with a code of its own
  await open(page, `/admin/${competition}/registration`);
  const league = page.locator('tr[ng-repeat]', { has: page.locator('td', { hasText: /^\s*Rescue Maze\s*$/ }) });
  await expect(league).toHaveCount(1);
  await league.locator('select[ng-model="league.enable"]').selectOption({ label: 'Enable' });
  await league.locator('input[ng-model="league.deadlineW"]').fill('2099-12-31T23:59');
  await league.locator('input[ng-model="league.passCode"]').fill('OPEN2099');
  const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/registration'));
  await page.locator('button.btn-hero-action[ng-click="set()"]').click();
  expect((await saved).ok()).toBeTruthy();

  // The team, not logged in: a wrong code is refused, the right one sends a mail
  const mail = `team${Date.now()}@example.com`;
  const visitor = await browser.newContext({ baseURL });
  const top = await visitor.newPage();
  await open(top, `/registration/${competition}/Maze`);
  const submit = top.locator('form', { has: top.locator('input[ng-model="passCode"]') }).locator('button[type=submit]');
  await top.locator('input[ng-model="passCode"]').fill('WRONG');
  await top.locator('input[ng-model="mail"]').fill(mail);
  await submit.click();
  await expect(top.locator('input[ng-model="mail"].is-invalid, input[ng-model="passCode"].is-invalid').first()).toBeVisible();
  await top.locator('input[ng-model="passCode"]').fill('OPEN2099');
  const asked = top.waitForResponse((res) => res.url().includes('/api/registration/auth/'));
  await submit.click();
  const askedRes = await asked;
  expect(askedRes.ok(), `${askedRes.status()} ${await askedRes.text()}`).toBeTruthy();

  // The link in the mail
  let link;
  await expect.poll(async () => {
    const [verification] = await api.mailsTo(mail);
    link = verification && (verification.html.match(/href="([^"]+\/registration\/[^"]+)"/) || [])[1];
    return link;
  }).toBeTruthy();
  const form = await visitor.newPage();
  await open(form, new URL(link).pathname);
  await form.locator('input[ng-model="teamName"]').fill('Self Registered');
  await form.locator('input[ng-model="region"]').fill('Japan');
  const consent = form.locator('#check_consent');
  if (await consent.count()) await consent.check();
  const registered = form.waitForResponse((res) => res.url().includes('/api/registration/reg/'));
  await form.locator('form', { has: form.locator('input[ng-model="teamName"]') }).locator('button[type=submit]:visible').first().click();
  expect((await registered).ok()).toBeTruthy();
  await visitor.close();

  // A team of the league now, told of its page by mail
  const teams = await (await request.get(`/api/competitions/${competition}/Maze/teams`)).json();
  expect(teams.map((t) => t.name)).toContain('Self Registered');
  await expect.poll(async () => (await api.mailsTo(mail)).length).toBeGreaterThan(1);
});
