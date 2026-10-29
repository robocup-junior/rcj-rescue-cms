// Maze scoring for each rule set. Expected values are worked out by hand from the rules.
const test = require('node:test');
const assert = require('node:assert');

const maze2026 = require('../helper/scoreCalculatorRules/2026');
const maze2026E = require('../helper/scoreCalculatorRules/2026E');

const NO_VICTIMS = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };

/** A map cell at tile grid position n (x = 2n+1). */
function cell(n, { linear = false, victims = {}, ...tileProps } = {}) {
  return { x: 2 * n + 1, y: 1, z: 0, isTile: true, isLinear: linear, tile: { victims: { ...NO_VICTIMS, ...victims }, ...tileProps } };
}

/** The judge's record for the tile at grid position n. */
function scored(n, { victims = {}, rescueKits = {}, ...items } = {}) {
  return {
    x: 2 * n + 1, y: 1, z: 0,
    scoredItems: {
      victims: { top: false, right: false, bottom: false, left: false, floor: false, ...victims },
      rescueKits: { top: 0, right: 0, bottom: 0, left: 0, floor: 0, ...rescueKits },
      ...items,
    },
  };
}

function run(cells, tiles, extra = {}) {
  return { map: { cells, leagueType: 'standard' }, tiles, LoPs: 0, exitBonus: false, misidentification: 0, ...extra };
}

test('2026: letter victim on a linear wall with two rescue kits', () => {
  const r = maze2026.calculateMazeScore(run(
    [cell(0, { linear: true, checkpoint: true, victims: { top: 'PHI' } })],
    [scored(0, { checkpoint: true, victims: { top: true }, rescueKits: { top: 2 } })],
    { LoPs: 1 }
  ));
  // checkpoint 10 + victim 5 + 2 kits on one victim 30 + reliability (10 + 20 - 15)
  assert.strictEqual(r.score, 60);
  assert.deepStrictEqual(r.victims, [{ type: 'PHI', count: 1, kits: 2 }]);
  assert.strictEqual(r.kits, 2);
});

test('2026: kits above the victim maximum are ignored, exit bonus counts stairs', () => {
  const r = maze2026.calculateMazeScore(run(
    [cell(0, { steps: true, victims: { right: 'PSI' } })],
    [scored(0, { steps: true, victims: { right: true }, rescueKits: { right: 2 } })],
    { exitBonus: true }
  ));
  // stairs 10 + victim 15 + 1 valid kit 10 + reliability (10 + 10) + exit (10 + 5)
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.kits, 1);
});

test('2026: blue tile bonus decreases with visits; only a single visit counts for reliability', () => {
  const r = maze2026.calculateMazeScore(run(
    [cell(0, { blue: true }), cell(1, { blue: true })],
    [scored(0, { blue: 1 }), scored(1, { blue: 2 })]
  ));
  // 40-10 + 40-20 + reliability 10
  assert.strictEqual(r.score, 60);
});

test('2026: cognitive target status comes from the ring colours', () => {
  const rings = { ring1: 'G', ring2: 'G', ring3: 'Y', ring4: 'Y', ring5: 'Y' }; // total 2 = Harmed
  const r = maze2026.calculateMazeScore(run(
    [cell(0, { victims: { left: 'Cognitive' }, cognitiveTargets: { left: { rings } } })],
    [scored(0, { victims: { left: true }, rescueKits: { left: 3 } })]
  ));
  // victim 30 + 2 kits 30 + reliability (10 + 20)
  assert.strictEqual(r.score, 90);
  assert.deepStrictEqual(r.victims, [{ type: 'Cognitive:H', count: 1, kits: 2 }]);
});

test('2026: rescue kits are capped at 8 per run', () => {
  const cells = [];
  const tiles = [];
  for (let n = 0; n < 5; n++) {
    cells.push(cell(n, { victims: { bottom: 'PHI' } }));
    tiles.push(scored(n, { victims: { bottom: true }, rescueKits: { bottom: 2 } }));
  }
  const r = maze2026.calculateMazeScore(run(cells, tiles));
  // victims 5 x 15 + kits 4 x 30 (the fifth victim gets none) + reliability (50 + 80)
  assert.strictEqual(r.kits, 8);
  assert.strictEqual(r.score, 75 + 120 + 130);
});

test('2026: misidentification cannot make the score negative', () => {
  const r = maze2026.calculateMazeScore(run(
    [cell(0, { checkpoint: true })],
    [scored(0, { checkpoint: true })],
    { misidentification: 3 }
  ));
  assert.strictEqual(r.score, 0);
});

test('2026E: floor victims, identification, reliability and exit bonus', () => {
  const r = maze2026E.calculateMazeScore(run(
    [
      cell(0, { linear: true, speedbump: true, victims: { floor: 'Red' } }),
      cell(1, { checkpoint: true, victims: { floor: 'Green' } }),
    ],
    [
      scored(0, { speedbump: true, victims: { floor: true }, rescueKits: { floor: 1 } }),
      scored(1, { checkpoint: true, victims: { floor: true } }),
    ],
    { LoPs: 1, exitBonus: true, misidentification: 1 }
  ));
  // bump 5 + Red 15 + identified 10 + checkpoint 10 + Green 30
  // + reliability (2x10 - 5) + exit 2x10 - misidentification 5
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.victims, [{ type: 'Red', count: 1 }, { type: 'Unknown', count: 1 }]);
});

test('2026E: victims that were not found give no points', () => {
  const r = maze2026E.calculateMazeScore(run(
    [cell(0, { victims: { floor: 'Red' } })],
    [scored(0, { rescueKits: { floor: 1 } })]
  ));
  assert.strictEqual(r.score, 0);
  assert.deepStrictEqual(r.victims, []);
});
