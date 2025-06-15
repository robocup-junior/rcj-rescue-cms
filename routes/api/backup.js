//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const adminRouter = express.Router();
const multer = require('multer');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const { ObjectId } = require('mongoose').Types;

const auth = require('../../helper/authLevels');

const { ACCESSLEVELS } = require('../../models/user');

const base_tmp_path = `${__dirname}/../../tmp/`;

const {backupQueue} = require("../../queue/backupQueue")

adminRouter.post('/:competition', function (req, res) {
  const competitionId = req.params.competition;
  const fullBackup = req.body.fullBackup;

  if (!auth.authCompetition(req.user, competitionId, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  backupQueue.add('backup',{competitionId, fullBackup}).then((job) => {
    res.status(200).send({
      msg: 'Backup job has been added to the queue!',
      jobId: job.id
    });
  });
});


adminRouter.get('/list/:competitionId', function (req, res, next) {
  const { competitionId } = req.params;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    glob.glob(
      `./backup/${competitionId}/*.cms`,
      function (er, files) {
        let fl = [];
        for(let f of files){
          let name = path.basename(f);
          let tmp = {
            "time": Number(path.basename(f, path.extname(f)).replace('FULL_', '').replace('AUTO_', '')),
            "name": name,
            "auto": name.indexOf('AUTO_') != -1,
            "full": name.indexOf('FULL_') != -1
          }
          fl.push(tmp);
        }
        res.status(200).send(fl);
      }
    );
  }else{
    res.status(403).send({
      msg: 'Auth error'
    });
  }
});

adminRouter.get('/archive/:competitionId/:fileName', function (req, res, next) {
  const { competitionId } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    let path = `${__dirname}/../../backup/${competitionId}/${fileName}`;
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
      res.writeHead(200, {
        'Content-Type': "application/zip",
      });
      stream.pipe(res);
    });
  }else{
    res.status(403).send({
      msg: 'Auth error'
    });
  }
});

adminRouter.delete('/archive/:competitionId/:fileName', function (req, res, next) {
  const { competitionId } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(competitionId)) {
    return next();
  }

  if (auth.authCompetition(req.user,competitionId,ACCESSLEVELS.ADMIN)){ // Admin check
    let path = `${__dirname}/../../backup/${competitionId}/${fileName}`;
    fs.unlink(path, (err) => {
      if (err){
        return res.status(500).send({
          msg: 'Could not delete backup',
          err: err.message,
        });
      }else{
        res.status(200).send({
          msg: 'Backup is deleted'
        });
      }
    });
  }else{
    res.status(403).send({
      msg: 'Auth error'
    });
  }
});

adminRouter.post('/restore', function (req, res) {
  const folder = Math.random().toString(32).substring(2);
  fs.mkdirsSync(`${base_tmp_path}uploads/`);

  const storage = multer.diskStorage({
    destination(req, file, callback) {
      callback(null, `${base_tmp_path}uploads/`);
    },
    filename(req, file, callback) {
      callback(null, `${folder}.zip`);
    },
  });

  const upload = multer({
    storage,
  }).single('file');

  upload(req, res, function (err) {
    backupQueue.add('restore',{folder, user: req.user}).then((job) => {
      res.status(200).send({
        msg: 'Restore job has been added to the queue!',
        jobId: job.id
      });
    })
  });
});

adminRouter.get('/job/:jobId', async function (req, res, next) {
  const { jobId } = req.params;
  let job = await backupQueue.getJob(jobId);
  if (job === null) {
    res.status(404).end();
   } else {
    let state = await job.getState();
    let progress = job._progress;
    let reason = job.failedReason;
    let competition = job.data.competitionId;
    res.json({ jobId, state, progress, reason, competition });
   }
});

adminRouter.all('*', function (req, res, next) {
  next();
});

module.exports.admin = adminRouter;
