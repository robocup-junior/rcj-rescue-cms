// Runs judged on paper, then typed in: the manual input page takes the run's items, victims with
// their kits, LoPs, misidentifications, exit bonus and time; the run is sent, scored by the rules,
// and checked on its check page.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a maze run judged on paper is typed in and scored', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [round, field, team] = await Promise.all([
    api.round(request, competition, 'R1'), api.field(request, competition, 'F1'), api.team(request, competition, 'Maze', 'Paper Team'),
  ]);
  // The start, a checkpoint, a harmed (letter) victim on the top wall; none linear
  const map = await api.mazeMap(request, competition, 'Maze', 'Paper Map', [{}, { checkpoint: true }, { victims: { ...api.NO_VICTIMS, top: 'PHI' } }]);
  const runId = await api.run(request, 'maze', { competition, round, field, team, map });
  const back = `/maze/${competition}/Maze`;

  await open(page, `/maze/input/${runId}?return=${back}`);
  // The victim found, with its two kits; the checkpoint reached
  const victim = page.locator('.entry-item[ng-repeat^="victim in itemList.allVictims"]');
  await victim.locator('button[ng-click="toggleScored(victim)"]').click();
  await victim.locator('button.kit-btn', { hasText: '2' }).click();
  await page.locator('.entry-item[ng-repeat^="item in itemList.checkpoint"]').click();
  // A lack of progress, a misidentification, the exit bonus, and the time: 3:05
  await page.locator('button[ng-click="LoPs = LoPs + 1"]').click();
  await page.locator('button[ng-click="MisIdent = MisIdent + 1"]').click();
  await page.locator('[ng-click="changeExitBonus()"]').click();
  for (const digit of '0305') await page.locator(`button[ng-click="addTimeDigit('${digit}')"]`).click();

  await page.locator('button[ng-click="send()"]').click();
  // Back to the league's runs (the page it was opened from)
  await page.waitForURL((url) => url.pathname == back);

  // checkpoint 10 + victim 15 + its 2 kits 30 + reliability (1 victim x 10 + 2 kits x 10 - 1 LoP x 15)
  // + exit (1 victim x 10) - 1 misidentification x 5
  const run = await (await request.get(`/api/runs/maze/${runId}`)).json();
  expect(run).toMatchObject({ status: 4, LoPs: 1, misidentification: 1, exitBonus: true, time: { minutes: 3, seconds: 5 } });
  expect(run.score).toBe(10 + 15 + 30 + (10 + 20 - 15) + 10 - 5);

  // Its check page shows what was typed in
  await open(page, `/maze/check/${runId}`);
  await expect(page.locator('.entry-item.active, .item-img-wrapper').first()).toBeVisible();
});

test('a line run judged on paper is typed in and scored', async ({ page }) => {
  const ids = require('./ids');
  const { request } = page;
  // On the seed's line map: the start, then a tile with a gap and an obstacle
  const round = await api.round(request, ids.competition, `Paper ${Date.now()}`);
  const runId = await api.run(request, 'line', { competition: ids.competition, round, field: ids.field, team: ids.teams.Line, map: ids.maps.Line });
  const back = `/line/${ids.competition}/Line`;

  await open(page, `/line/input/${runId}?return=${back}`);
  // The robot placed on the start: what comes after is taken as passed too, to be unticked where
  // it was not (here the second tile's gap and obstacle are both passed)
  const items = page.locator('.entry-item-compact[ng-click^="!item.afterLoP"]');
  await items.nth(0).click();
  await expect(items.nth(0)).toHaveClass(/active/);
  await expect(items.nth(1)).toHaveClass(/active/);
  await page.locator('button[ng-click^="LoPs[item.LoP] = LoPs[item.LoP] + 1"]').first().click();
  // Both live victims to the green zone, the dead one to the red
  for (const [type, zone] of [['LIVE', 'GREEN'], ['LIVE', 'GREEN'], ['DEAD', 'RED']]) {
    await page.locator(`[ng-click="addVictimTmp('${type}')"]`).click();
    await page.locator(`[ng-click='victimRegist("${zone}")']`).click();
  }
  await page.locator('[ng-click="changeExitBonus()"]').click();
  for (const digit of '0712') await page.locator(`button[ng-click="addTimeDigit('${digit}')"]`).click();

  await page.locator('button[ng-click="send()"]').click();
  await page.waitForURL((url) => url.pathname == back);

  // gap 10 + obstacle 20 + exit 60 - 1 LoP x 5 + the tile after the last checkpoint x (5 - 1 LoP x 2)
  // + start 5, each rescue x (1.4 - 1 LoP x 0.05)
  const run = await (await request.get(`/api/runs/line/${runId}`)).json();
  const raw = 10 + 20 + 55 + 3 + 5;
  expect(run).toMatchObject({ status: 4, exitBonus: true, raw_score: raw, score: Math.round(raw * 1.35 ** 3), time: { minutes: 7, seconds: 12 } });
  expect(run.rescueOrder.map((r) => `${r.victimType} ${r.zoneType}`)).toEqual(['LIVE GREEN', 'LIVE GREEN', 'DEAD RED']);
});
