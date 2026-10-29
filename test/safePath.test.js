// The paths the API makes of what requests give stay in their folders.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const safePath = require('../helper/safePath');

const ROOT = path.join(__dirname, '..');

test('a path is made in its folder of the parts given', () => {
  assert.strictEqual(safePath('documents', 'abc', 'def', 'file.pdf'), path.join(ROOT, 'documents', 'abc', 'def', 'file.pdf'));
  assert.strictEqual(safePath('templates', 'mail'), path.join(ROOT, 'templates', 'mail'));
  // ids as they come from the database
  assert.strictEqual(safePath('cabinet', { toString: () => 'id1' }, 'Maze'), path.join(ROOT, 'cabinet', 'id1', 'Maze'));
  // Within the folder, a part that goes up and back is fine
  assert.strictEqual(safePath('documents', 'a/../b'), path.join(ROOT, 'documents', 'b'));
});

test('a path that would come out of its folder is one in it that nothing is at', () => {
  const outside = path.join(ROOT, 'documents', '.outside-of-the-folder');
  for (const parts of [['..', 'process.env'], ['abc', '../../app.js'], ['/etc/passwd'], ['abc', '..', '..', '..', 'x']]) {
    assert.strictEqual(safePath('documents', ...parts), outside, parts.join('/'));
  }
  // A folder of the same beginning is not the folder
  assert.strictEqual(safePath('documents', '../documents-old/x'), outside);
});
