/**
 * The key the session cookies are signed with. SESSION_SECRET when it is set to one of its own;
 * otherwise a key made at random the first time and kept in the database, for every process and
 * every start after it. The key once written in process.env is public: whoever knows the key can
 * make the cookie of any session, so it is not taken.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../config/logger').mainLogger;

const PUBLIC_KEYS = ['rcjscoring'];

async function sessionSecret() {
  const given = process.env.SESSION_SECRET;
  if (given && !PUBLIC_KEYS.includes(given)) return given;
  if (given) logger.warn('SESSION_SECRET is the key published with the app: a key of its own is used instead');

  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
    });
  }
  // Made by whichever process comes first, the others take it
  const settings = mongoose.connection.db.collection('settings');
  const { value } = await settings.findOneAndUpdate(
    { _id: 'sessionSecret' },
    { $setOnInsert: { value: crypto.randomBytes(48).toString('base64') } },
    { upsert: true, returnDocument: 'after' }
  );
  return value.value;
}

module.exports = sessionSecret;
module.exports.PUBLIC_KEYS = PUBLIC_KEYS;
