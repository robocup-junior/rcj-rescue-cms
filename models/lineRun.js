"use strict"
const mongoose = require('mongoose')
const timestamps = require('mongoose-timestamp')
const validator = require('validator')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId
const async = require('async')

const competitiondb = require('./competition')
const lineMapdb = require('./lineMap')

const logger = require('../config/logger').mainLogger

const LINE_LEAGUES = require("./competition").LINE_LEAGUES

const VICTIM_TYPE = ["LIVE", "DEAD", "KIT"]
const ZONE_TYPE = ["RED", "GREEN"]

const lineRunSchema = new Schema({
  competition: {
    type    : ObjectId,
    ref     : 'Competition',
    required: true,
    index   : true
  },
  round             : {type: ObjectId, ref: 'Round', required: true, index: true},
  team              : {type: ObjectId, ref: 'Team', required: false, index: true},
  field             : {type: ObjectId, ref: 'Field', required: true, index: true},
  map               : {type: ObjectId, ref: 'LineMap', required: true, index: true},
  group             : {type: Number, min: 0},
  normalizationGroup: {type: String, index: true},
  adjustment        : {type: Number, default: 0, min: -100},

  tiles             : [{
    type: new Schema({
      scoredItems: [
        {
            item: {type: String, default: ""},
            scored: {type: Boolean, default: false},
            count: {type: Number, default: 1}
        }
      ]
    }),
    required: true
  }],
  LoPs              : {type: [Number], min: 0},
  evacuationLevel   : {
    type: Number, default: 1, validate: function (l) {
      return l == 1 || l == 2
    },
  },
  kitLevel   : {
    type: Number, default: 1, validate: function (l) {
      return l == 1 || l == 2
    },
  },
  exitBonus         : {type: Boolean, default: false},
  rescueOrder : [{
      victimType: {type: String, enum: VICTIM_TYPE},
      zoneType: {type: String, enum: ZONE_TYPE}
  }],
  score             : {type: Number, min: -1000, default: 0},
  raw_score         : {type: Number, min: -1000, default: 0},
  multiplier        : {type: Number, min: 1.0, default: 1.0},
  showedUp          : {type: Boolean, default: false},
  time              : {
    minutes: {type: Number, min: 0, max: 8, default: 0},
    seconds: {type: Number, min: 0, max: 59, default: 0},
  },
  status            : {type: Number, min: -1, default: 0},
  sign              : {
    captain   : {type: String, default: ""},
    referee   : {type: String, default: ""},
    referee_as: {type: String, default: ""}
  },
  started           : {type: Boolean, default: false, index: true},
  comment           : {type: String, default: ""},
  startTime         : {type: Number, default: 0},
  nl  : {
    liveVictim: [{
      found: {type: Boolean, default: false},
      identified: {type: Boolean, default: false}
    }],
    deadVictim: [{
      found: {type: Boolean, default: false},
      identified: {type: Boolean, default: false}
    }]
  },
  isNL: {type: Boolean, default: false}
});

lineRunSchema.pre('save', function (next) {
  const self = this

  lineMapdb.lineMap.findById(self.map, "name finished", function (err, dbMap) {
    if (err) {
      return next(err)
    } else if (!dbMap) {
      return next(new Error('No map with that id!'))
    } else if (!dbMap.finished) {
      err = new Error('Map "' + dbMap.name + '" is not finished!')
      return next(err)
    } else {
      if (self.isNew) {
          if(self.team){
            LineRun.findOne({
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
                      lineMapdb.lineMap.findById(self.map, function (err, dbMap) {
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
                      if (LINE_LEAGUES.indexOf(results.team.league) == -1) {
                        return next(new Error("Team does not match league!"))
                      }
                      if (results.field.competition != competitionId) {
                        return next(new Error("Field does not match competition!"))
                      }
                      if (results.map.competition != competitionId) {
                        return next(new Error("Map does not match competition!"))
                      }

                      if(results.team.league == "LineNL"){
                        self.isNL = true;
                      }else{
                        self.isNL = false;
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
                lineMapdb.lineMap.findById(self.map, function (err, dbMap) {
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


lineRunSchema.plugin(timestamps)

const LineRun = mongoose.model('LineRun', lineRunSchema)

/** Mongoose model {@link http://mongoosejs.com/docs/models.html} */
module.exports.lineRun = LineRun
