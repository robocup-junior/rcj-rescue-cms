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
    let multiplier = 1.0;

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
          case 'seesaw':
            score += 20 * tile.scoredItems[j].scored * tile.scoredItems[j].count;
            break;
        }
      }
    }
    

    let error = 1;
    if (run.rescueOrder) {
      let liveCount = 0;
      for (let victim of run.rescueOrder) {
        if (victim.victimType == "LIVE" && victim.zoneType == "RED") continue;
        if (victim.victimType == "DEAD" && victim.zoneType == "GREEN") continue;
        if (victim.victimType == "DEAD" && liveCount != run.map.victims.live) continue;

        multiplier *= Math.max(1400-(50*run.LoPs[run.map.EvacuationAreaLoPIndex]),1250);
        
        error *= 1000;
        if (victim.victimType == "LIVE") liveCount ++;
      }
      multiplier /= error;
    }

    if (run.exitBonus) {
      score += Math.max(60 - 5 * total_lops, 0);
      const tileCount = run.tiles.length - lastCheckPointTile - 1;
      score += Math.max(tileCount * (5 - 2 * run.LoPs[checkPointCount]), 0)
    }

    // 5 points for placing robot on first droptile (start)
    // Implicit showedUp if anything else is scored
    if (run.showedUp || score > 0) {
      score += 5;
    }

    final_score = Math.round(score * multiplier);

    const ret = {};
    ret.raw_score = score;
    ret.score = final_score;
    ret.multiplier = multiplier;
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
  let rescueKits = 0;

  for (let i = 0; i < run.tiles.length; i++) {
    const tile = run.tiles[i];
    const coord = `${tile.x},${tile.y},${tile.z}`;

    if (tile.scoredItems.speedbump && mapTiles[coord].tile.speedbump) {
      score += 5;
    }
    if (tile.scoredItems.checkpoint && mapTiles[coord].tile.checkpoint) {
      score += 10;
    }
    if (tile.scoredItems.ramp && mapTiles[coord].tile.ramp) {
      score += 10;
    }
    if (tile.scoredItems.steps && mapTiles[coord].tile.steps) {
      score += 10;
    }

    const maxKits = {
      H: 2,
      S: 1,
      U: 0,
      Red: 2,
      Yellow: 1,
      Green: 0,
    };

    if (mapTiles[coord].tile.victims.top != 'None') {
      if (tile.scoredItems.victims.top) {
        addVictimCount(victims, mapTiles[coord].tile.victims.top);
        if (
          mapTiles[coord].tile.victims.top == 'Red' ||
          mapTiles[coord].tile.victims.top == 'Yellow' ||
          mapTiles[coord].tile.victims.top == 'Green'
        )
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        rescueKits += Math.min(
          tile.scoredItems.rescueKits.top,
          maxKits[mapTiles[coord].tile.victims.top]
        );
      }
    }
    if (mapTiles[coord].tile.victims.right != 'None') {
      if (tile.scoredItems.victims.right) {
        addVictimCount(victims, mapTiles[coord].tile.victims.right);
        if (
          mapTiles[coord].tile.victims.right == 'Red' ||
          mapTiles[coord].tile.victims.right == 'Yellow' ||
          mapTiles[coord].tile.victims.right == 'Green'
        )
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        rescueKits += Math.min(
          tile.scoredItems.rescueKits.right,
          maxKits[mapTiles[coord].tile.victims.right]
        );
      }
    }
    if (mapTiles[coord].tile.victims.bottom != 'None') {
      if (tile.scoredItems.victims.bottom) {
        addVictimCount(victims, mapTiles[coord].tile.victims.bottom);
        if (
          mapTiles[coord].tile.victims.bottom == 'Red' ||
          mapTiles[coord].tile.victims.bottom == 'Yellow' ||
          mapTiles[coord].tile.victims.bottom == 'Green'
        )
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        rescueKits += Math.min(
          tile.scoredItems.rescueKits.bottom,
          maxKits[mapTiles[coord].tile.victims.bottom]
        );
      }
    }
    if (mapTiles[coord].tile.victims.left != 'None') {
      if (tile.scoredItems.victims.left) {
        addVictimCount(victims, mapTiles[coord].tile.victims.left);
        if (
          mapTiles[coord].tile.victims.left == 'Red' ||
          mapTiles[coord].tile.victims.left == 'Yellow' ||
          mapTiles[coord].tile.victims.left == 'Green'
        )
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        rescueKits += Math.min(
          tile.scoredItems.rescueKits.left,
          maxKits[mapTiles[coord].tile.victims.left]
        );
      }
    }
  }

  let totalVictimCount = sum(Object.values(victims));

  score += Math.min(rescueKits, 12) * 10;

  score += Math.max((totalVictimCount + Math.min(rescueKits, 12) - run.LoPs) * 10, 0);

  if (run.exitBonus) {
    score += totalVictimCount * 10;
  }

  score -= Math.min(run.misidentification * 5, score);

  return {
    score: score,
    victims: convert(victims),
    kits: Math.min(rescueKits, 12)
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