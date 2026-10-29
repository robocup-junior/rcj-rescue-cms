/**
 * The path of a file of the app's folders (documents, cabinet, backup...), made of parts the
 * requests give: only ever in the folder. Every path the API makes of what a request gives is made
 * here. A path that would come out of the folder (a part with ../ in it, or one that is a path of
 * its own) is not given: one in the folder that nothing is at is, and it is logged. (Not thrown:
 * the paths are made in the callbacks of the database too, where a throw would stop the app.)
 */
const path = require('path');
const logger = require('../config/logger').mainLogger;

const ROOT = path.join(__dirname, '..');
const OUTSIDE = '.outside-of-the-folder';

function safePath(folder, ...parts) {
  const base = path.resolve(ROOT, folder);
  const full = path.resolve(base, ...parts.map((part) => String(part)));
  if (full === base || full.startsWith(base + path.sep)) return full;
  logger.error(`A path out of ${folder} was asked for: ${parts.join('/')}`);
  return path.join(base, OUTSIDE);
}

module.exports = safePath;
