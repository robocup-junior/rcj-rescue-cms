// Run lifecycle through the APIs, with the same login/admin guards as app.js:
// creating runs, who can see them, score adjustments and deleting them.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');
const { startApi, guarded } = require('./helpers/api');
const { ACCESSLEVELS } = require('../models/user');

let models;
const apis = {};

before(async () => {
  await db.start();
  const competition = require('../models/competition');
  const { mazeRun } = require('../models/mazeRun');
  const { mazeMap } = require('../models/mazeMap');
  const { lineMap, tileType } = require('../models/lineMap');
  const { lineRun } = require('../models/lineRun');
  models = { ...competition, mazeRun, mazeMap, lineMap, tileType, lineRun };
  apis.maze = await startApi('/api/runs/maze', guarded(require('../routes/api/mazeRuns')));
  apis.line = await startApi('/api/runs/line', guarded(require('../routes/api/lineRuns')));
  await db.waitFor(() => tileType.findOne({ gaps: { $gt: 0 } }).lean());
});

after(async () => {
  for (const api of Object.values(apis)) await api.close();
  await db.stop();
});

const staff = (comp, accessLevel) => ({
  superDuperAdmin: false,
  admin: accessLevel >= ACCESSLEVELS.ADMIN,
  competitions: [{ id: comp._id, accessLevel, role: [] }],
});

/** A competition with a round and field, and users with different rights. */
async function setup() {
  const comp = await models.competition.create({
    name: `life-${Math.random()}`,
    preparation: false,
    leagues: [{ league: 'Maze', rule: '2026' }, { league: 'Line', rule: '2026' }],
  });
  const other = await models.competition.create({ name: `other-${Math.random()}`, leagues: [] });
  const [round, field] = await Promise.all([
    models.round.create({ competition: comp._id, name: 'R1' }),
    models.field.create({ competition: comp._id, name: 'F1' }),
  ]);
  let teamCount = 0;
  return {
    comp,
    /** References for a new run; each run gets its own team since a team has one run per round. */
    async refs(league) {
      const team = await models.team.create({ competition: comp._id, name: `T${++teamCount}`, league });
      return { competition: comp._id, round: round._id, field: field._id, team: team._id };
    },
    users: {
      admin: staff(comp, ACCESSLEVELS.ADMIN),
      judge: staff(comp, ACCESSLEVELS.JUDGE),
      otherAdmin: staff(other, ACCESSLEVELS.ADMIN),
    },
  };
}

async function createMazeMap(comp) {
  const noVictims = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };
  const map = await models.mazeMap.create({
    competition: comp._id, league: 'Maze', name: `maze-${Math.random()}`, finished: true,
    width: 1, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [{ x: 1, y: 1, z: 0, tile: { victims: noVictims } }],
  });
  return map._id;
}

async function lineTileTypes() {
  const [plain, gap] = await Promise.all([
    models.tileType.findOne({ gaps: 0, intersections: 0, seesaw: 0 }).lean(),
    models.tileType.findOne({ gaps: { $gt: 0 }, intersections: 0 }).lean(),
  ]);
  return { plain, gap };
}

/** A minimal finished line map with a gap on the second tile. */
async function createLineMap(comp) {
  const { plain, gap } = await lineTileTypes();
  const empty = { obstacles: 0, speedbumps: 0, rampPoints: false };
  const { insertedId } = await models.lineMap.collection.insertOne({
    competition: comp._id, league: 'Line', name: 'line', tileSet: comp._id, finished: true,
    width: 2, length: 1, height: 1, indexCount: 2, victims: { live: 2, dead: 1 }, EvacuationAreaLoPIndex: 0,
    startTile: { x: 0, y: 0, z: 0 },
    tiles: [
      { x: 0, y: 0, z: 0, rot: 0, tileType: plain._id, index: [0], items: empty },
      { x: 1, y: 0, z: 0, rot: 0, tileType: gap._id, index: [1], items: { ...empty, obstacles: 2 } },
    ],
  });
  return insertedId;
}

const LEAGUES = {
  maze: { league: 'Maze', model: () => models.mazeRun, map: createMazeMap },
  line: { league: 'Line', model: () => models.lineRun, map: createLineMap },
};

for (const [type, cfg] of Object.entries(LEAGUES)) {
  describe(`${type} runs`, () => {
    const api = () => apis[type];
    const base = `/api/runs/${type}`;

    async function createRun(ctx, extra = {}) {
      api().setUser(ctx.users.admin);
      const refs = await ctx.refs(cfg.league);
      const res = await api().request('POST', base, { ...refs, map: await cfg.map(ctx.comp), ...extra });
      assert.strictEqual(res.status, 201);
      return (await res.json()).id;
    }

    test('competition admins can create runs', async () => {
      const ctx = await setup();
      const id = await createRun(ctx, { normalizationGroup: 'A' });
      const stored = await cfg.model().findById(id).populate('team').lean();
      assert.strictEqual(stored.team.league, cfg.league);
      assert.strictEqual(stored.normalizationGroup, 'A');
      assert.strictEqual(stored.status, 0);
      assert.strictEqual(stored.started, false);
    });

    test('runs cannot be created in another competition or without admin rights', async () => {
      const ctx = await setup();
      const body = { ...(await ctx.refs(cfg.league)), map: await cfg.map(ctx.comp) };
      api().setUser(ctx.users.otherAdmin);
      assert.strictEqual((await api().request('POST', base, body)).status, 401);
      api().setUser(ctx.users.judge);
      assert.strictEqual((await api().request('POST', base, body)).status, 400);
      api().setUser(undefined);
      assert.strictEqual((await api().request('POST', base, body)).status, 400);
      assert.strictEqual(await cfg.model().countDocuments({ competition: ctx.comp._id }), 0);
    });

    test('the public only sees runs once they are signed, without comment and signature', async () => {
      const ctx = await setup();
      const id = await createRun(ctx);
      await cfg.model().updateOne({ _id: id }, { comment: 'secret' });

      api().setUser(undefined);
      assert.strictEqual((await api().request('GET', `${base}/${id}`)).status, 401);
      api().setUser(ctx.users.judge);
      const forJudge = await api().request('GET', `${base}/${id}`);
      assert.strictEqual(forJudge.status, 200);
      assert.strictEqual((await forJudge.json()).comment, 'secret');

      await cfg.model().updateOne({ _id: id }, { status: 6, 'sign.captain': 'data:image/png;base64,x' });
      api().setUser(undefined);
      const res = await api().request('GET', `${base}/${id}`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.team.league, cfg.league);
      assert.strictEqual(body.comment, undefined);
      assert.strictEqual(body.sign, undefined);
    });

    test('the competition run list hides results of unfinished runs from the public', async () => {
      const ctx = await setup();
      const open = await createRun(ctx);
      const done = await createRun(ctx);
      await cfg.model().updateOne({ _id: open }, { score: 10 });
      await cfg.model().updateOne({ _id: done }, { score: 20, status: 6 });

      api().setUser(undefined);
      const res = await api().request('GET', `${base}/competition/${ctx.comp._id}`);
      assert.strictEqual(res.status, 200);
      const runs = Object.fromEntries((await res.json()).map((r) => [r._id, r]));
      assert.strictEqual(runs[open].score, undefined);
      assert.strictEqual(runs[done].score, 20);

      // ended=false lists only runs that have not finished
      api().setUser(ctx.users.judge);
      const pending = await (await api().request('GET', `${base}/competition/${ctx.comp._id}?ended=false`)).json();
      assert.deepStrictEqual(pending.map((r) => r._id), [open]);
      assert.strictEqual(pending[0].score, 10);
    });

    test('a run that does not exist is reported as not found', async () => {
      const ctx = await setup();
      api().setUser(ctx.users.admin);
      const missing = '0123456789abcdef01234567';
      assert.strictEqual((await api().request('GET', `${base}/${missing}`)).status, 404);
      assert.strictEqual((await api().request('DELETE', `${base}/${missing}`)).status, 404);
    });

    test('bulk adjustments are stored and applied in the run list', async () => {
      const ctx = await setup();
      const id = await createRun(ctx);
      await cfg.model().updateOne({ _id: id }, { score: 50, status: 6 });
      api().setUser(ctx.users.admin);
      const res = await api().request('PUT', `${base}/bulk`, [{ _id: id, adjustment: -10 }]);
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await cfg.model().findById(id).lean()).adjustment, -10);

      const runs = await (await api().request('GET', `${base}/competition/${ctx.comp._id}`)).json();
      assert.strictEqual(Number(runs[0].score), 45);
      assert.strictEqual(runs[0].originalScore, 50);
    });

    test('competition admins can delete several runs at once, others cannot', async () => {
      const ctx = await setup();
      const ids = [await createRun(ctx), await createRun(ctx), await createRun(ctx)];

      api().setUser(ctx.users.otherAdmin);
      assert.strictEqual((await api().request('DELETE', `${base}/${ids[0]},${ids[1]}`)).status, 401);
      assert.strictEqual(await cfg.model().countDocuments({ competition: ctx.comp._id }), 3);

      api().setUser(ctx.users.admin);
      assert.strictEqual((await api().request('DELETE', `${base}/${ids[0]},${ids[1]}`)).status, 200);
      const left = await cfg.model().find({ competition: ctx.comp._id }).lean();
      assert.deepStrictEqual(left.map((r) => r._id.toString()), [ids[2]]);
    });
  });
}

test('opening a new line run fills in the scoring items from its map', async () => {
  const ctx = await setup();
  const map = await createLineMap(ctx.comp);
  apis.line.setUser(ctx.users.admin);
  const { id } = await (await apis.line.request('POST', '/api/runs/line', { ...(await ctx.refs('Line')), map })).json();

  apis.line.setUser(ctx.users.judge);
  const body = await (await apis.line.request('GET', `/api/runs/line/${id}`)).json();
  assert.deepStrictEqual(body.tiles.map((t) => t.scoredItems.map((s) => [s.item, s.count, s.scored])), [
    [],
    [['obstacle', 2, false], ['gap', (await lineTileTypes()).gap.gaps, false]],
  ]);
  assert.strictEqual((await models.lineRun.findById(id).lean()).tiles.length, 2);
});
