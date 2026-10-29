// What the app gives a browser beyond the API's answers: the live updates of a run tell anyone in
// its room only that it changed (the run is had through the API, as one may see it), and every
// page comes with the headers that keep it on the app's side.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('the room of a run is told it changed, and given nothing of it', async ({ page, browser, baseURL }) => {
  const { request } = page;
  const competition = await api.competition(request);
  const [round, field, team] = await Promise.all([
    api.round(request, competition, 'R1'), api.field(request, competition, 'F1'), api.team(request, competition, 'Line', 'T1'),
  ]);
  const map = await api.lineMap(request, competition, 'Line', 'Live Map');
  const runId = await api.run(request, 'line', { competition, round, field, team, map });

  // Anyone, not logged in, in the run's room
  const visitor = await browser.newContext({ baseURL });
  const watcher = await visitor.newPage();
  await watcher.goto('/home');
  await watcher.addScriptTag({ url: '/socket.io/socket.io.js' });
  await watcher.evaluate((room) => new Promise((resolve) => {
    window.heard = [];
    const socket = io(window.location.origin, { transports: ['websocket'] });
    socket.onAny((event, ...args) => window.heard.push({ event, args }));
    socket.on('connect', () => { socket.emit('subscribe', room); setTimeout(resolve, 300); });
  }), `runs/${runId}`);

  const changed = await request.put(`/api/runs/line/${runId}`, { data: { comment: 'not for the public' } });
  expect(changed.ok(), await changed.text()).toBeTruthy();
  await expect.poll(() => watcher.evaluate(() => window.heard.length)).toBeGreaterThan(0);
  const heard = await watcher.evaluate(() => window.heard);
  expect(heard).toEqual([{ event: 'changed', args: [] }]);
  await visitor.close();
});

test('pages come with the headers that keep them on the app\'s side', async ({ page }) => {
  const headers = (await page.request.get('/home')).headers();
  expect(headers).toMatchObject({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'SAMEORIGIN',
  });
  expect(headers['permissions-policy']).toContain('microphone=()');
  expect(headers['x-powered-by']).toBeUndefined();
  // The views made to be framed by other sites can be
  const ids = require('./ids');
  const iframe = (await page.request.get(`/maze/view/${ids.finishedRuns.Maze}/iframe`)).headers();
  expect(iframe['x-frame-options']).toBeUndefined();
});
