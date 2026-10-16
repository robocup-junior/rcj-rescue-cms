// Walls of rooms 1-3 for the new Simulation 2026 editor (beta): unit segments on the 6 cm grid and
// curves, and where each is kept in the map's cells (the format of the Simulation 2026 editor).
//
// Grid points (i, j) are 6 cm steps from the map's top-left corner. They are also the map's cell
// coordinates: tiles at odd i and j, tile edges where one of them is even. A unit segment joins two
// neighbouring grid points:
//   "v,i,j"  from (i, j) down to (i, j + 1)
//   "h,i,j"  from (i, j) right to (i + 1, j)
// On a tile edge (even i for "v", even j for "h") it is one half of that edge's 12 cm wall; inside a
// tile it is one of the tile's inner half walls. Curves stay per quarter tile, as in the cells.
//
// Loads in the browser as window.SimLattice and in Node through require (tests).
(function (root) {
    function cellKey(x, y, z) {
        return x + ',' + y + ',' + (z || 0);
    }

    function segKey(dir, i, j) {
        return dir + ',' + i + ',' + j;
    }

    function parseSeg(seg) {
        const p = seg.split(',');
        return { dir: p[0], i: Number(p[1]), j: Number(p[2]) };
    }

    // Where a unit segment is kept: on a tile edge { kind: 'edge', cell, half } with half 1 = the
    // left / lower half as the cells' halfWall, or inside a tile { kind: 'inner', cell, arm } with
    // arm 0-3 = up, right, down, left from the tile centre as halfWallIn
    function place(seg, z) {
        const s = parseSeg(seg);
        if (s.dir === 'v') {
            const y = s.j % 2 ? s.j : s.j + 1;    // the row of tiles the segment lies in
            if (s.i % 2 === 0) return { kind: 'edge', cell: cellKey(s.i, y, z), half: s.j === y ? 1 : 2 };
            return { kind: 'inner', cell: cellKey(s.i, y, z), arm: s.j === y ? 2 : 0 };
        }
        const x = s.i % 2 ? s.i : s.i + 1;        // the column of tiles the segment lies in
        if (s.j % 2 === 0) return { kind: 'edge', cell: cellKey(x, s.j, z), half: s.i + 1 === x ? 1 : 2 };
        return { kind: 'inner', cell: cellKey(x, s.j, z), arm: s.i + 1 === x ? 3 : 1 };
    }

    // The unit segments of an edge cell's halves (1 and 2) and of a tile's arms (0-3)
    function edgeHalfSeg(x, y, half) {
        if (x % 2 === 0) return half === 1 ? segKey('v', x, y) : segKey('v', x, y - 1);
        return half === 1 ? segKey('h', x - 1, y) : segKey('h', x, y);
    }

    function armSeg(x, y, arm) {
        return [segKey('v', x, y - 1), segKey('h', x, y), segKey('v', x, y), segKey('h', x - 1, y)][arm];
    }

    // All walls of one floor of the map: { segs: Set of unit segments, arcs: [{x, y, q, v}] }
    function fromCells(map, z) {
        z = z || 0;
        const segs = new Set();
        const arcs = [];
        Object.keys(map.cells || {}).forEach(function (key) {
            const p = key.split(',').map(Number);
            if (p[2] !== z) return;
            const cell = map.cells[key];
            const x = p[0], y = p[1];
            if ((x + y) % 2 === 1) {
                if (cell.isWall) { segs.add(edgeHalfSeg(x, y, 1)); segs.add(edgeHalfSeg(x, y, 2)); }
                else if (cell.halfWall == 1 || cell.halfWall == 2) segs.add(edgeHalfSeg(x, y, Number(cell.halfWall)));
            } else if (x % 2 === 1 && cell.tile) {
                (cell.tile.halfWallIn || []).forEach(function (on, arm) { if (on) segs.add(armSeg(x, y, arm)); });
                (cell.tile.curve || []).forEach(function (v, q) { if (v) arcs.push({ x: x, y: y, q: q, v: Number(v) }); });
            }
        });
        return { segs: segs, arcs: arcs };
    }

    function tileCell(map, key, z) {
        let cell = map.cells[key];
        if (!cell) cell = map.cells[key] = { isTile: true, tile: { changeFloorTo: z || 0 } };
        if (!cell.tile) cell.tile = { changeFloorTo: z || 0 };
        if (!cell.tile.halfWallIn) cell.tile.halfWallIn = [0, 0, 0, 0];
        if (!cell.tile.curve) cell.tile.curve = [0, 0, 0, 0];
        return cell.tile;
    }

    // Puts a unit segment into the cells (on = true) or takes it out. A tile edge with both halves
    // is a whole wall (isWall), with one a half wall (halfWall 1 / 2). Inner walls and curves mark
    // their tile as a quarter-tile one (halfTile), as the editor does for rooms 2 and 3.
    function setSeg(map, seg, on, z) {
        const at = place(seg, z);
        if (at.kind === 'edge') {
            const cell = map.cells[at.cell] || (map.cells[at.cell] = { isWall: false, halfWall: 0 });
            const halves = [cell.isWall || cell.halfWall == 1, cell.isWall || cell.halfWall == 2];
            halves[at.half - 1] = !!on;
            cell.isWall = halves[0] && halves[1];
            cell.halfWall = cell.isWall ? 0 : halves[0] ? 1 : halves[1] ? 2 : 0;
            return;
        }
        const tile = tileCell(map, at.cell, z);
        tile.halfWallIn[at.arm] = on ? 1 : 0;
        if (on) tile.halfTile = 1;
    }

    // Curve v (0 = none, 1-4 = bulging NE, SE, SW, NW) in quarter q (NW, NE, SW, SE) of tile (x, y)
    function setArc(map, x, y, q, v, z) {
        const tile = tileCell(map, cellKey(x, y, z), z);
        tile.curve[q] = v;
        if (v) tile.halfTile = 1;
    }

    function hasSeg(map, seg, z) {
        const at = place(seg, z);
        const cell = map.cells[at.cell];
        if (!cell) return false;
        if (at.kind === 'edge') return !!(cell.isWall || cell.halfWall == at.half);
        return !!(cell.tile && cell.tile.halfWallIn && cell.tile.halfWallIn[at.arm]);
    }

    // ---- Drawing on the grid -------------------------------------------------------------------

    // The grid point nearest to (x, y) cm on a grid of `step` units (1 = 6 cm, 2 = 12 cm), kept
    // inside a map of width x length tiles
    function snap(x, y, step, width, length) {
        const s = 6 * step;
        const clamp = function (v, max) { return Math.max(0, Math.min(max, v)); };
        return [clamp(Math.round(x / s) * step, 2 * width), clamp(Math.round(y / s) * step, 2 * length)];
    }

    // The straight line from grid point a towards b along the longer axis (walls of rooms 1-3 run
    // across or down the map only), as its end point and its unit segments
    function axisLine(a, b) {
        const across = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
        const end = across ? [b[0], a[1]] : [a[0], b[1]];
        const segs = [];
        if (across) for (let i = Math.min(a[0], end[0]); i < Math.max(a[0], end[0]); i++) segs.push(segKey('h', i, a[1]));
        else for (let j = Math.min(a[1], end[1]); j < Math.max(a[1], end[1]); j++) segs.push(segKey('v', a[0], j));
        return { end: end, segs: segs };
    }

    // The outline of the rectangle with corners a and b
    function rectSegs(a, b) {
        const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
        const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        return [].concat(
            axisLine([x0, y0], [x1, y0]).segs, axisLine([x0, y1], [x1, y1]).segs,
            axisLine([x0, y0], [x0, y1]).segs, axisLine([x1, y0], [x1, y1]).segs);
    }

    // ---- What each room takes --------------------------------------------------------------------
    // Room 1: walls on tile edges only, whole (12 cm). Rooms 2 and 3: any unit segment (6 cm grid).
    // Room 3: also curves. Room 4 is drawn as a picture, so no grid walls inside it; walls on its
    // border with another room are tile edges like any other.

    // The tiles beside a unit segment (one or two, as tile cell coordinates [x, y])
    function segTiles(seg) {
        const s = parseSeg(seg);
        if (s.dir === 'v') {
            const y = s.j % 2 ? s.j : s.j + 1;
            return s.i % 2 === 0 ? [[s.i - 1, y], [s.i + 1, y]] : [[s.i, y]];
        }
        const x = s.i % 2 ? s.i : s.i + 1;
        return s.j % 2 === 0 ? [[x, s.j - 1], [x, s.j + 1]] : [[x, s.j]];
    }

    // Whether a unit segment can be drawn, given roomOf(x, y) = the room (1-4) of the tile at cell
    // (x, y), or 0 outside the map. { ok, whole, reason }: whole = it can only go in as part of a
    // whole tile edge (beside room 1); reason when it cannot go in at all.
    function segRule(seg, roomOf) {
        const rooms = segTiles(seg).map(function (t) { return roomOf(t[0], t[1]); }).filter(function (r) { return r > 0; });
        if (!rooms.length) return { ok: false, whole: false, reason: 'outside' };
        const inner = segTiles(seg).length === 1;
        if (rooms.every(function (r) { return r === 4; })) return { ok: false, whole: false, reason: 'room4' };
        if (inner && rooms[0] === 1) return { ok: false, whole: false, reason: 'room1Inner' };
        return { ok: true, whole: rooms.indexOf(1) > -1 };
    }

    function arcRule(room) {
        return room === 3 ? { ok: true } : { ok: false, reason: room === 4 ? 'room4' : 'curveRoom3' };
    }

    // The other half of the tile edge a unit segment is on (null inside a tile)
    function otherHalf(seg) {
        const at = place(seg);
        if (at.kind !== 'edge') return null;
        const p = at.cell.split(',').map(Number);
        return edgeHalfSeg(p[0], p[1], 3 - at.half);
    }

    // ---- Victims on the 6 cm walls (rooms 2 and 3) ---------------------------------------------------
    // Slot i = quarter (NW, NE, SW, SE) * 4 + side (top, right, bottom, left), as halfWallVic. In a
    // quarter with a curve the world export puts a victim on one of the two faces of the arc: on its
    // inner face (towards the arc's centre) for sides (d + 2) % 4 and (d + 3) % 4, on its outer face
    // for the other two, d = curve value - 1. So a curved quarter has two places, not four.

    function curveCentre(x, y, q, v) {
        const ox = 6 * (x - 1) + (q % 2) * 6, oy = 6 * (y - 1) + Math.floor(q / 2) * 6;
        const c = [[0, 6], [0, 0], [6, 0], [6, 6]][v - 1];
        return [ox + c[0], oy + c[1]];
    }

    function curveInside(v, side) {
        const d = v - 1;
        return side === (d + 2) % 4 || side === (d + 3) % 4;
    }

    // The side standing for a face of the arc: the slots placed there are of that side
    function curveSide(v, inside) {
        const d = v - 1;
        return inside ? (d + 2) % 4 : d;
    }

    // Where slot i of tile (x, y) is drawn, cm, and the point of the wall it is on.
    // curve: the tile's curve array (or nothing)
    function slotPoint(x, y, i, curve) {
        const q = Math.floor(i / 4), side = i % 4;
        const qx = 6 * x - 3 + (q % 2) * 6, qy = 6 * y - 3 + Math.floor(q / 2) * 6;
        const v = curve ? Number(curve[q]) || 0 : 0;
        if (!v) {
            const off = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
            return { at: [qx + 2 * off[0], qy + 2 * off[1]], wall: [qx + 3 * off[0], qy + 3 * off[1]], curved: false };
        }
        const c = curveCentre(x, y, q, v);
        const len = Math.hypot(qx - c[0], qy - c[1]);
        const u = [(qx - c[0]) / len, (qy - c[1]) / len];
        const r = 6 + (curveInside(v, side) ? -2.4 : 2.4);
        return { at: [c[0] + u[0] * r, c[1] + u[1] * r], wall: [c[0] + u[0] * 6, c[1] + u[1] * 6], curved: true, inside: curveInside(v, side) };
    }

    const api = {
        curveCentre: curveCentre, curveInside: curveInside, curveSide: curveSide, slotPoint: slotPoint,
        cellKey: cellKey, segKey: segKey, parseSeg: parseSeg, place: place,
        fromCells: fromCells, setSeg: setSeg, setArc: setArc, hasSeg: hasSeg,
        snap: snap, axisLine: axisLine, rectSegs: rectSegs,
        segTiles: segTiles, segRule: segRule, arcRule: arcRule, otherHalf: otherHalf
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SimLattice = api;
})(typeof window !== 'undefined' ? window : globalThis);
