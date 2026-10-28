// Whole runs judged on the UI as at a competition, in each league: the team checked, the timer
// started from the bar, every kind of item scored, the timer stopped and the time set, the run
// finished, signed and sent. The score the server works out is checked against the rules worked by
// hand, and the sign and view pages show it; the view page, open all along, follows without a reload.
// Each judges a run made for it (by the admin API), so that the tests do not depend on each other.
const { test, expect, open, USERS } = require('./fixtures');
const ids = require('./ids');

test.use({ user: 'judge' });

/** A new run of the league's team on the map, waiting for the judge, in a round of its own (a team
 * has one run in a round). */
async function newRun(request, kind, league, map) {
  expect((await request.post('/api/auth/login', { data: USERS.admin })).ok()).toBeTruthy();
  const round = await request.post('/api/rounds', { data: { competition: ids.competition, name: `Scenario ${Math.random()}` } });
  expect(round.status()).toBe(201);
  const res = await request.post(`/api/runs/${kind}`, {
    data: { competition: ids.competition, round: (await round.json()).id, field: ids.field, team: ids.teams[league], map },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

/** Check the team, the round, the members and the robot. */
async function checkTeam(page) {
  await page.locator('.rv-check').nth(0).click();
  await page.locator('.rv-check').nth(1).click();
  await page.locator('.rv-photo-check').nth(0).click();
  await page.locator('.rv-photo-check').nth(1).click();
  await page.locator('button[ng-click="infochecked()"]').click();
}

/** Stop the timer from the bar if it runs, then set the time of the run to 2:05 on the finish card. */
async function stopAndSetTime(page) {
  const stop = page.locator('.rv-stat-stop');
  if (await stop.count()) {
    await stop.click();
    await page.locator('.rv-stop-now[ng-click="confirmStop()"]').click();
  }
  await expect(page.locator('.rv-stat-start')).toBeVisible();
  const finish = page.locator('#rv-finish');
  if (await finish.locator('.rv-time-reset').isVisible()) await finish.locator('.rv-time-reset').click();
  const step = (label) => finish.locator(`.rv-time-step[aria-label="${label}"]`);
  for (let i = 0; i < 2; i++) await step('+1 min').click();
  for (let i = 0; i < 5; i++) await step('+1 sec').click();
  await expect(page.locator('.rv-stat-start .rv-stat-value')).toHaveText('2:05');
}

/** Finish the run on the judge page, which goes on to the sign page once all is saved. */
async function finish(page, kind, runId) {
  await page.locator('#rv-finish .rv-submit').click();
  await page.waitForURL(new RegExp(`/${kind}/sign/${runId}`));
  await page.waitForLoadState('networkidle');
}

/** Sign for the team, the judge and the referee, then check and send the run. */
async function signAndSend(page) {
  const overlay = page.locator('.rv-overlay.is-pad');
  for (let index = 0; index < 3; index++) {
    await page.locator('.rv-sign-slot').nth(index).locator('.rv-sign-start').click();
    await expect(overlay).toBeVisible();
    const pad = await page.locator('#rv-pad').boundingBox();
    await page.mouse.move(pad.x + 40, pad.y + pad.height / 2);
    await page.mouse.down();
    await page.mouse.move(pad.x + 240, pad.y + pad.height / 3, { steps: 8 });
    await page.mouse.up();
    await overlay.locator('.rv-pad-btn.is-done').click();
    await expect(overlay).toBeHidden();
  }
  await page.locator('.rv-submit').click();
  const sheet = page.locator('.rv-overlay.is-send');
  await expect(sheet).toBeVisible();
  await sheet.locator('.rv-pad-btn.is-send').click();
  await expect(sheet.locator('.rv-send-done')).toBeVisible();
}

/** The score in the bar of the sign page, in the summary of the view page. */
const signScore = (page) => page.locator('.rv-topbar-stats .rv-stat-value').first();
const viewScore = (page) => page.locator('.rv-summary-item.is-score .rv-summary-value');

/** The run as stored, once it is sent. */
async function storedRun(page, kind, runId) {
  const run = await (await page.request.get(`/api/runs/${kind}/${runId}`)).json();
  expect(run.status).toBe(4);
  expect(run.time).toMatchObject({ minutes: 2, seconds: 5 });
  return run;
}

/** On a maze judge page: the tile n of the row, then its sheet if it opens one. */
const mazeTile = (page, n) => page.locator('.rv-mz-tile:not(.is-void)').nth(n);
const mazeSheet = (page) => page.locator('.rvm-maze');

async function closeSheet(page) {
  await mazeSheet(page).locator('.rvm-ok').click();
  await expect(mazeSheet(page)).toBeHidden();
}

test('a maze run, judged, signed and sent', async ({ page, context, request }) => {
  const runId = await newRun(request, 'maze', 'Maze', ids.scenarioMaps.Maze);
  // Watched on the view page all along
  const viewer = await context.newPage();
  await open(viewer, `/maze/view/${runId}`);

  await open(page, `/maze/judge/${runId}`);
  await checkTeam(page);
  await page.locator('.rv-stat-start').click();
  await expect(page.locator('.rv-stat-stop')).toBeVisible();

  // The start: the cognitive target (stable) found, with the one kit it needs
  await mazeTile(page, 0).click();
  let victim = mazeSheet(page).locator('.rvm-victim');
  await expect(victim.locator('.rvm-category')).toHaveClass(/is-stable/);
  await victim.locator('.rvm-found').click();
  await expect(victim).toHaveClass(/is-half/);
  await victim.locator('.rvm-kits .rv-step.is-plus').click();
  await expect(victim).not.toHaveClass(/is-half/);
  await closeSheet(page);

  // The checkpoint and the speed bump, one item each, scored with a tap
  await mazeTile(page, 1).click();
  await mazeTile(page, 4).click();
  await expect(mazeSheet(page)).toHaveCount(0);

  // The blue tile visited once
  await mazeTile(page, 2).click();
  await mazeSheet(page).locator('.rvm-counter .rv-step.is-plus').click();
  await expect(mazeSheet(page).locator('.rvm-counter .rv-step-count')).toHaveText('1');
  await closeSheet(page);

  // The unharmed victim found (it needs no kit), the harmed one found with its two kits
  await mazeTile(page, 3).click();
  const [unharmed, harmed] = [mazeSheet(page).locator('.rvm-victim').nth(0), mazeSheet(page).locator('.rvm-victim').nth(1)];
  await expect(unharmed.locator('.rvm-kits')).toHaveCount(0);
  await unharmed.locator('.rvm-found').click();
  await harmed.locator('.rvm-found').click();
  for (let i = 0; i < 2; i++) await harmed.locator('.rvm-kits .rv-step.is-plus').click();
  await expect(harmed.locator('.rvm-kits')).toHaveClass(/is-enough/);
  await closeSheet(page);

  // A lack of progress and a misidentification, then the exit bonus, which stops the timer
  await page.locator('#rv-lops .rv-step.is-plus').nth(0).click();
  await page.locator('#rv-lops .rv-step.is-plus').nth(1).click();
  await page.locator('#rv-exit .rv-exit-toggle').click();
  await expect(page.locator('.rv-stat-stop')).toHaveCount(0);

  await stopAndSetTime(page);
  await finish(page, 'maze', runId);

  // checkpoint 10 + speed bump 5 + blue 40 - 1 visit x 10
  // + victims: cognitive 30, unharmed 15, harmed 15; kits: 1 to one victim 10, 2 to one 30
  // + reliability: 3 victims x 10 + 3 kits x 10 + 1 blue tile x 10 - 1 LoP x 15
  // + exit: 3 victims x 10 + 1 blue tile x 10
  // - 1 misidentification x 5
  const expected = 10 + 5 + 30 + (30 + 15 + 15) + (10 + 30) + (30 + 30 + 10 - 15) + (30 + 10) - 5;
  await expect(signScore(page)).toHaveText(String(expected));
  await signAndSend(page);

  const run = await storedRun(page, 'maze', runId);
  expect(run.score).toBe(expected);
  expect(run).toMatchObject({ LoPs: 1, misidentification: 1, exitBonus: true });
  await expect(viewScore(viewer)).toContainText(String(expected));
  await open(page, `/maze/view/${runId}`);
  await expect(viewScore(page)).toContainText(String(expected));
});

test('a maze entry run, judged, signed and sent', async ({ page, context, request }) => {
  const runId = await newRun(request, 'maze', 'MazeNL', ids.scenarioMaps.MazeNL);
  const viewer = await context.newPage();
  await open(viewer, `/maze/view/${runId}`);

  await open(page, `/maze/judge/${runId}`);
  await checkTeam(page);
  await page.locator('.rv-stat-start').click();

  // The red victim on the start found and identified
  await mazeTile(page, 0).click();
  await mazeSheet(page).locator('.rvm-found').nth(0).click();
  await mazeSheet(page).locator('.rvm-found').nth(1).click();
  await closeSheet(page);
  // The checkpoint and the speed bump with a tap; the green victim found, not identified
  await mazeTile(page, 1).click();
  await mazeTile(page, 3).click();
  await mazeTile(page, 2).click();
  await mazeSheet(page).locator('.rvm-found').nth(0).click();
  await closeSheet(page);

  await page.locator('#rv-lops .rv-step.is-plus').nth(0).click();
  await page.locator('#rv-lops .rv-step.is-plus').nth(1).click();
  await page.locator('#rv-exit .rv-exit-toggle').click();

  await stopAndSetTime(page);
  await finish(page, 'maze', runId);

  // red 30 + identified 10 + checkpoint 10 + green 30 + speed bump 5
  // + reliability: 2 victims x 10 - 1 LoP x 5 + exit: 2 victims x 10 - 1 misidentification x 5
  const expected = 30 + 10 + 10 + 30 + 5 + (20 - 5) + 20 - 5;
  await expect(signScore(page)).toHaveText(String(expected));
  await signAndSend(page);

  const run = await storedRun(page, 'maze', runId);
  expect(run.score).toBe(expected);
  await expect(viewScore(viewer)).toContainText(String(expected));
});

test('a line run, judged, signed and sent', async ({ page, context, request }) => {
  const runId = await newRun(request, 'line', 'Line', ids.maps.Line);
  const viewer = await context.newPage();
  await open(viewer, `/line/view/${runId}`);

  await open(page, `/line/judge/${runId}`);
  await checkTeam(page);
  await page.locator('.rv-stat-start').click();

  // The second tile's gap and obstacle, passed once: one tap scores both
  await page.locator('.rv-judge-map tile').nth(1).click();
  await page.locator('.rv-lop-row').first().locator('.rv-step.is-plus').click();

  // Both live victims to the green zone, then the dead one to the red
  const sheet = page.locator('.rv-overlay', { has: page.locator('.rv-rescue-sheet') });
  for (const [victim, zone] of [[0, 'green'], [0, 'green'], [1, 'red']]) {
    await page.locator('.rv-rescue-add').click();
    await expect(sheet).toBeVisible();
    await sheet.locator('.rv-victim-pick').nth(victim).click();
    await sheet.locator(`.rv-zone-pick.is-${zone}`).click();
    await expect(sheet).toBeHidden();
  }
  await expect(page.locator('.rv-rescue-add .rv-evac-victim')).toHaveCount(3);
  await page.locator('#rv-exit .rv-exit-toggle').click();

  await stopAndSetTime(page);
  // Not finished until the start is marked (the robot placed on it), which the page asks for
  await page.locator('#rv-finish .rv-submit').click();
  const warning = page.locator('.swal2-popup');
  await expect(warning).toBeVisible();
  await warning.locator('.swal2-confirm').click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/line/judge/${runId}`));
  await page.locator('.rv-judge-map tile').nth(0).click();
  await finish(page, 'line', runId);

  // gap 10 + obstacle 20 + exit 60 - 1 LoP x 5 + the tile after the last checkpoint x (5 - 1 LoP x 2)
  // + start 5, each rescue x (1.4 - 1 LoP x 0.05)
  const raw = 10 + 20 + 55 + 3 + 5;
  const expected = Math.round(raw * 1.35 ** 3);
  await expect(signScore(page)).toHaveText(String(expected));
  await signAndSend(page);

  const run = await storedRun(page, 'line', runId);
  expect(run).toMatchObject({ raw_score: raw, score: expected, exitBonus: true });
  expect(run.rescueOrder.map((r) => `${r.victimType} ${r.zoneType}`)).toEqual(['LIVE GREEN', 'LIVE GREEN', 'DEAD RED']);
  await expect(viewScore(viewer)).toContainText(String(expected));
});

test('a line entry run, judged, signed and sent', async ({ page, context, request }) => {
  const runId = await newRun(request, 'line', 'LineNL', ids.maps.LineNL);
  // The entry leagues are not disclosed: their runs are watched as staff
  const staff = await context.browser().newContext({ baseURL: test.info().project.use.baseURL });
  expect((await staff.request.post('/api/auth/login', { data: USERS.admin })).ok()).toBeTruthy();
  const viewer = await staff.newPage();
  await open(viewer, `/line/view/${runId}`);

  await open(page, `/line/judge/${runId}`);
  await checkTeam(page);
  await page.locator('.rv-stat-start').click();
  await page.locator('.rv-judge-map tile').nth(1).click();

  // The first live victim identified, the second found, the dead one identified
  const sheet = page.locator('.rv-overlay', { has: page.locator('.rv-nl-picks') });
  await page.locator('.rv-rescue-add').click();
  await expect(sheet).toBeVisible();
  const picks = sheet.locator('.rv-nl-pick');
  await picks.nth(0).locator('.rv-nl-opt.is-identified').click();
  await picks.nth(1).locator('.rv-nl-opt.is-found').click();
  await picks.nth(2).locator('.rv-nl-opt.is-identified').click();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  const chips = page.locator('.rv-rescue-add .rv-nl-chip');
  await expect(chips.nth(0)).toHaveClass(/is-identified/);
  await expect(chips.nth(1)).toHaveClass(/is-found/);
  await page.locator('#rv-exit .rv-exit-toggle').click();

  await stopAndSetTime(page);
  // The start marked, as the page asks before the run is finished
  await page.locator('.rv-judge-map tile').nth(0).click();
  await finish(page, 'line', runId);

  // gap 10 + obstacle 20 + exit 30 + start 5; live: identified 10 + 20, found 10; dead identified 10 + 10
  const expected = 10 + 20 + 30 + 5 + 30 + 10 + 20;
  await expect(signScore(page)).toHaveText(String(expected));
  await signAndSend(page);

  const run = await storedRun(page, 'line', runId);
  expect(run.score).toBe(expected);
  await expect(viewScore(viewer)).toContainText(String(expected));
  await staff.close();
});

test.describe('a maze map made in the map editor', () => {
  test.use({ user: 'admin' });

  test('is saved as drawn, and judged', async ({ page, request }) => {
    await open(page, `/admin/${ids.competition}/Maze/mapEditor`);
    const name = `Editor Map ${Date.now()}`;
    await page.locator('textarea.hero-title-input').fill(name);
    // Three tiles in a row
    for (let i = 0; i < 2; i++) await page.locator('button[ng-click="width = width + 1"]').click();

    // The cells row by row, 2 x 3 + 1 across: walls around the tiles, none between them
    const cell = (x, y) => page.locator('td[ng-click^="cellClick"]').nth(y * 7 + x);
    const walls = [[1, 0], [3, 0], [5, 0], [1, 2], [3, 2], [5, 2], [0, 1], [6, 1]];
    for (const [x, y] of walls) await cell(x, y).click();
    for (const [x, y] of walls) await expect(cell(x, y)).toHaveClass(/\bwall\b/);

    // Each tile on its sheet: the start, a harmed victim on the top wall, a checkpoint
    const sheet = page.locator('.modal.show');
    const done = () => sheet.locator('button[ng-click="ok()"]').click();
    await cell(1, 1).click();
    await sheet.locator('label', { has: page.locator('input[ng-model="isStart"]') }).click();
    await done();
    await cell(3, 1).click();
    await sheet.locator('input[ng-model="cell.tile.victims.top"][value="PHI"]').check();
    await done();
    await cell(5, 1).click();
    await sheet.locator('label', { has: page.locator('input[ng-model="cell.tile.checkpoint"]') }).click();
    await done();
    await expect(cell(5, 1)).toHaveClass(/checkpoint/);
    // Marked finished, as a new map is
    await expect(page.locator('button.status-icon-toggle')).toHaveClass(/active/);

    // Saved, the editor goes on with the new map
    await page.locator('button.btn-save[ng-click="saveMap()"]').click();
    await page.waitForURL(new RegExp(`/admin/${ids.competition}/Maze/mapEditor/[0-9a-f]{24}$`));
    const mapId = page.url().split('/').pop();
    const map = await (await page.request.get(`/api/maps/maze/${mapId}`)).json();
    expect(map).toMatchObject({ name, width: 3, length: 1, height: 1, finished: true, startTile: { x: 1, y: 1, z: 0 } });
    const at = (x, y) => map.cells.find((c) => c.x === x && c.y === y && c.z === 0);
    expect(walls.every(([x, y]) => at(x, y) && at(x, y).isWall)).toBeTruthy();
    expect(at(2, 1) && at(2, 1).isWall).toBeFalsy();
    expect(at(3, 1).tile.victims.top).toBe('PHI');
    expect(at(5, 1).tile.checkpoint).toBe(true);
    // Each tile is along a wall: linear
    expect([1, 3, 5].every((x) => at(x, 1).isLinear)).toBeTruthy();

    // Judged on a run: the victim found, the checkpoint reached
    const runId = await newRun(request, 'maze', 'Maze', mapId);
    await open(page, `/maze/judge/${runId}`);
    await checkTeam(page);
    await expect(page.locator('.rv-mz-tile:not(.is-void)')).toHaveCount(3);
    await mazeTile(page, 1).click();
    await mazeSheet(page).locator('.rvm-found').click();
    await closeSheet(page);
    const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes(runId));
    await mazeTile(page, 2).click();
    await saved;
    await expect.poll(() => page.evaluate(() => angular.element(document.body).scope().sync)).toBe(0);
    // Linear: harmed victim 5 + checkpoint 10 + reliability: 1 victim x 10
    expect((await (await page.request.get(`/api/runs/maze/${runId}`)).json()).score).toBe(5 + 10 + 10);
  });
});

test('a simulation run, judged, signed and sent', async ({ page, context, request }) => {
  const runId = await newRun(request, 'simulation', 'Erebus');
  const viewer = await context.newPage();
  await open(viewer, `/simulation/view/${runId}`);

  await open(page, `/simulation/judge/${runId}`);
  await page.locator('tr[ng-click="toggleCheckTeam()"]').click();
  await page.locator('tr[ng-click="toggleCheckRound()"]').click();
  await page.locator('[ng-click="toggleCheckMember()"]').click();
  await page.locator('button[ng-click="infochecked()"]').click();

  // The score and time the simulator gave, typed in
  await page.locator('input[ng-model="score"]').fill('123');
  await page.locator('input[ng-model="minutes"]').fill('7');
  await page.locator('input[ng-model="seconds"]').fill('45');
  await page.locator('button[ng-click="confirm()"]').click();
  await page.waitForURL(new RegExp(`/simulation/sign/${runId}`));
  await page.waitForLoadState('networkidle');

  // Sending without the signatures says which are missing
  await page.locator('button[ng-click="send_sign()"]').click();
  await expect(page.locator('.swal2-popup')).toBeVisible();
  await page.locator('.swal2-confirm').click();

  // Each signature written on its pad, kept when the pad is closed
  for (const [index, pad] of [[0, '#cap_sig'], [1, '#ref_sig'], [2, '#refas_sig']]) {
    await page.locator(`button[ng-click="toggleSign(${index})"]:visible`).click();
    const canvas = page.locator(`${pad} canvas`);
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + box.height / 3, { steps: 8 });
    await page.mouse.up();
    await page.locator(`button[ng-click="toggleSign(${index})"]:visible`).click();
  }
  await page.locator('textarea[ng-model="comment"]').fill('Well done');
  await page.locator('button[ng-click="send_sign()"]').click();
  await page.locator('.swal2-confirm').click();

  await expect.poll(async () => (await (await page.request.get(`/api/runs/simulation/${runId}`)).json()).status).toBe(4);
  const run = await (await page.request.get(`/api/runs/simulation/${runId}`)).json();
  expect(run).toMatchObject({ score: 123, time: { minutes: 7, seconds: 45 }, comment: 'Well done' });
  await expect(viewer.getByText('123').first()).toBeVisible();
});
