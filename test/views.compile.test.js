// Every Pug template must compile (syntax, indentation, extends/include targets).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const { ROOT, listFiles } = require('./helpers/files');

const VIEWS = path.join(ROOT, 'views');

// Routes for features whose templates were removed long ago (kiosk, interview, application).
// They are listed so the check below still catches any newly missing template.
const KNOWN_MISSING_RENDERS = new Set([
  'routes/admin.js -> application_admin',
  'routes/admin.js -> kiosk',
  'routes/document.js -> do_interview',
  'routes/document.js -> pub_interview',
  'routes/document.js -> view_interview',
  'routes/kiosk.js -> line_apTeam',
  'routes/kiosk.js -> maze_apTeam',
  'routes/kiosk.js -> kiosk_home',
]);

for (const file of listFiles(VIEWS, '.pug')) {
  const rel = path.relative(ROOT, file);
  test(`compiles ${rel}`, () => {
    assert.doesNotThrow(() => pug.compileFile(file, { basedir: VIEWS }));
  });
}

test('every literal res.render() target in routes exists', () => {
  const missing = [];
  for (const file of listFiles(path.join(ROOT, 'routes'), '.js')) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/res\.render\(\s*(['"])([^'"]+)\1/g)) {
      const view = path.join(VIEWS, `${m[2]}.pug`);
      const ref = `${path.relative(ROOT, file)} -> ${m[2]}`;
      if (!fs.existsSync(view) && !KNOWN_MISSING_RENDERS.has(ref)) missing.push(ref);
    }
  }
  assert.deepStrictEqual(missing, []);
});
