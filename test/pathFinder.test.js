// Line course numbering: the order in which tiles are scored, checkpoints and the evacuation zone.
const test = require('node:test');
const assert = require('node:assert');
const { findPath } = require('../helper/pathFinder');

// Tile types by their paths (entry side -> exit side, before rotation).
// The evacuation and end tiles are recognised by their fixed ids.
const STRAIGHT_V = { _id: 'v', paths: { top: 'bottom', bottom: 'top' } };
const STRAIGHT_H = { _id: 'h', paths: { left: 'right', right: 'left' } };
const CROSS = { _id: 'x', paths: { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } };
const curve = (a, b) => ({ _id: `c-${a}-${b}`, paths: { [a]: b, [b]: a } });
const END = { _id: '58cfd6549792e9313b1610e0', paths: { left: 'right', right: 'left' } };
const EVAC = { _id: '58cfd6549792e9313b1610e1', paths: {} };

function tile(x, y, tileType, extra = {}) {
  return { x, y, z: 0, rot: 0, tileType, ...extra };
}

function run(tiles, start, start2 = { x: -1, y: -1, z: -1 }) {
  const map = { tiles, startTile: { z: 0, ...start }, startTile2: start2 };
  findPath(map);
  const at = (x, y, z = 0) => tiles.find((t) => t.x === x && t.y === y && t.z === z);
  return { map, at };
}

test('a straight course is numbered from the start tile', () => {
  const { map, at } = run([tile(0, 0, STRAIGHT_H), tile(1, 0, STRAIGHT_H), tile(2, 0, STRAIGHT_H)], { x: 0, y: 0 });
  assert.deepStrictEqual([at(0, 0).index, at(1, 0).index, at(2, 0).index], [[0], [1], [2]]);
  assert.strictEqual(map.indexCount, 3);
});

test('rotation is applied to the tile paths', () => {
  // A vertical tile turned by 90 degrees connects left and right
  const { map, at } = run([tile(0, 0, STRAIGHT_H), tile(1, 0, STRAIGHT_V, { rot: 90 }), tile(2, 0, STRAIGHT_H)], { x: 0, y: 0 });
  assert.deepStrictEqual(at(2, 0).index, [2]);
  assert.strictEqual(map.indexCount, 3);
});

test('an intersection passed twice gets both positions', () => {
  //  (0,0) (1,0)
  //  (0,1) (1,1)=cross (2,1)=end
  //        (1,2)=start
  const tiles = [
    tile(1, 2, STRAIGHT_V),
    tile(1, 1, CROSS),
    tile(1, 0, curve('bottom', 'left')),
    tile(0, 0, curve('right', 'bottom')),
    tile(0, 1, curve('top', 'right')),
    tile(2, 1, END),
  ];
  const { map, at } = run(tiles, { x: 1, y: 2 });
  assert.deepStrictEqual(at(1, 1).index, [1, 5]);
  assert.deepStrictEqual([at(1, 0).index, at(0, 0).index, at(0, 1).index, at(2, 1).index], [[2], [3], [4], [6]]);
  assert.strictEqual(map.indexCount, 7);
});

test('checkpoints before the evacuation zone decide its LoP slot', () => {
  const tiles = [
    tile(0, 0, STRAIGHT_H),
    tile(1, 0, STRAIGHT_H, { checkPoint: true }),
    tile(2, 0, STRAIGHT_H, { checkPoint: true }),
    tile(3, 0, EVAC),
  ];
  const { map, at } = run(tiles, { x: 0, y: 0 });
  assert.strictEqual(map.EvacuationAreaLoPIndex, 2);
  assert.strictEqual(map.indexCount, 3);
  assert.deepStrictEqual(at(3, 0).index, []);
});

test('the course continues from the restart tile after the evacuation zone', () => {
  const tiles = [
    tile(0, 0, STRAIGHT_H),
    tile(1, 0, STRAIGHT_H, { checkPoint: true }),
    tile(2, 0, EVAC),
    tile(3, 0, STRAIGHT_H),
    tile(4, 0, END),
  ];
  const { map, at } = run(tiles, { x: 0, y: 0 }, { x: 3, y: 0, z: 0 });
  assert.deepStrictEqual([at(0, 0).index, at(1, 0).index, at(3, 0).index, at(4, 0).index], [[0], [1], [2], [3]]);
  assert.strictEqual(map.indexCount, 4);
  assert.strictEqual(map.EvacuationAreaLoPIndex, 1);
  // Entrance from the left, exit to the right (degrees)
  assert.strictEqual(at(2, 0).evacEntrance, 270);
  assert.strictEqual(at(2, 0).evacExit, 90);
});

test('a tile marked as going up continues on the next floor', () => {
  const tiles = [
    tile(0, 0, STRAIGHT_H),
    tile(1, 0, STRAIGHT_H, { levelUp: 'right' }),
    { ...tile(2, 0, STRAIGHT_H), z: 1 },
  ];
  const { map, at } = run(tiles, { x: 0, y: 0 });
  assert.deepStrictEqual(at(2, 0, 1).index, [2]);
  assert.strictEqual(map.indexCount, 3);
});
