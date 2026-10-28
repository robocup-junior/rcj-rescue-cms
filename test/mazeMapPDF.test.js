// The printable targets of a maze map: the cognitive targets (and letter victims) at their real size,
// lettered as on the map, with their status.
const test = require('node:test');
const assert = require('node:assert');
const { PassThrough } = require('stream');

const mazeMapPDF = require('../helper/mazeMapPDF');
const { COLORS } = require('../public/javascripts/cognitive_target');
const { pdfFillColours } = require('./helpers/files');

const NO_VICTIMS = { top: 'None', right: 'None', bottom: 'None', left: 'None', floor: 'None' };
const target = (code) => ({ rings: { ring1: code[0], ring2: code[1], ring3: code[2], ring4: code[3], ring5: code[4] } });

/** Three tiles in a row; victims are lettered from the top left, then top, left, right, bottom on a tile. */
function map() {
  return {
    name: 'targets',
    cells: [
      { x: 1, y: 1, z: 0, isTile: true, tile: { victims: { ...NO_VICTIMS, top: 'PHI', left: 'Cognitive' }, cognitiveTargets: { left: target('GGYYY') } } },
      { x: 3, y: 1, z: 0, isTile: true, tile: { victims: NO_VICTIMS } },
      { x: 5, y: 1, z: 0, isTile: true, tile: { victims: { ...NO_VICTIMS, bottom: 'Cognitive', right: 'OMEGA' }, cognitiveTargets: { bottom: target('KKKKR') } } },
    ],
  };
}

test('the cognitive targets are taken in the order of their letters, each with its colours', () => {
  const targets = mazeMapPDF.extractCognitiveTargets(map());
  assert.deepStrictEqual(targets, [
    { type: 'Cognitive', colorCode: 'GGYYY', victimLetter: 'B' },
    { type: 'Cognitive', colorCode: 'KKKKR', victimLetter: 'D' },
  ]);
});

test('the letter victims are taken as well when asked, and the cognitive targets may be left out', () => {
  const all = mazeMapPDF.extractCognitiveTargets(map(), true);
  assert.deepStrictEqual(all.map((t) => [t.victimLetter, t.colorCode || t.victimType]), [['A', 'PHI'], ['B', 'GGYYY'], ['C', 'OMEGA'], ['D', 'KKKKR']]);
  const letters = mazeMapPDF.extractCognitiveTargets(map(), true, false);
  assert.deepStrictEqual(letters.map((t) => t.victimType), ['PHI', 'OMEGA']);
});

test('a cognitive target without its rings is not printed', () => {
  const m = map();
  delete m.cells[0].tile.cognitiveTargets;
  assert.deepStrictEqual(mazeMapPDF.extractCognitiveTargets(m).map((t) => t.colorCode), ['KKKKR']);
});

/** The PDF sent for the map, as a response would get it. */
function sendPDF(m, ...args) {
  return new Promise((resolve, reject) => {
    const res = new PassThrough();
    const chunks = [];
    res.headers = {};
    res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => resolve({ status: res.statusCode, body });
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve({ status: 200, headers: res.headers, pdf: Buffer.concat(chunks) }));
    res.on('error', reject);
    mazeMapPDF.generateAndSendPDF(res, m, ...args);
  });
}

test('the targets are drawn as circles in their own colours', async (t) => {
  t.mock.method(console, 'log', () => {});
  const { headers, pdf } = await sendPDF(map());
  assert.strictEqual(headers['content-type'], 'application/pdf');
  assert.strictEqual(pdf.subarray(0, 4).toString(), '%PDF');
  const colours = pdfFillColours(pdf);
  for (const c of 'GYKR') assert.ok(colours.has(COLORS[c]), `${c} (${COLORS[c]}) in ${[...colours]}`);
  // No ring is blue
  assert.ok(!colours.has(COLORS.B));
});

test('a map without targets gets a 404', async (t) => {
  t.mock.method(console, 'log', () => {});
  const { status } = await sendPDF({ name: 'none', cells: [{ x: 1, y: 1, z: 0, isTile: true, tile: { victims: NO_VICTIMS } }] });
  assert.strictEqual(status, 404);
});
