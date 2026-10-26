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

  test('counts the signatures and gets the send button ready once all three are written', async ({ page }) => {
    await open(page, `/line/sign/${ids.runs.Line}`);
    const count = page.locator('#rv-signatures .rv-header-total');
    await expect(count).toHaveText('0 / 3');

    for (let index = 0; index < 3; index++) {
      const slot = page.locator('.rv-sign-slot').nth(index);
      await slot.locator('.rv-sign-start').click();
      const pad = await slot.locator('canvas').boundingBox();
      await page.mouse.move(pad.x + 20, pad.y + pad.height / 2);
      await page.mouse.down();
      await page.mouse.move(pad.x + 120, pad.y + pad.height / 3, { steps: 5 });
      await page.mouse.up();
      await slot.locator('.rv-sign-action.is-done').click();
      await expect(slot).toHaveClass(/is-signed/);
    }
    await expect(count).toHaveText('3 / 3');
    await expect(page.locator('.rv-submit')).toHaveClass(/is-ready/);
  });
});
