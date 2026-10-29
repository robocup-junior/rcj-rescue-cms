// Backing up a competition and restoring it: the backup made on its page (a job of the backup
// queue), downloaded; the competition removed, then restored from that file on the restore page,
// with its teams; the backup removed.
const fs = require('fs');
const { test, expect, open } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });

test('a competition is backed up, downloaded, and restored from the file once removed', async ({ page }) => {
  test.setTimeout(90 * 1000);
  const { request } = page;
  const name = `Backed Up ${Date.now()}`;
  const competition = await api.competition(request, name);
  await api.team(request, competition, 'Maze', 'Kept Team', 'K1');

  // Made on the competition's page, and listed once the job is done
  await open(page, `/admin/${competition}/backup`);
  await page.locator('button[ng-click="exeBackup(false)"]').click();
  await expect(page.locator('.swal2-popup.swal2-icon-success, .swal2-popup:has(.swal2-success)')).toBeVisible({ timeout: 30 * 1000 });
  await page.locator('.swal2-confirm').click();
  const backup = page.locator('tr[ng-repeat^="back in backedup"]');
  await expect(backup).toHaveCount(1);

  // Downloaded (from a tab opened for it, as the page that opened it has it)
  const [download] = await Promise.all([page.waitForEvent('download'), backup.locator('[ng-click="download(back.name)"]').click()]);
  const file = await download.path();
  expect(fs.statSync(file).size).toBeGreaterThan(0);

  // The competition removed, then restored from the file
  expect((await request.delete(`/api/competitions/${competition}`)).ok()).toBeTruthy();
  await open(page, '/admin/restore');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.cms', mimeType: 'application/zip', buffer: fs.readFileSync(file) });
  await expect.poll(async () => (await (await request.get('/api/competitions')).json()).map((c) => c.name), { timeout: 30 * 1000 })
    .toContain(name);
  const teams = await (await request.get(`/api/competitions/${competition}/Maze/teams`)).json();
  expect(teams.map((t) => t.name)).toEqual(['Kept Team']);

  // The backup removed, once DELETE is typed in
  await open(page, `/admin/${competition}/backup`);
  await backup.locator('[ng-click="delete(back.name)"]').click();
  await page.locator('.swal2-input').fill('DELETE');
  await page.locator('.swal2-confirm').click();
  await expect(backup).toHaveCount(0);
});
