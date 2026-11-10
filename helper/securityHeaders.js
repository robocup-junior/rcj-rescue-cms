/**
 * Express middleware: the headers that keep the browser on the app's side.
 * - Referrer-Policy: the teams' pages have their tokens in their URLs, which a link followed to
 *   another site would give it;
 * - X-Frame-Options: no page of the app in a frame of another site (to be clicked on unseen), but
 *   the views made for it (.../iframe);
 * - Permissions-Policy: the camera for the QR scanner, nothing else of the device;
 * - Strict-Transport-Security, when the app is served over https (CMS_PROTOCOL).
 */
const HTTPS = process.env.CMS_PROTOCOL === 'https';

module.exports = function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (!/\/iframe\/?$/.test(req.path)) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  if (HTTPS) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
};
