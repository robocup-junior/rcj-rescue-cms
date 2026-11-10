/**
 * Express middleware for the API, whose answers include the files people put in (teams' documents
 * and pictures in their answers, cabinets, surveys, reviews). They are served from the app's own
 * origin: a file that a browser runs (a page, an SVG) would run with the session of whoever opens
 * it. Such an answer is given to be saved, in a sandbox, never shown in place; and no answer is
 * taken by the browser for another type than the one it is given as.
 */
const ACTIVE_TYPES = /^\s*(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)\b/i;

module.exports = function servedFiles(req, res, next) {
  const writeHead = res.writeHead;
  // Every answer goes through writeHead, set out by the route or not (Node calls it for those)
  res.writeHead = function (statusCode, ...rest) {
    // Headers given here are set first, to be looked at with the others
    const headers = rest.find((arg) => arg && typeof arg === 'object');
    if (headers) {
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
      rest = rest.filter((arg) => arg !== headers);
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (ACTIVE_TYPES.test(String(res.getHeader('Content-Type') || ''))) {
      const disposition = String(res.getHeader('Content-Disposition') || '');
      if (!/^\s*attachment/i.test(disposition)) res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Content-Security-Policy', 'sandbox');
    }
    return writeHead.call(this, statusCode, ...rest);
  };
  next();
};
