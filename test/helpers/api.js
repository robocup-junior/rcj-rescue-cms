// Mount real API routers in a small Express app with a stand-in for the logged-in user.
const express = require('express');

async function startApi(mountPath, routers) {
  let currentUser;
  const app = express();
  app.use(express.json());
  // Stand-in for the session login used in app.js
  app.use((req, res, next) => {
    req.user = currentUser;
    req.isAuthenticated = () => currentUser != null;
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
        // A handler that never answers fails the test instead of hanging the run
        signal: AbortSignal.timeout(5000),
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

/**
 * A route module's routers with the login/admin guards between them, in the order used in app.js.
 * Users need `admin: true` to reach the admin router.
 */
function guarded(route) {
  const pass = require('../../config/pass');
  return [route.public, pass.ensureLoginApi, route.private, pass.ensureAdminApi, route.admin];
}

module.exports = { startApi, guarded };
