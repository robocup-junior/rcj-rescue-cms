// Every route of the API, as its declaration says who may call it (helper/access.js; the table of
// them from the e2e server): called by each of those it does not let in, with the ids of a
// competition's own things in its path, query and body, it is refused before its handler (400 by
// the guard of its router, 401 by its declaration), and the competition's things are as they were.
// A route added to the API is taken in here as it is declared, with no test to write for it.
const { test, expect } = require('./fixtures');
const api = require('./api');

const LEVELS = { VIEW: 1, JUDGE: 5, ADMIN: 10, SUPERADMIN: 15 };
const fx = {};
const as = {};

test.setTimeout(5 * 60 * 1000);

test.beforeAll(async ({ playwright, baseURL }) => {
  const root = await playwright.request.newContext({ baseURL });
  await api.login(root);
  as.root = root;
  const c = (fx.competition = await api.competition(root));
  fx.other = await api.competition(root);
  [fx.Round, fx.Field, fx.Team, fx.lineTeam, fx.simTeam] = await Promise.all([
    api.round(root, c, 'R1'), api.field(root, c, 'F1'), api.team(root, c, 'Maze', 'Maze Team'),
    api.team(root, c, 'Line', 'Line Team'), api.team(root, c, 'Erebus', 'Sim Team'),
  ]);
  fx.MazeMap = await api.mazeMap(root, c, 'Maze', 'Maze Map', [{}, { checkpoint: true }]);
  fx.LineMap = await api.lineMap(root, c, 'Line', 'Line Map');
  const refs = { competition: c, round: fx.Round, field: fx.Field };
  fx.MazeRun = await api.run(root, 'maze', { ...refs, team: fx.Team, map: fx.MazeMap });
  fx.LineRun = await api.run(root, 'line', { ...refs, team: fx.lineTeam, map: fx.LineMap });
  fx.SimRun = await api.run(root, 'simulation', { ...refs, team: fx.simTeam });
  fx.TechnicalChallenge = (await (await root.get(`/api/technicalChallenge/${c}/Maze`)).json())[0]._id;
  const tokens = await (await root.get(`/api/competitions/${c}/teams/documents`)).json();
  fx.token = tokens.find((t) => t._id === fx.Team).document.token;

  // A survey the team answered, a booking, a review of the team
  const future = new Date(Date.now() + 864e5).toISOString();
  const made = async (res) => {
    expect(res.status(), await res.text()).toBeLessThan(300);
    return (await res.json()).id;
  };
  fx.survey = await made(await root.post(`/api/survey/edit/${c}`, {
    data: { competition: c, league: ['Maze'], enable: true, open: new Date(0).toISOString(), deadline: future, questions: [{ questionId: `q${Date.now()}`, type: 'input' }] },
  }));
  const answered = await root.put(`/api/survey/answer/${fx.Team}/${fx.token}/${fx.survey}`, { data: [] });
  expect(answered.ok(), await answered.text()).toBeTruthy();
  fx.surveyAnswer = (await (await root.get(`/api/survey/answer/${c}/${fx.survey}`)).json()).answers?.[0]?._id
    ?? (await (await root.get(`/api/survey/answer/${c}/${fx.survey}`)).json())[0]?._id;
  fx.reservation = await made(await root.post(`/api/reservation/config/${c}`, { data: { competition: c, league: ['Maze'], enable: true, deadline: future } }));
  const reviewed = await root.put(`/api/document/review/${fx.Team}`, { data: [] });
  expect(reviewed.ok(), await reviewed.text()).toBeTruthy();
  fx.review = (await (await root.get(`/api/document/reviews/${c}`)).json())[0]?._id;

  // The people: a viewer and a judge of the competition, the admin of another, a user to be named
  const stamp = `${Date.now()}`;
  const user = async (name, admin, competitions) => {
    const username = `${name}${stamp}`;
    expect((await root.post('/api/users', { data: { username, password: 'pass1234', admin, competitions } })).ok()).toBeTruthy();
    const context = await playwright.request.newContext({ baseURL });
    expect((await context.post('/api/auth/login', { data: { username, password: 'pass1234' } })).ok()).toBeTruthy();
    return context;
  };
  as.anonymous = await playwright.request.newContext({ baseURL });
  as.viewer = await user('viewer', false, [{ id: c, accessLevel: LEVELS.VIEW, role: ['VIEW'] }]);
  as.judge = await user('judge', false, [{ id: c, accessLevel: LEVELS.JUDGE, role: ['JUDGE'] }]);
  as.otherAdmin = await user('otheradmin', true, [{ id: fx.other, accessLevel: LEVELS.ADMIN, role: ['ADMIN'] }]);
  await user('subject', false, []);
  fx.User = (await (await root.get('/api/users')).json()).find((u) => u.username === `subject${stamp}`)._id;
  fx.routes = await (await root.get('/__e2e/routes')).json();
  for (const name of ['TechnicalChallenge', 'survey', 'surveyAnswer', 'reservation', 'review', 'token']) expect(fx[name], name).toBeTruthy();
});

test.afterAll(async () => {
  for (const context of Object.values(as)) await context.dispose();
});

/** Those a declaration does not let in. */
function refusedBy(access) {
  switch (access.kind) {
    case 'anyone': return [];
    case 'loggedIn': return ['anonymous'];
    case 'anyAdmin': return ['anonymous', 'viewer', 'judge'];
    case 'superAdmin': return ['anonymous', 'viewer', 'judge', 'otherAdmin'];
    case 'team': return ['anonymous', 'otherAdmin', ...(access.staff ? ['viewer'] : [])];
    default: {
      const level = LEVELS[access.level];
      return ['anonymous', 'otherAdmin', ...(level > LEVELS.VIEW ? ['viewer'] : []), ...(level > LEVELS.JUDGE ? ['judge'] : [])];
    }
  }
}

/** The run, map... kind a route is of, by its path. */
const kindOf = (path) => (/\/(runs|maps)\/line/.test(path) ? 'line' : /\/runs\/simulation/.test(path) ? 'sim' : 'maze');

/** A value for a parameter of the route, of the competition's things. */
function valueFor(name, route, models) {
  if (models[name]) return fx[models[name]] ?? fx[models[name].replace(/^\w/, (l) => l.toLowerCase())];
  const kind = kindOf(route.path);
  const byName = {
    competition: fx.competition, competitionId: fx.competition, competitionid: fx.competition,
    teamId: fx.Team, teamid: fx.Team, token: 'not-the-token',
    runid: { line: fx.LineRun, maze: fx.MazeRun, sim: fx.SimRun }[kind], runids: { line: fx.LineRun, maze: fx.MazeRun, sim: fx.SimRun }[kind],
    map: kind === 'line' ? fx.LineMap : fx.MazeMap, mapid: kind === 'line' ? fx.LineMap : fx.MazeMap,
    roundid: fx.Round, fieldid: fx.Field, field: fx.Field, userid: fx.User,
    resvId: fx.reservation, survId: fx.survey, surveyId: fx.survey, answerId: fx.surveyAnswer, reviewId: fx.review,
    id: route.path.startsWith('/api/technicalChallenge') ? fx.TechnicalChallenge : '0123456789abcdef01234567',
    league: 'Maze', leagueId: 'Maze', lid: 'Maze', status: '0', folder: 'Maze', lang: 'en', aLevel: '10',
  };
  return byName[name] ?? (/id$/i.test(name) ? '0123456789abcdef01234567' : 'x');
}

/** The request a route takes, with the things its declarations name. */
function requestFor(route) {
  // The models the declarations take ids of, by where
  const models = {};
  const query = {};
  let body = {};
  for (const access of route.access) {
    // A team's, by its token at the places the declaration says
    if (access.kind === 'team') {
      for (const [at, value] of [[access.teamAt, fx.Team], [access.tokenAt, 'not-the-token']]) {
        const [source, key] = at.split('.');
        if (source === 'body' && !Array.isArray(body)) body[key] = value;
        if (source === 'query') query[key] = value;
      }
    }
    for (const from of String(access.from || '').split(/ and |, /)) {
      const at = from.match(/(params|query|body)((?:\.\w+(?:\[\])?)+)|(params|query|body)(\[\])\.(\w+)/);
      if (!at) continue;
      const model = (from.match(/the competitions of the (\w+)s at/) || [])[1] || access.model;
      const value = model ? (fx[model] ?? fx[model[0].toLowerCase() + model.slice(1)]) : fx.competition;
      const where = at[0];
      if (where.startsWith('params.')) models[where.slice(7)] = model || 'competition';
      else if (where.startsWith('query.')) query[where.slice(6)] = value;
      else if (where === 'body[].competition' || /^body\[\]\./.test(where)) body = [{ [where.split('.').pop()]: value }];
      else if (/^body\.\w+\[\]\.\w+$/.test(where)) {
        const [, list, key] = where.match(/^body\.(\w+)\[\]\.(\w+)$/);
        body[list] = [{ [key]: value }];
      } else if (where.startsWith('body.') && !Array.isArray(body)) body[where.slice(5)] = value;
    }
  }
  const path = route.path.replace(/:(\w+)/g, (_, name) => encodeURIComponent(valueFor(name, route, models)));
  return { path, query, body };
}

async function snapshot() {
  const get = async (path) => (await as.root.get(path)).json();
  const c = fx.competition;
  return {
    competition: (await get(`/api/competitions/${c}`)).name,
    teams: (await get(`/api/competitions/${c}/Maze/teams`)).map((t) => t._id).sort(),
    runs: [(await get(`/api/runs/maze/${fx.MazeRun}`)).status, (await get(`/api/runs/line/${fx.LineRun}`)).status, (await get(`/api/runs/simulation/${fx.SimRun}`)).status],
    maps: [(await get(`/api/maps/maze/${fx.MazeMap}`)).name, (await get(`/api/maps/line/${fx.LineMap}`)).name],
    rounds: (await get(`/api/competitions/${c}/rounds`)).length,
    fields: (await get(`/api/competitions/${c}/fields`)).length,
  };
}

test('every route refuses those its declaration does not let in', async () => {
  expect(fx.routes.length).toBeGreaterThan(200);
  const before = await snapshot();
  const wrong = [];
  let calls = 0;
  for (const route of fx.routes) {
    const refused = [...new Set(route.access.flatMap(refusedBy))];
    if (refused.length === 0) continue;
    const { path, query, body } = requestFor(route);
    for (const role of refused) {
      const res = await as[role].fetch(path, { method: route.method, params: query, data: route.method === 'GET' ? undefined : body });
      calls++;
      if (![400, 401].includes(res.status())) wrong.push(`${role}: ${route.method} ${path} -> ${res.status()} ${(await res.text()).slice(0, 100)}`);
    }
  }
  expect(wrong, 'let in, or not refused before the handler').toEqual([]);
  expect(calls).toBeGreaterThan(300);
  expect(await snapshot()).toEqual(before);
});

/** A declaration, in words. */
function describe(access) {
  const role = access.orRole ? ` or ${access.orRole}` : '';
  switch (access.kind) {
    case 'anyone': return 'anyone';
    case 'loggedIn': return 'logged in';
    case 'anyAdmin': return 'any admin';
    case 'superAdmin': return 'super admin';
    case 'competition': return `${access.level}${role} in the competition at ${access.from}`;
    case 'of': return `${access.level}${role} in the competition of the ${access.model} at ${access.from}${access.orIf ? `, or ${access.orIf}` : ''}`;
    case 'team': return [`the team${access.teamAt !== 'params.teamId' ? ` at ${access.teamAt}` : ''} by its token${access.tokenAt !== 'params.token' ? ` at ${access.tokenAt}` : ''}`, access.staff && `${access.staff} in its competition`, access.publicDocuments && 'its public documents',
      access.competitionToken && "its competition's public token"].filter(Boolean).join(' or ') + (access.inCompetition ? `, of the competition at ${access.inCompetition}` : '');
    default: return JSON.stringify(access);
  }
}

// Who may call each route, as reviewed: a declaration changed shows here, to be looked at and the
// file written again (UPDATE_ACCESS=1 npx playwright test e2e/access.spec.js)
test('every route lets in those it was reviewed to', async () => {
  const fs = require('fs');
  const file = require('path').join(__dirname, 'access.reviewed.txt');
  const lines = fx.routes.map((route) => `${route.method} ${route.path} (${route.tier}): ${route.access.map(describe).join(' + ')}`);
  const text = `${[...new Set(lines)].join('\n')}\n`;
  if (process.env.UPDATE_ACCESS) fs.writeFileSync(file, text);
  expect(text).toBe(fs.readFileSync(file, 'utf8'));
});
