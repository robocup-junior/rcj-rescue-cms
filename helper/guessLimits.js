/**
 * Limits on guesses: wrong passwords for an account, wrong codes for a league's registration. Only
 * the refused tries count, for a while; once there are too many, the next are refused at once.
 * Counted by what is guessed at, not by the address of who guesses (which a client can give as it
 * likes: the app takes X-Forwarded-For).
 */
const RateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

function limitFailures(max, key) {
  return new RateLimit({
    windowMs: WINDOW_MS,
    max,
    keyGenerator: key,
    skipSuccessfulRequests: true,
    message: { msg: 'Too many failed attempts, please try again later' },
  });
}

module.exports = {
  // Per account
  login: limitFailures(parseInt(process.env.LOGIN_FAILURES_MAX, 10) || 10, (req) => `login:${String(req.body && req.body.username).toLowerCase()}`),
  // Per league open for registration
  registrationCode: limitFailures(20, (req) => `registration:${req.params.competitionId}:${req.params.leagueId}`),
};
