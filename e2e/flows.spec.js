// Logging in, access control and judging a run through the UI.
const { test, expect, open, USERS } = require('./fixtures');
const ids = require('./ids');

/** Fill in the login page's form (the navbar has a login form of its own). */
async function submitLogin(page, username, password) {
  const form = page.locator('form[ng-submit="login()"]');
  await form.locator('input[ng-model=username]').fill(username);
  await form.locator('input[ng-model=password]').fill(password);
  await form.locator('button[type=submit]').click();
}

test.describe('login', () => {
  test('a user logs in with the form and is taken to the home page', async ({ page }) => {
    await open(page, '/login');
    await submitLogin(page, USERS.admin.username, USERS.admin.password);
    await expect(page).toHaveURL(/\/home$/);

    // Logged in: the login page sends the user back home
    await page.goto('/login');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('a wrong password is refused', async ({ page }) => {
    page.allowErrors(/\/api\/auth\/login|status of 400/);
    await open(page, '/login');
    await submitLogin(page, USERS.admin.username, 'wrong password');
    await expect(page.locator('input[ng-model=password]')).toHaveClass(/is-invalid/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('pages that need a login send the user to the login page and back', async ({ page }) => {
    const target = `/maze/judge/${ids.runs.Maze}`;
    await page.goto(target);
    await expect(page).toHaveURL(`/login?page=${target}`);
    await submitLogin(page, USERS.judge.username, USERS.judge.password);
    await expect(page).toHaveURL(target);
  });
});

test.describe('access control', () => {
  test.use({ user: 'judge' });

  test('judges are told they cannot open the admin pages', async ({ page }) => {
    await page.goto(`/admin/${ids.competition}`);
    await expect(page).toHaveURL('/home/access_denied');
  });
});

test.describe('public run lists', () => {
  test('the line run list shows the teams of the competition', async ({ page }) => {
    await open(page, `/line/${ids.competition}/Line`);
    await expect(page.getByText('Line Team').first()).toBeVisible();
  });

  test('the public ranking lists the teams', async ({ page }) => {
    await open(page, `/maze/${ids.competition}/Maze/ranking`);
    await expect(page.getByText('Maze Team').first()).toBeVisible();
  });
});

test.describe('judging a maze run', () => {
  test.use({ user: 'judge' });

  test('the judge checks the team and records a lack of progress', async ({ page }) => {
    await open(page, `/maze/judge/${ids.runs.Maze}`);
    await expect(page.getByText('Maze Team').first()).toBeVisible();

    // Tap the four red cells to confirm the team, round, members and robot
    await page.locator('tr[ng-click="toggleCheckTeam()"]').click();
    await page.locator('tr[ng-click="toggleCheckRound()"]').click();
    await page.locator('[ng-click="toggleCheckMember()"]').click();
    await page.locator('[ng-click="toggleCheckMachine()"]').click();
    await page.locator('button[ng-click="infochecked()"]').click();

    const saved = page.waitForResponse((res) => res.url().includes(`/api/runs/maze/${ids.runs.Maze}`) && res.request().method() === 'PUT');
    await page.locator('button[ng-click="increment()"]').first().click();
    expect((await saved).ok()).toBeTruthy();

    const run = await (await page.request.get(`/api/runs/maze/${ids.runs.Maze}`)).json();
    expect(run.LoPs).toBe(1);
  });
});

test.describe('judging a line run', () => {
  test.use({ user: 'judge' });

  test('the judge checks the team, starts the timer, records a lack of progress and stops the timer', async ({ page }) => {
    await open(page, `/line/judge/${ids.runs.Line}`);

    // Going on takes all four checks: the team, the round, the members and the robot
    const confirm = page.locator('button[ng-click="infochecked()"]');
    await page.locator('.rv-check').nth(0).click();
    await page.locator('.rv-check').nth(1).click();
    await page.locator('.rv-photo-check').nth(0).click();
    await expect(confirm).toBeDisabled();
    await page.locator('.rv-photo-check').nth(1).click();
    await confirm.click();

    // Tiles score once the timer has run; the hint says so until then. Running, the timer is gone
    // from the top
    const timerCard = page.locator('.rv-timer-card');
    await expect(page.locator('.rv-map-hint')).toBeVisible();
    await timerCard.locator('.rv-timer-btn').click();
    await expect(timerCard).toHaveCount(0);
    await expect(page.locator('.rv-map-hint')).toHaveCount(0);

    // Until something on the run scores, reading it starts it afresh (initRunData.initLine), LoPs
    // and all, so what is checked is what the page sends
    const sent = page.waitForRequest((req) => req.url().includes(`/api/runs/line/${ids.runs.Line}`) && req.method() === 'PUT' && 'LoPs' in req.postDataJSON());
    await page.locator('.rv-lop-row').first().locator('.rv-step.is-plus').click();
    expect((await sent).postDataJSON().LoPs[0]).toBe(1);
    await expect(page.locator('.rv-lop-row').first().locator('.rv-step-count')).toHaveText('1');

    // A rescue is registered on its sheet, opened from the evacuation zone on the map (the seed
    // map has none, so from the button in the map card instead): the victim, then the zone, which
    // closes the sheet
    const rescueSheet = page.locator('.rv-overlay', { has: page.locator('.rv-rescue-sheet') });
    await page.locator('.rv-rescue-add').click();
    await expect(rescueSheet).toBeVisible();
    await rescueSheet.locator('.rv-victim-pick').first().click();
    const rescued = page.waitForRequest((req) => req.method() === 'PUT' && 'rescueOrder' in req.postDataJSON());
    await rescueSheet.locator('.rv-zone-pick.is-green').click();
    expect((await rescued).postDataJSON().rescueOrder).toEqual([{ victimType: 'LIVE', zoneType: 'GREEN' }]);
    await expect(rescueSheet).toBeHidden();
    await expect(page.locator('.rv-rescue-add .rv-evac-count')).toHaveText('1');
    await expect(rescueSheet.locator('.rv-rescue-item')).toHaveCount(1);

    // It is stopped from the time in the bar, asked twice; stopped, the time recorded is that of
    // the first tap, not of the confirmation
    const stop = page.locator('.rv-stat-stop');
    await stop.click();
    await page.getByRole('button', { name: 'Keep running' }).click();
    await expect(timerCard).toHaveCount(0);
    await stop.click();
    const stopAt = await page.evaluate(() => angular.element(document.body).scope().stopAt);
    await page.waitForTimeout(1100);
    await page.locator('.rv-stop-now').click();
    await expect(timerCard).toBeVisible();
    await expect(stop).toHaveCount(0);
    expect(await page.evaluate(() => angular.element(document.body).scope().time)).toBe(stopAt);
    const finish = page.locator('#rv-finish');
    await expect(finish.locator('.rv-submit')).toBeEnabled();
  });
});

test.describe('line run view', () => {
  test('the bar stays at the top and shows the score once the summary has scrolled away', async ({ page }) => {
    await open(page, `/line/view/${ids.finishedRuns.Line}`);
    const stats = page.locator('.rv-topbar-stats');
    await expect(stats).toBeHidden();

    await page.mouse.wheel(0, 1500);
    await expect(stats).toBeVisible();
    const bar = await page.locator('.rv-topbar').boundingBox();
    expect(bar.y).toBe(0);
  });
});

test.describe('line sign page', () => {
  test.use({ user: 'judge' });

  test('signs on the pad over the screen and gets the send button ready once all three have signed', async ({ page }) => {
    await open(page, `/line/sign/${ids.runs.Line}`);
    const count = page.locator('#rv-signatures .rv-header-total');
    const overlay = page.locator('.rv-overlay.is-pad');
    const done = overlay.locator('.rv-pad-btn.is-done');
    await expect(count).toHaveText('0 / 3');

    // Sending without the signatures points to the first missing one
    await page.locator('.rv-submit').click();
    await expect(page.locator('.rv-sign-slot').first()).toHaveClass(/is-missing/);
    await expect(page.locator('.rv-overlay.is-send')).toBeHidden();

    async function stroke() {
      const pad = await page.locator('#rv-pad').boundingBox();
      await page.mouse.move(pad.x + 40, pad.y + pad.height / 2);
      await page.mouse.down();
      await page.mouse.move(pad.x + 240, pad.y + pad.height / 3, { steps: 8 });
      await page.mouse.up();
    }

    for (let index = 0; index < 3; index++) {
      const slot = page.locator('.rv-sign-slot').nth(index);
      await slot.locator('.rv-sign-start').click();
      await expect(overlay).toBeVisible();
      // Nothing to save until something is written; undo takes the stroke back
      await expect(done).toBeDisabled();
      await stroke();
      await overlay.locator('.rv-pad-btn').first().click();
      await expect(done).toBeDisabled();
      await stroke();
      await done.click();
      await expect(overlay).toBeHidden();
      await expect(slot).toHaveClass(/is-signed/);
      await expect(slot.locator('.rv-sign-image img')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
    }
    await expect(count).toHaveText('3 / 3');
    await expect(page.locator('.rv-submit')).toHaveClass(/is-ready/);

    // Cancelling a new signature keeps the one before
    await page.locator('.rv-sign-slot').first().locator('.rv-sign-action').click();
    await stroke();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    await expect(count).toHaveText('3 / 3');

    // Check and send: an error keeps the sheet open to retry, then the run is sent.
    // The request is answered here, so the seeded run stays unsent.
    page.allowErrors(/500/);
    let replies = [500, 200];
    let sent = null;
    await page.route(`**/api/runs/line/${ids.runs.Line}`, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      sent = route.request().postDataJSON();
      await route.fulfill({ status: replies.shift(), body: '{}' });
    });
    const sheet = page.locator('.rv-overlay.is-send');
    await page.locator('.rv-submit').click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.rv-send-signs img')).toHaveCount(3);
    await sheet.locator('.rv-pad-btn.is-send').click();
    await expect(sheet.locator('.rv-send-error')).toBeVisible();
    await sheet.locator('.rv-pad-btn.is-send').click();
    await expect(sheet.locator('.rv-send-done')).toBeVisible();
    expect(sent.status).toBe(4);
    expect(sent.sign.captain).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
