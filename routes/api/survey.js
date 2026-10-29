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
const surveyDb = require('../../models/survey');
const competitiondb = require('../../models/competition');
let fs = require('fs-extra');
const sanitize = require('sanitize-filename');
const gracefulFs = require('graceful-fs');
fs = gracefulFs.gracefulify(fs);
const multer = require('multer');
const path = require('path');
const mkdirp = require('mkdirp');
var crypto = require("crypto");

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


adminRouter.post('/edit/:competitionId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  let sdata = req.body;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }

  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  sdata.competition = competitionId;

  new surveyDb.survey(sdata).save(function (err, data) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Error saving in db',
        err: err.message,
      });
    }
    return res.status(201).send({
      id: data._id,
    });
  });
});

adminRouter.get('/list/:competitionId', function (req, res, next) {
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

  surveyDb.survey
    .find({
      competition: competitionId,
    })
    .exec(function (err, dbSurvey) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get survey',
          err: err.message,
        });
      }
      return res.status(200).send(dbSurvey);
    });
});

adminRouter.get('/edit/:competitionId/:surveyId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  const surveyId = req.params.surveyId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(surveyId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  surveyDb.survey
    .findOne({
      _id: surveyId,
      competition: competitionId,
    })
    .exec(function (err, dbSurvey) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }
      return res.status(200).send(dbSurvey);
    });
});

adminRouter.delete('/delete/:competitionId/:surveyId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  const surveyId = req.params.surveyId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(surveyId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  surveyDb.survey
    .deleteOne({
      _id: surveyId,
      competition: competitionId,
    })
    .exec(function (err, dbResv) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not delete survey',
          err: err.message,
        });
      }
      surveyDb.surveyAnswer
      .deleteMany({
        survey: surveyId,
        competition: competitionId,
      })
      .exec(function (err, dbResv) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not delete team survey',
            err: err.message,
          });
        }
        fs.rmdir(`${__dirname}/../../survey/${competitionId}/${surveyId}`, { recursive: true }, (err) => {
          if (err) {
            logger.error(err.message);
          }
        });
        return res.status(200).send({
          msg: "Deleted"
        });
      });
    });
});

adminRouter.put('/edit/:competitionId/:surveyId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  const surveyId = req.params.surveyId;
  let sData = req.body;
  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(surveyId)) {
    return next();
  }
  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  surveyDb.survey
    .findOne({
      _id: surveyId,
      competition: competitionId
    })
    .exec(function (err, dbSurvey) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get survey',
          err: err.message,
        });
      }

      sData.competition = competitionId;
      dbSurvey.i18n = sData.i18n;
      dbSurvey.languages = sData.languages;
      dbSurvey.deadline = sData.deadline;
      dbSurvey.open = sData.open;
      dbSurvey.enable = sData.enable;
      dbSurvey.league = sData.league;
      dbSurvey.team = sData.team;
      dbSurvey.reEdit = sData.reEdit;
      dbSurvey.questions = sData.questions;

      dbSurvey.save(function (err, data) {
        if (err) {
          logger.error(err);
          return res.status(500).send({
            msg: err.message,
          });
        } else {
          return res.status(200).send({
            msg: 'Saved',
          });
        }
      });
    });
});

publicRouter.get('/list/:competitionId/:leagueId/:teamId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  const leagueId = req.params.leagueId;
  const teamId = req.params.teamId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  surveyDb.survey
    .find({
      competition: competitionId,
      enable: true,
      open: {$lt: new Date()},
      $or: [
        {league: leagueId},
        {team: teamId}
      ]
    })
    .select("_id name i18n languages deadline open reEdit")
    .exec(function (err, dbSurvey) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get resv',
          err: err.message,
        });
      }

      surveyDb.surveyAnswer
      .find({
        competition: competitionId,
        team: teamId
      })
      .exec(function (err, dbAnswer) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get answer',
            err: err,
          });
        }

        let resData = [];
        if(dbAnswer != null){
          for(let surv of dbSurvey){
            resData.push({
              '_id': surv._id,
              'reEdit': surv.reEdit,
              'sent': dbAnswer.some(a => a.survey.toString() === surv._id.toString() && a.fixed),
              'deadline': surv.deadline,
              'open': surv.open,
              'i18n': surv.i18n,
              'languages': surv.languages
            });
          }
          return res.status(200).send(resData);
        }else{
          return res.status(200).send(dbSurvey);
        }
      });
    });
});

publicRouter.get('/question/:teamId/:token/:survId', function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const survId = req.params.survId;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(survId)) {
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
      surveyDb.survey
      .findOne({
        competition: team.competition,
        enable: true,
        open: {$lt: new Date()},
        $or: [
          {league: team.league},
          {team: team._id}
        ],
        _id: survId
      })
      .exec(function (err, dbServ) {
        if (err || dbServ == null) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get resv',
            err: err,
          });
        }

        delete dbServ.team;
        delete dbServ.league;
        
        return res.status(200).send(dbServ);
      });
    }
  });
});

publicRouter.get('/answer/:teamId/:token/:survId', function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const survId = req.params.survId;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(survId)) {
    return next();
  }

  competitiondb.team.findOne({
    "_id": teamId,
    "document.token": token
  })
  .exec(function (err, team) {
    if (err || team == null) {
      return res.status(400).send({
        msg: 'No team found'
      });
    } else if (team) {
      surveyDb.surveyAnswer
      .findOne({
        competition: team.competition,
        team: team._id,
        survey: survId
      })
      .exec(function (err, dbAnswer) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            msg: 'Could not get answer',
            err: err,
          });
        }
        
        if(dbAnswer){
          return res.status(200).send(dbAnswer.answer);
        }else{
          return res.status(200).send([]);
        }  
      });
    }
  });
});

publicRouter.put('/answer/:teamId/:token/:survId', function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const survId = req.params.survId;
  const ansData = req.body;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(survId)) {
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
      surveyDb.survey
      .findOne({
        _id: survId,
        competition: team.competition,
        enable: true,
        open: {$lt: new Date()},
        $or: [
          {league: team.league},
          {team: team._id}
        ]
      })
      .exec(function (err, survey) {
        if (err || survey == null) {
          return res.status(400).send({
            msg: 'Cloud not found survey master'
          });
        } else if (survey) {
          surveyDb.surveyAnswer
          .findOne({
            survey: survId,
            team: team._id,
            competition: team.competition
          })
          .exec(function (err, ans) {
            let errMes = '';
            let admin = false;
            if(auth.authCompetition(req.user,team.competition,ACCESSLEVELS.ADMIN)){
              admin = true;
            }else if(survey.deadline < new Date()){
              return res.status(400).send({
                msg: 'Deadline has already passed...'
              });
            }
            if(ans == null){//NEW
              new surveyDb.surveyAnswer({
                survey: survId,
                team: team._id,
                competition: team.competition,
                answer: ansData,
                fixed: true
              }).save(function (err, data) {
                if (err) {
                  logger.error(err);
                  return res.status(400).send({
                    msg: 'Error saving in db',
                    err: err.message,
                  });
                }
                return res.status(201).send({
                  id: data._id,
                });
              });
            }else{//UPDATE
              if(survey.reEdit || admin || ans.fixed == false){
                ans.answer = ansData;
                ans.fixed = true;
                ans.save(function (err, data) {
                  if (err) {
                    logger.error(err);
                    return res.status(400).send({
                      msg: 'Error saving in db',
                      err: err.message,
                    });
                  }
                  return res.status(201).send({
                    msg: 'Updated'
                  });
                });
              }else{
                return res.status(400).send({
                  msg: 'This survey form does not allow for more than one submission'
                });
              }
            }
          });
        }
      });
    }
  });
});

publicRouter.get('/teamList/:teamId/:token', function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team.findOne({
    "_id": teamId,
    "document.token": token
  })
  .exec(function (err, team) {
    if (err || team == null) {
      return res.status(400).send({
        msg: 'No team found'
      });
    } else if (team) {
      competitiondb.team
      .find(
        {
          competition: team.competition,
        },
        'name teamCode league'
      )
      .sort({teamCode: 1, name: 1 })
      .lean()
      .exec(function (err, data) {
        if (err) {
          logger.error(err);
          res.status(400).send({
            msg: 'Could not get teams',
            err: err.message,
          });
        } else {
          res.status(200).send(data);
        }
      });
    }
  });
});

adminRouter.delete('/answer/:competitionId/:answerId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  const answerId = req.params.answerId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(answerId)) {
    return next();
  }

  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }
  
  surveyDb.surveyAnswer
  .deleteOne({
    _id: answerId,
    competition: competitionId
  })
  .exec(function (err, dbAnswer) {
    if (err) {
      logger.error(err);
      return res.status(400).send({
        msg: 'Could not get answer',
        err: err,
      });
    }
    return res.status(200).send({
      msg: 'Deleted'
    });
  });
});

adminRouter.get('/answer/:competitionId/:survId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  const survId = req.params.survId;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  if (!ObjectId.isValid(survId)) {
    return next();
  }

  if(!auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){
    res.status(403).send({
      msg: 'Please check your permission.',
    });
    return;
  }

  surveyDb.survey
    .findOne({
      _id: survId,
      competition: competitionId
    })
    .exec(function (err, dbSurvey) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get survey',
          err: err.message,
        });
      }

      let questionTypes = {};
      dbSurvey.questions.map(question => {
        questionTypes[question.questionId] = question.type;
      })

      surveyDb.surveyAnswer
        .find({
          competition: competitionId,
          survey: dbSurvey._id
        })
        .populate({ 
          path: 'team',
          select: 'name teamCode league document.token'
        })
        .lean()
        .exec(function (err, dbAnswer) {
          if (err) {
            logger.error(err);
            return res.status(400).send({
              msg: 'Could not get answer',
              err: err,
            });
          }
          dbAnswer.map(team => {
            team.answer.map(ans => {
              if (questionTypes[ans.questionId] == 'file') {
                let path = `${__dirname}/../../survey/${team.competition}/${dbSurvey._id}/${team.team._id}/${ans.questionId}`;
                let hash = md5(path);
                if (hash == '') ans.answer = "";
                else ans.hash = hash;
              }
            })
          })
          return res.status(200).send({
            questions: dbSurvey,
            answers: dbAnswer
          });
        });
    });

  
});

function md5(filePath) {
  try {
    let b = fs.readFileSync(filePath);
    let md5hash = crypto.createHash('md5');
    md5hash.update(b);
    return md5hash.digest("base64");
  } catch (e) {
    return '';
  }
}

publicRouter.post('/answer/:teamId/:token/:survId/file/:questionId', function (req, res, next) {
  const { teamId, token, survId, questionId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(survId)) {
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
      surveyDb.survey
      .findOne({
        _id: survId,
        competition: team.competition,
        enable: true,
        open: {$lt: new Date()},
        $or: [
          {league: team.league},
          {team: team._id}
        ],
        "questions.questionId": questionId
      })
      .exec(function (err, survey) {
        if (err || survey == null) {
          return res.status(400).send({
            msg: 'Cloud not found survey master'
          });
        } else if (survey) {
          // check response can be updated
          let canUpdate = false;
          if(auth.authCompetition(req.user,team.competition,ACCESSLEVELS.ADMIN)){
            canUpdate = true;
          }else if(survey.deadline < new Date()){
            return res.status(400).send({
              msg: 'Deadline has already passed...'
            });
          }
          if (survey.reEdit){
            canUpdate = true;
          }

          surveyDb.surveyAnswer
            .findOne({
              competition: team.competition,
              team: team._id,
              survey: survId
            })
            .exec(function (err, dbAnswer) {
              if (err) {
                logger.error(err);
                return res.status(400).send({
                  msg: 'Could not get answer',
                  err: err,
                });
              }
              if (dbAnswer == undefined || dbAnswer.fixed == false) {
                canUpdate = true;
              }

              if (!canUpdate) {
                return res.status(400).send({
                  msg: 'Could not update answer',
                  err: err,
                });
              }

              const destination = `${__dirname}/../../survey/${team.competition}/${survey._id}/${team._id}`;
              if (!fs.existsSync(destination)) {
                mkdirp.sync(destination);
              }
              const storage = multer.diskStorage({
                destination(req, file, callback) {
                  callback(
                    null,
                    destination
                  );
                },
                filename(req, file, callback) {
                  callback(null, questionId);
                },
              });

              const upload = multer({
                storage,
              }).single('file');

              upload(req, res, function (err) {
                let fileName = `${questionId}${path.extname(req.file.originalname)}`;
                let questionAnswerForFile = {
                  questionId: questionId,
                  answer: fileName
                };
                let answer = null;

                if(dbAnswer){
                  answer = dbAnswer;
                  let index = answer.answer.findIndex(a => a.questionId == questionId);
                  if (index == -1) {
                    answer.answer.push(questionAnswerForFile)
                  } else {
                    answer.answer[index] = questionAnswerForFile;
                  }
                }else{
                  answer = new surveyDb.surveyAnswer({
                    survey: survId,
                    team: team._id,
                    competition: team.competition,
                    answer: [questionAnswerForFile],
                    fixed: false
                  })
                }

                answer.save(function (err, data) {
                  if (err) {
                    logger.error(err);
                    return res.status(400).send({
                      msg: 'Error saving in db',
                      err: err.message,
                    });
                  }
                  res.status(200).send({
                    msg: 'File is uploaded',
                    fileName: fileName
                  });
                });
              });
            });
        }
      });
    }
  });
});

const normalizeString = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

publicRouter.get('/answer/:teamId/:token/:survId/file/:questionId', function (req, res, next) {
  const { teamId, token, survId, questionId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }
  if (!ObjectId.isValid(survId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.token': token
    })
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam != null) {
        surveyDb.surveyAnswer
          .findOne({
            competition: dbTeam.competition,
            team: dbTeam._id,
            survey: survId
          })
          .exec(function (err, dbAnswer) {
            if (err) {
              logger.error(err);
              return res.status(400).send({
                msg: 'Could not get answer',
                err: err,
              });
            }

            let questionAnswer = dbAnswer.answer.find(a => a.questionId == questionId);
            if (questionAnswer) {
              let originalFileName = questionAnswer.answer;
              let path = `${__dirname}/../../survey/${dbTeam.competition}/${survId}/${dbTeam._id}/${sanitize(questionId)}`;
              fs.stat(path, (err, stat) => {
                // Handle file not found
                if (err !== null) {
                  if(err.code === 'ENOENT'){
                    return res.status(404).send({
                      msg: 'File not found',
                    });
                  }
                  return res.status(500).send({
                    msg: 'Cloud not get file',
                  });
                }
                
                const stream = fs.createReadStream(path)
                stream.on('error', (error) => {
                    res.statusCode = 500
                    res.end('Cloud not make stream')
                })
                let head = {
                  'Content-Disposition': `attachment; filename=${dbTeam.teamCode}-${normalizeString(dbTeam.name)}-${originalFileName}`
                }
                res.writeHead(200, head);
                stream.pipe(res);
              });
            } else {
              return res.status(500).send({
                msg: 'Could not get original file name'
              });
            }
        });
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
