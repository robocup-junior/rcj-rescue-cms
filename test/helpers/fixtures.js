// Test data builders shared by the integration tests. Call after db.start().
const competitionDb = require('../../models/competition');
const { lineMap, tileType } = require('../../models/lineMap');

async function createCompetition(name = `comp-${Math.random()}`) {
  return competitionDb.competition.create({
    name,
    leagues: [{ league: 'Maze', rule: '2026' }, { league: 'MazeNL', rule: '2026E' }, { league: 'Line', rule: '2026' }, { league: 'LineNL', rule: '2026E' }],
  });
}

/** Tile types seeded by the line map model, picked by their scoring elements. */
async function lineTileTypes() {
  const [plain, intersection, gap] = await Promise.all([
    tileType.findOne({ gaps: 0, intersections: 0, seesaw: 0 }).lean(),
    tileType.findOne({ intersections: { $gt: 0 } }).lean(),
    tileType.findOne({ gaps: { $gt: 0 }, intersections: 0 }).lean(),
  ]);
  return { plain, intersection, gap };
}

/**
 * Six tiles in a row: start, intersection, gap with an obstacle, checkpoint, ramp, ramp.
 * Inserted directly so the tests control the tile order (index) instead of the path finder.
 */
async function createLineMap(comp, league) {
  const { plain, intersection, gap } = await lineTileTypes();
  const empty = { obstacles: 0, speedbumps: 0, rampPoints: false };
  const { insertedId } = await lineMap.collection.insertOne({
    competition: comp._id, league, name: `line-${league}-${Math.random()}`, tileSet: comp._id, finished: true,
    width: 6, length: 1, height: 1, indexCount: 6, victims: { live: 2, dead: 1 }, EvacuationAreaLoPIndex: 0,
    startTile: { x: 0, y: 0, z: 0 },
    tiles: [
      { x: 0, y: 0, z: 0, rot: 0, tileType: plain._id, index: [0], items: empty },
      { x: 1, y: 0, z: 0, rot: 0, tileType: intersection._id, index: [1], items: empty },
      { x: 2, y: 0, z: 0, rot: 0, tileType: gap._id, index: [2], items: { ...empty, obstacles: 1 } },
      { x: 3, y: 0, z: 0, rot: 0, tileType: plain._id, index: [3], items: empty, checkPoint: true },
      { x: 4, y: 0, z: 0, rot: 0, tileType: plain._id, index: [4], items: { ...empty, rampPoints: true } },
      { x: 5, y: 0, z: 0, rot: 0, tileType: plain._id, index: [5], items: { ...empty, rampPoints: true } },
    ],
  });
  return { id: insertedId, intersections: intersection.intersections };
}

module.exports = { createCompetition, lineTileTypes, createLineMap };
