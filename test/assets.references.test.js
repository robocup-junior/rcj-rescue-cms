// Static assets referenced from templates and client scripts must exist in public/.
// Bower components (/components/...) are installed separately and are not checked here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT, listFiles } = require('./helpers/files');

const PUBLIC = path.join(ROOT, 'public');
const ASSET_PREFIX = /^\/(javascripts|stylesheets|templates|images|sounds)\//;

function missingAssets(files, pattern) {
  const missing = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(pattern)) {
      const ref = m[1].split('?')[0];
      // Skip references that are built at runtime ({{ }}, #{ }, ${ })
      if (!ASSET_PREFIX.test(ref) || /[{}$]/.test(ref)) continue;
      if (!fs.existsSync(path.join(PUBLIC, ref))) missing.push(`${path.relative(ROOT, file)} -> ${ref}`);
    }
  }
  return [...new Set(missing)];
}

test('templates reference existing static assets', () => {
  const files = listFiles(path.join(ROOT, 'views'), '.pug');
  assert.deepStrictEqual(missingAssets(files, /(?:src|href)\s*=\s*['"]([^'"]+)['"]/g), []);
});

test('client scripts reference existing modal templates', () => {
  const files = listFiles(path.join(PUBLIC, 'javascripts'), '.js');
  assert.deepStrictEqual(missingAssets(files, /templateUrl\s*:\s*['"]([^'"]+)['"]/g), []);
});
