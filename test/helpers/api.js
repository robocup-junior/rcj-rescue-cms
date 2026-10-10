// Mount real API routers in a small Express app with a stand-in for the logged-in user.
const express = require('express');

async function startApi(mountPath, routers) {
  let currentUser;
  const app = express();
  app.use(express.json());
  // Stand-in for the session login used in app.js
  app.use((req, res, next) => {
    req.user = currentUser;
    next();
  });
  app.use(mountPath, routers);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    setUser(user) {
      currentUser = user;
    },
    request(method, path, body) {
      return fetch(baseUrl + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

module.exports = { startApi };
