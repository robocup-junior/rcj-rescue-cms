// Access checks shared by the APIs: who may view, judge and administer a competition.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
// No database here: loading the user model tries to seed the default user, which should fail at once
mongoose.set('bufferCommands', false);
const { Types } = mongoose;
const auth = require('../helper/authLevels');
const { ACCESSLEVELS } = require('../models/user');

const compA = new Types.ObjectId();
const compB = new Types.ObjectId();

const superAdmin = { superDuperAdmin: true, competitions: [] };
const judgeA = { superDuperAdmin: false, competitions: [{ id: compA, accessLevel: ACCESSLEVELS.JUDGE, role: ['JUDGE'] }] };
const adminA = { superDuperAdmin: false, competitions: [{ id: compA, accessLevel: ACCESSLEVELS.ADMIN, role: ['ADMIN'] }] };
const staffB = { superDuperAdmin: false, competitions: [{ id: compB, accessLevel: ACCESSLEVELS.ADMIN, role: ['ADMIN'] }] };
const noCompetitions = { superDuperAdmin: false, competitions: [] };

test('authCompetition requires at least the given level in that competition', () => {
  const id = compA.toString();
  assert.strictEqual(auth.authCompetition(judgeA, id, ACCESSLEVELS.VIEW), true);
  assert.strictEqual(auth.authCompetition(judgeA, id, ACCESSLEVELS.JUDGE), true);
  assert.strictEqual(auth.authCompetition(judgeA, id, ACCESSLEVELS.ADMIN), false);
  assert.strictEqual(auth.authCompetition(adminA, id, ACCESSLEVELS.ADMIN), true);
  // Rights in another competition do not count
  assert.strictEqual(auth.authCompetition(staffB, id, ACCESSLEVELS.VIEW), false);
  assert.strictEqual(auth.authCompetition(noCompetitions, id, ACCESSLEVELS.VIEW), false);
  assert.strictEqual(auth.authCompetition(null, id, ACCESSLEVELS.VIEW), false);
  assert.strictEqual(auth.authCompetition(superAdmin, id, ACCESSLEVELS.SUPERADMIN), true);
  // ObjectIds are accepted as well as strings
  assert.strictEqual(auth.authCompetition(adminA, compA, ACCESSLEVELS.ADMIN), true);
});

test('competitionLevel reports the level for the competition', () => {
  const id = compA.toString();
  assert.strictEqual(auth.competitionLevel(judgeA, id), ACCESSLEVELS.JUDGE);
  assert.strictEqual(auth.competitionLevel(staffB, id), ACCESSLEVELS.NONE);
  assert.strictEqual(auth.competitionLevel(superAdmin, id), ACCESSLEVELS.SUPERADMIN);
  assert.strictEqual(auth.competitionLevel(null, id), ACCESSLEVELS.NONE);
  assert.strictEqual(auth.competitionLevel(judgeA, null), ACCESSLEVELS.NONE);
});

test('authCompetitionRole checks the role in that competition', async () => {
  assert.strictEqual(await auth.authCompetitionRole(judgeA, compA, 'JUDGE'), true);
  assert.strictEqual(await auth.authCompetitionRole(judgeA, compA, 'ADMIN'), false);
  assert.strictEqual(await auth.authCompetitionRole(superAdmin, compA, 'ADMIN'), true);
  assert.strictEqual(await auth.authCompetitionRole(noCompetitions, compA, 'VIEW'), false);
  assert.strictEqual(await auth.authCompetitionRole(undefined, compA, 'VIEW'), false);
  // Staff of other competitions only
  assert.strictEqual(await auth.authCompetitionRole(staffB, compA, 'VIEW'), false);
});

/** authViewRun: 0 = no access, 1 = full access, 2 = public view (comment and signature hidden). */
test('authViewRun: competition staff see everything', () => {
  const run = { competition: { _id: compA }, sign: { captain: '' }, status: 0 };
  assert.strictEqual(auth.authViewRun(judgeA, run, ACCESSLEVELS.VIEW), 1);
  assert.strictEqual(auth.authViewRun(superAdmin, run, ACCESSLEVELS.VIEW), 1);
  assert.strictEqual(auth.authViewRun(judgeA, { ...run, competition: compA.toString() }, ACCESSLEVELS.VIEW), 1);
  assert.strictEqual(auth.authViewRun(judgeA, { ...run, competition: compA }, ACCESSLEVELS.VIEW), 1);
});

test('authViewRun: others only see runs that are signed or finished', () => {
  const unsigned = { competition: { _id: compA }, sign: { captain: '' }, status: 2 };
  const signed = { ...unsigned, sign: { captain: 'data:image/png;base64,xx' } };
  const finished = { ...unsigned, status: 6 };
  for (const user of [null, staffB]) {
    assert.strictEqual(auth.authViewRun(user, unsigned, ACCESSLEVELS.VIEW), 0);
    assert.strictEqual(auth.authViewRun(user, signed, ACCESSLEVELS.VIEW), 2);
    assert.strictEqual(auth.authViewRun(user, finished, ACCESSLEVELS.VIEW), 2);
    // Nothing is public while the competition is in preparation
    assert.strictEqual(auth.authViewRun(user, finished, ACCESSLEVELS.VIEW, true), 0);
  }
  assert.strictEqual(auth.authViewRun(judgeA, null, ACCESSLEVELS.VIEW), 0);
});

test('authJudgeRun requires the level in the run competition', () => {
  const run = { competition: { _id: compA } };
  assert.strictEqual(auth.authJudgeRun(judgeA, run, ACCESSLEVELS.JUDGE), true);
  assert.strictEqual(auth.authJudgeRun(judgeA, run, ACCESSLEVELS.ADMIN), false);
  assert.strictEqual(auth.authJudgeRun(staffB, run, ACCESSLEVELS.JUDGE), false);
  assert.strictEqual(auth.authJudgeRun(null, run, ACCESSLEVELS.JUDGE), false);
  assert.strictEqual(auth.authJudgeRun(superAdmin, run, ACCESSLEVELS.JUDGE), true);
  assert.strictEqual(auth.authJudgeRun(judgeA, { competition: compA.toString() }, ACCESSLEVELS.JUDGE), true);
});
