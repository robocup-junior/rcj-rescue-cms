// Every page opens without script errors, console errors or failed requests.
const { test, open } = require('./fixtures');
const ids = require('./ids');

const C = ids.competition;

const PUBLIC_PAGES = [
  '/home',
  '/login',
  `/home/${C}`,
  `/line/${C}/Line`,
  `/line/${C}/LineNL`,
  `/maze/${C}/Maze`,
  `/maze/${C}/MazeNL`,
  `/simulation/${C}/Erebus`,
  `/line/${C}/Line/ranking`,
  `/maze/${C}/Maze/ranking`,
  `/simulation/${C}/Erebus/ranking`,
  `/line/view/${ids.finishedRuns.Line}`,
  `/maze/view/${ids.finishedRuns.Maze}`,
  `/simulation/view/${ids.finishedRuns.Erebus}`,
  '/service',
  '/service/editor/line/2026',
  '/service/editor/maze/2026',
];

const JUDGE_PAGES = [
  `/home/${C}/teams`,
  `/line/judge/${ids.runs.Line}`,
  `/line/input/${ids.runs.Line}`,
  `/maze/judge/${ids.runs.Maze}`,
  `/maze/input/${ids.runs.Maze}`,
  `/simulation/judge/${ids.runs.Erebus}`,
  `/document/assigned/${C}`,
];

const ADMIN_PAGES = [
  '/admin',
  '/admin/user',
  '/admin/short',
  '/admin/restore',
  '/admin/mailTemplates',
  '/admin/line/tilesets',
  `/admin/${C}`,
  `/admin/${C}/teams`,
  `/admin/${C}/teams/bulk`,
  `/admin/${C}/settings`,
  `/admin/${C}/backup`,
  `/admin/${C}/rounds`,
  `/admin/${C}/fields`,
  `/admin/${C}/documents`,
  `/admin/${C}/mails`,
  `/admin/${C}/registration`,
  `/admin/${C}/reservation`,
  `/admin/${C}/cabinet`,
  `/admin/${C}/survey`,
  ...['Line', 'Maze', 'Erebus'].flatMap((league) => [
    `/admin/${C}/${league}/games`,
    `/admin/${C}/${league}/games/print`,
    `/admin/${C}/${league}/games/ranking`,
    `/admin/${C}/${league}/games/bulk`,
  ]),
  // Simulation has no maps
  `/admin/${C}/Line/maps`,
  `/admin/${C}/Maze/maps`,
  `/admin/${C}/Line/mapEditor`,
  `/admin/${C}/Line/mapEditor/${ids.maps.Line}`,
  `/admin/${C}/Maze/mapEditor`,
  `/admin/${C}/Maze/mapEditor/${ids.maps.Maze}`,
  `/signage/setting`,
  `/signage/games/${C}/`,
];

test.describe('public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(path, async ({ page }) => {
      await open(page, path);
    });
  }
});

test.describe('judge pages', () => {
  test.use({ user: 'judge' });
  for (const path of JUDGE_PAGES) {
    test(path, async ({ page }) => {
      await open(page, path);
    });
  }
});

test.describe('admin pages', () => {
  test.use({ user: 'admin' });
  for (const path of ADMIN_PAGES) {
    test(path, async ({ page }) => {
      await open(page, path);
    });
  }
});
