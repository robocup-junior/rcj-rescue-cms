// Server-side map images are used for PDFs and PNG downloads; make sure they still render.
const test = require('node:test');
const assert = require('node:assert');

const { loadImage, createCanvas } = require('@napi-rs/canvas');
const mazeSSR = require('../helper/mazeSSR');
const lineSSR = require('../helper/lineSSR');
const { COLORS } = require('../public/javascripts/cognitive_target');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function mazeMap(floorVictim, firstTile = {}) {
  // 2 x 1 tiles surrounded by walls
  const cells = [
    { x: 1, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: floorVictim }, ...firstTile } },
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

/** The pixels of a PNG of each colour ('#rrggbb'), counted. */
async function colourCounts(png) {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    const hex = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    counts[hex] = (counts[hex] || 0) + 1;
  }
  return counts;
}

test('maze map draws a cognitive target as its rings, the inner ones smaller', async () => {
  const rings = { ring1: 'R', ring2: 'G', ring3: 'G', ring4: 'G', ring5: 'B' };
  const counts = await colourCounts(await mazeSSR.generatePNG(mazeMap('None', {
    victims: { top: 'None', right: 'None', bottom: 'None', left: 'Cognitive', floor: 'None' },
    cognitiveTargets: { left: { rings } },
  }), '2026'));
  const without = await colourCounts(await mazeSSR.generatePNG(mazeMap('None'), '2026'));
  for (const c of ['R', 'G', 'B']) assert.ok(!without[COLORS[c]], `${c} without a target`);
  // The centre ring (1 of 25 parts of the target) is smaller than the next three (15), and the outer one (9)
  const [red, green, blue] = ['R', 'G', 'B'].map((c) => counts[COLORS[c]] || 0);
  assert.ok(red > 0, 'the centre is drawn');
  assert.ok(green > red * 8 && green < red * 22, `green ${green} to red ${red}`);
  assert.ok(blue > red * 4 && blue < red * 14, `blue ${blue} to red ${red}`);
});

test('empty line map renders to PNG', async () => {
  const png = await lineSSR.generatePNG({ width: 1, length: 1, height: 1, tiles: [], startTile: { x: 0, y: 0, z: 0 } }, '2026');
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
});
