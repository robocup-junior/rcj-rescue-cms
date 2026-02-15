const logger = require('../../config/logger').mainLogger;

/**
 *
 * @param run Must be populated with map and tiletypes!
 * @returns {number}
 */
module.exports.calculateLineScore = function (run) {
  try {
    let score = 0;
    let final_score;

    let lastCheckPointTile = 0;
    let checkPointCount = 0;

    let total_lops = 0;
    for (let i = 0; i < run.LoPs.length; i++) {
      total_lops += run.LoPs[i];
    }

    for (let i = 0; i < run.tiles.length; i++) {
      const tile = run.tiles[i];
      for (let j = 0; j < tile.scoredItems.length; j++) {
        switch (tile.scoredItems[j].item) {
          case 'checkpoint':
            const tileCount = i - lastCheckPointTile;
            score +=
              Math.max(tileCount * (5 - 2 * run.LoPs[checkPointCount]), 0) *
              tile.scoredItems[j].scored;
            lastCheckPointTile = i;
            checkPointCount++;
            break;
          case 'gap':
            score += 10 * tile.scoredItems[j].scored;
            break;
          case 'intersection':
            score += 10 * tile.scoredItems[j].scored * tile.scoredItems[j].count;
            break;
          case 'obstacle':
            score += 20 * tile.scoredItems[j].scored * tile.scoredItems[j].count;
            break;
          case 'speedbump':
            score += 10 * tile.scoredItems[j].scored;
            break;
          case 'ramp':
            score += 10 * tile.scoredItems[j].scored * tile.scoredItems[j].count;
            break;
        }
      }
    }
    
    if (run.exitBonus) {
      score += 30;
    }

    // 5 points for placing robot on first droptile (start)
    // Implicit showedUp if anything else is scored
    if (run.showedUp || score > 0) {
      score += 5;
    }

    final_score = score;

    for (let victim of run.nl.liveVictim) {
      if (victim.found) final_score += 10
      if (victim.identified) final_score += 20
    }
    for (let victim of run.nl.deadVictim) {
      if (victim.found) final_score += 10
      if (victim.identified) final_score += 10
    }

    const ret = {};
    ret.raw_score = score;
    ret.score = final_score;
    ret.multiplier = 1.0;
    return ret;
  } catch (e) {
    console.log(e);
  }
};

/**
 *
 * @param run Must be populated with map!
 * @returns {number}
 */

module.exports.calculateMazeScore = function (run) {
  let score = 0;

  const mapTiles = [];
  for (let i = 0; i < run.map.cells.length; i++) {
    const cell = run.map.cells[i];
    if (cell.isTile) {
      mapTiles[`${cell.x},${cell.y},${cell.z}`] = cell;
    }
  }

  let victims = {};

  for (let i = 0; i < run.tiles.length; i++) {
    const tile = run.tiles[i];
    const coord = `${tile.x},${tile.y},${tile.z}`;

    if (tile.scoredItems.speedbump && mapTiles[coord].tile.speedbump) {
      score += 5;
    }
    if (tile.scoredItems.checkpoint && mapTiles[coord].tile.checkpoint) {
      score += 10;
    }

    if (mapTiles[coord].tile.victims.floor != 'None') {
      if (tile.scoredItems.victims.floor) {
        score += mapTiles[coord].isLinear ? 15 : 30;

        if (tile.scoredItems.rescueKits.floor > 0) {
          score += 10;
          addVictimCount(victims, mapTiles[coord].tile.victims.floor);
        } else {
          addVictimCount(victims, "Unknown");
        }
      }
    }
  }

  let totalVictimCount = sum(Object.values(victims));

  score += Math.max((totalVictimCount * 10)  - (run.LoPs * 5), 0);

  if (run.exitBonus) {
    score += totalVictimCount * 10;
  }

  score -= Math.min(run.misidentification*5,score);

  return {
    score: score,
    victims: convert(victims)
  }
};

function addVictimCount(obj, type) {
  if (obj[type] == null) obj[type] = 0;
  obj[type] ++;
}

function sum(array) {
  if (array.length == 0) return 0;
  return array.reduce(function(a,b){
    return a + b;
  });
}

function convert(obj) {
  return Object.entries(obj).map(o => {
    return {
      'type': o[0],
      'count': o[1]
    }
  })
}