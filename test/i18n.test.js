// Translation files must be valid JSON and define the same keys,
// otherwise one language shows raw keys such as "admin.users.title".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers/files');

const LANG_DIR = path.join(ROOT, 'public', 'lang');

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' ? flatten(value, name) : [name];
  });
}

const langs = Object.fromEntries(
  fs.readdirSync(LANG_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(fs.readFileSync(path.join(LANG_DIR, f), 'utf8'))])
);

test('English and Japanese define the same keys', () => {
  const en = new Set(flatten(langs['en.json']));
  const ja = new Set(flatten(langs['ja.json']));
  assert.deepStrictEqual([...ja].filter((k) => !en.has(k)), [], 'keys missing in en.json');
  assert.deepStrictEqual([...en].filter((k) => !ja.has(k)), [], 'keys missing in ja.json');
});

test('"@:" references point to existing keys', () => {
  for (const [file, data] of Object.entries(langs)) {
    const keys = new Set(flatten(data));
    const broken = [];
    const walk = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object') walk(value, name);
        else if (typeof value === 'string' && value.startsWith('@:') && !keys.has(value.slice(2))) broken.push(`${name} -> ${value}`);
      }
    };
    walk(data);
    assert.deepStrictEqual(broken, [], file);
  }
});
