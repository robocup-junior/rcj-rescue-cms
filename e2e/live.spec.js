// Pages that follow what happens elsewhere, without a reload: the runs of a league as their status
// changes, the admin's list of games and the ranking as runs are scored, the clock of the signage, a
// display told to refresh, a booking as a team takes it. Each page is opened first, then the change
// is made elsewhere (by the API, as the judge's or the team's page makes it).
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

/** A competition of its own, with a run waiting in each kind of league. */
async function competitionWithRuns(request) {
  const competition = await api.competition(request);
  const [round, field] = await Promise.all([api.round(request, competition, 'R1'), api.field(request, competition, 'F1')]);
  const [mazeTeam, lineTeam, simTeam] = await Promise.all([
    api.team(request, competition, 'Maze', 'Maze Live'), api.team(request, competition, 'Line', 'Line Live'),
    api.team(request, competition, 'Erebus', 'Sim Live'),
  ]);
  const mazeMap = await api.mazeMap(request, competition, 'Maze', 'Live Map', [{}, { checkpoint: true }]);
  const lineMap = await api.lineMap(request, competition, 'Line', 'Live Line Map');
  const refs = { competition, round, field };
  const runs = {
    maze: await api.run(request, 'maze', { ...refs, team: mazeTeam, map: mazeMap }),
    line: await api.run(request, 'line', { ...refs, team: lineTeam, map: lineMap }),
    simulation: await api.run(request, 'simulation', { ...refs, team: simTeam }),
  };
  return { competition, field, runs };
}

test('the runs of a league follow their status as judges take them', async ({ page }) => {
  const { competition, runs } = await competitionWithRuns(page.request);
  for (const [kind, league, team] of [['maze', 'Maze', 'Maze Live'], ['line', 'Line', 'Line Live'], ['simulation', 'Erebus', 'Sim Live']]) {
    await open(page, `/${kind}/${competition}/${league}`);
    const row = page.locator('tr[ng-repeat^="run in runs"]', { hasText: team });
    await expect(row.locator('.btn-run-judge')).toBeVisible();
    // Taken by a judge (on another device): it can no longer be judged from here
    expect((await page.request.put(`/api/runs/${kind}/${runs[kind]}`, { data: { status: 2 } })).ok()).toBeTruthy();
    await expect(row.locator('.btn-run-judge'), kind).toHaveCount(0);
  }
});

test('the admin\'s games and the ranking follow the scores', async ({ page, context }) => {
  const { competition, runs } = await competitionWithRuns(page.request);
  await open(page, `/admin/${competition}/Maze/games`);
  const ranking = await context.newPage();
  await open(ranking, `/maze/${competition}/Maze/ranking`);
  // (a row replaced stays a moment, on its way out)
  const game = page.locator('tr[ng-repeat^="run in runs"]:not(.ng-leave)', { hasText: 'Maze Live' });
  await expect(game.locator('td[data-label="Score"] .font-weight-bold')).toHaveText('0');

  // The checkpoint scored and the run finished
  const scored = { tiles: { '3,1,0': { scoredItems: { checkpoint: true } } }, status: 6 };
  expect((await page.request.put(`/api/runs/maze/${runs.maze}`, { data: scored })).ok()).toBeTruthy();
  await expect(game.locator('td[data-label="Score"] .font-weight-bold')).toHaveText('10');
  const team = ranking.locator('tr[ng-repeat^="team in ranking"]', { hasText: 'Maze Live' });
  await expect(team.locator('[ng-bind="team.gameSum.score"]')).toHaveText('10');
});

test('the signage clock follows the runs of the fields', async ({ page }) => {
  const { competition, runs } = await competitionWithRuns(page.request);
  await open(page, `/signage/clock/${competition}`);
  // Asked for the runs again as soon as one changes status
  for (const kind of ['maze', 'line']) {
    const asked = page.waitForRequest((req) => req.url().includes(`/api/runs/${kind}/competition/${competition}`));
    expect((await page.request.put(`/api/runs/${kind}/${runs[kind]}`, { data: { status: 2 } })).ok()).toBeTruthy();
    await asked;
  }
});

test('a signage display refreshes when it is told to', async ({ page, context }) => {
  const res = await page.request.post('/api/signage', {
    data: { name: `Live ${Date.now()}`, content: [{ duration: 60, type: 'iframe', url: '/home', group: '0' }] },
  });
  expect(res.status()).toBe(201);
  const { id } = await res.json();
  const display = await context.newPage();
  await display.goto(`/signage/display/${id}/1`);
  await display.waitForLoadState('networkidle');
  await display.evaluate(() => { window.notReloaded = true; });

  // Told on the setting page; it reloads a few seconds later, all together with the other displays
  expect((await page.request.get(`/api/signage/${id}/refresh`)).ok()).toBeTruthy();
  await expect.poll(() => display.evaluate(() => window.notReloaded === undefined).catch(() => false), { timeout: 15000 }).toBeTruthy();
  await page.request.delete(`/api/signage/${id}`);
});
