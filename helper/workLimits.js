/**
 * Limits on the work anyone may give the app without logging in: the PDFs and pictures made of the
 * maps the public map editors send, which take the server a while each. Counted per address (the
 * address of the client, or of what is before the app's proxy: see TRUST_PROXY in process.env).
 */
const RateLimit = require('express-rate-limit');

module.exports = {
  makingFiles: new RateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.FILES_MADE_PER_MINUTE, 10) || 30,
    message: { msg: 'Too many files asked for, please try again later' },
  }),
};
