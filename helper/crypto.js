/**
 * <p>Crypto functions for doing repetitive crypto operations. This class is mostly used
 for generating tokens for users and units.</p>
 * <br>
 * Currently using: <b>sha-512</b>
 *
 * @module helper/crypto
 */

const crypto = require('crypto');

const cryptoSettings = {
  method: 'sha512',
  maxStrLength: 100,
  maxLength: 128,
  saltLength: 16,
};

const saltIt = function (salt, data) {
  return salt + data + salt;
};

/**
 * @callback generateHashWithSaltCb
 * @param {Error} err If there is an error
 * @param {String} hashedString The hashed string
 * @param {String} salt The salt used
 */

/**
 * Generates hash with random salt. Used ideally for password
 *
 * @alias module:helper/crypto.generateHashWithSalt
 *
 * @param {String} stringToHash The string to be hashed
 * @param {parseValuesCb} cb The callback function
 */
const generateHashWithSalt = function (stringToHash, cb) {
  if (stringToHash == null) return;
  if (stringToHash.length > cryptoSettings.maxStrLength) {
    return cb(
      {
        err: 'The string you are trying to hash is too large',
      },
      null,
      null
    );
  }

  const salt = crypto.randomBytes(cryptoSettings.saltLength);
  generateHash(saltIt(salt, stringToHash), function (hashedString) {
    cb(null, hashedString, salt);
  });
};

/**
 * @callback generateHashCb
 * @param {String} hashedString The hashed string
 */

/**
 * Generates the hash in hex format. This is though often represented as a String.
 * @param {String} stringToHash
 * @param {generateHashCb} cb The callback function
 */
var generateHash = function (stringToHash, cb) {
  const hashMethod = crypto.createHash(cryptoSettings.method);
  const hash = hashMethod.update(stringToHash);
  return cb(hash.digest('hex'));
};

/**
 * @callback compareHashCb
 * @param {String} hashedString The hashed string
 */

/**
 * Compares a hashedString with another string. This is for example used to compare password with an input.
 * @alias module:helper/crypto.compareHash
 * @param {String} hashedString The hashedstring (often refers to the current password)
 * @param {String} compareValue The value you want to compare it with
 * @param {String} salt The salt used for the hashedString
 * @param {compareHashCb} cb The callback function
 */
const compareHash = function (hashedString, compareValue, salt, cb) {
  generateHash(saltIt(salt, compareValue), function (res) {
    if (res === hashedString) {
      return cb(true);
    }
    return cb(false);
  });
};

/**
 * @callback generateUniqueToken
 * @param {String} token The genereated token
 */

/**
 * This method generates a unique token
 * @alias module:helper/crypto.generateUniqueToken
 * @param {generateUniqueToken} cb The callback function
 */
const generateUniqueToken = function (cb) {
  const date = Date.now();
  generateHashWithSalt(date.toString(), function (err, hashedString, salt) {
    return cb(hashedString);
  });
};

/**
 * Passwords are kept as scrypt hashes: "scrypt$N$r$p$salt$hash" (salt and hash in base64), slow to
 * try one guess after another on, should the database be read. Those kept before as one round of
 * salted SHA-512 still match, and are hashed anew once they have (see models/user.js).
 */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** The hash of the password, to keep. */
function hashPassword(password, cb) {
  const salt = crypto.randomBytes(cryptoSettings.saltLength);
  const { N, r, p, keylen } = SCRYPT;
  crypto.scrypt(String(password), salt, keylen, { N, r, p }, function (err, hash) {
    if (err) return cb(err);
    cb(null, ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$'));
  });
}

/**
 * Whether the password matches the hash kept (with its salt, for a hash of before); old: the hash
 * is of before, to be made anew.
 */
function verifyPassword(stored, salt, candidate, cb) {
  if (typeof stored !== 'string' || typeof candidate !== 'string') return cb(false, false);
  if (!stored.startsWith('scrypt$')) {
    return compareHash(stored, candidate, salt, (match) => cb(match, true));
  }
  const [, N, r, p, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  crypto.scrypt(candidate, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p }, function (err, hash) {
    if (err) return cb(false, false);
    cb(crypto.timingSafeEqual(hash, expected), false);
  });
}

const TOKEN_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A random token of letters and digits, of the length; each letter as likely as any other. */
function randomToken(length) {
  let token = '';
  for (let i = 0; i < length; i++) token += TOKEN_LETTERS[crypto.randomInt(TOKEN_LETTERS.length)];
  return token;
}

module.exports.hashPassword = hashPassword;
module.exports.randomToken = randomToken;
module.exports.verifyPassword = verifyPassword;
module.exports.generateHashWithSalt = generateHashWithSalt;
module.exports.generateUniqueToken = generateUniqueToken;
module.exports.compareHash = compareHash;
module.exports.settings = cryptoSettings;
