// The judge's pages on Safari 12 (iOS 12, the iPad mini 2's last), in the stand-in of
// e2e/safari12.js: the map shows each tile's status over the whole tile, the sheets (rescue,
// stopping the timer, leaving) open over the page, and a signature is written with a finger.
// Screenshots of each page are attached to the report, to look over the design. And on tablets,
// the whole map is in view.
const { test, expect, open } = require('./fixtures');
const ids = require('./ids');
const api = require('./api');
const { IPAD_MINI_2, emulateSafari12, touchStroke } = require('./safari12');

// Taps are clicks here: two taps close together are a double tap, which zooms the page instead.
// The page's own document is served again by the stand-in, which Chromium then takes for one from
// elsewhere and keeps from reaching localhost (the socket.io connection) without this
test.use({
  ...IPAD_MINI_2,
  user: 'judge',
  launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] },
});

test.beforeEach(async ({ page }) => {
  await emulateSafari12(page);
});

/** Attach a screenshot of the window to the report. */
async function shot(page, testInfo, name) {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

/** The box of each element, as the page lays it out. */
const boxOf = (locator) => locator.evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

/** A sheet over the page: its backdrop covers the window, the sheet itself is inside it. */
async function expectOverWindow(page, overlay) {
  const window = page.viewportSize();
  const backdrop = await boxOf(overlay);
  expect(backdrop).toEqual({ x: 0, y: 0, width: window.width, height: window.height });
  const sheet = await boxOf(overlay.locator('.rv-send-sheet'));
  expect(sheet.width).toBeGreaterThan(200);
  expect(sheet.y).toBeGreaterThanOrEqual(0);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(window.height + 1);
}

/** On a judge page: check the team, the round, the members and the robot. */
async function checkTeam(page) {
  await page.locator('.rv-check').nth(0).click();
  await page.locator('.rv-check').nth(1).click();
  await page.locator('.rv-photo-check').nth(0).click();
  await page.locator('.rv-photo-check').nth(1).click();
  await page.locator('button[ng-click="infochecked()"]').click();
}

/** Answer the run's saves here, so the seeded run stays as other tests expect it. */
async function keepRunUnsaved(page, path) {
  const sent = [];
  await page.route(`**/api/runs/${path}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"score": 0}' });
  });
  return sent;
}

test('the line judge page: the tiles, the rescue, the timer and leaving', async ({ page }, testInfo) => {
  const sent = await keepRunUnsaved(page, `line/${ids.runs.Line}`);
  await open(page, `/line/judge/${ids.runs.Line}`);
  // What Safari 12 lacks is stood in for
  await expect(page.locator('html')).toHaveClass(/rv-legacy/);
  await shot(page, testInfo, 'line judge: the checks');
  await checkTeam(page);

  // A tile scored: its status over the whole tile, not only in the corner
  const tile = page.locator('.rv-judge-map .slot').nth(1);
  await tile.locator('tile').click();
  const frame = tile.locator('.rv-tile-frame');
  await expect(frame).toHaveCount(1);
  const frameBox = await boxOf(frame);
  const tileBox = await boxOf(tile);
  expect(Math.abs(frameBox.width - tileBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.height - tileBox.height)).toBeLessThanOrEqual(1);
  // The size of a part of the tile, which the checkpoint folds and the points are given in
  expect(parseFloat(await tile.evaluate((e) => e.style.getPropertyValue('--rv-cqw')))).toBeCloseTo(tileBox.width / 100, 1);
  // The legend's keys apart, as with gap
  const keys = page.locator('.rv-map-legend .rv-key');
  const first = await boxOf(keys.nth(0));
  const second = await boxOf(keys.nth(1));
  expect(second.x - (first.x + first.width)).toBeGreaterThanOrEqual(15);
  await shot(page, testInfo, 'line judge: the map');

  // The rescue sheet opens over the page
  const rescue = page.locator('.rv-overlay', { has: page.locator('.rv-rescue-sheet') });
  await page.locator('.rv-rescue-add').click();
  await expectOverWindow(page, rescue);
  await shot(page, testInfo, 'line judge: the rescue');
  await rescue.locator('.rv-victim-pick').first().click();
  await rescue.locator('.rv-zone-pick.is-green').click();
  await expect(rescue).toBeHidden();
  // Sent with the rescue last (other tests may have saved some to the same run before)
  const rescues = sent.filter((s) => s.rescueOrder).pop().rescueOrder;
  expect(rescues[rescues.length - 1]).toEqual({ victimType: 'LIVE', zoneType: 'GREEN' });

  // The timer is started and stopped from the bar, asked once more on a sheet
  await page.locator('.rv-stat-start').click();
  await page.locator('.rv-stat-stop').click();
  const stop = page.locator('.rv-overlay', { has: page.locator('#rv-stop-title') });
  await expectOverWindow(page, stop);
  // The two answers side by side, apart
  const keep = await boxOf(stop.locator('.rv-stop-keep'));
  const now = await boxOf(stop.locator('.rv-stop-now'));
  expect(now.x - (keep.x + keep.width)).toBeCloseTo(12, 0);
  await shot(page, testInfo, 'line judge: stopping the timer');
  await stop.locator('.rv-stop-now').click();
  await expect(page.locator('.rv-stat-start')).toBeVisible();

  // The run has started: leaving is asked first, and staying keeps the page
  const leave = page.locator('.rv-overlay', { has: page.locator('#rv-leave-title') });
  await page.locator('.rv-back').click();
  await expectOverWindow(page, leave);
  await shot(page, testInfo, 'line judge: leaving');
  await leave.locator('.rv-stop-keep').click();
  await expect(leave).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/line/judge/${ids.runs.Line}`));
  // Left, the time is saved, then the run list
  await page.locator('.rv-back').click();
  await leave.locator('.rv-stop-now').click();
  await expect(page).toHaveURL(new RegExp(`/line/${ids.competition}/`));
  expect(sent[sent.length - 1]).toHaveProperty('time');
});

/** On a maze judge page: the map as tall as its tiles across and down, each tile square. */
async function expectMazeMap(page) {
  const map = page.locator('.rv-mz-map');
  await expect(map).toBeVisible();
  const mapBox = await boxOf(map);
  const tileBox = await boxOf(page.locator('.rv-mz-tile').first());
  expect(tileBox.height).toBeGreaterThan(40);
  expect(Math.abs(tileBox.width - tileBox.height)).toBeLessThanOrEqual(1);
  expect(mapBox.height).toBeGreaterThanOrEqual(tileBox.height - 1);
  const over = page.locator('.rv-mz-over').first();
  // The size of a part of the tile, which the frame and badge are given in
  expect(parseFloat(await over.evaluate((e) => e.style.getPropertyValue('--rv-cqw')))).toBeCloseTo(tileBox.width / 100, 1);
}

test('the maze judge page: the map, its tiles in proportion', async ({ page }, testInfo) => {
  await keepRunUnsaved(page, `maze/${ids.runs.Maze}`);
  await open(page, `/maze/judge/${ids.runs.Maze}`);
  await checkTeam(page);
  await expectMazeMap(page);
  await shot(page, testInfo, 'maze judge: the map');
});

test('the maze entry judge page: the map, and a victim scored on its sheet', async ({ page }, testInfo) => {
  const sent = await keepRunUnsaved(page, `maze/${ids.runs.MazeNL}`);
  await open(page, `/maze/judge/${ids.runs.MazeNL}`);
  await checkTeam(page);
  await expectMazeMap(page);
  await shot(page, testInfo, 'maze entry judge: the map');

  // The tile with the red victim: its items on a sheet inside the window
  await page.locator('.rv-mz-tile').first().click();
  const sheet = page.locator('.rv-maze-modal .rvm');
  await expect(sheet).toBeVisible();
  const box = await boxOf(sheet);
  const window = page.viewportSize();
  expect(box.width).toBeGreaterThan(300);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(window.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(window.height);
  // Found, then identified: the two answers side by side
  const victim = sheet.locator('.rvm-victim').first();
  const [found, identified] = [victim.locator('.rvm-found').nth(0), victim.locator('.rvm-found').nth(1)];
  const foundBox = await boxOf(found);
  const identifiedBox = await boxOf(identified);
  expect(identifiedBox.x).toBeGreaterThan(foundBox.x + foundBox.width);
  // (other tests may have scored it before: each turned on, not toggled)
  for (const button of [found, identified]) {
    if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await shot(page, testInfo, 'maze entry judge: the victim');
  await sheet.locator('.rvm-ok').click();
  await expect(sheet).toBeHidden();
  const tiles = sent.filter((s) => s.tiles).pop().tiles;
  expect(tiles['1,1,0'].scoredItems.victims.floor).toBe(true);
  expect(tiles['1,1,0'].scoredItems.rescueKits.floor).toBeGreaterThan(0);
  // Scored, the tile's status is drawn over the tile: a frame 7% of it in from each side
  const frame = page.locator('.rv-mz-over').first().locator('.rv-mz-frame');
  const frameBox = await boxOf(frame);
  const tileBox = await boxOf(page.locator('.rv-mz-tile').first());
  expect(frameBox.width).toBeCloseTo(tileBox.width * 0.86, 0);
  expect(frameBox.height).toBeCloseTo(tileBox.height * 0.86, 0);
  expect(frameBox.x - tileBox.x).toBeCloseTo(tileBox.width * 0.07, 0);
});

test('the line sign page: a signature written with a finger', async ({ page }, testInfo) => {
  await open(page, `/line/sign/${ids.runs.Line}`);
  await shot(page, testInfo, 'line sign: the page');
  const slot = page.locator('.rv-sign-slot').first();
  await slot.locator('.rv-sign-start').click();
  const overlay = page.locator('.rv-overlay.is-pad');
  await expect(overlay).toBeVisible();
  const pad = page.locator('#rv-pad');
  await touchStroke(page, pad, { x: 40, y: 80 }, { x: 260, y: 40 });
  await shot(page, testInfo, 'line sign: the pad');
  await overlay.locator('.rv-pad-btn.is-done').click();
  await expect(overlay).toBeHidden();
  await expect(slot).toHaveClass(/is-signed/);
});

// The pages laid out as on today's browsers: each element where it is there, within 2px. Each
// page is opened in both, so in contexts of the test's own (the page fixture is the stand-in)
test.describe('the layout as on today\'s browsers', () => {
  // A page, or a page and what is done on it first (after the checks on a judge page)
  const PAGES = {
    'line judge': `/line/judge/${ids.runs.Line}`,
    'maze judge': `/maze/judge/${ids.runs.Maze}`,
    'maze judge, the map turned': [`/maze/judge/${ids.runs.Maze}`, (page) => page.locator('.rv-tool[title="+90°"]').click()],
    'maze entry judge': `/maze/judge/${ids.runs.MazeNL}`,
    'maze entry judge, a tile\'s sheet': [`/maze/judge/${ids.runs.MazeNL}`, async (page) => {
      await page.locator('.rv-mz-tile').first().click();
      await page.locator('.rv-maze-modal .rvm').waitFor();
    }],
    'line sign': `/line/sign/${ids.runs.Line}`,
    'maze sign': `/maze/sign/${ids.runs.Maze}`,
    'maze entry sign': `/maze/sign/${ids.runs.MazeNL}`,
    'line view': `/line/view/${ids.finishedRuns.Line}`,
    'maze view': `/maze/view/${ids.finishedRuns.Maze}`,
    'run list': `/line/${ids.competition}/Line`,
    'maze run list': `/maze/${ids.competition}/Maze`,
    competition: `/home/${ids.competition}`,
  };

  /** Where each element is, by its place in the page, once the judge page has been checked. */
  async function layout(browser, emulated, [path, act]) {
    const context = await browser.newContext({ ...IPAD_MINI_2 });
    const page = await context.newPage();
    await page.request.post('/api/auth/login', { data: { username: 'judge', password: 'judgepass' } });
    await page.route('**/api/runs/**', (route) => (route.request().method() === 'PUT'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"score": 0}' })
      : route.fallback()));
    if (emulated) await emulateSafari12(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (path.includes('/judge/')) await checkTeam(page);
    if (act) await act(page);
    const read = () => page.evaluate(() => {
      const out = {};
      for (const e of document.body.getElementsByTagName('*')) {
        // What is drawn inside an SVG (the tiles' images) is not laid out by the page's CSS
        if (e instanceof SVGElement && e.tagName !== 'svg') continue;
        const r = e.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const path = [];
        for (let x = e; x !== document.body; x = x.parentElement) path.unshift(Array.prototype.indexOf.call(x.parentElement.children, x));
        out[path.join('>')] = { tag: e.tagName, class: String(e.className), box: [r.x, r.y + scrollY, r.width, r.height].map(Math.round) };
      }
      return out;
    });
    // Once it no longer moves (images, fonts and the stand-in's margins come in after the load)
    let boxes = await read();
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(250);
      const again = await read();
      if (JSON.stringify(again) === JSON.stringify(boxes)) break;
      boxes = again;
    }
    await context.close();
    return boxes;
  }

  for (const [name, page] of Object.entries(PAGES)) {
    test(name, async ({ browser }) => {
      const today = await layout(browser, false, [].concat(page));
      const ios12 = await layout(browser, true, [].concat(page));
      const moved = Object.keys(today)
        .filter((k) => !ios12[k] || today[k].box.some((v, i) => Math.abs(v - ios12[k].box[i]) > 2))
        .map((k) => `${today[k].tag}.${today[k].class}: ${today[k].box} -> ${ios12[k] ? ios12[k].box : 'missing'}`);
      expect(moved).toEqual([]);
    });
  }
});

// The whole field in view on a tablet, in either orientation, once the map card is scrolled up to
// the bar: here fields longer than wide (the ones that ran off an upright tablet's window before),
// on the iPad mini 2 and on the 9th-generation iPad, in what their Safari leaves of the screen
test.describe('the whole map in view on a tablet', () => {
  test.use({ user: 'admin' });
  const TABLETS = {
    'iPad mini 2, upright': { viewport: { width: 768, height: 954 }, ios12: true },
    'iPad mini 2, on its side': { viewport: { width: 1024, height: 698 }, ios12: true },
    'iPad 9th generation, upright': { viewport: { width: 810, height: 990 } },
    'iPad 9th generation, on its side': { viewport: { width: 1080, height: 740 } },
  };
  // Tiles across and down
  const FIELDS = { line: [[3, 4], [6, 8], [4, 10], [8, 6]], maze: [[6, 9], [9, 6], [8, 10]] };

  /** A run of a field of plain tiles, w across and l down; its page. */
  async function runOn(request, comp, kind, w, l) {
    const league = kind === 'line' ? 'Line' : 'Maze';
    const team = await api.team(request, comp, league, `${league} ${w}x${l}`);
    const tiles = [];
    let map;
    if (kind === 'line') {
      for (let x = 0; x < w; x++) for (let y = 0; y < l; y++) tiles.push({ x, y, z: 0, rot: 0, tileType: api.PLAIN_LINE, items: { obstacles: 0, speedbumps: 0 } });
      map = await api.post(request, '/api/maps/line', {
        competition: comp, league, name: `${w}x${l}`, tileSet: comp, finished: true, width: w, length: l, height: 1,
        victims: { live: 2, dead: 1 }, startTile: { x: 0, y: 0, z: 0 }, startTile2: { x: -1, y: -1, z: -1 }, tiles,
      });
    } else {
      const wall = (x, y) => ({ x, y, z: 0, isWall: true, isLinear: true });
      for (let x = 1; x < 2 * w; x += 2) {
        for (let y = 1; y < 2 * l; y += 2) tiles.push({ x, y, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: api.NO_VICTIMS } });
        tiles.push(wall(x, 0), wall(x, 2 * l));
      }
      for (let y = 1; y < 2 * l; y += 2) tiles.push(wall(0, y), wall(2 * w, y));
      map = await api.post(request, '/api/maps/maze', {
        competition: comp, league, name: `${w}x${l}`, finished: true, width: w, length: l, height: 1,
        leagueType: 'standard', startTile: { x: 1, y: 1, z: 0 }, cells: tiles,
      });
    }
    const round = await api.round(request, comp, `${kind} ${w}x${l}`);
    const field = await api.field(request, comp, `${kind} ${w}x${l}`);
    return `/${kind}/judge/${await api.run(request, kind, { competition: comp, round, field, team, map })}`;
  }

  test('lines and mazes', async ({ page, browser }) => {
    test.setTimeout(300 * 1000);
    const comp = await api.competition(page.request);
    const pages = [];
    for (const [kind, fields] of Object.entries(FIELDS)) {
      for (const [w, l] of fields) pages.push({ name: `${kind} ${w}x${l}`, path: await runOn(page.request, comp, kind, w, l) });
    }
    const cut = [];
    for (const [tablet, { viewport, ios12 }] of Object.entries(TABLETS)) {
      const context = await browser.newContext({ ...IPAD_MINI_2, viewport });
      const p = await context.newPage();
      await p.request.post('/api/auth/login', { data: { username: 'admin', password: 'adminpass' } });
      if (ios12) await emulateSafari12(p);
      for (const { name, path } of pages) {
        await p.goto(path);
        await p.waitForLoadState('networkidle');
        await checkTeam(p);
        const map = p.locator(name.startsWith('line') ? '#wrapTile' : '.rv-mz-map');
        await expect(map).toBeVisible();
        // Once laid out (the line tiles are sized after the checks)
        await expect.poll(async () => (await boxOf(map)).height).toBeGreaterThan(200);
        const out = await p.evaluate(([selector]) => {
          const map = document.querySelector(selector).getBoundingClientRect();
          const card = document.querySelector('.rv-judge-map').getBoundingClientRect();
          const bar = document.querySelector('.rv-topbar').getBoundingClientRect().bottom;
          return Math.round(bar + (map.bottom - card.top) - innerHeight);
        }, [name.startsWith('line') ? '#wrapTile' : '.rv-mz-map']);
        if (out > 0) cut.push(`${tablet}: ${name}, ${out}px below the window`);
      }
      await context.close();
    }
    expect(cut).toEqual([]);
  });
});
