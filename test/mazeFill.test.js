// Reachable tiles computed on the server when a maze map is saved as finished.
const test = require('node:test');
const assert = require('node:assert');
const { floodFill } = require('../helper/mazeFill');

const OUTER_WALLS_1x2 = [[1, 0], [0, 1], [2, 1], [0, 3], [2, 3], [1, 4]];

function map({ width, length, height = 1, walls = [], tiles = [] }) {
  const cells = [{ x: 1, y: 1, z: 0, isTile: true, tile: {} }, ...tiles];
  for (const [x, y, z = 0] of walls) cells.push({ x, y, z, isWall: true });
  return { width, length, height, startTile: { x: 1, y: 1, z: 0 }, cells };
}

const tileKeys = (m) => m.cells.filter((c) => c.isTile).map((c) => `${c.x},${c.y},${c.z}`).sort();
const reachableKeys = (m) => m.cells.filter((c) => c.isTile && c.tile.reachable).map((c) => `${c.x},${c.y},${c.z}`).sort();

test('every tile inside the outer walls becomes reachable', () => {
  const m = map({ width: 1, length: 2, walls: OUTER_WALLS_1x2 });
  floodFill(m);
  assert.deepStrictEqual(reachableKeys(m), ['1,1,0', '1,3,0']);
});

test('without outer walls the fill stays inside the map and creates each tile once', () => {
  const m = map({ width: 1, length: 2 });
  floodFill(m);
  assert.deepStrictEqual(tileKeys(m), ['1,1,0', '1,3,0']);
  assert.deepStrictEqual(reachableKeys(m), ['1,1,0', '1,3,0']);
});

test('walls block the fill', () => {
  // 2 x 1 map with a wall between the two tiles
  const m = map({ width: 2, length: 1, walls: [[2, 1]], tiles: [{ x: 3, y: 1, z: 0, isTile: true, tile: {} }] });
  floodFill(m);
  assert.deepStrictEqual(reachableKeys(m), ['1,1,0']);
});

test('an elevator continues the fill on the other floor', () => {
  const m = map({ width: 1, length: 1, height: 2, walls: [[1, 0, 1], [0, 1, 1], [2, 1, 1], [1, 2, 1]] });
  m.cells[0].tile.changeFloorTo = 1;
  floodFill(m);
  assert.deepStrictEqual(reachableKeys(m), ['1,1,0', '1,1,1']);
});
