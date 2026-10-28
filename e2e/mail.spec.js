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
