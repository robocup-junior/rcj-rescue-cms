// Map APIs: the maximum score shown in the map editors.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');
const { startApi } = require('./helpers/api');

let lineApi;
let mazeApi;
let fixtures;
let models;

before(async () => {
  await db.start();
  const { mazeMap } = require('../models/mazeMap');
  const { tileType } = require('../models/lineMap');
  models = { mazeMap };
  await db.waitFor(() => tileType.findOne({ intersections: { $gt: 0 } }).lean());
  fixtures = require('./helpers/fixtures');

  const lineMaps = require('../routes/api/lineMaps');
  const mazeMaps = require('../routes/api/mazeMaps');
  lineApi = await startApi('/api/maps/line', [lineMaps.public, lineMaps.private, lineMaps.admin]);
  mazeApi = await startApi('/api/maps/maze', [mazeMaps.public, mazeMaps.private, mazeMaps.admin]);
  const admin = { superDuperAdmin: true, competitions: [] };
  lineApi.setUser(admin);
  mazeApi.setUser(admin);
});

after(async () => {
  if (lineApi) await lineApi.close();
  if (mazeApi) await mazeApi.close();
  await db.stop();
});

async function maxScore(api, type, id) {
  const res = await api.request('GET', `/api/maps/${type}/${id}/maxScore`);
  assert.strictEqual(res.status, 200);
  return res.json();
}

test('line 2026E: every element, exit bonus and all entry victims', async () => {
  const comp = await fixtures.createCompetition();
  const { id } = await fixtures.createLineMap(comp, 'LineNL');
  const result = await maxScore(lineApi, 'line', id);
  // gap 10 + obstacle 20 + checkpoint 3 tiles x 5 + 2 ramps 20 + exit 30 + start 5 (no intersections)
  assert.strictEqual(result.raw_score, 100);
  // + live victims 2 x (10 + 20) + dead victim 10 + 10
  assert.strictEqual(result.score, 180);
});

test('line 2026: intersections, exit bonus and the evacuation multiplier', async () => {
  const comp = await fixtures.createCompetition();
  const { id, intersections } = await fixtures.createLineMap(comp, 'Line');
  const result = await maxScore(lineApi, 'line', id);
  // gap 10 + obstacle 20 + intersections 10 each + checkpoint 15 + ramps 20
  // + exit (60 + last 2 tiles x 5) + start 5
  const raw = 65 + 10 * intersections + 70 + 5;
  assert.strictEqual(result.raw_score, raw);
  // 2 live + 1 dead victim rescued correctly
  assert.strictEqual(result.score, Math.round(raw * 1.4 ** 3));
});

test('maze 2026E: floor victim, speed bump, checkpoint and exit bonus', async () => {
  const comp = await fixtures.createCompetition();
  const noVictims = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };
  const map = await models.mazeMap.create({
    competition: comp._id, league: 'MazeNL', leagueType: 'entry', name: 'entry', finished: true,
    width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      { x: 1, y: 1, z: 0, tile: { victims: noVictims } },
      { x: 3, y: 1, z: 0, tile: { speedbump: true, checkpoint: true, victims: { ...noVictims, floor: 'Green' } } },
    ],
  });
  const result = await maxScore(mazeApi, 'maze', map._id);
  const victimCell = map.cells.find((c) => c.x === 3);
  // bump 5 + checkpoint 10 + victim + identified 10 + reliability 10 + exit 10
  assert.strictEqual(result.score, 5 + 10 + (victimCell.isLinear ? 15 : 30) + 10 + 10 + 10);
});

test('a missing map gives 404 instead of crashing', async () => {
  const missing = '000000000000000000000000';
  assert.strictEqual((await lineApi.request('GET', `/api/maps/line/${missing}/maxScore`)).status, 404);
  assert.strictEqual((await mazeApi.request('GET', `/api/maps/maze/${missing}/maxScore`)).status, 404);
});
