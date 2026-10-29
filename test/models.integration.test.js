// Model validation and run initialisation against a real (in-memory) MongoDB.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');

let models;
let fixtures;

before(async () => {
  await db.start();
  const competition = require('../models/competition');
  const { mazeMap } = require('../models/mazeMap');
  const { mazeRun } = require('../models/mazeRun');
  const { lineMap, tileType } = require('../models/lineMap');
  models = { ...competition, mazeMap, mazeRun, lineMap, tileType };
  // Tile types are seeded when the line map model is loaded
  await db.waitFor(() => tileType.findOne({ intersections: { $gt: 0 } }).lean());
  fixtures = require('./helpers/fixtures');
});

after(db.stop);

async function createCompetition(name) {
  return models.competition.create({
    name,
    leagues: [{ league: 'Maze', rule: '2026' }, { league: 'MazeNL', rule: '2026E' }, { league: 'Line', rule: '2026' }, { league: 'LineNL', rule: '2026E' }],
  });
}

function mazeMapData(competition, overrides = {}) {
  return {
    competition: competition._id,
    league: 'Maze',
    name: `map-${Math.random()}`,
    width: 2, length: 1, height: 1,
    startTile: { x: 1, y: 1, z: 0 },
    cells: [
      { x: 1, y: 1, z: 0, tile: { victims: { top: 'None', right: 'None', bottom: 'None', left: 'None' } } },
      { x: 3, y: 1, z: 0, tile: { victims: { top: 'None', right: 'None', bottom: 'None', left: 'None' } } },
    ],
    ...overrides,
  };
}

describe('maze map validation', () => {
  test('a tile cannot be both black and a checkpoint', async () => {
    const comp = await createCompetition('maze-black');
    const data = mazeMapData(comp);
    Object.assign(data.cells[1].tile, { black: true, checkpoint: true });
    await assert.rejects(models.mazeMap.create(data), /both black and checkpoint/);
  });

  test('wall victims are not allowed on a checkpoint tile', async () => {
    const comp = await createCompetition('maze-victim');
    const data = mazeMapData(comp);
    Object.assign(data.cells[1].tile, { checkpoint: true });
    data.cells[1].tile.victims.left = 'PHI';
    await assert.rejects(models.mazeMap.create(data), /Can't have victims/);
  });

  test('entry maps drop ramps, stairs and blue tiles', async () => {
    const comp = await createCompetition('maze-entry');
    const data = mazeMapData(comp, { league: 'MazeNL', leagueType: 'entry' });
    Object.assign(data.cells[1].tile, { ramp: true, steps: true, blue: true });
    const saved = await models.mazeMap.create(data);
    const tile = saved.cells.find((c) => c.x === 3).tile;
    assert.deepStrictEqual([tile.ramp, tile.steps, tile.blue], [false, false, false]);
  });

  test('map names are unique within a competition', async () => {
    const comp = await createCompetition('maze-unique');
    await models.mazeMap.create(mazeMapData(comp, { name: 'Same' }));
    await assert.rejects(models.mazeMap.create(mazeMapData(comp, { name: 'Same' })), /already exists/);
  });

  test('a map used by a started run cannot be modified', async () => {
    const comp = await createCompetition('maze-started');
    // Runs can only be created on finished maps
    const map = await models.mazeMap.create(mazeMapData(comp, { finished: true }));
    const [round, field, team] = await Promise.all([
      models.round.create({ competition: comp._id, name: 'R1' }),
      models.field.create({ competition: comp._id, name: 'F1' }),
      models.team.create({ competition: comp._id, name: 'T1', league: 'Maze' }),
    ]);
    await models.mazeRun.create({ competition: comp._id, round: round._id, field: field._id, team: team._id, map: map._id, started: true });
    map.width = 3;
    await assert.rejects(map.save(), /used in started runs/);
  });
});

describe('line run initialisation', () => {
  const items = (run) => run.tiles.map((t) => t.scoredItems.map((i) => i.item).sort());

  test('2026 run gets every scoring element', async () => {
    const initRunData = require('../helper/initRunData');
    const comp = await createCompetition('line-2026');
    const { id: map } = await fixtures.createLineMap(comp, 'Line');
    const run = await initRunData.initLine({ map, started: false, isNL: false, nl: {} }, '2026');
    assert.deepStrictEqual(items(run), [[], ['intersection'], ['gap', 'obstacle'], ['checkpoint'], ['ramp'], ['ramp']]);
    assert.deepStrictEqual(run.LoPs, [0, 0]);
    assert.deepStrictEqual(run.rescueOrder, []);
  });

  test('2026E run has no intersections, scores every ramp tile and tracks entry victims', async () => {
    const initRunData = require('../helper/initRunData');
    const comp = await createCompetition('line-2026E');
    const { id: map } = await fixtures.createLineMap(comp, 'LineNL');
    const run = await initRunData.initLine({ map, started: false, isNL: true, nl: {} }, '2026E');
    // Consecutive ramp tiles each score on their own
    assert.deepStrictEqual(items(run), [[], [], ['gap', 'obstacle'], ['checkpoint'], ['ramp'], ['ramp']]);
    assert.strictEqual(run.nl.liveVictim.length, 2);
    assert.strictEqual(run.nl.deadVictim.length, 1);
  });

  test('started runs are not re-initialised', async () => {
    const initRunData = require('../helper/initRunData');
    assert.strictEqual(await initRunData.initLine({ started: true }, '2026'), null);
  });
});
