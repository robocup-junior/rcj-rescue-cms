//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const mkdirp = require('mkdirp');
const fs = require('fs');
const crypto = require('crypto');
const { ACCESSLEVELS } = require('../../models/user');
const logger = require('../../config/logger').mainLogger;
const competitiondb = require('../../models/competition');
const auth = require('../../helper/authLevels');
const { type } = require('os');
const access = require('../../helper/access');
const safePath = require('../../helper/safePath');

const { LEAGUES_JSON } = competitiondb;

const S = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const N = 32;

// publicRouter.get('/', function (req, res) {
//    query.doFindResultSortQuery(req, res, null, null, competitiondb.team)
// })

publicRouter.get('/leagues', access.anyone('of no competition'), function (req, res) {
  res.send(competitiondb.team.schema.path('league').enumValues);
});

publicRouter.get('/leagues/:league/:competitionId', access.anyone('the teams of a league, as the public pages list them'), async function (req, res) {
  const id = req.params.competitionId;
  const { league } = req.params;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  const result = await competitiondb.team.aggregate([
    {
      $match: {
        competition: { $eq: ObjectId(id) },
      },
    },
    {
      $group: {
        _id: '$league',
      },
    },
  ]);

  let teamLeagues = result.map(r => r._id);
  let ret = structuredClone(LEAGUES_JSON.filter(l => teamLeagues.includes(l.id) && (l.type == league || league == 'all')));

  // Get league setting of the competition
  const competition = await competitiondb.competition.findById(id);

  ret.map( r => {
    r.rule = competition.leagues.find(c => c.league == r.id).rule;
    delete r.rules;
  });
  res.send(ret);
});

privateRouter.get('/code/:teamId/:code', access.loggedIn('the team of the code given'), function (req, res, next) {
  const id = req.params.teamId;
  const { code } = req.params;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  competitiondb.team
    .findOne(
      {
        _id: id,
        code,
      },
      '_id inspected name league competition'
    )
    .exec(function (err, dbTeam) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else {
        res.send(dbTeam);
      }
    });
});

publicRouter.get('/:teamid', access.anyone('a team, as the public pages show it'), function (req, res, next) {
  const id = req.params.teamid;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  competitiondb.team
    .findOne(
      {
        _id: id,
      },
      '_id inspected name teamCode league competition checkin country'
    )
    .exec(function (err, dbTeam) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else {
        res.send(dbTeam);
      }
    });
});

privateRouter.put('/:competitionid/:teamid', access.competition(ACCESSLEVELS.JUDGE, 'params.competitionid'), access.of(competitiondb.team, 'params.teamid', ACCESSLEVELS.JUDGE), function (req, res, next) {
  const id = req.params.teamid;
  const { competitionid } = req.params;
  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, competitionid, ACCESSLEVELS.JUDGE)) {
    res.status(401).send({
      msg: 'You have no authority to access this api',
    });
    return;
  }

  const team = req.body;

  competitiondb.team
    .findOne({
      _id: id,
      competition: competitionid,
    })
    .exec(function (err, dbTeam) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get user',
          err: err.message,
        });
      } else if (dbTeam) {
        if (team.interviewer != null) dbTeam.interviewer = team.interviewer;
        if (team.comment != null) dbTeam.comment = team.comment;
        if (team.inspected != null) dbTeam.inspected = team.inspected;
        if (team.docPublic != null) dbTeam.docPublic = team.docPublic;
        if (team.checkin != null) dbTeam.checkin = team.checkin;
        if (team.code != null) dbTeam.teamCode = team.code;

        if (auth.authCompetition(req.user, competitionid, ACCESSLEVELS.ADMIN)) {
          if (team.name != null) dbTeam.name = team.name;
          if (team.teamCode != null) dbTeam.teamCode = team.teamCode;
          if (team.league != null) dbTeam.league = team.league;
          if (team.country != null) dbTeam.country = team.country;
          if (team.email != null) dbTeam.email = team.email;
        }

        dbTeam.save(function (err) {
          if (err) {
            logger.error(err);
            return res.status(400).send({
              err: err.message,
              msg: 'Could not save changes',
            });
          }
          return res.status(200).send({
            msg: 'Saved changes',
          });
        });
      }
    });
});

adminRouter.delete('/:teamid', access.of(competitiondb.team, 'params.teamid', ACCESSLEVELS.ADMIN), function (req, res, next) {
  const ids = req.params.teamid.split(',');
  if (!ObjectId.isValid(ids[0])) {
    return next();
  }
  competitiondb.team
    .findById(ids[0])
    .select('competition')
    .exec(function (err, dbTeam) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          !auth.authCompetition(
            req.user,
            dbTeam.competition,
            ACCESSLEVELS.ADMIN
          )
        ) {
          return res.status(401).send({
            msg: 'You have no authority to access this api',
          });
        }
      }
      competitiondb.team.deleteMany(
        {
          _id: {
            $in: ids,
          },
          competition: dbTeam.competition,
        },
        function (err) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Could not remove team',
              err: err.message,
            });
          } else {
            res.status(200).send({
              msg: 'Team has been removed!',
            });
            for (const id of ids) {
              let path = safePath('documents', dbTeam.competition, id);
              fs.rmdir(path, { recursive: true }, (err) => {
                if (err) throw err;
              });
              path = safePath('cabinet', dbTeam.competition, id);
              fs.rmdir(path, { recursive: true }, (err) => {
                if (err) throw err;
              });
            }
          }
        }
      );
    });
});

adminRouter.post('/', access.competition(ACCESSLEVELS.ADMIN, 'body.competition'), function (req, res) {
  const team = req.body;
  if (!auth.authCompetition(req.user, team.competition, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({ msg: 'You have no authority to access this api' });
  }

  competitiondb.competition
    .findOne({
      _id: team.competition,
    })
    .exec(function (err, dbComp) {
      if (err) {
        logger.error(err);
      } else if (dbComp) {
        const newTeam = new competitiondb.team({
          name: team.name,
          league: team.league,
          competition: team.competition,
          teamCode: team.teamCode,
          country: team.country,
          document: {
            token: Array.from(crypto.randomFillSync(new Uint8Array(N)))
              .map((n) => S[n % S.length])
              .join(''),
            answers: [],
          },
          email: team.email,
        });

        newTeam.save(function (err, createdTeam) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Error saving team',
              err: err.message,
            });
          } else {
            // TEMP 2024 IMPL
            // Create TechnicalChallenge Data
            const newTechnicalChallenge = new competitiondb.technicalChallenge({
              competition: dbComp._id,
              team: createdTeam._id,
              score: 0
            });
            newTechnicalChallenge.save(function (err, data) {
              if (err) {
                logger.error(err);
                res.status(400).send({
                  msg: 'Error saving team',
                  err: err.message,
                });
              } else {
                res.status(201).send({
                  msg: 'New team has been saved',
                  id: createdTeam._id,
                });
                let path = safePath('documents', dbComp._id, createdTeam._id);
                mkdirp.sync(path);
                path = safePath('cabinet', dbComp._id, createdTeam._id);
                mkdirp.sync(path);
              }
            });
          }
        });
      }
    });
});

adminRouter.post('/bulk', access.competition(ACCESSLEVELS.ADMIN, 'body[].competition'), function (req, res) {
  const teams = req.body;
  if (typeof(teams) != "object") {
    res.status(400).send("Bad request");
    return;
  }
  // Every team is of a competition the user administers
  if (!teams.every((team) => auth.authCompetition(req.user, team.competition, ACCESSLEVELS.ADMIN))) {
    return res.status(401).send({ msg: 'You have no authority to access this api' });
  }

  competitiondb.competition
    .findOne({
      _id: teams[0].competition,
    })
    .exec(function (err, dbComp) {
      if (err) {
        logger.error(err);
      } else if (dbComp) {
        let count = teams.length;
        let responseSent = false;
        for (const team of teams) {
          const newTeam = new competitiondb.team({
            name: team.name,
            league: team.league,
            competition: team.competition,
            teamCode: team.teamCode,
            country: team.country,
            document: {
              token: Array.from(crypto.randomFillSync(new Uint8Array(N)))
                .map((n) => S[n % S.length])
                .join(''),
              answers: [],
            },
            email: team.email,
          });

          newTeam.save(function (err, createdTeam) {
            if (err) {
              logger.error(err);
              if (!responseSent) {
                responseSent = true;
                res.status(400).send({
                  message: 'Error saving team',
                  error: err.message,
                });
              }
            } else {
              // TEMP 2024 IMPL
              // Create TechnicalChallenge Data
              const newTechnicalChallenge = new competitiondb.technicalChallenge({
                competition: dbComp._id,
                team: createdTeam._id,
                score: 0
              });
              newTechnicalChallenge.save(function (err, data) {
                if (err) {
                  logger.error(err);
                } else {
                  path = safePath('cabinet', dbComp._id, createdTeam._id);
                  mkdirp.sync(path);
                  path = safePath('documents', dbComp._id, createdTeam._id);
                  mkdirp.sync(path);
                  count--;
                  if (count <= 0) {
                    if (!responseSent) {
                      responseSent = true;
                      res.location(`/api/teams/${createdTeam._id}`);
                      res.status(201).send({
                        message: 'New teams have been saved',
                      });
                    }
                  }
                }
              });
            }
          });
        }
      }
    });
});

publicRouter.all('*', function (req, res, next) {
  next();
});
privateRouter.all('*', function (req, res, next) {
  next();
});

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
