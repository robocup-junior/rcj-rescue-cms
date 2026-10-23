// Every rule listed in leagues.json must have the files the routes render for it.
// This guards against adding/removing a rule set and forgetting one of its pages.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers/files');

const leagues = require('../leagues.json');

const VIEWS_BY_TYPE = {
  line: ['judge', 'sign', 'view', 'view_iframe', 'ranking', 'signage/ranking', 'admin/gamesPrint', 'admin/rankingPrint', 'admin/mapEditor'],
  maze: ['judge', 'sign', 'view', 'view_iframe', 'ranking', 'signage/ranking', 'admin/gamesPrint', 'admin/rankingPrint', 'admin/mapEditor'],
  simulation: ['judge', 'sign', 'view', 'ranking', 'admin/gamesPrint', 'admin/rankingPrint'],
};
// Manual input is only provided for the standard (non-Entry) rules
const MANUAL_VIEWS = ['manual/input', 'manual/check'];

const ruleSets = [];
for (const league of leagues) {
  for (const rule of league.rules) {
    if (!ruleSets.some((r) => r.type === league.type && r.rule === rule)) ruleSets.push({ type: league.type, rule });
  }
}

for (const { type, rule } of ruleSets) {
  test(`${type} ${rule}: views exist`, () => {
    const expected = [...VIEWS_BY_TYPE[type]];
    if (type !== 'simulation' && !rule.endsWith('E')) expected.push(...MANUAL_VIEWS);
    const missing = expected.filter((dir) => !fs.existsSync(path.join(ROOT, 'views', dir, `${type}_${rule}.pug`)));
    assert.deepStrictEqual(missing, []);
  });

  test(`${type} ${rule}: score calculator exists`, () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'helper', 'scoreCalculatorRules', `${rule}.js`)));
  });
}
