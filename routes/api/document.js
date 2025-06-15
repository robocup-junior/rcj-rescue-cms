//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const multer = require('multer');
const path = require('path');
const auth = require('../../helper/authLevels');
let fs = require('fs-extra');
const gracefulFs = require('graceful-fs');

fs = gracefulFs.gracefulify(fs);
const mime = require('mime');
const { ACCESSLEVELS } = require('../../models/user');
const glob = require('glob');
const ffmpeg = require('fluent-ffmpeg');

const competitiondb = require('../../models/competition');
const { LEAGUES_JSON } = competitiondb;
const {sendMail} = require('../../helper/mailSender');

const dateformat = require('dateformat');
let read = require('fs-readdir-recursive');
const logger = require('../../config/logger').mainLogger;
const documentDb = require('../../models/document');
const userdb = require('../../models/user');
const escape = require('escape-html');
const sanitize = require("sanitize-filename");
read = gracefulFs.gracefulify(read);

const S = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const N = 32;

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
    `${__dirname}/../../documents/${competitionId}/${teamId}/log.txt`,
    output,
    (err) => {
      if (err) logger.error(err.message);
    }
  );
}

function GetleagueType(leagueId){
  return LEAGUES_JSON.find(l=>l.id == leagueId).type;
}

publicRouter.get('/answer/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      $or: [{ 'document.token': token }, { 'document.public': true }],
    })
    .populate('competition')
    .select('competition document.answers document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          res.send(dbTeam.document.answers);
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.put('/answer/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const answer = req.body;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.token': token,
    })
    .populate('competition')
    .select('competition document.answers document.deadline document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        const userAuth = auth.authCompetition(
          req.user,
          dbTeam.competition._id,
          ACCESSLEVELS.JUDGE
        );
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          userAuth
        ) {
          const teamDeadline = dbTeam.document.deadline;
          let { deadline } = dbTeam.competition.documents;
          if (teamDeadline != null) deadline = teamDeadline;

          const now = new Date();
          const timestamp = Math.floor(now.getTime() / 1000);

          if (deadline >= timestamp || userAuth) {
            dbTeam.document.answers = answer;
            dbTeam.save(function (err) {
              if (err) {
                logger.error(err);
                writeLog(
                  req,
                  dbTeam.competition._id,
                  dbTeam._id,
                  `ERROR: ${err.message}`
                );
                return res.status(400).send({
                  err: err.message,
                  msg: 'Could not save changes',
                });
              }
              writeLog(
                req,
                dbTeam.competition._id,
                dbTeam._id,
                'Submissions have been updated'
              );
              return res.status(200).send({
                msg: 'Saved changes',
              });
            });
          } else {
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              'They  have attempted to update the submission, but it has expired the deadline.'
            );
            res.status(400).send({
              msg: 'The deadline has passed.',
            });
          }
        } else {
          writeLog(
            req,
            dbTeam.competition._id,
            dbTeam._id,
            'They have attempted to update the submission, but this operation is not allowed.'
          );
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.post('/files/:teamId/:token/:fileName', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.token': token,
    })
    .populate('competition')
    .select('competition document.deadline document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        const userAuth = auth.authCompetition(
          req.user,
          dbTeam.competition._id,
          ACCESSLEVELS.JUDGE
        );
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          userAuth
        ) {
          const teamDeadline = dbTeam.document.deadline;
          let { deadline } = dbTeam.competition.documents;
          if (teamDeadline != null) deadline = teamDeadline;

          const now = new Date();
          const timestamp = Math.floor(now.getTime() / 1000);

          if (deadline >= timestamp || userAuth) {
            glob.glob(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/${sanitize(fileName)}.*`,
              function (er, files) {
                let i = files.length;
                if (i == 0) {
                  upload_process();
                  return;
                }
                fs.mkdir(
                  `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/trash`,
                  (err) => {
                    files.forEach(function (file) {
                      fs.rename(
                        file,
                        `${path.dirname(file)}/trash/${
                          new Date().getTime() / 1000
                        }${path.extname(file)}`,
                        function (err) {
                          if (err) logger.error(err.message);
                          i--;
                          if (i <= 0) {
                            upload_process();
                          }
                        }
                      );
                    });
                  }
                );

                function upload_process() {
                  let originalname = '';
                  const storage = multer.diskStorage({
                    destination(req, file, callback) {
                      callback(
                        null,
                        `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}`
                      );
                    },
                    filename(req, file, callback) {
                      originalname = file.originalname;
                      callback(null, fileName + path.extname(originalname));
                    },
                  });

                  const upload = multer({
                    storage,
                  }).single('file');

                  upload(req, res, function (err) {
                    res.status(200).send({
                      msg: 'File is uploaded',
                    });
                    const ft = mime.getType(originalname);

                    if (ft.includes('video')) {
                      const filepath = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/${sanitize(fileName)}`;
                      fs.unlink(`${filepath}-thumbnail.png`, function (err) {
                        try {
                          const original = ffmpeg(
                            filepath + path.extname(originalname)
                          );

                          original
                            .screenshots({
                              count: 1,
                              folder: `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}`,
                              filename: `${sanitize(fileName)}-thumbnail.png`,
                              size: '640x?',
                            })
                            .on('error', function (err) {
                              logger.error(`an error happened: ${err.message}`);
                            });

                        } catch (err) {}
                      });
                    }
                    writeLog(
                      req,
                      dbTeam.competition._id,
                      dbTeam._id,
                      `File uploaded! File name: ${sanitize(fileName)}`
                    );
                  });
                }
              }
            );
          } else {
            res.status(400).send({
              msg: 'The deadline has passed.',
            });
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              `They have attempted to upload a file, but it has expired the deadline. File name: ${sanitize(fileName)}`
            );
          }
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
          writeLog(
            req,
            dbTeam.competition._id,
            dbTeam._id,
            `They have attempted to upload a file, but this operation is not allowed. File name: ${sanitize(fileName)}`
          );
        }
      }
    });
});

publicRouter.get('/files/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      $or: [{ 'document.token': token }, { 'document.public': true }],
    })
    .populate('competition')
    .select('competition document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}`;
          fs.readdir(path, { withFileTypes: true }, (err, dirents) => {
            if (err) {
              console.error(err);
              return;
            }

            const d = [];
            for (const dirent of dirents) {
              if (!dirent.isDirectory()) {
                d.push(escape(dirent.name));
              }
            }
            res.send(d);
          });
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.get('/files/:teamId/:token/:fileName', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .select('teamCode name country document.enabled document.token league')
    .populate({
      path: "competition",
      select: "publicToken documents"
    })
    .exec(function (err, dbTeam) {     
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        let league = dbTeam.competition.documents.leagues.find(l => l.league == dbTeam.league);
        let question = undefined;
        if (league) {
          for(b of league.blocks){
            question = b.questions.find(q => q.fileName!="" && ~fileName.indexOf(q.fileName));
            if(question) break;
          }
        }
        if(!question){
          question= {
            public: false
          };
        }
        if (((dbTeam.competition.documents.enable) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )) && (dbTeam.document.token === token || dbTeam.document.public || (question.public && token === dbTeam.competition.publicToken ))) {
          const dataPath = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/${sanitize(fileName)}`;
          fs.stat(dataPath, (err, stat) => {
            // Handle file not found
            if (err !== null && err.code === 'ENOENT') {
              res.status(404).send({
                msg: 'File not found',
              });
              return;
            }

            // Streaming Video
            const mimeType = mime.getType(dataPath);
            const parsedPath = path.parse(fileName);
            let respFileName = `${parsedPath.name}_${dbTeam.teamCode}_${dbTeam.name}_${dbTeam.country}${parsedPath.ext}`;
            if (!dbTeam.country) {
              respFileName = `${parsedPath.name}_${dbTeam.teamCode}_${dbTeam.name}${parsedPath.ext}`;
            }
            
            if (mimeType != null && mimeType.includes('video')) {
              try {
                const fileSize = stat.size;
                const { range } = req.headers;

                if (range) {
                  const parts = range.replace(/bytes=/, '').split('-');

                  const start = parseInt(parts[0], 10);
                  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                  const chunksize = end - start + 1;
                  const file = fs.createReadStream(dataPath, { start, end });
                  file.on('error', function (err) {
                    logger.error(err.message);
                  });
                  const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                  };

                  res.writeHead(206, head);
                  file.pipe(res);
                  return;
                }
                const head = {
                  'Content-Length': fileSize,
                  'Content-Type': mimeType,
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(respFileName)}"`
                };

                res.writeHead(200, head);
                fs.createReadStream(dataPath).pipe(res);
                return;
              } catch (err) {
                logger.error(err.message);
              }
            } else {
              const stream = fs.createReadStream(dataPath)
              stream.on('error', (error) => {
                  res.statusCode = 500
                  res.end('Cloud not make stream')
              })
              let head = {}
              if(mimeType != null) {
                head['Content-Type'] = mimeType;
                head['Content-Disposition'] = `attachment; filename="${encodeURIComponent(respFileName)}"`;
              }
              res.writeHead(200, head);
              stream.pipe(res);
            }
          });
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.post('/files/usercontent/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.token': token,
    })
    .populate('competition')
    .select('competition document.deadline document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        const userAuth = auth.authCompetition(
          req.user,
          dbTeam.competition._id,
          ACCESSLEVELS.JUDGE
        );
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          userAuth
        ) {
          const teamDeadline = dbTeam.document.deadline;
          let { deadline } = dbTeam.competition.documents;
          if (teamDeadline != null) deadline = teamDeadline;

          const now = new Date();
          const timestamp = Math.floor(now.getTime() / 1000);

          if (deadline >= timestamp || userAuth) {
            fs.mkdirs(`${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/usercontent`, (err) => {
              let fileName = new Date().getTime();
              const storage = multer.diskStorage({
                destination(req, file, callback) {
                  callback(
                    null,
                    `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/usercontent`
                  );
                },
                filename(req, file, callback) {
                  callback(null, fileName + path.extname(file.originalname));
                },
              });

              const upload = multer({
                storage,
              }).single('image');

              upload(req, res, function (err) {
                res.status(200).send({
                  msg: 'Image is uploaded',
                  fileName: req.file.filename,
                  url: `/api/document/files/usercontent/${teamId}/${token}/${req.file.filename}`
                });

                writeLog(
                  req,
                  dbTeam.competition._id,
                  dbTeam._id,
                  `File uploaded! File name: ${fileName} (UserContent)`
                );
              });
            });
          } else {
            res.status(400).send({
              msg: 'The deadline has passed.',
            });
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              `They have attempted to upload a file, but it has expired the deadline. File name: ${sanitize(fileName)}`
            );
          }
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
          writeLog(
            req,
            dbTeam.competition._id,
            dbTeam._id,
            `They have attempted to upload a file, but this operation is not allowed. File name: ${sanitize(fileName)}`
          );
        }
      }
    });
});

publicRouter.get('/files/usercontent/:teamId/:token/:fileName', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      $or: [{ 'document.token': token }, { 'document.public': true }],
    })
    .populate('competition')
    .select('competition document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/usercontent/${sanitize(fileName)}`;
          fs.stat(path, (err, stat) => {
            // Handle file not found
            if (err !== null && err.code === 'ENOENT') {
              res.status(404).send({
                msg: 'File not found',
              });
              return;
            }
            
            const stream = fs.createReadStream(path)
            stream.on('error', (error) => {
                res.statusCode = 500
                res.end('Cloud not make stream')
            })
            let mimeType = mime.getType(path);
            let head = {}
            if(mimeType != null) {
              head['Content-Type'] = mimeType;
            }
            res.writeHead(200, head);
            stream.pipe(res);
          });
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

/// / for reviwer & admin

privateRouter.get('/review/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team.findById(teamId).exec(async function (err, dbTeam) {
    if (err) {
      if (!err) err = { message: 'No team found' };
      res.status(400).send({
        msg: 'Could not get team',
        err: err.message,
      });
    } else if (dbTeam) {
      if (
        auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.VIEW) || await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
      ) {
        documentDb.review
          .find({
            team: teamId,
          })
          .populate('reviewer', 'username')
          .populate('team', 'competition')
          .exec(function (err, dbReview) {
            if (err) {
              if (!err) err = { message: 'No review found' };
              res.status(400).send({
                msg: 'Could not get review',
                err: err.message,
              });
            } else if (dbReview) {
              res.send(dbReview);
            }
          });
      } else {
        res.status(401).send({
          msg: 'Operation not permited',
        });
      }
    } else {
      res.status(400).send({
        msg: 'Could not get team',
        err: 'No team found',
      });
    }
  });
});

privateRouter.get('/review/:teamId/myComments', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team.findById(teamId).exec(async function (err, dbTeam) {
    if (err) {
      if (!err) err = { message: 'No team found' };
      res.status(404).send({
        msg: 'Could not get team',
        err: err.message,
      });
    } else if (dbTeam) {
      if (
        auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.VIEW) || await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
      ) {
        documentDb.review
          .findOne({
            team: teamId,
            reviewer: req.user._id
          })
          .populate('reviewer', 'username')
          .populate('team', 'competition')
          .exec(function (err, dbReview) {
            if (dbReview) {
              res.send(dbReview);
            } else {
              res.status(404).send({
                msg: 'Could not get review'
              });
            }
          });
      } else {
        res.status(401).send({
          msg: 'Operation not permited',
        });
      }
    } else {
      res.status(400).send({
        msg: 'Could not get team',
        err: 'No team found',
      });
    }
  });
});

adminRouter.delete('/review/:reviewId/:questionId', function (req, res, next) {
  const { reviewId, questionId } = req.params;

  if (!ObjectId.isValid(reviewId)) {
    return next();
  }

  documentDb.review
    .findOne({ _id: reviewId})
    .exec(function (err, dbReview) {
      if (err) {
        if (!err) err = { message: 'No review found' };
        res.status(400).send({
          msg: 'Could not get review',
          err: err.message,
        });
      } else if (dbReview) {
        if(auth.authCompetition(req.user, dbReview.competition, ACCESSLEVELS.ADMIN)){
          dbReview.comments.delete(questionId);
          dbReview.markModified('comments');
          dbReview.save(function(err) {
            if(err){
              res.status(400).send({
                msg: 'Delete error',
                err: err.message,
              });
            }else{
              res.status(200).send({
                msg: 'Deleted',
              });
            }
          })
        }else{
          res.status(400).send({
            msg: 'Competition auth error :('
          });
        }
      }
    });
});

adminRouter.delete('/review/:reviewId', function (req, res, next) {
  const { reviewId } = req.params;

  if (!ObjectId.isValid(reviewId)) {
    return next();
  }

  documentDb.review
    .findOne({ _id: reviewId})
    .exec(function (err, dbReview) {
      if (err) {
        if (!err) err = { message: 'No review found' };
        res.status(400).send({
          msg: 'Could not get review',
          err: err.message,
        });
      } else if (dbReview) {
        if(auth.authCompetition(req.user, dbReview.competition, ACCESSLEVELS.ADMIN)){
          documentDb.review.deleteOne({ '_id': reviewId }, (err) => {
            if(err){
              res.status(400).send({
                msg: 'Delete error',
                err: err.message,
              });
            }else{
              res.status(200).send({
                msg: 'Deleted',
              });
            }
          });
        }else{
          res.status(400).send({
            msg: 'Competition auth error :('
          });
        }
      }
    });
});

adminRouter.get('/reviews/:competition', function (req, res, next) {
  const { competition } = req.params;

  if (!ObjectId.isValid(competition)) {
    return next();
  }

  if (auth.authCompetition(req.user, competition, ACCESSLEVELS.ADMIN)) {
    documentDb.review
      .find({
        competition,
        team: { $ne: null }
      })
      .populate('reviewer', 'username')
      .populate('team', 'teamCode name league country document.penalty')
      .exec(function (err, dbReview) {
        if (err) {
          if (!err) err = { message: 'No review found' };
          res.status(400).send({
            msg: 'Could not get review',
            err: err.message,
          });
        } else if (dbReview) {
          res.send(dbReview);
        }
      });
  } else {
    res.status(401).send({
      msg: 'Operation not permited',
    });
  }
});

privateRouter.put('/review/:teamId', function (req, res, next) {
  const { teamId } = req.params;
  const comments = req.body;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team.findById(teamId).exec(async function (err, dbTeam) {
    if (err) {
      if (!err) err = { message: 'No team found' };
      res.status(400).send({
        msg: 'Could not get team',
        err: err.message,
      });
    } else if (dbTeam) {
      if (
        await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
      ) {
        documentDb.review
          .findOne({
            team: teamId,
            reviewer: req.user._id,
          })
          .exec(function (err, dbReview) {
            if (err) {
              if (!err) err = { message: 'No team found' };
              res.status(400).send({
                msg: 'Could not get team',
                err: err.message,
              });
            } else if (dbReview) {
              dbReview.comments = comments;
              dbReview.name = req.user.username;
              dbReview.save(function (err) {
                if (err) {
                  logger.error(err);
                  return res.status(400).send({
                    err: err.message,
                    msg: 'Could not save changes',
                  });
                }
                writeLog(
                  req,
                  dbTeam.competition,
                  dbTeam._id,
                  `Reviewer: ${req.user.username}'s comment has been updated`
                );
                return res.status(200).send({
                  msg: 'Saved changes',
                });
              });
            } else {
              const newReview = new documentDb.review({
                team: teamId,
                competition: dbTeam.competition,
                reviewer: req.user._id,
                name: req.user.username,
                comments,
              });

              newReview.save(function (err, data) {
                if (err) {
                  logger.error(err);
                  res.status(500).send({
                    msg: err.message,
                  });
                } else {
                  writeLog(
                    req,
                    dbTeam.competition,
                    dbTeam._id,
                    `Reviewer: ${req.user.username}'s comment has been created`
                  );
                  return res.status(200).send({
                    msg: 'Saved changes',
                  });
                }
              });
            }
          });
      } else {
        res.status(401).send({
          msg: 'Operation not permited',
        });
      }
    } else {
      res.status(400).send({
        msg: 'Could not get team',
        err: 'No team found',
      });
    }
  });
});



privateRouter.post(
  '/review/files/:teamId/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(async function (err, dbTeam) {
        if (err || dbTeam == null) {
          if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (dbTeam) {
          const userAuth = await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
          if (userAuth) {
            fs.mkdirs(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}`,
              (err) => {
                glob.glob(
                  `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}/${sanitize(fileName)}.*`,
                  function (er, files) {
                    let i = files.length;
                    if (i == 0) {
                      upload_process();
                      return;
                    }
                    fs.mkdir(
                      `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/trash`,
                      (err) => {
                        files.forEach(function (file) {
                          fs.rename(
                            file,
                            `${path.dirname(file)}/../../trash/${
                              new Date().getTime() / 1000
                            }${path.extname(file)}`,
                            function (err) {
                              if (err) logger.error(err.message);
                              i--;
                              if (i <= 0) {
                                upload_process();
                              }
                            }
                          );
                        });
                      }
                    );

                    function upload_process() {
                      let originalname = '';
                      const storage = multer.diskStorage({
                        destination(req, file, callback) {
                          callback(
                            null,
                            `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}`
                          );
                        },
                        filename(req, file, callback) {
                          originalname = file.originalname;
                          callback(null, fileName + path.extname(originalname));
                        },
                      });

                      const upload = multer({
                        storage,
                      }).single('file');

                      upload(req, res, function (err) {
                        res.status(200).send({
                          msg: 'File is uploaded',
                        });
                        const ft = mime.getType(originalname);

                        if (ft != null && ft.includes('video')) {
                          const filepath = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}/${sanitize(fileName)}`;
                          fs.unlink(
                            `${filepath}-thumbnail.png`,
                            function (err) {
                              try {
                                const original = ffmpeg(
                                  filepath + path.extname(originalname)
                                );

                                original
                                  .screenshots({
                                    count: 1,
                                    folder: `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}`,
                                    filename: `${sanitize(fileName)}-thumbnail.png`,
                                    size: '640x?',
                                  })
                                  .on('error', function (err) {
                                    logger.error(
                                      `an error happened: ${err.message}`
                                    );
                                  });

                                
                              } catch (err) {}
                            }
                          );
                        }
                        writeLog(
                          req,
                          dbTeam.competition._id,
                          dbTeam._id,
                          `Reviewer: ${req.user.username}  File uploaded! File name: ${sanitize(fileName)}`
                        );
                      });
                    }
                  }
                );
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

privateRouter.get('/review/files/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .select('competition')
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
          const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review`;

          const files = read(path);
          for (let i = 0; i < files.length; i++) {
            files[i] = files[i].replace('\\', '/');
          }
          res.send(files);
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

privateRouter.get(
  '/review/files/:teamId/:userName/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { userName } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(async function (err, dbTeam) {
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
              dbTeam.competition,
              ACCESSLEVELS.VIEW
            ) || await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
          ) {
            const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${userName}/${sanitize(fileName)}`;
            fs.stat(path, (err, stat) => {
              // Handle file not found
              if (err !== null && err.code === 'ENOENT') {
                res.status(404).send({
                  msg: 'File not found',
                });
                return;
              }

              // Streaming Video
              let mimeType = mime.getType(path);
              if (mimeType != null && mimeType.includes('video')) {
                try {
                  const fileSize = stat.size;
                  const { range } = req.headers;

                  if (range) {
                    const parts = range.replace(/bytes=/, '').split('-');

                    const start = parseInt(parts[0], 10);
                    const end = parts[1]
                      ? parseInt(parts[1], 10)
                      : fileSize - 1;

                    const chunksize = end - start + 1;
                    const file = fs.createReadStream(path, { start, end });
                    file.on('error', function (err) {
                      logger.error(err.message);
                    });
                    const head = {
                      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                      'Accept-Ranges': 'bytes',
                      'Content-Length': chunksize,
                      'Content-Type': mimeType,
                    };

                    res.writeHead(206, head);
                    file.pipe(res);
                    return;
                  }
                  const head = {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                  };

                  res.writeHead(200, head);
                  fs.createReadStream(path).pipe(res);
                  return;
                } catch (err) {
                  logger.error(err.message);
                }
              } else {
                const stream = fs.createReadStream(path)
                stream.on('error', (error) => {
                    res.statusCode = 500
                    res.end('Cloud not make stream')
                })
                let head = {}
                if(mimeType != null) {
                  head['Content-Type'] = mimeType;
                }
                res.writeHead(200, head);
                stream.pipe(res);
              }
            });
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

privateRouter.post(
  '/review/files/usercontent/:teamId',
  function (req, res, next) {
    const { teamId } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(async function (err, dbTeam) {
        if (err || dbTeam == null) {
          if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (dbTeam) {
          const userAuth =  await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
          if (userAuth) {
            fs.mkdirs(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}/usercontent`,
              (err) => {
                let fileName = new Date().getTime();
                const storage = multer.diskStorage({
                  destination(req, file, callback) {
                    callback(
                      null,
                      `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}/usercontent`
                    );
                  },
                  filename(req, file, callback) {
                    callback(null, fileName + path.extname(file.originalname));
                  },
                });

                const upload = multer({
                  storage,
                }).single('image');

                upload(req, res, function (err) {
                  res.status(200).send({
                    msg: 'Image is uploaded',
                    fileName: req.file.filename,
                    url: `/api/document/review/files/usercontent/${teamId}/${req.user.username}/${req.file.filename}`
                  });

                  writeLog(
                    req,
                    dbTeam.competition._id,
                    dbTeam._id,
                    `File uploaded! File name: ${fileName} (ReviewUserContent)`
                  );
                });
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

privateRouter.get(
  '/review/files/usercontent/:teamId/:userName/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { userName } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(async function (err, dbTeam) {
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
              dbTeam.competition,
              ACCESSLEVELS.VIEW
            ) || await auth.authCompetitionRole(req.user, dbTeam.competition, "INTERVIEW")
          ) {
            const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${userName}/usercontent/${sanitize(fileName)}`;
            fs.stat(path, (err, stat) => {
              // Handle file not found
              if (err !== null && err.code === 'ENOENT') {
                res.status(404).send({
                  msg: 'File not found',
                });
                return;
              }

              const stream = fs.createReadStream(path)
              stream.on('error', (error) => {
                  res.statusCode = 500
                  res.end('Cloud not make stream')
              })
              let mimeType = mime.getType(path);
              let head = {}
              if(mimeType != null) {
                head['Content-Type'] = mimeType;
              }
              res.writeHead(200, head);
              stream.pipe(res);
            });
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

// Inspection
privateRouter.post(
  '/inspection/files/:teamId/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { fileName } = req.params;

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
          const userAuth = auth.authCompetition(
            req.user,
            dbTeam.competition,
            ACCESSLEVELS.JUDGE
          );
          if (userAuth) {
            fs.mkdirs(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection`,
              (err) => {
                glob.glob(
                  `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection/${sanitize(fileName)}.*`,
                  function (er, files) {
                    let i = files.length;
                    if (i == 0) {
                      upload_process();
                      return;
                    }
                    fs.mkdir(
                      `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/trash`,
                      (err) => {
                        files.forEach(function (file) {
                          fs.rename(
                            file,
                            `${path.dirname(file)}/../../trash/${
                              new Date().getTime() / 1000
                            }${path.extname(file)}`,
                            function (err) {
                              if (err) logger.error(err.message);
                              i--;
                              if (i <= 0) {
                                upload_process();
                              }
                            }
                          );
                        });
                      }
                    );

                    function upload_process() {
                      let originalname = '';
                      const storage = multer.diskStorage({
                        destination(req, file, callback) {
                          callback(
                            null,
                            `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection`
                          );
                        },
                        filename(req, file, callback) {
                          originalname = file.originalname;
                          callback(null, fileName + path.extname(originalname));
                        },
                      });

                      const upload = multer({
                        storage,
                      }).single('file');

                      upload(req, res, function (err) {
                        res.status(200).send({
                          msg: 'File is uploaded',
                        });
                      });
                    }
                  }
                );
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

privateRouter.get(
  '/inspection/files/:teamId/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { fileName } = req.params;

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
            auth.authCompetition(
              req.user,
              dbTeam.competition,
              ACCESSLEVELS.JUDGE
            )
          ) {
            glob.glob(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection/${sanitize(fileName)}.*`,
              function (er, files) {
                const i = files.length;
                if (i == 1) {
                  const stream = fs.createReadStream(files[0])
                  stream.on('error', (error) => {
                      res.statusCode = 500
                      res.end('Cloud not make stream')
                  })
                  let mimeType = mime.getType(files[0]);
                  let head = {}
                  if(mimeType != null) {
                    head['Content-Type'] = mimeType;
                  }
                  res.writeHead(200, head);
                  stream.pipe(res);
                } else {
                  // Handle file not found
                  const path = `${__dirname}/../../public/images/NoImage.png`;
                  const stream = fs.createReadStream(path)
                  stream.on('error', (error) => {
                      res.statusCode = 500
                      res.end('Cloud not make stream')
                  })
                  let mimeType = mime.getType(path);
                  let head = {}
                  if(mimeType != null) {
                    head['Content-Type'] = mimeType;
                  }
                  res.writeHead(200, head);
                  stream.pipe(res);
                }
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

// Templates
adminRouter.get('/templates/documentForm', function (req, res, next) {
  const dir_path = `${__dirname}/../../templates/documentForm/`;
  fs.readdir(dir_path, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error(err);
      return;
    }

    const d = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory() && path.extname(dirent.name).toLowerCase() === '.json') {
        const tmp = {
          name: escape(path.basename(dirent.name, '.json')),
          path: escape(dirent.name),
        };
        d.push(tmp);
      }
    }
    res.send(d);
  });
});

adminRouter.get('/templates/documentForm/:fileName', function (req, res, next) {
  const { fileName } = req.params;

  const dir_path = `${__dirname}/../../templates/documentForm/${sanitize(fileName)}`;
  fs.stat(dir_path, (err, stat) => {
    // Handle file not found
    if (err !== null && err.code === 'ENOENT') {
      res.status(404).send({
        msg: 'File not found',
      });
      return;
    }

    const stream = fs.createReadStream(dir_path)
      stream.on('error', (error) => {
          res.statusCode = 500
          res.end('Cloud not make stream')
      })
      let mimeType = mime.getType(dir_path);
      let head = {}
      if(mimeType != null) {
        head['Content-Type'] = mimeType;
      }
      res.writeHead(200, head);
      stream.pipe(res);
  });
});

adminRouter.get('/templates/reviewForm', function (req, res, next) {
  const dir_path = `${__dirname}/../../templates/reviewForm/`;
  fs.readdir(dir_path, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error(err);
      return;
    }

    const d = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory() && path.extname(dirent.name).toLowerCase() === '.json') {
        const tmp = {
          name: escape(path.basename(dirent.name, '.json')),
          path: escape(dirent.name),
        };
        d.push(tmp);
      }
    }
    res.send(d);
  });
});

adminRouter.get('/templates/reviewForm/:fileName', function (req, res, next) {
  const { fileName } = req.params;

  const dir_path = `${__dirname}/../../templates/reviewForm/${sanitize(fileName)}`;
  fs.stat(dir_path, (err, stat) => {
    // Handle file not found
    if (err !== null && err.code === 'ENOENT') {
      res.status(404).send({
        msg: 'File not found',
      });
      return;
    }

    const stream = fs.createReadStream(dir_path)
      stream.on('error', (error) => {
          res.statusCode = 500
          res.end('Cloud not make stream')
      })
      let mimeType = mime.getType(dir_path);
      let head = {}
      if(mimeType != null) {
        head['Content-Type'] = mimeType;
      }
      res.writeHead(200, head);
      stream.pipe(res);
  });
});

privateRouter.get('/map/:fileName',
  function (req, res, next) {
    const { fileName } = req.params;

    glob.glob(
      `${__dirname}/../../tmp/course/${sanitize(fileName)}.*`,
      function (er, files) {
        const i = files.length;
        if (i == 1) {
          const stream = fs.createReadStream(files[0])
          stream.on('error', (error) => {
              res.statusCode = 500
              res.end('Cloud not make stream')
          })
          let mimeType = mime.getType(files[0]);
          let head = {}
          if(mimeType != null) {
            head['Content-Type'] = mimeType;
          }
          res.writeHead(200, head);
          stream.pipe(res);
        } else {
          // Handle file not found
          const path = `${__dirname}/../../public/images/NoImage.png`;
          const stream = fs.createReadStream(path)
          stream.on('error', (error) => {
              res.statusCode = 500
              res.end('Cloud not make stream')
          })
          let mimeType = mime.getType(path);
          let head = {}
          if(mimeType != null) {
            head['Content-Type'] = mimeType;
          }
          res.writeHead(200, head);
          stream.pipe(res);
        }
      }
    );
  }
);

async function extractReviewAssignInfo(data, teamData, userId) {
  let assignResult = {};
  for (let league of data.documents.leagues) {
    let teamsTmp = {};
    let leagueId = league.league;
    let review = league.review;
    let teamDataLeague = teamData.filter((t) => t.league == leagueId);
    if (!review) continue;
    for (let r of review) {
      let totalScaleQuestionNum = r.questions.filter((q) => q.type == 'scale' && q.required).length;
      let questionIds = r.questions.filter((q) => q.type == 'scale' && q.required).map((q) => q._id);
      let assignedReviewers = r.assignedReviewers;
      if (!assignedReviewers) continue;
      if (assignedReviewers.length == 0) {
        for (let td of teamDataLeague) {
          if (teamsTmp[td._id] == undefined) {
            teamsTmp[td._id] = {
              _id: td._id,
              league: td.league,
              name: td.name,
              code: td.teamCode,
              region: td.country,
              assienedQuestionsNum: totalScaleQuestionNum,
              answeredQuestionsNum: 0,
              assignedQuestionIds: questionIds
            }
          } else {
            teamsTmp[td._id].assienedQuestionsNum += totalScaleQuestionNum;
            teamsTmp[td._id].assignedQuestionIds = teamsTmp[td._id].assignedQuestionIds.concat(questionIds);
          }
        }
      } else {
        let reviwerInfo = assignedReviewers.find((a) => a.reviewerId.equals(userId));
        if (reviwerInfo) {
          let teams = reviwerInfo.teamIds;
          if (teams.length == 0) {
            for (let td of teamDataLeague) {
              if (teamsTmp[td._id] == undefined) {
                teamsTmp[td._id] = {
                  _id: td._id,
                  league: td.league,
                  name: td.name,
                  code: td.teamCode,
                  region: td.country,
                  assienedQuestionsNum: totalScaleQuestionNum,
                  answeredQuestionsNum: 0,
                  assignedQuestionIds: questionIds
                }
              } else {
                teamsTmp[td._id].assienedQuestionsNum += totalScaleQuestionNum;
                teamsTmp[td._id].assignedQuestionIds = teamsTmp[td._id].assignedQuestionIds.concat(questionIds);
              }
            }
          } else {
            for (let t of teams) {
              let td = teamDataLeague.find((tt) => tt._id.equals(t));
              if (teamsTmp[t] == undefined) {
                teamsTmp[td._id] = {
                  _id: td._id,
                  league: td.league,
                  name: td.name,
                  code: td.teamCode,
                  region: td.country,
                  assienedQuestionsNum: totalScaleQuestionNum,
                  answeredQuestionsNum: 0,
                  assignedQuestionIds: questionIds
                }
              } else {
                teamsTmp[td._id].assienedQuestionsNum += totalScaleQuestionNum;
                teamsTmp[td._id].assignedQuestionIds = teamsTmp[td._id].assignedQuestionIds.concat(questionIds);
              }
            }
          }
        }
      }
    }
    
    let res = Object.values(teamsTmp);
    let reviewResults = await documentDb.review.find({
      competition: data._id,
      reviewer: userId
    }).lean().exec();
    for (let ar of res) {
      let teamReviewResult = reviewResults.find((rr) => rr.team.equals(ar._id));
      if (teamReviewResult == undefined) {
        delete(ar.assignedQuestionIds);
        continue;
      }
      let answeredQuestionsNum = 0;
      for (let aqid of ar.assignedQuestionIds) {
        let score = teamReviewResult.comments[aqid];
        if (score == undefined || score == '') continue;
        answeredQuestionsNum ++;
      }
      ar.answeredQuestionsNum = answeredQuestionsNum;
      delete(ar.assignedQuestionIds);
    }
    assignResult[leagueId] = res;
  }
  return assignResult;
}

privateRouter.get('/:competitionId/assigned', async function (req, res, next) {
  const { competitionId } = req.params;
  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  
  if (await auth.authCompetitionRole(req.user, competitionId, "INTERVIEW")) {
    competitiondb.team
      .find({
        competition: competitionId
      })
      .select('name teamCode league country')
      .lean()
      .exec(function (err, teamData) {
        if (err || !teamData) {
          logger.error(err);
          res.status(400).send({
            msg: 'Could not get teams',
          });
        } else {
          competitiondb.competition
            .findById(competitionId)
            .select('name documents')
            .lean()
            .exec(async function (err, data) {
              if (err || !data) {
                logger.error(err);
                res.status(400).send({
                  msg: 'Could not get competition',
                });
              } else {
                let assignResult = await extractReviewAssignInfo(data, teamData, req.user._id);
                res.status(200).send({
                  competitonName: data.name,
                  assignedTeams: assignResult
                });
              }
            });
        }
      });
    
  } else {
    res.status(403).send({
      msg: 'Operation not permited',
    });
  }
});

adminRouter.get('/:competitionId/reviewStatus', async function (req, res, next) {
  const { competitionId } = req.params;
  const { sendReminder } = req.query;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  
  if (auth.authCompetition(
    req.user,
    competitionId,
    ACCESSLEVELS.ADMIN
  )) {
    userdb.user
      .find({})
      .select('_id username competitions email')
      .lean()
      .exec(function (err, data) {
        if (err) {
          logger.error(err);
          res.status(400).send({
            msg: 'Could not get users',
            err: err.message,
          });
        } else {
          let userList = [];
          for (let u of data) {
            let comp = u.competitions.find((c) => c.id.equals(competitionId));
            if (comp != undefined) {
              if (comp.role.includes("INTERVIEW")) {
                userList.push({
                  userId: u._id,
                  userName: u.username,
                  email: u.email
                });
              }
            }
          }
          competitiondb.team
            .find({
              competition: competitionId
            })
            .select('name teamCode league country')
            .lean()
            .exec(function (err, teamData) {
              if (err || !teamData) {
                logger.error(err);
                res.status(400).send({
                  msg: 'Could not get teams',
                });
              } else {
                competitiondb.competition
                  .findById(competitionId)
                  .select('name documents')
                  .lean()
                  .exec(async function (err, data) {
                    if (err || !data) {
                      logger.error(err);
                      res.status(400).send({
                        msg: 'Could not get competition',
                      });
                    } else {
                      let reviewStatus = [];
                      for (let user of userList) {
                        let assignResult = await extractReviewAssignInfo(data, teamData, user.userId);
                        reviewStatus.push({
                          userId: user.userId,
                          userName: user.userName,
                          assignedTeams: assignResult
                        })
                        if (sendReminder && user.email && Object.values(assignResult).flat().some(a => a.assienedQuestionsNum != a.answeredQuestionsNum)) {
                          let pendingList = "";
                          let completedList = "";
                          for (let team of Object.values(assignResult).flat()) {
                            let txt = `<li>[${team.league}] ${team.code} ${team.name} &nbsp;&nbsp;&nbsp;----- Review Progress: ${team.answeredQuestionsNum}/${team.assienedQuestionsNum}</li>`;
                            if (team.assienedQuestionsNum != team.answeredQuestionsNum) {
                              pendingList += txt;
                            } else {
                              completedList += txt;
                            }
                          }
                          const variables = {
                            userName: user.userName,
                            competitionName: data.name,
                            evaluationHome: `${process.env.CMS_PROTOCOL}://${process.env.CMS_HOSTNAME}/document/assigned/${competitionId}`,
                            pendingList: `<ul>${pendingList}</ul>`,
                            completedList: `<ul>${completedList}</ul>`
                          };
                          const subject = "Document Evaluation Reminder & Status Update";
                          const templateName = "_Document Evaluation Reminder and Status Update";
                          sendMail(subject, templateName, "", variables, user.email);
                        }
                      }
                      
                      res.status(200).send({
                        competitonName: data.name,
                        reviewStatus: reviewStatus
                      });
                    }
                  });
              }
            });
      }});
  } else {
    res.status(403).send({
      msg: 'Operation not permited',
    });
  }
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
