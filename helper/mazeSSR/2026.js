'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const COLORS = {
    wall: 'navy',
    wallLinear: 'black',
    tile: '#b0b0b0',
    black: 'black',
    blue: 'blue',
    red: 'red',
    checkpoint: '#C0C0C0',
    blue1: '#3498db',
    pink1: '#e84393',
    gray1: '#95a5a6',
};

const SIZES = {
    wall: 10,
    tile: 40,
};

const BIG_LETTERS = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(65 + i)
);

function getImagePath(name) {
    return path.join(__dirname, '../../public/images', name);
}

const imageCache = {};
async function getCachedImage(name) {
    if (imageCache[name]) return imageCache[name];
    const imgPath = getImagePath(name);
    if (fs.existsSync(imgPath)) {
        try {
            const img = await loadImage(imgPath);
            imageCache[name] = img;
            return img;
        } catch (e) {
            console.error(`Error loading image ${name}:`, e);
        }
    }
    return null;
}

function getItemNumber(map, type, x, y, z) {
    let count = 0;
    for (let i = 1; i < map.length * 2 + 1; i += 2) {
        for (let j = 1; j < map.width * 2 + 1; j += 2) {
            for (let k = 0; k < map.height; k++) {
                const cell = map.cells.find(
                    (c) => c.x === j && c.y === i && c.z === k
                );
                if (cell && cell.tile && cell.tile[type]) count++;
                if (x === j && y === i && z === k) return count;
            }
        }
    }
    return count;
}

function getVictimNumber(map, x, y, z, place) {
    let count = 0;
    for (let i = 1; i < map.length * 2 + 1; i += 2) {
        for (let j = 1; j < map.width * 2 + 1; j += 2) {
            for (let k = 0; k < map.height; k++) {
                const cell = map.cells.find(
                    (c) => c.x === j && c.y === i && c.z === k
                );
                if (cell && cell.tile && cell.tile.victims) {
                    const victimPlaces = ['top', 'left', 'right', 'bottom'];
                    for (const vp of victimPlaces) {
                        if (
                            cell.tile.victims[vp] &&
                            cell.tile.victims[vp] !== 'None'
                        ) {
                            count++;
                            if (x === j && y === i && z === k && place === vp) {
                                return BIG_LETTERS[(count - 1) % 26];
                            }
                        }
                    }
                }
            }
        }
    }
    return '';
}

function isDummy(cell, direction) {
    if (!cell || !cell.tile || !cell.tile.victims) return false;
    const type = cell.tile.victims[direction];
    if (type === 'Cognitive') {
        if (
            !cell.tile.cognitiveTargets ||
            !cell.tile.cognitiveTargets[direction] ||
            !cell.tile.cognitiveTargets[direction].rings
        )
            return true;
        const rings = cell.tile.cognitiveTargets[direction].rings;
        const colorValues = { K: -2, R: -1, Y: 0, G: 1, B: 2 };
        let total = 0;
        for (let i = 1; i <= 5; i++) {
            total += colorValues[rings[`ring${i}`]] || 0;
        }
        if (total >= 0 && total <= 2) return false;
        return true; // Dummy
    }
    return false;
}

/**
 * Draws the map onto a Canvas and returns the canvas object.
 */
async function drawMazeCanvas(map) {
    const SCALE_FACTOR = 3;
    const numFloors = Math.max(1, map.height || 1);

    const getCoord = (c) => {
        const sets = Math.floor(c / 2);
        const remains = c % 2;
        return (
            sets * (SIZES.wall + SIZES.tile) + (remains === 0 ? 0 : SIZES.wall)
        );
    };

    const getSize = (c) => {
        return c % 2 === 0 ? SIZES.wall : SIZES.tile;
    };

    // Calculate individual bounding boxes for each floor
    const floorBounds = [];
    let maxRawWidth = 0;
    let totalCanvasHeight = 0;

    for (let z = 0; z < numFloors; z++) {
        let fMinX = map.width * 2 + 1;
        let fMaxX = -1;
        let fMinY = map.length * 2 + 1;
        let fMaxY = -1;
        let fFoundReachable = false;

        for (const cell of map.cells) {
            if (
                cell.z === z &&
                cell.isTile &&
                cell.tile &&
                cell.tile.reachable
            ) {
                if (cell.x < fMinX) fMinX = cell.x;
                if (cell.x > fMaxX) fMaxX = cell.x;
                if (cell.y < fMinY) fMinY = cell.y;
                if (cell.y > fMaxY) fMaxY = cell.y;
                fFoundReachable = true;
            }
        }

        // Include start tile only on its floor
        if (
            map.startTile &&
            map.startTile.z === z &&
            (map.startTile.x !== 0 || map.startTile.y !== 0)
        ) {
            if (map.startTile.x < fMinX) fMinX = map.startTile.x;
            if (map.startTile.x > fMaxX) fMaxX = map.startTile.x;
            if (map.startTile.y < fMinY) fMinY = map.startTile.y;
            if (map.startTile.y > fMaxY) fMaxY = map.startTile.y;
            fFoundReachable = true;
        }

        if (!fFoundReachable) {
            fMinX = 1;
            fMaxX = Math.max(1, map.width * 2 - 1);
            fMinY = 1;
            fMaxY = Math.max(1, map.length * 2 - 1);
        }

        const fRenderMinX = Math.max(0, fMinX - 1);
        const fRenderMaxX = Math.min(map.width * 2, fMaxX + 1);
        const fRenderMinY = Math.max(0, fMinY - 1);
        const fRenderMaxY = Math.min(map.length * 2, fMaxY + 1);

        const fRawWidth =
            getCoord(fRenderMaxX) -
            getCoord(fRenderMinX) +
            getSize(fRenderMaxX);
        const fRawHeight =
            getCoord(fRenderMaxY) -
            getCoord(fRenderMinY) +
            getSize(fRenderMaxY);

        const fLabelHeight = 0;
        const fSectionHeight = fRawHeight + fLabelHeight;

        floorBounds.push({
            minX: fRenderMinX,
            maxX: fRenderMaxX,
            minY: fRenderMinY,
            maxY: fRenderMaxY,
            rawWidth: fRawWidth,
            rawHeight: fRawHeight,
            labelHeight: fLabelHeight,
            sectionHeight: fSectionHeight,
        });

        if (fRawWidth > maxRawWidth) maxRawWidth = fRawWidth;
        totalCanvasHeight +=
            fSectionHeight * SCALE_FACTOR +
            (z < numFloors - 1 ? 20 * SCALE_FACTOR : 0);
    }

    const canvasWidth = (maxRawWidth + 20) * SCALE_FACTOR;
    const canvasHeight = totalCanvasHeight + 20 * SCALE_FACTOR; // 10 top, 10 bottom overall

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background with white instead of transparency
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentY = 10 * SCALE_FACTOR;
    for (let z = 0; z < numFloors; z++) {
        const bounds = floorBounds[z];
        ctx.save();
        ctx.translate(10 * SCALE_FACTOR, currentY);

        ctx.scale(SCALE_FACTOR, SCALE_FACTOR);

        const renderMinX = bounds.minX;
        const renderMaxX = bounds.maxX;
        const renderMinY = bounds.minY;
        const renderMaxY = bounds.maxY;

        const drawnSegments = new Set();
        const drawSegment = (x1, y1, x2, y2) => {
            // Normalize segment to avoid duplicates in different directions
            const segmentKey =
                x1 < x2 || (x1 === x2 && y1 < y2)
                    ? `${x1},${y1},${x2},${y2}`
                    : `${x2},${y2},${x1},${y1}`;
            if (drawnSegments.has(segmentKey)) return;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            drawnSegments.add(segmentKey);
        };

        const drawCellBorders = (tx, ty, tw, th) => {
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 1;
            drawSegment(tx, ty, tx + tw, ty); // Top
            drawSegment(tx, ty + th, tx + tw, ty + th); // Bottom
            drawSegment(tx, ty, tx, ty + th); // Left
            drawSegment(tx + tw, ty, tx + tw, ty + th); // Right
        };

        // 1. Draw Backgrounds (Tiles & Walls)
        for (const cell of map.cells) {
            if (cell.z !== z) continue;
            if (
                cell.x < renderMinX ||
                cell.x > renderMaxX ||
                cell.y < renderMinY ||
                cell.y > renderMaxY
            )
                continue;

            if (cell.isTile) {
                if (!cell.tile || !cell.tile.reachable) continue;
            }

            if (cell.isWall) {
                // Only draw wall if at least one adjacent tile is reachable
                let t1, t2;
                if (cell.x % 2 === 0) {
                    // vertical wall
                    t1 = map.cells.find(
                        (c) => c.x === cell.x - 1 && c.y === cell.y && c.z === z
                    );
                    t2 = map.cells.find(
                        (c) => c.x === cell.x + 1 && c.y === cell.y && c.z === z
                    );
                } else {
                    // horizontal wall
                    t1 = map.cells.find(
                        (c) => c.x === cell.x && c.y === cell.y - 1 && c.z === z
                    );
                    t2 = map.cells.find(
                        (c) => c.x === cell.x && c.y === cell.y + 1 && c.z === z
                    );
                }
                const r1 = t1 && t1.tile && t1.tile.reachable;
                const r2 = t2 && t2.tile && t2.tile.reachable;
                if (!r1 && !r2) continue;
            }

            const tx = getCoord(cell.x) - getCoord(renderMinX);
            const ty = getCoord(cell.y) - getCoord(renderMinY);
            const tw = getSize(cell.x);
            const th = getSize(cell.y);

            if (cell.isTile && cell.tile) {
                let fillColor = '#ffffff'; // Default tile color
                if (cell.tile.black) {
                    fillColor = COLORS.black;
                } else if (cell.tile.blue) {
                    fillColor = COLORS.blue;
                } else if (cell.tile.red) {
                    fillColor = COLORS.red;
                } else if (cell.tile.checkpoint) {
                    // Gradient handled below
                } else if (cell.tile.reachable) {
                    fillColor = cell.isLinear ? '#fffdea' : '#b4ffd5';
                }

                if (cell.tile.checkpoint) {
                    const grad = ctx.createLinearGradient(
                        tx,
                        ty,
                        tx + tw,
                        ty + th
                    );
                    grad.addColorStop(0, '#A5A5A5');
                    grad.addColorStop(0.25, '#BABAC2');
                    grad.addColorStop(0.5, '#E8E8E8');
                    grad.addColorStop(0.75, '#BABAC2');
                    grad.addColorStop(1, '#A5A5A5');
                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = fillColor;
                }
                ctx.fillRect(tx, ty, tw, th);
            } else if (cell.isWall) {
                if (cell.ignoreWall) {
                    ctx.fillStyle = 'green';
                } else if (cell.isLinear) {
                    ctx.fillStyle = COLORS.black;
                } else {
                    ctx.fillStyle = COLORS.wall;
                }
                ctx.fillRect(tx, ty, tw, th);
            }

            // Draw borders for the cell
            drawCellBorders(tx, ty, tw, th);
        }

        // 1b. Draw Pillars (Even, Even) with neighborhood-aware coloring
        for (
            let r = renderMinY + (renderMinY % 2 === 0 ? 0 : 1);
            r <= renderMaxY;
            r += 2
        ) {
            for (
                let c = renderMinX + (renderMinX % 2 === 0 ? 0 : 1);
                c <= renderMaxX;
                c += 2
            ) {
                // Only draw pillar if at least one adjacent tile is reachable
                const adjacentTiles = [
                    map.cells.find(
                        (cell) =>
                            cell.x === c - 1 && cell.y === r - 1 && cell.z === z
                    ),
                    map.cells.find(
                        (cell) =>
                            cell.x === c + 1 && cell.y === r - 1 && cell.z === z
                    ),
                    map.cells.find(
                        (cell) =>
                            cell.x === c - 1 && cell.y === r + 1 && cell.z === z
                    ),
                    map.cells.find(
                        (cell) =>
                            cell.x === c + 1 && cell.y === r + 1 && cell.z === z
                    ),
                ].filter((t) => t && t.isTile && t.tile && t.tile.reachable);

                if (adjacentTiles.length === 0) continue;

                const tx = getCoord(c) - getCoord(renderMinX);
                const ty = getCoord(r) - getCoord(renderMinY);
                const tw = getSize(c);
                const th = getSize(r);

                // Check adjacent walls for coloring and drawing condition
                const isWallDrawable = (w) => {
                    if (!w || !w.isWall) return false;
                    let t1, t2;
                    if (w.x % 2 === 0) {
                        // vertical wall
                        t1 = map.cells.find(
                            (c) => c.x === w.x - 1 && c.y === w.y && c.z === z
                        );
                        t2 = map.cells.find(
                            (c) => c.x === w.x + 1 && c.y === w.y && c.z === z
                        );
                    } else {
                        // horizontal wall
                        t1 = map.cells.find(
                            (c) => c.x === w.x && c.y === w.y - 1 && c.z === z
                        );
                        t2 = map.cells.find(
                            (c) => c.x === w.x && c.y === w.y + 1 && c.z === z
                        );
                    }
                    return (
                        (t1 && t1.tile && t1.tile.reachable) ||
                        (t2 && t2.tile && t2.tile.reachable)
                    );
                };

                const neighbors = [
                    map.cells.find(
                        (cell) =>
                            cell.x === c - 1 && cell.y === r && cell.z === z
                    ),
                    map.cells.find(
                        (cell) =>
                            cell.x === c + 1 && cell.y === r && cell.z === z
                    ),
                    map.cells.find(
                        (cell) =>
                            cell.x === c && cell.y === r - 1 && cell.z === z
                    ),
                    map.cells.find(
                        (cell) =>
                            cell.x === c && cell.y === r + 1 && cell.z === z
                    ),
                ].filter((n) => isWallDrawable(n));

                if (neighbors.length >= 2) {
                    let pillarColor = COLORS.wall;
                    if (neighbors.some((n) => n.isLinear))
                        pillarColor = COLORS.black;
                    else if (neighbors.some((n) => n.ignoreWall))
                        pillarColor = 'green';

                    ctx.fillStyle = pillarColor;
                    ctx.fillRect(tx, ty, tw, th);
                }

                // Draw borders for the pillar
                drawCellBorders(tx, ty, tw, th);
            }
        }

        // 2. Draw Icons
        for (const cell of map.cells) {
            if (cell.z !== z) continue;
            if (
                cell.x < renderMinX ||
                cell.x > renderMaxX ||
                cell.y < renderMinY ||
                cell.y > renderMaxY
            )
                continue;
            const tx = getCoord(cell.x) - getCoord(renderMinX);
            const ty = getCoord(cell.y) - getCoord(renderMinY);
            const tw = getSize(cell.x);
            const th = getSize(cell.y);

            const drawIcon = async (imgName) => {
                const img = await getCachedImage(imgName);
                if (img) ctx.drawImage(img, tx, ty, tw, th);
            };

            if (cell.isTile && cell.tile) {
                if (
                    map.startTile &&
                    cell.x === map.startTile.x &&
                    cell.y === map.startTile.y &&
                    cell.z === map.startTile.z
                ) {
                    await drawIcon('start.png');
                } else if (cell.tile.speedbump) {
                    await drawIcon('log.png');
                } else if (cell.tile.ramp) {
                    await drawIcon('ramp.png');
                } else if (cell.tile.steps) {
                    await drawIcon('steps.png');
                } else if (
                    cell.tile.changeFloorTo !== undefined &&
                    cell.tile.changeFloorTo !== cell.z
                ) {
                    await drawIcon('elevator.png');
                }

                const victims = cell.tile.victims;
                if (victims) {
                    const directions = ['top', 'right', 'bottom', 'left'];
                    for (const dir of directions) {
                        const v = victims[dir];
                        if (v && v !== 'None') {
                            if (v === 'Cognitive') {
                                const ct =
                                    cell.tile.cognitiveTargets &&
                                    cell.tile.cognitiveTargets[dir];
                                if (ct && ct.rings) {
                                    for (let i = 1; i <= 5; i++) {
                                        const ringVal = ct.rings[`ring${i}`];
                                        if (ringVal)
                                            await drawIcon(
                                                `cognitive_rings/${dir}_ring${i}_${ringVal}.png`
                                            );
                                    }
                                }
                            } else if (
                                [
                                    'H',
                                    'S',
                                    'U',
                                    'PHI',
                                    'PSI',
                                    'OMEGA',
                                    'Red',
                                    'Yellow',
                                    'Green',
                                ].includes(v)
                            ) {
                                await drawIcon(`${v.toLowerCase()}_${dir}.png`);
                            }
                        }
                    }
                }
            }
        }

        // 3. Draw Numbering Overlays
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const cell of map.cells) {
            if (cell.z !== z || !cell.isTile || !cell.tile) continue;
            if (
                cell.x < renderMinX ||
                cell.x > renderMaxX ||
                cell.y < renderMinY ||
                cell.y > renderMaxY
            )
                continue;
            const tx = getCoord(cell.x) - getCoord(renderMinX);
            const ty = getCoord(cell.y) - getCoord(renderMinY);
            const tw = getSize(cell.x);
            const th = getSize(cell.y);

            const drawCircleText = (
                num,
                cx,
                cy,
                bgColor,
                textColor = 'white',
                radius = 7.5,
                borderRadius = 50
            ) => {
                ctx.save();
                ctx.fillStyle = bgColor;
                if (borderRadius === 50) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(
                        cx - radius,
                        cy - radius,
                        radius * 2,
                        radius * 2
                    );
                }
                ctx.fillStyle = textColor;
                ctx.font = 'bold 9px sans-serif';
                ctx.fillText(num, cx, cy);
                ctx.restore();
            };

            // Checkpoint
            if (cell.tile.checkpoint) {
                const num = getItemNumber(
                    map,
                    'checkpoint',
                    cell.x,
                    cell.y,
                    cell.z
                );
                // style="left:1px; top:1px; position: absolute; border-radius:0%;"
                drawCircleText(
                    num,
                    tx + 1 + 7.5,
                    ty + 1 + 7.5,
                    COLORS.blue1,
                    'white',
                    7.5,
                    0
                );
            }

            // Blue Tile
            if (cell.tile.blue) {
                const num = getItemNumber(map, 'blue', cell.x, cell.y, cell.z);
                // center
                ctx.save();
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(tx + tw / 2, ty + th / 2, 7.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = COLORS.blue1;
                ctx.font = 'bold 9px sans-serif';
                ctx.fillText(num, tx + tw / 2, ty + th / 2);
                ctx.restore();
            }

            // Speedbump
            if (cell.tile.speedbump) {
                const num = getItemNumber(
                    map,
                    'speedbump',
                    cell.x,
                    cell.y,
                    cell.z
                );
                // style="right:1px; bottom:1px; position: absolute;"
                drawCircleText(
                    num,
                    tx + tw - 1 - 7.5,
                    ty + th - 1 - 7.5,
                    COLORS.blue1
                );
            }

            // Ramp / Steps
            if (cell.tile.ramp || cell.tile.steps) {
                const type = cell.tile.ramp ? 'ramp' : 'steps';
                const num = getItemNumber(map, type, cell.x, cell.y, cell.z);
                // style="right:13px; top:12px; position: absolute; border-radius:25%;"
                drawCircleText(
                    num,
                    tx + tw - 13 - 7.5,
                    ty + 12 + 7.5,
                    COLORS.blue1,
                    'white',
                    7.5,
                    25
                );
            }

            // Victims
            const victims = cell.tile.victims;
            if (victims) {
                const vPositions = {
                    top: { x: tx + tw - 5 - 7.5, y: ty - 10 + 7.5 },
                    right: { x: tx + tw - -10 - 7.5, y: ty + th - 5 - 7.5 },
                    left: { x: tx + -10 + 7.5, y: ty + 5 + 7.5 },
                    bottom: { x: tx + 5 + 7.5, y: ty + th - -10 - 7.5 },
                };

                for (const dir in vPositions) {
                    const v = victims[dir];
                    if (v && v !== 'None') {
                        const num = getVictimNumber(
                            map,
                            cell.x,
                            cell.y,
                            cell.z,
                            dir
                        );
                        let color = COLORS.pink1;
                        if (v === 'Cognitive' && isDummy(cell, dir))
                            color = COLORS.gray1;
                        const pos = vPositions[dir];
                        drawCircleText(num, pos.x, pos.y, color);
                    }
                }
            }
        }
        ctx.restore();

        // Draw separator line between floors
        if (z < numFloors - 1) {
            const lineY =
                currentY + bounds.rawHeight * SCALE_FACTOR + 10 * SCALE_FACTOR; // Exactly 10px below current map
            ctx.save();
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(10 * SCALE_FACTOR, lineY);
            ctx.lineTo(canvasWidth - 10 * SCALE_FACTOR, lineY);
            ctx.stroke();
            ctx.restore();
        }

        currentY += bounds.rawHeight * SCALE_FACTOR + 20 * SCALE_FACTOR;
    }

    return canvas;
}

async function drawMazePDF(doc, map, x, y, maxWidth, maxHeight) {
    const canvas = await drawMazeCanvas(map);
    const buffer = canvas.toBuffer('image/png');
    doc.image(buffer, x, y, {
        fit: [maxWidth, maxHeight],
        align: 'center',
        valign: 'center',
    });
}

async function generatePNG(map) {
    return (await drawMazeCanvas(map)).toBuffer('image/png');
}

async function generateSVG(map) {
    return (await drawMazeCanvas(map)).toBuffer();
}

module.exports = {
    drawMazeCanvas,
    drawMazePDF,
    generatePNG,
    generateSVG,
};
