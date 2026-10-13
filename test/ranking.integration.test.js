// Ranking API for Maze and Line leagues: best-N selection, normalisation, adjustments and tie-breaks.
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
  const { lineRun } = require('../models/lineRun');
  models = { ...competition, mazeRun, lineRun };
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

test('equal adjusted scores are still separated by time', async () => {
  const comp = await setup({ mode: 'SUM_OF_BEST_N_GAMES', num: 1 }, {
    A: [{ score: 50, round: 'R1', min: 5, adjustment: 0 }, { score: 50, round: 'R2', min: 2, adjustment: 0 }],
  });
  const body = await (await getRanking(comp)).json();
  const a = body.ranking[0];
  // The faster run is the one that counts
  assert.deepStrictEqual([a.games.R1.used, a.games.R2.used], [false, true]);
  assert.strictEqual(a.finalScore, 50);
  assert.strictEqual(a.games.R1.score, 50);
});

/**
 * Line leagues: same ranking modes, with percentage adjustments and victims counted per zone (2026)
 * or per found/identified victim (2026E).
 * teams: { name: [{ score, round, group, min, adjustment, rescueOrder, nl, lops }] }
 */
async function setupLine(league, settings, teams) {
  const comp = await models.competition.create({ name: `line-rank-${Math.random()}`, leagues: [{ league, rule: league === 'LineNL' ? '2026E' : '2026', ...settings }] });
  const rounds = {};
  for (const name of ['R1', 'R2', 'R3']) rounds[name] = await models.round.create({ competition: comp._id, name });
  for (const [teamName, runs] of Object.entries(teams)) {
    const team = await models.team.create({ competition: comp._id, name: teamName, league });
    for (const r of runs) {
      await models.lineRun.collection.insertOne({
        competition: comp._id, team: team._id, round: rounds[r.round]._id, field: comp._id, map: comp._id,
        score: r.score, normalizationGroup: r.group || '1', time: { minutes: r.min || 0, seconds: 0 },
        LoPs: r.lops || [0], isNL: league === 'LineNL', rescueOrder: r.rescueOrder || [],
        nl: r.nl || { liveVictim: [], deadVictim: [] },
        ...(r.adjustment != null ? { adjustment: r.adjustment } : {}),
      });
    }
  }
  return comp;
}

async function getLineRanking(comp, league) {
  api.setUser(admin);
  const res = await api.request('GET', `/api/ranking/${comp._id}/${league}`);
  assert.strictEqual(res.status, 200);
  return res.json();
}

test('line: best N runs, percentage adjustment and LoPs of the counted runs', async () => {
  const comp = await setupLine('Line', { mode: 'SUM_OF_BEST_N_GAMES', num: 2 }, {
    A: [{ score: 100, round: 'R1', lops: [1, 2] }, { score: 60, round: 'R2', lops: [0] }, { score: 10, round: 'R3', lops: [5] }],
    // 200 - 25% = 150
    B: [{ score: 200, round: 'R1', adjustment: -25 }],
  });
  const body = await getLineRanking(comp, 'Line');
  assert.deepStrictEqual(names(body), ['A', 'B']);
  assert.deepStrictEqual(body.ranking.map((r) => r.finalScore), [160, 150]);
  assert.strictEqual(body.ranking[0].gameSum.lops, 3);
  assert.strictEqual(body.ranking[0].games.R3.used, false);
});

test('line: rescued victims are counted per victim and zone type', async () => {
  const live = { victimType: 'LIVE', zoneType: 'GREEN' };
  const dead = { victimType: 'DEAD', zoneType: 'RED' };
  const comp = await setupLine('Line', { mode: 'SUM_OF_BEST_N_GAMES', num: 2 }, {
    A: [{ score: 100, round: 'R1', rescueOrder: [live, live, dead] }, { score: 90, round: 'R2', rescueOrder: [live] }],
  });
  const body = await getLineRanking(comp, 'Line');
  assert.deepStrictEqual(body.ranking[0].gameSum.victims, [
    { victimType: 'LIVE', zoneType: 'GREEN', count: 3 },
    { victimType: 'DEAD', zoneType: 'RED', count: 1 },
  ]);
});

test('line entry: victims are split into identified live/dead and unidentified', async () => {
  const v = (found, identified) => ({ found, identified });
  const comp = await setupLine('LineNL', { mode: 'SUM_OF_BEST_N_GAMES', num: 1 }, {
    A: [{ score: 50, round: 'R1', nl: { liveVictim: [v(true, true), v(true, false), v(false, false)], deadVictim: [v(true, true)] } }],
  });
  const body = await getLineRanking(comp, 'LineNL');
  assert.deepStrictEqual(body.ranking[0].gameSum.victims, { live: 1, dead: 1, unknown: 1 });
});

test('line: normalised mean is relative to the best run in each group', async () => {
  const comp = await setupLine('Line', { mode: 'MEAN_OF_NORMALIZED_BEST_N_GAMES', num: 2 }, {
    A: [{ score: 100, round: 'R1', group: '1' }, { score: 20, round: 'R2', group: '2' }],
    B: [{ score: 50, round: 'R1', group: '1' }, { score: 80, round: 'R2', group: '2' }],
  });
  const body = await getLineRanking(comp, 'Line');
  // A: (1 + 0.25) / 2 = 0.625, B: (0.5 + 1) / 2 = 0.75
  assert.deepStrictEqual(names(body), ['B', 'A']);
  assert.ok(Math.abs(body.ranking[1].finalScore - 0.625) < 1e-9);
});

test('line rankings only include teams of the requested league', async () => {
  const comp = await setupLine('Line', { mode: 'SUM_OF_BEST_N_GAMES', num: 1 }, { A: [{ score: 10, round: 'R1' }] });
  const entryTeam = await models.team.create({ competition: comp._id, name: 'E', league: 'LineNL' });
  await models.lineRun.collection.insertOne({
    competition: comp._id, team: entryTeam._id, round: (await models.round.findOne({ competition: comp._id }))._id,
    score: 99, normalizationGroup: '1', time: { minutes: 0, seconds: 0 }, LoPs: [0], isNL: true, rescueOrder: [], nl: { liveVictim: [], deadVictim: [] },
  });
  const body = await getLineRanking(comp, 'Line');
  assert.deepStrictEqual(names(body), ['A']);
});
