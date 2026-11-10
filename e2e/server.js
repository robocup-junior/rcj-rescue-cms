// Runs the whole app on an in-memory MongoDB filled with the seed data, for the Playwright tests.
// Started by playwright.config.js; Redis must be running (the mail and backup queues use it).
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = parseInt(process.env.E2E_PORT, 10) || 3100;

async function main() {
  const mongo = await MongoMemoryServer.create();

  // Set before app.js loads process.env, which does not overwrite values that are already set
  Object.assign(process.env, {
    DB_CONNECT_STR: mongo.getUri('rcj-cms-e2e'),
    WEB_HOSTPORT: String(PORT),
    CMS_HOSTNAME: `localhost:${PORT}`,
    // A page loads dozens of scripts at once; the production limit would reject some of them
    LIMITER_MAX: '100000',
    MAIN_LOG_LVL: 'ERROR',
    dUsername: 'admin',
    dPassword: 'adminpass',
    dAdmin: 'true',
    dSDAdmin: 'true',
    ENVIRONMENT: 'E2E',
    // Queues of their own, apart from those of an app (or another e2e server) on the same Redis
    QUEUE_PREFIX: `e2e${PORT}`,
    // A mail server that is not there: mails are queued as they would be sent (registration needs
    // one), and the tests read them from the queue
    MAIL_SMTP: '127.0.0.1',
    MAIL_PORT: '9',
    MAIL_FROM: 'cms@example.com',
  });
  const packageJson = require('../package.json');
  process.env.cms_version = packageJson.version;
  process.env.cms_copyright = packageJson.copyright;

  const app = require('../app');
  await require('./seed').seed();

  // Same socket.io setup as server.js, without the Redis adapter (there is only one process)
  // The API's routes and who may call them (helper/access.js), for the tests to call each of them
  const server = http.createServer((req, res) => {
    if (req.url === '/__e2e/routes') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(require('../helper/access').routes()));
    }
    return app(req, res);
  });
  const io = require('socket.io')(server);
  io.on('connection', (socket) => {
    socket.on('subscribe', (room) => socket.join(room));
    socket.on('unsubscribe', (room) => socket.leave(room));
  });
  require('../routes/api/lineRuns').connectSocketIo(io);
  require('../routes/api/mazeRuns').connectSocketIo(io);
  require('../routes/api/simRuns').connectSocketIo(io);
  require('../routes/api/signage').connectSocketIo(io);
  require('../routes/api/reservation').connectSocketIo(io);

  server.listen(PORT, () => console.log(`E2E server listening on http://localhost:${PORT}`));

  const shutdown = async () => {
    server.close();
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
