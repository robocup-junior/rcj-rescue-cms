// World export and room checks of the Simulation 2026 editor (public/javascripts/sim_editor/
// sim_world_2026.js), run in Node on sample maps. The expected files were made by the editor in the
// browser: the .wbt with DISABLE_RANDOMNESS and Math.random seeded as below, the .checks.json from
// the editor's own connection check, room 4 preset check, tile dialog info and room 4 geometry.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const W = require('../public/javascripts/sim_editor/sim_world_2026');

const DIR = path.join(__dirname, 'fixtures', 'sim2026');
const load = (name) => {
  const map = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
  map.area4 = W.area4Presets();
  return map;
};
const expected = (name) => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.checks.json`), 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));

// mulberry32, as seeded in the browser
function seedRandom(seed) {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// The export logs a lot; keep the test output readable
function quietly(fn) {
  const log = console.log;
  console.log = () => {};
  try { return fn(); } finally { console.log = log; }
}

for (const name of ['mapA', 'mapB', 'mapC']) {
  test(`${name}: the world export matches the editor's`, () => {
    const map = load(name);
    const random = Math.random;
    global.DISABLE_RANDOMNESS = true;
    Math.random = seedRandom(20261016);
    try {
      const world = quietly(() => W.createWorld(map, {}));
      assert.strictEqual(world, fs.readFileSync(path.join(DIR, `${name}.wbt`), 'utf8'));
    } finally {
      Math.random = random;
      delete global.DISABLE_RANDOMNESS;
    }
  });
}

for (const name of ['mapA', 'mapB', 'mapC', 'mapD']) {
  test(`${name}: the room checks match the editor's`, () => {
    const map = load(name);
    const want = expected(name);
    assert.deepStrictEqual(plain(W.connectionStatus(map)), want.conn);

    const region = W.room4Region(map);
    const greens = W.passageTiles(map, W.PASSAGE_14);
    const reds = W.passageTiles(map, W.PASSAGE_34);
    const area4 = {};
    map.area4.forEach((room) => { if (room.type >= 2) area4[room.type] = W.presetStatus(map, room, region, greens, reds); });
    assert.deepStrictEqual(plain(area4), want.area4);

    const tileInfo = {};
    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.length; y++) tileInfo[`${x},${y}`] = W.tileRoomInfo(map, 2 * x + 1, 2 * y + 1, 0);
    }
    assert.deepStrictEqual(plain(tileInfo), want.tileInfo);
    assert.deepStrictEqual(plain(W.mapGeometry(map)), want.geometry);
  });
}

test('the sample maps cover what the checks look at', () => {
  // rooms 1-4, passages, a preset placed on its passages and a custom room 4
  assert.deepStrictEqual(expected('mapA').conn.rooms.map((r) => r.room), [2, 3]);
  assert.ok(expected('mapA').conn.ok);
  assert.ok(expected('mapB').area4[2].ok);
  assert.ok(expected('mapC').area4[3].ok);
  assert.strictEqual(load('mapD').area4Room.type, 1);
  assert.ok(expected('mapD').geometry.entrances.length > 0);
});

test('the room 4 presets get new token turns each time, unless randomness is off', () => {
  const random = Math.random;
  Math.random = seedRandom(1);
  try {
    const a = W.area4Presets(), b = W.area4Presets();
    assert.notStrictEqual(a[2].humans[0].frontRotation, b[2].humans[0].frontRotation);
    global.DISABLE_RANDOMNESS = true;
    assert.strictEqual(W.area4Presets()[2].humans[0].frontRotation, 0);
  } finally {
    Math.random = random;
    delete global.DISABLE_RANDOMNESS;
  }
});

test('room numbers come from roomTiles', () => {
  const map = load('mapA');
  assert.strictEqual(W.checkRoomNumber(map, 1, 1, 0), 1);
  assert.strictEqual(W.checkRoomNumber(map, 9, 1, 0), 2);
  assert.strictEqual(W.checkRoomNumberKey(map, '9,7,0'), 3);
});

for (const name of ['mapA', 'mapB', 'mapC', 'mapD']) {
  test(`${name}: reachable tiles and linear walls are worked out as the editor saved them`, () => {
    const saved = load(name);
    const flags = (map) => Object.keys(map.cells).filter((k) => map.cells[k].reachable || map.cells[k].isLinear || map.cells[k].virtualWall)
      .map((k) => `${k}:${map.cells[k].reachable ? 'r' : ''}${map.cells[k].isLinear ? 'l' : ''}${map.cells[k].virtualWall ? 'v' : ''}`).sort();
    const map = load(name);
    Object.values(map.cells).forEach((c) => { delete c.reachable; delete c.isLinear; delete c.virtualWall; });
    W.recalculate(map);
    assert.ok(flags(saved).length > 0);
    assert.deepStrictEqual(flags(map), flags(saved));
  });
}
