// Run APIs: updating a run stores the judge's input and recalculates the score with the league's rule.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');
const { startApi } = require('./helpers/api');

let mazeApi;
let lineApi;
let models;

before(async () => {
  await db.start();
  const competition = require('../models/competition');
  const { mazeMap } = require('../models/mazeMap');
  const { mazeRun } = require('../models/mazeRun');
  const { lineMap, tileType } = require('../models/lineMap');
  const { lineRun } = require('../models/lineRun');
  models = { ...competition, mazeMap, mazeRun, lineMap, tileType, lineRun };

  const mazeRuns = require('../routes/api/mazeRuns');
  const lineRuns = require('../routes/api/lineRuns');
  mazeApi = await startApi('/api/runs/maze', [mazeRuns.public, mazeRuns.private, mazeRuns.admin]);
  lineApi = await startApi('/api/runs/line', [lineRuns.public, lineRuns.private, lineRuns.admin]);
  await db.waitFor(() => tileType.findOne({ gaps: { $gt: 0 } }).lean());
});

after(async () => {
  if (mazeApi) await mazeApi.close();
  if (lineApi) await lineApi.close();
  await db.stop();
});

const admin = { superDuperAdmin: true, competitions: [] };
const outsider = { superDuperAdmin: false, competitions: [] };

async function createCompetition() {
  return models.competition.create({
    name: `api-${Math.random()}`,
    leagues: [{ league: 'Maze', rule: '2026' }, { league: 'MazeNL', rule: '2026E' }, { league: 'Line', rule: '2026' }, { league: 'LineNL', rule: '2026E' }],
  });
}

async function createRoundFieldTeam(comp, league) {
  const [round, field, team] = await Promise.all([
    models.round.create({ competition: comp._id, name: 'R1' }),
    models.field.create({ competition: comp._id, name: 'F1' }),
    models.team.create({ competition: comp._id, name: 'T1', league }),
  ]);
  return { round: round._id, field: field._id, team: team._id };
}

describe('maze runs', () => {
  async function createEntryRun() {
    const comp = await createCompetition();
    const noVictims = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };
    const map = await models.mazeMap.create({
      competition: comp._id, league: 'MazeNL', leagueType: 'entry', name: 'entry', finished: true,
      width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
      cells: [
        { x: 1, y: 1, z: 0, tile: { victims: noVictims } },
        { x: 3, y: 1, z: 0, tile: { victims: { ...noVictims, floor: 'Red' } } },
      ],
    });
    const refs = await createRoundFieldTeam(comp, 'MazeNL');
    const run = await models.mazeRun.create({ competition: comp._id, map: map._id, ...refs });
    return { run, map };
  }

  const judgeInput = {
    LoPs: 0,
    tiles: {
      '3,1,0': {
        scoredItems: {
          victims: { top: false, right: false, bottom: false, left: false, floor: true },
          rescueKits: { top: 0, right: 0, bottom: 0, left: 0, floor: 1 },
        },
      },
    },
  };

  test('PUT scores the run with the entry rules and stores it', async () => {
    mazeApi.setUser(admin);
    const { run, map } = await createEntryRun();
    const res = await mazeApi.request('PUT', `/api/runs/maze/${run._id}`, judgeInput);
    assert.strictEqual(res.status, 200);

    // Red floor victim (15 on a linear tile, 30 otherwise) + identified 10 + reliability 10.
    // The 2026 (non-entry) rules would ignore floor victims and give 0.
    const victimCell = map.cells.find((c) => c.x === 3);
    const expected = (victimCell.isLinear ? 15 : 30) + 10 + 10;
    assert.strictEqual((await res.json()).score, expected);

    const stored = await models.mazeRun.findById(run._id).lean();
    assert.strictEqual(stored.score, expected);
    assert.strictEqual(stored.started, true);
    assert.deepStrictEqual(stored.foundVictims.map((v) => [v.type, v.count]), [['Red', 1]]);
    assert.strictEqual(stored.tiles.length, 1);
  });

  test('PUTs that arrive together are all saved, one over the other', async () => {
    mazeApi.setUser(admin);
    const { run } = await createEntryRun();
    // Each adds the victim's tile, then finds it or not: the tile is added once
    const saves = await Promise.all([1, 2, 3, 4, 5].map((n) => mazeApi.request('PUT', `/api/runs/maze/${run._id}`, {
      misidentification: n,
      tiles: { '3,1,0': { scoredItems: { victims: { floor: n % 2 == 1 }, rescueKits: { floor: 0 } } } },
    })));
    assert.deepStrictEqual(saves.map((res) => res.status), [200, 200, 200, 200, 200]);
    const stored = await models.mazeRun.findById(run._id).lean();
    assert.strictEqual(stored.tiles.length, 1);
  });

  test('PUTs that arrive together for different tiles keep each tile', async () => {
    mazeApi.setUser(admin);
    const { run } = await createEntryRun();
    for (let round = 0; round < 5; round++) {
      const kits = round % 2;
      const saves = await Promise.all(['1,1,0', '3,1,0'].map((key) => mazeApi.request('PUT', `/api/runs/maze/${run._id}`, {
        tiles: { [key]: { scoredItems: { victims: { floor: true }, rescueKits: { floor: kits } } } },
      })));
      assert.deepStrictEqual(saves.map((res) => res.status), [200, 200]);
      const stored = await models.mazeRun.findById(run._id).lean();
      assert.deepStrictEqual(stored.tiles.map((t) => [t.x, t.scoredItems.rescueKits.floor]).sort(), [[1, kits], [3, kits]], `round ${round}`);
    }
  });

  test('PUT is refused for users without access to the competition', async () => {
    mazeApi.setUser(admin);
    const { run } = await createEntryRun();
    mazeApi.setUser(outsider);
    const res = await mazeApi.request('PUT', `/api/runs/maze/${run._id}`, judgeInput);
    assert.strictEqual(res.status, 401);
    const stored = await models.mazeRun.findById(run._id).lean();
    assert.strictEqual(stored.score, 0);
  });
});

describe('line runs', () => {
  /** A two-tile line map (start + gap) and an unscored run on it. */
  async function createLineRun(league) {
    const comp = await createCompetition();
    const [plain, gap] = await Promise.all([
      models.tileType.findOne({ gaps: 0, intersections: 0, seesaw: 0 }).lean(),
      models.tileType.findOne({ gaps: { $gt: 0 }, intersections: 0 }).lean(),
    ]);
    const empty = { obstacles: 0, speedbumps: 0, rampPoints: false };
    const { insertedId: map } = await models.lineMap.collection.insertOne({
      competition: comp._id, league, name: `line-${league}`, tileSet: comp._id, finished: true,
      width: 2, length: 1, height: 1, indexCount: 2, victims: { live: 2, dead: 1 }, EvacuationAreaLoPIndex: 0,
      startTile: { x: 0, y: 0, z: 0 },
      tiles: [
        { x: 0, y: 0, z: 0, rot: 0, tileType: plain._id, index: [0], items: empty },
        { x: 1, y: 0, z: 0, rot: 0, tileType: gap._id, index: [1], items: empty },
      ],
    });
    const refs = await createRoundFieldTeam(comp, league);
    const { insertedId: run } = await models.lineRun.collection.insertOne({
      // A version, as the runs made by the model have
      competition: comp._id, map, ...refs, started: false, status: 0, score: 0, __v: 0,
      time: { minutes: 0, seconds: 0 }, LoPs: [0], exitBonus: false, rescueOrder: [],
      isNL: league === 'LineNL',
      nl: { liveVictim: [{ found: false, identified: false }, { found: false, identified: false }], deadVictim: [{ found: false, identified: false }] },
      tiles: [{ scoredItems: [] }, { scoredItems: [{ item: 'gap', scored: false, count: 1 }] }],
    });
    return run;
  }

  const gapScored = { 1: { scoredItems: [{ item: 'gap', scored: true, count: 1 }] } };

  test('PUT scores line entry victims with the 2026E rules', async () => {
    lineApi.setUser(admin);
    const run = await createLineRun('LineNL');
    const res = await lineApi.request('PUT', `/api/runs/line/${run}`, {
      tiles: gapScored,
      nl: {
        liveVictim: [{ found: true, identified: true }, { found: true, identified: false }],
        deadVictim: [{ found: false, identified: false }],
      },
    });
    assert.strictEqual(res.status, 200);
    const stored = await models.lineRun.findById(run).lean();
    // gap 10 + start 5; live victims 10 + 20 and 10
    assert.strictEqual(stored.raw_score, 15);
    assert.strictEqual(stored.score, 55);
    assert.strictEqual(stored.started, true);
  });

  test('PUT applies the evacuation zone multiplier with the 2026 rules', async () => {
    lineApi.setUser(admin);
    const run = await createLineRun('Line');
    const res = await lineApi.request('PUT', `/api/runs/line/${run}`, {
      tiles: gapScored,
      rescueOrder: [
        { victimType: 'LIVE', zoneType: 'GREEN' },
        { victimType: 'LIVE', zoneType: 'GREEN' },
        { victimType: 'DEAD', zoneType: 'RED' },
      ],
    });
    assert.strictEqual(res.status, 200);
    const stored = await models.lineRun.findById(run).lean();
    assert.strictEqual(stored.raw_score, 15);
    assert.strictEqual(stored.score, Math.round(15 * 1.4 ** 3));
  });

  test('PUTs that arrive together are all saved, one over the other', async () => {
    lineApi.setUser(admin);
    const run = await createLineRun('Line');
    const saves = await Promise.all([1, 2, 3, 4, 5].map((n) => lineApi.request('PUT', `/api/runs/line/${run}`, {
      LoPs: [n], time: { minutes: 0, seconds: n },
    })));
    assert.deepStrictEqual(saves.map((res) => res.status), [200, 200, 200, 200, 200]);
  });

  test('PUTs that arrive together for different tiles keep each tile', async () => {
    lineApi.setUser(admin);
    const run = await createLineRun('Line');
    await models.lineRun.updateOne({ _id: run }, { $set: { 'tiles.0.scoredItems': [{ item: 'obstacle', scored: false, count: 1 }] } });
    for (let round = 0; round < 5; round++) {
      const scored = round % 2 == 0;
      const saves = await Promise.all([
        { 0: { scoredItems: [{ item: 'obstacle', scored, count: 1 }] } },
        { 1: { scoredItems: [{ item: 'gap', scored, count: 1 }] } },
      ].map((tiles) => lineApi.request('PUT', `/api/runs/line/${run}`, { tiles })));
      assert.deepStrictEqual(saves.map((res) => res.status), [200, 200]);
      const stored = await models.lineRun.findById(run).lean();
      assert.deepStrictEqual(stored.tiles.map((t) => t.scoredItems[0].scored), [scored, scored], `round ${round}`);
    }
  });

  // Read before anything is recorded, a run is started afresh for its map (initRunData.initLine);
  // what scores no points yet is recorded all the same, and is read back
  for (const [what, league, data, kept] of [
    ['a rescue', 'Line', { rescueOrder: [{ victimType: 'LIVE', zoneType: 'GREEN' }] }, (r) => r.rescueOrder.length == 1],
    ['a LoP', 'Line', { LoPs: [2] }, (r) => r.LoPs[0] == 2],
    ['the exit bonus', 'Line', { exitBonus: true }, (r) => r.exitBonus],
    ['a victim found', 'LineNL', { nl: { liveVictim: [{ found: true, identified: false }, { found: false, identified: false }], deadVictim: [{ found: false, identified: false }] } }, (r) => r.nl.liveVictim[0].found],
  ]) {
    test(`${what} without points is still there when the run is read again`, async () => {
      lineApi.setUser(admin);
      const run = await createLineRun(league);
      assert.strictEqual((await lineApi.request('PUT', `/api/runs/line/${run}`, data)).status, 200);
      const read = await lineApi.request('GET', `/api/runs/line/${run}`);
      assert.strictEqual(read.status, 200);
      const body = await read.json();
      assert.ok(kept(body), JSON.stringify(body));
    });
  }
});
