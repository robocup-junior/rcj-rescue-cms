const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const fs = require('fs');
const mkdirp = require('mkdirp');
const { lineMap } = require('../../models/lineMap');
const { lineRun } = require('../../models/lineRun');
const { tileType } = require('../../models/lineMap');
const { tileSet } = require('../../models/lineMap');
const logger = require('../../config/logger').mainLogger;
const initRun = require('../../helper/initRunData');
const scoreCalculator = require('../../helper/scoreCalculator');

privateRouter.get('/', getLineMaps);

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

adminRouter.get('/image/:map', function (req, res, next) {
  const id = req.params.map;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  /* 画像を送る */
});

publicRouter.post('/image/:map', function (req, res, next) {
  const id = req.params.map;
  if (!ObjectId.isValid(id)) {
    return next();
  }
  // The /service/editor flow renders previews against this dummy id without
  // touching any saved map; everything else is admin-write to a real map.
  const isDummyId = id === '000000000000000000000000';
  const isAdmin = req.user && req.user.admin === true;
  if (!isDummyId && !isAdmin) {
    return res.status(403).send({ msg: 'Forbidden' });
  }
  const base64Data = req.body.img.replace(/^data:image\/png;base64,/, '');
  let path = `${__dirname}/../../tmp/course`;
  mkdirp.sync(path);
  path += `/${id}.png`;
  fs.writeFile(path, base64Data, 'base64', function (err) {
    res.send(path);
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

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
