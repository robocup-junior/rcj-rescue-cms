// Editing a map for the new Simulation 2026 editor (beta): the map is kept in the format of the
// Simulation 2026 editor (cells, roomTiles, startTile, area4Room ...), so either editor opens it.
// Coordinates are the map's cell coordinates (tiles at odd x and y). Needs SimLattice and
// SimWorld2026; loads in the browser as window.SimBetaModel and in Node through require (tests).
(function (root) {
    const L = typeof SimLattice !== 'undefined' ? SimLattice : require('./lattice');
    const W = typeof SimWorld2026 !== 'undefined' ? SimWorld2026 : require('../sim_editor/sim_world_2026');

    const SIDES = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
    const FLOORS = ['black', 'swamp', 'checkpoint'];

    function key(x, y) {
        return x + ',' + y + ',0';
    }

    function inMap(map, x, y) {
        return x > 0 && y > 0 && x < 2 * map.width && y < 2 * map.length;
    }

    function tileOf(map, x, y) {
        const cell = map.cells[key(x, y)];
        return cell && cell.tile;
    }

    // A tile cell with the arrays the editors and the export expect
    function ensureTile(map, x, y) {
        let cell = map.cells[key(x, y)];
        if (!cell) cell = map.cells[key(x, y)] = { isTile: true, tile: {} };
        cell.isTile = true;
        const t = cell.tile || (cell.tile = {});
        if (t.changeFloorTo === undefined) t.changeFloorTo = 0;
        if (!t.curve) t.curve = [0, 0, 0, 0];
        if (!t.halfWallIn) t.halfWallIn = [0, 0, 0, 0];
        if (!t.halfWallVic) t.halfWallVic = [];
        if (!t.halfWallVicRots) t.halfWallVicRots = [];
        if (!t.halfWallVicFakes) t.halfWallVicFakes = [];
        if (!t.halfWallCognitives) t.halfWallCognitives = [];
        return t;
    }

    function ensureTiles(map) {
        for (let x = 1; x < 2 * map.width; x += 2) for (let y = 1; y < 2 * map.length; y += 2) ensureTile(map, x, y);
    }

    function setEdge(map, ex, ey, wall) {
        const cell = map.cells[key(ex, ey)] || (map.cells[key(ex, ey)] = {});
        cell.isWall = !!wall;
        cell.halfWall = 0;
    }

    // A tile can be outside the map's shape (tile.outside, kept only by this editor): the map does not
    // have to be a rectangle. Outside tiles get no floor in the world (the robot cannot reach them).
    function isOutside(map, x, y) {
        const t = tileOf(map, x, y);
        return !!(t && t.outside);
    }

    function isInside(map, x, y) {
        return inMap(map, x, y) && !isOutside(map, x, y);
    }

    // The two tiles beside the edge cell (ex, ey)
    function edgeTiles(ex, ey) {
        return ex % 2 === 0 ? [[ex - 1, ey], [ex + 1, ey]] : [[ex, ey - 1], [ex, ey + 1]];
    }

    // The outer walls: edges with the map on one side only (around the rectangle and its outside tiles)
    function isOuterEdge(map, ex, ey) {
        if ((ex + ey) % 2 !== 1) return false;
        const t = edgeTiles(ex, ey);
        return isInside(map, t[0][0], t[0][1]) !== isInside(map, t[1][0], t[1][1]);
    }

    // The outer walls are always there (as the classic editor's "outer walls" button makes them)
    function outerWalls(map) {
        syncBorderWalls(map, new Set());
    }

    function newMap(width, length) {
        const map = {
            name: 'New world', length: length, height: 1, width: width, finished: true,
            startTile: { x: 0, y: 0, z: 0 }, cells: {}, roomTiles: [[], [], []], time: 480,
            area4Room: W.area4Presets()[0], room4CanvasSave: null, room4VicTypes: [], connCheckOff: false
        };
        ensureTiles(map);
        outerWalls(map);
        return map;
    }

    // Fills in what an older or hand-made map may lack, so the editing below can rely on it
    function normalize(map) {
        if (!map.roomTiles) map.roomTiles = [[], [], []];
        while (map.roomTiles.length < 3) map.roomTiles.push([]);
        if (!map.startTile) map.startTile = { x: 0, y: 0, z: 0 };
        if (!map.area4Room || typeof map.area4Room !== 'object') map.area4Room = W.area4Presets()[0];
        if (!map.height) map.height = 1;
        ensureTiles(map);
        return map;
    }

    // Changes the size, keeping what fits (cells, rooms, the start tile) and the outer walls
    function resize(map, width, length) {
        width = Math.max(1, Math.min(40, Math.round(width)));
        length = Math.max(1, Math.min(40, Math.round(length)));
        // the old outer walls go where the map now carries on, and new ones come on its new border
        const before = borderEdges(map);
        map.width = width;
        map.length = length;
        Object.keys(map.cells).forEach(function (k) {
            const p = k.split(',').map(Number);
            if (p[0] > 2 * width || p[1] > 2 * length) delete map.cells[k];
        });
        map.roomTiles = map.roomTiles.map(function (list) {
            return list.filter(function (k) { const p = k.split(',').map(Number); return p[0] < 2 * width && p[1] < 2 * length; });
        });
        const st = map.startTile;
        if (st.x >= 2 * width || st.y >= 2 * length) map.startTile = { x: 0, y: 0, z: 0 };
        ensureTiles(map);
        syncBorderWalls(map, before);
    }

    // ---- Rooms -----------------------------------------------------------------------------------

    // 1-4, or 0 outside the map (beyond it, or an outside tile)
    function roomOf(map, x, y) {
        if (!isInside(map, x, y)) return 0;
        const k = key(x, y);
        for (let i = 0; i < 3; i++) if ((map.roomTiles[i] || []).indexOf(k) > -1) return i + 2;
        return 1;
    }

    function roomMap(map) {
        const rooms = {};
        for (let x = 1; x < 2 * map.width; x += 2) for (let y = 1; y < 2 * map.length; y += 2) rooms[x + ',' + y] = 1;
        map.roomTiles.forEach(function (list, i) {
            list.forEach(function (k) {
                const p = k.split(',');
                if (p[2] === '0' && (p[0] + ',' + p[1]) in rooms) rooms[p[0] + ',' + p[1]] = i + 2;
            });
        });
        Object.keys(rooms).forEach(function (k) {
            const p = k.split(',').map(Number);
            if (isOutside(map, p[0], p[1])) rooms[k] = 0;
        });
        return rooms;
    }

    function roomLookup(map) {
        const rooms = roomMap(map);
        return function (x, y) { return rooms[x + ',' + y] || 0; };
    }

    // Puts the tile at (x, y) into a room (1 = no room list), or outside the map (0). A tile leaving
    // rooms 2 / 3 loses what only those rooms take: inner walls and half walls on its edges (rooms
    // 1 and 4), curves (every room but 3). An outside tile loses everything on it. Returns whether
    // anything changed.
    function setRoom(map, x, y, room) {
        if (!inMap(map, x, y) || roomOf(map, x, y) === room) return false;
        const k = key(x, y);
        map.roomTiles = map.roomTiles.map(function (list) { return list.filter(function (t) { return t !== k; }); });
        if (room >= 2) map.roomTiles[room - 2].push(k);
        const t = ensureTile(map, x, y);
        if (room === 0) {
            t.outside = true;
            FLOORS.forEach(function (f) { t[f] = false; });
            t.color = '';
            t.victims = {};
            t.cognitives = {};
            t.victim_is_fake = false;
            const st = map.startTile;
            if (st && st.x === x && st.y === y) map.startTile = { x: 0, y: 0, z: 0 };
        } else {
            delete t.outside;
        }
        t.halfTile = room === 2 || room === 3 ? 1 : 0;
        if (room !== 3) t.curve = [0, 0, 0, 0];
        if (room <= 1 || room === 4) {
            t.halfWallIn = [0, 0, 0, 0];
            t.halfWallVic = [];
            t.halfWallVicFakes = [];
            t.halfWallVicRots = [];
            t.halfWallCognitives = [];
            Object.keys(SIDES).forEach(function (d) {
                const e = map.cells[key(x + SIDES[d][0], y + SIDES[d][1])];
                if (e && !e.isWall && e.halfWall) e.halfWall = 0;
            });
        }
        return true;
    }

    // ---- Walls on room borders -------------------------------------------------------------------
    // Where two rooms meet there is a wall, except at a passage: a tile in the passage colour of the
    // two rooms opens onto the other room. A room 4 preset brings its own walls, so its border gets
    // none. The editor keeps the set it made and, after each change of rooms or passages, adds the
    // walls of new borders and takes away those of borders that are gone.

    function passageFor(a, b) {
        return W.ROOM_PASSAGES.find(function (p) { return (p.from === a && p.to === b) || (p.from === b && p.to === a); });
    }

    // The edges that get a wall by themselves: the outer walls (the map on one side only) and the
    // room borders that are not passages
    function borderEdges(map) {
        const room = roomLookup(map);
        const preset = map.area4Room && map.area4Room.type >= 2;
        const edges = new Set();
        const check = function (ex, ey) {
            const t = edgeTiles(ex, ey);
            const ra = room(t[0][0], t[0][1]), rb = room(t[1][0], t[1][1]);
            if (ra === rb) return;
            if (!ra || !rb) { edges.add(ex + ',' + ey); return; }
            if (preset && (ra === 4 || rb === 4)) return;
            const color = passageFor(ra, rb).color;
            const ta = tileOf(map, t[0][0], t[0][1]), tb = tileOf(map, t[1][0], t[1][1]);
            if ((ta && ta.color === color) || (tb && tb.color === color)) return;
            edges.add(ex + ',' + ey);
        };
        for (let ex = 0; ex <= 2 * map.width; ex += 2) for (let ey = 1; ey < 2 * map.length; ey += 2) check(ex, ey);
        for (let ex = 1; ex < 2 * map.width; ex += 2) for (let ey = 0; ey <= 2 * map.length; ey += 2) check(ex, ey);
        return edges;
    }

    // A passage tile that no longer lies between its two rooms loses its colour: it has to be in one
    // of them and touch the other
    function prunePassages(map) {
        let n = 0;
        for (let x = 1; x < 2 * map.width; x += 2) {
            for (let y = 1; y < 2 * map.length; y += 2) {
                const t = tileOf(map, x, y);
                const pass = t && t.color && W.ROOM_PASSAGES.find(function (p) { return p.color === t.color; });
                if (!pass) continue;
                const own = roomOf(map, x, y);
                const other = own === pass.from ? pass.to : own === pass.to ? pass.from : 0;
                const touches = other && Object.keys(SIDES).some(function (d) {
                    return roomOf(map, x + 2 * SIDES[d][0], y + 2 * SIDES[d][1]) === other;
                });
                if (!touches) { t.color = ''; n++; }
            }
        }
        return n;
    }

    // The new editor makes room 4 only as a picture (custom): it is custom as soon as it has tiles,
    // and none without. A preset (from a map of the classic editor) stays until it is switched.
    function syncArea4(map) {
        const type = map.area4Room && map.area4Room.type;
        if (type >= 2) return;
        const want = (map.roomTiles[2] || []).length ? 1 : 0;
        if (type !== want) map.area4Room = W.area4Presets()[want];
    }

    // Rule 3.5.3: a checkpoint right behind each passage into area 4. The room 4 tile inside each
    // passage becomes a checkpoint by itself (tile.cpAuto marks it); one set so that no passage needs
    // any more goes again. A checkpoint set by hand stays.
    function room4Checkpoints(map) {
        const need = {};
        if (map.area4Room && map.area4Room.type === 1) {
            W.mapGeometry(map).entrances.forEach(function (e) {
                if (e.passage) need[(2 * e.tile[0] + 1) + ',' + (2 * e.tile[1] + 1)] = true;
            });
        }
        for (let x = 1; x < 2 * map.width; x += 2) {
            for (let y = 1; y < 2 * map.length; y += 2) {
                const t = tileOf(map, x, y);
                if (!t) continue;
                if (need[x + ',' + y]) {
                    if (!t.checkpoint) { FLOORS.forEach(function (f) { t[f] = false; }); t.checkpoint = true; t.cpAuto = true; }
                } else if (t.cpAuto) {
                    t.checkpoint = false;
                    delete t.cpAuto;
                }
            }
        }
    }

    function syncBorderWalls(map, before) {
        syncArea4(map);
        prunePassages(map);
        const after = borderEdges(map);
        after.forEach(function (e) {
            if (before.has(e)) return;
            const p = e.split(',').map(Number);
            setEdge(map, p[0], p[1], true);
        });
        before.forEach(function (e) {
            if (after.has(e)) return;
            const p = e.split(',').map(Number);
            if (p[0] <= 2 * map.width && p[1] <= 2 * map.length) setEdge(map, p[0], p[1], false);
        });
        room4Checkpoints(map);
        return after;
    }

    // After a change that may have taken walls off borders (pasting, moving, rows / columns): every
    // border edge gets its wall again, and the walls of borders that are gone come off
    function resyncBorderWalls(map, before) {
        syncArea4(map);
        prunePassages(map);
        const after = borderEdges(map);
        after.forEach(function (e) {
            const p = e.split(',').map(Number);
            setEdge(map, p[0], p[1], true);
        });
        before.forEach(function (e) {
            if (after.has(e)) return;
            const p = e.split(',').map(Number);
            if (p[0] <= 2 * map.width && p[1] <= 2 * map.length) setEdge(map, p[0], p[1], false);
        });
        room4Checkpoints(map);
        return after;
    }

    // The edge (ex, ey) between two tiles of different rooms: its two tiles, rooms and passage
    function borderAt(map, ex, ey) {
        if ((ex + ey) % 2 !== 1) return null;
        const t = edgeTiles(ex, ey);
        const ra = roomOf(map, t[0][0], t[0][1]), rb = roomOf(map, t[1][0], t[1][1]);
        if (!ra || !rb || ra === rb) return null;
        return { a: t[0], b: t[1], ra: ra, rb: rb, pass: passageFor(ra, rb) };
    }

    // The tile of a border that takes the passage colour when `side` ([x, y], one of its two tiles)
    // is asked for: that one, except in room 4 - a preset or a picture - whose entrances lie outside it
    function passageSide(map, b, side) {
        let pick = side && side[0] === b.b[0] && side[1] === b.b[1] ? 'b' : side ? 'a' : (b.ra < b.rb ? 'a' : 'b');
        if ((pick === 'a' ? b.ra : b.rb) === 4) pick = pick === 'a' ? 'b' : 'a';
        return pick === 'a' ? b.a : b.b;
    }

    // At a border edge: opens a passage with its colour on the side asked for (by default the
    // lower room number), moves it there from the other side, or closes it when it is there already.
    // Returns 'open', 'moved', 'closed' or '' (not a border).
    function togglePassage(map, ex, ey, side) {
        const b = borderAt(map, ex, ey);
        if (!b) return '';
        const want = passageSide(map, b, side);
        const ta = ensureTile(map, b.a[0], b.a[1]), tb = ensureTile(map, b.b[0], b.b[1]);
        const target = want === b.a ? ta : tb, other = want === b.a ? tb : ta;
        if (target.color === b.pass.color) { target.color = ''; return 'closed'; }
        const moved = other.color === b.pass.color;
        if (moved) other.color = '';
        target.color = b.pass.color;
        return moved ? 'moved' : 'open';
    }

    // Takes the passage colour off the tile at (x, y)
    function clearPassage(map, x, y) {
        const t = tileOf(map, x, y);
        if (!t || !t.color || !W.ROOM_PASSAGES.some(function (p) { return p.color === t.color; })) return false;
        t.color = '';
        return true;
    }

    // ---- Walls -------------------------------------------------------------------------------------

    // The unit segments that would go in for `segs`, by the rules of the rooms they touch: beside
    // room 1 a segment takes its whole tile edge with it. { ok: [...], bad: [...] }
    function wallPlan(map, segs) {
        const room = roomLookup(map);
        const ok = new Set(), bad = new Set();
        segs.forEach(function (s) {
            const rule = L.segRule(s, room);
            if (!rule.ok) { bad.add(s); return; }
            ok.add(s);
            if (rule.whole) ok.add(L.otherHalf(s));
        });
        return { ok: Array.from(ok), bad: Array.from(bad).filter(function (s) { return !ok.has(s); }) };
    }

    function isOuterSeg(map, seg) {
        const at = L.place(seg);
        const p = at.cell.split(',').map(Number);
        return at.kind === 'edge' && isOuterEdge(map, p[0], p[1]);
    }

    function setWalls(map, segs, on) {
        let n = 0;
        segs.forEach(function (s) {
            if (isOuterSeg(map, s) || L.hasSeg(map, s) === !!on) return;
            L.setSeg(map, s, on);
            n++;
        });
        return n;
    }

    // The unit segment nearest to (x, y) cm within `reach` cm, outer walls left out
    function segNear(map, x, y, reach) {
        const walls = L.fromCells(map);
        let best = null, bestD = reach;
        walls.segs.forEach(function (s) {
            if (isOuterSeg(map, s)) return;
            const g = L.parseSeg(s);
            const x1 = 6 * g.i, y1 = 6 * g.j, x2 = g.dir === 'v' ? x1 : x1 + 6, y2 = g.dir === 'v' ? y1 + 6 : y1;
            const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / 36));
            const d = Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1));
            if (d < bestD) { bestD = d; best = s; }
        });
        return best;
    }

    // ---- Floors and victims ------------------------------------------------------------------------

    // kind: black, swamp, checkpoint (each turns the others off; again turns it off), start, clear
    function setFloor(map, x, y, kind) {
        if (!isInside(map, x, y)) return false;
        if (kind === 'start') {
            map.startTile = { x: x, y: y, z: 0 };
            return true;
        }
        const t = ensureTile(map, x, y);
        const was = !!t[kind];
        FLOORS.forEach(function (f) { t[f] = false; });
        if (kind !== 'clear') t[kind] = !was;
        delete t.cpAuto;
        return true;
    }

    function hasWall(map, x, y, dir) {
        const e = map.cells[key(x + SIDES[dir][0], y + SIDES[dir][1])];
        return !!(e && e.isWall);
    }

    function edgeVictim(map, x, y) {
        const t = tileOf(map, x, y);
        if (!t) return null;
        for (const d of Object.keys(SIDES)) {
            const v = t.victims && t.victims[d];
            const code = t.cognitives && t.cognitives[d + '_code'];
            if (v || code) return { dir: d, type: code ? 'CT' : v || '', code: code || '', fake: !!t.victim_is_fake };
        }
        return null;
    }

    // A letter victim (H, S, U) on the wall at side `dir` of the tile; a tile holds one (as in the
    // classic editor). Rooms 2 and 3 place victims on their 6 cm walls instead (next stage).
    function victimRule(map, x, y, dir) {
        if (!isInside(map, x, y)) return { ok: false, reason: 'outside' };
        const room = roomOf(map, x, y);
        if (room === 4) return { ok: false, reason: 'room4' };
        if (room === 2 || room === 3) return { ok: false, reason: 'quarterTile' };
        if (!hasWall(map, x, y, dir)) return { ok: false, reason: 'noWall' };
        return { ok: true };
    }

    // type H, S, U (letters) or CT (a cognitive target: opts.code = its ring code, K R Y G B from the
    // outside in, as Erebus draws it); opts.rot = the turn of the token in degrees
    function setVictim(map, x, y, dir, type, fake, opts) {
        opts = opts || {};
        if (!victimRule(map, x, y, dir).ok) return false;
        const t = ensureTile(map, x, y);
        t.victims = {};
        t.cognitives = {};
        if (type === 'CT') {
            // the classic editor keeps the letter of a valid code beside it (scores read it)
            const letter = W.cognitiveCodeToVictimLetter(opts.code);
            t.cognitives[dir + '_code'] = opts.code;
            if (letter) t.victims[dir] = letter;
            t.victim_is_fake = false;
        } else {
            t.victims[dir] = type;
            t.victim_is_fake = !!fake;
        }
        t.single_victim_rotation = opts.rot || 0;
        return true;
    }

    function clearVictim(map, x, y) {
        const t = tileOf(map, x, y);
        if (!t || !edgeVictim(map, x, y)) return false;
        t.victims = {};
        t.cognitives = {};
        t.victim_is_fake = false;
        return true;
    }

    // ---- Curves (room 3) ----------------------------------------------------------------------------
    // Quarter q (NW, NE, SW, SE) of tile (x, y) takes one quarter circle of radius 6 cm; its value v
    // names where it bulges (1 NE, 2 SE, 3 SW, 4 NW), so its centre is the opposite corner.

    function quarterAt(map, px, py) {
        const tx = Math.floor(px / 12), ty = Math.floor(py / 12);
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.length) return null;
        const q = (py - 12 * ty >= 6 ? 2 : 0) + (px - 12 * tx >= 6 ? 1 : 0);
        return { x: 2 * tx + 1, y: 2 * ty + 1, q: q };
    }

    function arcCentre(x, y, q, v) {
        const ox = 6 * (x - 1) + (q % 2) * 6, oy = 6 * (y - 1) + Math.floor(q / 2) * 6;
        const c = [[0, 6], [0, 0], [6, 0], [6, 6]][v - 1];
        return [ox + c[0], oy + c[1]];
    }

    function arcDistance(x, y, q, v, px, py) {
        const c = arcCentre(x, y, q, v);
        return Math.abs(Math.hypot(px - c[0], py - c[1]) - 6);
    }

    // The curve of the quarter under (px, py) that passes nearest to it
    function arcChoice(map, px, py) {
        const at = quarterAt(map, px, py);
        if (!at) return null;
        let best = 1;
        for (let v = 2; v <= 4; v++) if (arcDistance(at.x, at.y, at.q, v, px, py) < arcDistance(at.x, at.y, at.q, best, px, py)) best = v;
        at.v = best;
        at.rule = L.arcRule(roomOf(map, at.x, at.y));
        return at;
    }

    // Sets curve v in a quarter (0 takes it out); only room 3 takes curves
    function setCurve(map, x, y, q, v) {
        if (v && !L.arcRule(roomOf(map, x, y)).ok) return false;
        const t = ensureTile(map, x, y);
        if (Number(t.curve[q]) === v) return false;
        L.setArc(map, x, y, q, v);
        return true;
    }

    // The curve within `reach` cm of (px, py), if any
    function arcNear(map, px, py, reach) {
        let best = null, bestD = reach;
        const tx = Math.floor(px / 12), ty = Math.floor(py / 12);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const x = 2 * (tx + dx) + 1, y = 2 * (ty + dy) + 1;
                const t = tileOf(map, x, y);
                if (!t || !t.curve) continue;
                t.curve.forEach(function (v, q) {
                    v = Number(v);
                    if (!v) return;
                    const ox = 6 * (x - 1) + (q % 2) * 6, oy = 6 * (y - 1) + Math.floor(q / 2) * 6;
                    if (px < ox - reach || py < oy - reach || px > ox + 6 + reach || py > oy + 6 + reach) return;
                    const d = arcDistance(x, y, q, v, px, py);
                    if (d < bestD) { bestD = d; best = { x: x, y: y, q: q, v: v }; }
                });
            }
        }
        return best;
    }

    // ---- Victims on the 6 cm walls (rooms 2 and 3) -------------------------------------------------
    // Slot i = quarter (NW, NE, SW, SE) * 4 + side (top, right, bottom, left), as halfWallVic. A slot
    // is on a wall when the tile edge (whole, or the half wall over that half) is there, or the inner
    // half wall, or - in a quarter with a curve - that curve. Same as the classic tile dialog.
    const SLOT_VALUE = { H: '1', U: '2', S: '3' };
    const SLOT_TYPE = { 1: 'H', 2: 'U', 3: 'S' };

    function slotHasWall(map, x, y, i) {
        const q = Math.floor(i / 4), side = i % 4, qx = q % 2, qy = Math.floor(q / 2);
        const t = tileOf(map, x, y);
        if (!t) return false;
        if (t.curve && Number(t.curve[q])) return true;
        const inner = t.halfWallIn || [];
        const outer = function (dx, dy, half) {
            const c = map.cells[key(x + dx, y + dy)];
            return !!c && (c.isWall || c.halfWall == half);
        };
        switch (side) {
            case 0: return qy === 0 ? outer(0, -1, qx + 1) : !!inner[qx ? 1 : 3];
            case 1: return qx === 1 ? outer(1, 0, qy ? 1 : 2) : !!inner[qy ? 2 : 0];
            case 2: return qy === 1 ? outer(0, 1, qx + 1) : !!inner[qx ? 1 : 3];
            case 3: return qx === 0 ? outer(-1, 0, qy ? 1 : 2) : !!inner[qy ? 2 : 0];
        }
        return false;
    }

    // Where slot i of tile (x, y) is drawn, cm (on a curve: beside the face of the arc it is on)
    function slotPos(x, y, i, map) {
        const t = map && tileOf(map, x, y);
        return L.slotPoint(x, y, i, t && t.curve).at;
    }

    // The slot of the quarter under (px, py): on the side it is nearest to, or - in a quarter with a
    // curve - on the face of the arc on its side (inside / outside the arc); a victim already on that
    // face keeps its own slot
    function slotAt(map, px, py) {
        const at = quarterAt(map, px, py);
        if (!at) return null;
        const t = tileOf(map, at.x, at.y);
        const v = t && t.curve ? Number(t.curve[at.q]) || 0 : 0;
        if (v) {
            const c = L.curveCentre(at.x, at.y, at.q, v);
            const inside = Math.hypot(px - c[0], py - c[1]) < 6;
            for (let side = 0; side < 4; side++) {
                if (L.curveInside(v, side) === inside && slotVictim(map, at.x, at.y, at.q * 4 + side)) return { x: at.x, y: at.y, i: at.q * 4 + side };
            }
            return { x: at.x, y: at.y, i: at.q * 4 + L.curveSide(v, inside) };
        }
        const cx = 6 * at.x - 3 + (at.q % 2) * 6, cy = 6 * at.y - 3 + Math.floor(at.q / 2) * 6;
        const dx = px - cx, dy = py - cy;
        const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        return { x: at.x, y: at.y, i: at.q * 4 + side };
    }

    function slotVictim(map, x, y, i) {
        const t = tileOf(map, x, y);
        if (!t) return null;
        const v = t.halfWallVic && t.halfWallVic[i];
        const code = t.halfWallCognitives && t.halfWallCognitives[i];
        if ((!v || v == 0) && !code) return null;
        return { type: code ? 'CT' : SLOT_TYPE[v] || '', value: v, code: code || '', fake: !!(t.halfWallVicFakes && t.halfWallVicFakes[i]) };
    }

    function slotRule(map, x, y, i) {
        const room = roomOf(map, x, y);
        if (room !== 2 && room !== 3) return { ok: false, reason: 'notQuarterTile' };
        if (!slotHasWall(map, x, y, i)) return { ok: false, reason: 'noWall' };
        return { ok: true };
    }

    const CT_VALUE = { F: 5, P: 6, C: 7, O: 8 };

    // As setVictim, for slot i of a room 2 / 3 tile
    function setSlotVictim(map, x, y, i, type, fake, opts) {
        opts = opts || {};
        if (!slotRule(map, x, y, i).ok) return false;
        const t = ensureTile(map, x, y);
        if (type === 'CT') {
            const letter = W.cognitiveCodeToVictimLetter(opts.code);
            t.halfWallCognitives[i] = opts.code;
            t.halfWallVic[i] = letter ? CT_VALUE[letter] : null;
            t.halfWallVicFakes[i] = false;
        } else {
            t.halfWallVic[i] = SLOT_VALUE[type];
            t.halfWallCognitives[i] = '';
            t.halfWallVicFakes[i] = !!fake;
        }
        t.halfWallVicRots[i] = opts.rot || 0;
        return true;
    }

    function clearSlotVictim(map, x, y, i) {
        const t = tileOf(map, x, y);
        if (!t || !slotVictim(map, x, y, i)) return false;
        t.halfWallVic[i] = '';
        if (t.halfWallCognitives) t.halfWallCognitives[i] = '';
        if (t.halfWallVicFakes) t.halfWallVicFakes[i] = false;
        return true;
    }

    // ---- A placed victim, looked at and changed (select tool) --------------------------------------
    // where: { kind: 'edge', x, y, dir } or { kind: 'slot', x, y, i }

    function victimAt(map, where) {
        const v = where.kind === 'edge' ? edgeVictim(map, where.x, where.y) : slotVictim(map, where.x, where.y, where.i);
        if (!v || (where.kind === 'edge' && v.dir !== where.dir)) return null;
        const t = tileOf(map, where.x, where.y);
        v.rot = Number(where.kind === 'edge' ? t.single_victim_rotation : (t.halfWallVicRots || [])[where.i]) || 0;
        return v;
    }

    // Changes what is given of type (H, S, U), fake and rot; a cognitive target keeps its code
    function changeVictim(map, where, change) {
        const v = victimAt(map, where);
        if (!v) return false;
        const type = change.type && v.type !== 'CT' ? change.type : v.type;
        const fake = change.fake === undefined ? v.fake : change.fake;
        const rot = change.rot === undefined ? v.rot : ((Number(change.rot) % 360) + 360) % 360;
        const opts = { code: change.code || v.code, rot: rot };
        if (where.kind === 'edge') return setVictim(map, where.x, where.y, where.dir, type, fake, opts);
        return setSlotVictim(map, where.x, where.y, where.i, type, fake, opts);
    }

    function removeVictim(map, where) {
        return where.kind === 'edge' ? clearVictim(map, where.x, where.y) : clearSlotVictim(map, where.x, where.y, where.i);
    }

    // ---- Regions of tiles: copy, clear, paste (the select tool) ------------------------------------
    // r = { x0, y0, x1, y1 }: tile indices, both ends in. A region holds its tiles (with what is on
    // them and their room) and the edges round and inside them.

    function regionCells(r) {
        const keys = [];
        for (let x = 2 * r.x0; x <= 2 * r.x1 + 2; x++) {
            for (let y = 2 * r.y0; y <= 2 * r.y1 + 2; y++) {
                if (x % 2 === 0 && y % 2 === 0) continue;   // corners hold nothing
                keys.push([x, y]);
            }
        }
        return keys;
    }

    function copyRegion(map, r) {
        const clip = { w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1, cells: {}, rooms: {} };
        regionCells(r).forEach(function (p) {
            const cell = map.cells[key(p[0], p[1])];
            const rk = (p[0] - 2 * r.x0) + ',' + (p[1] - 2 * r.y0);
            if (cell) clip.cells[rk] = JSON.parse(JSON.stringify(cell));
            if (p[0] % 2 === 1 && p[1] % 2 === 1) clip.rooms[rk] = isOutside(map, p[0], p[1]) ? 0 : roomOf(map, p[0], p[1]);
        });
        return clip;
    }

    function clearTile(map, x, y) {
        const k = key(x, y);
        map.roomTiles = map.roomTiles.map(function (list) { return list.filter(function (t) { return t !== k; }); });
        map.cells[k] = { isTile: true, tile: {} };
        ensureTile(map, x, y);
        const st = map.startTile;
        if (st && st.x === x && st.y === y) map.startTile = { x: 0, y: 0, z: 0 };
    }

    // Empties the region: room 1 tiles with nothing on them, no walls inside or round it (the outer
    // walls and room borders come back with resyncBorderWalls)
    function clearRegion(map, r) {
        regionCells(r).forEach(function (p) {
            if (p[0] % 2 === 1 && p[1] % 2 === 1) clearTile(map, p[0], p[1]);
            else if (map.cells[key(p[0], p[1])]) setEdge(map, p[0], p[1], false);
        });
    }

    // Puts a copied region with its top left tile at (tx, ty); what falls off the map is left out
    function pasteRegion(map, clip, tx, ty) {
        const ox = 2 * tx, oy = 2 * ty;
        Object.keys(clip.rooms).forEach(function (rk) {
            const p = rk.split(',').map(Number);
            const x = p[0] + ox, y = p[1] + oy;
            if (!inMap(map, x, y)) return;
            clearTile(map, x, y);
            if (clip.cells[rk]) map.cells[key(x, y)] = JSON.parse(JSON.stringify(clip.cells[rk]));
            ensureTile(map, x, y);
            const room = clip.rooms[rk];
            if (room >= 2) map.roomTiles[room - 2].push(key(x, y));
            if (room === 0) map.cells[key(x, y)].tile.outside = true;
            else delete map.cells[key(x, y)].tile.outside;
        });
        for (let x = 0; x <= 2 * clip.w; x++) {
            for (let y = 0; y <= 2 * clip.h; y++) {
                if ((x + y) % 2 !== 1) continue;
                const ex = x + ox, ey = y + oy;
                if (ex < 0 || ey < 0 || ex > 2 * map.width || ey > 2 * map.length) continue;
                const c = clip.cells[x + ',' + y];
                map.cells[key(ex, ey)] = c ? JSON.parse(JSON.stringify(c)) : { isWall: false, halfWall: 0 };
            }
        }
    }

    // ---- Rows and columns (as the classic editor inserts and removes them) ---------------------------
    // Grid indices: tiles odd, the edges between them even. insertLine adds a tile line after edge
    // line g (0 = before the first); removeLine takes out tile line t with the edge line after it
    // (before it at the far end, so the border stays).

    function shiftKey(k, axis, from, amount) {
        const p = k.split(',').map(Number);
        const i = axis === 'x' ? 0 : 1;
        if (p[i] >= from) p[i] += amount;
        return p.join(',');
    }

    function insertLine(map, axis, g) {
        const size = axis === 'x' ? map.width : map.length;
        if (size >= 40) return false;
        const atEnd = g >= 2 * size;
        const from = atEnd ? g : g + 1;
        const cells = {};
        Object.keys(map.cells).forEach(function (k) { cells[shiftKey(k, axis, from, 2)] = map.cells[k]; });
        const fresh = g + 1;
        const other = axis === 'x' ? map.length : map.width;
        const keyAt = function (a, b) { return axis === 'x' ? a + ',' + b + ',0' : b + ',' + a + ',0'; };
        // walls that run across the new line are carried over it
        for (let b = 0; b <= 2 * other; b += 2) {
            const before = cells[keyAt(fresh - 2, b)], after = cells[keyAt(fresh + 2, b)];
            const wallBefore = g > 0 && before && before.isWall;
            const wallAfter = !atEnd && after && after.isWall;
            if ((wallBefore && wallAfter) || (g === 0 && wallAfter) || (atEnd && wallBefore)) cells[keyAt(fresh, b)] = { isWall: true, halfWall: 0 };
        }
        map.cells = cells;
        // a new tile between two tiles of the same room joins it; between two outside tiles, it is outside
        const rooms = map.roomTiles.map(function (list) { return list.map(function (k) { return shiftKey(k, axis, from, 2); }); });
        if (g > 0 && !atEnd) {
            for (let b = 1; b < 2 * other; b += 2) {
                rooms.forEach(function (list) {
                    if (list.indexOf(keyAt(fresh - 2, b)) > -1 && list.indexOf(keyAt(fresh + 2, b)) > -1) list.push(keyAt(fresh, b));
                });
                const a = cells[keyAt(fresh - 2, b)], c = cells[keyAt(fresh + 2, b)];
                if (a && a.tile && a.tile.outside && c && c.tile && c.tile.outside) cells[keyAt(fresh, b)] = { isTile: true, tile: { outside: true } };
            }
        }
        map.roomTiles = rooms;
        const st = map.startTile;
        if (st && st.x > 0 && (axis === 'x' ? st.x : st.y) >= from) { if (axis === 'x') st.x += 2; else st.y += 2; }
        if (axis === 'x') map.width++; else map.length++;
        ensureTiles(map);
        return true;
    }

    function removeLine(map, axis, t) {
        const size = axis === 'x' ? map.width : map.length;
        if (size <= 1) return false;
        const atEnd = t >= 2 * size - 1;
        const gone = atEnd ? [t - 1, t] : [t, t + 1];
        const i = axis === 'x' ? 0 : 1;
        const cells = {};
        Object.keys(map.cells).forEach(function (k) {
            const p = k.split(',').map(Number);
            if (gone.indexOf(p[i]) > -1) return;
            cells[shiftKey(k, axis, gone[1] + 1, -2)] = map.cells[k];
        });
        map.cells = cells;
        map.roomTiles = map.roomTiles.map(function (list) {
            return list.filter(function (k) { return Number(k.split(',')[i]) !== t; })
                .map(function (k) { return shiftKey(k, axis, gone[1] + 1, -2); });
        });
        const st = map.startTile;
        if (st && st.x > 0) {
            const v = axis === 'x' ? st.x : st.y;
            if (v === t) map.startTile = { x: 0, y: 0, z: 0 };
            else if (v > t) { if (axis === 'x') st.x -= 2; else st.y -= 2; }
        }
        if (axis === 'x') map.width--; else map.length--;
        ensureTiles(map);
        return true;
    }

    // ---- Problems ----------------------------------------------------------------------------------
    // { key, params, block, at }: block = the world export stops for it; at = [x, y] cm to show

    function tileCentre(k) {
        const p = String(k).split(',').map(Number);
        return [6 * p[0], 6 * p[1]];
    }

    // ---- Where the robot can go ---------------------------------------------------------------------
    // As the custom room 4 creator works it out, on a 0.5 cm grid over the map: the walls are 1 cm
    // thick; a robot centre may be where it keeps its radius (3.7 cm) from every wall, so it passes a
    // 12 cm gap but not a 6 cm one; from the start tile the free places joined to it are reached; the
    // floor its body (within its radius of a reached centre) never covers is out of reach, leaving
    // out specks under 5 cm2 (the corners a round robot cannot fill). Room 4's inside is a picture,
    // so it is taken as open, and rooms the robot does not get into at all (no passage yet, pointed
    // out on their own) are left out.
    // Out: { res, gw, gh, reached (Uint8Array, 1 = a centre gets there), miss (Uint8Array, 1 = out of
    // reach), pocketCount, pocketAt(x, y) cm, victims: [[x, y]] cm of the victims it cannot get to },
    // or null without a start tile.
    const REACH_RES = 0.5, ROBOT_R = 3.7, WALL_HALF = 0.5, VICTIM_NEAR = 6, SPECK_CM2 = 5;

    // Distance (in cells) from every cell to the nearest cell with src set, two passes over a 5 x 5
    // chamfer mask (close to the straight-line distance)
    function distanceTo(src, gw, gh) {
        const INF = 1e9, d = new Float32Array(gw * gh);
        for (let i = 0; i < gw * gh; i++) d[i] = src[i] ? 0 : INF;
        const r2 = Math.SQRT2, r5 = Math.sqrt(5);
        const fwd = [[-1, 0, 1], [-1, -1, r2], [0, -1, 1], [1, -1, r2], [-2, -1, r5], [-1, -2, r5], [1, -2, r5], [2, -1, r5]];
        const pass = function (mask, y0, y1, dy, x0, x1, dx) {
            for (let y = y0; y !== y1; y += dy) {
                for (let x = x0; x !== x1; x += dx) {
                    const i = y * gw + x;
                    let v = d[i];
                    for (let k = 0; k < mask.length; k++) {
                        const nx = x + mask[k][0], ny = y + mask[k][1];
                        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
                        const c = d[ny * gw + nx] + mask[k][2];
                        if (c < v) v = c;
                    }
                    d[i] = v;
                }
            }
        };
        pass(fwd, 0, gh, 1, 0, gw, 1);
        pass(fwd.map(function (m) { return [-m[0], -m[1], m[2]]; }), gh - 1, -1, -1, gw - 1, -1, -1);
        return d;
    }

    function robotReach(map) {
        const st = map.startTile;
        if (!st || !(st.x > 0 && st.y > 0)) return null;
        const res = REACH_RES, gw = Math.round(12 * map.width / res), gh = Math.round(12 * map.length / res);
        const at = function (x, y) { return Math.floor(y / res) * gw + Math.floor(x / res); };
        // walls (and the floor that is not there: outside tiles) on the grid
        const wall = new Uint8Array(gw * gh);
        const markSeg = function (a, b) {
            const r = WALL_HALF;
            const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - r) / res)), i1 = Math.min(gw - 1, Math.ceil((Math.max(a[0], b[0]) + r) / res));
            const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - r) / res)), j1 = Math.min(gh - 1, Math.ceil((Math.max(a[1], b[1]) + r) / res));
            const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
            for (let j = j0; j <= j1; j++) {
                for (let i = i0; i <= i1; i++) {
                    const px = (i + 0.5) * res, py = (j + 0.5) * res;
                    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
                    if (Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy) <= r) wall[j * gw + i] = 1;
                }
            }
        };
        const outside = new Uint8Array(gw * gh);
        for (let x = 1; x < 2 * map.width; x += 2) {
            for (let y = 1; y < 2 * map.length; y += 2) {
                if (!isOutside(map, x, y)) continue;
                for (let j = 6 * (y - 1) / res; j < 6 * (y + 1) / res; j++)
                    for (let i = 6 * (x - 1) / res; i < 6 * (x + 1) / res; i++) { wall[j * gw + i] = 1; outside[j * gw + i] = 1; }
            }
        }
        const walls = L.fromCells(map);
        const pieces = [];      // every wall as short straight pieces (curves too), for line of sight
        walls.segs.forEach(function (k) {
            const g = L.parseSeg(k);
            const a = [6 * g.i, 6 * g.j], b = g.dir === 'h' ? [6 * g.i + 6, 6 * g.j] : [6 * g.i, 6 * g.j + 6];
            markSeg(a, b);
            pieces.push([a, b]);
        });
        // a curve: the quarter of the circle (radius 6) about its centre inside its quarter, in short pieces
        walls.arcs.forEach(function (a) {
            const c = L.curveCentre(a.x, a.y, a.q, a.v);
            const ox = 6 * (a.x - 1) + (a.q % 2) * 6, oy = 6 * (a.y - 1) + Math.floor(a.q / 2) * 6;
            const pts = [];
            for (let k = 0; k <= 96; k++) {
                const t = 2 * Math.PI * k / 96, p = [c[0] + 6 * Math.cos(t), c[1] + 6 * Math.sin(t)];
                if (p[0] >= ox - 0.01 && p[0] <= ox + 6.01 && p[1] >= oy - 0.01 && p[1] <= oy + 6.01) pts.push(p);
            }
            for (let k = 1; k < pts.length; k++) {
                if (Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) >= 1) continue;
                markSeg(pts[k - 1], pts[k]);
                pieces.push([pts[k - 1], pts[k]]);
            }
        });
        // the map's edge is a wall too
        const dWall = (function () {
            const src = new Uint8Array(gw * gh);
            for (let i = 0; i < gw * gh; i++) src[i] = wall[i];
            return distanceTo(src, gw, gh);
        })();
        const edgeDist = function (i, j) { return Math.min(i + 0.5, j + 0.5, gw - i - 0.5, gh - j - 0.5); };
        const need = ROBOT_R / res;
        const free = new Uint8Array(gw * gh);
        for (let j = 0; j < gh; j++)
            for (let i = 0; i < gw; i++) free[j * gw + i] = dWall[j * gw + i] >= need && edgeDist(i, j) >= need ? 1 : 0;
        // from the start: its nearest free cell, then everything joined to it (8 ways)
        const reached = new Uint8Array(gw * gh);
        let seed = -1;
        const sx = Math.floor(6 * st.x / res), sy = Math.floor(6 * st.y / res);
        for (let r = 0; r < 12 / res && seed < 0; r++) {
            for (let y = sy - r; y <= sy + r && seed < 0; y++) for (let x = sx - r; x <= sx + r; x++) {
                if (x >= 0 && y >= 0 && x < gw && y < gh && free[y * gw + x]) { seed = y * gw + x; break; }
            }
        }
        if (seed >= 0) {
            const stack = [seed];
            reached[seed] = 1;
            while (stack.length) {
                const q = stack.pop(), qx = q % gw, qy = (q - qx) / gw;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const nx = qx + dx, ny = qy + dy;
                    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
                    const n = ny * gw + nx;
                    if (!reached[n] && free[n]) { reached[n] = 1; stack.push(n); }
                }
            }
        }
        // the floor its body covers
        const dReach = distanceTo(reached, gw, gh);
        const covered = function (n) { return dReach[n] <= need + 0.5; };
        // rooms it gets into at all
        const roomIn = {};
        const roomAtCell = function (n) {
            const i = n % gw, j = (n - i) / gw;
            return roomOf(map, 2 * Math.floor(i * res / 12) + 1, 2 * Math.floor(j * res / 12) + 1);
        };
        for (let n = 0; n < gw * gh; n++) if (reached[n]) roomIn[roomAtCell(n)] = true;
        // the floor of rooms 1-3 out of reach, without specks
        const miss = new Uint8Array(gw * gh);
        for (let n = 0; n < gw * gh; n++) {
            if (wall[n] || outside[n] || covered(n)) continue;
            const room = roomAtCell(n);
            if (room === 4 || !roomIn[room]) continue;
            miss[n] = 1;
        }
        const minCells = SPECK_CM2 / (res * res);
        const seen = new Uint8Array(gw * gh);
        let pocketCount = 0;
        for (let start = 0; start < gw * gh; start++) {
            if (!miss[start] || seen[start]) continue;
            const region = [start];
            seen[start] = 1;
            for (let h = 0; h < region.length; h++) {
                const q = region[h], qx = q % gw, qy = (q - qx) / gw;
                const next = [qx > 0 ? q - 1 : -1, qx < gw - 1 ? q + 1 : -1, qy > 0 ? q - gw : -1, qy < gh - 1 ? q + gw : -1];
                for (let k = 0; k < 4; k++) if (next[k] >= 0 && miss[next[k]] && !seen[next[k]]) { seen[next[k]] = 1; region.push(next[k]); }
            }
            if (region.length < minCells) region.forEach(function (q) { miss[q] = 0; });
            else pocketCount++;
        }
        const pocketAt = function (x, y) {
            if (x < 0 || y < 0 || x >= 12 * map.width || y >= 12 * map.length) return false;
            return !!miss[at(x, y)];
        };
        // a victim is got to when a reached centre is near its wall, on the side it faces, with no wall
        // between them; one in a place out of reach never is
        const cross = function (p, q, a, b) {
            const d = function (u, v, w2) { return (v[0] - u[0]) * (w2[1] - u[1]) - (v[1] - u[1]) * (w2[0] - u[0]); };
            const d1 = d(a, b, p), d2 = d(a, b, q), d3 = d(p, q, a), d4 = d(p, q, b);
            return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
        };
        const seenFrom = function (p, q) {
            const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
            return !pieces.some(function (s2) {
                if (Math.max(s2[0][0], s2[1][0]) < x0 || Math.min(s2[0][0], s2[1][0]) > x1 || Math.max(s2[0][1], s2[1][1]) < y0 || Math.min(s2[0][1], s2[1][1]) > y1) return false;
                return cross(p, q, s2[0], s2[1]);
            });
        };
        const near = function (pt, wallPt) {
            if (pocketAt(pt[0], pt[1])) return false;
            const n = [pt[0] - wallPt[0], pt[1] - wallPt[1]], r = VICTIM_NEAR;
            for (let j = Math.max(0, Math.floor((wallPt[1] - r) / res)); j <= Math.min(gh - 1, Math.ceil((wallPt[1] + r) / res)); j++) {
                for (let i = Math.max(0, Math.floor((wallPt[0] - r) / res)); i <= Math.min(gw - 1, Math.ceil((wallPt[0] + r) / res)); i++) {
                    if (!reached[j * gw + i]) continue;
                    const c = [(i + 0.5) * res, (j + 0.5) * res], dx = c[0] - wallPt[0], dy = c[1] - wallPt[1];
                    if (Math.hypot(dx, dy) <= r && dx * n[0] + dy * n[1] > 0 && seenFrom(c, pt)) return true;
                }
            }
            return false;
        };
        const skip = function (x, y) { return isOutside(map, x, y) || roomOf(map, x, y) === 4 || !roomIn[roomOf(map, x, y)]; };
        const victims = [];
        for (let x = 1; x < 2 * map.width; x += 2) {
            for (let y = 1; y < 2 * map.length; y += 2) {
                if (skip(x, y)) continue;
                const v = edgeVictim(map, x, y);
                if (v && hasWall(map, x, y, v.dir)) {
                    const d = SIDES[v.dir], pt = [6 * x + 4 * d[0], 6 * y + 4 * d[1]];
                    if (!near(pt, [6 * x + 6 * d[0], 6 * y + 6 * d[1]])) victims.push(pt);
                }
                const t = tileOf(map, x, y);
                for (let i = 0; i < 16; i++) {
                    if (!slotVictim(map, x, y, i) || !slotHasWall(map, x, y, i)) continue;
                    const sp = L.slotPoint(x, y, i, t && t.curve);
                    if (!near(sp.at, sp.wall)) victims.push(sp.at);
                }
            }
        }
        return { res: res, gw: gw, gh: gh, reached: reached, miss: miss, pocketCount: pocketCount, pocketAt: pocketAt, victims: victims };
    }

    // { key, params, block, at, show }: block = the world export stops for it; at = [x, y] cm to go to;
    // show = everything the problem is about, to point out on the map: { tiles: [[tx, ty]] (tile
    // indices), points: [[x, y]] cm, segs: [unit segments], arcs: [{x, y, q, v}] }
    function problems(map) {
        const out = [];
        const st = map.startTile;
        if (!st || !(st.x > 0 && st.y > 0)) out.push({ key: 'noStart', block: true });
        const type = map.area4Room && map.area4Room.type;
        const region = W.room4Region(map);
        const regionAt = region ? [6 * (region.minX + region.maxX + 1), 6 * (region.minY + region.maxY + 1)] : null;
        const rooms = roomMap(map);
        const tilesOf = function (room) {
            return Object.keys(rooms).filter(function (k) { return rooms[k] === room; })
                .map(function (k) { const p = k.split(',').map(Number); return [(p[0] - 1) / 2, (p[1] - 1) / 2]; });
        };
        if (type === 1 && !map.room4CanvasSave) out.push({ key: 'customRoom4NoPicture', block: true, at: regionAt, show: { tiles: tilesOf(4) } });
        if (type === 1) {
            // the room 4 tile behind each passage should be a checkpoint (rule 3.5.3), as the creator says
            const geo = W.mapGeometry(map);
            const cps = {};
            geo.checkpoints.forEach(function (t) { cps[t[0] + ',' + t[1]] = true; });
            const missing = [];
            geo.entrances.forEach(function (e) {
                const k = e.tile[0] + ',' + e.tile[1];
                if (e.passage && !cps[k] && missing.indexOf(k) < 0) missing.push(k);
            });
            if (missing.length) {
                const tiles = missing.map(function (k) { return k.split(',').map(Number); });
                out.push({ key: 'room4Checkpoint', params: { count: missing.length }, block: true, at: [12 * tiles[0][0] + 6, 12 * tiles[0][1] + 6], show: { tiles: tiles } });
            }
        }
        if (type >= 2) out.push({ key: 'presetNotSupported', block: true, at: regionAt, show: { tiles: tilesOf(4) } });
        // the rooms' connections are always checked here (the classic editor's switch, connCheckOff,
        // is kept in the map as it is, for that editor)
        const conn = W.connectionStatus(map);
        const centre = function (t) { return [12 * t[0] + 6, 12 * t[1] + 6]; };
        const markTiles = function (test) {
            return Object.keys(conn.marks).filter(function (m) { return test(conn.marks[m], m); }).map(function (m) { return m.split(',').map(Number); });
        };
        conn.rooms.forEach(function (r) {
            if (r.reached) return;
            const tiles = tilesOf(r.room);
            out.push({ key: 'conn.notConnected', params: { room: r.room }, block: true, at: tiles.length ? centre(tiles[0]) : null, show: { tiles: tiles } });
        });
        conn.issues.forEach(function (i) {
            // a passage tile in the wrong place, or the gaps between two rooms that are not passages
            const tiles = i.key === 'unmarkedGap'
                ? markTiles(function (m) { return m.style && m.style['border-color'] === i.pass.color; })
                : markTiles(function (m, k) { const t = k.split(',').map(Number); const tile = tileOf(map, 2 * t[0] + 1, 2 * t[1] + 1); return m.cls === 'bad' && tile && tile.color === i.pass.color; });
            out.push({ key: 'conn.' + i.key, params: { name: i.pass.name, from: i.pass.from, to: i.pass.to, room: i.room, count: i.count }, block: true,
                at: tiles.length ? centre(tiles[0]) : null, show: { tiles: tiles } });
        });
        // victims whose wall has gone, and walls the rooms do not take
        const floating = [];
        for (let x = 1; x < 2 * map.width; x += 2) {
            for (let y = 1; y < 2 * map.length; y += 2) {
                const v = edgeVictim(map, x, y);
                if (v && !hasWall(map, x, y, v.dir)) floating.push([6 * x + 4 * SIDES[v.dir][0], 6 * y + 4 * SIDES[v.dir][1]]);
                for (let i = 0; i < 16; i++) {
                    if (slotVictim(map, x, y, i) && !slotHasWall(map, x, y, i)) floating.push(slotPos(x, y, i, map));
                }
            }
        }
        if (floating.length) out.push({ key: 'victimNoWall', params: { count: floating.length }, at: floating[0], show: { points: floating } });
        // victims the robot cannot get to (walls too close round them)
        const reach = robotReach(map);
        if (reach && reach.victims.length) {
            out.push({ key: 'victimUnreachable', params: { count: reach.victims.length }, at: reach.victims[0],
                show: { points: reach.victims } });
        }
        const room = roomLookup(map);
        const walls = L.fromCells(map);
        const badSegs = [], badArcs = [];
        walls.segs.forEach(function (s) {
            if (isOuterSeg(map, s)) return;
            const rule = L.segRule(s, room);
            if (!rule.ok || (rule.whole && !L.hasSeg(map, L.otherHalf(s)))) badSegs.push(s);
        });
        walls.arcs.forEach(function (a) { if (!L.arcRule(room(a.x, a.y)).ok) badArcs.push(a); });
        if (badSegs.length || badArcs.length) {
            let at;
            if (badSegs.length) { const g = L.parseSeg(badSegs[0]); at = [6 * g.i + (g.dir === 'h' ? 3 : 0), 6 * g.j + (g.dir === 'v' ? 3 : 0)]; }
            else { const a0 = badArcs[0]; at = [6 * a0.x - 3 + (a0.q % 2) * 6, 6 * a0.y - 3 + Math.floor(a0.q / 2) * 6]; }
            out.push({ key: 'wallRule', params: { count: badSegs.length + badArcs.length }, at: at, show: { segs: badSegs, arcs: badArcs } });
        }
        return out;
    }

    // ---- Fixing problems -----------------------------------------------------------------------------
    // fixProblem(map, problem, borders) does what can be done for a problem and returns the border
    // walls set (as syncBorderWalls), or null when it cannot be fixed here (the custom room 4 picture
    // has to be drawn). FIXABLE: the problems it handles.

    const FIXABLE = ['noStart', 'presetNotSupported', 'room4Checkpoint', 'conn.notConnected', 'conn.passageNoRoom',
        'conn.passageMisplaced', 'conn.unmarkedGap', 'victimNoWall', 'wallRule'];

    // A start tile: a plain room 1 tile, looked for from the bottom left
    function fixStart(map) {
        for (let y = 2 * map.length - 1; y > 0; y -= 2) {
            for (let x = 1; x < 2 * map.width; x += 2) {
                const t = tileOf(map, x, y);
                if (roomOf(map, x, y) !== 1 || !t || t.black || t.swamp || t.color) continue;
                map.startTile = { x: x, y: y, z: 0 };
                return true;
            }
        }
        return false;
    }

    // A passage for a room that is not reached: border places towards a reached room (room 1 first)
    // are tried one after the other until one joins the room
    function connectRoom(map, room, borders) {
        const reachedRooms = function () {
            const conn = W.connectionStatus(map);
            const r = { 1: true };
            conn.rooms.forEach(function (e) { if (e.reached) r[e.room] = true; });
            return r;
        };
        const reached = reachedRooms();
        if (reached[room]) return borders;
        const cands = [];
        for (let x = 1; x < 2 * map.width; x += 2) {
            for (let y = 1; y < 2 * map.length; y += 2) {
                [[2, 0], [0, 2]].forEach(function (d) {
                    const b = borderAt(map, x + d[0] / 2, y + d[1] / 2);
                    if (!b) return;
                    const other = b.ra === room ? b.rb : b.rb === room ? b.ra : 0;
                    if (!other || !reached[other]) return;
                    const ta = tileOf(map, b.a[0], b.a[1]), tb = tileOf(map, b.b[0], b.b[1]);
                    if ((ta && (ta.black || ta.color)) || (tb && (tb.black || tb.color))) return;
                    cands.push({ ex: x + d[0] / 2, ey: y + d[1] / 2, score: (other === 1 ? 0 : 1) });
                });
            }
        }
        cands.sort(function (a, b) { return a.score - b.score; });
        for (let i = 0; i < Math.min(cands.length, 80); i++) {
            const keep = JSON.stringify(map.cells);
            togglePassage(map, cands[i].ex, cands[i].ey);
            const after = syncBorderWalls(map, borders);
            const conn = W.connectionStatus(map);
            const ok = conn.rooms.some(function (e) { return e.room === room && e.reached; })
                && !conn.issues.some(function (is) { return is.key === 'passageMisplaced'; });
            if (ok) return after;
            map.cells = JSON.parse(keep);
        }
        return borders;
    }

    function fixProblem(map, p, borders) {
        const key = p.key;
        if (key === 'noStart') { fixStart(map); return borders; }
        if (key === 'presetNotSupported') {
            map.area4Room = W.area4Presets()[(map.roomTiles[2] || []).length ? 1 : 0];
            return resyncBorderWalls(map, borders);
        }
        if (key === 'room4Checkpoint') {
            (p.show && p.show.tiles || []).forEach(function (t) {
                const tile = ensureTile(map, 2 * t[0] + 1, 2 * t[1] + 1);
                FLOORS.forEach(function (f) { tile[f] = false; });
                tile.checkpoint = true;
                tile.cpAuto = true;
            });
            return borders;
        }
        if (key === 'conn.notConnected') return connectRoom(map, p.params.room, borders);
        if (key === 'conn.passageNoRoom' || key === 'conn.passageMisplaced') {
            (p.show && p.show.tiles || []).forEach(function (t) { clearPassage(map, 2 * t[0] + 1, 2 * t[1] + 1); });
            prunePassages(map);
            const after = resyncBorderWalls(map, borders);
            // a room the passage joined is joined again another way
            return [2, 3, 4].reduce(function (b, room) { return connectRoom(map, room, b); }, after);
        }
        if (key === 'conn.unmarkedGap') return resyncBorderWalls(map, borders);
        if (key === 'victimNoWall') {
            for (let x = 1; x < 2 * map.width; x += 2) {
                for (let y = 1; y < 2 * map.length; y += 2) {
                    const v = edgeVictim(map, x, y);
                    if (v && !hasWall(map, x, y, v.dir)) clearVictim(map, x, y);
                    for (let i = 0; i < 16; i++) if (slotVictim(map, x, y, i) && !slotHasWall(map, x, y, i)) clearSlotVictim(map, x, y, i);
                }
            }
            return borders;
        }
        if (key === 'wallRule') {
            const room = roomLookup(map);
            (p.show && p.show.segs || []).forEach(function (s) {
                const rule = L.segRule(s, room);
                if (!rule.ok) L.setSeg(map, s, false);
                else if (rule.whole) L.setSeg(map, L.otherHalf(s), true);   // beside room 1: the whole tile edge
            });
            (p.show && p.show.arcs || []).forEach(function (a) { L.setArc(map, a.x, a.y, a.q, 0); });
            return borders;
        }
        return null;
    }

    // Every problem that can be fixed, in an order where one fix does not undo another
    function fixAll(map, borders) {
        const order = ['presetNotSupported', 'conn.passageNoRoom', 'conn.passageMisplaced', 'conn.unmarkedGap', 'wallRule',
            'conn.notConnected', 'room4Checkpoint', 'victimNoWall', 'noStart'];
        order.forEach(function (key) {
            problems(map).filter(function (p) { return p.key === key; }).forEach(function (p) {
                const after = fixProblem(map, p, borders);
                if (after) borders = after;
            });
        });
        return borders;
    }

    // The map as the classic editor saves it (its JSON export)
    function saved(map) {
        return {
            name: map.name, length: map.length, height: map.height, width: map.width, finished: map.finished,
            startTile: map.startTile, cells: map.cells, roomTiles: map.roomTiles, time: map.time,
            area4Room: map.area4Room, room4CanvasSave: map.room4CanvasSave || null,
            room4VicTypes: map.room4VicTypes || [], room4Tokens: map.room4Tokens || [], connCheckOff: !!map.connCheckOff
        };
    }

    // The world (.wbt) of the map; worked out on a copy, so the map is left as it is. A custom room 4
    // needs room4(copy) = the hooks that read its picture (SimRoom4World2026, browser only).
    function world(map, room4) {
        const m = JSON.parse(JSON.stringify(saved(map)));
        m.area4 = W.area4Presets();
        W.recalculate(m);
        return W.createWorld(m, room4 ? room4(m) : {});
    }

    const api = {
        SIDES: SIDES, key: key, inMap: inMap, isOutside: isOutside, isInside: isInside, edgeTiles: edgeTiles, tileOf: tileOf, ensureTile: ensureTile, ensureTiles: ensureTiles,
        newMap: newMap, normalize: normalize, resize: resize, outerWalls: outerWalls, isOuterEdge: isOuterEdge,
        roomOf: roomOf, roomMap: roomMap, roomLookup: roomLookup, setRoom: setRoom,
        passageFor: passageFor, borderEdges: borderEdges, syncBorderWalls: syncBorderWalls, borderAt: borderAt, togglePassage: togglePassage,
        FIXABLE: FIXABLE, fixProblem: fixProblem, fixAll: fixAll,
        passageSide: passageSide, syncArea4: syncArea4, room4Checkpoints: room4Checkpoints, resyncBorderWalls: resyncBorderWalls,
        copyRegion: copyRegion, clearRegion: clearRegion, pasteRegion: pasteRegion, insertLine: insertLine, removeLine: removeLine, clearPassage: clearPassage, prunePassages: prunePassages,
        wallPlan: wallPlan, setWalls: setWalls, segNear: segNear, isOuterSeg: isOuterSeg,
        setFloor: setFloor, hasWall: hasWall, edgeVictim: edgeVictim, victimRule: victimRule, setVictim: setVictim, clearVictim: clearVictim,
        quarterAt: quarterAt, arcCentre: arcCentre, arcChoice: arcChoice, setCurve: setCurve, arcNear: arcNear,
        slotHasWall: slotHasWall, slotPos: slotPos, slotAt: slotAt, slotVictim: slotVictim, slotRule: slotRule,
        setSlotVictim: setSlotVictim, clearSlotVictim: clearSlotVictim,
        victimAt: victimAt, changeVictim: changeVictim, removeVictim: removeVictim,
        robotReach: robotReach, problems: problems, saved: saved, world: world
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SimBetaModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
