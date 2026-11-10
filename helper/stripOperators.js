/**
 * Express middleware: takes out of what a request gives (its body and query) every key that starts
 * with $, the operators of MongoDB queries and updates. A value given where the app takes a name,
 * an id or a code would otherwise be taken by the database as a query ({"$ne": ""}, matching any).
 * Nothing the app's pages send has such keys, but Angular's own $$hashKey, of no use here.
 */
function strip(value) {
  if (Array.isArray(value)) value.forEach(strip);
  else if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$')) delete value[key];
      else strip(value[key]);
    }
  }
  return value;
}

module.exports = function stripOperators(req, res, next) {
  strip(req.body);
  strip(req.query);
  next();
};
module.exports.strip = strip;
