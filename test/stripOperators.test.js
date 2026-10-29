// What requests give has no operators of the database left in it, wherever they are; the rest is
// left as it is.
const test = require('node:test');
const assert = require('node:assert');
const stripOperators = require('../helper/stripOperators');

test('keys starting with $ are taken out, at any depth', () => {
  const req = {
    body: { username: { $ne: '' }, tiles: [{ $$hashKey: 'object:1', x: 1, items: { $gt: 0, obstacles: 2 } }], name: 'Map $1' },
    query: { competition: { $exists: true }, ended: 'true' },
  };
  let called = false;
  stripOperators(req, {}, () => { called = true; });
  assert.ok(called);
  assert.deepStrictEqual(req.body, { username: {}, tiles: [{ x: 1, items: { obstacles: 2 } }], name: 'Map $1' });
  assert.deepStrictEqual(req.query, { competition: {}, ended: 'true' });
});

test('values that are not objects are left alone', () => {
  for (const body of [undefined, null, 'text', 3, ['a', 'b']]) {
    const req = { body, query: {} };
    stripOperators(req, {}, () => {});
    assert.deepStrictEqual(req.body, body);
  }
});
