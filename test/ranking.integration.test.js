// Ranking API for Maze leagues: best-N selection, normalisation, adjustments and tie-breaks.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('./helpers/db');
const { startApi } = require('./helpers/api');

let api;
let models;

before(async () => {
  await db.start();
  const competition = require('../models/competition');
  const { mazeRun } = require('../models/mazeRun');
  models = { ...competition, mazeRun };
  const ranking = require('../routes/api/ranking');
  api = await startApi('/api/ranking', [ranking.public, ranking.private, ranking.admin]);
});

after(async () => {
  if (api) await api.close();
  await db.stop();
});

const admin = { superDuperAdmin: true, competitions: [] };
const outsider = { superDuperAdmin: false, competitions: [] };

/**
 * Create a Maze competition with the given ranking settings and runs.
 * teams: { name: [{ score, round, group, min, sec, adjustment, victims }] }
 */
async function setup(settings, teams) {
  const comp = await models.competition.create({ name: `rank-${Math.random()}`, leagues: [{ league: 'Maze', rule: '2026', ...settings }] });
  const rounds = {};
  for (const name of ['R1', 'R2', 'R3']) rounds[name] = await models.round.create({ competition: comp._id, name });
  for (const [teamName, runs] of Object.entries(teams)) {
    const team = await models.team.create({ competition: comp._id, name: teamName, league: 'Maze' });
    for (const r of runs) {
      // Inserted directly: only the stored result matters for the ranking
      await models.mazeRun.collection.insertOne({
        competition: comp._id, team: team._id, round: rounds[r.round]._id, field: comp._id, map: comp._id,
        score: r.score, normalizationGroup: r.group || '1', time: { minutes: r.min || 0, seconds: r.sec || 0 },
        LoPs: 0, misidentification: 0, distKits: 0, exitBonus: false, foundVictims: r.victims || [],
        ...(r.adjustment != null ? { adjustment: r.adjustment } : {}),
      });
    }
  }
  return comp;
}

async function getRanking(comp, user = admin) {
  api.setUser(user);
  return api.request('GET', `/api/ranking/${comp._id}/Maze`);
}

const names = (body) => body.ranking.map((r) => r.team.name);

test('sum of best N games: only the best N runs count and time breaks ties', async () => {
  const comp = await setup({ mode: 'SUM_OF_BEST_N_GAMES', num: 2 }, {
    A: [{ score: 50, round: 'R1', min: 3 }, { score: 80, round: 'R2', min: 3 }, { score: 70, round: 'R3', min: 3 }],
    B: [{ score: 100, round: 'R1' }, { score: 40, round: 'R2' }],
    C: [{ score: 100, round: 'R1', min: 2 }, { score: 50, round: 'R2', min: 2 }],
  });
  const res = await getRanking(comp);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  // A and C both have 150; C used less time
  assert.deepStrictEqual(names(body), ['C', 'A', 'B']);
  assert.deepStrictEqual(body.ranking.map((r) => r.finalScore), [150, 150, 140]);
  const a = body.ranking.find((r) => r.team.name === 'A');
  assert.deepStrictEqual([a.games.R1.used, a.games.R2.used, a.games.R3.used], [false, true, true]);
  assert.deepStrictEqual(a.gameSum.time, { minutes: 6, seconds: 0 });
  assert.deepStrictEqual(body.runGroups, ['R1', 'R2', 'R3']);
});

test('mean of normalised best N games: scores are relative to the best run in each group', async () => {
  const comp = await setup({ mode: 'MEAN_OF_NORMALIZED_BEST_N_GAMES', num: 2 }, {
    A: [{ score: 100, round: 'R1', group: '1' }, { score: 25, round: 'R2', group: '2' }],
    B: [{ score: 80, round: 'R1', group: '1' }, { score: 50, round: 'R2', group: '2' }],
  });
  const body = await (await getRanking(comp)).json();
  // A: (1.0 + 0.5) / 2 = 0.75, B: (0.8 + 1.0) / 2 = 0.9
  assert.deepStrictEqual(names(body), ['B', 'A']);
  assert.ok(Math.abs(body.ranking[0].finalScore - 0.9) < 1e-9);
  assert.ok(Math.abs(body.ranking[1].finalScore - 0.75) < 1e-9);
  assert.deepStrictEqual(body.runGroups, ['1', '2']);
});

test('score adjustment is applied before ranking', async () => {
  const comp = await setup({ mode: 'SUM_OF_BEST_N_GAMES', num: 1 }, {
    A: [{ score: 100, round: 'R1', adjustment: -20 }],
    B: [{ score: 90, round: 'R1' }],
  });
  const body = await (await getRanking(comp)).json();
  assert.deepStrictEqual(names(body), ['B', 'A']);
  assert.strictEqual(Number(body.ranking[1].finalScore), 80);
});

test('victims found in the counted runs are added up per type', async () => {
  const comp = await setup({ mode: 'SUM_OF_BEST_N_GAMES', num: 2 }, {
    A: [
      { score: 100, round: 'R1', victims: [{ type: 'PHI', count: 2 }, { type: 'PSI', count: 1 }] },
      { score: 90, round: 'R2', victims: [{ type: 'PHI', count: 3 }] },
    ],
  });
  const body = await (await getRanking(comp)).json();
  assert.deepStrictEqual(body.ranking[0].gameSum.victims, [{ type: 'PHI', count: 5 }, { type: 'PSI', count: 1 }]);
});

test('undisclosed rankings are only visible to competition staff', async () => {
  const hidden = await setup({ mode: 'SUM_OF_BEST_N_GAMES', num: 1, disclose: false }, { A: [{ score: 10, round: 'R1' }] });
  assert.strictEqual((await getRanking(hidden, outsider)).status, 401);
  assert.strictEqual((await getRanking(hidden, admin)).status, 200);

  const open = await setup({ mode: 'SUM_OF_BEST_N_GAMES', num: 1, disclose: true }, { A: [{ score: 10, round: 'R1' }] });
  assert.strictEqual((await getRanking(open, outsider)).status, 200);
});
