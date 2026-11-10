// The declarations of who may call the API's routes (helper/access.js): the app does not start with
// a route that has none; a competition is taken from where the declaration says, every one named
// must be the user's, and a role there lets in as well as a level.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const mongoose = require('mongoose');
// No database here: loading the user model tries to seed the default user, which should fail at once
mongoose.set('bufferCommands', false);
const { Types } = mongoose;
const access = require('../helper/access');
const { ACCESSLEVELS } = require('../models/user');

const compA = new Types.ObjectId();
const compB = new Types.ObjectId();
const judgeA = { competitions: [{ id: compA, accessLevel: ACCESSLEVELS.JUDGE, role: [] }] };
const interviewerB = { competitions: [{ id: compB, accessLevel: ACCESSLEVELS.NONE, role: ['INTERVIEW'] }] };

/** Whether the declaration lets the request in. */
function lets(declaration, req) {
  return new Promise((resolve) => {
    const res = { status: () => ({ send: () => resolve(false) }) };
    declaration({ params: {}, query: {}, body: {}, ...req }, res, (err) => resolve(err ? err : true));
  });
}

test('the app does not start with a route that has no declaration', () => {
  const router = express.Router();
  router.get('/declared', access.anyone('open'), (req, res) => res.end());
  router.get('/forgotten', (req, res) => res.end());
  router.all('*', (req, res, next) => next());
  assert.throws(() => access.mount(express(), '/api/test', router), /GET \/api\/test\/forgotten/);
});

test('mounted routes are in the table with their declarations, behind the guards of their routers', () => {
  const routes = { public: express.Router(), admin: express.Router() };
  routes.public.get('/', access.anyone('open'), (req, res) => res.end());
  routes.admin.post('/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), (req, res) => res.end());
  const app = express();
  access.mount(app, '/api/tabled', routes);
  const tabled = access.routes().filter((r) => r.path.startsWith('/api/tabled'));
  assert.deepStrictEqual(tabled.map((r) => [r.method, r.path, r.tier, r.access[0].kind]), [
    ['GET', '/api/tabled/', 'public', 'anyone'],
    ['POST', '/api/tabled/:competitionId', 'admin', 'competition'],
  ]);
});

test('the competition is taken from where the declaration says, every one named the user\'s', async () => {
  const judge = (from) => access.competition(ACCESSLEVELS.JUDGE, from);
  assert.strictEqual(await lets(judge('params.c'), { user: judgeA, params: { c: String(compA) } }), true);
  assert.strictEqual(await lets(judge('params.c'), { user: judgeA, params: { c: String(compB) } }), false);
  assert.strictEqual(await lets(judge('body.competition'), { user: judgeA, body: { competition: String(compA) } }), true);
  assert.strictEqual(await lets(judge('body[].competition'), { user: judgeA, body: [{ competition: String(compA) }, { competition: String(compA) }] }), true);
  assert.strictEqual(await lets(judge('body[].competition'), { user: judgeA, body: [{ competition: String(compA) }, { competition: String(compB) }] }), false);
  assert.strictEqual(await lets(judge('body.data[].competition'), { user: judgeA, body: { data: [{ competition: String(compB) }] } }), false);
  assert.strictEqual(await lets(judge(['query.c', 'query.d']), { user: judgeA, query: { c: String(compA), d: String(compB) } }), false);
  // None named, or not an id: refused
  assert.strictEqual(await lets(judge('body.competition'), { user: judgeA }), false);
  assert.strictEqual(await lets(judge('params.c'), { user: judgeA, params: { c: '../x' } }), false);
  // Not logged in
  assert.strictEqual(await lets(judge('params.c'), { params: { c: String(compA) } }), false);
  // A level above the user's
  assert.strictEqual(await lets(access.competition(ACCESSLEVELS.ADMIN, 'params.c'), { user: judgeA, params: { c: String(compA) } }), false);
});

test('a role in the competition lets in as well as the level', async () => {
  const review = access.competition(ACCESSLEVELS.VIEW, 'params.c', { orRole: 'INTERVIEW' });
  assert.strictEqual(await lets(review, { user: interviewerB, params: { c: String(compB) } }), true);
  assert.strictEqual(await lets(review, { user: interviewerB, params: { c: String(compA) } }), false);
  assert.strictEqual(await lets(review, { user: judgeA, params: { c: String(compA) } }), true);
});

test('those of no competition: logged in, any admin, super admin', async () => {
  assert.strictEqual(await lets(access.loggedIn('x'), {}), false);
  assert.strictEqual(await lets(access.loggedIn('x'), { user: judgeA }), true);
  assert.strictEqual(await lets(access.anyAdmin('x'), { user: judgeA }), false);
  assert.strictEqual(await lets(access.anyAdmin('x'), { user: { ...judgeA, admin: true } }), true);
  assert.strictEqual(await lets(access.superAdmin(), { user: { admin: true, competitions: [] } }), false);
  assert.strictEqual(await lets(access.superAdmin(), { user: { superDuperAdmin: true } }), true);
});
