"use strict"
const mongoose = require('mongoose')
const mongooseInteger = require('mongoose-integer')
const validator = require('validator')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId
const async = require('async')
const mazeFill = require('../helper/mazeFill')

const logger = require('../config/logger').mainLogger

const VICTIMS = ['H', 'S', 'U', 'PHI', 'PSI', 'OMEGA', "Red", "Yellow", "Green", "None"];

const MazeRun = require('./mazeRun')

const MAZE_LEAGUES = require('./competition').MAZE_LEAGUES

module.exports.VICTIMS = VICTIMS

function isOdd(n) {
  return n & 1 // Bitcheck LSB
}
function isEven(n) {
  return !isOdd(n)
}

/**
 *
 *@constructor
 *
 * @param {String} username - The username
 * @param {String} password - The password
 * @param {String} salt - The salt used, unique for every user
 * @param {Boolean} admin - If the user is admin or not
 */

const tileSchema = new Schema({
  reachable    : {type: Boolean, default: false},
  checkpoint   : {type: Boolean, default: false},
  speedbump    : {type: Boolean, default: false},
  black        : {type: Boolean, default: false},
  ramp         : {type: Boolean, default: false},
  steps        : {type: Boolean, default: false},
  blue         : {type: Boolean, default: false},
  red          : {type: Boolean, default: false},
  victims      : {
    top   : {
      type   : String,
      enum   : VICTIMS,
      default: "None"
    },
    right : {
      type   : String,
      enum   : VICTIMS,
      default: "None"
    },
    bottom: {
      type   : String,
      enum   : VICTIMS,
      default: "None"
    },
    left  : {
      type   : String,
      enum   : VICTIMS,
      default: "None"
    },
    floor : {
      type   : String,
      enum   : VICTIMS,
      default: "None"
    }
  },
  changeFloorTo: {type: Number, integer: true, min: 0}
})

const mazeMapSchema = new Schema({
  competition: {
    type    : ObjectId,
    ref     : 'Competition',
    required: true,
    index   : true
  },
  league     : {type: String, enum: MAZE_LEAGUES, required: true, index: true},
  name       : {type: String, required: true},
  parent     : {type: ObjectId},
  dice       : [
      {
        type : ObjectId,
        ref  : 'MazeMap'
      }
  ],
  height     : {type: Number, integer: true, required: true, min: 1},
  width      : {type: Number, integer: true, required: true, min: 1},
  length     : {type: Number, integer: true, required: true, min: 1},
  duration   : {type: Number, integer: true, min: 0, default: 480},
  leagueType : {type: String, default: "standard"},
  cells      : [{
    x       : {type: Number, integer: true, required: true, min: 0},
    y       : {type: Number, integer: true, required: true, min: 0},
    z       : {type: Number, integer: true, required: true, min: 0},
    isTile  : {type: Boolean, default: false},
    isWall  : {type: Boolean, default: false},
    isLinear: {type: Boolean, default: false},
    ignoreWall: {type: Boolean, default: false},
    virtualWall: {type: Boolean, default: false},
    halfWall: {type: Number},
    tile: tileSchema
  }],
  startTile  : {
    x: {
      type    : Number,
      integer : true,
      required: true,
      min     : 1,
      validate: {validator: isOdd, message: '{VALUE} is not odd (not a tile)!'}
    },
    y: {
      type    : Number,
      integer : true,
      required: true,
      min     : 1,
      validate: {validator: isOdd, message: '{VALUE} is not odd (not a tile)!'}
    },
    z: {type: Number, integer: true, required: true, min: 0}
  },
  finished   : {type: Boolean, default: 0}
})

mazeMapSchema.pre('save', function (next) {
  var self = this;
  
  for (let i = 0; i < self.cells.length; i++) {
    let cell = self.cells[i];

    if (cell.x > self.width * 2 || cell.y > self.length * 2 ||
        cell.z >= self.height) {
      self.cells.splice(i, 1);
      continue
    }
    
    if (isOdd(cell.x) && isOdd(cell.y)) {
      cell.isTile = true;
      cell.isWall = false;
      
      if (cell.tile == null) {
        cell.tile = {}
      }
      
      /*if (cell.x == self.startTile.x && cell.y == self.startTile.y &&
          cell.z == self.startTile.z) {
        cell.tile.checkpoint = true
      }*/
      
      if (cell.tile.black) {
        if (cell.tile.checkpoint) {
          const err = new Error("Tile can't be both black and checkpoint at x: " +
                                cell.x + ", y: " +
                                cell.y + ", z: " + cell.z + "!");
          return next(err);
        }

        if (cell.tile.steps) {
          const err = new Error("Tile can't be both black and steps at x: " +
                                cell.x + ", y: " +
                                cell.y + ", z: " + cell.z + "!");
          return next(err);
        }
      }

      if (cell.tile.black || cell.tile.checkpoint || cell.tile.steps || cell.tile.speedbump || cell.tile.ramp || cell.tile.blueTile || cell.tile.redTile) {
        if ((cell.tile.victims.top != null &&
             cell.tile.victims.top != "None") ||
        
            (cell.tile.victims.right != null &&
             cell.tile.victims.right != "None") ||
        
            (cell.tile.victims.bottom != null &&
             cell.tile.victims.bottom != "None") ||
        
            (cell.tile.victims.left != null &&
             cell.tile.victims.left != "None")) {
          
          const err = new Error("Can't have victims on black/silver/blue tile & with stair, ramp, obstacle at x: " +
                                cell.x + ", y: " +
                                cell.y + ", z: " + cell.z + "!")
          return next(err)
        }
      }

      if (self.leagueType == "entry") { // Validation for Rescue Maze Entry League
        if (cell.tile.steps || cell.tile.ramp || cell.tile.blueTile) {
          cell.tile.steps = false;
          cell.tile.ramp = false;
          cell.tile.blueTile = false;
        }
      }
      
    } else if (isEven(cell.x) && isEven(cell.y)) {
      const err = new Error("Illegal cell placement at x: " + cell.x + ", y: " +
                            cell.y + ", z: " + cell.z + "!")
      return next(err)
    } else {
      if (!cell.isWall && !cell.halfWall) {
        self.cells.splice(i, 1)
      } else {
        cell.isTile = false
        delete cell.tile
      }
    }
  }
  
  if (self.finished) {
    mazeFill.floodFill(self)
  }
  
  if (self.isNew || self.isModified("name")) {
    MazeMap.findOne({
      competition: self.competition,
      name       : self.name
    }).populate("competition", "name").exec(function (err, dbMap) {
      if (err) {
        return next(err)
      } else if (dbMap) {
        err = new Error('Map "' + dbMap.name +
                        '" already exists in competition "' +
                        dbMap.competition.name + '"!')
        return next(err)
      } else {
        return next()
      }
    })
  } else {
    MazeRun.mazeRun.findOne({
          map    : self._id,
          started: true
        }).lean().exec(function (err, dbRun) {
          if (err) {
            return next(err)
          } else if (dbRun) {
            err = new Error('Map "' + self.name +
                            '" used in started runs, cannot modify!')
            return next(err)
          } else {
            return next()
          }
        })
  }
})

mazeMapSchema.pre('deleteOne', function (next) {
  MazeRun.mazeRun.deleteMany({ map: this._id }, next);
});
mazeMapSchema.pre('deleteMany', function (next) {
  MazeRun.mazeRun.deleteMany({ map: this._conditions._id }, next);
});

mazeMapSchema.plugin(mongooseInteger)

const MazeMap = mongoose.model('MazeMap', mazeMapSchema)

/** Mongoose model {@link http://mongoosejs.com/docs/models.html} */
module.exports.mazeMap = MazeMap
