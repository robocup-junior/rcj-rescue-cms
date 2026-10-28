// Bulk registration from CSV files, as the downloadable templates have them: teams, then runs of
// those teams, each file shown before it is taken in.
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

const csv = (name, rows) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(rows.map((r) => r.join(',')).join('\r\n') + '\r\n') });

test('teams, then their runs, are registered from CSV files', async ({ page }) => {
  const { request } = page;
  const competition = await api.competition(request);
  await Promise.all([api.round(request, competition, 'Qualifier'), api.field(request, competition, 'Arena')]);
  await api.mazeMap(request, competition, 'Maze', 'Bulk Map', [{}, { checkpoint: true }]);

  // Teams: the template's columns
  await open(page, `/admin/${competition}/teams/bulk`);
  await page.locator('input[type=file]').setInputFiles(csv('teams.csv', [
    ['TeamCode', 'TeamName', 'Region', 'League', 'Email'],
    ['B01', 'Bulk One', 'Japan', 'Maze', 'one@example.com'],
    ['B02', 'Bulk Two', 'Korea', 'Maze', 'two@example.com'],
  ]));
  await expect(page.getByText('Bulk Two')).toBeVisible();
  await page.locator('button[ng-click="addBulkTeam()"]').click();
  await expect.poll(async () => (await (await request.get(`/api/competitions/${competition}/Maze/teams`)).json()).map((t) => t.name).sort())
    .toEqual(['Bulk One', 'Bulk Two']);
  const teams = await (await request.get(`/api/competitions/${competition}/Maze/teams`)).json();
  expect(teams.find((t) => t.name == 'Bulk One')).toMatchObject({ teamCode: 'B01', country: 'Japan' });

  // Their runs: by the names of the round, team, map and field
  await open(page, `/admin/${competition}/Maze/games/bulk`);
  await page.locator('input[type=file]').setInputFiles(csv('runs.csv', [
    ['Round', 'Team name', 'Map name', 'Field name', 'Start Time', 'Normalization Group ID'],
    ['Qualifier', 'Bulk One', 'Bulk Map', 'Arena', '2026/07/01 10:00', 'A'],
    ['Qualifier', 'Bulk Two', 'Bulk Map', 'Arena', '2026/07/01 10:10', 'A'],
  ]));
  await expect(page.getByText('Bulk Two').last()).toBeVisible();
  await page.locator('button[ng-click="addRun()"]').click();
  await expect.poll(async () => (await (await request.get(`/api/runs/maze/competition/${competition}`)).json()).length).toBe(2);
  const runs = await (await request.get(`/api/runs/maze/competition/${competition}`)).json();
  expect(runs.map((r) => r.team.name).sort()).toEqual(['Bulk One', 'Bulk Two']);
  expect(runs.every((r) => r.round.name == 'Qualifier' && r.field.name == 'Arena' && r.normalizationGroup == 'A')).toBeTruthy();

  // Listed on the league's runs
  await open(page, `/admin/${competition}/Maze/games`);
  await expect(page.locator('tr[ng-repeat]', { hasText: 'Bulk One' }).first()).toBeVisible();
  await expect(page.locator('tr[ng-repeat]', { hasText: 'Bulk Two' }).first()).toBeVisible();
});
