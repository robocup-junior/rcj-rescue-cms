// Cognitive targets, drawn from their rings (ring1 in the centre) by CSS on the pages and as circles on the server.
const test = require('node:test');
const assert = require('node:assert');

const cognitiveTarget = require('../public/javascripts/cognitive_target');

const rings = { ring1: 'R', ring2: 'G', ring3: 'B', ring4: 'K', ring5: 'Y' };

test('the colour code is read from the rings or such a code, centre first', () => {
  assert.strictEqual(cognitiveTarget.code(rings), 'RGBKY');
  assert.strictEqual(cognitiveTarget.code('RGBKY'), 'RGBKY');
  for (const none of [undefined, null, '', 'RGBK', 'RGBKX', { ring1: 'R' }]) {
    assert.strictEqual(cognitiveTarget.code(none), '');
  }
});

test('the circles go from the outside in, ring5 first', () => {
  const { COLORS } = cognitiveTarget;
  assert.deepStrictEqual(cognitiveTarget.circles(rings), [
    { radius: 1, color: COLORS.Y },
    { radius: 0.8, color: COLORS.K },
    { radius: 0.6, color: COLORS.B },
    { radius: 0.4, color: COLORS.G },
    { radius: 0.2, color: COLORS.R },
  ]);
  assert.deepStrictEqual(cognitiveTarget.circles(null), []);
});

test('the CSS background has the rings in order from the centre, and nothing for no target', () => {
  const { COLORS } = cognitiveTarget;
  const background = cognitiveTarget.background(rings);
  const order = ['R', 'G', 'B', 'K', 'Y'].map((c) => background.indexOf(COLORS[c]));
  assert.ok(order.every((at, i) => at > 0 && (i == 0 || at > order[i - 1])), background);
  assert.strictEqual(cognitiveTarget.background(null), 'none');
});

test('a target on a side of a tile is half the tile, against that wall', () => {
  const at = (side) => {
    const s = cognitiveTarget.sideStyle(rings, side);
    return [s.left, s.top, s.width, s.height];
  };
  assert.deepStrictEqual(at('top'), ['25%', '0%', '50%', '50%']);
  assert.deepStrictEqual(at('right'), ['50%', '25%', '50%', '50%']);
  assert.deepStrictEqual(at('bottom'), ['25%', '50%', '50%', '50%']);
  assert.deepStrictEqual(at('left'), ['0%', '25%', '50%', '50%']);
});
