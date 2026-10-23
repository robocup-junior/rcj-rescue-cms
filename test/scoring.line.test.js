// Line scoring for each rule set. Expected values are worked out by hand from the rules.
const test = require('node:test');
const assert = require('node:assert');

const line2026 = require('../helper/scoreCalculatorRules/2026');
const line2026E = require('../helper/scoreCalculatorRules/2026E');

const item = (name, scored = true, count = 1) => ({ item: name, scored, count });
const tile = (...scoredItems) => ({ scoredItems });

function baseRun(overrides = {}) {
  return {
    LoPs: [0, 0, 0],
    tiles: [],
    rescueOrder: [],
    exitBonus: false,
    showedUp: false,
    map: { victims: { live: 2, dead: 1 }, EvacuationAreaLoPIndex: 1 },
    nl: { liveVictim: [], deadVictim: [] },
    ...overrides,
  };
}

test('2026: scoring elements and checkpoint points', () => {
  const run = baseRun({
    tiles: [
      tile(),
      tile(item('gap')), // 10
      tile(item('obstacle', true, 2)), // 40
      tile(item('checkpoint')), // 3 tiles x 5 = 15
      tile(item('speedbump'), item('intersection', true, 2)), // 10 + 20
      tile(item('ramp'), item('seesaw')), // 10 + 20
    ],
  });
  const result = line2026.calculateLineScore(run);
  // 10 + 40 + 15 + 30 + 30 = 125, +5 for starting
  assert.strictEqual(result.raw_score, 130);
  assert.strictEqual(result.score, 130);
  assert.strictEqual(result.multiplier, 1);
});

test('2026: unscored items give no points and LoPs reduce checkpoint points', () => {
  const run = baseRun({
    LoPs: [1, 0, 0],
    tiles: [tile(), tile(item('gap', false)), tile(item('checkpoint'))],
  });
  const result = line2026.calculateLineScore(run);
  // checkpoint: 2 tiles x (5 - 2*1) = 6, +5 for starting
  assert.strictEqual(result.raw_score, 11);
});

test('2026: no score at all when the robot never started', () => {
  const result = line2026.calculateLineScore(baseRun({ tiles: [tile(), tile(item('gap', false))] }));
  assert.strictEqual(result.score, 0);
});

test('2026: evacuation zone multiplier per correctly rescued victim', () => {
  const run = baseRun({
    showedUp: true,
    tiles: [tile(item('gap'))],
    rescueOrder: [
      { victimType: 'LIVE', zoneType: 'GREEN' },
      { victimType: 'LIVE', zoneType: 'RED' }, // wrong zone: ignored
      { victimType: 'LIVE', zoneType: 'GREEN' },
      { victimType: 'DEAD', zoneType: 'RED' },
    ],
  });
  const result = line2026.calculateLineScore(run);
  // raw 10 + 5 = 15, multiplier 1.4^3
  assert.strictEqual(result.raw_score, 15);
  assert.ok(Math.abs(result.multiplier - 1.4 ** 3) < 1e-9);
  assert.strictEqual(result.score, Math.round(15 * 1.4 ** 3));
});

test('2026: dead victim before all live victims does not count', () => {
  const run = baseRun({
    showedUp: true,
    rescueOrder: [
      { victimType: 'DEAD', zoneType: 'RED' },
      { victimType: 'LIVE', zoneType: 'GREEN' },
    ],
  });
  const result = line2026.calculateLineScore(run);
  assert.ok(Math.abs(result.multiplier - 1.4) < 1e-9);
});

test('2026: exit bonus depends on total LoPs and counts the last section', () => {
  const run = baseRun({
    LoPs: [1, 1, 0],
    exitBonus: true,
    tiles: [tile(), tile(item('checkpoint')), tile(), tile()],
  });
  const result = line2026.calculateLineScore(run);
  // checkpoint: 1 tile x (5-2) = 3; exit: 60 - 5*2 = 50; last section: 2 tiles x (5-2) = 6; +5
  assert.strictEqual(result.raw_score, 64);
});

test('2026E: intersections are not scoring elements', () => {
  const run = baseRun({ showedUp: true, tiles: [tile(item('intersection', true, 2))] });
  assert.strictEqual(line2026E.calculateLineScore(run).score, 5);
});

test('2026E: victims are scored as found / identified', () => {
  const run = baseRun({
    tiles: [tile(item('gap'))],
    nl: {
      liveVictim: [{ found: true, identified: true }, { found: true, identified: false }],
      deadVictim: [{ found: true, identified: true }, { found: false, identified: false }],
    },
  });
  const result = line2026E.calculateLineScore(run);
  // raw: 10 + 5; live: 10+20, 10; dead: 10+10
  assert.strictEqual(result.raw_score, 15);
  assert.strictEqual(result.score, 15 + 30 + 10 + 20);
  assert.strictEqual(result.multiplier, 1);
});

test('2026E: exit bonus is a fixed 30 points', () => {
  const run = baseRun({ exitBonus: true, tiles: [tile()] });
  assert.strictEqual(line2026E.calculateLineScore(run).score, 35);
});
