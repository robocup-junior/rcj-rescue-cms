const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** Recursively list files under dir whose name ends with ext. */
function listFiles(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out.sort();
}

module.exports = { ROOT, listFiles };
