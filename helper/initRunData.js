const logger = require('../config/logger').mainLogger;
const { lineMap } = require('../models/lineMap');

module.exports.initLine = async function (run, rule, scored = false) {
  if (run.started) return null;

  const query = lineMap.findById(run.map);
  query.populate('tiles.tileType', '-__v');

  let map = await query.lean().exec();
  
  if (map) {
    let checkPointCount = 0;
    // Init tile data  
    run.tiles = new Array(map.indexCount).fill().map(() => ({
      scoredItems: []
    }));

    for (let m of map.tiles) {
      for (let i of m.index) {
        // Obstacle
        if (m.items.obstacles > 0) {
          run.tiles[i].scoredItems.push({
            item: "obstacle",
            scored: scored,
            count: m.items.obstacles
          })
        }

        // Speedbump
        if (m.items.speedbumps > 0) {
          run.tiles[i].scoredItems.push({
            item: "speedbump",
            scored: scored,
            count: m.items.speedbumps
          })
        }

        // Gap
        if (m.tileType.gaps > 0) {
          run.tiles[i].scoredItems.push({
            item: "gap",
            scored: scored,
            count: m.tileType.gaps
          })
        }

        // Intersection
        if (m.tileType.intersections > 0) {
          run.tiles[i].scoredItems.push({
            item: "intersection",
            scored: scored,
            count: m.tileType.intersections
          })
        }

        // Seesaw
        if (m.tileType.seesaw > 0) {
          run.tiles[i].scoredItems.push({
            item: "seesaw",
            scored: scored,
            count: m.tileType.seesaw
          })
        }

        // Ramp points
        if (m.items.rampPoints) {
          run.tiles[i].scoredItems.push({
            item: "ramp",
            scored: scored,
            count: 1
          })
        }

        // CheckPoint
        if (m.checkPoint) {
          run.tiles[i].scoredItems.push({
            item: "checkpoint",
            scored: scored,
            count: 1
          })
          checkPointCount++;
        }
      }
    }

    if (rule == '2025E' || rule == '2026E') {
      // Consider continued ramp tiles as a ramp
      let rampContinueFlag = false;
      for (let index = run.tiles.length - 1; index >= 0; index--) {
        if (run.tiles[index].scoredItems.some(item => item.item == "ramp")) {
          if (rampContinueFlag) {
            run.tiles[index].scoredItems.splice(run.tiles[index].scoredItems.findIndex(item => item.item === 'ramp'), 1);
          } else {
            rampContinueFlag = true;
          }
        } else {
          rampContinueFlag = false;
        }
      }
    }

    // Init LoPs Backet
    run.LoPs = new Array(checkPointCount + 1).fill(0);

    // NL Victim Backet
    if (run.isNL) {
      run.nl.liveVictim = new Array(map.victims.live).fill({
        "found": scored,
        "identified": scored
      });
  
      run.nl.deadVictim = new Array(map.victims.dead).fill({
        "found": scored,
        "identified": scored
      });
    } else {
      // WL Victim Backet
      run.rescueOrder = [];
      if (scored) {
        run.rescueOrder = run.rescueOrder.concat(new Array(map.victims.live).fill({
          "victimType": "LIVE",
          "zoneType": "GREEN"
        }))
        run.rescueOrder = run.rescueOrder.concat(new Array(map.victims.dead).fill({
          "victimType": "DEAD",
          "zoneType": "RED"
        }))
      }
    }
    run.map = map;
    return run;
  } else {
    return null;
  }
};
