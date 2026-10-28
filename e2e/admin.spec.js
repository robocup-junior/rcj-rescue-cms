// Setting up and running a competition on the admin pages: the competition, its settings, rounds,
// fields and teams, the runs of a league, judged and taken back, and the competition removed.
// Each test works on a competition of its own, so that the seed data stays as it is.
const { test, expect, open } = require('./fixtures');

test.use({ user: 'admin' });

/** A new competition, made on the admin home page; its id. */
async function newCompetition(page, name) {
  await open(page, '/admin');
  await page.locator('.is-add-button').click();
  const modal = page.locator('.modal.show');
  await modal.locator('input[ng-model="competitionName"]').fill(name);
  await modal.locator('button[ng-click="ok()"]').click();
  const card = page.locator('.modern-item-card', { hasText: name });
  await expect(card).toBeVisible();
  await card.click();
  await page.waitForURL(/\/admin\/[0-9a-f]{24}$/);
  return page.url().split('/').pop();
}

/** A two-tile maze map of the competition, as the map editor saves it. */
async function newMazeMap(page, competition) {
  const noVictims = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };
  const walls = [[1, 0], [3, 0], [1, 2], [3, 2], [0, 1], [4, 1]].map(([x, y]) => ({ x, y, z: 0, isWall: true }));
  const res = await page.request.post('/api/maps/maze', {
    data: {
      competition, league: 'Maze', name: 'Admin Map', finished: true, width: 2, length: 1, height: 1,
      startTile: { x: 1, y: 1, z: 0 },
      cells: [
        { x: 1, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: noVictims } },
        { x: 3, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, checkpoint: true, victims: noVictims } },
        ...walls,
      ],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

test('a competition is set up from nothing, a run added, judged and taken back, and the competition removed', async ({ page }) => {
  const name = `Setup Open ${Date.now()}`;
  const id = await newCompetition(page, name);

  // Settings: renamed, and the maze ranking made of the best 2 runs
  await open(page, `/admin/${id}/settings`);
  await page.locator('input[ng-model="cName"]').fill(`${name} 2026`);
  const maze = page.locator('[ng-repeat*="league"]', { has: page.locator('select[ng-model="league.rule"]') }).filter({ hasText: /Maze/ }).first();
  await maze.locator('input[ng-model="league.num"]').fill('2');
  // Saved, the page is loaded again
  await Promise.all([page.waitForEvent('load'), page.locator('button.btn-hero-action[ng-click="set()"]').click()]);
  await expect(page.locator('input[ng-model="cName"]')).toHaveValue(`${name} 2026`);
  await expect.poll(async () => (await (await page.request.get(`/api/competitions/${id}`)).json()).name).toBe(`${name} 2026`);

  // A round, a field and a team
  await open(page, `/admin/${id}/rounds`);
  await page.locator('input[ng-model="roundName"]').fill('Final');
  await page.locator('button[ng-click="addRound()"]').click();
  await expect(page.getByText('Final', { exact: true })).toBeVisible();

  await open(page, `/admin/${id}/fields`);
  await page.locator('input[ng-model="fieldName"]').fill('Arena 1');
  await page.locator('button[ng-click="addField()"]').click();
  await expect(page.getByText('Arena 1', { exact: true })).toBeVisible();

  await open(page, `/admin/${id}/teams`);
  await page.locator('.modern-card-header', { hasText: /add team/i }).click();
  await page.locator('input[ng-model="teamCode"]').fill('M99');
  await page.locator('input[ng-model="teamName"]').fill('Admin Team');
  await page.locator('input[ng-model="country"]').fill('Japan');
  await page.locator('select[ng-model="teamLeague"]').selectOption('Maze');
  await page.locator('button[ng-click="addTeam()"]').click();
  await expect(page.getByText('Admin Team')).toBeVisible();

  // A run of the team on a map of the competition
  const mapId = await newMazeMap(page, id);
  await open(page, `/admin/${id}/Maze/games`);
  await page.locator('.modern-card-header', { hasText: /add run/i }).click();
  await page.locator('select[ng-model="run.round"]').selectOption({ label: 'Final' });
  await page.locator('select[ng-model="run.team"]').selectOption({ label: 'Admin Team' });
  await page.locator('select[ng-model="run.map"]').selectOption({ label: 'Admin Map' });
  await page.locator('select[ng-model="run.field"]').selectOption({ label: 'Arena 1' });
  await page.locator('button[ng-click^="addRun"]').click();
  const rows = page.locator('tr[ng-repeat]', { hasText: 'Admin Team' });
  const row = rows.first();
  await expect(row).toBeVisible();
  const runs = await (await page.request.get(`/api/runs/maze/competition/${id}`)).json();
  expect(runs).toHaveLength(1);
  expect(runs[0].map._id || runs[0].map).toBe(mapId);
  const runId = runs[0]._id;

  // Judged from its actions: the checkpoint reached
  await row.getByRole('button', { name: 'Action', exact: true }).click();
  await row.locator('button[ng-click^="go_judge"]').click();
  // Asked first, as judging again takes the time and signatures away
  await page.locator('.swal2-confirm').click();
  await page.waitForURL(new RegExp(`/maze/judge/${runId}`));
  await page.locator('.rv-check').nth(0).click();
  await page.locator('.rv-check').nth(1).click();
  await page.locator('.rv-photo-check').nth(0).click();
  await page.locator('.rv-photo-check').nth(1).click();
  await page.locator('button[ng-click="infochecked()"]').click();
  const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes(runId));
  await page.locator('.rv-mz-tile:not(.is-void)').nth(1).click();
  expect((await saved).ok()).toBeTruthy();
  await expect.poll(async () => (await (await page.request.get(`/api/runs/maze/${runId}`)).json()).score).toBeGreaterThan(0);

  // Taken back: its status reset, then the run deleted, each typed in to be sure
  const runRequest = async () => (await page.request.get(`/api/runs/maze/${runId}`)).json();
  await open(page, `/admin/${id}/Maze/games`);
  async function action(name, typed) {
    await row.getByRole('button', { name: 'Action', exact: true }).click();
    await row.locator(`button[ng-click^="${name}"]`).click();
    const dialog = page.locator('.swal2-popup');
    await dialog.locator('.swal2-input').fill('wrong');
    await dialog.locator('.swal2-confirm').click();
    await expect(dialog.locator('.swal2-validation-message')).toBeVisible();
    await dialog.locator('.swal2-input').fill(typed);
    await dialog.locator('.swal2-confirm').click();
    await expect(dialog).toBeHidden();
  }
  await page.request.put(`/api/runs/maze/${runId}`, { data: { status: 3 } });
  await action('statusReset', 'RESET');
  await expect.poll(async () => (await runRequest()).status).toBe(0);
  await action('removeRun', 'DELETE');
  await expect(rows).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get(`/api/runs/maze/competition/${id}`)).json()).length).toBe(0);

  // The competition removed from the admin home
  await open(page, '/admin');
  const card = page.locator('.modern-item-card', { hasText: name });
  await card.locator('.btn-delete-item').click();
  const modal = page.locator('.modal.show');
  await expect(modal).toBeVisible();
  // Not until DELETE is typed in
  await expect(modal.locator('button[ng-click="ok()"]')).toBeDisabled();
  await modal.locator('input[ng-model="confirmationText"]').fill('DELETE');
  await modal.locator('button[ng-click="ok()"]').click();
  await expect(card).toHaveCount(0);
  expect((await page.request.get(`/api/competitions/${id}`)).status()).toBeGreaterThanOrEqual(400);
});
