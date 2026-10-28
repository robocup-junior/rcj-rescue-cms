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
