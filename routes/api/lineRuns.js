const express = require('express');
const multer = require('multer');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const { lineRun } = require('../../models/lineRun');
const scoreCalculator = require('../../helper/scoreCalculator');
const auth = require('../../helper/authLevels');
const scoreSheetLinePDF2 = require('../../helper/scoreSheetPDFLine2');
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
 * @api {get} /runs/line/competition/:competitionId Get runs
 * @apiName GetRun
 * @apiGroup Run
 * @apiVersion 1.0.1
 *
 * @apiParam {Boolean} [populate] Whether to populate references with name
 *
 * @apiSuccess (200) {Object[]} -             Array of runs
 * @apiSuccess (200) {String}   -._id
 * @apiSuccess (200) {String}   -.competition
 * @apiSuccess (200) {String}   -.round
 * @apiSuccess (200) {String}   -.team
 * @apiSuccess (200) {String}   -.field
 * @apiSuccess (200) {String}   -.map
 * @apiSuccess (200) {Number}   -.score
 * @apiSuccess (200) {Object}   -.time
 * @apiSuccess (200) {Number}   -.time.minutes
 * @apiSuccess (200) {Number}   -.time.seconds
 * @apiSuccess (200) {Number}   -.status
 * @apiSuccess (200) {Number}   -.rescuedLiveVictims
 * @apiSuccess (200) {Number}   -.rescuedDeadVictims
 * @apiSuccess (200) {Object[]} -             Array of LoPs
 *
 * @apiError (400) {String} msg The error message
 */
publicRouter.get('/competition/:competitionId', function (req, res, next) {
  const competition = req.params.competitionId;
  const normalized = req.query.normalized;
  const minimum = req.query.minimum;

  if (!ObjectId.isValid(competition)) {
    return next();
  }

  let maxScoreCache = {};
  let query;
  if (req.query.ended == 'false') {
    query = lineRun.find({
      competition,
      status: { $lte: 1 },
    });
  } else {
    query = lineRun.find({
      competition,
    });
  }

  if (minimum) {
    query.select('competition round team field status started startTime sign');
  } else {
    query.select(
      'competition round team field map score raw_score multiplier time status started LoPs comment startTime sign rescueOrder nl group normalizationGroup exitBonus evacuationLevel kitLevel adjustment'
    );
  }

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
    },
    {
      path: 'map',
      select: 'name',
    },
  ]);

  query.lean().exec(async function (err, dbRuns) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get runs',
      });
    } else if (dbRuns) {
      // Hide map and field from public
      dbRuns.map(run => {        
        switch(auth.authViewRun(req.user, run, ACCESSLEVELS.NONE + 1, run.competition.preparation)) {
          case 0:
            delete run.map;
            delete run.field;
            delete run.score;
            delete run.time;
            delete run.LoPs;
            delete run.raw_score
            delete run.multiplier;
            delete run.rescueOrder;
            delete run.nl;
            delete run.exitBonus;
            delete run.evacuationLevel;
            delete run.kitLevel;
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
      if (!minimum && normalized && auth.authCompetition(
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
  if (cache[league+normalizationGroup] != null) {
    return cache[league+normalizationGroup];
  }
  cache[league+normalizationGroup] = Math.max(...runs.filter(run => run.team.league == league && run.normalizationGroup == normalizationGroup)
    .map(run => run.score));  
  return cache[league+normalizationGroup];
}

privateRouter.get(
  '/find/team_status/:competitionid/:teamid/:status',
  function (req, res, next) {
    const id = req.params.competitionid;
    const teamId = req.params.teamid;
    const { status } = req.params;
    if (!ObjectId.isValid(id)) {
      return next();
    }
    if (!ObjectId.isValid(teamId)) {
      return next();
    }
    const query = lineRun.find(
      {
        competition: id,
        team: teamId,
        status,
      },
      'competition round team field map score time started LoPs startTime rescueOrder nl'
    );
    query.populate([
      {
        path: 'competition',
        select: 'name',
      },
      {
        path: 'round',
        select: 'name',
      },
      {
        path: 'team',
        select: 'name league',
      },
      {
        path: 'field',
        select: 'name league',
      },
      {
        path: 'map',
        select: 'name',
      },
    ]);
    query.exec(function (err, data) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get runs',
        });
      } else {
        res.status(200).send(data);
      }
    });
  }
);

publicRouter.get(
  '/find/:competitionid/:field/:status',
  function (req, res, next) {
    const id = req.params.competitionid;
    const field_id = req.params.field;
    const { status } = req.params;
    if (!ObjectId.isValid(id)) {
      return next();
    }
    if (!ObjectId.isValid(field_id)) {
      return next();
    }
    const query = lineRun.find(
      {
        competition: id,
        field: field_id,
        status,
      },
      'field team competition status startTime'
    ).sort('startTime');
    query.populate([{ path: 'team', select: 'name league teamCode' }]);
    query.exec(function (err, data) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get runs',
        });
      } else {
        res.status(200).send(data);
      }
    });
  }
);

/**
 * @api {get} /runs/line/:runid Get run
 * @apiName GetRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} runid The run id
 *
 * @apiParam {Boolean} [populate] Whether to populate object references
 *
 * @apiSuccess (200) {String}       _id
 * @apiSuccess (200) {String}       competition
 * @apiSuccess (200) {String}       round
 * @apiSuccess (200) {String}       team
 * @apiSuccess (200) {String}       field
 * @apiSuccess (200) {String}       map
 *
 * @apiSuccess (200) {Object[]}     tiles
 * @apiSuccess (200) {Boolean}      tiles.isDropTile
 * @apiSuccess (200) {Object}       tiles.scoredItems
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.obstacles
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.speedbumps
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.intersection
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.gaps
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.dropTile
 * @apiSuccess (200) {Number[]}     LoPs
 * @apiSuccess (200) {Number}       evacuationLevel
 * @apiSuccess (200) {Boolean}      exitBonus
 * @apiSuccess (200) {Number}       rescuedLiveVictims
 * @apiSuccess (200) {Number}       rescuedDeadVictims
 * @apiSuccess (200) {Number}       score
 * @apiSuccess (200) {Boolean}      showedUp
 * @apiSuccess (200) {Object}       time
 * @apiSuccess (200) {Number{0-8}}  time.minutes
 * @apiSuccess (200) {Number{0-59}} time.seconds
 *
 * @apiError (400) {String} err The error message
 * @apiError (400) {String} msg The error message
 */
publicRouter.get('/:runid', async function (req, res, next) {
  const id = req.params.runid;
  const normalized = req.query.normalized

  if (!ObjectId.isValid(id)) {
    return next();
  }

  lineRun.findById(id, '-__v').populate([
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
      const rule = dbRun.competition.leagues.find(r => r.league == dbRun.team.league).rule;
      // Hide map and field from public
      const authResult = auth.authViewRun(
        req.user,
        dbRun,
        ACCESSLEVELS.NONE + 1,
        dbRun.competition.preparation
      );
      if (authResult == 0) return res.status(401).send();

      // Init run data
      let initDbRun = await initRunData.initLine(dbRun, rule);
      if (initDbRun != null) {
        dbRun.tiles = initDbRun.tiles;
        dbRun.LoPs = initDbRun.LoPs;
        dbRun.nl = initDbRun.nl;
        await dbRun.save(function (err) {
          if (err) {
            logger.error(err);
            return res.status(400).send({
              err: err.message,
              msg: 'Could not get run',
            });
          }
        });
      }
      
      dbRun = dbRun.toObject();
      if (authResult == 2) {
        delete dbRun.comment;
        delete dbRun.sign;
      }

      // return normalized value
      let rankingSettings = dbRun.competition.leagues.find(r => r.league == dbRun.team.league);
      if (!rankingSettings) {
        rankingSettings = {
          mode: competitiondb.SUM_OF_BEST_N_GAMES,
          disclose: false,
          num: 20
        }
      }
      if (normalized && competitiondb.NORMALIZED_RANKING_MODE.includes(rankingSettings.mode)) {
        // disclose ranking enabled OR the user is ADMIN of the competition
        if (rankingSettings.disclose || auth.authCompetition(
          req.user,
          dbRun.competition._id,
          ACCESSLEVELS.ADMIN
        )) {
          let maxScore = await lineRun.find({
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
    lineRun
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
 * @api {put} /runs/line/:runid Update run
 * @apiName PutRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} runid The run id

 * @apiParam {Object[]}     [tiles]
 * @apiParam {Boolean}      [tiles.isDropTile]
 * @apiParam {Object}       [tiles.scoredItems]
 * @apiParam {Boolean}      [tiles.scoredItems.obstacles]
 * @apiParam {Boolean}      [tiles.scoredItems.speedbumps]
 * @apiParam {Boolean}      [tiles.scoredItems.intersection]
 * @apiParam {Boolean}      [tiles.scoredItems.gaps]
 * @apiParam {Boolean}      [tiles.scoredItems.dropTile]
 * @apiParam {Number[]}     [LoPs]
 * @apiParam {Number=1,2}   [evacuationLevel]
 * @apiParam {Boolean}      [exitBonus]
 * @apiParam {Number}       [rescuedLiveVictims]
 * @apiParam {Number}       [rescuedDeadVictims]
 * @apiParam {Boolean}      [showedUp]
 * @apiParam {Object}       [time]
 * @apiParam {Number{0-8}}  [time.minutes]
 * @apiParam {Number{0-59}} [time.seconds]
 *
 * @apiSuccess (200) {String} msg   Success msg
 * @apiSuccess (200) {String} score The current score
 *
 * @apiError (400) {String} err The error message
 * @apiError (400) {String} msg The error message
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
  delete run.map;
  delete run.competition;
  delete run.round;
  delete run.team;
  delete run.field;
  delete run.score;

  lineRun
    .findById(id)
    // .select("-_id -__v -competition -round -team -field -score")
    .populate([
      {
        path: 'map',
        populate: {
          select: 'indexCount, victims',
          path: 'tiles.tileType',
        }
      }
    ])
    .populate(['competition', 'team'])
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
        if (run.tiles != null && run.tiles.constructor === Object) {
          // Handle dict as "sparse" array
          const { tiles } = run;
          run.tiles = [];
          Object.keys(tiles).forEach(function (key) {
            if (!isNaN(key)) {
              run.tiles[key] = tiles[key];
            }
          });
        }

        if (run.LoPs != null && run.LoPs.length != dbRun.LoPs.length) {
          dbRun.LoPs.length = run.LoPs.length;
        }

        if (run.rescueOrder != null) {
          dbRun.rescueOrder = run.rescueOrder;
        }

        if (run.nl != null) {
          if (run.nl.liveVictim != null) {
            dbRun.nl.liveVictim = run.nl.liveVictim ;
          }

          if (run.nl.deadVictim != null) {
            dbRun.nl.deadVictim = run.nl.deadVictim ;
          }
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

        const cal = scoreCalculator.calculateScore(dbRun);
        if (!cal) {
          logger.error('Value Error');
          return res.status(202).send({
            msg: 'Try again later',
          });
        }

        dbRun.score = cal.score;
        dbRun.raw_score = cal.raw_score;
        dbRun.multiplier = cal.multiplier;

        if (!dbRun.started) {
          if (dbRun.score > 0) {
            dbRun.started = true;
          } else {
            if (run.tiles) {
              scoredCheck : for (let tile of run.tiles) {
                for (let item of tile.scoredItems) {
                  if (item.scored) {
                    dbRun.started = true;
                    break scoredCheck;
                  }
                }
              }
            }
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
            socketIo.sockets.in('runs/line').emit('changed');
            socketIo.sockets
              .in(`runs/line/${dbRun.competition._id}`)
              .emit('changed');
            socketIo.sockets.in(`runs/${dbRun._id}`).emit('data', dbRun);
            socketIo.sockets
              .in(`fields/${dbRun.field}`)
              .emit('data', { newRun: dbRun._id });
            if (statusUpdate) {
              socketIo.sockets
                .in(`runs/line/${dbRun.competition._id}/status`)
                .emit('LChanged');
            }
          }
          return res.status(200).send({
            msg: 'Saved run',
            score: dbRun.score,
            raw_score: dbRun.raw_score,
            multiplier: dbRun.multiplier,
          });
        });
      }
    });
});

adminRouter.get('/scoresheet2', function (req, res, next) {
  const run = req.query.run || req.params.run;
  const competition = req.query.competition || req.params.competition;
  const field = req.query.field || req.params.field;
  const round = req.query.round || req.params.round;
  const startTime = req.query.startTime || req.params.startTime;
  const endTime = req.query.endTime || req.params.endTime;
  const offset = req.query.offset;

  if (!competition && !run && !round) {
    return next();
  }

  const queryObj = {};
  const sortObj = {};
  if (ObjectId.isValid(competition)) {
    queryObj.competition = ObjectId(competition);
  }
  if (ObjectId.isValid(field)) {
    queryObj.field = ObjectId(field);
  }
  if (ObjectId.isValid(round)) {
    queryObj.round = ObjectId(round);
  }
  if (ObjectId.isValid(run)) {
    queryObj._id = ObjectId(run);
  }

  sortObj.field = 1;
  sortObj.startTime = 1; // sorting by field has the highest priority, followed by time

  if (startTime && endTime) {
    queryObj.startTime = { $gte: parseInt(startTime), $lte: parseInt(endTime) };
  } else if (startTime) {
    queryObj.startTime = { $gte: parseInt(startTime) };
  } else if (endTime) {
    queryObj.startTime = { $lte: parseInt(endTime) };
  }

  const query = lineRun.find(queryObj).sort(sortObj);

  query.select('competition round team field map startTime');
  query.populate([
    {
      path: 'competition',
      select: 'name rule logo leagues',
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
      select: 'name',
    },
    {
      path: 'map',
      select:
        'name height width length numberOfDropTiles finished startTile tiles indexCount victims EvacuationAreaLoPIndex',
      populate: {
        path: 'tiles.tileType',
      },
    },
  ]);

  query.lean().exec(async function (err, dbRuns) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get runs',
      });
    } else if (dbRuns) {
      dbRuns.map(run => {
        run.startTime += parseInt(offset)*60*1000;
      })
      await scoreSheetLinePDF2.generateScoreSheet(res, dbRuns);
    }
  });
});

/**
 * @api {delete} /runs/line/:runid Delete run
 * @apiName DeleteRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} runid The run id
 *
 * @apiSuccess (200) {String} msg Success msg
 *
 * @apiError (400) {String} err The error message
 */
/**
 * @api {delete} /runs/line/:runids Delete run
 * @apiName DeleteRun
 * @apiGroup Run
 * @apiVersion 1.1.0
 *
 * @apiParam {String} runids The run ids
 *
 * @apiSuccess (200) {String} msg Success msg
 *
 * @apiError (400) {String} err The error message
 */
adminRouter.delete('/:runids', function (req, res) {
  const ids = req.params.runids.split(',');
  if (!ObjectId.isValid(ids[0])) {
    return next();
  }
  lineRun
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
      lineRun.deleteMany(
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
 * @api {post} /runs/line Create new run
 * @apiName PostRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} competition The competition id
 * @apiParam {String} round       The round id
 * @apiParam {String} team        The team id
 * @apiParam {String} field       The field id
 * @apiParam {String} map         The map id
 * @apiParam {String} normalizationGroup         The normalization group id
 *
 * @apiSuccess (200) {String} msg Success msg
 * @apiSuccess (200) {String} id  The new run id
 *
 * @apiError (400) {String} err The error message
 */
adminRouter.post('/', function (req, res) {
  const run = req.body;

  new lineRun({
    competition: run.competition,
    round: run.round,
    team: run.team,
    field: run.field,
    map: run.map,
    startTime: run.startTime,
    group: run.group,
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

privateRouter.post('/pre_recorded', function (req, res) {
  const data = req.body;
  competitiondb.team
  .findById(data.team)
  .select('competition document.token league')
  .exec(function (err, dbTeam) {
    if (err || dbTeam == null) {
      if (!err) err = { message: 'No team found' };
      res.status(400).send({
        msg: 'Could not get team',
        err: err.message,
      });
    } else if (dbTeam) {
      if (auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.JUDGE)) {
        competitiondb.competition
        .findById(dbTeam.competition)
        .select('documents')
        .exec(function (err, dbReview) {
          let review = dbReview.documents.leagues.filter(l=>l.league == dbTeam.league)[0].review;
          for(let b of review){
            let q = b.questions.filter(q=>q._id == data.questionId && q.type=="run");
            if(q.length > 0){
              const question = q[0];
              //Data check
              let err = false
              for(let r of data.runs){
                r.team = dbTeam._id;
                r.competition = dbTeam.competition;
                if(!question.runReview.round.includes(r.round)){
                  err = true;
                  break;
                }
                if(!question.runReview.map.includes(r.map)){
                  err = true;
                  break;
                }
              }
              if(err){
                return res.status(400).send({
                  err: 'Data validation error'
                });
              }else{
                lineRun.insertMany(data.runs).then(function(){
                  return res.status(201).send({
                    err: 'New run has been saved',
                    id: data._id,
                  });
                }).catch(function(err){
                  return res.status(400).send({
                    msg: 'Error saving run in db',
                    err: err.message,
                  });
                });
              }
            }
          }
        });
      } else {
        return res.status(400).send({
          msg: 'Error saving run in db',
          err: err.message,
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
