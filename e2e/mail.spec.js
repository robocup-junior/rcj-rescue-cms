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
    // once the sending is confirmed
    await page.locator('.swal2-confirm').click();
    expect((await sent).ok()).toBeTruthy();

    // Queued for the mail server, and among the competition's sent mails
    await expect.poll(async () => (await api.mailsTo(address)).map((m) => m.subject)).toContain('Welcome Mailed Team');
    await open(page, `/admin/${competition}/mails/sent`);
    await expect(page.getByText('Welcome Mailed Team').first()).toBeVisible();
    // Read there by the admin, without the picture that would have it opened by its team
    const [kept] = await (await request.get(`/api/mail/sent/${competition}`)).json();
    const { html } = await (await request.get(`/api/mail/sent/${competition}/${kept.mailId}`)).json();
    expect(html).toContain('Hello Mailed Team');
    expect(html).not.toContain('/api/mail/open/');

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
  // A variable put where the cursor is, by its chip
  await page.keyboard.type('Thanks for judging at ');
  await page.locator('.var-chip', { hasText: 'competitionName' }).click();
  await page.keyboard.type('.');
  await page.locator('button[ng-click="preview()"]').click();
  await expect(page.locator('input[ng-model="toTeam[previewNo].mailData.title"]')).toHaveValue(`Shift for ${judge}`);
  await expect(page.locator('.mail-preview-box')).toContainText(/Thanks for judging at E2E .+\./);
  const sent = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/api/mail/staff/'));
  await page.locator('button[ng-click="mailSend()"]').first().click();
  await page.locator('.swal2-confirm').click();
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

// A mail sent to the admin who writes it, to see how it reads: to the admin's own address, neither
// kept with the competition's sent mails nor tracked; refused to an admin without an address.
test('a test mail is sent to the admin who writes it', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const stamp = Date.now();
  const writer = `writer${stamp}`;
  const address = `${writer}@example.com`;
  expect((await request.post('/api/users', { data: { username: writer, password: 'writerpass', email: address, admin: true, competitions: [{ id: competition, accessLevel: 10 }] } })).ok()).toBeTruthy();
  const mailData = { title: `Draft ${stamp}`, content: '<p>See <a href="https://example.com/">this</a></p>' };

  // The admin of the seed has no address
  expect((await request.post(`/api/mail/test/${competition}`, { data: { mailData } })).status()).toBe(400);

  const context = await browser.newContext({ baseURL });
  try {
    expect((await context.request.post('/api/auth/login', { data: { username: writer, password: 'writerpass' } })).ok()).toBeTruthy();
    const res = await context.request.post(`/api/mail/test/${competition}`, { data: { mailData } });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect((await res.json()).to).toBe(address);
  } finally {
    await context.close();
  }

  await expect.poll(async () => (await api.mailsTo(address)).map((m) => m.subject)).toContain(`[TEST] Draft ${stamp}`);
  const [mail] = (await api.mailsTo(address)).filter((m) => m.subject === `[TEST] Draft ${stamp}`);
  expect(mail.html).toContain('href="https://example.com/"');
  expect(mail.html).not.toContain('/api/mail/open/');
  expect(await (await request.get(`/api/mail/sent/${competition}`)).json()).toEqual([]);
});

// Hundreds of sent mails: shown a hundred at a time, the others on asking, and refined at once (the
// rows of before not left shown).
test('the sent mails are shown a hundred at a time, and refined at once', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const res = await request.post('/api/teams', { data: { competition, league: 'Maze', name: 'Many Mails', teamCode: 'MM', email: [`many${Date.now()}@example.com`] } });
  const team = (await res.json()).id;
  const data = Array.from({ length: 120 }, (_, i) => ({ _id: team, mailData: { title: `Bulk ${i}`, content: '<p>x</p>' } }));
  // Reserved for later: kept in the queue, not sent meanwhile
  expect((await request.post('/api/mail/send', { data: { data, reservation: Date.now() + 3600 * 1000 } })).ok()).toBeTruthy();

  await open(page, `/admin/${competition}/mails/sent`);
  const rows = page.locator('tr[ng-repeat^="mail in"]');
  await expect(rows).toHaveCount(100);
  await page.locator('button[ng-click="showMore()"]').click();
  await expect(rows).toHaveCount(120);
  await expect(page.locator('button[ng-click="showMore()"]')).toHaveCount(0);

  // Refined to the mails delivered: none yet
  await page.locator('.mail-stat').nth(1).click();
  await expect(rows).toHaveCount(0);
  await page.locator('.mail-stat').nth(1).click();
  await page.locator('[ng-click="showFilter = !showFilter"]').click();
  await page.locator('input[ng-model="refineSubject"]').fill('Bulk 11');
  await expect(rows).toHaveCount(11);
});
