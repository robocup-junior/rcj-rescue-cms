// Linear / floating detection used by the Maze map editors.
// Victims next to linear walls score less than floating ones, so this decides scores directly.
//
// Maps are drawn as text: every character is one cell of the editor grid (x = column, y = row).
// '-' and '|' are walls, 'S' the start tile, 'B' a black tile, '+' and ' ' are nothing.
// Results are compared per tile row: 'L' linear, '.' floating.
const test = require('node:test');
const assert = require('node:assert');
const MazeLinear = require('../public/javascripts/admin/mapEditor/mazeLinear');

function parseMap(floors) {
  const cells = {};
  let startTile = { x: 0, y: 0, z: 0 };
  const rows0 = floors[0];
  const width = (rows0[0].length - 1) / 2;
  const length = (rows0.length - 1) / 2;
  floors.forEach((rows, z) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '-' || ch === '|') cells[`${x},${y},${z}`] = { isWall: true };
      });
    });
    for (let y = 1; y < 2 * length; y += 2) {
      for (let x = 1; x < 2 * width; x += 2) {
        const ch = rows[y][x];
        cells[`${x},${y},${z}`] = { isTile: true, tile: { black: ch === 'B', changeFloorTo: z } };
        if (ch === 'S') startTile = { x, y, z };
      }
    }
  });
  return { cells, startTile, width, length, height: floors.length };
}

function recalculate(floors, edit = () => {}) {
  const state = parseMap(floors);
  edit(state);
  MazeLinear.recalculate(state);
  return state;
}

/** One string per tile row of floor z: 'L' linear, '.' floating. */
function linearRows(state, z = 0) {
  const rows = [];
  for (let y = 1; y < 2 * state.length; y += 2) {
    let row = '';
    for (let x = 1; x < 2 * state.width; x += 2) row += state.cells[`${x},${y},${z}`].isLinear ? 'L' : '.';
    rows.push(row);
  }
  return rows;
}

const OPEN_5x5 = [
  '+-+-+-+-+-+',
  '|S        |',
  '+ + + + + +',
  '|         |',
  '+ + + + + +',
  '|         |',
  '+ + + + + +',
  '|         |',
  '+ + + + + +',
  '|         |',
  '+-+-+-+-+-+',
];

test('tiles along the outer wall are linear, the middle is floating', () => {
  // The start tile counts as surrounded by walls, which also makes its diagonal neighbour linear
  assert.deepStrictEqual(linearRows(recalculate([OPEN_5x5])), [
    'LLLLL',
    'LL..L',
    'L...L',
    'L...L',
    'LLLLL',
  ]);
});

test('walls connected to the outer wall make the tiles next to them linear', () => {
  const map = [
    '+-+-+-+-+-+',
    '|S  |     |',
    '+ + + + + +',
    '|   |     |',
    '+ + +-+ + +',
    '|         |',
    '+ + + + + +',
    '|         |',
    '+ + + + + +',
    '|         |',
    '+-+-+-+-+-+',
  ];
  const state = recalculate([map]);
  assert.deepStrictEqual(linearRows(state), [
    'LLLLL',
    'LLLLL',
    'LLLLL',
    'L...L',
    'LLLLL',
  ]);
  assert.strictEqual(state.cells['5,4,0'].isLinear, true);
});

test('walls that do not touch the outer wall stay floating', () => {
  const map = [
    '+-+-+-+-+-+',
    '|S        |',
    '+ + + + + +',
    '|         |',
    '+ + + + + +',
    '|   |     |',
    '+ + +-+ + +',
    '|         |',
    '+ + + + + +',
    '|         |',
    '+-+-+-+-+-+',
  ];
  const state = recalculate([map]);
  assert.deepStrictEqual(linearRows(state), linearRows(recalculate([OPEN_5x5])));
  assert.strictEqual(state.cells['4,5,0'].isLinear, false);
  assert.strictEqual(state.cells['5,6,0'].isLinear, false);
});

test('a black tile counts as walled, so it extends the linear area', () => {
  const map = [...OPEN_5x5];
  map[1] = '|S   B    |';
  assert.deepStrictEqual(linearRows(recalculate([map])), [
    'LLLLL',
    'LLLLL',
    'L...L',
    'L...L',
    'LLLLL',
  ]);
});

test('tiles closed off by walls are not reachable', () => {
  const map = [...OPEN_5x5];
  map[8] = '+ + + + +-+';
  map[9] = '|       | |';
  const state = recalculate([map]);
  assert.strictEqual(state.cells['9,9,0'].tile.reachable, false);
  assert.strictEqual(state.cells['7,9,0'].tile.reachable, true);
});

test('an elevator makes the other floor reachable', () => {
  const floor = [
    '+-+-+',
    '|S  |',
    '+-+-+',
  ];
  const upper = [
    '+-+-+',
    '|   |',
    '+-+-+',
  ];
  const state = recalculate([floor, upper], (s) => {
    s.cells['3,1,0'].tile.changeFloorTo = 1;
    s.cells['3,1,1'].tile.changeFloorTo = 0;
  });
  assert.strictEqual(state.cells['1,1,1'].tile.reachable, true);

  const noElevator = recalculate([floor, upper]);
  assert.strictEqual(noElevator.cells['1,1,1'].tile.reachable, false);
});

test('nothing is calculated before a start tile is set', () => {
  const state = parseMap([OPEN_5x5]);
  state.startTile = { x: 0, y: 0, z: 0 };
  state.cells['1,0,0'].isLinear = 'untouched';
  MazeLinear.recalculate(state);
  assert.strictEqual(state.cells['1,0,0'].isLinear, 'untouched');
});
