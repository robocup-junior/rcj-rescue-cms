// The line map editor: tiles dragged from the toolbox onto the map, turned, given their items and
// the start, saved, and the map judged. (The maze map editor is in scenarios.spec.js.)
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a line map is drawn from the toolbox, saved as drawn, and judged', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  await open(page, `/admin/${competition}/Line/mapEditor`);
  const name = `Line Editor Map ${Date.now()}`;
  await page.locator('input[ng-model="name"]').fill(name);
  for (let i = 0; i < 2; i++) await page.locator('button[ng-click="width = width + 1"]').click();

  // From the toolbox: a tile with nothing on it, and one with a gap
  const toolbox = (pick) => page.evaluate((pick) => {
    const tiles = angular.element(document.querySelector('[ng-controller]')).scope().tileSet.tiles.map((t) => t.tileType);
    const t = tiles.find((t) => (pick == 'gap' ? t.gaps > 0 && !t.intersections : !t.gaps && !t.intersections && !t.seesaw && !t.speedbumps));
    return t._id;
  }, pick);
  const [plainId, gapId] = [await toolbox('plain'), await toolbox('gap')];
  const at = (x) => page.locator(`tile[x="${x}"][y="0"]`);
  for (const [x, id] of [[0, plainId], [1, gapId], [2, plainId]]) {
    await page.locator(`img.toolbox-tile[tile-id="${id}"]`).first().dragTo(at(x));
    await expect(at(x).locator('img').first()).toBeVisible();
  }
  // A click turns a tile
  await at(2).click();

  // Its sheet, from a right click: the start on the first tile, an obstacle on the last
  const sheet = page.locator('.modal.show');
  await at(0).click({ button: 'right' });
  await sheet.locator('label[for="isStartCheck"]').click();
  await expect(sheet.locator('input[ng-model="tile.start"]')).toBeChecked();
  await sheet.locator('button[ng-click="ok()"]').click();
  await at(2).click({ button: 'right' });
  await sheet.locator('button[ng-click="tile.items.obstacles = tile.items.obstacles + 1"]').click();
  await sheet.locator('button[ng-click="ok()"]').click();
  await expect(sheet).toHaveCount(0);

  // Marked finished, so that it can be run
  const finished = page.locator('button.status-icon-toggle');
  if (!/active/.test(await finished.getAttribute('class'))) await finished.click();
  await expect(finished).toHaveClass(/active/);
  await page.locator('button.btn-save[ng-click="saveMap()"]').click();
  await page.waitForURL(new RegExp(`/admin/${competition}/Line/mapEditor/[0-9a-f]{24}$`));
  const mapId = page.url().split('/').pop();
  const map = await (await request.get(`/api/maps/line/${mapId}?populate=true`)).json();
  expect(map).toMatchObject({ name, width: 3, length: 1, finished: true, startTile: { x: 0, y: 0, z: 0 } });
  const tile = (x) => map.tiles.find((t) => t.x === x && t.y === 0);
  expect(map.tiles).toHaveLength(3);
  expect(tile(1).tileType.gaps).toBeGreaterThan(0);
  expect(tile(2).items.obstacles).toBe(1);
  expect(tile(2).rot).toBe(90);

  // Listed with the league's maps, and judged: the gap's tile scored with a tap
  await open(page, `/admin/${competition}/Line/maps`);
  await expect(page.locator('.modern-item-card', { hasText: name })).toBeVisible();
  const [round, field, team] = await Promise.all([
    api.round(request, competition, 'R1'), api.field(request, competition, 'F1'), api.team(request, competition, 'Line', 'Editor Team'),
  ]);
  const runId = await api.run(request, 'line', { competition, round, field, team, map: mapId });
  await open(page, `/line/judge/${runId}`);
  await expect(page.locator('.rv-judge-map tile')).toHaveCount(3);
});
