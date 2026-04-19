// -*- tab-width: 2 -*-
/**
 * Created by roflcopter on 4/14/15.
 *
 * Logger class for stuff
 *
 */
var log4js = require('log4js');
var env = require('node-env-file');
env('process.env');

log4js.configure({
    appenders: {
        out: {
            type: 'console',
        },
        main: {
            type: 'dateFile',
            filename: 'logs/main',
            pattern: '-dd.log',
            alwaysIncludePattern: true,
        },
    },
    categories: {
        default: {
            appenders: ['out'],
            level: 'debug',
        },
        main: {
            appenders: ['main', 'out'],
            level: 'debug',
        },
    },
});

var mainLogger = log4js.getLogger('main');
mainLogger.level = process.env.MAIN_LOG_LVL || 'DEBUG';

module.exports.mainLogger = mainLogger;
