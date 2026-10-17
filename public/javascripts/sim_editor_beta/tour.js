// Erebus Editor 2026: the guide. Three ways through the editor, run by the controller (beta.2026.js):
//
// - TOUR: with a map open, one part of the screen lit up at a time, with a card saying what it does.
// - LESSON: from a blank start, a sample map built step by step - each step asks for one thing, sees
//   when it is done, and can do it for you. Room 4 is its own part (ROOM4), in the middle.
// - ROOM4: the room 4 part alone, started from the room 4 creator; ROOM4_TOUR: the same to look at only.
//
// A step: { id, chapter, target (selector of the part lit up; none: the card in the middle), mark
// (selectors of other parts lit up beside it), tool / mode / room / floor / victim (taken first, so
// the panel shows), r4tool (the same in the room 4 creator), checks (the checks card opened), place
// ('below': the card under the part if there is room), cardIn (selector: the card at the bottom right
// inside that part instead, when the parts lit are all round it), noMap (only while no map is open), creator (a
// step in the room 4 creator), showReach (its places out of reach shown), eraseTokens (the eraser
// set to victims only), r4guide (lines in fractions of the room 4 picture), leave(env) (when the step
// is left), lessonOnly (left out of the look-only tour), keys (key names shown), plan (the sample map drawn on the card), and
// for a lesson step: region(env) - tiles [x0, y0, x1, y1] (tile indices) lit on the map, guide(env) -
// lines [[x, y] cm ...] to draw along, enter(env, st) - when the step starts, goal(env, st) - done?,
// auto(env, st) - does it, state(env, st) - when the map is not as the task asks (too much done,
// something else done, part of it left): { key, params } of the task to show in its place (the
// language files' lesson.<id>.tasks.<key>; a params.list of ids is given names by the controller
// with params.listOf, a key prefix), or null }. st is the step's own state while it is shown.
//
// env, given by the controller: { M, W, L (the model, the world, the lattice), map, ui, selected,
// region, creator (the room 4 creator's scope: r4, r4api, closeRoom4; null when it is closed),
// room4State, problems, sync() (border walls again after a change), act: { newMap(), resize(w, l),
// openRoom4(), fixAll(), toggleLinear(), select(where), setRegion(r), rename(name) } }.
//
// Texts are in the language files: admin.simBeta.tour.<id> for TOUR, admin.simBeta.lesson.<id> for
// LESSON and ROOM4 (title, body - paragraphs split by line breaks - and task, what to do).
(function (root) {
    const PANEL = '.sbx-tool-panel';
    const tool = function (id) { return '.sbx-tool[data-tool="' + id + '"]'; };
    const r4tool = function (id) { return '.sim-r4-rail-tool[data-tool="' + id + '"]'; };
    const c = function (t) { return 2 * t + 1; };     // tile index -> cell coordinate

    // ---- the tour of the screen (a map open) ----------------------------------------------------
    const STEPS = [
        { id: 'welcome', chapter: 'start' },

        { id: 'file', chapter: 'screen', target: '.sbx-file', place: 'below' },
        { id: 'name', chapter: 'screen', target: '.sbx-name', place: 'below' },
        { id: 'history', chapter: 'screen', target: '.sbx-history', place: 'below', keys: ['Ctrl+Z', 'Ctrl+Shift+Z'] },
        { id: 'view', chapter: 'screen', target: '#simBetaStage', mark: ['.sbx-view'], keys: ['Wheel', 'Space + Drag', 'H'] },
        { id: 'rail', chapter: 'screen', target: '.sbx-rail' },
        { id: 'panel', chapter: 'screen', target: PANEL, mark: ['.sbx-status'], tool: 'line' },

        { id: 'shape', chapter: 'tools', target: PANEL, mark: [tool('shape')], tool: 'shape', keys: ['X'] },
        { id: 'room', chapter: 'tools', target: PANEL, mark: [tool('room')], tool: 'room', keys: ['M'] },
        { id: 'passage', chapter: 'tools', target: PANEL, mark: [tool('passage')], tool: 'passage', keys: ['P'] },
        { id: 'line', chapter: 'tools', target: PANEL, mark: [tool('line')], tool: 'line', keys: ['L', 'Shift'] },
        { id: 'curve', chapter: 'tools', target: PANEL, mark: [tool('curve')], tool: 'curve', keys: ['A'] },
        { id: 'eraser', chapter: 'tools', target: PANEL, mark: [tool('eraser')], tool: 'eraser', keys: ['E'] },
        { id: 'floor', chapter: 'tools', target: PANEL, mark: [tool('floor')], tool: 'floor', keys: ['F'] },
        { id: 'victim', chapter: 'tools', target: PANEL, mark: [tool('victim')], tool: 'victim', keys: ['V'] },
        { id: 'room4', chapter: 'tools', target: '.sbx-room4-block', mark: [tool('room')], tool: 'room' },
        { id: 'select', chapter: 'tools', target: PANEL, mark: [tool('select')], tool: 'select', keys: ['S', 'Alt', 'Ctrl+C', 'Ctrl+V', 'Ctrl+D', 'Delete'] },

        { id: 'linear', chapter: 'finish', target: '.sbx-linear', place: 'below' },
        { id: 'checks', chapter: 'finish', target: '.sbx-checks', checks: true },
        { id: 'fix', chapter: 'finish', target: '.sbx-checks', checks: true },
        { id: 'export', chapter: 'finish', target: '.sbx-export', place: 'below' },
        { id: 'more', chapter: 'finish', target: '.sbx-status-tools' },
        { id: 'done', chapter: 'finish', target: '.sbx-tour-btn' }
    ];
    const CHAPTERS = ['start', 'screen', 'tools', 'finish'];

    // ---- the sample map of the lesson ----------------------------------------------------------
    // 9 x 6 tiles: room 1 on the left (its top left corner taken out of the map), room 2 top middle,
    // room 3 bottom middle, room 4 on the right; passages 1-2, 2-3 and 3-4; the start bottom left.
    const SAMPLE = {
        width: 9, length: 6,
        outside: [0, 0],
        rooms: { 2: [3, 0, 5, 2], 3: [3, 3, 5, 5], 4: [6, 0, 8, 5] },
        start: [0, 5],
        hole: [1, 3], checkpoint: [5, 0], swamp: [4, 5],
        // a wall along a tile edge in room 1, and a staircase on the 6 cm grid in room 2 (cm)
        wall1: [[12, 24], [36, 24]],
        wall2: [[48, 12], [54, 12], [54, 18], [60, 18], [60, 24]],
        curve: { tile: [4, 4], q: 0, v: 1 }
    };

    // ---- what the steps look at ----
    function allRoom(env, r, room) {
        for (let tx = r[0]; tx <= r[2]; tx++) for (let ty = r[1]; ty <= r[3]; ty++) if (env.M.roomOf(env.map, c(tx), c(ty)) !== room) return false;
        return true;
    }
    function reached(env, room) {
        return env.W.connectionStatus(env.map).rooms.some(function (e) { return e.room === room && e.reached; });
    }
    function eachTile(map, fn) {
        for (let x = 1; x < 2 * map.width; x += 2) for (let y = 1; y < 2 * map.length; y += 2) fn(x, y);
    }
    // the victims placed: [{ type, fake, room }]
    function victims(env) {
        const out = [], map = env.map, M = env.M;
        eachTile(map, function (x, y) {
            const room = M.roomOf(map, x, y);
            const v = M.edgeVictim(map, x, y);
            if (v) out.push({ type: v.type, fake: v.fake, room: room });
            for (let i = 0; i < 16; i++) {
                const s = M.slotVictim(map, x, y, i);
                if (s) out.push({ type: s.type, fake: s.fake, room: room });
            }
        });
        return out;
    }
    function floorCount(env, kind) {
        let n = 0;
        eachTile(env.map, function (x, y) {
            const t = env.M.tileOf(env.map, x, y);
            if (t && t[kind] && !(kind === 'checkpoint' && t.cpAuto)) n++;
        });
        return n;
    }
    // walls drawn inside a room (not on its borders): unit segments with that room on both sides
    function innerSegs(env, room) {
        const segs = env.L.fromCells(env.map, 0).segs, M = env.M, map = env.map;
        const roomAt = function (x, y) { return M.roomOf(map, 2 * Math.floor(x / 12) + 1, 2 * Math.floor(y / 12) + 1); };
        let n = 0;
        segs.forEach(function (s) {
            const g = env.L.parseSeg(s);
            const mx = g.dir === 'v' ? 6 * g.i : 6 * g.i + 3, my = g.dir === 'v' ? 6 * g.j + 3 : 6 * g.j;
            if (mx <= 0 || my <= 0 || mx >= 12 * map.width || my >= 12 * map.length) return;
            const a = g.dir === 'v' ? roomAt(mx - 0.5, my) : roomAt(mx, my - 0.5);
            const b = g.dir === 'v' ? roomAt(mx + 0.5, my) : roomAt(mx, my + 0.5);
            if (a === room && b === room) n++;
        });
        return n;
    }
    // the unit segments along a line of points (cm, on the 6 cm grid)
    function segsAlong(L, pts) {
        const out = [];
        for (let k = 1; k < pts.length; k++) {
            const a = pts[k - 1], b = pts[k];
            if (a[1] === b[1]) for (let x = Math.min(a[0], b[0]); x < Math.max(a[0], b[0]); x += 6) out.push(L.segKey('h', x / 6, a[1] / 6));
            else for (let y = Math.min(a[1], b[1]); y < Math.max(a[1], b[1]); y += 6) out.push(L.segKey('v', a[0] / 6, y / 6));
        }
        return out;
    }
    const tileBox = function (t) { return [t[0], t[1], t[0], t[1]]; };
    // a room step: the tiles of its frame not yet that room, those painted with another room, and
    // tiles outside the frame painted with it
    function roomCount(env, room) {
        const r = SAMPLE.rooms[room], map = env.map, M = env.M;
        const out = { miss: 0, wrong: 0, extra: 0, total: (r[2] - r[0] + 1) * (r[3] - r[1] + 1) };
        eachTile(map, function (x, y) {
            const tx = (x - 1) / 2, ty = (y - 1) / 2, inside = tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3];
            const own = M.roomOf(map, x, y);
            if (inside && own !== room) { out.miss++; if (own > 1) out.wrong++; }
            if (!inside && own === room) out.extra++;
        });
        return out;
    }
    function roomStep(room) {
        return {
            id: 'room' + room, chapter: 'rooms', target: PANEL, tool: 'room', room: room,
            region: function () { return [SAMPLE.rooms[room]]; },
            goal: function (env) { const k = roomCount(env, room); return !k.miss && !k.extra; },
            auto: function (env) {
                // what is outside the frame goes back to room 1, then the frame is painted
                eachTile(env.map, function (x, y) {
                    const r = SAMPLE.rooms[room], tx = (x - 1) / 2, ty = (y - 1) / 2;
                    if (!(tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3]) && env.M.roomOf(env.map, x, y) === room) env.M.setRoom(env.map, x, y, 1);
                });
                paint(env, room);
            },
            state: function (env) {
                const k = roomCount(env, room);
                if (k.extra) return { key: 'extra', params: { n: k.extra, room: room } };
                if (k.wrong) return { key: 'wrong', params: { n: k.wrong, room: room } };
                if (k.miss && k.miss < k.total) return { key: 'left', params: { n: k.miss, room: room } };
                return null;
            }
        };
    }
    // tiles out of the map other than the sample's corner
    function extraOutside(env) {
        let n = 0;
        eachTile(env.map, function (x, y) {
            if (env.M.isOutside(env.map, x, y) && !(x === c(SAMPLE.outside[0]) && y === c(SAMPLE.outside[1]))) n++;
        });
        return n;
    }
    const lastColumn = function (env) { return [env.map.width - 1, 0, env.map.width - 1, env.map.length - 1]; };
    function paint(env, room) {
        const r = SAMPLE.rooms[room];
        for (let tx = r[0]; tx <= r[2]; tx++) for (let ty = r[1]; ty <= r[3]; ty++) env.M.setRoom(env.map, c(tx), c(ty), room);
        env.sync();
    }

    // ---- room 4: the creator (also on its own, from the creator) ----
    // A drawing step is done once the picture changes with its tool chosen (r4.drawCount counts the
    // changes); its guide (r4guide: lines in fractions of the picture) shows where, and "do it for me"
    // draws the same with that tool.
    function drewWith(tool, test) {
        return function (env, st) {
            const cr = env.creator;
            if (!cr) return false;
            if (st.ok) return true;
            const n = cr.r4.drawCount || 0;
            if (cr.r4.tool !== tool || (test && !test(cr.r4)) || st.n === undefined) { st.n = n; return false; }
            if (n > st.n) st.ok = true;
            return !!st.ok;
        };
    }
    function otherTool(tool) {
        return function (env) {
            const cr = env.creator;
            return cr && cr.r4.tool !== tool ? { key: 'tool', params: { name: tool }, nameOf: 'admin.simMapEditor.room4Creator.tools.' } : null;
        };
    }
    function drawStep(id, tool, guide, auto, extra) {
        const step = {
            id: id, chapter: 'room4', creator: true, target: '.sim-r4-viewport', mark: ['.sim-r4-panel', r4tool(tool)], r4tool: tool,
            r4guide: guide, goal: drewWith(tool), auto: auto, state: otherTool(tool)
        };
        Object.keys(extra || {}).forEach(function (k) { step[k] = extra[k]; });
        return step;
    }
    // points round an ellipse (fractions), for guides
    function ring(cx, cy, rx, ry, n, rot) {
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const t = (rot || 0) + 2 * Math.PI * i / n;
            pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
        }
        return pts;
    }
    // the picture is a tall room (3 x 6 tiles): fractions of its height are half those of its width
    const R4 = {
        // all in the middle of the room (30-70 % of its width): the robot keeps a way past on both
        // sides, about 11 cm wide, whatever is drawn
        wave: (function () { const p = []; for (let i = 0; i <= 20; i++) { const t = i / 20; p.push([0.3 + 0.4 * t, 0.36 + 0.03 * Math.sin(2 * Math.PI * t)]); } return p; })(),
        line: [[0.3, 0.14], [0.7, 0.14]],
        curve: [[0.3, 0.24], [0.43, 0.2], [0.57, 0.27], [0.7, 0.23]],
        arc: { p0: [0.3, 0.47], c: [0.5, 0.43], p1: [0.7, 0.47] },
        rect: [[0.32, 0.52], [0.48, 0.58]],
        circle: { a: [0.6, 0.55], r: 0.06 },
        ellipse: [[0.32, 0.63], [0.68, 0.67]],
        polygon: { a: [0.5, 0.73], r: 0.08, n: 6 },
        icon: [[0.38, 0.8], [0.62, 0.88]],
        select: [[0.29, 0.5], [0.51, 0.6]],
        square: [[0.4, 0.6], [0.6, 0.6], [0.6, 0.72], [0.4, 0.72], [0.4, 0.6]]
    };
    const ROOM4 = [
        { id: 'r4intro', chapter: 'room4', creator: true, target: '.sim-r4-main' },
        { id: 'r4screen', chapter: 'room4', creator: true, target: '.sim-r4-rail', mark: ['.sim-r4-panel', '.sim-r4-topbar', '.sim-r4-status'], cardIn: '.sim-r4-viewport' },
        drawStep('r4pen', 'pen', [R4.wave], function (env) { env.creator.r4api.drawPen(R4.wave); }, { keys: ['Ctrl+Z'] }),
        drawStep('r4line', 'line', [R4.line], function (env) { env.creator.r4api.drawShape({ type: 'line', a: R4.line[0], b: R4.line[1] }); }, { keys: ['Shift'] }),
        drawStep('r4curve', 'curve', [R4.curve], function (env) { env.creator.r4api.drawShape({ type: 'curve', pts: R4.curve, smooth: true }); }, { keys: ['Enter', 'Backspace', 'Esc'] }),
        drawStep('r4arc', 'arc', [[R4.arc.p0, R4.arc.c, R4.arc.p1]], function (env) { env.creator.r4api.drawShape({ type: 'arc', p0: R4.arc.p0, c: R4.arc.c, p1: R4.arc.p1 }); }),
        drawStep('r4rect', 'rect', [[R4.rect[0], [R4.rect[1][0], R4.rect[0][1]], R4.rect[1], [R4.rect[0][0], R4.rect[1][1]], R4.rect[0]]],
            function (env) { env.creator.r4api.drawShape({ type: 'rect', a: R4.rect[0], b: R4.rect[1] }); }, { keys: ['Shift'] }),
        drawStep('r4circle', 'circle', [ring(R4.circle.a[0], R4.circle.a[1], R4.circle.r, R4.circle.r / 2, 32)],
            function (env) { env.creator.r4api.drawShape({ type: 'circle', a: R4.circle.a, r: R4.circle.r }); }),
        drawStep('r4ellipse', 'ellipse', [ring((R4.ellipse[0][0] + R4.ellipse[1][0]) / 2, (R4.ellipse[0][1] + R4.ellipse[1][1]) / 2, (R4.ellipse[1][0] - R4.ellipse[0][0]) / 2, (R4.ellipse[1][1] - R4.ellipse[0][1]) / 2, 32)],
            function (env) { env.creator.r4api.drawShape({ type: 'ellipse', a: R4.ellipse[0], b: R4.ellipse[1] }); }, { keys: ['Shift'] }),
        drawStep('r4polygon', 'polygon', [ring(R4.polygon.a[0], R4.polygon.a[1], R4.polygon.r, R4.polygon.r / 2, R4.polygon.n)],
            function (env) { env.creator.r4api.drawShape({ type: 'polygon', a: R4.polygon.a, r: R4.polygon.r, n: R4.polygon.n }); }),
        drawStep('r4shape', 'shape', [[R4.icon[0], [R4.icon[1][0], R4.icon[0][1]], R4.icon[1], [R4.icon[0][0], R4.icon[1][1]], R4.icon[0]]],
            function (env) { env.creator.r4api.drawIcon('star', R4.icon[0], R4.icon[1]); }),
        {
            id: 'r4select', chapter: 'room4', creator: true, target: '.sim-r4-viewport', mark: [r4tool('select')], r4tool: 'select',
            r4guide: [[R4.select[0], [R4.select[1][0], R4.select[0][1]], R4.select[1], [R4.select[0][0], R4.select[1][1]], R4.select[0]]],
            goal: function (env) { return !!env.creator && !!env.creator.r4.hasSelection; },
            auto: function (env) { env.creator.r4api.selectBox(R4.select[0], R4.select[1]); },
            state: otherTool('select')
        },
        {
            // turned (or flipped, moved, duplicated) and put down: the picture changes with the select tool
            id: 'r4transform', chapter: 'room4', creator: true, target: '.sim-r4-panel', mark: ['.sim-r4-viewport', r4tool('select')], r4tool: 'select', keys: ['[', ']', 'Ctrl+D', 'Ctrl+C', 'Ctrl+V', 'Delete', 'Enter'],
            goal: drewWith('select'),
            auto: function (env) {
                const api = env.creator.r4api;
                if (!env.creator.r4.hasSelection) api.selectBox(R4.select[0], R4.select[1]);
                api.selection('cw');
                api.selection('drop');
            },
            state: function (env) {
                const cr = env.creator;
                if (!cr) return null;
                if (cr.r4.tool !== 'select') return { key: 'tool', params: { name: 'select' }, nameOf: 'admin.simMapEditor.room4Creator.tools.' };
                return cr.r4.hasSelection ? null : { key: 'noSelection' };
            }
        },
        drawStep('r4erase', 'erase', [R4.line], function (env) {
            env.creator.r4.eraseTarget = 'all';
            env.creator.r4api.erasePen(R4.line);
        }),
        {
            // a template laid over a cleared picture: the drawings so far make way for it
            id: 'r4template', chapter: 'room4', creator: true, target: '.sim-r4-panel', mark: ['.sim-r4-viewport', r4tool('template')], r4tool: 'template',
            // put with "clear first" on, so the practice shapes (which may close off the entrance) go
            goal: drewWith('template', function (r4) { return !!r4.templateClear; }),
            auto: function (env) { env.creator.r4.templateClear = true; env.creator.r4api.applyTemplate('pillars', true); },
            state: function (env) {
                const cr = env.creator;
                if (!cr) return null;
                if (cr.r4.tool !== 'template') return { key: 'tool', params: { name: 'template' }, nameOf: 'admin.simMapEditor.room4Creator.tools.' };
                return cr.r4.templateClear ? null : { key: 'clearOff' };
            }
        },
        {
            id: 'r4stamp', chapter: 'room4', creator: true, target: '.sim-r4-viewport', mark: ['.sim-r4-panel', r4tool('stamp')], r4tool: 'stamp',
            enter: function (env, st) { st.n0 = env.creator ? env.creator.r4.tokenCount || 0 : 0; },
            goal: function (env, st) { return !!env.creator && (env.creator.r4.tokenCount || 0) >= Math.max(2, st.n0 + 1); },
            auto: function (env) { env.creator.r4api.randomStamps(3, 'mixed'); },
            state: function (env, st) {
                const n = env.creator ? env.creator.r4.tokenCount || 0 : 0, want = Math.max(2, st.n0 + 1);
                return n > st.n0 && n < want ? { key: 'left', params: { n: want - n } } : null;
            }
        },
        {
            // a victim put clicked with its own kind: selected, to change its turn or rings
            id: 'r4pick', chapter: 'room4', creator: true, target: '.sim-r4-viewport', mark: ['.sim-r4-panel', r4tool('stamp')], r4tool: 'stamp',
            goal: function (env) { return !!env.creator && !!env.creator.r4.sel; },
            auto: function (env) { env.creator.r4api.selectToken(0); },
            state: otherTool('stamp')
        },
        {
            // the eraser on victims only takes a victim off and leaves its wall
            id: 'r4eraseTokens', chapter: 'room4', creator: true, target: '.sim-r4-viewport', mark: ['.sim-r4-panel', r4tool('erase')], r4tool: 'erase', eraseTokens: true,
            enter: function (env, st) { st.n0 = env.creator ? env.creator.r4.tokenCount || 0 : 0; },
            goal: function (env, st) { return !!env.creator && (env.creator.r4.tokenCount || 0) < st.n0; },
            auto: function (env) { env.creator.r4.eraseTarget = 'tokens'; env.creator.r4api.eraseToken(0); },
            state: function (env) {
                const cr = env.creator;
                if (!cr) return null;
                if (cr.r4.tool !== 'erase') return { key: 'tool', params: { name: 'erase' }, nameOf: 'admin.simMapEditor.room4Creator.tools.' };
                return cr.r4.eraseTarget !== 'tokens' ? { key: 'target' } : null;
            }
        },
        {
            id: 'r4random', chapter: 'room4', creator: true, target: '.sim-r4-more', mark: [r4tool('stamp')], r4tool: 'stamp', openMore: true,
            enter: function (env, st) { st.n0 = env.creator ? env.creator.r4.tokenCount || 0 : 0; },
            goal: function (env, st) { return !!env.creator && (env.creator.r4.tokenCount || 0) > st.n0; },
            auto: function (env) { env.creator.r4api.randomStamps(3, 'mixed'); }
        },
        {
            // a place the robot cannot get into made on purpose (a small closed square), and seen
            id: 'r4reach', chapter: 'room4', creator: true, target: '.sim-r4-viewport', mark: ['.sim-r4-topbar', '.sim-r4-status', r4tool('rect')], r4tool: 'rect', showReach: true,
            r4guide: [R4.square],
            enter: function (env, st) { st.b0 = env.creator ? env.creator.r4.reachBlocked || 0 : 0; },
            goal: function (env, st) { return !!env.creator && (env.creator.r4.reachBlocked || 0) > st.b0; },
            auto: function (env) { env.creator.r4api.drawPen(R4.square); },
            state: function (env) {
                const r4 = env.creator && env.creator.r4;
                if (!r4) return null;
                if (r4.reachState && r4.reachState !== 'ok') return { key: 'off' };
                // nearly all of room 4 out of reach already: its entrance is closed off
                if (r4.reachRoom && (r4.reachBlocked || 0) >= 0.9 * r4.reachRoom) return { key: 'allBlocked' };
                return null;
            }
        },
        { id: 'r4file', chapter: 'room4', creator: true, target: '.sim-r4-topbar' },
        {
            id: 'r4ok', chapter: 'room4', creator: true, target: '.sim-r4-head-ok', place: 'below', closes: true,
            goal: function (env) { return !env.creator && env.room4State === 'drawn'; },
            auto: function (env) { if (env.creator) env.creator.closeRoom4(); }
        }
    ];

    // The same part as a tour, to look at only: no tasks, and the editor kept still
    const ROOM4_TOUR = ROOM4.filter(function (s) { return !s.lessonOnly; }).map(function (s) {
        const t = {};
        Object.keys(s).forEach(function (k) { if (['goal', 'auto', 'enter', 'state', 'closes', 'leave', 'eraseTokens'].indexOf(k) < 0) t[k] = s[k]; });
        return t;
    });

    // ---- the lesson: the sample map, built step by step ----
    const LESSON = [
        { id: 'intro', chapter: 'start', plan: true },
        {
            id: 'new', chapter: 'start', target: '.sbx-empty-actions .btn-primary', noMap: true,
            goal: function (env) { return !!env.map; },
            auto: function (env) { env.act.newMap(); }
        },

        {
            id: 'size', chapter: 'shape', target: '.sbx-size-box', mark: [tool('shape')], tool: 'shape', mode: 'outline',
            goal: function (env) { return env.map.width === SAMPLE.width && env.map.length === SAMPLE.length; },
            auto: function (env) { env.act.resize(SAMPLE.width, SAMPLE.length); },
            state: function (env) {
                const w = env.map.width, l = env.map.length;
                if (l !== SAMPLE.length) return { key: 'length', params: { l: l } };
                if (w > SAMPLE.width) return { key: 'more', params: { w: w } };
                if (w < SAMPLE.width - 1) return { key: 'less', params: { w: w } };
                return null;
            }
        },
        {
            id: 'outline', chapter: 'shape', target: PANEL, tool: 'shape', mode: 'outline',
            region: function () { return [tileBox(SAMPLE.outside)]; },
            goal: function (env) { return env.M.isOutside(env.map, c(SAMPLE.outside[0]), c(SAMPLE.outside[1])) && !extraOutside(env); },
            auto: function (env) {
                eachTile(env.map, function (x, y) { if (env.M.isOutside(env.map, x, y)) env.M.setRoom(env.map, x, y, 1); });
                env.M.setRoom(env.map, c(SAMPLE.outside[0]), c(SAMPLE.outside[1]), 0);
                env.sync();
            },
            state: function (env) {
                const n = extraOutside(env);
                return n ? { key: 'extra', params: { n: n } } : null;
            }
        },
        {
            id: 'addCol', chapter: 'shape', target: PANEL, tool: 'shape', mode: 'addCol',
            region: function (env) { return [lastColumn(env)]; },
            enter: function (env, st) { st.w = env.map.width; },
            goal: function (env, st) { return env.map.width > st.w; },
            auto: function (env) { env.M.insertLine(env.map, 'x', 2 * env.map.width); env.sync(); },
            state: function (env, st) { return env.map.width < st.w ? { key: 'removed' } : null; }
        },
        {
            id: 'delCol', chapter: 'shape', target: PANEL, tool: 'shape', mode: 'delCol',
            region: function (env) { return [lastColumn(env)]; },
            goal: function (env) { return env.map.width === SAMPLE.width; },
            auto: function (env) {
                while (env.map.width > SAMPLE.width) env.M.removeLine(env.map, 'x', 2 * env.map.width - 1);
                while (env.map.width < SAMPLE.width) env.M.insertLine(env.map, 'x', 2 * env.map.width);
                env.sync();
            },
            state: function (env) {
                const w = env.map.width;
                if (w > SAMPLE.width + 1) return { key: 'more', params: { n: w - SAMPLE.width } };
                if (w < SAMPLE.width) return { key: 'less', params: { n: SAMPLE.width - w } };
                return null;
            }
        },

        roomStep(2),
        roomStep(3),
        roomStep(4),

        {
            id: 'pass12', chapter: 'passages', target: PANEL, tool: 'passage',
            region: function () { return [[2, 1, 3, 1]]; },
            goal: function (env) { return reached(env, 2); },
            auto: function (env) { env.M.togglePassage(env.map, 6, 3, [5, 3]); env.sync(); }
        },
        {
            id: 'pass34', chapter: 'passages', target: PANEL, tool: 'passage',
            region: function () { return [[4, 2, 4, 3], [5, 4, 6, 4]]; },
            goal: function (env) { return reached(env, 3) && reached(env, 4); },
            auto: function (env) {
                if (!reached(env, 3)) { env.M.togglePassage(env.map, 9, 6, [9, 5]); env.sync(); }
                if (!reached(env, 4)) { env.M.togglePassage(env.map, 12, 9, [11, 9]); env.sync(); }
            },
            state: function (env) {
                const r3 = reached(env, 3), r4 = reached(env, 4);
                if (r3 && !r4) return { key: 'need4' };
                if (!r3 && r4) return { key: 'need3' };
                return null;
            }
        },

        {
            id: 'wall1', chapter: 'walls', target: PANEL, tool: 'line', keys: ['Shift'],
            region: function () { return [[1, 1, 2, 2]]; },
            guide: function () { return [SAMPLE.wall1]; },
            goal: function (env) { return innerSegs(env, 1) >= 2; },
            auto: function (env) { env.M.setWalls(env.map, segsAlong(env.L, SAMPLE.wall1), true); env.sync(); },
            state: function (env) { return innerSegs(env, 1) === 1 ? { key: 'left' } : null; }
        },
        {
            id: 'wall2', chapter: 'walls', target: PANEL, tool: 'line',
            region: function () { return [[4, 1, 5, 2]]; },
            guide: function () { return [SAMPLE.wall2]; },
            goal: function (env) { return innerSegs(env, 2) >= 3; },
            auto: function (env) { env.M.setWalls(env.map, segsAlong(env.L, SAMPLE.wall2), true); env.sync(); },
            state: function (env) {
                const n = innerSegs(env, 2);
                return n > 0 && n < 3 ? { key: 'left' } : null;
            }
        },
        {
            id: 'curve', chapter: 'walls', target: PANEL, tool: 'curve',
            region: function () { return [tileBox(SAMPLE.curve.tile)]; },
            goal: function (env) {
                let n = 0;
                eachTile(env.map, function (x, y) {
                    const t = env.M.tileOf(env.map, x, y);
                    if (t && env.M.roomOf(env.map, x, y) === 3 && (t.curve || []).some(function (v) { return Number(v); })) n++;
                });
                return n > 0;
            },
            auto: function (env) { const k = SAMPLE.curve; env.M.setCurve(env.map, c(k.tile[0]), c(k.tile[1]), k.q, k.v); }
        },

        {
            id: 'start', chapter: 'floors', target: PANEL, tool: 'floor', floor: 'start',
            region: function () { return [tileBox(SAMPLE.start)]; },
            goal: function (env) { const s = env.map.startTile; return !!s && s.x > 0 && env.M.roomOf(env.map, s.x, s.y) === 1; },
            auto: function (env) { env.M.setFloor(env.map, c(SAMPLE.start[0]), c(SAMPLE.start[1]), 'start'); },
            state: function (env) {
                const s = env.map.startTile;
                return s && s.x > 0 && env.M.roomOf(env.map, s.x, s.y) !== 1 ? { key: 'room' } : null;
            }
        },
        {
            id: 'floors', chapter: 'floors', target: PANEL, tool: 'floor', floor: 'checkpoint',
            region: function () { return [tileBox(SAMPLE.checkpoint), tileBox(SAMPLE.hole), tileBox(SAMPLE.swamp)]; },
            goal: function (env) { return floorCount(env, 'checkpoint') > 0 && floorCount(env, 'black') > 0 && floorCount(env, 'swamp') > 0; },
            auto: function (env) {
                [['checkpoint', SAMPLE.checkpoint], ['black', SAMPLE.hole], ['swamp', SAMPLE.swamp]].forEach(function (f) {
                    if (floorCount(env, f[0]) > 0) return;
                    env.M.setFloor(env.map, c(f[1][0]), c(f[1][1]), f[0]);
                });
            },
            state: function (env) {
                const left = ['checkpoint', 'black', 'swamp'].filter(function (k) { return !floorCount(env, k); });
                return left.length && left.length < 3 ? { key: 'left', params: { list: left, listOf: 'admin.simBeta.floors.' } } : null;
            }
        },
        {
            id: 'erase', chapter: 'floors', target: PANEL, tool: 'eraser', keys: ['Ctrl+Z'],
            region: function () { return [tileBox(SAMPLE.swamp)]; },
            // the swamp taken off, then back with undo
            enter: function (env, st) { st.gone = false; st.n0 = floorCount(env, 'swamp'); },
            goal: function (env, st) {
                const n = floorCount(env, 'swamp');
                if (n < st.n0) st.gone = true;
                return st.gone && n >= st.n0;
            },
            auto: function (env, st) { st.gone = true; },
            state: function (env, st) { return st.gone && floorCount(env, 'swamp') < st.n0 ? { key: 'undo' } : null; }
        },

        {
            id: 'victim', chapter: 'victims', target: PANEL, tool: 'victim', victim: 'H',
            region: function () { return [[1, 1, 1, 1]]; },
            goal: function (env) { return victims(env).some(function (v) { return v.type !== 'CT' && !v.fake; }); },
            auto: function (env) { env.M.setVictim(env.map, 3, 3, 'bottom', 'H', false, { rot: 0 }); },
            state: function (env) { return victims(env).length ? { key: 'notReal' } : null; }
        },
        {
            id: 'fake', chapter: 'victims', target: PANEL, tool: 'victim',
            region: function () { return [[4, 0, 4, 0]]; },
            goal: function (env) { return victims(env).some(function (v) { return v.type !== 'CT' && v.fake; }); },
            auto: function (env) { env.M.setSlotVictim(env.map, 9, 1, 0, 'S', true, { rot: 90 }); },
            enter: function (env, st) { st.n0 = victims(env).length; },
            state: function (env, st) { return victims(env).length > st.n0 ? { key: 'notFake' } : null; }
        },
        {
            id: 'ct', chapter: 'victims', target: PANEL, tool: 'victim', victim: 'CT',
            region: function () { return [[3, 5, 3, 5]]; },
            goal: function (env) { return victims(env).some(function (v) { return v.type === 'CT'; }); },
            auto: function (env) { env.M.setSlotVictim(env.map, 7, 11, 10, 'CT', false, { code: 'GYYKG' }); }
        },
        {
            id: 'pick', chapter: 'victims', target: PANEL, tool: 'victim',
            // the victims put in this chapter: the card keeps clear of them
            region: function () { return [[1, 1, 1, 1], [4, 0, 4, 0], [3, 5, 3, 5]]; },
            goal: function (env) { return !!env.selected; },
            auto: function (env) {
                // the first victim placed: on an edge of a room 1 tile, or in a slot
                let where = null;
                eachTile(env.map, function (x, y) {
                    if (where) return;
                    const v = env.M.edgeVictim(env.map, x, y);
                    if (v) { where = { kind: 'edge', x: x, y: y, dir: v.dir }; return; }
                    for (let i = 0; i < 16 && !where; i++) if (env.M.slotVictim(env.map, x, y, i)) where = { kind: 'slot', x: x, y: y, i: i };
                });
                if (where) env.act.select(where);
            }
        },

        {
            id: 'r4open', chapter: 'room4', target: '.sbx-room4-block', mark: [tool('room')], tool: 'room',
            goal: function (env) { return !!env.creator; },
            auto: function (env) { env.act.openRoom4(); }
        }
    ].concat(ROOM4).concat([
        {
            id: 'select', chapter: 'finish', target: PANEL, tool: 'select', keys: ['Alt', 'Ctrl+C', 'Ctrl+V', 'Ctrl+D', 'Delete', 'Esc'],
            region: function () { return [[0, 1, 2, 5]]; },
            goal: function (env) { return !!env.region; },
            auto: function (env) { env.act.setRegion({ x0: 0, y0: 1, x1: 2, y1: 5 }); }
        },
        { id: 'view', chapter: 'finish', target: '#simBetaStage', mark: ['.sbx-view', tool('hand')], keys: ['Wheel', 'Space + Drag', 'H'] },
        {
            id: 'linear', chapter: 'finish', target: '.sbx-linear', place: 'below',
            goal: function (env) { return !!env.ui.showLinear; },
            auto: function (env) { if (!env.ui.showLinear) env.act.toggleLinear(); }
        },
        {
            // done already when every step before it was followed
            id: 'checks', chapter: 'finish', target: '.sbx-checks', checks: true, maybeDone: true,
            goal: function (env) { return !env.problems.some(function (p) { return p.block; }); },
            auto: function (env) { env.act.fixAll(); },
            state: function (env) {
                const n = env.problems.filter(function (p) { return p.block; }).length;
                return n ? { key: 'left', params: { n: n } } : null;
            }
        },
        {
            id: 'name', chapter: 'finish', target: '.sbx-name', place: 'below',
            enter: function (env, st) { st.name = env.map.name || ''; },
            goal: function (env, st) { return !!env.map.name && env.map.name !== st.name; },
            auto: function (env) { env.act.rename('my_first_world'); }
        },
        { id: 'save', chapter: 'finish', target: '.sbx-file', place: 'below' },
        { id: 'export', chapter: 'finish', target: '.sbx-export', place: 'below' },
        { id: 'more', chapter: 'finish', target: '.sbx-status-tools' },
        { id: 'done', chapter: 'finish', plan: true }
    ]);
    const LESSON_CHAPTERS = ['start', 'shape', 'rooms', 'passages', 'walls', 'floors', 'victims', 'room4', 'finish'];

    // ---- placing the card ----
    // Where a card of cw x ch goes beside the lit rect r ({ left, top, right, bottom }) in a window of
    // vw x vh: beside it (right, left; 'below' steps first under it), where it covers none of `avoid`
    // if it can; else over r at its bottom right; never out of the window. Without r, in the middle.
    function place(r, cw, ch, vw, vh, pref, avoid) {
        const G = 14, E = 12;
        const clampX = function (x) { return Math.max(E, Math.min(vw - cw - E, x)); };
        const clampY = function (y) { return Math.max(E, Math.min(vh - ch - E, y)); };
        if (!r) return { left: clampX((vw - cw) / 2), top: clampY((vh - ch) / 2), side: 'centre' };
        const sides = {
            right: function () { return r.right + G + cw + E <= vw ? { left: r.right + G, top: clampY(r.top) } : null; },
            left: function () { return r.left - G - cw >= E ? { left: r.left - G - cw, top: clampY(r.top) } : null; },
            below: function () { return r.bottom + G + ch + E <= vh ? { left: clampX(r.left), top: r.bottom + G } : null; },
            above: function () { return r.top - G - ch >= E ? { left: clampX(r.left), top: r.top - G - ch } : null; }
        };
        const covers = function (at) {
            return (avoid || []).some(function (q) { return !(at.left + cw <= q.left || at.left >= q.right || at.top + ch <= q.top || at.top >= q.bottom); });
        };
        const order = pref === 'below' ? ['below', 'left', 'right', 'above'] : ['right', 'left', 'below', 'above'];
        let first = null;
        for (let i = 0; i < order.length; i++) {
            const at = sides[order[i]]();
            if (!at) continue;
            at.side = order[i];
            if (!covers(at)) return at;
            first = first || at;
        }
        if (first) return first;
        return { left: clampX(r.right - cw - 24), top: clampY(r.bottom - ch - 24), side: 'inside' };
    }

    // A rect grown by pad and kept inside the window
    function pad(r, p, vw, vh) {
        return { left: Math.max(2, r.left - p), top: Math.max(2, r.top - p), right: Math.min(vw - 2, r.right + p), bottom: Math.min(vh - 2, r.bottom + p) };
    }

    const api = {
        STEPS: STEPS, CHAPTERS: CHAPTERS, LESSON: LESSON, LESSON_CHAPTERS: LESSON_CHAPTERS, ROOM4: ROOM4, ROOM4_TOUR: ROOM4_TOUR, SAMPLE: SAMPLE,
        place: place, pad: pad, victims: victims, innerSegs: innerSegs, segsAlong: segsAlong
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SimBetaTour = api;
})(typeof window !== 'undefined' ? window : globalThis);
