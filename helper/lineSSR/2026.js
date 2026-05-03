"use strict";

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const TILE_SIZE = 60;
const SCALE_FACTOR = 3;

function getImagePath(name, isMapImage = false) {
  if (isMapImage) {
    return path.join(__dirname, '../../public/images/mapimage', name);
  }
  return path.join(__dirname, '../../public/images/tiles', name);
}

const imageCache = {};
async function getCachedImage(name, isMapImage = false) {
  const cacheKey = (isMapImage ? 'mapimage:' : 'tiles:') + name;
  if (imageCache[cacheKey]) return imageCache[cacheKey];
  const imgPath = getImagePath(name, isMapImage);
  if (fs.existsSync(imgPath)) {
    try {
      const img = await loadImage(imgPath);
      imageCache[cacheKey] = img;
      return img;
    } catch (e) {
      console.error(`Error loading image ${name}:`, e);
    }
  }
  return null;
}

function rotateRamp(direction) {
  switch (direction) {
    case "bottom": return 0;
    case "top": return 180;
    case "left": return 90;
    case "right": return 270;
    default: return 0;
  }
}

function isEvacTile(tile) {
  if (!tile || !tile.tileType) return false;
  const id = typeof tile.tileType === 'object' ? tile.tileType._id : tile.tileType;
  return id === "58cfd6549792e9313b1610e1" || id === "58cfd6549792e9313b1610e2" || id === "58cfd6549792e9313b1610e3";
}

function getEntranceOrExit(map, tile) {
  if (!isEvacTile(tile)) return null;

  const id = typeof tile.tileType === 'object' ? tile.tileType._id : tile.tileType;
  const tilesMap = Array.isArray(map.tiles) ? {} : map.tiles;
  if (Array.isArray(map.tiles)) {
    for (const t of map.tiles) {
      tilesMap[`${t.x},${t.y},${t.z}`] = t;
    }
  }

  const checkNeighbor = (nx, ny, nz) => {
    const t = tilesMap[`${nx},${ny},${nz}`];
    if (t && !isEvacTile(t)) {
      if (map.startTile2 && t.x === map.startTile2.x && t.y === map.startTile2.y && t.z === map.startTile2.z) return "Exit";
      return "Entrance";
    }
    return null;
  };

  let status = null;
  let rot = 0;

  if (id === "58cfd6549792e9313b1610e1") {
    // 4 sides
    const neighbors = [
      { x: tile.x, y: tile.y - 1, r: 0 },
      { x: tile.x + 1, y: tile.y, r: 90 },
      { x: tile.x, y: tile.y + 1, r: 180 },
      { x: tile.x - 1, y: tile.y, r: 270 }
    ];
    for (const n of neighbors) {
      const res = checkNeighbor(n.x, n.y, tile.z);
      if (res) {
        status = res;
        rot = n.r;
        break;
      }
    }
  } else {
    // ev2 or ev3 (2 or 3 sides based on rotation)
    const r = tile.rot || 0;
    const allowed = [];
    if (id === "58cfd6549792e9313b1610e2") {
        allowed.push((90 + r) % 360, (180 + r) % 360, (270 + r) % 360);
    } else {
        allowed.push((180 + r) % 360);
    }

    const neighbors = [
        { x: tile.x, y: tile.y - 1, r: 0 },
        { x: tile.x + 1, y: tile.y, r: 90 },
        { x: tile.x, y: tile.y + 1, r: 180 },
        { x: tile.x - 1, y: tile.y, r: 270 }
    ];

    for (const n of neighbors) {
        if (allowed.includes(n.r)) {
            const res = checkNeighbor(n.x, n.y, tile.z);
            if (res) {
                status = res;
                rot = n.r;
                break;
            }
        }
    }
  }

  if (status) return { status, rot };
  return null;
}

async function drawLineCanvas(map) {
  const numFloors = Math.max(1, map.height || 1);
  const floorGap = 20;

  const tiles = Array.isArray(map.tiles)
    ? map.tiles
    : Object.entries(map.tiles || {}).map(([key, tile]) => {
        const [x, y, z] = key.split(',').map(Number);
        return { ...tile, x, y, z };
      });

  // Calculate bounding boxes for each floor
  const floorBounds = [];
  let maxRawWidth = 0;
  let totalCanvasHeight = 0;

  for (let z = 0; z < numFloors; z++) {
    let fMinX = Infinity, fMaxX = -Infinity;
    let fMinY = Infinity, fMaxY = -Infinity;
    let fFound = false;

    for (const tile of tiles) {
      if (tile.z === z) {
        if (tile.x < fMinX) fMinX = tile.x;
        if (tile.x > fMaxX) fMaxX = tile.x;
        if (tile.y < fMinY) fMinY = tile.y;
        if (tile.y > fMaxY) fMaxY = tile.y;
        fFound = true;
      }
    }

    if (!fFound) {
      fMinX = 0; fMaxX = (map.width || 1) - 1;
      fMinY = 0; fMaxY = (map.length || 1) - 1;
    }

    const fRawWidth = (fMaxX - fMinX + 1) * TILE_SIZE;
    const fRawHeight = (fMaxY - fMinY + 1) * TILE_SIZE;

    floorBounds.push({
      minX: fMinX, maxX: fMaxX,
      minY: fMinY, maxY: fMaxY,
      rawWidth: fRawWidth,
      rawHeight: fRawHeight
    });

    if (fRawWidth > maxRawWidth) maxRawWidth = fRawWidth;
    totalCanvasHeight += fRawHeight * SCALE_FACTOR + (z < numFloors - 1 ? floorGap * SCALE_FACTOR : 0);
  }

  const canvasWidth = (maxRawWidth + 40) * SCALE_FACTOR;
  const canvasHeight = totalCanvasHeight + 40 * SCALE_FACTOR;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentY = 20 * SCALE_FACTOR;
  for (let z = 0; z < numFloors; z++) {
    const bounds = floorBounds[z];
    ctx.save();
    ctx.translate(20 * SCALE_FACTOR, currentY);
    ctx.scale(SCALE_FACTOR, SCALE_FACTOR);

    for (const tile of tiles) {
      if (tile.z !== z) continue;

      const tx = (tile.x - bounds.minX) * TILE_SIZE;
      const ty = (tile.y - bounds.minY) * TILE_SIZE;

      ctx.save();
      ctx.translate(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2);
      
      // 1. Base Tile
      if (tile.tileType && tile.tileType.image) {
        const baseImg = await getCachedImage(tile.tileType.image);
        if (baseImg) {
          ctx.save();
          ctx.rotate((tile.rot * Math.PI) / 180);
          ctx.drawImage(baseImg, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          ctx.restore();
        }
      }

      // 1.5 Orange Border for Checkpoints/Start
      const isStartTile = (map.startTile && tile.x === map.startTile.x && tile.y === map.startTile.y && tile.z === map.startTile.z);
      if (tile.checkPoint || isStartTile) {
          ctx.save();
          ctx.strokeStyle = 'orange';
          ctx.lineWidth = 2;
          ctx.strokeRect(-TILE_SIZE / 2 + 1, -TILE_SIZE / 2 + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          ctx.restore();
      }

      // 2. Overlays (Start, Bumps, Obstacles, etc.)
      const drawOverlay = async (name, isMapImage = true, rotate = 0) => {
        const img = await getCachedImage(name, isMapImage);
        if (img) {
          ctx.save();
          if (rotate) ctx.rotate((rotate * Math.PI) / 180);
          ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
          ctx.restore();
        }
      };

      // Start position
      if (map.startTile && tile.x === map.startTile.x && tile.y === map.startTile.y && tile.z === map.startTile.z) {
        await drawOverlay('start.png');
      }
      if (map.startTile2 && tile.x === map.startTile2.x && tile.y === map.startTile2.y && tile.z === map.startTile2.z) {
        await drawOverlay('start2.png');
      }

      // Bumps
      if (tile.items && tile.items.speedbumps > 0) {
        await drawOverlay(`bump${tile.items.speedbumps}.png`);
      }

      // Obstacles
      if (tile.items && tile.items.obstacles > 0) {
        await drawOverlay('obstacle.png');
      }

      // Ramp Points
      if (tile.items && tile.items.rampPoints) {
        await drawOverlay('ramp.png');
      }

      // Elevation
      if (tile.levelUp) {
        await drawOverlay('up.png', true, rotateRamp(tile.levelUp));
      }
      if (tile.levelDown) {
        await drawOverlay('down.png', true, rotateRamp(tile.levelDown));
      }

      // Evac Entrance/Exit
      const ev = getEntranceOrExit(map, tile);
      if (ev) {
        if (ev.status === "Entrance") await drawOverlay('ev-entrance.png', false, ev.rot);
        if (ev.status === "Exit") await drawOverlay('ev-exit.png', false, ev.rot);
      }

      // 3. Index Numbers
      const isScoring = tile.items && (tile.items.obstacles || tile.items.rampPoints || tile.items.speedbumps || (tile.tileType && (tile.tileType.gaps || tile.tileType.intersections || tile.tileType.seesaw)));
      
      if (tile.checkPoint || isStartTile || isScoring) {
        const indexText = (tile.index || []).map(i => i + 1).join(' , ');
        if (indexText) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = 'bold 8px sans-serif';
          const textWidth = ctx.measureText(indexText).width;
          ctx.fillRect(TILE_SIZE / 2 - textWidth - 4, -TILE_SIZE / 2 + 2, textWidth + 2, 10);
          ctx.fillStyle = (tile.checkPoint || isStartTile) ? 'orange' : '#0abde3';
          ctx.textAlign = 'right';
          ctx.fillText(indexText, TILE_SIZE / 2 - 3, -TILE_SIZE / 2 + 10);
          ctx.restore();
        }
      }

      ctx.restore();
    }
    ctx.restore();

    if (z < numFloors - 1) {
        const lineY = currentY + bounds.rawHeight * SCALE_FACTOR + (floorGap / 2) * SCALE_FACTOR;
        ctx.save();
        ctx.strokeStyle = '#cccccc';
        ctx.setLineDash([5 * SCALE_FACTOR, 5 * SCALE_FACTOR]);
        ctx.beginPath();
        ctx.moveTo(20 * SCALE_FACTOR, lineY);
        ctx.lineTo(canvasWidth - 20 * SCALE_FACTOR, lineY);
        ctx.stroke();
        ctx.restore();
    }
    currentY += bounds.rawHeight * SCALE_FACTOR + floorGap * SCALE_FACTOR;
  }

  return canvas;
}

async function drawLinePDF(doc, map, x, y, maxWidth, maxHeight) {
  const canvas = await drawLineCanvas(map);
  const buffer = canvas.toBuffer('image/png');
  doc.image(buffer, x, y, { fit: [maxWidth, maxHeight], align: 'center', valign: 'center' });
}

async function generatePNG(map) {
  return (await drawLineCanvas(map)).toBuffer('image/png');
}

module.exports = {
  drawLineCanvas,
  drawLinePDF,
  generatePNG
};

