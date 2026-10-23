const logger = require('../config/logger').mainLogger;

module.exports.findPath = function (map) {
  const tiles = [];
  for (let i = 0; i < map.tiles.length; i++) {
    const tile = map.tiles[i];
    tile.index = [];
    tile.next = [];
    tile.next_dir = [];
    tiles[`${tile.x},${tile.y},${tile.z}`] = tile;
  }

  const startTile =
    tiles[`${map.startTile.x},${map.startTile.y},${map.startTile.z}`];

  let startDir = '';
  const startPaths = startTile.tileType.paths;
  Object.keys(startPaths).forEach(function (dir, index) {
    const nextTile =
      tiles[nextCoord(startTile, rotateDir(dir, startTile.rot))];
    if (nextTile !== undefined) {
      startDir = rotateDir(dir, startTile.rot);
    }
  });

  traverse(startTile, startDir, tiles, map, 0, 0, false);
};

function evacTile(tile) {
  return (
    tile.tileType._id == '58cfd6549792e9313b1610e1' ||
    tile.tileType._id == '58cfd6549792e9313b1610e2' ||
    tile.tileType._id == '58cfd6549792e9313b1610e3'
  );
}

/**
 *
 * @param curTile
 * @param entryDir {
 * @param tiles
 * @param map
 * @param index {Number}
 */
function traverse(curTile, entryDir, tiles, map, index, chpCount, restartFlag) {
  if (curTile.checkPoint) chpCount++;
  let next_Coord = nextCoord(curTile, entryDir);
  curTile.index.push(index);
  map.indexCount = index + 1;
  const nextTile = tiles[next_Coord];

  if (curTile.tileType._id == '58cfd6549792e9313b1610e0') {
    return;
  }

  curTile.next_dir.push(exitDir(curTile, entryDir));
  if (nextTile === undefined || evacTile(nextTile)) {
    if (nextTile) {
      nextTile.evacEntrance = dir2num(flipDir(exitDir(curTile, entryDir)));
    }
    const startTile2 =
      tiles[`${map.startTile2.x},${map.startTile2.y},${map.startTile2.z}`];
    if (!startTile2 || restartFlag) {
      map.EvacuationAreaLoPIndex = chpCount;
      return;
    }
    curTile.next.push(
      `${map.startTile2.x},${map.startTile2.y},${map.startTile2.z}`
    );
    

    let startDir2 = '';
    const startPaths2 = startTile2.tileType.paths;

    for (const [key, value] of Object.entries(startPaths2)) {
      if (key == '$init') continue;
      if (!value) continue;

      const entryDir2 = rotateDir(key, startTile2.rot);
      const fromTile = tiles[fromCoord(startTile2, entryDir2)];
      if (fromTile !== undefined) {
        if (evacTile(fromTile)) {
          fromTile.evacExit = dir2num(flipDir(entryDir2));
          startDir2 = entryDir2;

          break;
        }
      }
    }
    restartFlag = true;
    map.EvacuationAreaLoPIndex = chpCount;

    traverse(
      startTile2,
      startDir2,
      tiles,
      map,
      index + 1,
      chpCount,
      restartFlag
    );
    return;
  }
  curTile.next.push(next_Coord);

  traverse(
    nextTile,
    flipDir(exitDir(curTile, entryDir)),
    tiles,
    map,
    index + 1,
    chpCount,
    restartFlag
  );
}

function exitDir(curTile, entryDir) {
  const dir = rotateDir(entryDir, -curTile.rot);
  return rotateDir(curTile.tileType.paths[dir], curTile.rot);
}

function nextCoord(curTile, entryDir) {
  const exit = exitDir(curTile, entryDir);
  let coord;
  switch (exit) {
    case 'top':
      coord = `${curTile.x},${curTile.y - 1}`;
      break;
    case 'right':
      coord = `${curTile.x + 1},${curTile.y}`;
      break;
    case 'bottom':
      coord = `${curTile.x},${curTile.y + 1}`;
      break;
    case 'left':
      coord = `${curTile.x - 1},${curTile.y}`;
      break;
  }

  if (curTile.levelUp !== undefined && exit == curTile.levelUp) {
    coord += `,${curTile.z + 1}`;
  } else if (curTile.levelDown !== undefined && exit == curTile.levelDown) {
    coord += `,${curTile.z - 1}`;
  } else {
    coord += `,${curTile.z}`;
  }

  return coord;
}

function fromCoord(curTile, fromDir) {
  let coord;
  switch (fromDir) {
    case 'top':
      coord = `${curTile.x},${curTile.y - 1}`;
      break;
    case 'right':
      coord = `${curTile.x + 1},${curTile.y}`;
      break;
    case 'bottom':
      coord = `${curTile.x},${curTile.y + 1}`;
      break;
    case 'left':
      coord = `${curTile.x - 1},${curTile.y}`;
      break;
  }
  coord += `,${curTile.z}`;
  return coord;
}

function rotateDir(dir, rot) {
  switch (rot) {
    case 0:
      return dir;

    case -270:
    case 90:
      switch (dir) {
        case 'top':
          return 'right';
        case 'right':
          return 'bottom';
        case 'bottom':
          return 'left';
        case 'left':
          return 'top';
      }

    case -180:
    case 180:
      return flipDir(dir);

    case -90:
    case 270:
      switch (dir) {
        case 'top':
          return 'left';
        case 'right':
          return 'top';
        case 'bottom':
          return 'right';
        case 'left':
          return 'bottom';
      }
  }
}

function flipDir(dir) {
  switch (dir) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
  }
}

function dir2num(dir) {
  switch (dir) {
    case 'top':
      return 0;
    case 'right':
      return 90;
    case 'bottom':
      return 180;
    case 'left':
      return 270;
  }
}
