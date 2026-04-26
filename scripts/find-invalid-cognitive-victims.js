#!/usr/bin/env node
/*
 * Read-only audit. Scans every mazeMap document for tiles where
 * `victims.<side>` is "Cognitive" but `cognitiveTargets.<side>` is missing —
 * the exact state the new pre-save validator now rejects. Existing docs in
 * this state would otherwise become uneditable post-deploy.
 *
 * Usage:
 *   DB_CONNECT_STR=<your-uri> node scripts/find-invalid-cognitive-victims.js
 *
 * Exits non-zero if any affected docs are found, so it can gate a deploy.
 */

const path = require('path');
const env = require('node-env-file');
env(path.resolve(__dirname, '..', 'process.env'));

if (!process.env.DB_CONNECT_STR) {
  console.error('DB_CONNECT_STR is not set');
  process.exit(1);
}

const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.DB_CONNECT_STR, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const coll = mongoose.connection.collection('mazemaps');
  const cursor = coll.find({});
  const sides = ['top', 'right', 'bottom', 'left'];
  const offenders = [];
  let scanned = 0;

  while (await cursor.hasNext()) {
    const map = await cursor.next();
    scanned++;
    if (!Array.isArray(map.cells)) continue;
    for (const cell of map.cells) {
      if (!cell || !cell.tile || !cell.tile.victims) continue;
      for (const side of sides) {
        if (cell.tile.victims[side] !== 'Cognitive') continue;
        const target = cell.tile.cognitiveTargets && cell.tile.cognitiveTargets[side];
        if (!target) {
          offenders.push({
            _id: map._id.toString(),
            name: map.name,
            x: cell.x, y: cell.y, z: cell.z,
            side,
          });
        }
      }
    }
  }

  console.log(`scanned=${scanned} offendingTiles=${offenders.length}`);
  for (const o of offenders) {
    console.log(`  ${o._id} (${o.name}) x=${o.x} y=${o.y} z=${o.z} side=${o.side}`);
  }

  await mongoose.disconnect();
  process.exit(offenders.length === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
