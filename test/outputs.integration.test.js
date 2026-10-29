// Printable outputs from the map editors: score sheets and map images.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');
const { startApi } = require('./helpers/api');
const { pdfFillColours } = require('./helpers/files');
const { COLORS } = require('../public/javascripts/cognitive_target');

let lineApi;
let mazeApi;
let fixtures;
let models;

before(async () => {
  await db.start();
  const { mazeMap } = require('../models/mazeMap');
  const { lineMap, tileType } = require('../models/lineMap');
  models = { mazeMap, lineMap };
  await db.waitFor(() => tileType.findOne({ intersections: { $gt: 0 } }).lean());
  fixtures = require('./helpers/fixtures');

  const lineMaps = require('../routes/api/lineMaps');
  const mazeMaps = require('../routes/api/mazeMaps');
  lineApi = await startApi('/api/maps/line', [lineMaps.public]);
  mazeApi = await startApi('/api/maps/maze', [mazeMaps.public]);
});

after(async () => {
  if (lineApi) await lineApi.close();
  if (mazeApi) await mazeApi.close();
  await db.stop();
});

async function expectFile(res, contentType, signature) {
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), new RegExp(contentType));
  const body = Buffer.from(await res.arrayBuffer());
  assert.ok(body.subarray(0, signature.length).equals(signature), `expected ${contentType}`);
  return body;
}

/** The cognitive target's rings are drawn in their colours (green and yellow are in no other part). */
function expectCognitiveTarget(pdf) {
  const colours = pdfFillColours(pdf);
  for (const c of ['G', 'Y']) assert.ok(colours.has(COLORS[c]), `${c} (${COLORS[c]}) in ${[...colours]}`);
}

const PDF = Buffer.from('%PDF');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** The map as the line editor sends it: tiles with their tile types. */
async function lineEditorMap(league) {
  const comp = await fixtures.createCompetition();
  const { id } = await fixtures.createLineMap(comp, league);
  const map = await models.lineMap.findById(id).populate('tiles.tileType').lean();
  return { ...map, competitionName: 'Test', leagueName: league, paperSize: 'A4' };
}

/** Rings from the centre: green, then yellow; a stable victim. */
const COGNITIVE = { ring1: 'G', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' };

async function mazeEditorMap() {
  const comp = await fixtures.createCompetition();
  const noVictims = { top: 'None', right: 'None', bottom: 'None', left: 'None' };
  const map = await models.mazeMap.create({
    competition: comp._id, league: 'Maze', name: 'maze', finished: true,
    width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      { x: 1, y: 1, z: 0, tile: { victims: { ...noVictims, top: 'PHI', left: 'Cognitive' }, cognitiveTargets: { left: { rings: COGNITIVE } } } },
      { x: 3, y: 1, z: 0, tile: { checkpoint: true, victims: noVictims } },
    ],
  });
  return { ...map.toObject(), competitionName: 'Test', leagueName: 'Maze', paperSize: 'A4' };
}

test('line 2026 score sheet PDF', async () => {
  const map = await lineEditorMap('Line');
  await expectFile(await lineApi.request('POST', '/api/maps/line/scoresheet', { ...map, rule: '2026' }), 'pdf', PDF);
});

test('line map image as PDF and PNG', async () => {
  const map = await lineEditorMap('LineNL');
  await expectFile(await lineApi.request('POST', '/api/maps/line/map-image-pdf', map), 'pdf', PDF);
  await expectFile(await lineApi.request('POST', '/api/maps/line/map-image-png', map), 'png', PNG);
});

test('maze 2026 score sheet PDF, with the cognitive target among the victims', async () => {
  const map = await mazeEditorMap();
  const pdf = await expectFile(await mazeApi.request('POST', '/api/maps/maze/scoresheet', { ...map, rule: '2026' }), 'pdf', PDF);
  expectCognitiveTarget(pdf);
});

test('maze targets PDF, from the map as the editor sends it (cells by their coordinates)', async (t) => {
  t.mock.method(console, 'log', () => {});
  const map = await mazeEditorMap();
  const cells = Object.fromEntries(map.cells.map(({ x, y, z, ...cell }) => [`${x},${y},${z}`, cell]));
  const pdf = await expectFile(await mazeApi.request('POST', '/api/maps/maze/competition-targets-pdf', { ...map, cells }), 'pdf', PDF);
  expectCognitiveTarget(pdf);
});

test('maze targets PDF of a map without targets is refused', async (t) => {
  t.mock.method(console, 'log', () => {});
  const map = await mazeEditorMap();
  const res = await mazeApi.request('POST', '/api/maps/maze/competition-targets-pdf', { ...map, includeCognitiveTargets: false });
  assert.strictEqual(res.status, 404);
});

test('maze map image as PDF and PNG', async () => {
  const map = await mazeEditorMap();
  await expectFile(await mazeApi.request('POST', '/api/maps/maze/map-image-pdf', map), 'pdf', PDF);
  await expectFile(await mazeApi.request('POST', '/api/maps/maze/map-image-png', map), 'png', PNG);
});
