const express = require('express');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { mazeRun } = require('../../models/mazeRun');
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const { mazeMap } = require('../../models/mazeMap');
const scoreCalculator = require('../../helper/scoreCalculator');
const competitionTargetsPDF = require('../../helper/competitionTargetsPDF');
const scoreSheetPDFMaze2 = require('../../helper/scoreSheetPDFMaze2');

publicRouter.get('/', getMazeMaps);
publicRouter.get('/bulk-targets-pdf', getBulkTargetsPDF);
publicRouter.get('/bulk-scoresheets-pdf', getBulkScoreSheetsPDF);
publicRouter.get('/bulk-maps-pdf', getBulkMapImagesPDF);
publicRouter.get('/bulk-maps-zip', getBulkMapImagesZip);
publicRouter.get('/:mapid/image', getMapImage);

function getMazeMaps(req, res) {
  const competition = req.query.competition || req.params.competition;
  const league = req.params.league;

  let query;
  if (competition != null && competition.constructor === String) {
    query = mazeMap.find({
      competition,
    });
  } else if (Array.isArray(competition)) {
    query = mazeMap.find({
      competition: {
        $in: competition.filter(ObjectId.isValid),
      },
    });
  } else {
    query = mazeMap.find({});
  }

  query.select('competition name parent league');

  query.lean().exec(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get maps',
        err: err.message,
      });
    }
    if (league) data = data.filter((m) => m.league == league);
    return res.status(200).send(data);
  });
}
module.exports.getMazeMaps = getMazeMaps;

adminRouter.post('/', function (req, res) {
  const map = req.body;
  if (typeof(map) != "object") {
    res.status(400).send("Bad request");
    return;
  }

  const cells = [];
  for (const i in map.cells) {
    if (map.cells.hasOwnProperty(i)) {
      const cell = map.cells[i];

      if (isNaN(i)) {
        const coords = i.split(',');
        cell.x = coords[0];
        cell.y = coords[1];
        cell.z = coords[2];
      }

      let tile = null;
      if (cell.tile != null) {
        tile = {
          checkpoint: cell.tile.checkpoint,
          speedbump: cell.tile.speedbump,
          black: cell.tile.black,
          blue: cell.tile.blue,
          red: cell.tile.red,
          ramp: cell.tile.ramp,
          steps: cell.tile.steps,
          reachable: cell.tile.reachable,
          changeFloorTo: cell.tile.changeFloorTo,
        };

        if (cell.tile.victims != null) {
          tile.victims = {
            top: cell.tile.victims.top,
            right: cell.tile.victims.right,
            bottom: cell.tile.victims.bottom,
            left: cell.tile.victims.left,
            floor: cell.tile.victims.floor
          };
        }

        if (cell.tile.cognitiveTargets != null) {
          tile.cognitiveTargets = {
            top: cell.tile.cognitiveTargets.top,
            right: cell.tile.cognitiveTargets.right,
            bottom: cell.tile.cognitiveTargets.bottom,
            left: cell.tile.cognitiveTargets.left
          };
        }
      }

      cells.push({
        x: cell.x,
        y: cell.y,
        z: cell.z,
        isTile: cell.isTile,
        isWall: cell.isWall,
        isLinear: cell.isLinear,
        halfWall: cell.halfWall,
        ignoreWall: cell.ignoreWall,
        virtualWall: cell.virtualWall,
        tile,
      });
    }
  }

  // logger.debug(tiles)

  const newMap = new mazeMap({
    competition: map.competition,
    parent: map.parent,
    dice: map.dice,
    name: map.name,
    height: map.height,
    width: map.width,
    length: map.length,
    duration: map.duration,
    leagueType: map.leagueType,
    cells,
    startTile: {
      x: map.startTile.x,
      y: map.startTile.y,
      z: map.startTile.z,
    },
    finished: map.finished,
    league: map.league
  });

  // logger.debug(newMap)

  newMap.save(function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Error saving map',
        err: err.message,
      });
    } else {
      res.location(`/api/maps/maze/${data._id}`);
      res.status(201).send({
        msg: 'New map has been saved',
        id: data._id,
      });
    }
  });
});

publicRouter.get('/:map', function (req, res, next) {
  const id = req.params.map;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  const query = mazeMap.findById(id);

  query.select('-cells._id -cells.tile._id');

  query.lean().exec(function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get map',
        err: err.message,
      });
    } else {
      res.status(200).send(data);
    }
  });
});

adminRouter.get('/:map/maxScore', async function (req, res, next) {
  const id = req.params.map;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  mazeMap.findById(id).populate([
    {
      path: 'competition',
      select: 'leagues'
    },
  ]).lean().exec(async function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get map',
        err: err.message,
      });
    } else {
      let tiles = data.cells.filter(c => c.isTile && c.tile.reachable).map(c => Object({
        x: c.x,
        y: c.y,
        z: c.z,
        scoredItems: {
          speedbump: true,
          checkpoint: true,
          ramp: true,
          steps: true,
          victims: {
              top: true,
              right: true,
              left: true,
              bottom: true,
              floor: true
          },
          rescueKits: {
              top: 2,
              right: 2,
              bottom: 2,
              left: 2,
              floor: 2
          }
        }
      }));
      
      res.status(200).send(
        scoreCalculator.calculateScore({
          competition: data.competition,
          team: {
            league: data.league
          },
          map: data,
          tiles: tiles,
          LoPs: 0,
          exitBonus: true,
          misidentification: 0
        })
      );
    }
  });
});

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

adminRouter.put('/:map', function (req, res, next) {
  const id = req.params.map;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  const map = req.body;
  if (map.dice) {
    for (let i = 0; i < map.dice.length; i++) {
      map.dice[i] = ObjectId(map.dice[i]);
    }
  }

  // Exclude fields that are not allowed to be publicly changed
  delete map._id;
  delete map.__v;
  delete map.competition;

  mazeMap.findById(id, function (err, dbMap) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get map',
        err: err.message,
      });
    }
    if (!dbMap) {
      return res.status(400).send({
        msg: 'Could not get map',
      });
    }

    const cells = [];
    for (const i in map.cells) {
      if (map.cells.hasOwnProperty(i)) {
        const cell = map.cells[i];
        if (isNaN(i)) {
          const coords = i.split(',');
          cell.x = coords[0];
          cell.y = coords[1];
          cell.z = coords[2];
        }
        cells.push(cell);
      }
    }
    map.cells = cells;

    // logger.debug(map)
    dbMap.cells = [];
    err = copyProperties(map, dbMap);
    if (map.dice != undefined) dbMap.dice = map.dice

    if (err) {
      logger.error(err);
      return res.status(400).send({
        err: err.message,
        msg: 'Could not save map',
      });
    }

    mazeRun
      .findOne({
        map: id,
        started: true,
      })
      .lean()
      .exec(function (err, dbRun) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get run',
            err: err.message,
          });
        }
        if (dbRun) {
          err = new Error(`Run ${dbRun._id} already started on map`);
          logger.error(err);
          return res.status(400).send({
            msg: 'Run already started on map!',
            err: err.message,
          });
        }
        dbMap.save(function (err) {
          if (err) {
            logger.error(err);
            return res.status(400).send({
              msg: 'Could not save map',
              err: err.message,
            });
          }
          return res.status(200).send({
            msg: 'Saved!',
          });
        });
      });
  });
});

adminRouter.delete('/:map', function (req, res, next) {
  const id = req.params.map;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  mazeRun.findOne(
    {
      map: id,
      started: true,
    },
    function (err, dbRun) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not remove map',
          err: err.message,
        });
      } else if (dbRun) {
        const err = new Error("Can't remove map with started run connected!");
        logger.error(err);
        res.status(400).send({
          msg: 'Could not remove map',
          err: err.message,
        });
      } else {
        mazeRun.deleteMany(
          {
            map: id,
          },
          function (err) {
            if (err) {
              logger.error(err);
            } else {
              mazeMap.deleteOne(
                {
                  _id: id,
                },
                function (err) {
                  if (err) {
                    logger.error(err);
                    res.status(400).send({
                      msg: 'Could not remove map',
                      err: err.message,
                    });
                  } else {
                    res.status(200).send({
                      msg: 'Map has been removed!',
                    });
                  }
                }
              );
            }
          }
        );
      }
    }
  );
});

adminRouter.get('/name/:competitionid/:name', function (req, res, next) {
  const { name } = req.params;
  const id = req.params.competitionid;

  mazeMap
    .find(
      {
        competition: id,
        name,
      },
      function (err, data) {
        if (err) {
          logger.error(err);
          res.status(400).send({
            msg: 'Could not get teams',
          });
        } else {
          res.status(200).send(data);
        }
      }
    )
    .select('_id');
});

publicRouter.get('/:map/competition-targets-pdf', function (req, res, next) {
  const id = req.params.map;
  const paperSize = req.query.paperSize || 'A4';
  const includeLetterVictims = req.query.includeLetterVictims === 'true';
  const includeCognitiveTargets = req.query.includeCognitiveTargets !== 'false';

  console.log(`PDF request for map ${id}, paper size: ${paperSize}, includeLetterVictims: ${includeLetterVictims}, includeCognitiveTargets: ${includeCognitiveTargets}`);

  if (!ObjectId.isValid(id)) {
    return next();
  }

  mazeMap.findById(id).lean().exec(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get map',
        err: err.message,
      });
    }
    if (!data) {
      return res.status(404).send({
        msg: 'Map not found',
      });
    }

    competitionTargetsPDF.generateAndSendPDF(res, data, paperSize, includeLetterVictims, includeCognitiveTargets);
  });
});

publicRouter.get('/:map/scoresheet', function (req, res, next) {
  const id = req.params.map;
  if (!ObjectId.isValid(id)) {
    return next();
  }

  mazeMap
    .findById(id)
    .populate('competition')
    .lean()
    .exec(function (err, data) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get map',
          err: err.message,
        });
      }
      if (!data) {
        return res.status(404).send({
          msg: 'Map not found',
        });
      }

      const rule = req.query.rule || '2026';
      data.noQR = req.query.noQR === 'true';
      scoreSheetPDFMaze2.generateScoreSheetFromMap(res, data, rule);
    });
});

publicRouter.post('/scoresheet', function (req, res, next) {
  const map = req.body;
  if (!map || !map.cells) {
    return res.status(400).send({
      msg: 'Invalid map data',
    });
  }

  // Convert cells from object map to array if necessary
  if (!Array.isArray(map.cells)) {
    const cells = [];
    for (const i in map.cells) {
      if (map.cells.hasOwnProperty(i)) {
        const cell = map.cells[i];
        if (isNaN(i)) {
          const coords = i.split(',');
          cell.x = parseInt(coords[0]);
          cell.y = parseInt(coords[1]);
          cell.z = parseInt(coords[2]);
          cell.isTile = cell.x % 2 === 1 && cell.y % 2 === 1;
        }
        cells.push(cell);
      }
    }
    map.cells = cells;
  }

  const rule = req.body.rule || '2026';
  scoreSheetPDFMaze2.generateScoreSheetFromMap(res, map, rule);
});

publicRouter.post('/competition-targets-pdf', function (req, res, next) {
  const map = req.body;
  const paperSize = req.body.paperSize || 'A4';
  const includeLetterVictims = req.body.includeLetterVictims === true;
  const includeCognitiveTargets = req.body.includeCognitiveTargets !== false;

  if (!map || !map.cells) {
    return res.status(400).send({
      msg: 'Invalid map data',
    });
  }

  // Convert cells from object map to array if necessary
  if (!Array.isArray(map.cells)) {
    const cells = [];
    for (const i in map.cells) {
      if (map.cells.hasOwnProperty(i)) {
        const cell = map.cells[i];
        if (isNaN(i)) {
          const coords = i.split(',');
          cell.x = parseInt(coords[0]);
          cell.y = parseInt(coords[1]);
          cell.z = parseInt(coords[2]);
        }
        cells.push(cell);
      }
    }
    map.cells = cells;
  }

  competitionTargetsPDF.generateAndSendPDF(res, map, paperSize, includeLetterVictims, includeCognitiveTargets);
});

function getBulkTargetsPDF(req, res) {
  const competitionId = req.query.competition;
  const leagueId = req.query.league;
  const mapIds = req.query.ids ? req.query.ids.split(',') : null;
  const paperSize = req.query.paperSize || 'A4';
  const includeLetterVictims = req.query.includeLetterVictims === 'true';
  const includeCognitiveTargets = req.query.includeCognitiveTargets !== 'false';

  let mapQuery;
  if (mapIds) {
    mapQuery = mazeMap.find({ _id: { $in: mapIds.filter(ObjectId.isValid) } });
  } else if (ObjectId.isValid(competitionId)) {
    mapQuery = mazeMap.find({ competition: competitionId, league: leagueId });
  } else {
    return res.status(400).send({ msg: 'Missing selection' });
  }

  mapQuery.populate('competition', 'name').lean().exec(function (err, maps) {
    if (err) {
      logger.error(err);
      return res.status(400).send({ msg: 'Could not get maps' });
    }
    if (maps.length === 0) {
      return res.status(404).send({ msg: 'No maps found' });
    }

    const competitionName = maps[0].competition ? maps[0].competition.name : 'Competition';
    const leagueName = maps[0].league || 'League';

    competitionTargetsPDF.generateAndSendBulkPDF(
      res,
      maps,
      competitionName,
      leagueName,
      paperSize,
      includeLetterVictims,
      includeCognitiveTargets
    );
  });
}

function getBulkScoreSheetsPDF(req, res) {
  const competitionId = req.query.competition;
  const mapIds = req.query.ids ? req.query.ids.split(',') : null;
  const rule = req.query.rule || '2026';

  let mapQuery;
  if (mapIds) {
    mapQuery = mazeMap.find({ _id: { $in: mapIds.filter(ObjectId.isValid) } });
  } else if (ObjectId.isValid(competitionId)) {
    mapQuery = mazeMap.find({ competition: competitionId });
  } else {
    return res.status(400).send({ msg: 'Missing selection' });
  }

  mapQuery.populate('competition', 'name leagues').lean().exec(function (err, maps) {
    if (err) {
      logger.error(err);
      return res.status(400).send({ msg: 'Could not get maps' });
    }
    if (maps.length === 0) {
      return res.status(404).send({ msg: 'No maps found' });
    }

    scoreSheetPDFMaze2.generateScoreSheetsFromMaps(res, maps, rule);
  });
}

function getBulkMapImagesPDF(req, res) {
  const competitionId = req.query.competition;
  const leagueId = req.query.league;
  const mapIds = req.query.ids ? req.query.ids.split(',') : null;
  const paperSize = req.query.paperSize || 'A4';

  let mapQuery;
  if (mapIds) {
    mapQuery = mazeMap.find({ _id: { $in: mapIds.filter(ObjectId.isValid) } });
  } else if (ObjectId.isValid(competitionId)) {
    mapQuery = mazeMap.find({ competition: competitionId, league: leagueId });
  } else {
    return res.status(400).send({ msg: 'Missing selection' });
  }

  mapQuery.populate('competition', 'name').lean().exec(function (err, maps) {
    if (err) {
      logger.error(err);
      return res.status(400).send({ msg: 'Could not get maps' });
    }
    if (maps.length === 0) {
      return res.status(404).send({ msg: 'No maps found' });
    }

    const competitionName = maps[0].competition ? maps[0].competition.name : 'Competition';
    const leagueName = maps[0].league || 'League';

    competitionTargetsPDF.generateAndSendBulkMapImagesPDF(
      res,
      maps,
      competitionName,
      leagueName,
      paperSize
    );
  });
}

function getBulkMapImagesZip(req, res) {
  const competitionId = req.query.competition;
  const leagueId = req.query.league;
  const mapIds = req.query.ids ? req.query.ids.split(',') : null;

  let mapQuery;
  if (mapIds) {
    mapQuery = mazeMap.find({ _id: { $in: mapIds.filter(ObjectId.isValid) } });
  } else if (ObjectId.isValid(competitionId)) {
    mapQuery = mazeMap.find({ competition: competitionId, league: leagueId });
  } else {
    return res.status(400).send({ msg: 'Missing selection' });
  }

  mapQuery.lean().exec(function (err, maps) {
    if (err) {
      logger.error(err);
      return res.status(400).send({ msg: 'Could not get maps' });
    }
    if (maps.length === 0) {
      return res.status(404).send({ msg: 'No maps found' });
    }

    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    res.attachment('maps.zip');
    archive.pipe(res);

    maps.forEach((map) => {
      const filePath = path.join(__dirname, '../../tmp/course', `${map._id}.png`);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, {
          name: `${map.name || map._id}.png`,
        });
      }
    });

    archive.finalize();
  });
}

function getMapImage(req, res) {
  const { mapid } = req.params;
  const filePath = path.join(__dirname, '../../tmp/course', `${mapid}.png`);
  if (fs.existsSync(filePath)) {
    res.download(filePath, `${mapid}.png`);
  } else {
    res.status(404).send('Image not found. Please prepare score sheets first.');
  }
}

publicRouter.all('*', function (req, res, next) {
  next();
});
privateRouter.all('*', function (req, res, next) {
  next();
});

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
