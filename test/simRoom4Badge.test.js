// Where the room 4 creator and the map draw a wall token's badge: against its wall's face, into the
// wall by at most most of its thickness, never through it and never apart from it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../public/javascripts/sim_editor/room4_creator.js'), 'utf8');
const ctx = { app: { controller() {}, directive() {}, factory() {} }, angular: {} };
vm.runInNewContext(src + '\nthis.SimRoom4 = SimRoom4;', ctx);
const R4 = ctx.SimRoom4;

// a vertical wall of `thick` px from x = 50, the token to its right
const wallAt = (thick) => (x, y) => x >= 50 && x < 50 + thick && y >= 0 && y < 200;

test('the anchor is the face of the wall towards the token, with the wall thickness', () => {
  const a = R4.wallAnchor(wallAt(10), 75, 100, 40);
  assert.ok(Math.abs(a.x - 60) < 0.01);
  assert.ok(Math.abs(a.y - 100) < 1);
  assert.strictEqual(a.thick, 10);
});

test('a badge reaches into a thin wall, but not through it', () => {
  for (const thick of [4, 10, 30]) {
    const t = { cx: 50 + thick + 15, cy: 100 };
    const a = R4.wallAnchor(wallAt(thick), t.cx, t.cy, 40);
    for (const r of [8, 16, 40]) {
      const at = R4.badgeOnWall(t, a, r);
      const left = at.x - r;            // the badge's edge inside the wall
      assert.ok(left < 50 + thick - 0.5, `touches the wall (thick ${thick}, r ${r})`);
      assert.ok(left > 50, `does not come out the other side (thick ${thick}, r ${r})`);
    }
  }
});

test('the same gap gives the same place, whatever gap the stamp was put down with', () => {
  const r = 16;
  const p = [62, 65, 70].map((cx) => R4.badgeOnWall({ cx, cy: 100 }, R4.wallAnchor(wallAt(10), cx, 100, 40), r).x);
  assert.ok(Math.abs(p[0] - p[1]) < 0.5 && Math.abs(p[1] - p[2]) < 0.5, JSON.stringify(p));
});

test('without a wall in reach the badge stays where the token is', () => {
  const at = R4.badgeOnWall({ cx: 150, cy: 100 }, R4.wallAnchor(wallAt(10), 150, 100, 20), 10);
  assert.deepStrictEqual([at.x, at.y], [150, 100]);
});
