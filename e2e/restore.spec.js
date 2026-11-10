// A backup file is the user's to give, so it is not taken as it is: restored by the admin of a
// competition (not a super admin), a backup of it made to have a user of super rights, a team of
// another competition and the rights of a user in another competition restores none of them; a
// backup of a competition the user does not administer is not restored over it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const onezip = require('onezip');
const archiver = require('archiver');
const { test, expect } = require('./fixtures');
const api = require('./api');

test.use({ user: 'admin' });
test.setTimeout(120 * 1000);

/** The backup of a competition, as a folder of its files. */
async function backupOf(request, competition) {
  const made = await (await request.post(`/api/backup/${competition}`, { data: { fullBackup: false } })).json();
  await expect.poll(async () => (await (await request.get(`/api/backup/job/${made.jobId}`)).json()).state, { timeout: 30000 }).toBe('completed');
  const [{ name }] = await (await request.get(`/api/backup/list/${competition}`)).json();
  const zip = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rcj-backup-')), name);
  fs.writeFileSync(zip, await (await request.get(`/api/backup/archive/${competition}/${name}`)).body());
  const folder = `${zip}.d`;
  await new Promise((resolve, reject) => onezip.extract(zip, folder).on('end', resolve).on('error', reject));
  fs.rmSync(path.join(__dirname, '..', 'backup', competition), { recursive: true, force: true });
  return folder;
}

/** The folder zipped again, restored as the given request's user; the job as it ends. */
async function restore(request, folder) {
  const zip = `${folder}.zip`;
  await new Promise((resolve, reject) => {
    const archive = archiver('zip');
    archive.pipe(fs.createWriteStream(zip).on('close', resolve));
    archive.on('error', reject);
    archive.directory(folder, false);
    archive.finalize();
  });
  const res = await request.post('/api/backup/restore', {
    multipart: { file: { name: 'backup.cms', mimeType: 'application/zip', buffer: fs.readFileSync(zip) } },
  });
  expect(res.ok()).toBeTruthy();
  const { jobId } = await res.json();
  let job;
  await expect.poll(async () => {
    job = await (await request.get(`/api/backup/job/${jobId}`)).json();
    return job.state;
  }, { timeout: 30000 }).toMatch(/completed|failed/);
  return job;
}

const edit = (folder, file, change) => {
  const at = path.join(folder, `${file}.json`);
  const data = fs.existsSync(at) ? JSON.parse(fs.readFileSync(at, 'utf8')) : [];
  fs.writeFileSync(at, JSON.stringify(change(data)));
};

test('a backup restored by a competition\'s admin brings back that competition only', async ({ page, playwright, baseURL }) => {
  const { request } = page;
  const [own, other] = [await api.competition(request), await api.competition(request)];
  await api.team(request, own, 'Maze', 'Own Team');
  const victimTeam = await api.team(request, other, 'Maze', 'Other Team');
  const stamp = Date.now();
  const chief = { username: `restorer${stamp}`, password: 'pass1234' };
  expect((await request.post('/api/users', { data: { ...chief, admin: true, competitions: [{ id: own, accessLevel: 10, role: ['ADMIN'] }] } })).ok()).toBeTruthy();
  const chiefRequest = await playwright.request.newContext({ baseURL });
  expect((await chiefRequest.post('/api/auth/login', { data: chief })).ok()).toBeTruthy();

  const folder = await backupOf(chiefRequest, own);
  const users = await (await request.get('/api/users')).json();
  const chiefId = users.find((u) => u.username === chief.username)._id;
  // A user of super rights, made up; the restorer given rights in the other competition; the
  // other competition's team taken over
  edit(folder, 'users', (list) => [
    ...list.map((u) => (u._id === chiefId ? { ...u, competitions: [...u.competitions, { id: other, accessLevel: 10, role: ['ADMIN'] }] } : u)),
    { _id: '6ae2aaaaaaaaaaaaaaaaaaaa', username: `intruder${stamp}`, password: 'x', superDuperAdmin: true, admin: true, competitions: [{ id: own, accessLevel: 10 }] },
  ]);
  edit(folder, 'team', (list) => [...list, { _id: victimTeam, competition: other, league: 'Maze', name: 'Taken Over', teamCode: 'X' }]);

  const job = await restore(chiefRequest, folder);
  expect(job.state, job.reason).toBe('completed');
  const after = await (await request.get('/api/users')).json();
  const intruder = after.find((u) => u.username === `intruder${stamp}`);
  expect(intruder.superDuperAdmin).toBe(false);
  expect(after.find((u) => u._id === chiefId).competitions.map((c) => c.id)).not.toContain(other);
  const otherTeams = await (await request.get(`/api/competitions/${other}/Maze/teams`)).json();
  expect(otherTeams.map((t) => t.name)).toEqual(['Other Team']);
  // The competition's own team is there
  expect((await (await request.get(`/api/competitions/${own}/Maze/teams`)).json()).map((t) => t.name)).toEqual(['Own Team']);
  await chiefRequest.dispose();
});

test('a backup of a competition the user does not administer is not restored over it', async ({ page, playwright, baseURL }) => {
  const { request } = page;
  const [own, other] = [await api.competition(request), await api.competition(request, `Kept ${Date.now()}`)];
  const chief = { username: `outsider${Date.now()}`, password: 'pass1234' };
  expect((await request.post('/api/users', { data: { ...chief, admin: true, competitions: [{ id: own, accessLevel: 10, role: ['ADMIN'] }] } })).ok()).toBeTruthy();
  const chiefRequest = await playwright.request.newContext({ baseURL });
  expect((await chiefRequest.post('/api/auth/login', { data: chief })).ok()).toBeTruthy();

  // The backup of its own competition, made out to be the other one
  const folder = await backupOf(chiefRequest, own);
  edit(folder, 'competition', ([competition]) => [{ ...competition, _id: other, name: 'Overwritten' }]);
  const job = await restore(chiefRequest, folder);
  expect(job.state).toBe('failed');
  expect((await (await request.get(`/api/competitions/${other}`)).json()).name).toMatch(/^Kept /);

  // Nor with an id that is not one, which would go into the folders' paths
  edit(folder, 'competition', ([competition]) => [{ ...competition, _id: '../../routes' }]);
  expect((await restore(chiefRequest, folder)).state).toBe('failed');
  await chiefRequest.dispose();
});
