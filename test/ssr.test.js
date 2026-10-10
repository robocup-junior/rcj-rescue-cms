// Server-side map images are used for PDFs and PNG downloads; make sure they still render.
const test = require('node:test');
const assert = require('node:assert');

const mazeSSR = require('../helper/mazeSSR');
const lineSSR = require('../helper/lineSSR');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function mazeMap(floorVictim) {
  // 2 x 1 tiles surrounded by walls
  const cells = [
    { x: 1, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: floorVictim } } },
    { x: 3, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, checkpoint: true, victims: { top: 'PHI', right: 'None', bottom: 'None', left: 'None', floor: 'None' } } },
  ];
  for (const [x, y] of [[1, 0], [3, 0], [1, 2], [3, 2], [0, 1], [4, 1]]) cells.push({ x, y, z: 0, isWall: true, isLinear: true });
  return { width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 }, cells };
}

test('maze map renders to PNG', async () => {
  const png = await mazeSSR.generatePNG(mazeMap('None'), '2026');
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
});

test('maze map draws Entry floor victims', async () => {
  const without = await mazeSSR.generatePNG(mazeMap('None'), '2026E');
  const withVictim = await mazeSSR.generatePNG(mazeMap('Red'), '2026E');
  assert.ok(withVictim.subarray(0, 8).equals(PNG_SIGNATURE));
  assert.ok(!withVictim.equals(without), 'the floor victim should change the image');
});

test('empty line map renders to PNG', async () => {
  const png = await lineSSR.generatePNG({ width: 1, length: 1, height: 1, tiles: [], startTile: { x: 0, y: 0, z: 0 } }, '2026');
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
});
