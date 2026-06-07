/**
 * Created by rasmuse on 2015-02-26.
 * Logic for routing authed units and so on, to know more about this class
 * just visit http://passportjs.org/ and copy pasta
 */

//========================================================================
//                          Libraries
//========================================================================
var passport = require('passport')
var LocalStrategy = require('passport-local').Strategy;
var userdb = require('../models/user');

//========================================================================
//                          Configuration
//========================================================================

// Creating a cookie for the user, it is just the id
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

// Check the cookie
passport.deserializeUser(function (id, done) {
  userdb.user.findById(id).select('+email').exec(function (err, user) {
    done(err, user);
  });
});

// Strategy used for authenticating user
passport.use(new LocalStrategy(function (username, password, done) {

  userdb.user.findOne({username: username}, "+password +salt", function (err, user) {
    if (err) {
      return done(err);
    }
    if (!user) {
      return done(null, false, {message: 'Unknown user ' + username});
    }

    user.comparePassword(password, function (valid) {
      if (valid) {
        return done(null, user)
      }
      return done(null, false, {message: 'Invalid password'})
    });
  });
}));

//========================================================================
//                          Routing functions
//========================================================================

// middleware to check user is logged in
exports.ensureAuthenticated = function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  now_access = req.originalUrl;
  res.redirect('/login?page=' + now_access);
}

// check to see that user is not logged in, check for visiting /login
exports.ensureNotAuthenticated = function ensureNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    if (req.query.page === undefined)return res.redirect('/home')
    else return res.redirect(req.query.page)
  }
  next();
}

/* check for api authentication, same method as ensureAuthenticated - but return json.
 *  to use this correctly should be replaced by oauth2
 */
exports.ensureLoginApi = function ensureLogin(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(400).send("You need to be logged in to do this");
}

// Check for admin
exports.ensureAdmin = function ensureAdmin(req, res, next) {
  if (req.user && req.user.admin === true) {
    next();
  } else {
    now_access = req.originalUrl;
    res.redirect('/login?page=' + now_access);
  }
}

// Check for admin, json resp for api calls
exports.ensureAdminApi = function ensureAdminApi(req, res, next) {
  if (req.user && req.user.admin === true)
    next();
  else
    res.status(400).send("You need to be admin to do this");
}

// Check for super
exports.ensureSuper = function ensureSuper(req, res, next) {
  if (req.user && req.user.superDuperAdmin === true) {
    next();
  } else {
    now_access = req.originalUrl;
    res.redirect('/login?page=' + now_access);
  }
}

// Check for super, json resp for api calls
exports.ensureSuperApi = function ensureSuperApi(req, res, next) {
  if (req.user && req.user.superDuperAdmin === true)
    next();
  else
    res.status(400).send("You need to be 'superDuperAdmin' to do this");
}
