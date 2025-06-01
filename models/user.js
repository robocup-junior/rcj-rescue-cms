/**
 * <p>User schema</p>
 *
 * @module models/user
 */

/**
 * Mongoose ObjectId
 * @external ObjectId
 * @see {@link http://mongoosejs.com/docs/api.html#schema-objectid-js}
 */

/**
 * Javascript Date
 * @external Date
 * @see {@link http://www.w3schools.com/jsref/jsref_obj_date.asp}
 */

/**
 * @callback updatePasswordCb
 * @param {Error} err Error if someting went wrong, otherwise null.
 */

/**
 * @callback comparePasswordCb
 * @param {Boolean} res True or false if it matched
 */

/**
 * @callback generateInviteCb
 * @param {Error} err If there was an error, null if not
 * @param {Token} token The generated token, null if error
 */

var env = require('node-env-file')
env('process.env')

const logger = require('../config/logger').mainLogger
var mongoose = require('mongoose')
var crypto = require('../helper/crypto')
// validator for email and so on
var validator = require('validator')

var timestamps = require('mongoose-timestamp')

var Schema = mongoose.Schema
var ObjectId = Schema.Types.ObjectId

const ACCESSLEVELS = {
  SUPERADMIN: 15,
  ADMIN     : 10,
  JUDGE     : 5,
  VIEW      : 1,
  NONE      : 0
}
module.exports.ACCESSLEVELS = ACCESSLEVELS;

const ROLE = [
  "VIEW",
  "JUDGE",
  "INTERVIEW",
  "ADMIN"
]
module.exports.ROLE = ROLE;

/**
 *
 *@constructor
 *
 * @param {String} username - The username
 * @param {String} password - The password
 * @param {String} salt - The salt used, unique for every user
 * @param {Boolean} admin - If the user is admin or not
 */
var userSchema = new Schema({
  username       : {type: String, required: true, unique: true},
  password       : {type: String, required: true, select: false},
  email          : {type: String, required: false, select: false},
  salt           : {type: String, select: false},
  admin          : {type: Boolean, default: false}, // deprecated
  superDuperAdmin: {type: Boolean, default: false},
  competitions   : [{
    id         : {
      type    : ObjectId,
      ref     : 'Competition',
      required: true
    },
    accessLevel: {
      type   : Number,
      default: ACCESSLEVELS.NONE,
      min    : ACCESSLEVELS.NONE,
      max    : ACCESSLEVELS.SUPERADMIN,
      /*validate: {
       validator: function (l) {
       return ACCESSLEVELS.indexOf(l) != -1
       }
       }*/
    },
    role: { type: [String], enum: ROLE, default: [] }
  }]
  
});

/**
 * Method used for pre saving.
 *
 * @function pre
 * @this userSchema
 *
 */
userSchema.pre('save', function (next) {
  if (this.isNew || this.isModified("password")) {
    var user = this;
    crypto.generateHashWithSalt(user.password, function (err, hashedString, saltUsed) {
      user.salt = saltUsed;
      user.password = hashedString;
      
      return next();
    })
  } else {
    return next()
  }
});

/**
 * Method used for updating the password. If you want to update the password use this metod, do not
 * use .save() method. Since it doesn't take care of salt and so on.
 *
 * @alias module:models/user.updatePassword
 * @this user
 * @param {String} password - The password you want
 * @param {updatePasswordCb} cb - The callback function
 */
userSchema.methods.updatePassword = function (password, cb) {
  var user = this;
  
  crypto.generateHashWithSalt(password, function (err, hashedString, saltUsed) {
    console.log(err);
    if (err) {
      return cb(err);
    }
    
    user.salt = saltUsed;
    user.password = hashedString;
    user.save();
    
    return cb(null);
  })
}

/**
 * Method used for checking if the password matches the user
 *
 * @alias module:models/user.updatePassword
 * @this user
 * @param {String} candidatePassword - The password you want to check
 * @param {comparePassword} cb - The callback function
 */
userSchema.methods.comparePassword = function (candidatePassword, cb) {
  crypto.compareHash(this.password, candidatePassword, this.salt, function (res) {
    return cb(res);
  })
}

userSchema.plugin(timestamps);
const User = mongoose.model('User', userSchema);

/** Mongoose model {@link http://mongoosejs.com/docs/models.html} */
module.exports.user = User;

//User.remove({}, function (err) {

var DefaultUser = new User({
  username       : process.env.dUsername,
  password       :  process.env.dPassword,
  admin          :  process.env.dAdmin,
  superDuperAdmin:  process.env.dSDAdmin
});

User.findOne({username: DefaultUser.username}, function (err, dbUser) {
  if (dbUser) {
    if (DefaultUser.password != null) {
      dbUser.password = DefaultUser.password
    }
    dbUser.admin = DefaultUser.admin
    dbUser.superDuperAdmin = DefaultUser.superDuperAdmin
    
    //logger.debug(dbUser)
    
    dbUser.save(function (err) {
      if (err) {
        logger.error(err)
      }
    })
  } else {
    DefaultUser.save(function (err) {
      if (err) {
        logger.error(err)
      }
      else {
        console.log("saved admin user for the first time, this will only get saved if it is a new installation");
      }
    });
  }
})
