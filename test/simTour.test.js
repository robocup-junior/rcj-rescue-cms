// Erebus Editor 2026's guide: the tour of the screen, the lesson and the room 4 part have their texts,
// light up parts that are in the pages, and place their card beside what it is about, in the window.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../public/javascripts/sim_editor_beta/tour.js');

const lang = (l) => JSON.parse(fs.readFileSync(path.join(__dirname, `../public/lang/${l}.json`), 'utf8')).admin.simBeta;
const page = fs.readFileSync(path.join(__dirname, '../views/sim_editor/sim_editor_beta_2026.pug'), 'utf8');
const creator = fs.readFileSync(path.join(__dirname, '../public/templates/sim_editor/custom_room_4_modal.2026.html'), 'utf8');

test('every step has a title and a text in Japanese and English, a lesson step with a goal says what to do', () => {
  for (const l of ['ja', 'en']) {
    const d = lang(l);
    for (const s of T.STEPS) assert.ok(d.tour[s.id] && d.tour[s.id].title && d.tour[s.id].body, `${l}: tour ${s.id}`);
    for (const s of T.LESSON) {
      const x = d.lesson[s.id];
      assert.ok(x && x.title && x.body, `${l}: lesson ${s.id}`);
      assert.strictEqual(!!x.task, !!s.goal, `${l}: lesson ${s.id} has a task when it has a goal`);
      if (s.goal) assert.ok(s.auto, `${s.id} can be done for you`);
    }
    for (const c of T.CHAPTERS.concat(T.LESSON_CHAPTERS)) assert.ok(d.tour.chapters[c], `${l}: chapter ${c}`);
  }
});

test('the guide talks about this editor only', () => {
  for (const l of ['ja', 'en']) {
    const text = JSON.stringify([lang(l).tour, lang(l).lesson]);
    for (const word of ['今までのエディタ', 'classic', 'preset', 'プリセット', 'β']) assert.ok(!text.includes(word), `${l}: ${word}`);
  }
});

test('the parts the steps light up are in the pages', () => {
  const sels = new Set();
  for (const s of T.STEPS.concat(T.LESSON)) for (const sel of [s.target, ...(s.mark || [])].filter(Boolean)) sels.add(sel);
  for (const sel of sels) {
    const m = sel.match(/data-tool="([a-z]+)"/);
    const where = sel.includes('sim-r4') ? creator : page;
    if (m) assert.ok(where.includes('data-tool='), sel);
    else for (const part of sel.split(/\s+/)) {
      const name = part.replace(/^[.#]/, '').split(/[.[]/)[0];
      assert.ok(where.includes(name), sel);
    }
  }
});

test('the steps are in chapter order; the tour starts with its welcome and ends at the guide button', () => {
  const inOrder = (steps, chapters) => {
    const order = steps.map((s) => chapters.indexOf(s.chapter));
    assert.ok(order.every((v) => v >= 0));
    assert.deepStrictEqual(order, [...order].sort((a, b) => a - b));
  };
  inOrder(T.STEPS, T.CHAPTERS);
  inOrder(T.LESSON, T.LESSON_CHAPTERS);
  assert.strictEqual(T.STEPS[0].id, 'welcome');
  assert.strictEqual(T.STEPS[T.STEPS.length - 1].target, '.sbx-tour-btn');
  assert.ok(T.ROOM4.every((s) => s.creator));
  // the room 4 part to look at only: the same steps, with nothing to do
  assert.deepStrictEqual(T.ROOM4_TOUR.map((s) => s.id), T.ROOM4.filter((s) => !s.lessonOnly).map((s) => s.id));
  assert.ok(T.ROOM4_TOUR.every((s) => !s.goal && !s.auto && !s.state && !s.enter));
});

test('the card goes beside the part, below it for the top bar, else over it; always in the window', () => {
  const vw = 1600, vh = 1000, cw = 380, ch = 300;
  const inWindow = (a) => a.left >= 0 && a.top >= 0 && a.left + cw <= vw && a.top + ch <= vh;
  const panel = { left: 52, top: 50, right: 322, bottom: 970 };
  let at = T.place(panel, cw, ch, vw, vh);
  assert.strictEqual(at.side, 'right');
  assert.ok(at.left >= panel.right && inWindow(at));
  const exportBtn = { left: 1450, top: 6, right: 1520, bottom: 44 };
  at = T.place(exportBtn, cw, ch, vw, vh, 'below');
  assert.strictEqual(at.side, 'below');
  assert.ok(at.top >= exportBtn.bottom && inWindow(at), JSON.stringify(at));
  const stage = { left: 330, top: 50, right: 1596, bottom: 970 };
  at = T.place(stage, cw, ch, vw, vh);
  assert.strictEqual(at.side, 'inside');
  assert.ok(inWindow(at));
  at = T.place(null, cw, ch, vw, vh);
  assert.strictEqual(at.side, 'centre');
});

test('the card keeps clear of the parts to avoid when it can', () => {
  const r = { left: 600, top: 300, right: 700, bottom: 400 };
  const right = { left: 714, top: 0, right: 1200, bottom: 1000 };
  const at = T.place(r, 300, 200, 1600, 1000, null, [right]);
  assert.strictEqual(at.side, 'left');
});

test('a lit part is grown a little, but kept inside the window', () => {
  const r = T.pad({ left: 1, top: 30, right: 798, bottom: 60 }, 6, 800, 600);
  assert.deepStrictEqual([r.left, r.top, r.right, r.bottom], [2, 24, 798, 66]);
});
