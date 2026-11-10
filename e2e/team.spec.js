// What the teams do from their own page: answer a questionnaire, and take the files the admin put
// in their league's cabinet or their own.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

/** The teams' own pages are reached with a token of each; the admin's API gives them. */
async function tokens(request, competition) {
  const teams = await (await request.get(`/api/competitions/${competition}/teams/documents`)).json();
  return Object.fromEntries(teams.map((t) => [t._id, t.document.token]));
}

test('a questionnaire is set up, answered by a team, and its answer read by the admin', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const teamId = await api.team(request, competition, 'Maze', 'Survey Team', 'S1');
  const token = (await tokens(request, competition))[teamId];

  await open(page, `/admin/${competition}/survey/edit`);
  await page.locator('input[ng-model="i18n.name"]:visible').first().fill('Feedback');
  await page.locator('input[ng-model="surv.open"]').fill('2000-01-01T00:00');
  await page.locator('input[ng-model="surv.deadline"]').fill('2099-12-31T23:59');
  await page.locator('select[ng-model="surv.enable"]').selectOption({ label: 'Enable' });
  await page.locator('[ng-model="surv.league"] .ui-select-search').click();
  await page.locator('.ui-select-choices-row', { hasText: /^\s*Rescue Maze\s*$/ }).click();
  await page.locator(`button[ng-click="addQuestion(0,'input')"]`).click();
  await page.locator('input[ng-model="i18n.title"]:visible').first().fill('How was the venue?');
  await page.locator('button.btn-hero-action[ng-click="save()"]').click();
  await page.waitForURL(new RegExp(`/admin/${competition}/survey/edit/[0-9a-f]{24}$`));
  const survId = page.url().split('/').pop();

  // The team answers from its page, in a tab of the questionnaire's own
  const team = await browser.newContext({ baseURL });
  const myPage = await team.newPage();
  await open(myPage, `/mypage/${teamId}/${token}`);
  const [form] = await Promise.all([team.waitForEvent('page'), myPage.locator('.comp-card', { hasText: 'Feedback' }).click()]);
  await form.waitForLoadState('networkidle');
  await expect(form.getByText('How was the venue?').first()).toBeVisible();
  await form.locator('.ql-editor').first().click();
  await form.keyboard.type('Bright and roomy');
  const sent = form.waitForResponse((res) => ['POST', 'PUT'].includes(res.request().method()) && res.url().includes('/api/survey/'));
  await form.locator('button[ng-click="submit()"]').click();
  // Asked first
  await form.locator('.swal2-confirm').click();
  expect((await sent).ok()).toBeTruthy();
  await team.close();

  await open(page, `/admin/${competition}/survey/answers/${survId}`);
  await expect(page.getByText('Survey Team').first()).toBeVisible();
  await expect(page.getByText('Bright and roomy').first()).toBeVisible();
});

test("files are put in the league's cabinet and a team's own, and each team takes what is theirs", async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [mine, theirs] = [await api.team(request, competition, 'Maze', 'Cabinet Team', 'F1'), await api.team(request, competition, 'Maze', 'Other Team', 'F2')];
  const token = await tokens(request, competition);
  const file = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });

  // For every team of the league, then for one team only
  await open(page, `/admin/${competition}/cabinet/Maze`);
  await page.locator('input[type=file]').setInputFiles(file('league-rules.txt', 'Rules for all'));
  await expect(page.getByText('league-rules.txt').first()).toBeVisible();
  await open(page, `/admin/${competition}/cabinet/${mine}`);
  await page.locator('input[type=file]').setInputFiles(file('feedback.txt', 'Just for you'));
  await expect(page.getByText('feedback.txt').first()).toBeVisible();

  const visitor = await browser.newContext({ baseURL });
  const cabinet = async (teamId) => {
    const p = await visitor.newPage();
    await open(p, `/mypage/${teamId}/${token[teamId]}/cabinet`);
    return p;
  };
  const minePage = await cabinet(mine);
  await expect(minePage.getByText('league-rules.txt').first()).toBeVisible();
  await expect(minePage.getByText('feedback.txt').first()).toBeVisible();
  // and the file is the one put there
  const row = minePage.locator('[ng-repeat]', { hasText: 'feedback.txt' }).filter({ has: minePage.locator('button[ng-click="download(file)"]') }).last();
  const [download] = await Promise.all([minePage.waitForEvent('download'), row.locator('button[ng-click="download(file)"]').click()]);
  expect(require('fs').readFileSync(await download.path(), 'utf8')).toBe('Just for you');

  const theirsPage = await cabinet(theirs);
  await expect(theirsPage.getByText('league-rules.txt').first()).toBeVisible();
  await expect(theirsPage.getByText('feedback.txt')).toHaveCount(0);
  await visitor.close();
});
