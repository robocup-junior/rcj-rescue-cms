// Walls on the 6 cm grid and their place in the map's cells, for the new Simulation 2026 editor
// (public/javascripts/sim_editor_beta/lattice.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../public/javascripts/sim_editor_beta/lattice');

const DIR = path.join(__dirname, 'fixtures', 'sim2026');
const load = (name) => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
const sorted = (set) => [...set].sort();
const arcs = (list) => list.map((a) => `${a.x},${a.y},${a.q}=${a.v}`).sort();
const empty = () => ({ width: 2, length: 2, cells: {} });

test('a tile edge keeps its two halves as the editor does (half 1 = left / lower)', () => {
  assert.deepStrictEqual(L.place('v,2,1'), { kind: 'edge', cell: '2,1,0', half: 1 });   // lower half of the edge at x 2
  assert.deepStrictEqual(L.place('v,2,0'), { kind: 'edge', cell: '2,1,0', half: 2 });
  assert.deepStrictEqual(L.place('h,0,2'), { kind: 'edge', cell: '1,2,0', half: 1 });   // left half of the edge at y 2
  assert.deepStrictEqual(L.place('h,1,2'), { kind: 'edge', cell: '1,2,0', half: 2 });
});

test('inside a tile a segment is one of its arms (up, right, down, left)', () => {
  assert.deepStrictEqual(L.place('v,1,0'), { kind: 'inner', cell: '1,1,0', arm: 0 });
  assert.deepStrictEqual(L.place('h,1,1'), { kind: 'inner', cell: '1,1,0', arm: 1 });
  assert.deepStrictEqual(L.place('v,1,1'), { kind: 'inner', cell: '1,1,0', arm: 2 });
  assert.deepStrictEqual(L.place('h,0,1'), { kind: 'inner', cell: '1,1,0', arm: 3 });
});

test('two halves make a whole wall, one makes a half wall, none clears it', () => {
  const map = empty();
  L.setSeg(map, 'v,2,1', true);
  assert.deepStrictEqual(map.cells['2,1,0'], { isWall: false, halfWall: 1 });
  L.setSeg(map, 'v,2,0', true);
  assert.deepStrictEqual(map.cells['2,1,0'], { isWall: true, halfWall: 0 });
  L.setSeg(map, 'v,2,1', false);
  assert.deepStrictEqual(map.cells['2,1,0'], { isWall: false, halfWall: 2 });
  L.setSeg(map, 'v,2,0', false);
  assert.deepStrictEqual(map.cells['2,1,0'], { isWall: false, halfWall: 0 });
});

test('inner walls and curves go into the tile and mark it as a quarter-tile one', () => {
  const map = empty();
  L.setSeg(map, 'h,1,1', true);
  L.setArc(map, 1, 1, 2, 3);
  const tile = map.cells['1,1,0'].tile;
  assert.deepStrictEqual(tile.halfWallIn, [0, 1, 0, 0]);
  assert.deepStrictEqual(tile.curve, [0, 0, 3, 0]);
  assert.strictEqual(tile.halfTile, 1);
  assert.ok(L.hasSeg(map, 'h,1,1'));
  assert.ok(!L.hasSeg(map, 'v,1,1'));
});

for (const name of ['mapA', 'mapB', 'mapC', 'mapD']) {
  test(`${name}: walls read from the cells and written into an empty map come out the same`, () => {
    const map = load(name);
    const walls = L.fromCells(map);
    assert.ok(walls.segs.size > 0);
    const copy = { width: map.width, length: map.length, cells: {} };
    walls.segs.forEach((s) => L.setSeg(copy, s, true));
    walls.arcs.forEach((a) => L.setArc(copy, a.x, a.y, a.q, a.v));
    const again = L.fromCells(copy);
    assert.deepStrictEqual(sorted(again.segs), sorted(walls.segs));
    assert.deepStrictEqual(arcs(again.arcs), arcs(walls.arcs));
    // and each edge cell says the same about its wall
    Object.keys(copy.cells).forEach((key) => {
      const a = copy.cells[key], b = map.cells[key];
      if (a.tile) return;
      assert.strictEqual(!!a.isWall, !!b.isWall, key);
      if (!a.isWall) assert.strictEqual(Number(a.halfWall || 0), Number(b.halfWall || 0), key);
    });
  });
}

test('mapA has half walls, inner walls and curves to read', () => {
  const walls = L.fromCells(load('mapA'));
  assert.ok(walls.segs.has('h,12,2'), 'half wall at 13,2');   // left half of the edge at (13, 2)
  assert.ok(walls.segs.has('v,13,2'), 'inner wall of tile 13,3 (up)');
  assert.deepStrictEqual(arcs(walls.arcs), ['11,9,0=1', '11,9,3=3', '15,11,1=2', '15,11,2=4']);
});

test('points snap to the 6 cm or 12 cm grid inside the map', () => {
  assert.deepStrictEqual(L.snap(7, 16, 1, 2, 2), [1, 3]);
  assert.deepStrictEqual(L.snap(7, 16, 2, 2, 2), [2, 2]);
  assert.deepStrictEqual(L.snap(-5, 99, 1, 2, 2), [0, 4]);
});

test('lines run across or down the map, rectangles give their outline', () => {
  assert.deepStrictEqual(L.axisLine([0, 0], [3, 1]), { end: [3, 0], segs: ['h,0,0', 'h,1,0', 'h,2,0'] });
  assert.deepStrictEqual(L.axisLine([2, 4], [3, 1]), { end: [2, 1], segs: ['v,2,1', 'v,2,2', 'v,2,3'] });
  assert.deepStrictEqual(L.rectSegs([0, 0], [1, 1]).sort(), ['h,0,0', 'h,0,1', 'v,0,0', 'v,1,0']);
});

test('each room takes the walls its rules allow', () => {
  // tiles at x 1 (room 1), 3 (room 2), 5 (room 3), 7 (room 4); one row
  const roomOf = (x, y) => (y === 1 && x >= 1 && x <= 7 ? (x + 1) / 2 : 0);
  assert.deepStrictEqual(L.segRule('v,1,0', roomOf), { ok: false, whole: false, reason: 'room1Inner' });
  assert.deepStrictEqual(L.segRule('v,2,0', roomOf), { ok: true, whole: true });     // room 1 | room 2 edge
  assert.deepStrictEqual(L.segRule('v,3,0', roomOf), { ok: true, whole: false });    // inside room 2
  assert.deepStrictEqual(L.segRule('v,6,0', roomOf), { ok: true, whole: false });    // room 3 | room 4 edge
  assert.deepStrictEqual(L.segRule('v,7,0', roomOf), { ok: false, whole: false, reason: 'room4' });
  assert.deepStrictEqual(L.segRule('v,9,0', roomOf), { ok: false, whole: false, reason: 'outside' });
  assert.deepStrictEqual(L.arcRule(3), { ok: true });
  assert.deepStrictEqual(L.arcRule(2), { ok: false, reason: 'curveRoom3' });
  assert.strictEqual(L.otherHalf('v,2,1'), 'v,2,0');
  assert.strictEqual(L.otherHalf('v,1,1'), null);
});

test('a victim on a curve is drawn on the face of the arc the world export puts it on', () => {
  // the export's positions (sim_world_2026.js): tile centre + curveWallVicPos[q * 4 + d] (+ the outward
  // offset humanOffsetCurve[(d + 2) % 4] for the outer face), metres -> cm
  const curveWallVicPos = [[-0.022, -0.039], [-0.022, -0.022], [-0.039, -0.023], [-0.038, -0.038],
    [0.038, -0.039], [0.038, -0.022], [0.021, -0.023], [0.022, -0.038],
    [-0.022, 0.021], [-0.022, 0.038], [-0.039, 0.037], [-0.038, 0.022],
    [0.038, 0.021], [0.038, 0.038], [0.021, 0.037], [0.022, 0.022]];
  const humanOffsetCurve = [[-0.008, 0.008], [-0.008, -0.008], [0.008, -0.008], [0.008, 0.008]];
  for (let q = 0; q < 4; q++) {
    for (let v = 1; v <= 4; v++) {
      const d = v - 1;
      const c = L.curveCentre(1, 1, q, v);
      for (let side = 0; side < 4; side++) {
        const exportInside = d === (side + 2) % 4 || d === (side + 1) % 4;
        const off = exportInside ? [0, 0] : humanOffsetCurve[(d + 2) % 4];
        const ex = 6 + 100 * (curveWallVicPos[q * 4 + d][0] + off[0]), ey = 6 + 100 * (curveWallVicPos[q * 4 + d][1] + off[1]);
        const exportOnInnerFace = Math.hypot(ex - c[0], ey - c[1]) < 6;
        const pt = L.slotPoint(1, 1, q * 4 + side, [q === 0 ? v : 0, q === 1 ? v : 0, q === 2 ? v : 0, q === 3 ? v : 0]);
        assert.strictEqual(pt.inside, exportOnInnerFace, `q${q} v${v} side${side}`);
        assert.strictEqual(Math.hypot(pt.at[0] - c[0], pt.at[1] - c[1]) < 6, exportOnInnerFace);
        assert.strictEqual(L.curveInside(v, L.curveSide(v, pt.inside)), pt.inside);
      }
    }
  }
});
