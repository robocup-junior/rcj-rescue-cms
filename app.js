// -*- tab-width: 2 -*-
//========================================================================
//                          Libraries
//========================================================================

var env = require('node-env-file')
env('process.env')

var express = require('express');
var RateLimit = require('express-rate-limit');
const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { ExpressAdapter } = require('@bull-board/express')
const compression = require('compression')
var path = require('path')
var favicon = require('serve-favicon')
var logger = require('./config/logger').mainLogger
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
const mongo_express = require('mongo-express/lib/middleware')
const mongo_express_config = require('./mongo_express_config')

// db
var db = require('./config/db')
var mongoose = require('mongoose')

// auth
var pass = require('./config/pass')
var passport = require('passport')
// session
var session = require('express-session')
var MongoStore = require('connect-mongo')

var bodyParser = require('body-parser');

const limiter = new RateLimit({
    windowMs: process.env.LIMITER_WINDOW_MS || 1000, // 1 sec
    max: process.env.LIMITER_MAX || 200
});

const bullAdapter = new ExpressAdapter();

const {mailQueue} = require("./queue/mailQueue")
const {backupQueue} = require("./queue/backupQueue")

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [
        new BullAdapter(mailQueue),
        new BullAdapter(backupQueue)
    ],
    serverAdapter:bullAdapter
})

var app = express();
app.set('trust proxy', true);
async function bootstrap(){
    //========================================================================
    //                          Routes require
    //========================================================================

    //========================================================================
    //                          Static routes
    //========================================================================

    var homeRoute = require('./routes/home')
    var lineRoute = require('./routes/line')
    var mazeRoute = require('./routes/maze')
    var simulationRoute = require('./routes/simulation')
    var loginRoute = require('./routes/login')
    var adminRoute = require('./routes/admin')
    var localesRoute = require('./routes/locales')
    var signageRoute = require('./routes/signage')
    var shortRoute = require('./routes/shortURL')
    var serviceRoute = require('./routes/service')
    var documentRoute = require('./routes/document')
    var registrationRoute = require('./routes/registration')
    var myPageRoute = require('./routes/mypage')



    //========================================================================
    //                          Api routes
    //========================================================================

    var apiAuthRoute = require('./routes/api/auth')
    var apiLineMapsRoute = require('./routes/api/lineMaps')
    var apiMazeMapsRoute = require('./routes/api/mazeMaps')
    var apiTeamsRoute = require('./routes/api/teams')
    var apiRoundsRoute = require('./routes/api/rounds')
    var apiFieldsRoute = require('./routes/api/fields')
    var apiLineRunsRoute = require('./routes/api/lineRuns')
    var apiMazeRunsRoute = require('./routes/api/mazeRuns')
    var apiSimulationRunsRoute = require('./routes/api/simRuns')
    var apiCompetitionsRoute = require('./routes/api/competitions')
    var apiUserRoute = require('./routes/api/users')
    var apiSignageRoute = require('./routes/api/signage')
    var apiBackupRoute = require('./routes/api/backup')
    var apiShortURL = require('./routes/api/shortURL')
    var apiDocumentRoute = require('./routes/api/document')
    var apiMailRoute = require('./routes/api/mail')
    var apiRegistrationRoute = require('./routes/api/registration')
    var apiReservationRoute = require('./routes/api/reservation')
    var apiCabinetRoute = require('./routes/api/cabinet')
    var apiSurveyRoute = require('./routes/api/survey')
    var apiRankingRoute = require('./routes/api/ranking')
    var apiTechnicalChallengeRoute = require('./routes/api/technicalChallenge')


    //========================================================================
    //                          Configuration
    //========================================================================

    

    app.use(compression())

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    /** Setting up the correct view engine - we are using pug */
    app.set('views', path.join(__dirname, 'views'))
    app.set('view engine', 'pug')

    app.use(bodyParser.json({limit: '50mb'}));
    app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));


    /*
    * Log
    */
    //app.use(morgan('short'));




    /*
    * Config
    */
    // uncomment after placing your favicon in /public
    app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')))
    //app.use(logger('dev'))
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({
        extended: false
    }))
    app.use(cookieParser())
    app.use(express.static(path.join(__dirname, 'public')))

    /*
    * Session and passport for auth
    */
    // init passport and session
    app.use(session({
        store: MongoStore.create({ mongoUrl: process.env.DB_CONNECT_STR, mongoOptions:{useUnifiedTopology: true}}),
        secret: process.env.SESSION_SECRET || 'rcjscoring',
        resave: false,
        saveUninitialized: false,
        cookie: {
        maxAge: 10 * 60 * 60 * 1000
        }
    }))
    app.use(passport.initialize())
    app.use(passport.session())

    // apply rate limiter to all requests
    app.use(limiter);


    //========================================================================
    //                          Route configuration
    //========================================================================

    //========================================================================
    //                          API Calls
    //========================================================================

    app.use('/api/auth', apiAuthRoute)
    app.use('/api/maps/line', [apiLineMapsRoute.public, pass.ensureLoginApi, apiLineMapsRoute.private, pass.ensureAdminApi, apiLineMapsRoute.admin])
    app.use('/api/maps/maze', [apiMazeMapsRoute.public, pass.ensureLoginApi, apiMazeMapsRoute.private, pass.ensureAdminApi, apiMazeMapsRoute.admin])
    app.use('/api/teams', [apiTeamsRoute.public, pass.ensureLoginApi, apiTeamsRoute.private, pass.ensureAdminApi, apiTeamsRoute.admin])
    app.use('/api/rounds', [apiRoundsRoute.public, pass.ensureLoginApi, apiRoundsRoute.private, pass.ensureAdminApi, apiRoundsRoute.admin])
    app.use('/api/fields', [apiFieldsRoute.public, pass.ensureLoginApi, apiFieldsRoute.private, pass.ensureAdminApi, apiFieldsRoute.admin])
    app.use('/api/runs/line', [apiLineRunsRoute.public, pass.ensureLoginApi, apiLineRunsRoute.private, pass.ensureAdminApi, apiLineRunsRoute.admin])
    app.use('/api/runs/maze', [apiMazeRunsRoute.public, pass.ensureLoginApi, apiMazeRunsRoute.private, pass.ensureAdminApi, apiMazeRunsRoute.admin])
    app.use('/api/runs/simulation', [apiSimulationRunsRoute.public, pass.ensureLoginApi, apiSimulationRunsRoute.private, pass.ensureAdminApi, apiSimulationRunsRoute.admin])
    app.use('/api/competitions', [apiCompetitionsRoute.public, pass.ensureLoginApi, apiCompetitionsRoute.private, pass.ensureAdminApi, apiCompetitionsRoute.admin])
    app.use('/api/users', [pass.ensureLoginApi, apiUserRoute.admin, pass.ensureSuperApi , apiUserRoute.super])
    app.use('/api/signage', [pass.ensureLoginApi, apiSignageRoute.private, pass.ensureAdminApi, apiSignageRoute.admin])
    app.use('/api/backup', [pass.ensureAdminApi, apiBackupRoute.admin])
    app.use('/api/short', [pass.ensureSuperApi , apiShortURL.super])
    app.use('/api/document', [apiDocumentRoute.public, pass.ensureLoginApi, apiDocumentRoute.private, pass.ensureAdminApi, apiDocumentRoute.admin])
    app.use('/api/mail', [apiMailRoute.public, pass.ensureLoginApi, apiMailRoute.private, pass.ensureAdminApi, apiMailRoute.admin])
    app.use('/api/registration', [apiRegistrationRoute.public, pass.ensureLoginApi, apiRegistrationRoute.private, pass.ensureAdminApi, apiRegistrationRoute.admin])
    app.use('/api/reservation', [apiReservationRoute.public, pass.ensureLoginApi, apiReservationRoute.private, pass.ensureAdminApi, apiReservationRoute.admin])
    app.use('/api/cabinet', [apiCabinetRoute.public, pass.ensureLoginApi, apiCabinetRoute.private, pass.ensureAdminApi, apiCabinetRoute.admin])
    app.use('/api/survey', [apiSurveyRoute.public, pass.ensureLoginApi, apiSurveyRoute.private, pass.ensureAdminApi, apiSurveyRoute.admin])
    app.use('/api/ranking', [apiRankingRoute.public, pass.ensureLoginApi, apiRankingRoute.private, pass.ensureAdminApi, apiRankingRoute.admin])
    app.use('/api/technicalChallenge', [pass.ensureLoginApi, apiTechnicalChallengeRoute.private, pass.ensureAdminApi, apiTechnicalChallengeRoute.admin])
    app.get('/api/ip', (request, response) => response.send(request.ip))


    //========================================================================
    //                          Website static pages(ish)
    //========================================================================

    app.use('/login', pass.ensureNotAuthenticated, loginRoute)
    app.use('/logout', pass.ensureAuthenticated, function (req, res, next) {
        req.logout(req.user, err => {
            if(err) return next(err);
            res.redirect("/home");
        });
    })
    app.use('/home', [homeRoute.public, pass.ensureAuthenticated, homeRoute.private, pass.ensureAdmin, homeRoute.admin])
    app.use('/locales', localesRoute)
    app.use('/s', shortRoute.public)
    app.use('/service', serviceRoute)

    app.use('/line', [lineRoute.public, pass.ensureAuthenticated, lineRoute.private, pass.ensureAdmin, lineRoute.admin])
    app.use('/maze', [mazeRoute.public, pass.ensureAuthenticated, mazeRoute.private, pass.ensureAdmin, mazeRoute.admin])
    app.use('/simulation', [simulationRoute.public, pass.ensureAuthenticated, simulationRoute.private, pass.ensureAdmin, simulationRoute.admin])
    app.use('/signage', [pass.ensureAuthenticated, signageRoute.private, pass.ensureAdmin, signageRoute.admin])
    app.use('/admin', pass.ensureAdmin, adminRoute)
    bullAdapter.setBasePath('/admin/queues')
    app.use('/admin/queues', pass.ensureSuper, bullAdapter.getRouter())
    app.use('/admin/mongo', pass.ensureSuper, await mongo_express(mongo_express_config))
    app.use('/document', [documentRoute.public, pass.ensureAuthenticated, documentRoute.private, pass.ensureAdmin, documentRoute.admin])
    app.use('/registration', [registrationRoute.public, pass.ensureAuthenticated, registrationRoute.private, pass.ensureAdmin, registrationRoute.admin])
    app.use('/mypage', [myPageRoute.public, pass.ensureAuthenticated, myPageRoute.private, pass.ensureAdmin, myPageRoute.admin])

    //========================================================================
    //                          Custom routes
    //========================================================================
    /*
    * This is called last in the routing config, therefor it'll take care of 404s
    */
    app.use(function (req, res, next) {
        logger.error("404 Not Found: " + req.originalUrl)
        var err = new Error('Not Found: ' + req.originalUrl)
        err.status = 404
        next(err)
    })

    //========================================================================
    //                          Error handling
    //========================================================================

    process.on('uncaughtException', function(err) {
        console.log("SERVER ERROR");
        console.log(err);
    });

    app.use(function (err, req, res, next) {
        // is at base, send to login
        if (req.originalUrl === "/") {
            res.redirect("home")
        }

        /*
        *  Check if it is an api or static page miss (404)
        *
        * One of the big things to do for scalability is to separate tcp server,static server and application server (api).
        *
        * Right now they are mixed and running on a single core togeather. To be able to use Node.js to 100% the  application
        * part of the server should run alone on an own process. And the static files (CSS, HTML and Javascript(frontend)) should
        * for performance reasons not run on Node.js but on nginx (http://nginx.org/). One of the fastest static servers out there used
        * by many companies. Also it can work as a reverse proxy to support multi Node.js clusters.
        *
        */
        else {

            if (err.status != 404) {
                logger.error(err)
            }


            // since we are running api and static website on same we need to hack the different custom routes
            var stringSplit = req.originalUrl.split("/")
            //res.status(err.status || 500)
            if (stringSplit[1] !== undefined && stringSplit[1] === "api") {
                res.status(404).send({
                    message: "404 Not found"
                })
            } else {

                // in in development show stacktrace
                if (app.get('env') === 'development') {
                    res.render('error', {
                        message: err.message,
                        error: err
                    })
                }

                // in production :(
                else {
                    res.status(err.status || 500)
                    res.render('error', {
                        message: err.message,
                        error: {}
                    })
                }
            }
        }
    })
    
}
bootstrap();
module.exports = app
