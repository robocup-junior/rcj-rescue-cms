const mongoose = require('mongoose')
const validator = require('validator')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId
const competitiondb = require('./competition');
const {LEAGUES} = competitiondb;

const logger = require('../config/logger').mainLogger


const mailSchema = new Schema({
  competition: {type: ObjectId, ref: 'Competition'},
  team: {type: ObjectId, ref: 'Team'},
  // or, for a mail to the competition's staff, the user
  user: {type: ObjectId, ref: 'User'},
  mailId: {type: String},
  messageId: {type: String},
  time: {type: Number},
  reservation: {type: Boolean, default:false},
  to: [{type: String}],
  subject: {type: String},
  html: {type: String, select: false},
  plain: {type: String, select: false},
  status: {type: Number},
  events: {
    type: [ new Schema({
      time: {type: Number},
      event: {type: String},
      user: {type: String}
    })],
    default: [],
    select: false
  },
  replacedURL: {
    type:[new Schema({
      token: {type: String},
      url: {type: String}
    })],
    default: [],
    select: false
  }
})


const mailAuthSchema = new Schema({
  competition: {type: ObjectId, ref: 'Competition'},
  token: {type: String},
  league: {type: String, enum: LEAGUES},
  mail: {type: String},
  createdAt: {type: Date, expires: 1800, default: Date.now}
})

const mail = mongoose.model('mail', mailSchema)
const mailAuth = mongoose.model('mailAuth', mailAuthSchema)



/** Mongoose model {@link http://mongoosejs.com/docs/models.html} */
module.exports.mail = mail
module.exports.mailAuth = mailAuth