// -*- tab-width: 2 -*-
const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const fs = require('fs');
const dateformat = require('dateformat');
const competitiondb = require('../models/competition');
const { LEAGUES_JSON } = competitiondb;
const logger = require('../config/logger').mainLogger;
const { ObjectId } = require('mongoose').Types;
const auth = require('../helper/authLevels');
const { ACCESSLEVELS } = require('../models/user');

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

function writeLog(req, competitionId, teamId, message) {
  let user = req.user;
  if (user == null) user = getIP(req);
  else user = user.username;
  const output = `[${dateformat(new Date(), 'mm/dd/yy HH:MM:ss')}] ${user} : ${message}\n`;
  fs.appendFile(
    `${__dirname}/../documents/${competitionId}/${teamId}/log.txt`,
    output,
    (err) => {
      if (err) logger.error(err.message);
    }
  );
}

function GetleagueType(leagueId){
  return LEAGUES_JSON.find(l=>l.id == leagueId).type;
}

privateRouter.get('/assigned/:competitionId', async function (req, res, next) {
  const { competitionId } = req.params;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  
  if (
    await auth.authCompetitionRole(req.user, competitionId, "INTERVIEW")
  ) {
    res.render('document/assigned', {
      competition: competitionId,
      user: req.user,
    });
  } else {
    res.render('access_denied', { user: req.user });
  }
});

privateRouter.get('/review/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .select('competition document.token')
    .exec(async function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
        ) {
          res.render('document/review', {
            competition: dbTeam.competition,
            team: teamId,
            user: req.user,
            token: dbTeam.document.token,
          });
        } else {
          res.render('access_denied', { user: req.user });
        }
      }
    });
});


privateRouter.get('/reviewed/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .select('competition document.token')
    .exec(async function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.VIEW) || await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
        ) {
          res.render('document/reviewed', {
            competition: dbTeam.competition,
            team: teamId,
            user: req.user,
            token: dbTeam.document.token,
            admin: auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.ADMIN)
          });
        } else {
          res.render('access_denied', { user: req.user });
        }
      }
    });
});

privateRouter.get('/inspection/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .select('competition')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.JUDGE)
        ) {
          res.render('inspection', {
            competition: dbTeam.competition,
            team: teamId,
            user: req.user,
          });
        } else {
          res.render('access_denied', { user: req.user });
        }
      }
    });
});

publicRouter.get('/public/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.public': true,
      'document.enabled': true,
    })
    .select('competition')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.render('access_denied', { user: req.user });
      } else if (dbTeam) {
        res.render('document/form', {
          public: true,
          editable: false,
          competition: dbTeam.competition,
          team: teamId,
          token: 'public',
          user: req.user,
        });
      }
    });
});

privateRouter.get('/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .populate('competition')
    .select('competition document.deadline document.token document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          if (dbTeam.competition.documents.enable && dbTeam.document.enabled) {
            const teamDeadline = dbTeam.document.deadline;
            let { deadline } = dbTeam.competition.documents;
            if (teamDeadline != null) deadline = teamDeadline;
            res.render('document/form', {
              deadline,
              editable: true,
              competition: dbTeam.competition._id,
              team: teamId,
              token: dbTeam.document.token,
              user: req.user,
            });
          } else {
            res.render('access_denied', { user: req.user });
          }
        } else {
          res.render('access_denied', { user: req.user });
        }
      }
    });
});

publicRouter.get('/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .populate('competition')
    .select('competition document.deadline document.token document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (dbTeam.document.token == token) {
          if (dbTeam.competition.documents.enable && dbTeam.document.enabled) {
            const teamDeadline = dbTeam.document.deadline;
            let { deadline } = dbTeam.competition.documents;
            if (teamDeadline != null) deadline = teamDeadline;

            const now = new Date();
            const timestamp = Math.floor(now.getTime() / 1000);

            res.render('document/form', {
              deadline,
              editable: deadline >= timestamp,
              competition: dbTeam.competition._id,
              team: teamId,
              token: dbTeam.document.token,
              user: req.user,
            });
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              'Accessed the document submission page.'
            );
          } else {
            res.render('access_denied', { user: req.user });
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              'Tried to access the document submission page, but they are not allowed to do so.'
            );
          }
        } else {
          res.render('access_denied', { user: req.user });
        }
      }
    });
});

privateRouter.get('/:competitionid/do/:teamid', function (req, res, next) {
  const id = req.params.competitionid;
  const tid = req.params.teamid;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  if (auth.authCompetition(req.user, id, ACCESSLEVELS.JUDGE))
    res.render('do_interview', { id, tid, user: req.user });
  else res.render('access_denied', { user: req.user });
});

adminRouter.get('/:competitionid/pub/:teamid', function (req, res, next) {
  const id = req.params.competitionid;
  const tid = req.params.teamid;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  if (auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN))
    res.render('pub_interview', { id, tid, user: req.user });
  else res.render('access_denied', { user: req.user });
});

publicRouter.get('/:competitionid/view/:teamid', function (req, res, next) {
  const id = req.params.competitionid;
  const tid = req.params.teamid;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  if (auth.authCompetition(req.user, id, ACCESSLEVELS.JUDGE))
    res.render('view_interview', {
      id,
      tid,
      user: req.user,
      judge: 1,
    });
  else
    res.render('view_interview', {
      id,
      tid,
      user: req.user,
      judge: 0,
    });
  // if(auth.authCompetition(req.user,id,ACCESSLEVELS.JUDGE)) res.render('view_interview', {id: id, tid: tid, user: req.user})
  // else res.render('access_denied', {user: req.user})
});

publicRouter.get('/embed_video', function (req, res, next) {
  res.render('document/embed_video', {
    video: req.query.video
  });
});

publicRouter.get('/public_files/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .populate({
      path: "competition",
      select: "publicToken documents"
    })
    //.select('competition.publicToken')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if(dbTeam.competition.publicToken === token){
          res.render('document/public_files', {
            competition: dbTeam.competition._id,
            team: teamId,
            token: token,
            league: dbTeam.league
          });
        }else{
          res.render('access_denied', { user: req.user });
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
