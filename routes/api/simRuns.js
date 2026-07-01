const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const { simRun } = require('../../models/simRun');
const auth = require('../../helper/authLevels');
const { ACCESSLEVELS } = require('../../models/user');
const competitiondb = require('../../models/competition');
const initRunData = require('../../helper/initRunData');
const { leagues } = require('../../leagues');
const Decimal = require('decimal.js');

let socketIo;

module.exports.connectSocketIo = function (io) {
  socketIo = io;
};

/**
 * @api {get} /runs/simulation/competition/:competitionId Get runs
 * @apiName GetRun
 * @apiGroup Run
 * @apiVersion 1.0.1
 */
publicRouter.get('/competition/:competitionId', function (req, res, next) {
  const competition = req.params.competitionId;
  const normalized = req.query.normalized;

  if (!ObjectId.isValid(competition)) {
    return next();
  }

  let maxScoreCache = {};
  let query;
  if (req.query.ended == 'false') {
    query = simRun.find({
      competition,
      status: { $lte: 1 },
    });
  } else {
    query = simRun.find({
      competition,
    });
  }

  query.select(
    'competition round team field score time status started comment startTime sign normalizationGroup adjustment'
  );

  query.populate([
    {
      path: 'competition',
      select: 'name leagues preparation',
    },
    {
      path: 'round',
      select: 'name',
    },
    {
      path: 'team',
      select: 'name league teamCode',
    },
    {
      path: 'field',
      select: 'name league',
    }
  ]);

  query.lean().exec(async function (err, dbRuns) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get runs',
      });
    } else if (dbRuns) {
      // Hide field and score from public
      dbRuns.map(run => {        
        switch(auth.authViewRun(req.user, run, ACCESSLEVELS.NONE + 1, run.competition.preparation)) {
          case 0:
            delete run.field;
            delete run.score;
            delete run.time;
          case 2:
            delete run.comment;
            delete run.sign;
            delete run.adjustment;
          case 1:
            run.originalScore = run.score;
        }

        // Apply score adjustment
        if (run.adjustment != null) {
          run.score = new Decimal(run.score).times((run.adjustment + 100) / 100);
        }
      })

      // return normalized score
      if (normalized && auth.authCompetition(
        req.user,
        competition,
        ACCESSLEVELS.ADMIN
      )) {
        dbRuns.map(run => {
          let rankingSettings = run.competition.leagues.find(r => r.league == run.team.league);
          if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingSettings.mode)) {
            let maxScore = getMaxScoreWithCache(dbRuns, run.team.league, run.normalizationGroup, maxScoreCache);
            if (maxScore == 0) run.normalizedScore = 0;
            else run.normalizedScore = run.score / maxScore;
          }
        });
      }
      res.status(200).send(dbRuns);
    }
  });
});

function getMaxScoreWithCache(runs, league, normalizationGroup, cache) {
  let key = `${league}#${normalizationGroup}`;
  if (cache[key] == null) {
    cache[key] = Math.max(...runs.filter(run => run.team.league == league && run.normalizationGroup == normalizationGroup)
      .map(run => run.score));  
  }
  return cache[key];
}

/**
 * @api {get} /runs/simulation/:runid Get run
 * @apiName GetRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 */
publicRouter.get('/:runid', async function (req, res, next) {
  const id = req.params.runid;
  const normalized = req.query.normalized

  if (!ObjectId.isValid(id)) {
    return next();
  }

  simRun.findById(id, '-__v').populate([
    'round',
    { path: 'team', select: 'name league teamCode' },
    'field',
    { path: 'competition', select: 'name leagues preparation' }
  ]).exec(async function (err, dbRun) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        err: err.message,
        msg: 'Could not get run',
      });
    }
    if (dbRun) {
      // Hide map and field from public
      const authResult = auth.authViewRun(
        req.user,
        dbRun,
        ACCESSLEVELS.NONE + 1,
        dbRun.competition.preparation
      );

      dbRun = dbRun.toObject();
      if (authResult == 0) return res.status(401).send();
      if (authResult == 2) {
        delete dbRun.comment;
        delete dbRun.sign;
      }

      // return normalized value
      let rankingSettings = dbRun.competition.leagues.find(r => r.league == dbRun.team.league);
      if (normalized && competitiondb.NORMALIZED_RANKING_MODE.includes(rankingSettings.mode)) {
        // disclose ranking enabled OR the user is ADMIN of the competition
        if (rankingSettings.disclose || auth.authCompetition(
          req.user,
          dbRun.competition._id,
          ACCESSLEVELS.ADMIN
        )) {
          let maxScore = await simRun.find({
            competition: dbRun.competition._id,
            normalizationGroup: dbRun.normalizationGroup
          }).populate({
            path: 'team',
            select: 'league'
          }).select("score").exec();
          maxScore = Math.max(...maxScore.filter(run => run.team.league == dbRun.team.league).map(run => run.score));
          if (maxScore == 0) dbRun.normalizedScore = 0;
          else dbRun.normalizedScore = dbRun.score / maxScore;
        }
      }
      return res.status(200).send(dbRun);
    }
  });
});

adminRouter.put('/bulk', function (req, res) {
  const updates = req.body;
  const totalCount = updates.length;
  let processed = 0;
  let success = 0;

  for (let u of updates) {
    simRun
    .findById(u._id)
    .populate(['competition'])
    .exec(function (err, dbRun) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get run',
          err: err.message,
        });
      } else if (dbRun) {
        if (
          !auth.authCompetition(
            req.user,
            dbRun.competition._id,
            ACCESSLEVELS.ADMIN
          )
        ) {
          return res.status(401).send({
            msg: 'You have no authority to access this api!!',
          });
        }

        dbRun.adjustment = u.adjustment;
        
        dbRun.save(function (err) {
          processed ++;
          if (err) {
            logger.error(err);
          } else {
            success++;
          }

          if (processed == totalCount) {
            if (totalCount == success) {
              return res.status(200).send({
                msg: `All success: ${totalCount}`
              });
            } else {
              return res.status(200).send({
                msg: `Partial success: ${success}/${totalCount}`
              });
            }
          }
        });
      }
    });
  }
});

/**
 * @api {put} /runs/simulation/:runid Update run
 * @apiName PutRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 */
privateRouter.put('/:runid', function (req, res, next) {
  const id = req.params.runid;
  if (!ObjectId.isValid(id)) {
    return next();
  }

  let statusUpdate = false;
  const run = req.body;

  // Exclude fields that are not allowed to be publicly changed
  delete run._id;
  delete run.__v;
  delete run.competition;
  delete run.round;
  delete run.team;
  delete run.field;

  simRun
    .findById(id)
    .exec(function (err, dbRun) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get run',
          err: err.message,
        });
      } else if (dbRun) {
        if (
          !auth.authCompetition(
            req.user,
            dbRun.competition._id,
            ACCESSLEVELS.JUDGE
          )
        ) {
          return res.status(401).send({
            msg: 'You have no authority to access this api!!',
          });
        }

        if (run.status) {
          if (dbRun.status > run.status && dbRun.status != 6) delete run.status;
        }

        const prevStatus = dbRun.status;

        // Recursively updates properties in "dbObj" from "obj"
        const copyProperties = function (obj, dbObj) {
          for (const prop in obj) {
            if (
              obj.constructor == Array ||
              (obj.hasOwnProperty(prop) &&
                (dbObj.hasOwnProperty(prop) ||
                  (dbObj.get !== undefined && dbObj.get(prop) !== undefined)))
            ) {
              // Mongoose objects don't have hasOwnProperty
              if (typeof obj[prop] === 'object' && dbObj[prop] != null) {
                // Catches object and array
                copyProperties(obj[prop], dbObj[prop]);

                if (dbObj.markModified !== undefined) {
                  dbObj.markModified(prop);
                }
              } else if (obj[prop] !== undefined) {
                // logger.debug("copy " + prop)
                dbObj[prop] = obj[prop];
              }
            } else {
              return new Error(`Illegal key: ${prop}`);
            }
          }
        };

        err = copyProperties(run, dbRun);

        if (err) {
          logger.error(err);
          return res.status(400).send({
            err: err.message,
            msg: 'Could not save run',
          });
        }

        if (prevStatus != dbRun.status) statusUpdate = 1;

        if (!dbRun.started) {
          if (dbRun.time.minutes != 0 || dbRun.time.seconds != 0 || dbRun.score != 0) {
            dbRun.started = true;
          }
        }
        
        dbRun.save(function (err) {
          if (err) {
            logger.error(err);
            return res.status(400).send({
              err: err.message,
              msg: 'Could not save run',
            });
          }
          if (socketIo !== undefined) {
            socketIo.sockets.in('runs/simulation').emit('changed');
            socketIo.sockets
              .in(`runs/simulation/${dbRun.competition._id}`)
              .emit('changed');
            socketIo.sockets.in(`runs/${dbRun._id}`).emit('data', dbRun);
            socketIo.sockets
              .in(`fields/${dbRun.field}`)
              .emit('data', { newRun: dbRun._id });
            if (statusUpdate) {
              socketIo.sockets
                .in(`runs/simulation/${dbRun.competition._id}/status`)
                .emit('SChanged');
            }
          }
          return res.status(200).send({
            msg: 'Saved run',
            score: dbRun.score
          });
        });
      }
    });
});

/**
 * @api {delete} /runs/simulation/:runids Delete run
 * @apiName DeleteRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 */
adminRouter.delete('/:runids', function (req, res) {
  const ids = req.params.runids.split(',');
  if (ids.some(id => !ObjectId.isValid(id))) {
    return next();
  }
  simRun
    .findById(ids[0])
    .select('competition')
    .exec(function (err, dbRun) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get run',
          err: err.message,
        });
      } else if (dbRun) {
        if (
          !auth.authCompetition(req.user, dbRun.competition, ACCESSLEVELS.ADMIN)
        ) {
          return res.status(401).send({
            msg: 'You have no authority to access this api',
          });
        }
      }
      simRun.deleteMany(
        {
          _id: { $in: ids },
          competition: dbRun.competition,
        },
        function (err) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Could not remove run',
              err: err.message,
            });
          } else {
            res.status(200).send({
              msg: 'Run has been removed!',
            });
          }
        }
      );
    });
});

/**
 * @api {post} /runs/simulation Create new run
 * @apiName PostRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 */
adminRouter.post('/', function (req, res, next) {
  const run = req.body;
  if (!ObjectId.isValid(run.competition)) {
    return next();
  }
  if (!ObjectId.isValid(run.round)) {
    return next();
  }
  if (!ObjectId.isValid(run.team)) {
    return next();
  }
  if (!ObjectId.isValid(run.field)) {
    return next();
  }
  new simRun({
    competition: run.competition,
    round: run.round,
    team: run.team,
    field: run.field,
    startTime: run.startTime,
    normalizationGroup: run.normalizationGroup
  }).save(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Error saving run in db',
        err: err.message,
      });
    }
    res.location(`/api/runs/${data._id}`);
    return res.status(201).send({
      err: 'New run has been saved',
      id: data._id,
    });
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
