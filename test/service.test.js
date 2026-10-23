// Public services (no login): the map editors offered to everyone.
// The Simulation world editor keeps the 2025 rules here even though the CMS itself supports 2026 only.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');

const PAGES = [
  '/service',
  '/service/editor/line/2026',
  '/service/editor/line/2026E',
  '/service/editor/maze/2026',
  '/service/editor/maze/2026E',
  '/service/editor/simulation/2025',
  '/service/editor/simulation/2026/classic',
];

test('public service pages render', async (t) => {
  const app = express();
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('view engine', 'pug');
  app.use('/service', require('../routes/service'));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const page of PAGES) {
    const res = await fetch(base + page, { signal: AbortSignal.timeout(10000) });
    assert.strictEqual(res.status, 200, page);
  }
  // Every editor is linked from the service home page
  const home = await (await fetch(`${base}/service`)).text();
  for (const page of ['/service/editor/simulation/2025', '/service/editor/simulation/2026']) {
    assert.ok(home.includes(page), `${page} is linked from /service`);
  }
  // Erebus Editor 2026 has its own site: its address here goes there, and the classic editor links to it
  const moved = await fetch(`${base}/service/editor/simulation/2026`, { redirect: 'manual' });
  assert.strictEqual(moved.status, 302);
  assert.strictEqual(moved.headers.get('location'), 'https://world.erebus.rcj.cloud/');
  const classic = await (await fetch(`${base}/service/editor/simulation/2026/classic`)).text();
  assert.ok(classic.includes('href="https://world.erebus.rcj.cloud/"'), 'the classic editor links to Erebus Editor 2026');
});
