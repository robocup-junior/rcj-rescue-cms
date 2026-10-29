// Files people put in: their names in the API's paths stay in their folders (a name that climbs
// out with ../ reads or removes nothing outside, whether given by a team with its token, a
// reviewer, or an admin; the folders it would climb out of are made as the app makes them), and a
// file that a browser would run as a page is not run from the app's origin.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');
const ids = require('./ids');

test.use({ user: 'admin' });

const ROOT = path.join(__dirname, '..');
const C = ids.competition;
const TEAM = ids.teams.Maze;
const folders = [`backup/${C}`, `cabinet/${C}/Maze`, `cabinet/${C}/${TEAM}`, `documents/${C}/${TEAM}/review`];
const made = [];

test.beforeAll(() => {
  for (const folder of folders) {
    if (!fs.existsSync(path.join(ROOT, folder))) made.push(folder);
    fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
  }
});

test.afterAll(() => {
  for (const folder of made.reverse()) fs.rmSync(path.join(ROOT, folder), { recursive: true, force: true });
});

/** n folders up, the slashes encoded once or twice (as the cabinet decodes its names again). */
const up = (n, slash) => `..${slash}`.repeat(n);

test('files are not read from outside their folders', async ({ page, browser, baseURL }) => {
  // Each from its folder to the app's: backup/<competition>, cabinet/<competition>/<league>, the
  // reviewer's folder documents/<competition>/<team>/review/<name>
  const reads = (slash) => [
    `/api/backup/archive/${C}/${up(2, slash)}package.json`,
    `/api/cabinet/${C}/file/x/x/Maze/${up(3, slash)}package.json`,
    `/api/document/review/files/${TEAM}/${up(4, slash).slice(0, -slash.length)}/package.json`,
  ];
  // A team, not logged in, with the token of its own pages
  const team = await browser.newContext({ baseURL });
  for (const slash of ['%2F', '%252F']) {
    for (const url of reads(slash)) {
      const res = await page.request.get(url);
      expect(await res.text(), url).not.toContain('"rcj-scoring"');
    }
    const url = `/api/cabinet/${C}/file/${TEAM}/tokenM01/Maze/${up(3, slash)}package.json`;
    expect(await (await team.request.get(url)).text(), url).not.toContain('"rcj-scoring"');
  }
  await team.close();
  page.allowErrors(/HTTP 40\d/);
});

test('files are not removed from outside their folders', async ({ page }) => {
  // A file of the app's own, outside the signage contents and the cabinets
  fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
  const canary = path.join(ROOT, 'tmp', `e2e-canary-${Date.now()}.txt`);
  fs.writeFileSync(canary, 'keep me');
  const name = path.basename(canary);
  try {
    for (const slash of ['%2F', '%252F']) {
      await page.request.delete(`/api/signage/contentList/${up(2, slash)}tmp${slash}${name}`);
      await page.request.delete(`/api/cabinet/${C}/file/Maze/${up(3, slash)}tmp${slash}${name}`);
      await page.request.delete(`/api/backup/archive/${C}/${up(2, slash)}tmp${slash}${name}`);
    }
    expect(fs.existsSync(canary)).toBeTruthy();
  } finally {
    fs.rmSync(canary, { force: true });
  }
});

test('a page put in by a team is given to be saved, not shown as a page of the app', async ({ page }) => {
  const upload = async (name, mimeType, content) => {
    const res = await page.request.post(`/api/document/files/usercontent/${TEAM}/tokenM01`, {
      multipart: { image: { name, mimeType, buffer: Buffer.from(content) } },
    });
    expect(res.ok()).toBeTruthy();
    return (await res.json()).url;
  };
  for (const [name, type] of [['page.html', 'text/html'], ['drawing.svg', 'image/svg+xml']]) {
    const res = await page.request.get(await upload(name, type, '<script>parent.hacked = true</script>'));
    expect(res.headers()['content-disposition'], name).toMatch(/^attachment/);
    expect(res.headers()['content-security-policy'], name).toBe('sandbox');
    expect(res.headers()['x-content-type-options'], name).toBe('nosniff');
  }
  // A picture is shown as it is
  const picture = await page.request.get(await upload('photo.png', 'image/png', '\x89PNG'));
  expect(picture.headers()['content-type']).toBe('image/png');
  expect(picture.headers()['content-disposition']).toBeUndefined();
  fs.rmSync(path.join(ROOT, 'documents', C, TEAM, 'usercontent'), { recursive: true, force: true });
});
