// -*- tab-width: 2 -*-
const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const fs = require('fs');
const dateformat = require('dateformat');
const competitiondb = require('../models/competition');
const logger = require('../config/logger').mainLogger;
const { ObjectId } = require('mongoose').Types;
const auth = require('../helper/authLevels');
const { ACCESSLEVELS } = require('../models/user');
const { LEAGUES } = competitiondb;
const mailDb = require('../models/mail');
const surveyDb = require('../models/survey');


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
  const output = `[${dateformat(new Date(), 'mm/dd/yy HH:MM:ss')}] ${getIP(
    req
  )} : ${message}\n`;
  fs.appendFile(
    `${__dirname}/../documents/${competitionId}/${teamId}/log.txt`,
    output,
    (err) => {
      if (err) logger.error(err.message);
    }
  );
}

publicRouter.get('/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      "_id": teamId,
      "document.token": token
    })
    .select("_id competition league name teamCode document.enabled document.deadline")
    .exec(function (err, team) {
      if (err || team == null) {
        if (!err) err = { message: 'No team found' };
          res.render('access_denied', { user: req.user });
        } else if (team) {
          res.render('mypage/my', {
            team: team._id,
            competition: team.competition,
            user: req.user,
            league: team.league,
            teamName: team.name,
            teamCode: team.teamCode,
            token: token,
            documentEnable: team.document.enabled,
            documentDeadline: team.document.deadline
          });
      }
    });
});


publicRouter.get('/:teamId/:token/reservation/:resvId', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { resvId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  if (!ObjectId.isValid(resvId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      "_id": teamId,
      "document.token": token
    })
    .exec(function (err, team) {
      if (err || team == null) {
        if (!err) err = { message: 'No team found' };
          res.render('access_denied', { user: req.user });
        } else if (team) {
          res.render('reservation/form', {
            team: team._id,
            competition: team.competition,
            user: req.user,
            league: team.league,
            teamName: team.name,
            teamCode: team.teamCode,
            token: token,
            resvId
          });
      }
    });
});

publicRouter.get('/:teamId/:token/cabinet', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      "_id": teamId,
      "document.token": token
    })
    .exec(function (err, team) {
      if (err || team == null) {
        if (!err) err = { message: 'No team found' };
          res.render('access_denied', { user: req.user });
        } else if (team) {
          res.render('cabinet/file', { id: team.competition, user: req.user, isTeam: true , teamId, isMyPage: true, token, leagueTeam: teamId, teamName: team.name,teamCode: team.teamCode});
      }
    });
});

function renderSurveyForm(req, res, team, token, survId, editable){
  res.render('survey/form', {
    team: team._id,
    competition: team.competition,
    user: req.user,
    league: team.league,
    teamName: team.name,
    teamCode: team.teamCode,
    token: token,
    survId,
    editable
  });
}

publicRouter.get('/:teamId/:token/survey/:survId', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { survId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  if (!ObjectId.isValid(survId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      "_id": teamId,
      "document.token": token
    })
    .exec(function (err, team) {
      if (err || team == null) {
        if (!err) err = { message: 'No team found' };
          return res.render('access_denied', { user: req.user });
        } else if (team) {
          surveyDb.survey
          .findOne({
            _id: survId,
            competition: team.competition,
            enable: true,
            $or: [
              {league: team.league},
              {team: team._id}
            ]
          })
          .exec(function (err, survey) {
            if (err || survey == null) {
              if (!err) err = { message: 'No survey found' };
                return res.render('access_denied', { user: req.user });
            } else if (survey) {
              if(auth.authCompetition(req.user,team.competition,ACCESSLEVELS.ADMIN)){
                return renderSurveyForm(req, res, team, token, survey._id, true);
              }else{
                if(survey.deadline < new Date()){
                  return renderSurveyForm(req, res, team, token, survey._id, false);
                }
                if(survey.reEdit){
                  return renderSurveyForm(req, res, team, token, survey._id, true);  
                }
                surveyDb.surveyAnswer
                .findOne({
                  survey: survId,
                  team: team._id,
                  competition: team.competition
                })
                .exec(function (err, ans) {
                  if (ans == undefined || ans.fixed == false) {
                    return renderSurveyForm(req, res, team, token, survey._id, true);
                  }else{
                    return renderSurveyForm(req, res, team, token, survey._id, false);
                  }
                });
              }
            }
          });
          
      }
    });
});

publicRouter.all('*', function (req, res, next) {
  next();
});
privateRouter.get('/', function (req, res) {
  res.render('mypage/profile', { user: req.user });
});

privateRouter.all('*', function (req, res, next) {
  next();
});

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
