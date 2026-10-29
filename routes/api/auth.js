//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const router = express.Router();
const validator = require('validator');
const passport = require('passport');
const userdb = require('../../models/user');
const logger = require('../../config/logger').mainLogger;
const guessLimits = require('../../helper/guessLimits');

//= =======================================================================
//                          auth(mixed) Api endpoints
//= =======================================================================

/**
 * @api {post} /auth/login Request login
 * @apiName PostLogin
 * @apiGroup Auth
 * @apiVersion 1.0.0
 * @apiDescription This authentication method uses cookies and for that you need suppot for cookies. The complete
 * return is in the cookie header. This is not the best way to do it (should use oauth2).
 *
 * @apiParam {String} username Username
 * @apiParam {String} password Password
 *
 * @apiSuccess (200) {String}   msg Bottled message
 *
 * @apiSuccess (400) {String}   msg Bottled message
 */
router.post('/login', guessLimits.login, function (req, res) {
  const { username } = req.body;
  const { password } = req.body;

  // (only names and passwords: an object here would be a query of the database)
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).send({ msg: 'Login failed' });
  }
  if (!validator.isAscii(password)) {
    return res.status(400).send({ msg: 'Invalid characters' });
  }

  passport.authenticate('local', function (err, user, info) {
    if (err) {
      // return next(err);
      logger.error(err);
      return res.status(400).send({ msg: err });
    }
    if (!user) {
      return res.status(400).send({ msg: 'Login failed' });
    }
    req.logIn(user, function (err) {
      if (err) {
        logger.error(err);
        return res.status(400).send({ msg: err });
      }
      res.locals.user = username;
      return res.send({ msg: 'Login successful' });
    });
  })(req, res);
});

/**
 * @api {get} /auth/logout Request logout
 * @apiName GetLogout
 * @apiGroup Auth
 * @apiVersion 1.0.0
 * @apiDescription This function is used for logging out. This means you are cleared from the server, so even
 * though the cookie is left it doesnt know you.
 *
 */
router.get('/logout', function (req, res) {
  req.logout();
  res.send({ msg: 'Logout successful', status: true });
});

module.exports = router;
