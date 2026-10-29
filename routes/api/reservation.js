//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const nodemailer = require('nodemailer');
const { ACCESSLEVELS } = require('../../models/user');
const auth = require('../../helper/authLevels');
const logger = require('../../config/logger').mainLogger;
const reservationDb = require('../../models/reservation');
const competitiondb = require('../../models/competition');
const access = require('../../helper/access');


const S = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const N = 32;

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=',
  'base64'
);

function getIP(req) {
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'];
  }
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }
  if (req.connection.socket && req.connection.socket.remoteAddress) {
    return req.connection.socket.remoteAddress;
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return '0.0.0.0';
}

let smtp;
if (process.env.MAIL_SMTP &&process.env.MAIL_PORT &&process.env.MAIL_FROM) {
  let smtp_conf;
  if(process.env.MAIL_USER && process.env.MAIL_PASS){
    smtp_conf = {
      host: process.env.MAIL_SMTP,
      port: process.env.MAIL_PORT,
      secure: process.env.MAIL_PORT == 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    };
  }else{
    //No auth
    smtp_conf = {
      host: process.env.MAIL_SMTP,
      port: process.env.MAIL_PORT,
      use_authentication: false,
      tls: {
          rejectUnauthorized: false
      }
    };
  }
  smtp = nodemailer.createTransport(smtp_conf);
} else {
  smtp = null;
}

let socketIo;

module.exports.connectSocketIo = function (io) {
  socketIo = io;
};


adminRouter.post('/config/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), function (req, res, next) {
  const competitionId = req.params.competitionId;
  let resvData = req.body;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }

  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  resvData.competition = competitionId;

  new reservationDb.reservation(resvData).save(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Error saving resv table in db',
        err: err.message,
      });
    }
    return res.status(201).send({
      id: data._id,
    });
  });
});

adminRouter.get('/config/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), function (req, res, next) {
  const competitionId = req.params.competitionId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  reservationDb.reservation
    .find({
      competition: competitionId,
    })
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }
      return res.status(200).send(dbResv);
    });
});

adminRouter.get('/config/:competitionId/:resvId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), access.of(reservationDb.reservation, 'params.resvId', ACCESSLEVELS.ADMIN), function (req, res, next) {
  const competitionId = req.params.competitionId;
  const resvId = req.params.resvId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  reservationDb.reservation
    .findOne({
      _id: resvId,
      competition: competitionId,
    })
    .populate("slot.booked")
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }
      return res.status(200).send(dbResv);
    });
});

adminRouter.delete('/config/:competitionId/:resvId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), access.of(reservationDb.reservation, 'params.resvId', ACCESSLEVELS.ADMIN), function (req, res, next) {
  const competitionId = req.params.competitionId;
  const resvId = req.params.resvId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  reservationDb.reservation
    .deleteOne({
      _id: resvId,
      competition: competitionId,
    })
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not delete resv',
          err: err.message,
        });
      }
      if (socketIo !== undefined) {
        socketIo.sockets.in(`reservation/${resvId}`).emit('update', {});
      }
      return res.status(200).send({
        msg: "Deleted"
      });
    });
});

adminRouter.put('/config/:competitionId/:resvId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), access.of(reservationDb.reservation, 'params.resvId', ACCESSLEVELS.ADMIN), function (req, res, next) {
  const competitionId = req.params.competitionId;
  const resvId = req.params.resvId;
  let resvData = req.body;
  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  reservationDb.reservation
    .findById(resvId)
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }

      resvData.competition = competitionId;
      dbResv.i18n = resvData.i18n;
      dbResv.languages = resvData.languages;
      dbResv.deadline = resvData.deadline;
      dbResv.enable = resvData.enable;
      dbResv.league = resvData.league;
      dbResv.team = resvData.team;
      
      for(let slot of resvData.slot){
        let d = dbResv.slot.filter(s => s.slotId === slot.slotId);
        if(d.length == 1){
          slot.booked = d[0].booked;
        }else{
          slot.booked = [];
        }
      }
      dbResv.slot = resvData.slot;

      dbResv.save(function (err, data) {
        if (err) {
          logger.error(err);
          return res.status(500).send({
            msg: err.message,
          });
        } else {
          if (socketIo !== undefined) {
            socketIo.sockets.in(`reservation/${resvId}`).emit('update', {});
          }
          return res.status(200).send({
            msg: 'Saved',
          });
        }
      });
    });
});

adminRouter.put('/admin/:competitionId/:resvId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), access.of(reservationDb.reservation, 'params.resvId', ACCESSLEVELS.ADMIN), function (req, res, next) {
  const competitionId = req.params.competitionId;
  const resvId = req.params.resvId;
  let resvData = req.body;
  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  reservationDb.reservation
    .findById(resvId)
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }

      for(let slot of dbResv.slot){
        if(slot.slotId == resvData.slotId){
          slot.booked = [];
          for(let b of resvData.booked){
            slot.booked.push(b._id);
          }
          break;
        }
      }

      dbResv.save(function (err, data) {
        if (err) {
          logger.error(err);
          return res.status(500).send({
            msg: err.message,
          });
        } else {
          if (socketIo !== undefined) {
            socketIo.sockets.in(`reservation/${resvId}`).emit('update', {});
          }
          return res.status(200).send({
            msg: 'Saved',
          });
        }
      });
    });
});

publicRouter.get('/book/:teamId/:token/:resvId', access.team(), function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const resvId = req.params.resvId;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }

  competitiondb.team.findOne({
    "_id": teamId,
    "document.token": token
  })
  .exec(function (err, team) {
    if (err || team == null) {
      if (!err) err = { message: 'No team found' };
      return res.status(403).send({
      });
    } else if (team) {
      reservationDb.reservation
      .findOne({
        _id: resvId,
        competition: team.competition,
        enable: true,
        $or: [
          {league: team.league},
          {team: teamId}
        ]
      })
      .exec(function (err, dbResv) {
        if (err || dbResv == null) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get resv',
            err: err,
          });
        }

        let slot = [];
        for(let s of dbResv.slot){
          let available = s.max - s.booked.length;
          let tmp = {
            start: s.start,
            duration: s.duration,
            available,
            slotId: s.slotId,
            myBooked: s.booked.some(b => b == teamId)
          }
          slot.push(tmp);
        }
        
        return res.status(200).send({
          deadline: dbResv.deadline,
          i18n: dbResv.i18n,
          languages: dbResv.languages,
          description: dbResv.description,
          slot
        });
      });
    }
  });
});

publicRouter.post('/book/:teamId/:token/:resvId', access.team(), function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const resvId = req.params.resvId;
  const slotId = req.body.slotId;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }

  competitiondb.team.findOne({
    "_id": teamId,
    "document.token": token
  })
  .exec(function (err, team) {
    if (err || team == null) {
      if (!err) err = { message: 'No team found' };
      return res.status(403).send({
        msg: 'No team found'
      });
    } else if (team) {
      reservationDb.reservation
      .findOne({
        _id: resvId,
        competition: team.competition,
        enable: true,
        deadline: {$gte: new Date()},
        $or: [
          {league: team.league},
          {team: teamId}
        ]
      })
      .exec(function (err, dbResv) {
        if (err || dbResv == null) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get resv',
            err: err,
          });
        }

        for(let s of dbResv.slot){
          if(s.booked.some(b => b == teamId)){
            return res.status(400).send({
              msg: 'It is not allowed to book more than one slot.'
            });
          }
        }

        let slotNum = dbResv.slot.findIndex(s => s.slotId == slotId);
        if(slotNum != -1){
          let s = dbResv.slot[slotNum];
          let available = s.max - s.booked.length;
          if(available > 0){
            s.booked.push(teamId);
            dbResv.save(function (err, data) {
              if (err) {
                logger.error(err);
                return res.status(500).send({
                  msg: err.message,
                });
              } else {
                if (socketIo !== undefined) {
                  socketIo.sockets.in(`reservation/${resvId}`).emit('update', {});
                }
                return res.status(200).send({
                  msg: 'Booked',
                  slotId: slotId
                });
              }
            });
          }else{
            return res.status(400).send({
              msg: "You're a little late! It seems that another team has already booked the slot... Please try to book another slot."
            });
          }
        }else{
          return res.status(400).send({
            msg: 'The slot you have specified is not available.'
          });
        }
      });
    }
  });
});

publicRouter.post('/cancel/:teamId/:token/:resvId', access.team(), function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const resvId = req.params.resvId;
  const slotId = req.body.slotId;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(resvId)) {
    return next();
  }
  if(!slotId){
    return res.status(400).send({
      msg: 'Please specify slotId'
    });
  }

  competitiondb.team.findOne({
    "_id": teamId,
    "document.token": token
  })
  .exec(function (err, team) {
    if (err || team == null) {
      if (!err) err = { message: 'No team found' };
      return res.status(403).send({
        msg: 'No team found'
      });
    } else if (team) {
      reservationDb.reservation
      .findOne({
        _id: resvId,
        competition: team.competition,
        enable: true,
        deadline: {$gte: new Date()},
        $or: [
          {league: team.league},
          {team: teamId}
        ]
      })
      .exec(function (err, dbResv) {
        if (err || dbResv == null) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get resv',
            err: err,
          });
        }

        let slotNum = dbResv.slot.findIndex(s => s.slotId == slotId);
        if(slotNum != -1){
          let s = dbResv.slot[slotNum];
          s.booked = s.booked.filter(b => b != teamId);
          dbResv.save(function (err, data) {
            if (err) {
              logger.error(err);
              return res.status(500).send({
                msg: err.message,
              });
            } else {
              if (socketIo !== undefined) {
                socketIo.sockets.in(`reservation/${resvId}`).emit('update', {});
              }
              return res.status(200).send({
                msg: 'Deleted',
                slotId: slotId
              });
            }
          });
        }else{
          return res.status(400).send({
            msg: 'The slot you have specified is not available.'
          });
        }
      });
    }
  });
});

publicRouter.post('/list/:competitionId', access.anyone('the bookings open to a league: their names and deadlines'), function (req, res, next) {
  const competitionId = req.params.competitionId;
  const teamId = req.body.team;
  const leagueId = req.body.league;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  reservationDb.reservation
    .find({
      competition: competitionId,
      enable: true,
      $or: [
        {league: leagueId},
        {team: teamId}
      ]
    })
    .select("_id deadline i18n languages")
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }
      
      return res.status(200).send(dbResv);
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
