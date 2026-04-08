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
  const MAX_RESCUE_KITS = 8;

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

  // New: track kits per victim (tile coord + side) so we can do 10 for 1 kit, 30 for 2 kits on SAME victim
  let kitsByVictim = {};

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
      PHI: 2,
      PSI: 1,
      OMEGA: 0,
      Red: 2,
      Yellow: 1,
      Green: 0,
    };

    // helper: count valid kits for a single victim (ONLY called when victim is scored)
    function addRescueKitsFor(side, victimType, droppedKits) {
      if (rescueKits >= MAX_RESCUE_KITS) return;

      const max = maxKits[victimType] ?? 0;
      const valid = Math.min(droppedKits, max, MAX_RESCUE_KITS - rescueKits);
      if (valid <= 0) return;

      const victimKey = `${coord}:${side}`;
      if (kitsByVictim[victimKey] == null) kitsByVictim[victimKey] = 0;
      kitsByVictim[victimKey] += valid;

      // total kit count for LoP formula + return value
      rescueKits += valid;
    }

    if (mapTiles[coord].tile.victims.top != 'None') {
    if (mapTiles[coord].tile.victims.top !== 'None') {
      if (tile.scoredItems.victims.top) {
        addVictimCount(victims, mapTiles[coord].tile.victims.top);
        if (isVictimOfTypeLetter(mapTiles[coord].tile.victims.top))
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        addRescueKitsFor('top', mapTiles[coord].tile.victims.top, tile.scoredItems.rescueKits.top);
      }
    }
    if (mapTiles[coord].tile.victims.right !== 'None') {
      if (tile.scoredItems.victims.right) {
        addVictimCount(victims, mapTiles[coord].tile.victims.right);
        if (isVictimOfTypeLetter(mapTiles[coord].tile.victims.right))
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        addRescueKitsFor('right', mapTiles[coord].tile.victims.right, tile.scoredItems.rescueKits.right
        );
      }
    }
    if (mapTiles[coord].tile.victims.bottom !== 'None') {
      if (tile.scoredItems.victims.bottom) {
        addVictimCount(victims, mapTiles[coord].tile.victims.bottom);
        if (isVictimOfTypeLetter(mapTiles[coord].tile.victims.bottom))
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        addRescueKitsFor('bottom', mapTiles[coord].tile.victims.bottom, tile.scoredItems.rescueKits.bottom
        );
      }
    }
    if (mapTiles[coord].tile.victims.left !== 'None') {
      if (tile.scoredItems.victims.left) {
        addVictimCount(victims, mapTiles[coord].tile.victims.left);
        if (isVictimOfTypeLetter(mapTiles[coord].tile.victims.left))
          score += mapTiles[coord].isLinear ? 5 : 15;
        else score += mapTiles[coord].isLinear ? 10 : 30;

        addRescueKitsFor('left', mapTiles[coord].tile.victims.left, tile.scoredItems.rescueKits.left);
      }
    }
  }

  let totalVictimCount = sum(Object.values(victims));

  // - 1 successful kit to the same victim => 10 points
  // - 2 successful kits to the same victim => 30 points
  let kitScore = 0;
  for (const kits of Object.values(kitsByVictim)) {
    const k = Math.min(kits, 2);
    if (k === 1) kitScore += 10;
    else if (k === 2) kitScore += 30;
  }
  score += kitScore;

  score += Math.max((totalVictimCount + Math.min(rescueKits, MAX_RESCUE_KITS) - run.LoPs) * 10, 0);

  if (run.exitBonus) {
    score += totalVictimCount * 10;
  }

  score -= Math.min(run.misidentification * 5, score);

  return {
    score: score,
    victims: convert(victims),
    kits: Math.min(rescueKits, MAX_RESCUE_KITS),
  };
};

/**
 * Returns whether the given victimType is a letter victim (in contrast to cognitive victims)
 *
 * @param {string} victimType
 */
function isVictimOfTypeLetter(victimType)
{
  return ["PHI", "PSI", "OMEGA"].includes(victimType);
}

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
}