"use strict"
const mongoose = require('mongoose')
const timestamps = require('mongoose-timestamp')
const validator = require('validator')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId
const async = require('async')

const competitiondb = require('./competition')
const mazeMapdb = require('./mazeMap')

const logger = require('../config/logger').mainLogger

const MAZE_LEAGUES = require("./competition").MAZE_LEAGUES

function isOdd(n) {
  return n & 1 // Bitcheck LSB
}
function isEven(n) {
  return !isOdd(n)
}

const mazeRunSchema = new Schema({
  competition: {
    type    : ObjectId,
    ref     : 'Competition',
    required: true,
    index   : true
  },
  round             : {type: ObjectId, ref: 'Round', required: true, index: true},
  team              : {type: ObjectId, ref: 'Team', required: false, index: true},
  field             : {type: ObjectId, ref: 'Field', required: true, index: true},
  map               : {type: ObjectId, ref: 'MazeMap', required: true, index: true},
  group             : {type: Number, min: 0},
  normalizationGroup: {type: String, index: true},
  diceNumber        : {type: Number, default: null},
  adjustment        : {type: Number, default: 0, min: -100},

  tiles    : [{
    x          : {type: Number, integer: true, required: true},
    y          : {type: Number, integer: true, required: true},
    z          : {type: Number, integer: true, required: true},
    scoredItems: {
      speedbump : {type: Boolean, default: false},
      checkpoint: {type: Boolean, default: false},
      ramp  : {type: Boolean, default: false},
      steps     : {type: Boolean, default: false},
      blue      : {type: Number, integer: true, min: 0, default: 0},
      victims   : {
        top   : {type: Boolean, default: false},
        right : {type: Boolean, default: false},
        bottom: {type: Boolean, default: false},
        left  : {type: Boolean, default: false},
        floor : {type: Boolean, default: false}
      },
      rescueKits: {
        top   : {type: Number, integer: true, min: 0, default: 0},
        right : {type: Number, integer: true, min: 0, default: 0},
        bottom: {type: Number, integer: true, min: 0, default: 0},
        left  : {type: Number, integer: true, min: 0, default: 0},
        floor : {type: Number, integer: true, min: 0, default: 0}
      }
    }
  }],
  LoPs     : {type: Number, min: 0, default: 0},
  misidentification: {type: Number, min:0, default:0},
  foundVictims: [
    {
      type: {type: String},
      count: {type: Number, min: 0, default: 0}
    }
  ],
  distKits: {type: Number, min:0, default: 0},
  exitBonus: {type: Boolean, default: false},
  score    : {type: Number, min: 0, default: 0},
  time     : {
    minutes: {type: Number, min: 0, max: 8, default: 0},
    seconds: {type: Number, min: 0, max: 59, default: 0}
  },
  status   : {type: Number, min: 0, default: 0},
  sign     : {
    captain   : {type: String, default: ""},
    referee   : {type: String, default: ""},
    referee_as: {type: String, default: ""}
  },
  started  : {type: Boolean, default: false, index: true},
  comment  : {type: String, default: ""},
  acceptResult : {type: Boolean, default: true}, // The team agreed to accept the result
  startTime: {type: Number, default: 0}
})

mazeRunSchema.pre('save', function (next) {
  const self = this

  self.populate('map', "name finished", function (err, populatedRun) {
    if (err) {
      return next(err)
    } else if (!populatedRun.map.finished) {
      err = new Error('Map "' + populatedRun.map.name + '" is not finished!')
      return next(err)
    } else {

      if (self.isNew) {
        if (self.team){
            MazeRun.findOne({
              round: self.round,
              team : self.team
            }).populate("round team").exec(function (err, dbRun) {
              if (err) {
                return next(err)
              } else if (dbRun) {
                err = new Error('Team "' + dbRun.team.name +
                                '" already has a run in round "' +
                                dbRun.round.name +
                                '"!')
                return next(err)
              } else {
                // Check that all references matches
                async.parallel({
                    competition: function (callback) {
                      competitiondb.competition.findById(self.competition, function (err, dbCompetition) {
                        if (err) {
                          return callback(err)
                        } else if (!dbCompetition) {
                          return callback(new Error("No competition with that id!"))
                        } else {
                          return callback(null, dbCompetition)
                        }
                      })
                    },
                    round      : function (callback) {
                      competitiondb.round.findById(self.round, function (err, dbRound) {
                        if (err) {
                          return callback(err)
                        } else if (!dbRound) {
                          return callback(new Error("No round with that id!"))
                        } else {
                          return callback(null, dbRound)
                        }
                      })
                    },
                    team       : function (callback) {
                      competitiondb.team.findById(self.team, function (err, dbTeam) {
                        if (err) {
                          return callback(err)
                        } else if (!dbTeam) {
                          return callback(new Error("No team with that id!"))
                        } else {
                          return callback(null, dbTeam)
                        }
                      })
                    },
                    field      : function (callback) {
                      competitiondb.field.findById(self.field, function (err, dbField) {
                        if (err) {
                          return callback(err)
                        } else if (!dbField) {
                          return callback(new Error("No field with that id!"))
                        } else {
                          return callback(null, dbField)
                        }
                      })
                    },
                    map        : function (callback) {
                      mazeMapdb.mazeMap.findById(self.map, function (err, dbMap) {
                        if (err) {
                          return callback(err)
                        } else if (!dbMap) {
                          return callback(new Error("No map with that id!"))
                        } else {
                          return callback(null, dbMap)
                        }
                      })
                    }
                  },
                  function (err, results) {
                    if (err) {
                      return next(err)
                    } else {
                      const competitionId = results.competition.id

                      if (results.round.competition != competitionId) {
                        return next(new Error("Round does not match competition!"))
                      }
                      if (results.team.competition != competitionId) {
                        return next(new Error("Team does not match competition!"))
                      }
                      if (MAZE_LEAGUES.indexOf(results.team.league) == -1) {
                        return next(new Error("Team does not match league!"))
                      }
                      if (results.field.competition != competitionId) {
                        return next(new Error("Field does not match competition!"))
                      }
                      if (results.map.competition != competitionId) {
                        return next(new Error("Map does not match competition!"))
                      }

                      return next()
                    }
                  })
              }
            })
        }
        else{
            async.parallel({
                    competition: function (callback) {
                      competitiondb.competition.findById(self.competition, function (err, dbCompetition) {
                        if (err) {
                          return callback(err)
                        } else if (!dbCompetition) {
                          return callback(new Error("No competition with that id!"))
                        } else {
                          return callback(null, dbCompetition)
                        }
                      })
                    },
                    round      : function (callback) {
                      competitiondb.round.findById(self.round, function (err, dbRound) {
                        if (err) {
                          return callback(err)
                        } else if (!dbRound) {
                          return callback(new Error("No round with that id!"))
                        } else {
                          return callback(null, dbRound)
                        }
                      })
                    },
                    field      : function (callback) {
                      competitiondb.field.findById(self.field, function (err, dbField) {
                        if (err) {
                          return callback(err)
                        } else if (!dbField) {
                          return callback(new Error("No field with that id!"))
                        } else {
                          return callback(null, dbField)
                        }
                      })
                    },
                    map        : function (callback) {
                      mazeMapdb.mazeMap.findById(self.map, function (err, dbMap) {
                        if (err) {
                          return callback(err)
                        } else if (!dbMap) {
                          return callback(new Error("No map with that id!"))
                        } else {
                          return callback(null, dbMap)
                        }
                      })
                    }
                  },
                  function (err, results) {
                    if (err) {
                      return next(err)
                    } else {
                      const competitionId = results.competition.id

                      if (results.round.competition != competitionId) {
                        return next(new Error("Round does not match competition!"))
                      }
                      if (results.field.competition != competitionId) {
                        return next(new Error("Field does not match competition!"))
                      }
                      if (results.map.competition != competitionId) {
                        return next(new Error("Map does not match competition!"))
                      }

                      return next()
                    }
                  })
        }
      } else {
        return next()
      }
    }
  })
})

mazeRunSchema.plugin(timestamps)

const MazeRun = mongoose.model('MazeRun', mazeRunSchema)

/** Mongoose model {@link http://mongoosejs.com/docs/models.html} */
module.exports.mazeRun = MazeRun
