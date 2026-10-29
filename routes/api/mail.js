//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const pathL = require('path');
const fs = require('fs');
const mime = require('mime');
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const { randomToken } = require('../../helper/crypto');
const { ACCESSLEVELS } = require('../../models/user');
const auth = require('../../helper/authLevels');
const logger = require('../../config/logger').mainLogger;
const mailDb = require('../../models/mail');
const sanitizeFilename = require('sanitize-filename');
const {escapeRegExp} = require('lodash');
const competitiondb = require('../../models/competition');
const userdb = require('../../models/user');
const validator = require('validator');
const {mailQueue} = require("../../queue/mailQueue")
const mkdirp = require("mkdirp");
const { match } = require('assert');
const getDirName = require("path").dirname
const access = require('../../helper/access');
const safePath = require('../../helper/safePath');



const N = 32;

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
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

adminRouter.get('/templates', access.anyAdmin('the templates are of no competition'), function (req, res, next) {
  const path = `${safePath('templates', 'mail')}/`;
  fs.readdir(path, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error(err);
      return;
    }

    const d = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        const tmp = {
          name: pathL.basename(dirent.name, '.html'),
          path: dirent.name,
        };
        d.push(tmp);
      }
    }
    res.send(d);
  });
});

adminRouter.get('/templates/:fileName', access.anyAdmin('the templates are of no competition'), function (req, res, next) {
  const { fileName } = req.params;

  const path = safePath('templates', 'mail', sanitizeFilename(fileName));
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
});

adminRouter.post('/templates/:fileName', access.anyAdmin('the templates are of no competition'), function (req, res, next) {
  const { fileName } = req.params;

  const path = safePath('templates', 'mail', sanitizeFilename(fileName));
  fs.writeFile(path, req.body.content, function (err) {
    if (err) {
      res.status(404).send({
        msg: 'File could not create',
      });
      return;
    }else{
      res.status(200).send({
        msg: 'Success',
        name: fileName
      });
    }
  });
});

adminRouter.delete('/templates/:fileName', access.anyAdmin('the templates are of no competition'), function (req, res, next) {
  const { fileName } = req.params;

  const path = safePath('templates', 'mail', sanitizeFilename(fileName));
  fs.unlink(path, function (err) {
    if (err) {
      res.status(404).send({
        msg: 'File could not delete',
      });
      return;
    }else{
      res.status(200).send({
        msg: 'Successfully deleted',
        name: fileName
      });
    }
  });
});

function writeFile (path, contents, cb) {
  mkdirp.sync(getDirName(path));
  fs.writeFile(path, contents, cb);
}

/**
 * A mail queued for the mail server and kept with the competition's sent mails: to a team, or to a
 * user of the competition's staff (recipient: {competition, team} or {competition, user}). With
 * test, a mail for the sender to see how it reads: neither kept nor tracked.
 */
async function queueMail(req, recipient, to, mailData, reservation, { test = false } = {}) {
  let html = mailData.content
    .replace(/\r?\n/g, '')
    .replace(/<p><br><\/p>/g, '<br>')
    .replace(/<\/p><p>/g, '<br>')
    .replace(/<span class="ql-cursor">﻿<\/span>/, '');

  const regexpHref = /(href=)["|'](.*?)["|']+/g;

  const mailId = randomToken(N);

  let match;

  // Image attachment
  const regexpSrc = /<img src=["|'](.*?)["|']+/g;
  let attachments = [];
  const htmlB = html
  const destination = safePath('mailAttachment', recipient.competition, mailId);
  while (match = regexpSrc.exec(htmlB)) {
    // Only the pictures put in the mail (data: URIs) are attached: a path or a URL there would
    // have the server attach its own files, or what it is given at the URL. The others are left
    // to the mail readers to fetch.
    if (!/^data:image\//i.test(match[1])) continue;
    let cid = `${mailId}-${attachments.length}`;
    attachments.push({
      'path': match[1],
      'cid': cid
    })
    html = html.replace(match[1], `cid:${cid}`);
    if (!test) writeFile(`${destination}/${cid}`,match[1],function(err){
      if(err) throw err;
    });
  }

  let html4text = html;

  const replacedURL = [];
  while (!test && (match = regexpHref.exec(html)) !== null) {
    if (match[2].indexOf('/api/mail/click/') == -1) {
      const token = randomToken(N / 4);

      html = html.replace(
        new RegExp(escapeRegExp(match[0]), 'g'),
        `href="${req.headers.origin}/api/mail/click/${mailId}/${token}"`
      );
      html4text = html4text.replace(
        new RegExp(escapeRegExp(match[2]), 'g'),
        `${req.headers.origin}/api/mail/click/${mailId}/${token}`
      );

      const tmp = {
        token,
        url: match[2],
      };
      replacedURL.push(tmp);
    }
  }

  const text = htmlToText(html4text, {
    tags: { a: { options: { hideLinkHrefIfSameAsText: true } } },
  });

  html = `<style type="text/css">p {margin:0; padding:0; margin-bottom:0;}</style>${html}`;
  if (!test) html += `<img src="${req.headers.origin}/api/mail/open/${mailId}"/>`;

  const subject = (test ? '[TEST] ' : '') + mailData.title.replace("_", "");
  const message = {
    from: {
      name: process.env.MAIL_SENDER || 'RoboCupJunior CMS',
      address: process.env.MAIL_FROM,
    },
    to,
    subject,
    html,
    text,
    replyTo: process.env.MAIL_REPLY || process.env.MAIL_FROM,
    attachments,
    // (nothing of the message read from the server's files or fetched from URLs)
    disableFileAccess: true,
    disableUrlAccess: true,
  };

  if (test) {
    mailQueue.add('send', { message }, { attempts: 3, backoff: 60000 });
    return;
  }

  const now = Math.floor(new Date().getTime() / 1000);
  const data = await new mailDb.mail({
    competition: recipient.competition,
    team: recipient.team,
    user: recipient.user,
    mailId,
    messageId: null,
    time: reservation / 1000 || now,
    reservation: reservation > 0,
    to,
    subject,
    html,
    plain: text,
    status: -1,
    events: [
      {
        time: now,
        event: '== Email has been added to the queue. ==',
        user: req.user.username,
      },
    ],
    replacedURL,
  }).save();

  let delay = 0;
  if(reservation){
    delay = reservation - new Date().getTime();
    if(delay < 0) delay = 0;
  }
  mailQueue.add('send',{message, mailDbID: data._id}, {attempts:3, backoff:60000, delay});
}

// The mails of a request ({data: [{_id, mailData: {title, content}}], reservation}): each of a
// recipient by its id, with its subject and content as strings
function mailsOf(body) {
  const recipients = body.data;
  if (!Array.isArray(recipients) || !recipients.every((r) => r && ObjectId.isValid(r._id) && r.mailData
    && typeof r.mailData.title === 'string' && typeof r.mailData.content === 'string')) {
    return null;
  }
  return recipients;
}

function reservationOf(body) {
  return body.reservation ? new Date(body.reservation).getTime() : undefined;
}

adminRouter.post('/send', access.of(competitiondb.team, 'body.data[]._id', ACCESSLEVELS.ADMIN), async function (req, res, next) {
  if(smtp == null){
    res.status(500).send({
      msg: 'Please check smtp parameters',
    });
    return;
  }

  const teams = mailsOf(req.body);
  if (!teams) return res.status(400).send({ msg: 'Bad request' });

  // The teams as stored, not as the request has them: of a competition the user administers, and
  // at their own addresses
  const dbTeams = await competitiondb.team.find({ _id: { $in: teams.map((team) => team._id) } }).select('competition email').lean();
  for (const team of teams) {
    const dbTeam = dbTeams.find((t) => t._id.equals(team._id));
    if (!dbTeam || !auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.ADMIN)) {
      return res.status(401).send(auth.NO_AUTHORITY);
    }
    team.competition = dbTeam.competition;
    team.email = dbTeam.email;
  }

  const reservation = reservationOf(req.body);
  try {
    for (const team of teams) {
      await queueMail(req, { competition: team.competition, team: team._id }, team.email, team.mailData, reservation);
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).send({ msg: e.message });
  }
  res.status(200).send({
    msg: 'Emails have been added to the queue!',
  });
});

// The competition's staff: the users with a level or a role in it
function staffOf(competitionId) {
  return {
    competitions: {
      $elemMatch: {
        id: competitionId,
        $or: [{ accessLevel: { $gt: ACCESSLEVELS.NONE } }, { 'role.0': { $exists: true } }],
      },
    },
  };
}

adminRouter.get('/staff/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), async function (req, res, next) {
  const id = req.params.competitionId;

  try {
    const users = await userdb.user.find(staffOf(id)).select('username email competitions').lean();
    res.status(200).send(users.map((user) => {
      const right = user.competitions.find((c) => c.id.equals(id));
      return {
        _id: user._id,
        username: user.username,
        accessLevel: right.accessLevel,
        role: right.role,
        // The addresses are for the super admins (who manage the users) only, as in /api/users
        email: req.user.superDuperAdmin ? user.email : undefined,
        hasEmail: typeof user.email === 'string' && validator.isEmail(user.email),
      };
    }));
  } catch (err) {
    logger.error(err);
    res.status(400).send({
      msg: 'Could not get staff',
      err: err.message,
    });
  }
});

adminRouter.post('/staff/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), async function (req, res, next) {
  const id = req.params.competitionId;

  if(smtp == null){
    res.status(500).send({
      msg: 'Please check smtp parameters',
    });
    return;
  }

  const users = mailsOf(req.body);
  if (!users) return res.status(400).send({ msg: 'Bad request' });

  // The users as stored: of the competition's staff, and at their own addresses
  const dbUsers = await userdb.user.find({ _id: { $in: users.map((user) => user._id) }, ...staffOf(id) }).select('email').lean();
  for (const user of users) {
    const dbUser = dbUsers.find((u) => u._id.equals(user._id));
    if (!dbUser || typeof dbUser.email !== 'string' || !validator.isEmail(dbUser.email)) {
      return res.status(400).send({ msg: 'Not a user of the staff with an address' });
    }
    user.email = dbUser.email;
  }

  const reservation = reservationOf(req.body);
  try {
    for (const user of users) {
      await queueMail(req, { competition: id, user: user._id }, [user.email], user.mailData, reservation);
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).send({ msg: e.message });
  }
  res.status(200).send({
    msg: 'Emails have been added to the queue!',
  });
});

// A mail of the competition sent to the user who writes it, to see how it reads
adminRouter.post('/test/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), async function (req, res, next) {
  if(smtp == null){
    res.status(500).send({
      msg: 'Please check smtp parameters',
    });
    return;
  }

  const [mail] = mailsOf({ data: [{ _id: req.params.competitionId, mailData: req.body.mailData }] }) || [];
  if (!mail) return res.status(400).send({ msg: 'Bad request' });

  const dbUser = await userdb.user.findById(req.user._id).select('email').lean();
  if (!dbUser || typeof dbUser.email !== 'string' || !validator.isEmail(dbUser.email)) {
    return res.status(400).send({ msg: 'No email address is registered for you' });
  }

  try {
    await queueMail(req, { competition: req.params.competitionId }, [dbUser.email], mail.mailData, undefined, { test: true });
  } catch (e) {
    logger.error(e);
    return res.status(500).send({ msg: e.message });
  }
  res.status(200).send({ msg: 'A test email has been added to the queue!', to: dbUser.email });
});

adminRouter.get('/sent/:competitionId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), function (req, res, next) {
  const id = req.params.competitionId;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  mailDb.mail
    .find({
      competition: id,
    })
    .select('competition mailId messageId status subject team user time to reservation')
    .populate('team', 'name league teamCode country email')
    .populate('user', 'username')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get mails',
          err: err.message,
        });
      }
      return res.status(200).send(dbMail.reverse());
    });
});

adminRouter.get('/sent/:competitionId/:mailId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), function (req, res, next) {
  const id = req.params.competitionId;
  const { mailId } = req.params;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  mailDb.mail
    .findOne({
      competition: id,
      mailId,
    })
    .select('html plain')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get a mail',
          err: err.message,
        });
      }
      // Without the picture that tells the mail was opened: the admin reading it here is not the
      // recipient
      let htmlMail = dbMail.html.replace(/<img src="[^"]*\/api\/mail\/open\/[^"]*"\/>/g, '');
      const regexpSrc = /<img src=["|']cid:(.*?)["|']+/g;
      const destination = safePath('mailAttachment', id, mailId);
      let match;
      while (match = regexpSrc.exec(dbMail.html)) {
        // A file of the mail's: the cid is of the HTML kept, which an admin wrote
        const file = pathL.join(destination, sanitizeFilename(match[1]));
        if (fs.existsSync(file)) {
          htmlMail = htmlMail.replace(`cid:${match[1]}`, fs.readFileSync(file, { encoding: "utf-8" }));
        }
      }
      return res.status(200).send({ html: htmlMail, plain: dbMail.plain });
    });
});

adminRouter.get('/event/:competitionId/:mailId', access.competition(ACCESSLEVELS.ADMIN, 'params.competitionId'), function (req, res, next) {
  const id = req.params.competitionId;
  const { mailId } = req.params;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  mailDb.mail
    .findOne({
      competition: id,
      mailId,
    })
    .select('events.time events.event events.user')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get a mail',
          err: err.message,
        });
      }
      return res.status(200).send(dbMail.events.reverse());
    });
});

publicRouter.get('/click/:mailId/:token', access.anyone('the tracking of the mails sent'), function (req, res, next) {
  const { mailId } = req.params;
  const { token } = req.params;

  mailDb.mail
    .aggregate([
      { $match: { mailId } },
      { $unwind: '$replacedURL' },
      { $match: { 'replacedURL.token': token } },
    ])
    .exec(function (err, data) {
      if (err || !data) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get URL Data',
        });
      } else if (data[0]) {
        res.redirect(data[0].replacedURL.url);
        mailDb.mail
          .findById(data[0]._id)
          .select('status events')
          .exec(function (err, data) {
            if (err || !data) {
              logger.error(err);
            } else {
              if (data.status < 2) data.status = 2;
              const now = Math.floor(new Date().getTime() / 1000);
              const tmp = {
                time: now,
                event: 'The link in the email was clicked.',
                user: getIP(req),
              };
              data.events.push(tmp);

              data.save(function (err) {
                if (err) {
                  logger.error(err);
                }
              });
            }
          });
      } else {
        res.status(404);
      }
    });
});

publicRouter.get('/open/:mailId', access.anyone('the tracking of the mails sent'), function (req, res, next) {
  const { mailId } = req.params;

  mailDb.mail
    .findOne({
      mailId,
    })
    .select('status events')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get mail',
          err: err.message,
        });
      } else if (dbMail) {
        res.writeHead(200, { 'Content-Type': 'image/gif' });
        res.end(TRANSPARENT_GIF_BUFFER, 'binary');

        if (dbMail.status < 1) dbMail.status = 1;
        const now = Math.floor(new Date().getTime() / 1000);
        const tmp = {
          time: now,
          event: 'The email was opened.',
          user: getIP(req),
        };
        dbMail.events.push(tmp);
        dbMail.save(function (err) {
          if (err) {
            logger.error(err);
          }
        });
      }
    });
});


adminRouter.get('/mailAuth', access.superAdmin("the registrations' addresses and tokens"), function (req, res, next) {

  mailDb.mailAuth
    .find()
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get mails',
          err: err.message,
        });
      }
      return res.status(200).send(dbMail);
    });
});

publicRouter.get('/my/:teamId/:token', access.team(), function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;

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
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (team) {
          mailDb.mail
          .find({
            team: teamId,
            status: {$gte: 0}
          })
          .select('competition mailId messageId subject team time')
          .exec(function (err, dbMail) {
            if (err) {
              logger.error(err);
              return res.status(400).send({
                msg: 'Could not get mails',
                err: err.message,
              });
            }
            return res.status(200).send(dbMail.reverse());
          });
      }
    });
});

publicRouter.get('/get/:teamId/:token/:mailId', access.team(), function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const mailId = req.params.mailId;

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
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (team) {
          mailDb.mail
          .findOne({
            team: teamId,
            mailId,
          })
          .select('html plain')
          .exec(function (err, dbMail) {
            if (err) {
              logger.error(err);
              return res.status(400).send({
                msg: 'Could not get a mail',
                err: err.message,
              });
            }
            let htmlMail = dbMail.html;
            const regexpSrc = /<img src=["|']cid:(.*?)["|']+/g;
            const destination = safePath('mailAttachment', team.competition, mailId);
            let match;
            while (match = regexpSrc.exec(dbMail.html)) {
              // A file of the mail's: the cid is of the HTML kept, which an admin wrote
              const file = pathL.join(destination, sanitizeFilename(match[1]));
              if (fs.existsSync(file)) {
                htmlMail = htmlMail.replace(`cid:${match[1]}`, fs.readFileSync(file, { encoding: "utf-8" }));
              }
            }
            return res.status(200).send({ html: htmlMail, plain: dbMail.plain });
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
