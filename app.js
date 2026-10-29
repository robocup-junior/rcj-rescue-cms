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

// db
var db = require('./config/db')
var mongoose = require('mongoose')

// auth
var pass = require('./config/pass')
const access = require('./helper/access')
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
// The addresses of the clients are taken from X-Forwarded-For only as the proxies before the app
// give it: those of the machine and of private networks (as nginx beside the app in Docker), or
// those TRUST_PROXY says. Anyone else could give any address there.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');
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
    app.disable('x-powered-by')
    // (helper/securityHeaders.js)
    app.use(require('./helper/securityHeaders'))

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    /** Setting up the correct view engine - we are using pug */
    app.set('views', path.join(__dirname, 'views'))
    app.set('view engine', 'pug')
    // Appended to JS/CSS URLs in views so browsers fetch fresh copies after every update/restart
    app.locals.assetVersion = `${require('./package.json').version}-${Date.now().toString(36)}`

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
    // No operators of the database in what requests give (helper/stripOperators.js)
    app.use(require('./helper/stripOperators'))
    // The signage contents are put in by admins: not run as pages either (helper/servedFiles.js)
    app.use('/signage_content', require('./helper/servedFiles'))
    app.use(express.static(path.join(__dirname, 'public')))

    /*
    * Session and passport for auth
    */
    // init passport and session
    app.use(session({
        store: MongoStore.create({ mongoUrl: process.env.DB_CONNECT_STR, mongoOptions:{useUnifiedTopology: true}}),
        secret: await require('./helper/sessionSecret')(),
        resave: false,
        saveUninitialized: false,
        cookie: {
        maxAge: 10 * 60 * 60 * 1000,
        // Not sent with requests other sites make (forms posted to the API from them)
        sameSite: 'lax',
        // Over https only, when the request came so (through a proxy the app trusts)
        secure: 'auto'
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

    // Files people put in are never run as pages from here (helper/servedFiles.js)
    app.use('/api', require('./helper/servedFiles'))
    // Each with the guards of its routers, every route declaring who may call it (helper/access.js)
    access.mount(app, '/api/auth', apiAuthRoute)
    access.mount(app, '/api/maps/line', apiLineMapsRoute)
    access.mount(app, '/api/maps/maze', apiMazeMapsRoute)
    access.mount(app, '/api/teams', apiTeamsRoute)
    access.mount(app, '/api/rounds', apiRoundsRoute)
    access.mount(app, '/api/fields', apiFieldsRoute)
    access.mount(app, '/api/runs/line', apiLineRunsRoute)
    access.mount(app, '/api/runs/maze', apiMazeRunsRoute)
    access.mount(app, '/api/runs/simulation', apiSimulationRunsRoute)
    access.mount(app, '/api/competitions', apiCompetitionsRoute)
    access.mount(app, '/api/users', apiUserRoute)
    access.mount(app, '/api/signage', apiSignageRoute)
    access.mount(app, '/api/backup', apiBackupRoute)
    access.mount(app, '/api/short', apiShortURL)
    access.mount(app, '/api/document', apiDocumentRoute)
    access.mount(app, '/api/mail', apiMailRoute)
    access.mount(app, '/api/registration', apiRegistrationRoute)
    access.mount(app, '/api/reservation', apiReservationRoute)
    access.mount(app, '/api/cabinet', apiCabinetRoute)
    access.mount(app, '/api/survey', apiSurveyRoute)
    access.mount(app, '/api/ranking', apiRankingRoute)
    access.mount(app, '/api/technicalChallenge', apiTechnicalChallengeRoute)
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
    app.use('/s', shortRoute.public)
    app.use('/service', serviceRoute)

    app.use('/line', [lineRoute.public, pass.ensureAuthenticated, lineRoute.private, pass.ensureAdmin, lineRoute.admin])
    app.use('/maze', [mazeRoute.public, pass.ensureAuthenticated, mazeRoute.private, pass.ensureAdmin, mazeRoute.admin])
    app.use('/simulation', [simulationRoute.public, pass.ensureAuthenticated, simulationRoute.private, pass.ensureAdmin, simulationRoute.admin])
    app.use('/signage', [pass.ensureAuthenticated, signageRoute.private, pass.ensureAdmin, signageRoute.admin])
    app.use('/admin', pass.ensureAdmin, adminRoute)
    bullAdapter.setBasePath('/admin/queues')
    app.use('/admin/queues', pass.ensureSuper, bullAdapter.getRouter())
    // The database's own editor, for the super admins: only when it is asked for (MONGO_EXPRESS),
    // as it is a way into all of the database, of packages with vulnerabilities of their own
    if (process.env.MONGO_EXPRESS === 'true') {
        const mongo_express = require('mongo-express/lib/middleware')
        app.use('/admin/mongo', pass.ensureSuper, await mongo_express(require('./mongo_express_config')))
    }
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
