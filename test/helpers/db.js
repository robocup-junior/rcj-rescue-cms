// In-memory MongoDB for integration tests. Models must be required after start().
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let server;

async function start() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { useNewUrlParser: true, useUnifiedTopology: true });
}

async function stop() {
  await mongoose.disconnect();
  if (server) await server.stop();
}

/** Wait until fn() resolves to a truthy value (e.g. data seeded when a model is loaded). */
async function waitFor(fn, timeoutMs = 10000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > until) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

module.exports = { start, stop, waitFor };
