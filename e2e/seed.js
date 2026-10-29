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
  // Each with the token of its own pages, as the teams API gives them
  const own = (code) => ({ document: { token: `token${code}`, answers: [] } });
  await team.create([
    { _id: oid(ids.teams.Line), competition: compId, name: 'Line Team', league: 'Line', teamCode: 'L01', ...own('L01') },
    { _id: oid(ids.teams.Maze), competition: compId, name: 'Maze Team', league: 'Maze', teamCode: 'M01', ...own('M01') },
    { _id: oid(ids.teams.Erebus), competition: compId, name: 'Sim Team', league: 'Erebus', teamCode: 'S01', ...own('S01') },
    { _id: oid(ids.teams.LineNL), competition: compId, name: 'Line Entry Team', league: 'LineNL', teamCode: 'E01', ...own('E01') },
    { _id: oid(ids.teams.MazeNL), competition: compId, name: 'Maze Entry Team', league: 'MazeNL', teamCode: 'E02', ...own('E02') },
  ]);

  // Saved through the model so the path finder numbers the tiles, as the map editor does. The tiles
  // by their ids: straight from the left to the right, a plain one and one with a gap (tile types
  // found by what they have came in no order, some with no line through them)
  const [plain, gap] = await Promise.all([
    tileType.findById('570c27c3f5a9dabe23f3af90').lean(),
    tileType.findById('58cfe0d457501b50da7afa62').lean(),
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
  // Walls around two tiles
  const walls = [[1, 0], [3, 0], [1, 2], [3, 2], [0, 1], [4, 1]].map(([x, y]) => ({ x, y, z: 0, isWall: true, isLinear: true }));
  await mazeMap.create({
    _id: oid(ids.maps.Maze),
    competition: compId, league: 'Maze', name: 'Maze Map', finished: true,
    width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      // A cognitive target on the start tile's wall, red in the centre; its rings add up to 0 (unharmed)
      {
        x: 1, y: 1, z: 0, isTile: true, isLinear: true,
        tile: { reachable: true, victims: { ...noVictims, left: 'Cognitive' }, cognitiveTargets: { left: { rings: { ring1: 'R', ring2: 'G', ring3: 'B', ring4: 'K', ring5: 'Y' } } } },
      },
      { x: 3, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: { ...noVictims, top: 'H' } } },
      ...walls,
    ],
  });
  // Entry: a red victim on the floor of the first tile and a green one on the second
  await mazeMap.create({
    _id: oid(ids.maps.MazeNL),
    competition: compId, league: 'MazeNL', leagueType: 'entry', name: 'Maze Entry Map', finished: true,
    width: 2, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      { x: 1, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: { ...noVictims, floor: 'Red' } } },
      { x: 3, y: 1, z: 0, isTile: true, isLinear: true, tile: { reachable: true, victims: { ...noVictims, floor: 'Green' } } },
      ...walls,
    ],
  });

  // For whole runs judged on the UI (scenarios.spec.js): five tiles in a row, none linear.
  // The start with a stable cognitive target, a checkpoint, a blue tile, an unharmed and a harmed
  // victim, a speed bump
  const row = (n) => [...Array(n).keys()].map((i) => 2 * i + 1);
  const wallsAround = (n) => [
    ...row(n).flatMap((x) => [{ x, y: 0 }, { x, y: 2 }]), { x: 0, y: 1 }, { x: 2 * n, y: 1 },
  ].map(({ x, y }) => ({ x, y, z: 0, isWall: true }));
  const tile = (n, props) => ({ x: 2 * n + 1, y: 1, z: 0, isTile: true, isLinear: false, tile: { reachable: true, victims: noVictims, ...props } });
  await mazeMap.create({
    _id: oid(ids.scenarioMaps.Maze),
    competition: compId, league: 'Maze', name: 'Maze Scenario Map', finished: true,
    width: 5, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      tile(0, {
        victims: { ...noVictims, top: 'Cognitive' },
        cognitiveTargets: { top: { rings: { ring1: 'G', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' } } },
      }),
      tile(1, { checkpoint: true }),
      tile(2, { blue: true }),
      tile(3, { victims: { ...noVictims, top: 'OMEGA', bottom: 'PHI' } }),
      tile(4, { speedbump: true }),
      ...wallsAround(5),
    ],
  });
  // Entry: the start with a red victim on the floor, a checkpoint, a green victim, a speed bump
  await mazeMap.create({
    _id: oid(ids.scenarioMaps.MazeNL),
    competition: compId, league: 'MazeNL', leagueType: 'entry', name: 'Maze Entry Scenario Map', finished: true,
    width: 4, length: 1, height: 1, startTile: { x: 1, y: 1, z: 0 },
    cells: [
      tile(0, { victims: { ...noVictims, floor: 'Red' } }),
      tile(1, { checkpoint: true }),
      tile(2, { victims: { ...noVictims, floor: 'Green' } }),
      tile(3, { speedbump: true }),
      ...wallsAround(4),
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
    { _id: oid(ids.runs.MazeNL), ...runRefs, team: oid(ids.teams.MazeNL), map: oid(ids.maps.MazeNL) },
  ]);
  await simRun.create([
    { _id: oid(ids.runs.Erebus), ...runRefs, team: oid(ids.teams.Erebus) },
    { _id: oid(ids.finishedRuns.Erebus), ...finished, team: oid(ids.teams.Erebus) },
  ]);
}

module.exports = { seed };
