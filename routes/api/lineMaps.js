const express = require('express');
const archiver = require('archiver');


const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const fs = require('fs');
const { lineMap } = require('../../models/lineMap');
const { lineRun } = require('../../models/lineRun');
const { tileType } = require('../../models/lineMap');
const { tileSet } = require('../../models/lineMap');
const logger = require('../../config/logger').mainLogger;
const initRun = require('../../helper/initRunData');
const scoreCalculator = require('../../helper/scoreCalculator');
const lineSSR = require('../../helper/lineSSR');
const lineMapPDF = require('../../helper/lineMapPDF');
const auth = require('../../helper/authLevels');
const scoreSheetPDFLine2 = require('../../helper/scoreSheetPDFLine2');
const { ACCESSLEVELS } = require('../../models/user');

privateRouter.get('/', getLineMaps);
publicRouter.get('/image/:mapid', getMapImage);
publicRouter.post('/map-image-pdf', handlePublicMapImagePDF);
publicRouter.post('/map-image-png', handlePublicMapImagePNG);
publicRouter.post('/scoresheet', handleScoresheet);

adminRouter.get('/export', handleExport);

function getLineMaps(req, res) {
  const competition = req.query.competition || req.params.competition;
  const league = req.params.league;

  let query;
  if (competition != null && competition.constructor === String) {
    query = lineMap.find({
      competition,
    });
  } else if (Array.isArray(competition)) {
    query = lineMap.find({
      competition: {
        $in: competition.filter(ObjectId.isValid),
      },
    });
  } else {
    query = lineMap.find({});
  }

  query.select('competition name league');

  query.lean().exec(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get maps',
      });
    }
    if (league) data = data.filter((m) => m.league == league);
    return res.status(200).send(data);
  });
}
module.exports.getLineMaps = getLineMaps;

adminRouter.post('/', function (req, res) {
  const map = req.body;
  if (typeof(map) != "object") {
    res.status(400).send("Bad request");
    return;
  }

  const tiles = [];
  for (const i in map.tiles) {
    if (map.tiles.hasOwnProperty(i)) {
      const tile = map.tiles[i];

      if (isNaN(i)) {
        const coords = i.split(',');
        tile.x = coords[0];
        tile.y = coords[1];
        tile.z = coords[2];
      }

      // logger.debug(tile)

      const tileTypeId =
        typeof tile.tileType === 'object' ? tile.tileType._id : tile.tileType;
      tiles.push({
        x: tile.x,
        y: tile.y,
        z: tile.z,
        tileType: tileTypeId,
        rot: tile.rot,
        items: {
          obstacles: tile.items.obstacles,
          speedbumps: tile.items.speedbumps,
          rampPoints: undefied2false(tile.items.rampPoints),
        },
        levelUp: tile.levelUp,
        levelDown: tile.levelDown,
        checkPoint: undefied2false(tile.checkPoint),
      });
    }
  }

  // logger.debug(tiles)

  const newMap = new lineMap({
    competition: map.competition,
    tileSet: map.tileSet,
    name: map.name,
    height: map.height,
    width: map.width,
    length: map.length,
    tiles,
    startTile: {
      x: map.startTile.x,
      y: map.startTile.y,
      z: map.startTile.z,
    },
    startTile2: {
      x: map.startTile2.x,
      y: map.startTile2.y,
      z: map.startTile2.z,
    },
    finished: map.finished,
    victims: map.victims,
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
      res.location(`/api/maps/line/${data._id}`);
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

  const query = lineMap.findById(id);
  let populate;
  if (req.query.populate !== undefined && req.query.populate) {
    query.populate('tiles.tileType', '-__v');
  }

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

  lineMap.findById(id).populate([
    {
      path: 'competition',
      select: 'leagues'
    },
  ]).select("competition league").lean().exec(async function (err, data) {
    const rule = data.competition.leagues.find((l) => l.league == data.league).rule;
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get map',
        err: err.message,
      });
    } else {
      let run = await initRun.initLine(
        {
          competition: data.competition,
          team: {
            league: data.league
          },
          map: id,
          isNL: data.league == "LineNL",
          nl: {},
          exitBonus: true
        }, rule, true
      )
      res.status(200).send(scoreCalculator.calculateScore(run));
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

  // Exclude fields that are not allowed to be publicly changed
  delete map._id;
  delete map.__v;
  delete map.competition;
  delete map.indexCount;

  lineMap.findById(id, function (err, dbMap) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get map',
        err: err.message,
      });
    }

    const tiles = [];
    for (const i in map.tiles) {
      if (map.tiles.hasOwnProperty(i)) {
        const tile = map.tiles[i];
        if (isNaN(i)) {
          const coords = i.split(',');
          tile.x = coords[0];
          tile.y = coords[1];
          tile.z = coords[2];
        }
        tiles.push(tile);
      }
    }
    map.tiles = tiles;

    // logger.debug(map)
    dbMap.tiles = [];
    err = copyProperties(map, dbMap);

    if (err) {
      logger.error(err);
      return res.status(400).send({
        err: err.message,
        msg: 'Could not save map',
      });
    }

    lineRun
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

  lineRun.findOne({ map: id, started: true }, function (err, dbRun) {
    if (err) {
      logger.error(err);
      res.status(400).send({ msg: 'Could not remove map', err: err.message });
    } else if (dbRun) {
      const err = new Error("Can't remove map with started run connected!");
      logger.error(err);
      res.status(400).send({ msg: 'Could not remove map', err: err.message });
    } else {
      lineRun.deleteMany({ map: id }, function (err) {
        if (err) {
          logger.error(err);
        } else {
          lineMap.deleteOne({ _id: id }, function (err) {
            if (err) {
              logger.error(err);
              res.status(400).send({
                msg: 'Could not remove map',
                err: err.message,
              });
            } else {
              res.status(200).send({ msg: 'Map has been removed!' });
            }
          });
        }
      });
    }
  });
});

publicRouter.get('/tiletypes', getTileTypes);

publicRouter.get('/tiletypes/:tiletype', function (req, res, next) {
  const id = req.params.tiletype;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  return getTileTypes(req, res, next);
});

function getTileTypes(req, res) {
  const tileTypes = req.query.id || req.body.id || req.params.tiletype;

  let query;
  if (tileTypes != null && tileTypes.constructor === String) {
    // String with single id
    query = tileType.findById(tileTypes);
  } else if (Array.isArray(tileTypes)) {
    // Array of ids
    query = tileType.find({
      _id: {
        $in: tileTypes.filter(ObjectId.isValid),
      },
    });
  } else {
    // Get all
    query = tileType.find({});
  }

  query.select('-paths -__v');

  query.lean().exec(function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get tiletypes',
        err: err.message,
      });
    } else {
      res.status(200).send(data);
    }
  });
}

publicRouter.get('/tilesets', getTileSets);

function getTileSets(req, res, next) {
  // Get all
  const query = tileSet.find({});

  if (req.query.populate !== undefined && req.query.populate) {
    query.populate([
      {
        path: 'tiles.tileType',
      },
    ]);
  }

  query.lean().exec(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get tile sets',
        err: err.message,
      });
    }
    return res.status(200).send(data);
  });
}
module.exports.getTileSets = getTileSets;

adminRouter.get(
  '/tileCount/:expectMapId/:tileSetId/:tileId',
  async function (req, res, next) {
    // Count number of used tiles in the tile set you specified expect specified mapId
    let { expectMapId } = req.params;
    if (!ObjectId.isValid(expectMapId)) {
      expectMapId = null;
    }
    const { tileSetId } = req.params;
    if (!ObjectId.isValid(tileSetId)) {
      return next();
    }
    const countTileId = req.params.tileId;
    if (!ObjectId.isValid(countTileId)) {
      return next();
    }

    const result = await lineMap.aggregate([
      { $match: { _id: { $ne: ObjectId(expectMapId) } } },
      { $match: { tileSet: ObjectId(tileSetId) } },
      { $unwind: '$tiles' },
      { $match: { 'tiles.tileType': ObjectId(countTileId) } },
    ]);

    res.status(200).send({
      tileSetId,
      tileId: countTileId,
      expectMapId,
      usedCount: result.length,
    });
  }
);

adminRouter.get(
  '/tileCount/:expectMapId/:tileSetId',
  async function (req, res, next) {
    // Count number of used tiles in the tile set you specified expect specified mapId
    let { expectMapId } = req.params;
    if (!ObjectId.isValid(expectMapId)) {
      expectMapId = null;
    }
    const { tileSetId } = req.params;
    if (!ObjectId.isValid(tileSetId)) {
      return next();
    }

    const tset = await tileSet.findById(tileSetId).select('_id tiles');

    const countList = [];
    for (const t of tset.tiles) {
      const result = await lineMap.aggregate([
        { $match: { _id: { $ne: ObjectId(expectMapId) } } },
        { $match: { tileSet: ObjectId(tileSetId) } },
        { $unwind: '$tiles' },
        { $match: { 'tiles.tileType': ObjectId(t.tileType) } },
      ]);
      const tmp = {
        tileId: t.tileType,
        usedCount: result.length,
      };
      countList.push(tmp);
    }
    res.status(200).send(countList);
  }
);

adminRouter.post('/tilesets', function (req, res, next) {
  const tileset = req.body;
  let newset;
  if (tileset.tiles) {
    newset = {
      name: tileset.name,
      tiles: tileset.tiles,
    };
  } else {
    newset = {
      name: tileset.name,
    };
  }

  new tileSet(newset).save(function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Error saving tileset',
        err: err.message,
      });
    } else {
      res.status(201).send({
        msg: 'New tileset has been saved',
        id: data._id,
      });
    }
  });
});

publicRouter.get('/tilesets/:tileset', function (req, res, next) {
  const id = req.params.tileset;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  tileSet
    .findById(id)
    .select('_id name tiles')
    .populate('tiles.tileType', '-paths -__v')
    .lean()
    .exec((err, data) => {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get tile set',
          err: err.message,
        });
      } else {
        res.status(200).send(data);
      }
    });
});

adminRouter.put('/tilesets/:tileset', function (req, res, next) {
  const id = req.params.tileset;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  const _tileSet = req.body;

  tileSet.findById(id, (err, dbTileSet) => {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get tile set',
        err: err.message,
      });
    } else {
      dbTileSet.tiles = _tileSet.tiles;
      dbTileSet.save((err, data) => {
        if (err) {
          logger.error(err);
          res.status(400).send({
            msg: 'Could not get tile set',
            err: err.message,
          });
        } else {
          res.status(200).send({
            msg: 'TileSet updated!',
          });
        }
      });
    }
  });
});

adminRouter.delete('/tilesets/:tileset', function (req, res, next) {
  const id = req.params.tileset;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  tileSet.deleteOne(
    {
      _id: id,
    },
    (err) => {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not remove tileset',
          err: err.message,
        });
      } else {
        res.status(200).send({
          msg: 'Tileset has been removed!',
        });
      }
    }
  );
});

privateRouter.get('/name/:competitionid/:name', function (req, res, next) {
  const { name } = req.params;
  const id = req.params.competitionid;

  lineMap
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

async function handlePublicMapImagePDF(req, res, next) {
  const map = req.body;
  const paperSize = req.body.paperSize || 'A4';

  if (!map || !map.tiles) {
    return res.status(400).send({
      msg: 'Invalid map data',
    });
  }

  // Convert tiles from object map to array if necessary
  if (!Array.isArray(map.tiles)) {
    const tiles = [];
    for (const i in map.tiles) {
      if (map.tiles.hasOwnProperty(i)) {
        const tile = map.tiles[i];
        if (isNaN(i)) {
          const coords = i.split(',');
          tile.x = parseInt(coords[0]);
          tile.y = parseInt(coords[1]);
          tile.z = parseInt(coords[2]);
        }
        tiles.push(tile);
      }
    }
    map.tiles = tiles;
  }

  await lineMapPDF.generateAndSendBulkMapImagesPDF(
    res,
    [map],
    map.competitionName || 'Competition',
    map.leagueName || 'League',
    paperSize
  );
}

async function handlePublicMapImagePNG(req, res, next) {
  const map = req.body;

  if (!map || !map.tiles) {
    return res.status(400).send({
      msg: 'Invalid map data',
    });
  }

  // Convert tiles from object map to array if necessary
  if (!Array.isArray(map.tiles)) {
    const tiles = [];
    for (const i in map.tiles) {
      if (map.tiles.hasOwnProperty(i)) {
        const tile = map.tiles[i];
        if (isNaN(i)) {
          const coords = i.split(',');
          tile.x = parseInt(coords[0]);
          tile.y = parseInt(coords[1]);
          tile.z = parseInt(coords[2]);
        }
        tiles.push(tile);
      }
    }
    map.tiles = tiles;
  }

  const buffer = await lineSSR.generatePNG(map, map.rule || '2026');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(map.name || 'map')}.png"`);
  res.send(buffer);
}

function getMapsFromRequest(req, callback) {
  const competitionId = req.query.competition;
  const leagueId = req.query.league;
  const mapIds = req.query.ids ? req.query.ids.split(',') : (req.params.map ? [req.params.map] : null);

  let mapQuery;
  if (mapIds) {
    mapQuery = lineMap.find({ _id: { $in: mapIds.filter(ObjectId.isValid) } });
  } else if (ObjectId.isValid(competitionId)) {
    mapQuery = lineMap.find({ competition: competitionId, league: leagueId });
  } else {
    return callback(new Error('Missing selection'), null);
  }

  mapQuery.populate('tiles.tileType').populate('competition', 'name').lean().exec(callback);
}

function handleExport(req, res) {
  const { type, format } = req.query;
  const rule = req.query.rule || '2026';

  getMapsFromRequest(req, async (err, maps) => {
    if (err) {
      return res.status(400).send({ msg: err.message });
    }
    if (!maps || maps.length === 0) {
      return res.status(404).send({ msg: 'No maps found' });
    }

    const competitionId = maps[0].competition ? maps[0].competition._id : null;

    if (!auth.authCompetition(req.user, competitionId, ACCESSLEVELS.ADMIN)) {
      return res.status(401).send({
        msg: 'You have no authority to access this api',
      });
    }

    const competitionName = maps[0].competition ? maps[0].competition.name : 'Competition';
    const leagueName = maps[0].league || 'League';

    if (type === 'scoresheets') {
      return await scoreSheetPDFLine2.generateScoreSheetsFromMaps(res, maps, rule, true);
    }

    if (type === 'maps') {
      if (format === 'png') {
        const archive = archiver('zip', { zlib: { level: 9 } });
        res.attachment('maps.zip');
        archive.pipe(res);
        for (const map of maps) {
          const buffer = await lineSSR.generatePNG(map, rule);
          archive.append(buffer, { name: `${map.name || map._id}.png` });
        }
        return archive.finalize();
      }
      const paperSize = req.query.paperSize || 'A4';
      return lineMapPDF.generateAndSendBulkMapImagesPDF(
        res,
        maps,
        competitionName,
        leagueName,
        paperSize
      );
    }

    res.status(400).send('Invalid export type');
  });
}

function getMapImage(req, res) {
  const mapid = req.params.mapid;
  if (!ObjectId.isValid(mapid)) {
    return res.status(400).send('Invalid map ID');
  }

  lineMap.findById(mapid).populate('tiles.tileType').lean().exec(async (err, map) => {
    if (err || !map) {
      return res.status(404).send('Map not found');
    }
    const buffer = await lineSSR.generatePNG(map, req.query.rule || '2026');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(map.name || mapid)}.png"`);
    res.send(buffer);
  });
}

publicRouter.all('*', function (req, res, next) {
  next();
});
privateRouter.all('*', function (req, res, next) {
  next();
});

function undefied2false(data) {
  if (data) return true;
  return false;
}

async function handleScoresheet(req, res) {
  const map = req.body;
  const rule = map.rule || '2026';
  await scoreSheetPDFLine2.generateScoreSheetFromMap(res, map, rule);
}

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
