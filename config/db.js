/**
 * Created by rasmuse on 2015-03-04.
 *
 * Startup for db connection, set start parameters for this class
 *
 */
var mongoose = require('mongoose');
var logger = require('../config/logger').mainLogger;
var env = require('node-env-file');
env('process.env');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB_CONNECT_STR, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
var db = mongoose.connection;

db.on('error', function (err) {
    logger.error('connection error to db @ db.js', err);
});
db.once('open', function () {
    logger.info('connected to db @ db.js');
});

module.exports.db = db;
