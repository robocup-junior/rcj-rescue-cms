// Technical documents: the system enabled for the competition and a team, the league's form and
// its review written on their editors, the team's answer sent from its own link, reviewed, and the
// review in the league's results.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a document form is written, answered by a team, reviewed, and in the results', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const teamId = await api.team(request, competition, 'Maze', 'Doc Team', 'D1');

  // Enabled for the competition, with a deadline to come
  await open(page, `/admin/${competition}/documents`);
  await page.locator('select[ng-model="docSystemEnabled"]').selectOption({ label: 'Enable' });
  await page.locator('input[ng-model="defaultDeadline"]').fill('2099-12-31T23:59');
  await page.locator('button[ng-click="set()"]').click();
  await expect.poll(async () => (await (await request.get(`/api/competitions/${competition}`)).json()).documents.enable).toBe(true);

  // The form of the league: a block with one question to describe the robot
  await open(page, `/admin/${competition}/documents/Maze/form`);
  await page.locator('button[ng-click="addBlock(0)"]').click();
  await page.locator('input[ng-model="i18n.title"]:visible').first().fill('Robot');
  await page.locator(`button[ng-click="addQuestion($index,0,'input')"]`).click();
  await page.locator('input[ng-model="i18n.question"]:visible').first().fill('Describe your robot');
  const formSaved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().endsWith(`/api/competitions/${competition}`));
  await page.locator('button[ng-click="save()"]').click();
  expect((await formSaved).ok()).toBeTruthy();

  // Its review: a block on the robot block, with one question to the reviewers
  await open(page, `/admin/${competition}/documents/Maze/review`);
  await page.locator('button[ng-click="addBlock(0)"]').click();
  await page.locator('input[ng-model="i18n.title"]:visible').first().fill('Engineering');
  await page.locator('input[ng-model="block.weight"]').fill('1');
  // On the form's robot block, whose answers the reviewers read
  await page.locator('.ui-select-search').first().click();
  await page.locator('.ui-select-choices-row', { hasText: 'Robot' }).first().click();
  await expect(page.locator('.ui-select-match-item', { hasText: 'Robot' })).toBeVisible();
  await page.locator(`button[ng-click="addQuestion($index,0,'input')"]`).click();
  await page.locator('input[ng-model="i18n.question"]:visible').first().fill('How is the design?');
  const reviewSaved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().endsWith(`/api/competitions/${competition}`));
  await page.locator('button[ng-click="save()"]').click();
  expect((await reviewSaved).ok()).toBeTruthy();

  // The team's link, copied from its row
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, `/admin/${competition}/documents/teams`);
  const row = page.locator('tr[ng-repeat]', { hasText: 'Doc Team' });
  await row.locator('[ng-click="copy(team)"]').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(new RegExp(`/document/${teamId}/[^/]+$`));
  const teamContext = await browser.newContext({ baseURL });
  const teamPage = await teamContext.newPage();
  const enabled = row.locator('select[ng-model="team.document.enabled"]');
  const setTeam = async (label) => {
    const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().endsWith('/teams/documents'));
    await enabled.selectOption({ label });
    expect((await saved).ok()).toBeTruthy();
  };

  // Disabled for the team, the link does not open the form; enabled again, it does
  await expect(enabled).toHaveValue(/true/);
  await setTeam('Disable');
  await teamPage.goto(new URL(link).pathname);
  await expect(teamPage.getByText('Describe your robot')).toHaveCount(0);
  await setTeam('Enable');

  // The team, not logged in, answers on its link
  await open(teamPage, new URL(link).pathname);
  await expect(teamPage.getByText('Describe your robot').first()).toBeVisible();
  // The tour shown on the first visit closed; the answer written in its editor
  await teamPage.keyboard.press('Escape');
  await teamPage.locator('.ql-editor').first().click();
  await teamPage.keyboard.type('Six wheels and a camera');
  const answered = teamPage.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/api/document/answer/'));
  await teamPage.locator('button[ng-click^="save"]').first().click();
  expect((await answered).ok()).toBeTruthy();
  await teamContext.close();

  // Reviewed: the answer is there to read, the review written (none of the reviewer's yet: the
  // page asks for them, and is told so)
  page.allowErrors(/\/myComments|status of 404/);
  await open(page, `/document/review/${teamId}`);
  await expect(page.getByText('Six wheels and a camera').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.ql-editor').last().click();
  await page.keyboard.type('Neat wiring');
  const reviewed = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes(`/api/document/review/${teamId}`));
  await page.locator('button[ng-click^="save"]').first().click();
  expect((await reviewed).ok()).toBeTruthy();

  // Kept, and in the league's results
  expect(await (await request.get(`/api/document/reviews/${competition}`)).text()).toContain('Neat wiring');
  expect(await (await request.get(`/api/document/answer/${teamId}/${new URL(link).pathname.split('/').pop()}`)).text()).toContain('Six wheels and a camera');
  await open(page, `/admin/${competition}/documents/Maze/results`);
  await expect(page.getByText('Doc Team').first()).toBeVisible();
});
