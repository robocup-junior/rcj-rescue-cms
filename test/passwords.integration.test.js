// Passwords: kept as scrypt hashes; those kept before as salted SHA-512 still let their users in,
// and are hashed anew then. The default account is made with the password of process.env, which
// does not set it again once it is the one published with the app.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');

let user;
let crypto;

before(async () => {
  process.env.dUsername = 'defaultadmin';
  process.env.dPassword = 'adminpass';
  await db.start();
  ({ user } = require('../models/user'));
  crypto = require('../helper/crypto');
  await db.waitFor(() => user.findOne({ username: 'defaultadmin' }).lean());
});
after(() => db.stop());

const compare = (doc, password) => new Promise((resolve) => doc.comparePassword(password, resolve));
const load = (username) => user.findOne({ username }).select('+password +salt').exec();

test('a password is kept as a scrypt hash, and matches only itself', async () => {
  await user.create({ username: 'kept', password: 'correct horse' });
  const doc = await load('kept');
  assert.match(doc.password, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!doc.password.includes('correct horse'));
  assert.strictEqual(await compare(doc, 'correct horse'), true);
  assert.strictEqual(await compare(doc, 'correct hors'), false);
  assert.strictEqual(await compare(doc, { $ne: '' }), false);
});

test('a password kept as a hash of before lets its user in, and is hashed anew', async () => {
  const [hash, salt] = await new Promise((resolve) => crypto.generateHashWithSalt('old secret', (err, h, s) => resolve([h, s])));
  await user.collection.insertOne({ username: 'veteran', password: hash, salt: String(salt), competitions: [] });
  assert.strictEqual(await compare(await load('veteran'), 'wrong'), false);
  assert.strictEqual(await compare(await load('veteran'), 'old secret'), true);
  const doc = await load('veteran');
  assert.match(doc.password, /^scrypt\$/);
  assert.strictEqual(await compare(doc, 'old secret'), true);
});

test('the default account keeps the password it was given since', async () => {
  const doc = await load('defaultadmin');
  assert.strictEqual(await compare(doc, 'adminpass'), true);
  doc.password = 'a password of its own';
  await doc.save();
  // As the app starts again, with the published password in process.env
  delete require.cache[require.resolve('../models/user')];
  const mongoose = require('mongoose');
  delete mongoose.connection.models.User;
  delete mongoose.models.User;
  require('../models/user');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.strictEqual(await compare(await load('defaultadmin'), 'a password of its own'), true);
});
