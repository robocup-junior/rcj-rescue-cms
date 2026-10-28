// Test data made through the admin API, as the admin pages make it: a competition of its own for a
// test, with its rounds, fields, teams, maps and runs. Takes an API request context logged in as the
// admin (a page's request after test.use({ user: 'admin' }), or one logged in with login()).
const { expect } = require('@playwright/test');
const { USERS } = require('./fixtures');

async function login(request, user = 'admin') {
  expect((await request.post('/api/auth/login', { data: USERS[user] })).ok(), `login as ${user}`).toBeTruthy();
}

async function post(request, path, data) {
  const res = await request.post(path, { data });
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBeLessThan(300);
  return (await res.json()).id;
}

/** A competition of its own, with every league; its id. */
const competition = (request, name = `E2E ${Date.now()} ${Math.random()}`) => post(request, '/api/competitions', { name });
const round = (request, competition, name) => post(request, '/api/rounds', { competition, name });
const field = (request, competition, name) => post(request, '/api/fields', { competition, name });
const team = (request, competition, league, name, teamCode = name) => post(request, '/api/teams', { competition, league, name, teamCode });

const NO_VICTIMS = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };

/** A maze map of tiles in a row (each the tile's properties), walls around them, none linear. */
function mazeMap(request, competition, league, name, tiles) {
  const n = tiles.length;
  const walls = [];
  for (let i = 0; i < n; i++) walls.push({ x: 2 * i + 1, y: 0 }, { x: 2 * i + 1, y: 2 });
  walls.push({ x: 0, y: 1 }, { x: 2 * n, y: 1 });
  return post(request, '/api/maps/maze', {
    competition, league, name, finished: true, width: n, length: 1, height: 1,
    leagueType: league.endsWith('NL') ? 'entry' : 'standard',
    startTile: { x: 1, y: 1, z: 0 },
    cells: [
      ...tiles.map((tile, i) => ({ x: 2 * i + 1, y: 1, z: 0, isTile: true, isLinear: false, tile: { reachable: true, victims: NO_VICTIMS, ...tile } })),
      ...walls.map(({ x, y }) => ({ x, y, z: 0, isWall: true })),
    ],
  });
}

/** A run waiting for the judge; kind is line, maze or simulation. */
const run = (request, kind, data) => post(request, `/api/runs/${kind}`, data);

/**
 * The mails the app queued to an address, newest first: there is no mail server in the tests, so
 * they are read from the app's mail queue (Redis), as the queue worker would send them.
 */
async function mailsTo(address) {
  const Queue = require('bull');
  const queue = new Queue('mail queue', {
    redis: { port: process.env.REDIS_PORT || 6379, host: process.env.REDIS_HOST || 'localhost' },
    prefix: 'e2e', // the e2e server's (server.js)
  });
  try {
    const jobs = await queue.getJobs(['waiting', 'active', 'delayed', 'failed', 'completed']);
    return jobs.filter((job) => job && job.data.message && [].concat(job.data.message.to).join(' ').includes(address))
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((job) => job.data.message);
  } finally {
    await queue.close();
  }
}

module.exports = { login, competition, round, field, team, mazeMap, run, mailsTo, NO_VICTIMS };
