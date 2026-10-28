// Who may do what through the API. A competition with a round, a field, teams, maps and runs of each
// kind; then each request is made by everyone who is not allowed to — someone not logged in, a viewer
// and a judge of the competition, the admin of another competition — and must be refused, leaving the
// data as it was; then by those who are, which it must not refuse (so that the refusals are not down
// to a request the API would not take anyway).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');
const api = require('./api');

const ADMIN = 10;
const JUDGE = 5;
const VIEW = 1;

/** Everyone who may be refused, and those who are allowed; super is the super admin. */
const ROLES = ['anonymous', 'viewer', 'judge', 'otherAdmin', 'admin', 'super'];

const fx = {};
const as = {};

test.beforeAll(async ({ playwright, baseURL }) => {
  const root = await playwright.request.newContext({ baseURL });
  await api.login(root);
  fx.competition = await api.competition(root);
  fx.other = await api.competition(root);
  const c = fx.competition;
  [fx.round, fx.field, fx.mazeTeam, fx.lineTeam, fx.simTeam] = await Promise.all([
    api.round(root, c, 'R1'), api.field(root, c, 'F1'),
    api.team(root, c, 'Maze', 'Maze Team'), api.team(root, c, 'Line', 'Line Team'), api.team(root, c, 'Erebus', 'Sim Team'),
  ]);
  fx.mazeMap = await api.mazeMap(root, c, 'Maze', 'Maze Map', [{}, { checkpoint: true }]);
  const tileType = (await (await root.get('/api/maps/line/tiletypes')).json())[0]._id;
  fx.lineMap = await lineMap(root, c, tileType);
  fx.tileType = tileType;
  const refs = { competition: c, round: fx.round, field: fx.field };
  fx.mazeRun = await api.run(root, 'maze', { ...refs, team: fx.mazeTeam, map: fx.mazeMap });
  fx.lineRun = await api.run(root, 'line', { ...refs, team: fx.lineTeam, map: fx.lineMap });
  fx.simRun = await api.run(root, 'simulation', { ...refs, team: fx.simTeam });

  // The people, each logged in on a context of their own
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = async (name, admin, competitions) => {
    const username = `${name}${stamp}`;
    const res = await root.post('/api/users', { data: { username, password: 'pass1234', admin, competitions } });
    expect(res.ok(), `user ${name}`).toBeTruthy();
    const users = await (await root.get('/api/users')).json();
    return { username, password: 'pass1234', id: users.find((u) => u.username === username)._id };
  };
  const people = {
    viewer: await user('viewer', false, [{ id: c, accessLevel: VIEW, role: ['VIEW'] }]),
    judge: await user('judge', false, [{ id: c, accessLevel: JUDGE, role: ['JUDGE'] }]),
    otherAdmin: await user('otheradmin', true, [{ id: fx.other, accessLevel: ADMIN, role: ['ADMIN'] }]),
    admin: await user('admin', true, [{ id: c, accessLevel: ADMIN, role: ['ADMIN'] }]),
    // Whose rights are changed by the requests that change them
    subject: await user('subject', false, []),
  };
  fx.users = people;
  for (const role of ROLES) {
    as[role] = await playwright.request.newContext({ baseURL });
    if (role === 'super') await api.login(as[role]);
    else if (role !== 'anonymous') {
      const { username, password } = people[role];
      expect((await as[role].post('/api/auth/login', { data: { username, password } })).ok(), `login as ${role}`).toBeTruthy();
    }
  }
  as.root = root;
});

test.afterAll(async () => {
  for (const context of Object.values(as)) await context.dispose();
  // The backups' folder of the competition removed at the end is kept, for it to be restored
  fs.rmSync(path.join(__dirname, '..', 'backup', fx.competition), { recursive: true, force: true });
});

/** A line map of one tile in the competition; its id. */
async function lineMap(request, competition, tileType, name = `Line Map ${Math.random()}`) {
  const res = await request.post('/api/maps/line', {
    data: {
      competition, league: 'Line', name, tileSet: competition, finished: true,
      width: 1, length: 1, height: 1, victims: { live: 2, dead: 1 },
      startTile: { x: 0, y: 0, z: 0 }, startTile2: { x: -1, y: -1, z: -1 },
      tiles: [{ x: 0, y: 0, z: 0, rot: 0, tileType, items: { obstacles: 0, speedbumps: 0 } }],
    },
  });
  expect(res.status(), await res.text()).toBeLessThan(300);
  return (await res.json()).id;
}

/** A run of its own to be removed, in a round of its own (a team has one run in a round). */
async function spareRun(kind, team, map) {
  const round = await api.round(as.root, fx.competition, `Spare ${Math.random()}`);
  return api.run(as.root, kind, { competition: fx.competition, round, field: fx.field, team, ...(map ? { map } : {}) });
}

/**
 * The requests. allow: who may make it (the super admin may do anything, and is added); make(): the
 * request's method, path and data, made once for the whole case (a thing to be removed is made
 * there); kept(): what must still hold after the refusals.
 */
const cases = [
  // The competition
  {
    name: 'change the competition', allow: ['admin'],
    make: () => ['put', `/api/competitions/${fx.competition}`, { name: `Renamed ${Math.random()}` }],
  },
  { name: 'read its registration settings', allow: ['admin'], make: () => ['get', `/api/competitions/${fx.competition}/registration`] },
  { name: 'read its teams with their contacts', allow: ['admin'], make: () => ['get', `/api/competitions/${fx.competition}/adminTeams`] },
  { name: 'read its teams\' documents settings', allow: ['admin'], make: () => ['get', `/api/competitions/${fx.competition}/teams/documents`] },

  // Rounds and fields
  { name: 'add a round', allow: ['admin'], make: () => ['post', '/api/rounds', { competition: fx.competition, name: `Round ${Math.random()}` }] },
  {
    name: 'remove a round', allow: ['admin'],
    make: async () => ['delete', `/api/rounds/${await api.round(as.root, fx.competition, `Gone ${Math.random()}`)}`],
  },
  { name: 'add a field', allow: ['admin'], make: () => ['post', '/api/fields', { competition: fx.competition, name: `Field ${Math.random()}` }] },
  {
    name: 'remove a field', allow: ['admin'],
    make: async () => ['delete', `/api/fields/${await api.field(as.root, fx.competition, `Gone ${Math.random()}`)}`],
  },

  // Teams
  {
    name: 'add a team', allow: ['admin'],
    make: () => ['post', '/api/teams', { competition: fx.competition, league: 'Maze', name: `Team ${Math.random()}`, teamCode: 'T' }],
  },
  {
    name: 'add teams in bulk', allow: ['admin'],
    make: () => ['post', '/api/teams/bulk', [{ competition: fx.competition, league: 'Maze', name: `Bulk ${Math.random()}`, teamCode: 'B' }]],
  },
  { name: 'change a team', allow: ['judge', 'admin'], make: () => ['put', `/api/teams/${fx.competition}/${fx.mazeTeam}`, { checkin: true }] },
  {
    name: 'remove a team', allow: ['admin'],
    make: async () => ['delete', `/api/teams/${await api.team(as.root, fx.competition, 'Maze', `Gone ${Math.random()}`)}`],
  },
  { name: 'set a team\'s code', allow: ['admin'], make: () => ['get', `/api/teams/set/${fx.mazeTeam}/NEW1`] },

  // Maps
  {
    name: 'add a maze map', allow: ['admin'],
    make: () => ['post', '/api/maps/maze', {
      competition: fx.competition, league: 'Maze', name: `Maze ${Math.random()}`, width: 1, length: 1, height: 1,
      startTile: { x: 1, y: 1, z: 0 }, cells: [{ x: 1, y: 1, z: 0, isTile: true, tile: { victims: api.NO_VICTIMS } }],
    }],
  },
  {
    name: 'change a maze map', allow: ['admin'],
    make: async () => ['put', `/api/maps/maze/${fx.mazeMap}`, { ...(await map('maze', fx.mazeMap)), name: `Changed ${Math.random()}` }],
  },
  { name: 'read a maze map\'s full marks', allow: ['admin'], make: () => ['get', `/api/maps/maze/${fx.mazeMap}/maxScore`] },
  {
    name: 'remove a maze map', allow: ['admin'],
    make: async () => ['delete', `/api/maps/maze/${await api.mazeMap(as.root, fx.competition, 'Maze', `Gone ${Math.random()}`, [{}])}`],
  },
  { name: 'add a line map', allow: ['admin'], make: () => ['post', '/api/maps/line', lineMapData()] },
  { name: 'change a line map', allow: ['admin'], make: async () => ['put', `/api/maps/line/${fx.lineMap}`, { ...(await map('line', fx.lineMap)), name: `Changed ${Math.random()}` }] },
  { name: 'read a line map\'s full marks', allow: ['admin'], make: () => ['get', `/api/maps/line/${fx.lineMap}/maxScore`] },
  {
    name: 'remove a line map', allow: ['admin'],
    make: async () => ['delete', `/api/maps/line/${await lineMap(as.root, fx.competition, fx.tileType)}`],
  },

  // Runs: judged by the judges, made and removed by the admins
  ...['maze', 'line', 'simulation'].map((kind) => ({
    name: `add a ${kind} run`, allow: ['admin'],
    make: async () => ['post', `/api/runs/${kind}`, {
      competition: fx.competition, round: await api.round(as.root, fx.competition, `New ${Math.random()}`), field: fx.field,
      team: { maze: fx.mazeTeam, line: fx.lineTeam, simulation: fx.simTeam }[kind],
      ...(kind === 'simulation' ? {} : { map: kind === 'maze' ? fx.mazeMap : fx.lineMap }),
    }],
  })),
  {
    name: 'judge a maze run', allow: ['judge', 'admin'],
    make: () => ['put', `/api/runs/maze/${fx.mazeRun}`, { LoPs: 1, misidentification: 1 }],
    kept: async () => expect(await stored('maze', fx.mazeRun)).toMatchObject({ LoPs: 0, misidentification: 0 }),
  },
  {
    name: 'judge a line run', allow: ['judge', 'admin'],
    make: () => ['put', `/api/runs/line/${fx.lineRun}`, { exitBonus: true }],
    kept: async () => expect(await stored('line', fx.lineRun)).toMatchObject({ exitBonus: false }),
  },
  {
    name: 'judge a simulation run', allow: ['judge', 'admin'],
    make: () => ['put', `/api/runs/simulation/${fx.simRun}`, { score: 99 }],
    kept: async () => expect(await stored('simulation', fx.simRun)).toMatchObject({ score: 0 }),
  },
  { name: 'change the map of a maze run', allow: ['judge', 'admin'], make: () => ['put', `/api/runs/maze/map/${fx.mazeRun}`, { map: fx.mazeMap }] },
  ...['maze', 'line', 'simulation'].map((kind) => ({
    name: `change ${kind} runs in bulk`, allow: ['admin'],
    make: () => ['put', `/api/runs/${kind}/bulk`, [{ _id: { maze: fx.mazeRun, line: fx.lineRun, simulation: fx.simRun }[kind], comment: 'bulk' }]],
  })),
  ...['maze', 'line', 'simulation'].map((kind) => ({
    name: `remove a ${kind} run`, allow: ['admin'],
    make: async () => {
      const team = { maze: fx.mazeTeam, line: fx.lineTeam, simulation: fx.simTeam }[kind];
      const map = { maze: fx.mazeMap, line: fx.lineMap }[kind];
      return ['delete', `/api/runs/${kind}/${await spareRun(kind, team, map)}`];
    },
  })),

  // People's rights
  {
    name: 'give someone a level in the competition', allow: ['admin'],
    make: () => ['put', `/api/users/${fx.users.subject.id}/${fx.competition}/${ADMIN}`],
    kept: async () => expect(await levelOf(fx.users.subject.id)).toBeUndefined(),
  },
  {
    name: 'give someone a role in the competition', allow: ['admin'],
    make: () => ['put', `/api/users/${fx.users.subject.id}/${fx.competition}/role`, ['ADMIN']],
  },
  {
    name: 'make a user', allow: [],
    make: () => ['post', '/api/users', { username: `made${Math.random()}`, password: 'pass1234', superDuperAdmin: true }],
  },
  {
    name: 'change a user', allow: [],
    make: () => ['put', `/api/users/${fx.users.subject.id}`, { superDuperAdmin: true }],
  },
  { name: 'list the short URLs', allow: [], make: () => ['get', '/api/short'] },

  // Backups, mails, bookings, surveys, reviews
  { name: 'back the competition up', allow: ['admin'], make: () => ['post', `/api/backup/${fx.competition}`, { fullBackup: false }] },
  { name: 'list its backups', allow: ['admin'], make: () => ['get', `/api/backup/list/${fx.competition}`] },
  {
    // To the team's own address, whatever the request says
    name: 'mail a team', allow: ['admin'],
    make: () => ['post', '/api/mail/send', {
      data: [{ _id: fx.mazeTeam, competition: fx.other, email: ['someone@example.com'], mailData: { title: 'Hello', content: '<p>Hello</p>' } }],
    }],
  },
  { name: 'read its sent mails', allow: ['admin'], make: () => ['get', `/api/mail/sent/${fx.competition}`] },
  { name: 'read its bookings', allow: ['admin'], make: () => ['get', `/api/reservation/config/${fx.competition}`] },
  { name: 'read its surveys', allow: ['admin'], make: () => ['get', `/api/survey/list/${fx.competition}`] },
  { name: 'read its reviews', allow: ['admin'], make: () => ['get', `/api/document/reviews/${fx.competition}`] },
  { name: 'read its review status', allow: ['admin'], make: () => ['get', `/api/document/${fx.competition}/reviewStatus`] },
  { name: 'read its technical challenge recovery', allow: ['admin'], make: () => ['get', `/api/technicalChallenge/recovery/${fx.competition}`] },
  { name: 'read its documents ranking', allow: ['admin'], make: () => ['get', `/api/ranking/${fx.competition}/Maze/document`] },

  // Last: the competition itself removed
  {
    name: 'remove the competition', allow: ['admin'],
    make: () => ['delete', `/api/competitions/${fx.competition}`],
    kept: async () => expect((await as.root.get(`/api/competitions/${fx.competition}`)).ok()).toBeTruthy(),
  },
];

function lineMapData() {
  return {
    competition: fx.competition, league: 'Line', name: `Line ${Math.random()}`, tileSet: fx.competition, finished: true,
    width: 1, length: 1, height: 1, victims: { live: 2, dead: 1 },
    startTile: { x: 0, y: 0, z: 0 }, startTile2: { x: -1, y: -1, z: -1 },
    tiles: [{ x: 0, y: 0, z: 0, rot: 0, tileType: fx.tileType, items: { obstacles: 0, speedbumps: 0 } }],
  };
}

/** A map as the editor has it, to be saved back. */
async function map(kind, id) {
  const { _id, __v, competition, ...rest } = await (await as.root.get(`/api/maps/${kind}/${id}`)).json();
  return rest;
}

async function stored(kind, id) {
  return (await as.root.get(`/api/runs/${kind}/${id}`)).json();
}

async function levelOf(userId) {
  const users = await (await as.root.get('/api/users')).json();
  const entry = users.find((u) => u._id === userId).competitions.find((c) => c.id === fx.competition);
  return entry && entry.accessLevel;
}

async function send(role, [method, path, data]) {
  const res = await as[role][method](path, data === undefined ? {} : { data });
  return { status: res.status(), body: (await res.text()).slice(0, 200) };
}

for (const c of cases) {
  test(`only ${[...new Set(['super', ...c.allow])].join(', ')} may ${c.name}`, async () => {
    const request = await c.make();
    const allowed = new Set(['super', ...c.allow]);
    for (const role of ROLES.filter((r) => !allowed.has(r))) {
      const { status, body } = await send(role, request);
      expect([400, 401, 403, 404], `${role}: ${status} ${body}`).toContain(status);
    }
    if (c.kept) await c.kept();
    // Allowed, the request goes through (once: the first allowed is enough for a removal)
    const { status, body } = await send(c.allow[0] || 'super', request);
    expect(status, `${c.allow[0] || 'super'}: ${body}`).toBeLessThan(300);
  });
}
