"use strict"
const mongoose = require('mongoose')
const mongooseInteger = require('mongoose-integer')
const validator = require('validator')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId
const async = require('async')
const cluster = require('cluster')

const logger = require('../config/logger').mainLogger

const pathFinder = require('../helper/pathFinder')

const LineRun = require('./lineRun')

const LINE_LEAGUES = require('./competition').LINE_LEAGUES

/**
 *
 *@constructor
 *
 * @param {String} username - The username
 * @param {String} password - The password
 * @param {String} salt - The salt used, unique for every user
 * @param {Boolean} admin - If the user is admin or not
 */
const lineMapSchema = new Schema({
  competition      : {
    type    : ObjectId,
    ref     : 'Competition',
    required: true,
    index   : true
  },
  league     : {type: String, enum: LINE_LEAGUES, required: true, index: true},
  tileSet      : {
    type    : ObjectId,
    ref     : 'TileSet',
    required: true
  },
  name             : {type: String, required: true},
  height           : {type: Number, integer: true, required: true, min: 1},
  width            : {type: Number, integer: true, required: true, min: 1},
  length           : {type: Number, integer: true, required: true, min: 1},
  duration         : {type: Number, integer: true, min: 0, default: 480},
  indexCount       : {type: Number, integer: true, min: 1},
  EvacuationAreaLoPIndex : {type: Number, default:0},
  tiles            : [{
    x        : {type: Number, integer: true, required: true},
    y        : {type: Number, integer: true, required: true},
    z        : {type: Number, integer: true, required: true},
    tileType : {type: ObjectId, ref: 'TileType', required: true},
    rot      : {
      type: Number, required: true, validate: function (a) {
        return a == 0 || a == 90 || a == 180 || a == 270
      }
    },
    items    : {
      obstacles : {
        type    : Number,
        integer : true,
        required: true,
        default : 0,
        min     : 0,
        set: v => v === '' ? 0 : v
      },
      speedbumps: {
        type    : Number,
        integer : true,
        required: true,
        default : 0,
        min     : 0,
        set: v => v === '' ? 0 : v
      },
      rampPoints: {
        type: Boolean,
        default: false,
        required: true,
        set: v => v === '' ? false : v
      }
    },
    index    : {type: [Number], min: 0},
    next     : {type: [String]},
    next_dir : {type: [String]},
    levelUp  : {type: String, enum: ["top", "right", "bottom", "left"]},
    levelDown: {type: String, enum: ["top", "right", "bottom", "left"]},
    checkPoint: {
      type: Boolean,
      default: false,
      required: true,
      set: v => v === '' ? false : v
    },
    evacEntrance: {type: Number, default: -1, set: v => v === '' ? -1 : v},
    evacExit    : {type: Number, default: -1, set: v => v === '' ? -1 : v}
  }],
  startTile        : {
    x: {type: Number, integer: true, required: true, min: -1},
    y: {type: Number, integer: true, required: true, min: -1},
    z: {type: Number, integer: true, required: true, min: -1}
  },
  startTile2       : {
    x: {type: Number, integer: true, required: true, min: -1},
    y: {type: Number, integer: true, required: true, min: -1},
    z: {type: Number, integer: true, required: true, min: -1}
  },
  finished         : {type: Boolean, default: false, set: v => v === '' ? false : v},
  victims: {
      live:{
          type: Number,
          integer: true,
          min: 0,
          max: 100,
          default: 2,
          set: v => v === '' ? 0 : v
      },
      dead:{
          type: Number,
          integer: true,
          min: 0,
          max: 100,
          default: 1,
          set: v => v === '' ? 0 : v
      }
  }
});

lineMapSchema.pre('deleteOne', function (next) {
  LineRun.lineRun.deleteMany({ map: this._id }, next);
});
lineMapSchema.pre('deleteMany', function (next) {
  LineRun.lineRun.deleteMany({ map: this._conditions._id }, next);
});

lineMapSchema.pre('save', function (next) {
  let self = this;
  self.populate('tiles.tileType', function (err, populatedMap) {
    if (err) {
      return next(err)
    } else {
      self = populatedMap;
      //logger.debug(self)
      
      try {
        pathFinder.findPath(self)
      } catch (err) {
        logger.error(err);
      }
      
      if (self.isNew || self.isModified("name")) {
        LineMap.findOne({
          competition: self.competition,
          name       : self.name
        }).populate("competition", "name").exec(function (err, dbMap) {
          if (err) {
            return next(err)
          } else if (dbMap) {
            err = new Error('Map "' + dbMap.name +
                            '" already exists in competition "' +
                            dbMap.competition.name + '"!');
            return next(err)
          } else {
            return next()
          }
        })
      } else {
        LineRun.lineRun.findOne({
          map    : self._id,
          started: true
        }).lean().exec(function (err, dbRun) {
          if (err) {
            return next(err)
          } else if (dbRun) {
            err = new Error('Map "' + self.name +
                            '" used in started runs, cannot modify!');
            return next(err)
          } else {
            return next()
          }
        })
      }
    }
  })
});

const tileSetSchema = new Schema({
  name : {type: String, required: true, unique: true},
  tiles: [{
    tileType: {type: ObjectId, ref: 'TileType', required: true},
    count   : {type: Number, integer: true, default: 1}
  }]
});

const tileTypeSchema = new Schema({
  image        : {type: String, required: true, unique: true},
  gaps         : {
    type    : Number,
    integer : true,
    required: true,
    default : 0,
    min     : 0
  },
  intersections: {
    type    : Number,
    integer : true,
    required: true,
    default : 0,
    min     : 0
  },
  seesaw: {
    type    : Number,
    integer : true,
    required: true,
    default : 0,
    min     : 0
  },
  paths        : {
    "top"   : {type: String, enum: ["top", "right", "bottom", "left"]},
    "right" : {type: String, enum: ["top", "right", "bottom", "left"]},
    "bottom": {type: String, enum: ["top", "right", "bottom", "left"]},
    "left"  : {type: String, enum: ["top", "right", "bottom", "left"]}
  }
});

lineMapSchema.plugin(mongooseInteger);
tileSetSchema.plugin(mongooseInteger);
tileTypeSchema.plugin(mongooseInteger);

const LineMap = mongoose.model('LineMap', lineMapSchema);
const TileSet = mongoose.model('TileSet', tileSetSchema);
const TileType = mongoose.model('TileType', tileTypeSchema);

/** Mongoose model {@link http://mongoosejs.com/docs/models.html} */
module.exports.lineMap = LineMap;
module.exports.tileSet = TileSet;
module.exports.tileType = TileType;

const tileTypes = [
  {
    "image"        : "tile-0.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af90"
  },
  {
    "image"        : "tile-1.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af91"
  },
  {
    "image"        : "tile-2.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af92"
  },
  {
    "image"        : "tile-3.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af93"
  },
  {
    "image"        : "tile-4.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom"   : "left",
      "right" : "top",
      "top": "right"
    },
    "_id"          : "570c27c3f5a9dabe23f3af94"
  },
  {
    "image"        : "tile-5.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af95"
  },
  {
    "image"        : "tile-6.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af96"
  },
  {
    "image"        : "tile-7.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "top"   : "bottom",
      "bottom": "top"
    },
    "_id"          : "570c27c3f5a9dabe23f3af97"
  },
  {
    "image"        : "tile-8.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af98"
  },
  {
    "image"        : "tile-9.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af99"
  },
  {
    "image"        : "tile-10.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af9a"
  },
  {
    "image"        : "tile-11.png",
    "gaps"         : 2,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af9b"
  },
  {
    "image"        : "tile-11_2.png",
    "gaps"         : 1,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "58cfe0d457501b50da7afa62"
  },
  {
    "image"        : "tile-12.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "bottom",
      "bottom": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af9c"
  },
  {
    "image"        : "tile-13.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af9d"
  },
  {
    "image"        : "tile-14.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af9e"
  },
  {
    "image"        : "tile-15.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "top",
      "top"  : "left",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3af9f"
  },
  {
    "image"        : "tile-16.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "top",
      "top"  : "right"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa0"
  },
  {
    "image"        : "tile-16_2.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "top",
      "right": "top",
      "top"  : "top"
    },
    "_id"          : "58cfd29b204466244ba56a1f"
  },
  {
    "image"        : "tile-17.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa1"
  },
  {
    "image"        : "tile-18.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa2"
  },
  {
    "image"        : "tile-19.png",
    "gaps"         : 1,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "right",
      "right" : "left",
      "top"   : "bottom",
      "bottom": "top"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa3"
  },
  {
    "image"        : "tile-20.png",
    "gaps"         : 1,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa4"
  },
  {
    "image"        : "tile-21.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa5"
  },
  {
    "image"        : "tile-22.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa6"
  },
  {
    "image"        : "tile-23.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa7"
  },
  {
    "image"        : "tile-24.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa8"
  },
  {
    "image"        : "tile-25.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right"  : "top",
      "top"   : "right",
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "570c27c3f5a9dabe23f3afa9"
  },
  {
    "image"        : "tile-26.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "570c27c3f5a9dabe23f3afaa"
  },
  {
    "image"        : "tile-27.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "right",
      "right" : "bottom"
    },
    "_id"          : "570c27c3f5a9dabe23f3afab"
  },
  {
    "image"        : "tile-28.png",
    "gaps"         : 1,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3afac"
  },
  {
    "image"        : "tile-29.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom": "left"
    },
    "_id"          : "570c27c3f5a9dabe23f3afad"
  },
  {
    "image"        : "tile-30.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "right",
      "bottom": "top",
      "right" : "top",
      "top"   : "right"
    },
    "_id"          : "570c27c3f5a9dabe23f3afae"
  },
  {
    "image"        : "tile-31.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "top",
      "bottom": "top",
      "right" : "top",
      "top"   : "top"
    },
    "_id"          : "58cfd29b204466244ba56a20"
  },
  {
    "image"        : "tile-32.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "top",
      "top"   : "left",
      "right" : "bottom",
      "bottom": "right"
    },
    "_id"          : "570c27c3f5a9dabe23f3afb2"
  },
  {
    "image"        : "tile-33.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "left",
      "bottom": "bottom",
      "right" : "bottom",
      "top"   : "left"
    },
    "_id"          : "58cfd29b204466244ba56a21"
  },
  {
    "image"        : "tile-34.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "left",
      "bottom": "bottom",
      "right" : "right",
      "top"   : "top"
    },
    "_id"          : "58cfd29b204466244ba56a22"
  },
  {
    "image"        : "tile-35.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "right",
      "top"   : "bottom",
      "right" : "left",
      "bottom": "top"
    },
    "_id"          : "570c27c3f5a9dabe23f3afb4"
  },
  {
    "image"        : "tile-41.png",
    "gaps"         : 0,
    "intersections": 1,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddaf"
  },
  {
    "image"        : "tile-46.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "58cfd6549792e9313b1610e4"
  },
  {
    "image"        : "tile-49.png",
    "gaps"         : 1,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "58cfd6549792e9313b1610e5"
  },
  {
    "image"        : "tile-50.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "58cfd6549792e9313b1610e6"
  },
  {
    "image"        : "tile-51.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left": "bottom",
      "bottom": "left"
    },
    "_id"          : "58cfd6549792e9313b1610e7"
  },
  {
    "image"        : "tile-52.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left": "bottom",
      "bottom": "left"
    },
    "_id"          : "58cfd6549792e9313b1610e8"
  },
  {
    "image"        : "tile-53.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left": "right",
      "right": "left"
    },
    "_id"          : "58cfd6549792e9313b1610e9"
  },
  {
    "image"        : "tile-55.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "top": "bottom"
    },
    "_id"          : "5976bc04d6ef2a2620cdfc86"
  },
  {
    "image"        : "tile-56.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddb0"
  },
  {
    "image"        : "tile-57.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "5975fb67038dda73c0f5ddb1"
  },
  {
    "image"        : "tile-58.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "right",
      "right" : "bottom"
    },
    "_id"          : "5975fb67038dda73c0f5ddb2"
  },
  {
    "image"        : "tile-59.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddb3"
  },
  {
    "image"        : "tile-60.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddb4"
  },
  {
    "image"        : "tile-61.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "5975fb67038dda73c0f5ddb5"
  },
  {
    "image"        : "tile-62.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "top"   : "bottom",
      "bottom": "top"
    },
    "_id"          : "5975fb67038dda73c0f5ddb6"
  },
  {
    "image"        : "tile-63.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom",
      "right"  : "top",
      "top"   : "right"
    },
    "_id"          : "5975fb67038dda73c0f5ddb7"
  },
  {
    "image"        : "tile-64.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "top"   : "bottom",
      "bottom": "top"
    },
    "_id"          : "5975fb67038dda73c0f5ddb8"
  },
  {
    "image"        : "tile-65.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "left",
      "left" : "bottom"
    },
    "_id"          : "5975fb67038dda73c0f5ddb9"
  },
  {
    "image"        : "tile-66.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddba"
  },
  {
    "image"        : "tile-67.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddbb"
  },
  {
    "image"        : "tile-68.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddbc"
  },
  {
    "image"        : "tile-69.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddbd"
  },
  {
    "image"        : "tile-70.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "right",
      "right": "left"
    },
    "_id"          : "5975fb67038dda73c0f5ddbe"
  },
  {
    "image"        : "tile-71.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left"  : "bottom",
      "bottom": "left"
    },
    "_id"          : "5976b9b7607ff6242c06a614"
  },
  {
    "image"        : "007.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right" : "bottom",
      "bottom": "right"
    },
    "_id"          : "58cfd6549792e9313b1610d2"
  },
  {
    "image"        : "009.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "left" : "bottom",
      "bottom": "left"
    },
    "_id"          : "58cfd6549792e9313b1610d3"
  },
  {
    "image"        : "010.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610d4"
  },
  {
    "image"        : "011.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610d5"
  },
  {
    "image"        : "021.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610d6"
  },
  {
    "image"        : "022.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610d7"
  },
  {
    "image"        : "025.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610d8"
  },
  {
    "image"        : "tile-72.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "right",
      "right" : "bottom"
    },
    "_id"          : "58cfd6549792e9313b1610d9"
  },
  {
    "image"        : "tile-73.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "right",
      "right" : "bottom"
    },
    "_id"          : "58cfd6549792e9313b1610da"
  },
  {
    "image"        : "tile-74.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "top",
      "top" : "bottom"
    },
    "_id"          : "58cfd6549792e9313b1610db"
  },
  {
    "image"        : "tile-75.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "top",
      "top" : "bottom"
    },
    "_id"          : "58cfd6549792e9313b1610dc"
  },
  {
    "image"        : "tile-76.png",
    "gaps"         : 1,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "top",
      "top" : "bottom"
    },
    "_id"          : "58cfd6549792e9313b1610dd"
  },
  {
    "image"        : "tile-77.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610de"
  },
  {
    "image"        : "tile-78.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "top": "bottom",
      "bottom" : "top"
    },
    "_id"          : "58cfd6549792e9313b1620e4"
  },
  {
    "image"        : "tile-79.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "top": "bottom",
      "bottom" : "top"
    },
    "_id"          : "58cfd6549792e9313b1620e5"
  },
  {
    "image"        : "tile-80.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "bottom",
      "bottom" : "right"
    },
    "_id"          : "58cfd6549792e9313b1620e6"
  },
  {
    "image"        : "tile-81-1.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "right": "bottom",
      "bottom" : "right"
    },
    "_id"          : "58cfd6549792e9313b1620e7"
  },
  {
    "image"        : "tile-81-2.png",
    "gaps"         : 0,
    "intersections": 2,
    "seesaw"       : 0,
    "paths"        : {
      "right": "bottom",
      "bottom" : "right"
    },
    "_id"          : "58cfd6549792e9313b1620e8"
  },
  {
    "image"        : "tile-82.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "bottom",
      "bottom" : "right"
    },
    "_id"          : "58cfd6549792e9313b1620e9"
  },
  {
    "image"        : "tile-83.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "right": "bottom",
      "bottom" : "right",
      "left": "top",
      "top": "left"
    },
    "_id"          : "58cfd6549792e9313b1620ea"
  },
  {
    "image"        : "seesaw.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 1,
    "paths"        : {
      "right": "left",
      "left" : "right"
    },
    "_id"          : "58cfd6549792e9313b1610df"
  },
  {
    "image"        : "exit.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
      "bottom": "top"
    },
    "_id"          : "58cfd6549792e9313b1610e0"
  },
  {
    "image"        : "ev1.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
    },
    "_id"          : "58cfd6549792e9313b1610e1"
  },
  {
    "image"        : "ev2.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
    },
    "_id"          : "58cfd6549792e9313b1610e2"
  },
  {
    "image"        : "ev3.png",
    "gaps"         : 0,
    "intersections": 0,
    "seesaw"       : 0,
    "paths"        : {
    },
    "_id"          : "58cfd6549792e9313b1610e3"
  }
];

for (var i in tileTypes) {
  const tileType = new TileType(tileTypes[i])
  tileType.save(function (err) {
    if (err) {
      if (err.code != 11000) { // Ignore duplicate key error
        logger.error(err)
      } else {
        TileType.findById(tileType._id, function (err, dbTileType) {
          if (err) {
            logger.error(err)
          } else if (dbTileType) {
            dbTileType.image = tileType.image
            dbTileType.gaps = tileType.gaps
            dbTileType.intersections = tileType.intersections
            dbTileType.paths = tileType.paths
            dbTileType.save(function (err) {
              if (err) {
                logger.error(err)
              }
            })
          }
        })
      }
    }
    else {
      logger.debug("saved tiletype")
    }
  })

}


if(cluster.isMaster){
  let defaultTileSet = [];
  for (var i in tileTypes) {
    const tileType = new TileType(tileTypes[i]);
    defaultTileSet.push(
      {
        'tileType': tileType._id,
        'count':100
      }
    )
  }

  TileSet.findById('5c19d2439590f2d68b15b302', function (err, dbTileSet) {
    if(dbTileSet){
      dbTileSet.tiles = defaultTileSet;
      dbTileSet.save(function (err) {
        if (err) {
          logger.error(err)
        }
      })
    }else{
      let newTileSet = new TileSet({
        '_id': '5c19d2439590f2d68b15b302',
        'name': 'Default(2022)',
        'tiles': defaultTileSet
      });
      newTileSet.save(function (err) {
        if (err) {
          logger.error(err)
        }
      })
    }
  });
}


