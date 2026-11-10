// Every page opens without script errors, console errors or failed requests,
// and its layout holds up on a PC and on a phone.
const { test, expect, open } = require('./fixtures');
const { findLayoutProblems } = require('./layout');
const ids = require('./ids');

const PHONE = { width: 390, height: 844 };
// Tools made for a PC or for paper, and views embedded at the size their page gives them, which
// are not checked at phone width
const PC_ONLY = [/\/mapEditor/, /^\/service\/editor\//, /\/games\/(print|ranking)$/, /\/iframe$/];

/** Open the page and check its layout at the default (PC) width, then at phone width. */
async function checkPage(page, path) {
  await open(page, path);
  expect.soft(await findLayoutProblems(page), 'layout on a PC').toEqual([]);
  if (PC_ONLY.some((re) => re.test(path))) return;
  await page.setViewportSize(PHONE);
  // Let resize handlers (e.g. map tile sizes) run
  await page.waitForTimeout(300);
  expect.soft(await findLayoutProblems(page), 'layout on a phone').toEqual([]);
}

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
  '/service/editor/simulation/2026/classic',
  `/line/view/${ids.finishedRuns.Line}/iframe`,
  `/maze/view/${ids.finishedRuns.Maze}/iframe`,
  `/registration/${C}/Maze`,
];

const JUDGE_PAGES = [
  `/home/${C}/teams`,
  `/line/judge/${ids.runs.Line}`,
  `/line/input/${ids.runs.Line}`,
  `/line/sign/${ids.runs.Line}`,
  `/maze/judge/${ids.runs.Maze}`,
  `/maze/input/${ids.runs.Maze}`,
  `/maze/sign/${ids.runs.Maze}`,
  `/maze/judge/${ids.runs.MazeNL}`,
  `/maze/sign/${ids.runs.MazeNL}`,
  `/simulation/judge/${ids.runs.Erebus}`,
  `/document/assigned/${C}`,
  `/line/check/${ids.runs.Line}`,
  `/maze/check/${ids.runs.Maze}`,
  `/simulation/sign/${ids.runs.Erebus}`,
  `/maze/${C}/Maze/technicalChallenge`,
  `/signage/clock/${C}`,
  `/signage/field/${C}/${ids.field}`,
];

const ADMIN_PAGES = [
  // The entry leagues are not disclosed, so their runs are checked as staff
  `/line/view/${ids.finishedRuns.LineNL}`,
  `/line/sign/${ids.finishedRuns.LineNL}`,
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
  '/signage/setting/editor',
  '/signage/setting/files',
  '/admin/mailTemplates/editor',
  `/admin/${C}/mails/sent`,
  `/admin/${C}/documents/teams`,
  `/admin/${C}/documents/reviewStatus`,
  `/admin/${C}/documents/Maze/results`,
  `/admin/${C}/documents/Maze/form`,
  `/admin/${C}/documents/Maze/review`,
  `/admin/${C}/documents/Maze/preview`,
  `/admin/${C}/reservation/edit`,
  `/admin/${C}/survey/edit`,
  `/admin/${C}/cabinet/Maze`,
  `/admin/${C}/cabinet/${ids.teams.Maze}`,
  `/admin/${C}/LineNL/maps`,
  `/admin/${C}/MazeNL/maps`,
  `/admin/${C}/LineNL/mapEditor/${ids.maps.LineNL}`,
  `/admin/${C}/MazeNL/mapEditor/${ids.maps.MazeNL}`,
  `/maze/view/${ids.runs.MazeNL}`,
  `/maze/sign/${ids.runs.MazeNL}`,
];

test.describe('public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(path, async ({ page }) => {
      await checkPage(page, path);
    });
  }
});

test.describe('judge pages', () => {
  test.use({ user: 'judge' });
  for (const path of JUDGE_PAGES) {
    test(path, async ({ page }) => {
      await checkPage(page, path);
    });
  }
});

test.describe('admin pages', () => {
  test.use({ user: 'admin' });
  for (const path of ADMIN_PAGES) {
    test(path, async ({ page }) => {
      await checkPage(page, path);
    });
  }
});
