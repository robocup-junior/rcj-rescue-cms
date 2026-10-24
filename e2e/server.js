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
  });
  const packageJson = require('../package.json');
  process.env.cms_version = packageJson.version;
  process.env.cms_copyright = packageJson.copyright;

  const app = require('../app');
  await require('./seed').seed();

  // Same socket.io setup as server.js, without the Redis adapter (there is only one process)
  const server = http.createServer(app);
  const io = require('socket.io')(server);
  io.on('connection', (socket) => {
    socket.on('subscribe', (room) => socket.join(room));
    socket.on('unsubscribe', (room) => socket.leave(room));
  });
  require('../routes/api/lineRuns').connectSocketIo(io);
  require('../routes/api/mazeRuns').connectSocketIo(io);
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
