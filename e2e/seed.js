// Seed data for the e2e server: one competition with a team, map and run in each league.
// The ids are fixed so the tests can build URLs from them (see ids.js).
const mongoose = require('mongoose');
const ids = require('./ids');

const oid = (hex) => mongoose.Types.ObjectId(hex);

/** Wait until fn() resolves to a truthy value (data the models seed when they load). */
async function waitFor(fn, timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > until) throw new Error('Timed out waiting for the seed data of the models');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function seed() {
  const { competition, round, field, team } = require('../models/competition');
  const { user, ACCESSLEVELS } = require('../models/user');
  const { lineMap, tileType } = require('../models/lineMap');
  const { lineRun } = require('../models/lineRun');
  const { mazeMap } = require('../models/mazeMap');
  const { mazeRun } = require('../models/mazeRun');
  const { simRun } = require('../models/simRun');

  // The default admin and the line tile types are created when the models load
  await waitFor(() => user.findOne({ username: 'admin' }).lean());
  await waitFor(() => tileType.findOne({ gaps: { $gt: 0 } }).lean());

  const compId = oid(ids.competition);
  await competition.create({
    _id: compId,
    name: 'E2E Open',
    preparation: false,
    leagues: [
      // The entry leagues keep their ranking private
      { league: 'Line', rule: '2026', disclose: true },
      { league: 'LineNL', rule: '2026E' },
      { league: 'Maze', rule: '2026', disclose: true },
      { league: 'MazeNL', rule: '2026E' },
      { league: 'Erebus', rule: '2026', disclose: true },
    ],
  });

  await user.create({
    _id: oid(ids.judge),
    username: 'judge',
    password: 'judgepass',
    competitions: [{ id: compId, accessLevel: ACCESSLEVELS.JUDGE }],
  });

  const roundId = oid(ids.round);
  const finishedRoundId = oid(ids.finishedRound);
  const fieldId = oid(ids.field);
  await round.create({ _id: roundId, competition: compId, name: 'Round 1' });
  await round.create({ _id: finishedRoundId, competition: compId, name: 'Round 2' });
  await field.create({ _id: fieldId, competition: compId, name: 'Field A' });
  await team.create([
    { _id: oid(ids.teams.Line), competition: compId, name: 'Line Team', league: 'Line', teamCode: 'L01' },
    { _id: oid(ids.teams.Maze), competition: compId, name: 'Maze Team', league: 'Maze', teamCode: 'M01' },
    { _id: oid(ids.teams.Erebus), competition: compId, name: 'Sim Team', league: 'Erebus', teamCode: 'S01' },
    { _id: oid(ids.teams.LineNL), competition: compId, name: 'Line Entry Team', league: 'LineNL', teamCode: 'E01' },
  ]);

  // Saved through the model so the path finder numbers the tiles, as the map editor does
  const [plain, gap] = await Promise.all([
    tileType.findOne({ gaps: 0, intersections: 0, seesaw: 0 }).lean(),
    tileType.findOne({ gaps: { $gt: 0 }, intersections: 0 }).lean(),
  ]);
  const lineMapData = {
    competition: compId, tileSet: compId, finished: true,
    width: 2, length: 1, height: 1, victims: { live: 2, dead: 1 },
    startTile: { x: 0, y: 0, z: 0 },
    startTile2: { x: -1, y: -1, z: -1 },
    tiles: [
      { x: 0, y: 0, z: 0, rot: 0, tileType: plain._id },
      { x: 1, y: 0, z: 0, rot: 0, tileType: gap._id, items: { obstacles: 1 } },
    ],
  };
  await lineMap.create({ _id: oid(ids.maps.Line), league: 'Line', name: 'Line Map', ...lineMapData });
  await lineMap.create({ _id: oid(ids.maps.LineNL), league: 'LineNL', name: 'Line Entry Map', ...lineMapData });

  const noVictims = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };
  await mazeMap.create({
    _id: oid(ids.maps.Maze),
    competition: compId, league: 'Maze', name: 'Maze Map', finished: true,
    width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      { x: 1, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: noVictims } },
      { x: 3, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: { ...noVictims, top: 'H' } } },
      // Walls around the two tiles
      ...[[1, 0], [3, 0], [1, 2], [3, 2], [0, 1], [4, 1]].map(([x, y]) => ({ x, y, z: 0, isWall: true, isLinear: true })),
    ],
  });

  // Runs waiting for the judge in round 1, and finished runs (status 6), which the public may see, in round 2
  const runRefs = { competition: compId, round: roundId, field: fieldId };
  const finished = { competition: compId, round: finishedRoundId, field: fieldId, status: 6 };
  await lineRun.create([
    { _id: oid(ids.runs.Line), ...runRefs, team: oid(ids.teams.Line), map: oid(ids.maps.Line) },
    { _id: oid(ids.finishedRuns.Line), ...finished, team: oid(ids.teams.Line), map: oid(ids.maps.Line) },
    {
      _id: oid(ids.finishedRuns.LineNL), ...finished, team: oid(ids.teams.LineNL), map: oid(ids.maps.LineNL),
      nl: {
        liveVictim: [{ found: true, identified: true }, { found: true, identified: false }],
        deadVictim: [{ found: false, identified: false }],
      },
    },
  ]);
  await mazeRun.create([
    { _id: oid(ids.runs.Maze), ...runRefs, team: oid(ids.teams.Maze), map: oid(ids.maps.Maze) },
    { _id: oid(ids.finishedRuns.Maze), ...finished, team: oid(ids.teams.Maze), map: oid(ids.maps.Maze) },
  ]);
  await simRun.create([
    { _id: oid(ids.runs.Erebus), ...runRefs, team: oid(ids.teams.Erebus) },
    { _id: oid(ids.finishedRuns.Erebus), ...finished, team: oid(ids.teams.Erebus) },
  ]);
}

module.exports = { seed };
