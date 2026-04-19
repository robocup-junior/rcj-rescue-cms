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
    generateHashWithSalt(date.toString(), function (err, hashedString) {
        return cb(hashedString);
    });
};

module.exports.generateHashWithSalt = generateHashWithSalt;
module.exports.generateUniqueToken = generateUniqueToken;
module.exports.compareHash = compareHash;
module.exports.settings = cryptoSettings;
