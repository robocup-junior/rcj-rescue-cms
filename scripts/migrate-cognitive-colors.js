#!/usr/bin/env node
/**
 * One-shot data migration: rename cognitive-target ring color codes from the
 * old labeling (B = Black, C = Cyan/Blue) to the rules-aligned CMYK shorthand
 * (K = blacK, B = Blue). Letter codes touched: `B` → `K`, `C` → `B`.
 *
 * Run BEFORE deploying the schema enum change in models/mazeMap.js — otherwise
 * Mongoose will reject existing documents whose ring values still hold `B`/`C`.
 *
 * Usage:
 *   DB_CONNECT_STR=mongodb://... node scripts/migrate-cognitive-colors.js
 *   DB_CONNECT_STR=mongodb://... node scripts/migrate-cognitive-colors.js --dry-run
 *
 * Idempotent: re-running after a successful migration is a no-op.
 */

'use strict'

const path = require('path')
const env = require('node-env-file')
try { env(path.resolve(__dirname, '..', 'process.env')) } catch (e) { /* env file optional */ }

const mongoose = require('mongoose')

const DRY_RUN = process.argv.includes('--dry-run')
const URI = process.env.DB_CONNECT_STR
if (!URI) {
  console.error('DB_CONNECT_STR not set')
  process.exit(1)
}

// B (Black) -> K, C (Cyan rendered as Blue per rules figure) -> B (Blue).
// The output alphabet overlaps with the input alphabet (`B` is in both), so
// running translateRings twice on the same doc would corrupt rings that are
// already migrated. Instead we stamp `cognitiveColorScheme` on each scanned
// doc and skip already-stamped docs at the find layer — re-runs are O(0).
const SCHEME_VERSION = '2026-k-r-y-g-b'
const TRANSLATE = { B: 'K', C: 'B' }
const RING_KEYS = ['ring1', 'ring2', 'ring3', 'ring4', 'ring5']
const SIDES = ['top', 'right', 'bottom', 'left']

function translateRings(rings) {
  if (!rings) return { changed: false, rings }
  let changed = false
  const out = {}
  for (const k of RING_KEYS) {
    const v = rings[k]
    if (TRANSLATE[v] !== undefined) {
      out[k] = TRANSLATE[v]
      changed = true
    } else {
      out[k] = v
    }
  }
  return { changed, rings: out }
}

async function run() {
  await mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true })
  const db = mongoose.connection
  const coll = db.collection('mazemaps')

  const cursor = coll.find(
    { cognitiveColorScheme: { $ne: SCHEME_VERSION } },
    { projection: { _id: 1, cells: 1 } }
  )
  let mapsScanned = 0
  let mapsChanged = 0
  let mapsSkippedNoCells = 0
  let ringsChanged = 0

  while (await cursor.hasNext()) {
    const map = await cursor.next()
    mapsScanned++

    if (!Array.isArray(map.cells)) {
      mapsSkippedNoCells++
      if (!DRY_RUN) {
        await coll.updateOne({ _id: map._id }, { $set: { cognitiveColorScheme: SCHEME_VERSION } })
      }
      continue
    }

    let mapChanged = false
    for (const cell of map.cells) {
      const targets = cell && cell.tile && cell.tile.cognitiveTargets
      if (!targets) continue

      for (const side of SIDES) {
        const target = targets[side]
        if (!target || !target.rings) continue
        const { changed, rings } = translateRings(target.rings)
        if (changed) {
          target.rings = rings
          ringsChanged++
          mapChanged = true
        }
      }
    }

    if (mapChanged) mapsChanged++
    if (!DRY_RUN) {
      const update = mapChanged
        ? { $set: { cells: map.cells, cognitiveColorScheme: SCHEME_VERSION } }
        : { $set: { cognitiveColorScheme: SCHEME_VERSION } }
      await coll.updateOne({ _id: map._id }, update)
    }
  }

  console.log(`scanned=${mapsScanned} updated=${mapsChanged} ringsTranslated=${ringsChanged} skippedNoCells=${mapsSkippedNoCells}${DRY_RUN ? ' (dry-run)' : ''}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
