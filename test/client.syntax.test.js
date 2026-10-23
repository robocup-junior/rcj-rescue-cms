// Client-side scripts must at least parse; a syntax error breaks the whole page.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, listFiles } = require('./helpers/files');

for (const file of listFiles(path.join(ROOT, 'public', 'javascripts'), '.js')) {
  const rel = path.relative(ROOT, file);
  test(`parses ${rel}`, () => {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: rel }));
  });
}
