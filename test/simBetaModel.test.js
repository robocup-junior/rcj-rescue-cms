// Map editing of the new Simulation 2026 editor (public/javascripts/sim_editor_beta/model.js)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../public/javascripts/sim_editor_beta/model');
const L = require('../public/javascripts/sim_editor_beta/lattice');
const W = require('../public/javascripts/sim_editor/sim_world_2026');

const wall = (map, x, y) => !!(map.cells[`${x},${y},0`] && map.cells[`${x},${y},0`].isWall);
const quietly = (fn) => {
  const log = console.log;
  console.log = () => {};
  try { return fn(); } finally { console.log = log; }
};

// Paints tiles (tile indices) into a room and keeps the border walls in step, as the editor does
function paint(map, room, tiles, borders) {
  tiles.forEach(([tx, ty]) => M.setRoom(map, 2 * tx + 1, 2 * ty + 1, room));
  return M.syncBorderWalls(map, borders);
}

test('a new map has its tiles and outer walls, and no start yet', () => {
  const map = M.newMap(3, 2);
  assert.ok(wall(map, 1, 0) && wall(map, 5, 4) && wall(map, 0, 3) && wall(map, 6, 1));
  assert.ok(!wall(map, 2, 1));
  assert.ok(map.cells['5,3,0'].tile);
  assert.deepStrictEqual(M.problems(map).map((p) => p.key), ['noStart']);
});

test('resizing keeps what fits and moves the outer walls', () => {
  const map = M.newMap(3, 3);
  M.setFloor(map, 5, 5, 'start');
  M.setWalls(map, ['v,2,1', 'v,2,0'], true);
  M.resize(map, 2, 3);
  assert.deepStrictEqual(map.startTile, { x: 0, y: 0, z: 0 });   // the start tile was cut off
  assert.ok(wall(map, 2, 1), 'inner wall kept');
  assert.ok(wall(map, 4, 1), 'new outer wall');
  assert.ok(!map.cells['5,1,0'], 'cells outside are gone');
  M.resize(map, 4, 3);
  assert.ok(!wall(map, 4, 1), 'the old outer wall goes when the map grows');
  assert.ok(wall(map, 8, 1));
});

test('rooms get walls on their borders, and lose them when the border goes', () => {
  const map = M.newMap(4, 2);
  let borders = new Set();
  borders = paint(map, 2, [[2, 0], [3, 0], [2, 1], [3, 1]], borders);
  assert.ok(wall(map, 4, 1) && wall(map, 4, 3), 'room 1 | room 2 border walled');
  assert.ok(map.cells['5,1,0'].tile.halfTile === 1);
  borders = paint(map, 1, [[2, 1]], borders);
  assert.ok(!wall(map, 4, 3), 'no border there any more');
  assert.ok(wall(map, 5, 2) && wall(map, 6, 3), 'new borders of the room 1 tile');
});

test('a passage opens the border wall and the rooms connect', () => {
  const map = M.newMap(4, 2);
  M.setFloor(map, 1, 1, 'start');
  let borders = paint(map, 2, [[2, 0], [3, 0], [2, 1], [3, 1]], new Set());
  assert.ok(M.problems(map).some((p) => p.key === 'conn.notConnected'));
  assert.ok(M.togglePassage(map, 4, 1));
  borders = M.syncBorderWalls(map, borders);
  assert.strictEqual(map.cells['3,1,0'].tile.color, '#1a1ae6', 'room 1 side takes the blue');
  assert.ok(!wall(map, 4, 1));
  assert.deepStrictEqual(M.problems(map), []);
  assert.ok(W.connectionStatus(map).ok);
  M.togglePassage(map, 4, 1);
  M.syncBorderWalls(map, borders);
  assert.ok(wall(map, 4, 1), 'closed again');
  assert.ok(!M.togglePassage(map, 2, 1), 'no border between two room 1 tiles');
});

test('room 1 takes whole tile edges, rooms 2 and 3 the 6 cm grid, room 4 nothing inside', () => {
  const map = M.newMap(4, 1);
  paint(map, 2, [[1, 0]], new Set());
  paint(map, 4, [[2, 0], [3, 0]], new Set());
  // room 1 tile 0: an inner segment is refused; its edge to room 2 goes in whole
  assert.deepStrictEqual(M.wallPlan(map, ['v,1,0']), { ok: [], bad: ['v,1,0'] });
  assert.deepStrictEqual(M.wallPlan(map, ['v,2,0']).ok.sort(), ['v,2,0', 'v,2,1']);
  assert.deepStrictEqual(M.wallPlan(map, ['v,3,0']).ok, ['v,3,0']);       // inside room 2
  assert.deepStrictEqual(M.wallPlan(map, ['v,7,0']).bad, ['v,7,0']);      // inside room 4
});

test('walls go in and out, but the outer walls stay', () => {
  const map = M.newMap(2, 2);
  assert.strictEqual(M.setWalls(map, ['v,2,0', 'v,2,1'], true), 2);
  assert.ok(wall(map, 2, 1));
  assert.strictEqual(M.segNear(map, 12.5, 4, 1.5), 'v,2,0');
  assert.strictEqual(M.setWalls(map, ['v,0,0'], false), 0);
  assert.ok(wall(map, 0, 1));
  M.setWalls(map, ['v,2,0'], false);
  assert.strictEqual(map.cells['2,1,0'].halfWall, 1);
});

test('a tile leaving rooms 2 / 3 loses inner walls, half walls and curves', () => {
  const map = M.newMap(2, 1);
  paint(map, 3, [[0, 0], [1, 0]], new Set());
  M.setWalls(map, ['h,1,1', 'v,2,1'], true);
  L.setArc(map, 1, 1, 0, 1);
  paint(map, 1, [[0, 0]], new Set());
  const t = map.cells['1,1,0'].tile;
  assert.deepStrictEqual(t.halfWallIn, [0, 0, 0, 0]);
  assert.deepStrictEqual(t.curve, [0, 0, 0, 0]);
  assert.strictEqual(map.cells['2,1,0'].halfWall, 0);
});

test('floors and the start tile', () => {
  const map = M.newMap(2, 1);
  M.setFloor(map, 1, 1, 'swamp');
  M.setFloor(map, 1, 1, 'black');
  assert.deepStrictEqual([map.cells['1,1,0'].tile.swamp, map.cells['1,1,0'].tile.black], [false, true]);
  M.setFloor(map, 1, 1, 'black');
  assert.strictEqual(map.cells['1,1,0'].tile.black, false);
  M.setFloor(map, 3, 1, 'start');
  assert.deepStrictEqual(map.startTile, { x: 3, y: 1, z: 0 });
});

test('victims go on walls, one per tile; a victim whose wall goes is reported', () => {
  const map = M.newMap(2, 2);
  M.setFloor(map, 1, 1, 'start');
  assert.deepStrictEqual(M.victimRule(map, 1, 1, 'right'), { ok: false, reason: 'noWall' });
  assert.ok(M.setVictim(map, 1, 1, 'top', 'H', false));
  assert.ok(M.setVictim(map, 1, 1, 'left', 'S', true));
  assert.deepStrictEqual(M.edgeVictim(map, 1, 1), { dir: 'left', type: 'S', code: '', fake: true });
  M.setWalls(map, ['v,2,2', 'v,2,3'], true);
  assert.ok(M.setVictim(map, 1, 3, 'right', 'U', false));
  M.setWalls(map, ['v,2,2'], false);
  assert.deepStrictEqual(M.problems(map).map((p) => p.key), ['victimNoWall', 'wallRule']);
  assert.ok(M.clearVictim(map, 1, 3));
  paint(map, 2, [[1, 1]], new Set());
  assert.strictEqual(M.victimRule(map, 3, 3, 'bottom').reason, 'quarterTile');
});

test('a room 4 preset (from a classic map) borders get no walls, and the new editor asks to switch it', () => {
  const map = M.newMap(9, 7);
  M.setFloor(map, 1, 13, 'start');
  map.area4Room = W.area4Presets()[2];
  const tiles = [];
  for (let x = 1; x <= 7; x++) for (let y = 1; y <= 5; y++) tiles.push([x, y]);
  paint(map, 4, tiles, new Set());
  assert.ok(!wall(map, 2, 3), 'no wall on the room 4 border');
  assert.ok(M.problems(map).some((p) => p.key === 'presetNotSupported' && p.block));
});

test('room 4 is custom as soon as it has tiles, and none without', () => {
  const map = M.newMap(3, 1);
  let borders = paint(map, 4, [[1, 0]], new Set());
  assert.strictEqual(map.area4Room.type, 1);
  assert.ok(M.problems(map).some((p) => p.key === 'customRoom4NoPicture'));
  borders = paint(map, 1, [[1, 0]], borders);
  assert.strictEqual(map.area4Room.type, 0);
  assert.ok(!M.problems(map).some((p) => p.key === 'customRoom4NoPicture'));
});

test('the saved map and the world export work as in the classic editor', () => {
  const map = M.newMap(3, 2);
  M.setFloor(map, 1, 1, 'start');
  M.setWalls(map, ['v,2,0', 'v,2,1'], true);
  M.setVictim(map, 1, 1, 'right', 'H', false);
  M.setFloor(map, 5, 3, 'checkpoint');
  const saved = M.saved(map);
  assert.deepStrictEqual(Object.keys(saved), ['name', 'length', 'height', 'width', 'finished', 'startTile', 'cells', 'roomTiles', 'time', 'area4Room', 'room4CanvasSave', 'room4VicTypes', 'room4Tokens', 'connCheckOff']);
  const world = quietly(() => M.world(map));
  assert.ok(world.startsWith('#VRML_SIM'));
  assert.ok(/Victim|victim/.test(world));
  assert.ok(!map.cells['1,1,0'].reachable, 'the map itself is left as it was');
});

test('curves go into room 3 quarters only, nearest to the pointer, and the eraser finds them', () => {
  const map = M.newMap(2, 1);
  paint(map, 3, [[0, 0]], new Set());
  paint(map, 2, [[1, 0]], new Set());
  // a point near the NE-bulging arc of the NW quarter of tile 0 (centre at its SW corner (0, 6))
  const c = M.arcChoice(map, 4.5, 1.5);
  assert.deepStrictEqual([c.x, c.y, c.q, c.v, c.rule.ok], [1, 1, 0, 1, true]);
  assert.ok(M.setCurve(map, 1, 1, 0, 1));
  assert.deepStrictEqual(map.cells['1,1,0'].tile.curve, [1, 0, 0, 0]);
  assert.deepStrictEqual(M.arcNear(map, 4.5, 1.6, 1), { x: 1, y: 1, q: 0, v: 1 });
  assert.strictEqual(M.arcChoice(map, 16, 2).rule.reason, 'curveRoom3');
  assert.ok(!M.setCurve(map, 3, 1, 0, 1), 'room 2 takes no curve');
  assert.ok(M.setCurve(map, 1, 1, 0, 0));
  assert.strictEqual(M.arcNear(map, 4.5, 1.6, 1), null);
});

test('rooms 2 and 3 take victims on their 6 cm walls (16 places per tile)', () => {
  const map = M.newMap(2, 1);
  M.setFloor(map, 1, 1, 'start');
  paint(map, 2, [[1, 0]], new Set());
  // tile (3, 1): its NE quarter's top is on the outer wall, its NW quarter's right side on nothing yet
  assert.deepStrictEqual(M.slotAt(map, 21, 1), { x: 3, y: 1, i: 4 });
  assert.ok(M.slotHasWall(map, 3, 1, 4));
  assert.deepStrictEqual(M.slotRule(map, 3, 1, 1), { ok: false, reason: 'noWall' });
  M.setWalls(map, ['v,3,0'], true);                  // inner wall up from the centre
  assert.ok(M.slotHasWall(map, 3, 1, 1) && M.slotHasWall(map, 3, 1, 7));
  assert.ok(M.setSlotVictim(map, 3, 1, 4, 'S', true));
  assert.ok(M.setSlotVictim(map, 3, 1, 1, 'H', false));
  assert.deepStrictEqual(M.slotVictim(map, 3, 1, 4), { type: 'S', value: '3', code: '', fake: true });
  assert.deepStrictEqual(M.slotRule(map, 1, 1, 0), { ok: false, reason: 'notQuarterTile' });
  M.setWalls(map, ['v,3,0'], false);
  assert.ok(M.problems(map).some((p) => p.key === 'victimNoWall'));
  assert.ok(M.clearSlotVictim(map, 3, 1, 1));
  assert.ok(!M.problems(map).some((p) => p.key === 'victimNoWall'));
  // the export takes them
  const world = quietly(() => M.world(map));
  assert.ok(world.length > 0);
  // and they go when the tile leaves room 2
  paint(map, 1, [[1, 0]], new Set());
  assert.strictEqual(M.slotVictim(map, 3, 1, 4), null);
});

test('a custom room 4 needs its picture, and a checkpoint behind each passage', () => {
  const map = M.newMap(4, 3);
  M.setFloor(map, 1, 5, 'start');
  let borders = paint(map, 4, [[2, 0], [3, 0], [2, 1], [3, 1]], new Set());
  map.area4Room = W.area4Presets()[1];
  M.togglePassage(map, 4, 3);                       // room 1 tile (1, 1) | room 4 tile (2, 1)
  borders = M.syncBorderWalls(map, borders);
  const keys = () => M.problems(map).map((p) => p.key);
  // rule 3.5.3: the room 4 tile behind the passage became a checkpoint by itself
  assert.ok(map.cells['5,3,0'].tile.checkpoint && map.cells['5,3,0'].tile.cpAuto);
  assert.deepStrictEqual(keys(), ['customRoom4NoPicture']);
  // taken off by hand: an error that stops the export
  M.setFloor(map, 5, 3, 'checkpoint');
  const cp = M.problems(map).find((p) => p.key === 'room4Checkpoint');
  assert.ok(cp && cp.block);
  assert.deepStrictEqual(cp.at, [30, 18]);
  map.room4CanvasSave = 'data:image/png;base64,';
  // the passage closed: a checkpoint the editor set goes, one set by hand stays
  borders = M.syncBorderWalls(map, borders);                 // put back by itself
  assert.ok(map.cells['5,3,0'].tile.checkpoint);
  assert.deepStrictEqual(keys(), []);
  M.togglePassage(map, 4, 3);
  borders = M.syncBorderWalls(map, borders);
  assert.ok(!map.cells['5,3,0'].tile.checkpoint, 'no passage, no checkpoint');
  M.setFloor(map, 5, 1, 'checkpoint');
  M.togglePassage(map, 4, 1);
  borders = M.syncBorderWalls(map, borders);
  M.togglePassage(map, 4, 1);
  borders = M.syncBorderWalls(map, borders);
  assert.ok(map.cells['5,1,0'].tile.checkpoint, 'set by hand: stays');
});

for (const name of ['mapA', 'mapB', 'mapC']) {
  test(`${name}: a classic map opened and saved in the new editor exports the same world`, () => {
    const fs = require('fs');
    const path = require('path');
    const orig = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sim2026', `${name}.json`), 'utf8'));
    const random = Math.random;
    const seeded = () => {
      let a = 7;
      Math.random = function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };
    global.DISABLE_RANDOMNESS = true;
    try {
      seeded();
      const before = quietly(() => M.world(JSON.parse(JSON.stringify(orig))));
      const saved = JSON.parse(JSON.stringify(M.saved(M.normalize(JSON.parse(JSON.stringify(orig))))));
      seeded();
      assert.strictEqual(quietly(() => M.world(saved)), before);
    } finally {
      Math.random = random;
      delete global.DISABLE_RANDOMNESS;
    }
  });
}

test('cognitive targets keep their ring code (and the letter of a valid one), with their turn', () => {
  const map = M.newMap(2, 1);
  M.setFloor(map, 1, 1, 'start');
  assert.ok(M.setVictim(map, 1, 1, 'top', 'CT', false, { code: 'GYYKG', rot: 90 }));   // 1 + 0 + 0 - 2 + 1 = 0: F
  const t = map.cells['1,1,0'].tile;
  assert.deepStrictEqual([t.cognitives, t.victims], [{ top_code: 'GYYKG' }, { top: 'F' }]);
  assert.strictEqual(t.single_victim_rotation, 90);
  assert.deepStrictEqual(M.edgeVictim(map, 1, 1), { dir: 'top', type: 'CT', code: 'GYYKG', fake: false });
  paint(map, 2, [[1, 0]], new Set());
  assert.ok(M.setSlotVictim(map, 3, 1, 4, 'CT', false, { code: 'BBBBB', rot: 30 }));    // sum 10: fake
  const u = map.cells['3,1,0'].tile;
  assert.deepStrictEqual([u.halfWallCognitives[4], u.halfWallVic[4], u.halfWallVicRots[4]], ['BBBBB', null, 30]);
  assert.ok(M.setSlotVictim(map, 3, 1, 4, 'CT', false, { code: 'GGYYY' }));             // sum 2: C
  assert.strictEqual(u.halfWallVic[4], 7);
  const world = quietly(() => M.world(map));
  assert.ok(world.includes('GYYKG') && world.includes('GGYYY'));
});

test('a placed victim can be looked at, changed and removed', () => {
  const map = M.newMap(2, 1);
  M.setVictim(map, 1, 1, 'top', 'H', false, { rot: 45 });
  const where = { kind: 'edge', x: 1, y: 1, dir: 'top' };
  assert.deepStrictEqual(M.victimAt(map, where), { dir: 'top', type: 'H', code: '', fake: false, rot: 45 });
  assert.strictEqual(M.victimAt(map, { kind: 'edge', x: 1, y: 1, dir: 'left' }), null);
  M.changeVictim(map, where, { type: 'U', fake: true, rot: -90 });
  assert.deepStrictEqual(M.victimAt(map, where), { dir: 'top', type: 'U', code: '', fake: true, rot: 270 });
  paint(map, 3, [[1, 0]], new Set());
  M.setSlotVictim(map, 3, 1, 4, 'CT', false, { code: 'GYYKG', rot: 10 });
  const slot = { kind: 'slot', x: 3, y: 1, i: 4 };
  M.changeVictim(map, slot, { type: 'H', rot: 20 });            // a cognitive target keeps its code
  assert.deepStrictEqual(M.victimAt(map, slot), { type: 'CT', value: 5, code: 'GYYKG', fake: false, rot: 20 });
  assert.ok(M.removeVictim(map, slot));
  assert.strictEqual(M.victimAt(map, slot), null);
});

test('tiles outside the map shape get outer walls round them and take nothing', () => {
  const map = M.newMap(3, 2);
  let borders = M.borderEdges(map);
  borders = paint(map, 0, [[2, 0]], borders);                 // top right corner out
  assert.ok(M.isOutside(map, 5, 1));
  assert.ok(!wall(map, 5, 0) && !wall(map, 6, 1), 'no walls round the outside tile on the rectangle');
  assert.ok(wall(map, 4, 1) && wall(map, 5, 2), 'walls between it and the map');
  assert.ok(M.isOuterEdge(map, 4, 1) && !M.isOuterEdge(map, 6, 1));
  assert.strictEqual(M.setWalls(map, ['v,4,0'], false), 0, 'outer walls stay');
  assert.ok(!M.setFloor(map, 5, 1, 'checkpoint'));
  assert.strictEqual(M.roomOf(map, 5, 1), 0);
  assert.deepStrictEqual(M.wallPlan(map, ['v,5,0']).bad, ['v,5,0']);
  // back into the map: the rectangle closes again
  borders = paint(map, 1, [[2, 0]], borders);
  assert.ok(wall(map, 5, 0) && wall(map, 6, 1) && !wall(map, 4, 1));
  // resizing keeps the outside tile out and walls the new border
  paint(map, 0, [[0, 1]], borders);
  M.resize(map, 4, 2);
  assert.ok(M.isOutside(map, 1, 3) && wall(map, 8, 1) && !wall(map, 6, 1));
  // the world has no floor there
  M.setFloor(map, 3, 1, 'start');
  const world = quietly(() => M.world(map));
  assert.ok(world.length > 0);
});

test('a passage goes on the side asked for, moves, closes, and goes by itself when it no longer fits', () => {
  const map = M.newMap(3, 1);
  let borders = paint(map, 2, [[1, 0], [2, 0]], new Set());
  assert.strictEqual(M.togglePassage(map, 2, 1, [3, 1]), 'open');      // on the room 2 side
  borders = M.syncBorderWalls(map, borders);
  assert.strictEqual(map.cells['3,1,0'].tile.color, '#1a1ae6');
  assert.ok(!wall(map, 2, 1));
  assert.strictEqual(M.togglePassage(map, 2, 1, [1, 1]), 'moved');     // to the room 1 side
  assert.deepStrictEqual([map.cells['1,1,0'].tile.color, map.cells['3,1,0'].tile.color], ['#1a1ae6', '']);
  assert.strictEqual(M.togglePassage(map, 2, 1, [1, 1]), 'closed');
  M.togglePassage(map, 2, 1);
  borders = M.syncBorderWalls(map, borders);
  assert.ok(M.clearPassage(map, 1, 1));
  borders = M.syncBorderWalls(map, borders);
  assert.ok(wall(map, 2, 1), 'closed again');
  // a passage left behind when its rooms change loses its colour
  M.togglePassage(map, 2, 1, [3, 1]);
  borders = M.syncBorderWalls(map, borders);
  borders = paint(map, 3, [[1, 0]], borders);                        // tile (3, 1) is room 3 now
  assert.strictEqual(map.cells['3,1,0'].tile.color, '', 'no longer between rooms 1 and 2');
  assert.ok(wall(map, 2, 1), 'the room 1 | room 3 border is walled');
});

test('a passage into room 4 (preset or picture) stays on the other side', () => {
  const map = M.newMap(3, 1);
  map.area4Room = W.area4Presets()[2];
  paint(map, 4, [[1, 0], [2, 0]], new Set());
  M.togglePassage(map, 2, 1, [3, 1]);
  assert.deepStrictEqual([map.cells['1,1,0'].tile.color, map.cells['3,1,0'].tile.color || ''], ['#08D508', '']);
  map.area4Room = W.area4Presets()[1];
  M.togglePassage(map, 2, 1, [3, 1]);
  assert.strictEqual(map.cells['1,1,0'].tile.color, '', 'closed: it was on that side already');
  M.togglePassage(map, 2, 1, [3, 1]);
  assert.strictEqual(map.cells['1,1,0'].tile.color, '#08D508');
});

test('a region is copied with its tiles, rooms, victims and walls, and pasted elsewhere', () => {
  const map = M.newMap(5, 3);
  let borders = M.borderEdges(map);
  borders = paint(map, 2, [[0, 0], [1, 0]], borders);
  M.setWalls(map, ['h,1,1'], true);                               // inner wall in tile (1, 1)
  M.setSlotVictim(map, 1, 1, 0, 'H', false, { rot: 30 });         // on the outer wall
  M.setFloor(map, 3, 3, 'checkpoint');
  const clip = M.copyRegion(map, { x0: 0, y0: 0, x1: 1, y1: 1 });
  assert.deepStrictEqual([clip.w, clip.h, clip.rooms['1,1'], clip.rooms['3,3']], [2, 2, 2, 1]);
  M.pasteRegion(map, clip, 3, 1);
  borders = M.resyncBorderWalls(map, borders);
  assert.strictEqual(M.roomOf(map, 7, 3), 2);
  assert.deepStrictEqual(map.cells['7,3,0'].tile.halfWallIn, [0, 1, 0, 0]);
  assert.strictEqual(map.cells['7,3,0'].tile.halfWallVic[0], '1');
  assert.ok(map.cells['9,5,0'].tile.checkpoint);
  assert.ok(wall(map, 10, 3) && wall(map, 10, 5), 'the outer wall is back on the right');
  // moving = clearing the source, then pasting
  M.clearRegion(map, { x0: 0, y0: 0, x1: 1, y1: 1 });
  borders = M.resyncBorderWalls(map, borders);
  assert.strictEqual(M.roomOf(map, 1, 1), 1);
  assert.ok(wall(map, 0, 1) && wall(map, 1, 0), 'outer walls stay');
  assert.ok(!map.cells['3,3,0'].tile.checkpoint);
});

test('rows and columns go in and out between the others, with everything after them moving along', () => {
  const map = M.newMap(3, 2);
  let borders = M.borderEdges(map);
  borders = paint(map, 2, [[1, 0], [2, 0]], borders);
  M.setFloor(map, 5, 3, 'start');
  M.setFloor(map, 5, 1, 'checkpoint');
  // a column after the first one (edge line x = 2)
  assert.ok(M.insertLine(map, 'x', 2));
  borders = M.resyncBorderWalls(map, borders);
  assert.strictEqual(map.width, 4);
  assert.deepStrictEqual(map.startTile, { x: 7, y: 3, z: 0 });
  assert.ok(map.cells['7,1,0'].tile.checkpoint);
  assert.strictEqual(M.roomOf(map, 3, 1), 1, 'between room 1 and room 2 the new tile stays room 1');
  assert.ok(wall(map, 4, 1), 'room 1 | room 2 border moved along');
  assert.ok(wall(map, 8, 1) && wall(map, 3, 0) && wall(map, 3, 4), 'outer walls round the new column');
  // a column inside room 2 joins it
  M.insertLine(map, 'x', 6);
  assert.strictEqual(M.roomOf(map, 7, 1), 2);
  // and out again
  assert.ok(M.removeLine(map, 'x', 7));
  assert.ok(M.removeLine(map, 'x', 3));
  borders = M.resyncBorderWalls(map, borders);
  assert.strictEqual(map.width, 3);
  assert.deepStrictEqual(map.startTile, { x: 5, y: 3, z: 0 });
  assert.ok(map.cells['5,1,0'].tile.checkpoint);
  assert.ok(wall(map, 6, 1) && wall(map, 2, 1));
  // a row before the first one
  M.insertLine(map, 'y', 0);
  assert.strictEqual(map.length, 3);
  assert.deepStrictEqual(map.startTile, { x: 5, y: 5, z: 0 });
});

test('each problem says everything it is about, to point out on the map', () => {
  const map = M.newMap(4, 2);
  M.setFloor(map, 1, 3, 'start');
  paint(map, 2, [[2, 0], [3, 0]], new Set());                  // room 2, not reached
  M.setWalls(map, ['v,2,2', 'v,2,3'], true);
  M.setVictim(map, 1, 3, 'right', 'H', false);
  M.setWalls(map, ['v,2,3'], false);                           // half of it gone: a half wall in room 1, a floating victim
  const by = (k) => M.problems(map).find((p) => p.key === k);
  assert.deepStrictEqual(by('conn.notConnected').show.tiles.sort(), [[2, 0], [3, 0]]);
  assert.deepStrictEqual(by('victimNoWall').show.points, [[10, 18]]);
  assert.deepStrictEqual(by('wallRule').show.segs, ['v,2,2']);
});

test('the problems that can be fixed are fixed: start, passages, gaps, victims, walls, room 4 checkpoints', () => {
  const map = M.newMap(6, 3);
  let borders = M.borderEdges(map);
  borders = paint(map, 2, [[2, 0], [3, 0], [2, 1], [3, 1]], borders);        // room 2, closed off
  borders = paint(map, 3, [[4, 0], [5, 0], [4, 1], [5, 1]], borders);        // room 3, behind room 2
  M.setWalls(map, ['v,2,4', 'v,2,5'], true);
  M.setVictim(map, 1, 5, 'right', 'H', false);
  M.setWalls(map, ['v,2,5'], false);                                         // a half wall in room 1, a victim without wall
  const keys = () => M.problems(map).map((p) => p.key).sort();
  assert.deepStrictEqual(keys(), ['conn.notConnected', 'conn.notConnected', 'noStart', 'victimNoWall', 'wallRule'].sort());
  borders = M.fixAll(map, borders);
  assert.deepStrictEqual(keys(), []);
  assert.ok(W.connectionStatus(map).ok);
  assert.ok(map.startTile.x > 0);
  assert.ok(wall(map, 2, 5), 'the half wall became a whole one');
  assert.ok(M.edgeVictim(map, 1, 5), 'its victim has its wall again, so it stays');
});

test('a gap between rooms gets its border wall back, and a custom room 4 picture cannot be made', () => {
  const map = M.newMap(4, 1);
  M.setFloor(map, 1, 1, 'start');
  let borders = paint(map, 2, [[2, 0], [3, 0]], new Set());
  M.togglePassage(map, 4, 1);
  borders = M.syncBorderWalls(map, borders);
  L.setSeg(map, 'v,6,0', false); L.setSeg(map, 'v,6,1', false);           // no border inside room 2: fine
  map.cells['4,1,0'].isWall = false;
  M.togglePassage(map, 4, 1);                                              // passage gone, the wall not back
  map.cells['4,1,0'].isWall = false;
  const gap = M.problems(map).find((p) => p.key === 'conn.unmarkedGap');
  assert.ok(gap);
  borders = M.fixProblem(map, gap, borders);
  assert.ok(wall(map, 4, 1));
  paint(map, 4, [[3, 0]], borders);
  const pic = M.problems(map).find((p) => p.key === 'customRoom4NoPicture');
  assert.strictEqual(M.fixProblem(map, pic, borders), null);
});
