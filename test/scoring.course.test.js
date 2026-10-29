// A whole course for each rule set, with every scoring element on it, some scored and some not:
// the score of the run is checked against the sum worked out by hand from the rules, element by
// element (scoring.line.test.js and scoring.maze.test.js take the rules one at a time).
const test = require('node:test');
const assert = require('node:assert');

const rules2026 = require('../helper/scoreCalculatorRules/2026');
const rules2026E = require('../helper/scoreCalculatorRules/2026E');

const item = (name, scored = true, count = 1) => ({ item: name, scored, count });
const tile = (...scoredItems) => ({ scoredItems });

test('line 2026: a course of three checkpoints, every element, the evacuation zone and the exit', () => {
  const run = {
    // A lack of progress in the first section, two in the third, one in the last (the evacuation zone)
    LoPs: [1, 0, 2, 1],
    map: { victims: { live: 2, dead: 1 }, EvacuationAreaLoPIndex: 3 },
    tiles: [
      tile(), // 0: the start
      tile(item('gap')), // 1: 10
      tile(item('intersection', true, 2)), // 2: 2 x 10
      tile(item('checkpoint')), // 3: 3 tiles x (5 - 1 LoP x 2) = 9
      tile(item('obstacle'), item('speedbump')), // 4: 20 + 10
      tile(item('ramp')), // 5: 10
      tile(item('seesaw', false)), // 6: not passed
      tile(item('checkpoint')), // 7: 4 tiles x 5 = 20
      tile(item('gap')), // 8: 10
      tile(item('checkpoint', false)), // 9: not reached, though its section ends there
      tile(item('seesaw', true, 2)), // 10: 2 x 20
      tile(), // 11: the evacuation zone
    ],
    rescueOrder: [
      { victimType: 'LIVE', zoneType: 'GREEN' },
      { victimType: 'DEAD', zoneType: 'RED' }, // before the live ones are all rescued: not counted
      { victimType: 'LIVE', zoneType: 'RED' }, // to the wrong zone
      { victimType: 'LIVE', zoneType: 'GREEN' },
      { victimType: 'DEAD', zoneType: 'RED' },
      { victimType: 'DEAD', zoneType: 'GREEN' }, // to the wrong zone
    ],
    exitBonus: true,
    showedUp: true,
  };
  const result = rules2026.calculateLineScore(run);

  const elements = 10 + 20 + 20 + 10 + 10 + 10 + 2 * 20;
  const checkpoints = 9 + 20 + 0;
  // 60 - 4 LoPs x 5, and the 2 tiles after the last checkpoint x (5 - 1 LoP x 2)
  const exit = 60 - 4 * 5 + 2 * (5 - 2);
  const raw = elements + checkpoints + exit + 5;
  assert.strictEqual(raw, 200);
  assert.strictEqual(result.raw_score, raw);
  // 3 victims rescued, each x (1.4 - 1 LoP in the zone x 0.05)
  assert.ok(Math.abs(result.multiplier - 1.35 ** 3) < 1e-9);
  assert.strictEqual(result.score, Math.round(raw * 1.35 ** 3));
});

test('line 2026: the rescue multiplier goes no lower than 1.25 for the lacks of progress in the zone', () => {
  const result = rules2026.calculateLineScore({
    LoPs: [0, 6],
    map: { victims: { live: 1, dead: 0 }, EvacuationAreaLoPIndex: 1 },
    tiles: [tile(), tile(item('gap'))],
    rescueOrder: [{ victimType: 'LIVE', zoneType: 'GREEN' }],
    exitBonus: false,
  });
  assert.ok(Math.abs(result.multiplier - 1.25) < 1e-9);
  assert.strictEqual(result.score, Math.round(15 * 1.25));
});

test('line 2026E: a course of two checkpoints, every element, the victims and the exit', () => {
  const run = {
    LoPs: [0, 1],
    tiles: [
      tile(), // 0: the start
      tile(item('gap')), // 1: 10
      tile(item('intersection', true, 2)), // 2: no element in the entry rules
      tile(item('obstacle', true, 2), item('speedbump')), // 3: 2 x 20 + 10
      tile(item('checkpoint')), // 4: 4 tiles x 5 = 20
      tile(item('ramp'), item('seesaw')), // 5: 10, the seesaw no element
      tile(item('checkpoint')), // 6: 2 tiles x (5 - 1 LoP x 2) = 6
    ],
    nl: {
      liveVictim: [{ found: true, identified: true }, { found: true, identified: false }],
      deadVictim: [{ found: true, identified: true }],
    },
    exitBonus: true,
  };
  const result = rules2026E.calculateLineScore(run);
  const raw = 10 + 40 + 10 + 20 + 10 + 6 + 30 + 5;
  assert.strictEqual(result.raw_score, raw);
  // live: found 10 + identified 20, found 10; dead: found 10 + identified 10
  assert.strictEqual(result.score, raw + 30 + 10 + 20);
  assert.strictEqual(result.multiplier, 1);
});

const NO_VICTIMS = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };

/** A map cell at tile grid position n of floor z. */
function cell(n, z, { linear = false, victims = {}, ...tileProps } = {}) {
  return { x: 2 * n + 1, y: 1, z, isTile: true, isLinear: linear, tile: { victims: { ...NO_VICTIMS, ...victims }, ...tileProps } };
}

/** The judge's record for the tile at grid position n of floor z. */
function scored(n, z, { victims = {}, rescueKits = {}, ...items } = {}) {
  return {
    x: 2 * n + 1, y: 1, z,
    scoredItems: {
      victims: { top: false, right: false, bottom: false, left: false, floor: false, ...victims },
      rescueKits: { top: 0, right: 0, bottom: 0, left: 0, floor: 0, ...rescueKits },
      ...items,
    },
  };
}

const rings = (ring1, ring2, ring3, ring4, ring5) => ({ rings: { ring1, ring2, ring3, ring4, ring5 } });

test('maze 2026: two floors, every victim and element, linear and floating walls', () => {
  const cells = [
    // The ground floor
    cell(0, 0, { linear: true, victims: { top: 'PHI' } }),
    cell(1, 0, { linear: true, checkpoint: true, victims: { left: 'PSI' } }),
    cell(2, 0, { speedbump: true, victims: { right: 'OMEGA' } }),
    cell(3, 0, { blue: true }),
    cell(4, 0, { blue: true }),
    cell(5, 0, { ramp: true }),
    // Up the ramp: cognitive targets, harmed (2), stable (1) and unharmed (0)
    cell(0, 1, { linear: true, victims: { top: 'Cognitive' }, cognitiveTargets: { top: rings('G', 'G', 'Y', 'Y', 'Y') } }),
    cell(1, 1, { victims: { bottom: 'Cognitive' }, cognitiveTargets: { bottom: rings('G', 'Y', 'Y', 'Y', 'Y') } }),
    cell(2, 1, { victims: { left: 'Cognitive' }, cognitiveTargets: { left: rings('R', 'G', 'B', 'K', 'Y') } }),
    cell(3, 1, { steps: true, victims: { right: 'PHI' } }),
    cell(4, 1, { checkpoint: true }),
  ];
  const tiles = [
    scored(0, 0, { victims: { top: true }, rescueKits: { top: 2 } }), // harmed letter, linear: 5; 2 kits: 30
    scored(1, 0, { checkpoint: true, victims: { left: true }, rescueKits: { left: 2 } }), // 10; stable: 5; 1 kit of the 2: 10
    scored(2, 0, { speedbump: true, victims: { right: true }, rescueKits: { right: 1 } }), // 5; unharmed: 15; its kit not one
    scored(3, 0, { blue: 1 }), // 40 - 1 visit x 10
    scored(4, 0, { blue: 3 }), // 40 - 3 visits x 10, not counted as visited once
    scored(5, 0, { ramp: true }), // 10
    scored(0, 1, { victims: { top: true }, rescueKits: { top: 2 } }), // cognitive, linear: 10; 2 kits: 30
    scored(1, 1, { victims: { bottom: true }, rescueKits: { bottom: 2 } }), // 30; 1 kit of the 2: 10
    scored(2, 1, { victims: { left: true }, rescueKits: { left: 1 } }), // 30; its kit not one
    scored(3, 1, { steps: true, rescueKits: { right: 2 } }), // 10; kits for a victim not found
    scored(4, 1, { ramp: true }), // the checkpoint not reached; no ramp there
  ];
  const result = rules2026.calculateMazeScore({
    map: { cells, leagueType: 'standard' }, tiles, LoPs: 2, exitBonus: true, misidentification: 2,
  });

  const victims = 5 + 5 + 15 + 10 + 30 + 30;
  const kits = 30 + 10 + 30 + 10;
  const elements = 10 + 5 + 30 + 10 + 10 + 10;
  // 6 victims x 10 + 6 kits x 10 + 1 blue tile visited once x 10 - 2 LoPs x 15
  const reliability = 60 + 60 + 10 - 30;
  // 6 victims x 10 + 1 blue tile x 10 + 1 stairs x 5 + 1 ramp x 5
  const exit = 60 + 10 + 5 + 5;
  assert.strictEqual(result.score, victims + kits + elements + reliability + exit - 2 * 5);
  assert.strictEqual(result.score, 420);
  assert.strictEqual(result.kits, 6);
  assert.deepStrictEqual(result.victims, [
    { type: 'PHI', count: 1, kits: 2 },
    { type: 'PSI', count: 1, kits: 1 },
    { type: 'OMEGA', count: 1, kits: 0 },
    { type: 'Cognitive:H', count: 1, kits: 2 },
    { type: 'Cognitive:S', count: 1, kits: 1 },
    { type: 'Cognitive:U', count: 1, kits: 0 },
  ]);
});

test('maze 2026E: floor victims identified or not, linear or not, and every element', () => {
  const cells = [
    cell(0, 0, { linear: true, victims: { floor: 'Red' } }),
    cell(1, 0, { victims: { floor: 'Yellow' } }),
    cell(2, 0, { victims: { floor: 'Green' } }),
    cell(3, 0, { linear: true, speedbump: true, checkpoint: true }),
    cell(4, 0, { victims: { floor: 'Red' } }),
    cell(5, 0, { checkpoint: true }),
  ];
  const tiles = [
    scored(0, 0, { victims: { floor: true }, rescueKits: { floor: 1 } }), // linear: 15; identified: 10
    scored(1, 0, { victims: { floor: true } }), // 30, not identified
    scored(2, 0, { victims: { floor: true }, rescueKits: { floor: 2 } }), // 30; identified: 10, once
    scored(3, 0, { speedbump: true, checkpoint: true }), // 5 + 10
    scored(4, 0, { rescueKits: { floor: 1 } }), // a kit for a victim not found
    scored(5, 0, { speedbump: true }), // the checkpoint not reached; no speed bump there
  ];
  const result = rules2026E.calculateMazeScore({
    map: { cells, leagueType: 'entry' }, tiles, LoPs: 3, exitBonus: true, misidentification: 1,
  });
  // victims 15 + 10 + 30 + 30 + 10, elements 15; reliability 3 victims x 10 - 3 LoPs x 5;
  // exit 3 victims x 10; - 1 misidentification x 5
  assert.strictEqual(result.score, 95 + 15 + (30 - 15) + 30 - 5);
  assert.deepStrictEqual(result.victims, [{ type: 'Red', count: 1 }, { type: 'Unknown', count: 1 }, { type: 'Green', count: 1 }]);
});
