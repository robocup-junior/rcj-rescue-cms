//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const adminRouter = express.Router();
const superRouter = express.Router();
const userdb = require('../../models/user');
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const auth = require('../../helper/authLevels');
const { ACCESSLEVELS } = require('../../models/user');
const {sendMail} = require('../../helper/mailSender');

adminRouter.get('/', function (req, res) {
  userdb.user
    .find({})
    .select("_id username email admin superDuperAdmin competitions")
    .lean()
    .exec(function (err, data) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get users',
          err: err.message,
        });
      } else {
        res.status(200).send(data);
      }
    });
});

superRouter.delete('/:userid', function (req, res, next) {
  const id = req.params.userid;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  userdb.user.deleteOne(
    {
      _id: id,
    },
    function (err) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not remove user',
          err: err.message,
        });
      } else {
        res.status(200).send({
          msg: 'User has been removed!',
        });
      }
    }
  );
});

superRouter.post('/', function (req, res) {
  const user = req.body;

  const newUser = new userdb.user({
    username: user.username,
    password: user.password,
    admin: user.admin,
    email: user.email,
    superDuperAdmin: user.superDuperAdmin,
    competitions: user.competitions,
  });

  userdb.user.findOne(
    {
      username: newUser.username,
    },
    function (err, dbUser) {
      if (dbUser) {
        if (newUser.password != null) {
          dbUser.password = newUser.password;
        }
        dbUser.admin = newUser.admin;
        dbUser.superDuperAdmin = newUser.superDuperAdmin;
        dbUser.email = newUser.email;

        // logger.debug(dbUser)

        dbUser.save(function (err) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Could not regist user :(',
            });
            return;
          }
          res.status(200).send({
            msg: 'User has been registerd!',
          });
        });
      } else {
        newUser.save(function (err) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Could not regist user :(',
            });
            return;
          } else {
            res.status(200).send({
              msg: 'User has been registerd!',
            });
          }
        });
      }
    }
  );

  // Send account notification email
  if (user.emailNotification && user.email) {
    const variables = {
      userName: user.username,
      password: user.password,
      loginUrl: `${process.env.CMS_PROTOCOL}://${process.env.CMS_HOSTNAME}/login`,
      contactAddress: process.env.MAIL_REPLY || process.env.MAIL_FROM
    };
    const subject = "Welcome to RCJ CMS – Your Account Information";
    const templateName = "_Welcome to RCJ CMS – Your Account Information";
    sendMail(subject, templateName, "", variables, user.email);
  }
});

adminRouter.put('/:userid/:competitionid/role', function (req, res, next) {
  const { userid } = req.params;
  const { competitionid } = req.params;
  const role = Array.from(new Set(req.body));
  

  if (!auth.authCompetition(req.user, competitionid, ACCESSLEVELS.ADMIN)) {
    res.status(401).send({
      msg: 'You have no authority to access this api',
    });
    return next();
  }

  userdb.user.findById(userid).exec(function (err, dbUser) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get user',
        err: err.message,
      });
    } else if (dbUser) {
      for (j = 0; j < dbUser.competitions.length; j++) {
        if (dbUser.competitions[j].id == competitionid) break;
      }

      if (j >= dbUser.competitions.length) {
        const newData = {
          id: competitionid,
          accessLevel: 0,
          role: role
        };
        dbUser.competitions.push(newData);
      } else {
        dbUser.competitions[j].role = role;
      }

      dbUser.save(function (err) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            err: err.message,
            msg: 'Could not save changes',
          });
        }
        return res.status(200).send({
          msg: 'Saved changes',
        });
      });
    }
  });
});

adminRouter.put('/:userid/:competitionid/:aLevel', function (req, res, next) {
  const { userid } = req.params;
  const { competitionid } = req.params;
  const { aLevel } = req.params;

  if (!auth.authCompetition(req.user, competitionid, ACCESSLEVELS.ADMIN)) {
    res.status(401).send({
      msg: 'You have no authority to access this api',
    });
    return next();
  }

  userdb.user.findById(userid).exec(function (err, dbUser) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get user',
        err: err.message,
      });
    } else if (dbUser) {
      for (j = 0; j < dbUser.competitions.length; j++) {
        if (dbUser.competitions[j].id == competitionid) break;
      }

      if (j >= dbUser.competitions.length) {
        const newData = {
          id: competitionid,
          accessLevel: aLevel,
          role : []
        };
        dbUser.competitions.push(newData);
      } else {
        dbUser.competitions[j].accessLevel = aLevel;
      }

      dbUser.save(function (err) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            err: err.message,
            msg: 'Could not save changes',
          });
        }
        return res.status(200).send({
          msg: 'Saved changes',
        });
      });
    }
  });
});

// not good at security
superRouter.put('/:userid', function (req, res, next) {
  const id = req.params.userid;
  if (!ObjectId.isValid(id)) {
    return next();
  }

  const user = req.body;

  // Exclude fields that are not allowed to be publicly changed
  delete user._id;
  delete user.username;
  delete user.superDuperAdmin;
  delete user.admin;
  delete user.__v;
  delete user.password;

  // logger.debug(run)

  userdb.user.findById(id).exec(function (err, dbUser) {
    if (err) {
      logger.error(err);
      res.status(400).send({
        msg: 'Could not get user',
        err: err.message,
      });
    } else if (dbUser) {
      // Recursively updates properties in "dbObj" from "obj"
      const copyProperties = function (obj, dbObj) {
        for (const prop in obj) {
          if (
            obj.constructor == Array ||
            (obj.hasOwnProperty(prop) &&
              (dbObj.hasOwnProperty(prop) ||
                (dbObj.get !== undefined && dbObj.get(prop) !== undefined)))
          ) {
            // Mongoose objects don't have hasOwnProperty
            if (typeof obj[prop] === 'object' && dbObj[prop] != null) {
              // Catches object and array
              copyProperties(obj[prop], dbObj[prop]);

              if (dbObj.markModified !== undefined) {
                dbObj.markModified(prop);
              }
            } else if (obj[prop] !== undefined) {
              // logger.debug("copy " + prop)
              dbObj[prop] = obj[prop];
            }
          } else {
            return new Error(`Illegal key: ${prop}`);
          }
        }
      };

      err = copyProperties(user, dbUser);

      if (err) {
        logger.error(err);
        return res.status(400).send({
          err: err.message,
          msg: 'Could not save user',
        });
      }

      dbUser.save(function (err) {
        if (err) {
          logger.error(err);
          return res.status(400).send({
            err: err.message,
            msg: 'Could not save user',
          });
        }
        return res.status(200).send({
          msg: 'Saved user',
        });
      });
    }
  });
});

module.exports.admin = adminRouter;
module.exports.super = superRouter;
