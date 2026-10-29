//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const multer = require('multer');
const auth = require('../../helper/authLevels');
var fs = require('fs-extra');
const sanitize = require('sanitize-filename');
const gracefulFs = require('graceful-fs');

var fs = gracefulFs.gracefulify(fs);
const mime = require('mime');
const { ACCESSLEVELS } = require('../../models/user');

const competitiondb = require('../../models/competition');
const { LEAGUES } = competitiondb;

const dateformat = require('dateformat');
let read = require('fs-readdir-recursive');
const logger = require('../../config/logger').mainLogger;
const escape = require('escape-html');
const mkdirp = require('mkdirp');

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
  const output = `[${dateformat(new Date(), 'mm/dd/yy HH:MM:ss')}] ${getIP(
    req
  )} : ${message}\n`;
  fs.appendFile(
    `${__dirname}/../../documents/${competitionId}/${teamId}/log.txt`,
    output,
    (err) => {
      if (err) logger.error(err.message);
    }
  );
}

function returnFiles(res, competition, folder){
  let path = `${__dirname}/../../cabinet/${competition}/${folder}`;
  fs.readdir(path, { withFileTypes: true }, (err, dirents) => {
    // A cabinet nothing was put in yet may have no folder
    if (err && err.code == 'ENOENT') return res.send([]);
    if (err) {
      res.status(500).send({
        msg: 'Could not get file list'
      });
      return;
    }

    const d = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        d.push({
          name: dirent.name,
          type: mime.getType(dirent.name)
        });
      }
    }
    res.send(d);
  });
}

publicRouter.get('/:competitionId/files/:teamId/:token/:folder', function (req, res, next) {
  const { competitionId } = req.params;
  const { teamId } = req.params;
  const { token } = req.params;
  let { folder } = req.params;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  let isTeam = false;
  if (ObjectId.isValid(folder)) {
    isTeam = true;
  }else{
    if (!LEAGUES.includes(folder)) {
      return next();
    }
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    return returnFiles(res, competitionId, folder);
  }else{ //Token check
    if (!ObjectId.isValid(teamId)) {
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
        if(isTeam) folder = teamId;
        return returnFiles(res, competitionId, folder);
      }
    });
  }
});

function returnFile(req, res, competition, folder, fileName){
  let path = `${__dirname}/../../cabinet/${competition}/${folder}/${sanitize(fileName)}`;
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

    // Streaming Video
    let mimeType = mime.getType(path);
    if (mimeType != null && mimeType.includes('video')) {
      try {
        const fileSize = stat.size;
        const { range } = req.headers;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');

          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

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
}

publicRouter.get('/:competitionId/file/:teamId/:token/:folder/:file', function (req, res, next) {
  const { competitionId } = req.params;
  const { teamId } = req.params;
  const { token } = req.params;
  let { folder } = req.params;
  let { file } = req.params;
  folder = decodeURIComponent(folder);
  file = decodeURIComponent(file);

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  let isTeam = false;
  if (ObjectId.isValid(folder)) {
    isTeam = true;
  }else{
    if (!LEAGUES.includes(folder)) {
      return next();
    }
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    return returnFile(req, res, competitionId, folder, file);
  }else{ //Token check
    if (!ObjectId.isValid(teamId)) {
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
        if(isTeam) folder = teamId;
        return returnFile(req, res, competitionId, folder, file);
      }
    });
  }
});

adminRouter.post('/:competitionId/upload/:folder', function (req, res, next) {
  const { competitionId } = req.params;
  const { folder } = req.params;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  let isTeam = false;
  if (ObjectId.isValid(folder)) {
    isTeam = true;
  }else{
    if (!LEAGUES.includes(folder)) {
      return next();
    }
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    const destination = `${__dirname}/../../cabinet/${competitionId}/${folder}`;
    if (!fs.existsSync(destination)) {
      mkdirp.sync(destination);
    }
    const storage = multer.diskStorage({
      destination(req, file, callback) {
        callback(
          null,
          `${__dirname}/../../cabinet/${competitionId}/${folder}`
        );
      },
      filename(req, file, callback) {
        callback(null, file.originalname);
      },
    });

    const upload = multer({
      storage,
    }).single('file');

    upload(req, res, function (err) {
      res.status(200).send({
        msg: 'File is uploaded',
        fileName: req.file.filename
      });
    });
  }
});


adminRouter.delete('/:competitionId/file/:folder/:file', function (req, res, next) {
  const { competitionId } = req.params;
  let { folder } = req.params;
  let { file } = req.params;
  folder = decodeURIComponent(folder);
  file = decodeURIComponent(file);

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  let isTeam = false;
  if (ObjectId.isValid(folder)) {
    isTeam = true;
  }else{
    if (!LEAGUES.includes(folder)) {
      return next();
    }
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    let path = `${__dirname}/../../cabinet/${competitionId}/${folder}/${sanitize(file)}`;
    fs.unlink(path, (err) => {
      if (err){
        return res.status(500).send({
          msg: 'Could not delete file',
          err: err.message,
        });
      }else{
        res.status(200).send({
          msg: 'File is deleted',
          fileName: file
        });
      }
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
