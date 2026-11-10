// The session key: one of the app's own when none is set or the published one is, the same on
// every start; the one set otherwise.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');

let sessionSecret;
const given = process.env.SESSION_SECRET;

before(async () => {
  await db.start();
  sessionSecret = require('../helper/sessionSecret');
});
after(() => db.stop());
afterEach(() => {
  if (given === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = given;
});

test('without a key set, one is made, kept and taken again', async () => {
  delete process.env.SESSION_SECRET;
  const first = await sessionSecret();
  assert.ok(first.length >= 40);
  assert.strictEqual(await sessionSecret(), first);
});

test('the key published with the app is not taken', async () => {
  process.env.SESSION_SECRET = 'rcjscoring';
  const key = await sessionSecret();
  assert.notStrictEqual(key, 'rcjscoring');
});

test('a key of its own is taken as it is', async () => {
  process.env.SESSION_SECRET = 'a key of our own, long enough';
  assert.strictEqual(await sessionSecret(), 'a key of our own, long enough');
});
