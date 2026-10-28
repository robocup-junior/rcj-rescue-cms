#!/usr/bin/env node

const cluster = require('cluster')
const redisAdapter = require("socket.io-redis");
const logger = require('./config/logger').mainLogger
const env = require('node-env-file')
const numCPUs = require('os').cpus().length;
const fs = require("fs");
const http = require('http');

env('process.env');
//Load package json
const packageJson = require('./package.json');
process.env.cms_version = packageJson.version;
process.env.cms_copyright = packageJson.copyright;
logger.info(`#######################################`);
logger.info(` Welcome to RCJ CMS ${process.env.ENVIRONMENT} instance v${process.env.cms_version}`);
logger.info(`#######################################`);

 function isExistFile(file) {
   try {
     fs.statSync(file);
     return true
   } catch(err) {
     if(err.code === 'ENOENT') return false
   }
 }
 
 if(isExistFile("mail.env")) env('mail.env');

 const app = require('./app')

 let numProcess = 1;
 if(process.env.REDIS_HOST && process.env.REDIS_PORT){
  numProcess = Math.min(numCPUs, process.env.PROCESS_NUM);
 }else{
  throw new Error('Please configure the Redis Server.');
 }
 if(cluster.isMaster){
  logger.info(`We will now launch ${numProcess} worker process(es)`)
 }


//Queue
require("./queue/mailQueue")
 
 cluster.schedulingPolicy = cluster.SCHED_RR;
 if (cluster.isMaster && numProcess > 1) {
  logger.info(`Master ${process.pid} is running`)
     for (var i = 0; i < numProcess; i++) {
       cluster.fork()
     }
 
   cluster.on('exit', function(worker, code, signal) {
     // restart process
     logger.error('worker ' + worker.process.pid + ' died')
     logger.info("Forking new child process")
     cluster.fork()
   })
 }
 else {
  logger.info(`Worker ${process.pid} is running`)
  const port = (parseInt(process.env.WEB_HOSTPORT, 10) || 80) + parseInt(process.env.NODE_APP_INSTANCE || 0);
  app.set('port', port)
  const server = http.createServer(app)
 
   // socket.io stuff
 
   var io = require('socket.io')(server)
   if(process.env.REDIS_HOST && process.env.REDIS_PORT){
      io.adapter(redisAdapter({host: process.env.REDIS_HOST, port: process.env.REDIS_PORT}));
   }
 
   io.on('connection', function (socket) {
     socket.on('subscribe', function (data) {
       socket.join(data)
       logger.debug(`Worker ${process.pid}: Client joined room: ${data}`);
     })
     socket.on('unsubscribe', function (data) {
       socket.leave(data)
       logger.debug(`Worker ${process.pid}: Client detached room: ${data}`);
     })
   })
 
   require('./routes/api/lineRuns').connectSocketIo(io)
   require('./routes/api/mazeRuns').connectSocketIo(io)
   require('./routes/api/simRuns').connectSocketIo(io)
   require('./routes/api/signage').connectSocketIo(io)
   require('./routes/api/reservation').connectSocketIo(io)
 
 
   /**
    * Listen on provided port, on all network interfaces.
    */
 
   server.listen(port)
   server.on('error', onError)
   server.on('listening', onListening)
 
 
   /**
    * Event listener for HTTP server "error" event.
    */
 
   function onError(error) {
 
   if (error.syscall !== 'listen') {
     throw error
   }
 
   // handle specific listen errors with friendly messages
   switch (error.code) {
     case 'EACCES':
       logger.error('Port ' + port + ' requires elevated privileges')
       process.exit(1)
       break
     case 'EADDRINUSE':
       logger.error('Port ' + port + ' is already in use')
       process.exit(1)
       break
     default:
       throw error
     }
   }
 
   /**
    * Event listener for HTTP server "listening" event.
    */
 
   function onListening() {
       logger.info(`Worker ${process.pid}: Webserver listening on port ${server.address().port}`)
   }
  }