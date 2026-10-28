// The ranking of a league: kept to the staff until it is disclosed on the competition's settings,
// then public; the teams in the order of their scores, on the public and the admin pages.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a league ranking is disclosed on the settings, then lists the teams by their scores', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [r1, r2, field] = await Promise.all([
    api.round(request, competition, 'R1'), api.round(request, competition, 'R2'), api.field(request, competition, 'F1'),
  ]);
  const [alpha, beta] = await Promise.all([
    api.team(request, competition, 'Maze', 'Alpha'), api.team(request, competition, 'Maze', 'Beta'),
  ]);
  const map = await api.mazeMap(request, competition, 'Maze', 'Ranking Map', [{}, { checkpoint: true }, { speedbump: true }]);

  // Alpha: the checkpoint (10), then the speed bump (5); Beta: both, twice (15 + 15)
  const scored = { checkpoint: { '3,1,0': { scoredItems: { checkpoint: true } } }, speedbump: { '5,1,0': { scoredItems: { speedbump: true } } } };
  const runs = [
    [alpha, r1, scored.checkpoint], [alpha, r2, scored.speedbump],
    [beta, r1, { ...scored.checkpoint, ...scored.speedbump }], [beta, r2, { ...scored.checkpoint, ...scored.speedbump }],
  ];
  for (const [team, round, tiles] of runs) {
    const id = await api.run(request, 'maze', { competition, round, field, team, map });
    expect((await request.put(`/api/runs/maze/${id}`, { data: { tiles, status: 6 } })).ok()).toBeTruthy();
  }

  // The public, not logged in
  const visitor = await browser.newContext({ baseURL });
  const publicPage = await visitor.newPage();
  const rows = (p) => p.locator('tr[ng-repeat^="team in ranking"]');
  const expectRanking = async (p) => {
    await expect(rows(p)).toHaveCount(2);
    await expect(rows(p).nth(0).locator('.team-name')).toHaveText('Beta');
    await expect(rows(p).nth(0).locator('[ng-bind="team.gameSum.score"]')).toHaveText('30');
    await expect(rows(p).nth(1).locator('.team-name')).toHaveText('Alpha');
    await expect(rows(p).nth(1).locator('[ng-bind="team.gameSum.score"]')).toHaveText('15');
  };
  expect((await visitor.request.get(`/api/ranking/${competition}/Maze`)).status()).toBe(401);

  // Disclosed on the settings
  await open(page, `/admin/${competition}/settings`);
  const disclose = () => page.locator('tr[ng-repeat^="league in leagues"]', { has: page.locator('td', { hasText: /^\s*Rescue Maze\s*$/ }) })
    .locator('input[ng-model="league.disclose"]');
  await expect(disclose()).not.toBeChecked();
  await disclose().locator('xpath=..').click();
  await expect(disclose()).toBeChecked();
  await Promise.all([page.waitForEvent('load'), page.locator('button.btn-hero-action[ng-click="set()"]').click()]);
  await expect(disclose()).toBeChecked();

  await open(publicPage, `/maze/${competition}/Maze/ranking`);
  await expectRanking(publicPage);
  // Still kept for the league not disclosed
  expect((await visitor.request.get(`/api/ranking/${competition}/MazeNL`)).status()).toBe(401);
  await visitor.close();

  await open(page, `/admin/${competition}/Maze/games/ranking`);
  await expectRanking(page);
});
