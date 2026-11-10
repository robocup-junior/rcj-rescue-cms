/**
 * Who may call each API route, said in one place: its declaration, the middleware that comes before
 * its handler, e.g.
 *
 *   adminRouter.put('/:map', access.of(mazeMap, 'params.map', ACCESSLEVELS.ADMIN), function ...)
 *   adminRouter.post('/', access.competition(ACCESSLEVELS.ADMIN, 'body.competition'), function ...)
 *
 * The rights are taken from what the request names, as it is stored: the competition a map, a run,
 * a team... is of, not one the request says it is of. Those refused get 401 before the handler.
 *
 * The routers are mounted with mount(), which finds every route that has no declaration and stops
 * the app from starting, and keeps a table of the routes and their declarations (routes()), which
 * the tests take every route of (e2e/access.spec.js).
 */
const { ObjectId } = require('mongoose').Types;
const pass = require('../config/pass');
const { authCompetition, authCompetitionRole, NO_AUTHORITY } = require('./authLevels');
const { ACCESSLEVELS } = require('../models/user');

const ACCESS = Symbol('access');
const LEVEL_NAMES = Object.fromEntries(Object.entries(ACCESSLEVELS).map(([name, level]) => [level, name]));

/**
 * The values at a place of the request: 'params.id', 'body.competition', 'query.run'; with [] after
 * a part, of each element of the array there ('body[].competition', 'body.data[]._id'); or what a
 * function of the request gives.
 */
async function valuesAt(req, from) {
  if (Array.isArray(from)) return (await Promise.all(from.map((each) => valuesAt(req, each)))).flat();
  if (typeof from === 'function') return [].concat((await from(req)) ?? []).filter((value) => value != null);
  let values = [req];
  for (const part of from.split('.')) {
    const [, key, each] = part.match(/^(\w+)(\[\])?$/);
    values = values.map((value) => (value == null ? undefined : value[key]));
    if (each) values = values.flatMap((value) => (Array.isArray(value) ? value : []));
  }
  return values.flatMap((value) => (Array.isArray(value) ? value : [value])).filter((value) => value != null);
}

/**
 * For a declaration's from: the competitions of the stored things the request names at from (ids,
 * or ids joined with commas).
 */
function competitionsOf(model, from) {
  const resolve = async (req) => {
    const ids = (await valuesAt(req, from)).flatMap((id) => String(id).split(',')).filter((id) => ObjectId.isValid(id));
    if (ids.length == 0) return [];
    return (await model.find({ _id: { $in: ids } }).select('competition').lean().exec()).map((thing) => thing.competition);
  };
  resolve.toString = () => `the competitions of the ${model.modelName}s at ${from}`;
  return resolve;
}

/**
 * For of()'s orIf: the map at from is of a run that anyone may see (signed by its team, or
 * approved) in a competition not in preparation, as authViewRun has it. Maps are kept from anyone
 * else until then: the courses are not known before they are run.
 */
function mapOfRunShown(runModel, from) {
  const shown = async (req) => {
    const [id] = await valuesAt(req, from);
    if (!ObjectId.isValid(String(id))) return false;
    const runs = await runModel.find({ map: id, $or: [{ status: 6 }, { 'sign.captain': { $nin: ['', null] } }] })
      .select('competition').populate('competition', 'preparation').lean().exec();
    return runs.some((run) => run.competition && !run.competition.preparation);
  };
  shown.toString = () => 'it is the map of a run anyone may see';
  return shown;
}

/** The level in the competition, or one of the roles there (orRole: a role or a list of them). */
async function allowedIn(user, competitionId, level, orRole) {
  if (authCompetition(user, String(competitionId), level)) return true;
  for (const role of [].concat(orRole || [])) {
    if (await authCompetitionRole(user, competitionId, role)) return true;
  }
  return false;
}

function declare(spec, check) {
  const middleware = async function access(req, res, next) {
    let allowed;
    try {
      allowed = await check(req);
    } catch (err) {
      return next(err);
    }
    if (allowed) return next();
    return res.status(401).send(NO_AUTHORITY);
  };
  middleware[ACCESS] = spec;
  return middleware;
}

const isAdmin = (user) => !!user && (user.admin === true || user.superDuperAdmin === true);

/** Anyone, logged in or not; note: what the handler shows them, or why it is open. */
function anyone(note) {
  return declare({ kind: 'anyone', note }, () => true);
}

/** Anyone logged in, for what is theirs or of no competition. */
function loggedIn(note) {
  return declare({ kind: 'loggedIn', note }, (req) => req.user != null);
}

/** An admin of any competition, for what is of none (templates, signage, tile sets). */
function anyAdmin(note) {
  return declare({ kind: 'anyAdmin', note }, (req) => isAdmin(req.user));
}

/** A super admin. */
function superAdmin(note) {
  return declare({ kind: 'superAdmin', note }, (req) => req.user != null && req.user.superDuperAdmin === true);
}

/**
 * The level in the competition (or each of the competitions) the request names at from, or one of
 * the roles orRole there; none named is refused.
 */
function competition(level, from, { orRole, note } = {}) {
  return declare({ kind: 'competition', level: LEVEL_NAMES[level], orRole, from: [].concat(from).map(String).join(' and '), note }, async (req) => {
    const ids = await valuesAt(req, from);
    if (ids.length == 0 || !ids.every((id) => ObjectId.isValid(String(id)))) return false;
    for (const id of ids) {
      if (!(await allowedIn(req.user, id, level, orRole))) return false;
    }
    return true;
  });
}

/**
 * The level in the competition of the stored thing (or things, by ids joined with commas) the
 * request names at from. Ids that are not ones, or of nothing, go on to the handler, which says so.
 */
function of(model, from, level, { orRole, orIf, note } = {}) {
  return declare({ kind: 'of', model: model.modelName, level: LEVEL_NAMES[level], orRole, orIf: orIf && String(orIf), from: String(from), note }, async (req) => {
    const ids = (await valuesAt(req, from)).flatMap((id) => String(id).split(',')).filter((id) => ObjectId.isValid(id));
    if (ids.length == 0) return true;
    if (orIf && (await orIf(req))) return true;
    const things = await model.find({ _id: { $in: ids } }).select('competition').lean().exec();
    for (const thing of things) {
      if (!(await allowedIn(req.user, thing.competition, level, orRole))) return false;
    }
    return true;
  });
}

/**
 * A team by the token of its own pages (at teamAt and tokenAt: params.teamId and params.token if
 * not said), or the staff of its competition at the level given; publicDocuments: also anyone when
 * the team made its documents public; competitionToken: also the public token of its competition
 * (for what its questions make public). With inCompetition, the team must be of the competition
 * the request names there.
 */
function team({ teamAt = 'params.teamId', tokenAt = 'params.token', staff, publicDocuments = false, competitionToken = false, inCompetition, note } = {}) {
  const competitionDb = require('../models/competition');
  return declare({ kind: 'team', teamAt, tokenAt, staff: staff && LEVEL_NAMES[staff], publicDocuments, competitionToken, inCompetition, note }, async (req) => {
    const [teamId] = await valuesAt(req, teamAt);
    const [token] = await valuesAt(req, tokenAt);
    if (!ObjectId.isValid(String(teamId))) return true;
    const dbTeam = await competitionDb.team.findById(teamId).select('competition document.token document.public').lean().exec();
    if (!dbTeam) return true;
    if (competitionToken && typeof token === 'string' && token.length > 0) {
      const dbCompetition = await competitionDb.competition.findById(dbTeam.competition).select('publicToken').lean().exec();
      if (dbCompetition && dbCompetition.publicToken === token) return true;
    }
    if (inCompetition) {
      const [named] = await valuesAt(req, inCompetition);
      if (String(named) !== String(dbTeam.competition)) return false;
    }
    if (staff && authCompetition(req.user, String(dbTeam.competition), staff)) return true;
    if (publicDocuments && dbTeam.document && dbTeam.document.public) return true;
    return typeof token === 'string' && token.length > 0 && dbTeam.document != null && dbTeam.document.token === token;
  });
}

// The routes mounted, with their declarations
const table = [];

/**
 * Mount a route module's routers at the path, with the login, admin and super admin guards between
 * them; every route must have a declaration, or the app does not start.
 */
function mount(app, path, routes) {
  const tiers = typeof routes === 'function'
    ? [['public', routes]]
    : [['public', routes.public], ['private', routes.private], ['admin', routes.admin], ['super', routes.super]].filter(([, r]) => r);
  const guards = { private: pass.ensureLoginApi, admin: pass.ensureAdminApi, super: pass.ensureSuperApi };
  const chain = [];
  const undeclared = [];
  for (const [tier, router] of tiers) {
    // The guards of the tier, each once, before its first router
    const needed = { public: [], private: ['private'], admin: ['private', 'admin'], super: ['private', 'super'] }[tier];
    for (const name of needed) {
      if (!chain.includes(guards[name])) chain.push(guards[name]);
    }
    chain.push(router);
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const { route } = layer;
      // The routers' catch-alls, which pass every request on
      if (route.path === '*') continue;
      const declarations = route.stack.map((l) => l.handle[ACCESS]).filter(Boolean);
      for (const method of Object.keys(route.methods)) {
        if (declarations.length == 0) undeclared.push(`${method.toUpperCase()} ${path}${route.path} (${tier})`);
        else table.push({ method: method.toUpperCase(), path: `${path}${route.path}`, tier, access: declarations });
      }
    }
  }
  if (undeclared.length) {
    throw new Error(`API routes without a declaration of who may call them (helper/access.js):\n  ${undeclared.join('\n  ')}`);
  }
  app.use(path, chain);
}

/** The routes mounted, each with its declaration. */
function routes() {
  return table.slice();
}

module.exports = { anyone, loggedIn, anyAdmin, superAdmin, competition, of, team, competitionsOf, mapOfRunShown, mount, routes, ACCESS };
