// Mails to the teams: a template written on its editor, a mail to a team made from it, its
// variables filled in for the team on the preview, sent (queued for the mail server) and listed
// with the competition's sent mails; the template removed.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a mail is written from a template, previewed for the team, and sent', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const address = `mailed${Date.now()}@example.com`;
  const res = await request.post('/api/teams', { data: { competition, league: 'Maze', name: 'Mailed Team', teamCode: 'M1', email: [address] } });
  expect(res.ok()).toBeTruthy();
  const subject = `E2E Notice ${Date.now()}`;

  try {
    // The template: its subject is its name
    await open(page, '/admin/mailTemplates/editor');
    await page.locator('input[ng-model="subject"]').fill(subject);
    await page.locator('.ql-editor').click();
    await page.keyboard.type('Hello ${teamName}, see you at ${competitionName}.');
    await page.locator('button[ng-click="preview()"]').click();
    await page.locator('button[ng-click="save()"]').click();
    await page.locator('.swal2-confirm').click();
    await page.waitForURL(/\/admin\/mailTemplates$/);
    await expect(page.getByText(subject).first()).toBeVisible();

    // A mail to the team, from the template
    await open(page, `/admin/${competition}/mails`);
    await page.locator('tr[ng-repeat]', { hasText: 'Mailed Team' }).locator('[ng-click="newMail(team)"]').click();
    await page.locator('select[ng-model="selectedTemplate"]').selectOption({ label: subject });
    // The template's subject and content filled in, then the subject made the team's
    await expect(page.locator('input[ng-model="mailTitle"]')).toHaveValue(subject);
    await expect(page.locator('.ql-editor')).toContainText('Hello ${teamName}');
    await page.locator('input[ng-model="mailTitle"]').fill('Welcome ${teamName}');
    await page.locator('button[ng-click="preview()"]').click();
    // Filled in for the team
    await expect(page.locator('input[ng-model="toTeam[previewNo].mailData.title"]')).toHaveValue('Welcome Mailed Team');
    await expect(page.getByText('Hello Mailed Team, see you at').first()).toBeVisible();
    const sent = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/api/mail/'));
    await page.locator('button[ng-click="mailSend()"]').first().click();
    expect((await sent).ok()).toBeTruthy();

    // Queued for the mail server, and among the competition's sent mails
    await expect.poll(async () => (await api.mailsTo(address)).map((m) => m.subject)).toContain('Welcome Mailed Team');
    await open(page, `/admin/${competition}/mails/sent`);
    await expect(page.getByText('Welcome Mailed Team').first()).toBeVisible();

    // The template removed from the list
    await open(page, '/admin/mailTemplates');
    await page.locator('tr[ng-repeat]', { hasText: subject }).locator('[ng-click="removeTemplate(mail)"]').click();
    // once DELETE is typed in
    await page.locator('.swal2-input').fill('DELETE');
    await page.locator('.swal2-confirm').click();
    await expect(page.locator('tr[ng-repeat]', { hasText: subject })).toHaveCount(0);
  } finally {
    // Templates are files of the app: none is left behind, whatever happened
    await request.delete(`/api/mail/templates/${encodeURIComponent(subject)}.html`);
  }
});

// Mails to the competition's staff: the users with a level or a role in it, listed with the teams'
// switch; one with an address mailed, its variables filled in for the user; one without an address
// not to be chosen, nor mailed through the API; one of no level or role not listed.
test('a mail is sent to the staff of the competition', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const stamp = Date.now();
  const judge = `judge${stamp}`;
  const address = `${judge}@example.com`;
  const users = [
    { username: judge, email: address, competitions: [{ id: competition, accessLevel: 5 }] },
    { username: `noaddress${stamp}`, competitions: [{ id: competition, accessLevel: 0, role: ['INTERVIEW'] }] },
    { username: `outsider${stamp}`, email: `outsider${stamp}@example.com`, competitions: [{ id: competition, accessLevel: 0 }] },
  ];
  for (const user of users) {
    expect((await request.post('/api/users', { data: { password: 'staffpass', ...user } })).ok()).toBeTruthy();
  }

  await open(page, `/admin/${competition}/mails`);
  await page.locator('button[ng-click="switchTarget(\'staff\')"]').click();
  const row = (name) => page.locator('tr[ng-repeat^="user in staff"]', { hasText: name });
  await expect(row(judge)).toBeVisible();
  await expect(row(`noaddress${stamp}`).locator('.custom-checkbox')).toHaveCount(0);
  await expect(row(`outsider${stamp}`)).toHaveCount(0);

  await row(judge).locator('[ng-click="newMail(user)"]').click();
  await page.locator('input[ng-model="mailTitle"]').fill('Shift for ${userName}');
  await page.locator('.ql-editor').click();
  await page.keyboard.type('Thanks for judging at ${competitionName}.');
  await page.locator('button[ng-click="preview()"]').click();
  await expect(page.locator('input[ng-model="toTeam[previewNo].mailData.title"]')).toHaveValue(`Shift for ${judge}`);
  const sent = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/api/mail/staff/'));
  await page.locator('button[ng-click="mailSend()"]').first().click();
  expect((await sent).ok()).toBeTruthy();

  await expect.poll(async () => (await api.mailsTo(address)).map((m) => m.subject)).toContain(`Shift for ${judge}`);
  await open(page, `/admin/${competition}/mails/sent`);
  await expect(page.locator('tr[ng-repeat]', { hasText: `Shift for ${judge}` })).toContainText(judge);

  // Only the staff with an address, by the API too
  const staff = (await (await request.get(`/api/mail/staff/${competition}`)).json());
  const ids = Object.fromEntries(staff.map((u) => [u.username, u._id]));
  const mailData = { title: 'x', content: 'x' };
  expect((await request.post(`/api/mail/staff/${competition}`, { data: { data: [{ _id: ids[`noaddress${stamp}`], mailData }] } })).status()).toBe(400);
});
