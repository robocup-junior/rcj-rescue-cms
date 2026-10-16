// New Simulation 2026 editor (beta): the map drawn on a canvas, with tools that follow the rules of
// the room under the pointer. Maps are the classic editor's JSON. Rooms with their border walls and
// passages, walls on the 12 / 6 cm grid, curves (room 3), floors, victims, a custom room 4 (drawn in
// the custom room 4 creator; presets are left to the classic editor), undo, problems with where they
// are, JSON and .wbt.
var app = angular.module('SimBeta', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

app.controller('SimBetaController', ['$scope', '$timeout', '$translate', '$uibModal', '$q', function ($scope, $timeout, $translate, $uibModal, $q) {
    const M = SimBetaModel, L = SimLattice, W = SimWorld2026;
    const TILE = 12;

    $scope.tools = [
        // icons and keys as the same tools of the custom room 4 creator
        { id: 'select', icon: 'fas fa-mouse-pointer', key: 'S' },
        { id: 'hand', icon: 'fas fa-hand-paper', key: 'H' },
        { id: 'shape', icon: 'fas fa-crop-alt', key: 'X' },
        { id: 'room', icon: 'fas fa-layer-group', key: 'M' },
        { id: 'passage', icon: 'fas fa-door-open', key: 'P' },
        { id: 'line', icon: 'fas fa-slash', key: 'L' },
        { id: 'curve', icon: 'fas fa-circle-notch', key: 'A' },
        { id: 'eraser', icon: 'fas fa-eraser', key: 'E' },
        { id: 'floor', icon: 'fas fa-fill-drip', key: 'F' },
        { id: 'victim', icon: 'fas fa-user-injured', key: 'V' }
    ];
    // the rail shows them in groups: look / rooms / walls / floors and victims
    const byId = function (id) { return $scope.tools.find(function (t) { return t.id === id; }); };
    $scope.toolGroups = [['select', 'hand'], ['shape', 'room', 'passage'], ['line', 'curve', 'eraser'], ['floor', 'victim']]
        .map(function (g) { return g.map(byId); });
    $scope.toolKey = function (id) { return (byId(id) || {}).key; };
    $scope.roomChoices = [1, 2, 3, 4];
    $scope.shapeModes = [
        { id: 'outline', icon: 'fa-crop-alt' }, { id: 'addRow', icon: 'fa-grip-lines' }, { id: 'addCol', icon: 'fa-grip-lines-vertical' },
        { id: 'delRow', icon: 'fa-minus' }, { id: 'delCol', icon: 'fa-minus fa-rotate-90' }
    ];
    $scope.floorChoices = [
        { id: 'checkpoint', icon: 'fa-flag-checkered' }, { id: 'black', icon: 'fa-square' },
        { id: 'swamp', icon: 'fa-water' }, { id: 'start', icon: 'fa-play' }, { id: 'clear', icon: 'fa-times' }
    ];
    // Victim choices as the stamps of the room 4 creator: letter victims (real / fake rows) and
    // cognitive targets by type (a type gives random rings of it, then the rings can be changed)
    const STAMPS = SimRoom4World2026.stampTypes;
    const LETTER = { 'Φ': 'H', 'Ψ': 'S', 'Ω': 'U' };
    $scope.victimRows = [
        { label: 'real', types: STAMPS.filter(function (t) { return t.kind === 'victim'; }) },
        { label: 'fake', types: STAMPS.filter(function (t) { return t.kind === 'fake'; }) }
    ].map(function (row) {
        row.types = row.types.map(function (t) { return { id: LETTER[t.symbol], fake: t.kind === 'fake', kind: t.kind, symbol: t.symbol, color: t.color, name: t.name }; });
        return row;
    });
    $scope.ctStamps = STAMPS.filter(function (t) { return t.kind === 'ct' || t.kind === 'fakect'; })
        .map(function (t) { return { letter: t.kind === 'fakect' ? 'X' : t.symbol, kind: t.kind, symbol: t.symbol, color: t.color, name: t.name }; });
    $scope.pickVictim = function (v) { $scope.ui.victim = v.id; $scope.ui.fake = v.fake; };
    $scope.pickCt = function (letter) {
        $scope.ui.victim = 'CT';
        if ($scope.ctLetter() !== letter) $scope.randomCode(letter);
    };
    $scope.targetStyle = function (code) {
        return { background: SimIcons.targetBackground(code, SimIcons.TYPE[SimIcons.typeOf(code)]) };
    };
    $scope.victimChoices = [{ id: 'H', symbol: 'Φ' }, { id: 'S', symbol: 'Ψ' }, { id: 'U', symbol: 'Ω' }, { id: 'CT', symbol: 'CT' }];
    // Cognitive target: five rings, K R Y G B from the outside in (Erebus order); the sum of their
    // values gives the type (0 F, 1 P, 2 C, 3 O, anything else fake)
    $scope.ringColors = [
        { id: 'K', color: '#111827', value: -2 }, { id: 'R', color: '#dc2626', value: -1 }, { id: 'Y', color: '#facc15', value: 0 },
        { id: 'G', color: '#16a34a', value: 1 }, { id: 'B', color: '#2563eb', value: 2 }
    ];
    $scope.ctTypes = ['F', 'P', 'C', 'O', 'X'];
    $scope.presets = W.area4Presets();
    $scope.selected = null;

    $scope.ui = { tool: 'line', room: 2, floor: 'checkpoint', victim: 'H', fake: false,
        rings: 'GYYKG'.split(''), ring: 0, rot: 0, randomRot: true, shapeMode: 'outline', showLinear: false };

    $scope.ctLetter = function () {
        return W.cognitiveCodeToVictimLetter($scope.pickerRings().join('')) || 'X';
    };
    $scope.setRing = function (i, c) { $scope.ui.rings[i] = c; };
    // the ring picked on the target takes the colour, and the next ring is picked
    $scope.pickColor = function (c) {
        const sel = $scope.selected;
        if (sel && sel.victim.type === 'CT') {
            const rings = sel.victim.code.split('');
            rings[$scope.ui.ring] = c;
            $scope.ui.ring = ($scope.ui.ring + 1) % 5;
            $scope.changeSelected({ code: rings.join('') });
            return;
        }
        $scope.ui.rings[$scope.ui.ring] = c;
        $scope.ui.ring = ($scope.ui.ring + 1) % 5;
    };
    // the rings the picker shows: those of the selected cognitive target, or of the next one
    $scope.pickerRings = function () {
        const sel = $scope.selected;
        return sel && sel.victim.type === 'CT' ? sel.victim.code.split('') : $scope.ui.rings;
    };
    $scope.ringColor = function (i) {
        const rings = $scope.pickerRings();
        const c = $scope.ringColors.find(function (r) { return r.id === rings[i]; });
        return c ? c.color : '#fff';
    };
    $scope.ctSum = function () {
        return $scope.pickerRings().reduce(function (sum, id) {
            const c = $scope.ringColors.find(function (r) { return r.id === id; });
            return sum + (c ? c.value : 0);
        }, 0);
    };
    // the symbol shown on the rotation dial for the victim being placed
    $scope.victimSymbol = function () {
        if ($scope.ui.victim === 'CT') { const l = $scope.ctLetter(); return l === 'X' ? '×' : l; }
        return { H: 'Φ', S: 'Ψ', U: 'Ω' }[$scope.ui.victim];
    };
    $scope.randomCode = function (type) { $scope.ui.rings = W.randomCognitiveCode(type).split(''); };

    // the victim being placed: type, fake, ring code and turn (random each time when asked)
    function victimOpts() {
        const rot = $scope.ui.randomRot ? Math.floor(Math.random() * 360) : (Number($scope.ui.rot) || 0) % 360;
        return { code: $scope.ui.rings.join(''), rot: rot };
    }

    function sameVictim(cur) {
        const ui = $scope.ui;
        if (!cur || cur.type !== ui.victim) return false;
        return ui.victim === 'CT' ? cur.code === ui.rings.join('') : cur.fake === !!ui.fake;
    }
    $scope.map = null;
    $scope.problems = [];
    $scope.hint = '';
    $scope.canUndo = false;
    $scope.canRedo = false;

    let map = null, borders = new Set(), past = [], future = [], before = null, dirty = false;
    let hover = null, stroke = null;

    const view = SimBetaView.create(document.getElementById('simBetaCanvas'), {
        onView: function (v) { $timeout(function () { $scope.zoom = v.zoom; }); },
        // the checks card floats at the top right of the map: fit the map beside it while it is open
        fitInset: function () {
            const card = document.querySelector('.sbx-checks');
            if (!card || $scope.ui.checksFolded) return 0;
            return card.getBoundingClientRect().width + 24;
        },
        overlay: drawOverlay,
        underlay: drawLinear,
        tool: {
            pans: function () { return $scope.ui.tool === 'hand'; },
            down: function (p, e) { $scope.$apply(function () { toolDown(p, e); }); },
            move: function (p, dragging) { $scope.$apply(function () { toolMove(p, dragging); }); },
            up: function (p) { $scope.$apply(function () { toolUp(p); }); },
            cancel: function () { $scope.$apply(cancelStroke); },
            leave: function () { hover = null; view.redraw(); }
        }
    });

    $scope.viewApi = view;

    // folding the checks card gives the map its room
    $scope.$watch('ui.checksFolded', function (now, before) { if (now !== before) $timeout(function () { view.fitIfAuto(); }); });

    $scope.lang = $translate.proposedLanguage() || $translate.use();
    $scope.switchLang = function () {
        $scope.lang = $scope.lang === 'ja' ? 'en' : 'ja';
        $translate.use($scope.lang);
    };
    $scope.$on('$translateChangeSuccess', function () { $scope.lang = $translate.use(); changed(); });

    // ---- the map, undo and redo --------------------------------------------------------------------

    function load(m, name) {
        map = M.normalize(m);
        borders = M.borderEdges(map);
        past = [];
        future = [];
        dirty = false;
        $scope.map = map;
        $scope.fileName = name || '';
        view.setMap(map);
        changed();
        // fit again once the side panel is there
        $timeout(function () { view.fit(); });
    }

    function begin() {
        before = JSON.stringify(map);
    }

    function commit() {
        if (before === null) return;
        if (before !== JSON.stringify(map)) {
            past.push(before);
            if (past.length > 100) past.shift();
            future = [];
            dirty = true;
            autosave();
        }
        before = null;
        changed();
    }

    function restore(json) {
        map = JSON.parse(json);
        borders = M.borderEdges(map);
        $scope.map = map;
        view.setMap(map, true);
        dirty = true;
        changed();
    }

    $scope.undo = function () {
        if (!past.length) return;
        future.push(JSON.stringify(map));
        restore(past.pop());
    };

    $scope.redo = function () {
        if (!future.length) return;
        past.push(JSON.stringify(map));
        restore(future.pop());
    };

    // ---- linear / floating: which tiles a victim scores less on ----
    // As the world export works it out (SimWorld2026.recalculate, as the classic editor): from the start
    // tile along the walls joined to it; the walls reached and the tiles beside them are linear, and a
    // victim on a linear tile is worth less. Worked out on a copy of the map, when it is shown.
    let linear = null;
    function computeLinear() {
        linear = null;
        if (!$scope.ui.showLinear || !map) return;
        const st = map.startTile;
        if (!st || !(st.x > 0)) { linear = { noStart: true }; return; }
        const copy = JSON.parse(JSON.stringify(M.saved(map)));
        W.recalculate(copy);
        const tiles = {}, floating = [];
        Object.keys(copy.cells).forEach(function (k) {
            const p = k.split(',').map(Number), c = copy.cells[k];
            if (p[2] !== 0) return;
            if (p[0] % 2 === 1 && p[1] % 2 === 1) {
                if (!M.inMap(map, p[0], p[1])) return;     // the calculation also makes tiles round the map
                // only where a victim can be: a tile with a wall on a side, or inside it
                // not reached from the start (a room without its passage): no linear / floating to tell
                if (!M.isOutside(map, p[0], p[1]) && hasAnyWall(p[0], p[1])) tiles[p[0] + ',' + p[1]] = !c.reachable ? 'U' : c.isLinear ? 'L' : 'F';
            } else if ((p[0] + p[1]) % 2 === 1 && c.isWall && !c.isLinear && p[0] <= 2 * map.width && p[1] <= 2 * map.length) {
                floating.push(p);
            }
        });
        linear = { tiles: tiles, floating: floating, unreached: Object.keys(tiles).some(function (k) { return tiles[k] === 'U'; }) };
    }

    function hasAnyWall(x, y) {
        const t = M.tileOf(map, x, y);
        if (t && ((t.halfWallIn || []).some(Boolean) || (t.curve || []).some(function (v) { return Number(v); }))) return true;
        return Object.keys(M.SIDES).some(function (d) {
            const e = map.cells[M.key(x + M.SIDES[d][0], y + M.SIDES[d][1])];
            return !!(e && (e.isWall || e.halfWall));
        });
    }

    // where the robot cannot get to (M.robotReach): its mask as a picture, shown hatched light red
    let pocketMask = null, lostVictims = [];
    function computePockets() {
        const r = map ? M.robotReach(map) : null;
        lostVictims = r ? r.victims : [];
        pocketMask = null;
        if (!r || !r.pocketCount) return;
        const c = document.createElement('canvas');
        c.width = r.gw;
        c.height = r.gh;
        const g = c.getContext('2d'), img = g.createImageData(r.gw, r.gh);
        for (let n = 0; n < r.gw * r.gh; n++) if (r.miss[n]) img.data[4 * n + 3] = 255;
        g.putImageData(img, 0, 0);
        pocketMask = { canvas: c, w: r.gw * r.res, h: r.gh * r.res, hatched: null };
    }

    function drawPockets(ctx, v) {
        if (!pocketMask) return;
        // the hatched picture is made at the size shown, and again when the zoom changes
        const scale = Math.min(4, v.scale);
        const pw = Math.ceil(pocketMask.w * scale), ph = Math.ceil(pocketMask.h * scale);
        let hc = pocketMask.hatched;
        if (!hc || hc.width !== pw || hc.height !== ph) {
            hc = document.createElement('canvas');
            hc.width = pw;
            hc.height = ph;
            const g = hc.getContext('2d');
            g.fillStyle = 'rgba(254, 202, 202, 0.55)';
            g.fillRect(0, 0, pw, ph);
            g.strokeStyle = 'rgba(220, 38, 38, 0.45)';
            g.lineWidth = 0.35 * scale;
            g.beginPath();
            for (let o = -ph; o < pw; o += 1.5 * scale) { g.moveTo(o, ph); g.lineTo(o + ph, 0); }
            g.stroke();
            g.globalCompositeOperation = 'destination-in';
            g.imageSmoothingEnabled = true;
            g.drawImage(pocketMask.canvas, 0, 0, pw, ph);
            pocketMask.hatched = hc;
        }
        ctx.drawImage(hc, 0, 0, pocketMask.w, pocketMask.h);
    }

    // victims the robot cannot get to: a red dashed ring round each
    function drawLostVictims(ctx, px) {
        if (!lostVictims.length) return;
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2 * px;
        ctx.setLineDash([4 * px, 3 * px]);
        lostVictims.forEach(function (p) {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 2.4, 0, 2 * Math.PI);
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawLinear(ctx, v) {
        if (linear && !linear.noStart) drawLinearTiles(ctx);
        drawPockets(ctx, v);
    }

    function drawLinearTiles(ctx) {
        Object.keys(linear.tiles).forEach(function (k) {
            const p = k.split(',').map(Number);
            // its own colours, nearly opaque: a light tint over the room colours would turn grey
            ctx.fillStyle = { L: 'rgba(187, 247, 208, 0.92)', F: 'rgba(254, 215, 170, 0.95)', U: 'rgba(203, 213, 225, 0.9)' }[linear.tiles[k]];
            ctx.fillRect(6 * (p[0] - 1), 6 * (p[1] - 1), 12, 12);
        });
    }

    // floating walls over the walls, in amber
    function drawFloatingWalls(ctx) {
        if (!linear || !linear.floating) return;
        ctx.save();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'square';
        ctx.beginPath();
        linear.floating.forEach(function (p) {
            if (p[0] % 2 === 0) { ctx.moveTo(6 * p[0], 6 * (p[1] - 1)); ctx.lineTo(6 * p[0], 6 * (p[1] + 1)); }
            else { ctx.moveTo(6 * (p[0] - 1), 6 * p[1]); ctx.lineTo(6 * (p[0] + 1), 6 * p[1]); }
        });
        ctx.stroke();
        ctx.restore();
    }

    $scope.toggleLinear = function () {
        $scope.ui.showLinear = !$scope.ui.showLinear;
        computeLinear();
        view.redraw();
    };
    $scope.linearNoStart = function () { return !!(linear && linear.noStart); };
    $scope.linearUnreached = function () { return !!(linear && linear.unreached); };

    function changed() {
        computeLinear();
        computePockets();
        // the problems are worked out again: one pointed out may be gone (its item with it)
        pointed = null;
        if ($scope.selected && !M.victimAt(map, $scope.selected.where)) $scope.selected = null;
        $scope.canUndo = past.length > 0;
        $scope.canRedo = future.length > 0;
        const had = $scope.problems.length;
        $scope.problems = map ? M.problems(map).map(problemText) : [];
        $scope.blocking = $scope.problems.some(function (p) { return p.block; });
        // the checks card folds by itself when the last problem goes, and opens again when one comes
        if (had && !$scope.problems.length) $scope.ui.checksFolded = true;
        else if (!had && $scope.problems.length) $scope.ui.checksFolded = false;
        view.redraw();
    }

    function problemText(p) {
        let text;
        if (p.key.indexOf('conn.') === 0) {
            const params = Object.assign({}, p.params);
            if (params.name) params.name = $translate.instant(params.name);
            text = $translate.instant('admin.simMapEditor.connCheck.' + p.key.slice(5), params);
        } else if (p.key.indexOf('area4.') === 0) {
            text = $translate.instant('admin.simMapEditor.area4Check.' + p.key.slice(6));
        } else {
            text = $translate.instant('admin.simBeta.problems.' + p.key, p.params);
        }
        return { text: text, block: !!p.block, at: p.at || null, show: p.show || null, raw: p,
            fix: M.FIXABLE.indexOf(p.key) > -1 ? 'fix' : p.key === 'customRoom4NoPicture' ? 'draw' : '' };
    }

    // ---- the editor's own dialogs (in place of alert / confirm and SweetAlert) ----
    // openDialog({ kind: 'error' | 'warn' | 'info', title, message, items: [problems], actions:
    // [{ label, value, style: 'primary' | 'danger' | '' , icon }] }) -> a promise of the value chosen
    // (null when closed)
    $scope.dialog = null;
    function openDialog(d) {
        const done = $q.defer();
        $scope.dialog = Object.assign({ actions: [{ label: $translate.instant('admin.simBeta.close'), value: null, style: 'primary' }] }, d, { done: done });
        return done.promise;
    }
    $scope.closeDialog = function (value) {
        const d = $scope.dialog;
        $scope.dialog = null;
        if (d) d.done.resolve(value === undefined ? null : value);
    };
    $scope.dialogItem = function (p) {
        $scope.closeDialog(null);
        $scope.showProblem(p);
    };

    // unsaved changes: go on only when they may be dropped
    function whenDiscarded(go) {
        if (!dirty) { go(); return; }
        openDialog({
            kind: 'warn', title: $translate.instant('admin.simBeta.discardTitle'), message: $translate.instant('admin.simBeta.discard'),
            actions: [
                { label: $translate.instant('admin.simBeta.cancel'), value: false, style: '' },
                { label: $translate.instant('admin.simBeta.saveFirst'), value: 'save', style: '', icon: 'fa-save' },
                { label: $translate.instant('admin.simBeta.discardGo'), value: true, style: 'danger', icon: 'fa-trash-alt' }
            ]
        }).then(function (v) {
            if (v === 'save') { $scope.saveJson(); go(); }
            else if (v === true) go();
        });
    }

    $scope.newMap = function () {
        whenDiscarded(function () {
            load(M.newMap(8, 6), '');
            // a new map starts with its size: the outline tool, whose panel holds it
            $scope.setTool('shape');
            $scope.ui.shapeMode = 'outline';
            $scope.ui.freshMap = true;     // its size box stands out until another tool is taken
            say('newMapSize');
        });
    };

    $scope.open = function (text, fileName) {
        let data;
        try {
            data = JSON.parse(text);
            if (!data || typeof data.cells !== 'object' || !(data.width > 0) || !(data.length > 0)) throw new Error('format');
        } catch (e) {
            $scope.error = 'admin.simBeta.badFile';
            return;
        }
        $scope.error = '';
        load(data, fileName);
    };

    function download(data, type, name) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([data], { type: type }));
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Saved as the classic editor saves (with its reachable / linear flags worked out)
    $scope.saveJson = function () {
        if (!map) return;
        const data = JSON.parse(JSON.stringify(M.saved(map)));
        if (data.startTile && data.startTile.x > 0) W.recalculate(data);
        download(JSON.stringify(data), 'application/json', (map.name || 'world') + '.json');
        dirty = false;
    };

    $scope.exportWorld = function () {
        if (!map) return;
        const blocking = $scope.problems.filter(function (p) { return p.block; });
        if (blocking.length) {
            const fixable = blocking.some(function (p) { return p.fix === 'fix'; });
            const actions = [{ label: $translate.instant('admin.simBeta.close'), value: null, style: '' }];
            if (fixable) actions.push({ label: $translate.instant('admin.simBeta.fixAll'), value: 'fix', style: 'primary', icon: 'fa-magic' });
            openDialog({
                kind: 'error', title: $translate.instant('admin.simBeta.exportBlocked'),
                message: $translate.instant('admin.simBeta.exportBlockedLead', { count: blocking.length }),
                items: blocking, actions: actions
            }).then(function (v) {
                if (v !== 'fix') return;
                $scope.fixAll();
                const left = $scope.problems.filter(function (p) { return p.block; }).length;
                if (!left) $scope.exportWorld();
            });
            return;
        }
        if (map.area4Room && map.area4Room.type === 1) {
            customWorld().then(function (text) { download(text, 'text/plain', (map.name || 'world') + '.wbt'); }, function (err) {
                $scope.$applyAsync(function () {
                    openDialog({ kind: 'error', title: $translate.instant('admin.simBeta.exportFailed'), message: String(err && err.message || err) });
                });
            });
            return;
        }
        download(M.world(map), 'text/plain', (map.name || 'world') + '.wbt');
    };

    // The world with a custom room 4: its picture is read with OpenCV, once both are loaded
    function customWorld() {
        return new Promise(function (resolve, reject) {
            let tries = 0;
            (function waitCv() {
                if (typeof cv !== 'undefined' && cv.Mat) return go();
                if (++tries > 100) return reject(new Error('OpenCV did not load'));
                setTimeout(waitCv, 100);
            })();
            function go() {
                const img = new Image();
                img.onload = function () {
                    try {
                        resolve(M.world(map, function (m) {
                            m.room4Img = img;
                            const size = room4CanvasSize();
                            m.canvasWidth = size.w;
                            m.canvasHeight = size.h;
                            return SimRoom4World2026.create(m);
                        }));
                    } catch (e) { reject(e); }
                };
                img.onerror = function () { reject(new Error('picture')); };
                img.src = map.room4CanvasSave;
            }
        });
    }

    // ---- custom room 4: the creator of the classic editor, on this map ---------------------------

    // Picture size as in the classic editor: 1600 px on the longer side of the room 4 area
    function room4CanvasSize() {
        const r = W.room4Region(map);
        const w = r.maxX - r.minX + 1, h = r.maxY - r.minY + 1;
        const block = Math.floor(1600 / Math.max(w, h));
        return { w: block * w, h: block * h };
    }

    $scope.openRoom4 = function () {
        if (!map || !map.roomTiles[2].length) { say('room4NoTiles'); return; }
        if (!map.area4Room || map.area4Room.type !== 1) {
            begin();
            map.area4Room = W.area4Presets()[1];
            borders = M.syncBorderWalls(map, borders);
            commit();
        }
        const size = room4CanvasSize();
        // the creator looks for the scope holding roomTiles, and leaves its picture there
        const host = $scope.$new();
        host.roomTiles = map.roomTiles;
        host.canvasWidth = size.w;
        host.canvasHeight = size.h;
        host.room4MapGeometry = function () { return W.mapGeometry(map); };
        host.room4Img = new Image();
        host.room4CanvasSave = map.room4CanvasSave || null;
        host.room4Tokens = JSON.parse(JSON.stringify(map.room4Tokens || []));
        host.room4StampTypes = SimRoom4World2026.stampTypes;
        const done = function () {
            const picture = (host.room4CanvasSave || null) !== (map.room4CanvasSave || null);
            const kept = JSON.stringify(host.room4Tokens || []) !== JSON.stringify(map.room4Tokens || []);
            if (picture || kept) {
                begin();
                map.room4CanvasSave = host.room4CanvasSave;
                map.room4Tokens = host.room4Tokens || [];
                commit();
                view.setMap(map, true);
            }
            host.$destroy();
        };
        $uibModal.open({
            animation: true,
            templateUrl: '/templates/sim_editor/custom_room_4_modal.2026.html',
            controller: 'CustomRoom4ModalCtrl',
            size: 'xl',
            windowClass: 'sim-r4-window sbx-r4-full',
            scope: host
        }).result.then(done, done);
    };

    // ---- problems: click to see where ---------------------------------------------------------------

    $scope.showProblem = function (p) {
        if (p.at) view.showCm(p.at[0], p.at[1]);
    };

    // Fixing: one problem, or all that can be fixed (one undo step); a custom room 4 picture is drawn
    // in the room 4 creator
    $scope.fixProblem = function (p, e) {
        if (e) e.stopPropagation();
        if (p.fix === 'draw') { $scope.openRoom4(); return; }
        begin();
        const after = M.fixProblem(map, p.raw, borders);
        if (after) borders = after;
        pointed = null;
        commit();
        say(problemsLeft(p.raw.key) ? 'fixPartly' : 'fixed');
    };
    $scope.fixAll = function () {
        begin();
        borders = M.fixAll(map, borders);
        pointed = null;
        commit();
        say($scope.problems.length ? 'fixAllLeft' : 'fixed', { count: $scope.problems.length });
    };
    $scope.canFixAll = function () {
        return $scope.problems.some(function (p) { return p.fix === 'fix'; });
    };
    function problemsLeft(key) {
        return $scope.problems.some(function (p) { return p.raw.key === key; });
    }

    // The problem under the pointer in the checks card: what it is about is pointed out on the map
    let pointed = null;
    $scope.pointProblem = function (p) {
        pointed = p && p.show ? p.show : null;
        view.redraw();
    };

    // ---- the work kept in this browser, in case the page is closed without saving -------------------

    const AUTOSAVE = 'simBeta2026.autosave';
    let autosaveTimer = null;
    function autosave() {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(function () {
            try { localStorage.setItem(AUTOSAVE, JSON.stringify({ time: Date.now(), map: M.saved(map) })); } catch (e) { /* storage full or off */ }
        }, 800);
    }
    try {
        const kept = JSON.parse(localStorage.getItem(AUTOSAVE) || 'null');
        if (kept && kept.map && kept.map.cells) $scope.kept = { time: kept.time, name: kept.map.name, map: kept.map };
    } catch (e) { $scope.kept = null; }

    $scope.restoreKept = function () {
        if (!$scope.kept) return;
        load(JSON.parse(JSON.stringify($scope.kept.map)), '');
        dirty = true;
    };

    // ---- map settings ------------------------------------------------------------------------------

    $scope.resize = function (dw, dl) {
        if (!map) return;
        begin();
        M.resize(map, map.width + dw, map.length + dl);
        borders = M.syncBorderWalls(map, borders);
        commit();
        view.fitIfAuto();
    };

    // A preset room 4 from a classic map: the new editor makes room 4 as a picture only
    $scope.toCustomRoom4 = function () {
        begin();
        map.area4Room = W.area4Presets()[(map.roomTiles[2] || []).length ? 1 : 0];
        borders = M.syncBorderWalls(map, borders);
        commit();
    };

    $scope.room4State = function () {
        if (!map) return '';
        const type = map.area4Room && map.area4Room.type;
        if (type >= 2) return 'preset';
        if (!(map.roomTiles[2] || []).length) return 'none';
        return map.room4CanvasSave ? 'drawn' : 'empty';
    };

    $scope.toggleConnCheck = function () {
        begin();
        map.connCheckOff = !map.connCheckOff;
        commit();
    };

    $scope.renamed = function () {
        dirty = true;
    };

    $scope.zoomIn = function () { view.zoom(1); };
    $scope.zoomOut = function () { view.zoom(-1); };
    $scope.fit = function () { view.fit(); };

    $scope.setTool = function (id) {
        cancelStroke();
        if (id !== $scope.ui.tool) { $scope.selected = null; $scope.ui.freshMap = false; }
        $scope.ui.tool = id;
        hover = null;
        $scope.hint = '';
        view.redraw();
    };

    // ---- tools -------------------------------------------------------------------------------------

    function tileAt(p) {
        const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.length) return null;
        return { x: 2 * tx + 1, y: 2 * ty + 1 };
    }

    // The side of the tile under p that p is nearest to, and the edge cell there
    function sideAt(p) {
        const t = tileAt(p);
        if (!t) return null;
        const cx = 6 * t.x, cy = 6 * t.y, dx = p.x - cx, dy = p.y - cy;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
        const d = M.SIDES[dir];
        return { tile: t, dir: dir, ex: t.x + d[0], ey: t.y + d[1] };
    }

    // Whether p is near the side of its tile that s names (within 4 cm of it)
    function nearEdge(p, s) {
        const d = M.SIDES[s.dir];
        const ex = 6 * s.ex, ey = 6 * s.ey;
        return d[0] ? Math.abs(p.x - ex) < 4 : Math.abs(p.y - ey) < 4;
    }

    // Walls of rooms 2 and 3 sit on the 6 cm grid, the rest on tile edges
    function stepAt(p) {
        const t = tileAt(p);
        const room = t ? M.roomOf(map, t.x, t.y) : 1;
        return room === 2 || room === 3 ? 1 : 2;
    }

    function reach() {
        return Math.max(1.5, 8 / view.scale());
    }

    function say(key, params) {
        $scope.hint = key ? $translate.instant('admin.simBeta.hints.' + key, params) : '';
    }

    function toolDown(p, e) {
        const tool = $scope.ui.tool;
        begin();
        if (tool === 'select') { regionDown(p, e); view.redraw(); return; }
        if (tool === 'line') {
            const step = stepAt(p);
            stroke = { step: step, from: L.snap(p.x, p.y, step, map.width, map.length), straight: !!(e && e.shiftKey) };
            stroke.to = stroke.from;
            stroke.corners = [stroke.from];
            planStroke();
        } else if (tool === 'room') {
            stroke = {};
            paintRoom(p);
        } else if (tool === 'shape' && $scope.ui.shapeMode === 'outline') {
            const t = tileAt(p);
            stroke = { out: !!t && !M.isOutside(map, t.x, t.y) };
            paintShape(p);
        } else if (tool === 'eraser') {
            // a drag keeps to what it started on: walls and victims, or the floors of tiles
            stroke = { floors: !thingNear(p) };
            erase(p, stroke.floors, true);
        } else {
            stroke = {};
        }
        view.redraw();
    }

    function toolMove(p, dragging) {
        const tool = $scope.ui.tool;
        if (dragging && stroke) {
            if (tool === 'line') {
                stroke.to = L.snap(p.x, p.y, stroke.step, map.width, map.length);
                planStroke();
            } else if (tool === 'room') paintRoom(p);
            else if (tool === 'select') regionMove(p);
            else if (tool === 'shape' && $scope.ui.shapeMode === 'outline') paintShape(p);
            else if (tool === 'eraser') erase(p, stroke.floors, false);
        }
        hover = hoverAt(p);
        view.redraw();
    }

    function toolUp(p) {
        const tool = $scope.ui.tool;
        if (!stroke) return;
        if (tool === 'line' && stroke.plan) {
            M.setWalls(map, stroke.plan.ok, true);
            if (stroke.plan.bad.length) say('someRefused', { count: stroke.plan.bad.length });
        } else if (tool === 'passage') {
            const s = sideAt(p);
            const near = s && nearEdge(p, s);
            if (near && M.borderAt(map, s.ex, s.ey)) {
                const b = M.borderAt(map, s.ex, s.ey);
                const at = M.passageSide(map, b, [s.tile.x, s.tile.y]);
                const r = M.togglePassage(map, s.ex, s.ey, [s.tile.x, s.tile.y]);
                borders = M.syncBorderWalls(map, borders);
                say(at[0] !== s.tile.x || at[1] !== s.tile.y ? 'passageRoom4' : 'passage_' + r);
            } else if (s && M.clearPassage(map, s.tile.x, s.tile.y)) {
                borders = M.syncBorderWalls(map, borders);
                say('passage_closed');
            } else say('noBorder');
        } else if (tool === 'floor') {
            const t = tileAt(p);
            if (t) M.setFloor(map, t.x, t.y, $scope.ui.floor);
        } else if (tool === 'victim') {
            placeVictim(p);
        } else if (tool === 'select') {
            regionUp();
        } else if (tool === 'shape' && $scope.ui.shapeMode !== 'outline') {
            const op = lineAt(p);
            if (op) lineOp(op);
        } else if (tool === 'curve') {
            const c = M.arcChoice(map, p.x, p.y);
            if (c && !c.rule.ok) say('curve_' + c.rule.reason);
            else if (c) {
                const cur = Number(M.tileOf(map, c.x, c.y).curve[c.q]);
                M.setCurve(map, c.x, c.y, c.q, cur === c.v ? 0 : c.v);
            }
        }
        stroke = null;
        commit();
        hover = hoverAt(p);
        view.redraw();
    }

    function cancelStroke() {
        if (!stroke) return;
        stroke = null;
        if (before !== null) { const json = before; before = null; if (json !== JSON.stringify(map)) restore(json); }
        view.redraw();
    }

    // A line follows the pointer round corners: the run from the last corner keeps its direction
    // (across or down) and goes as far as the pointer; when the pointer leaves the run's line by a grid
    // step, the run's end becomes a corner and the next run goes the other way. Going back along the
    // run before takes its corner away again. With Shift (at the start) it stays one straight line.
    function planStroke() {
        const cs = stroke.corners, to = stroke.to;
        const along = function (c, d) { return d === 'h' ? [to[0], c[1]] : [c[0], to[1]]; };
        if (stroke.straight) stroke.dir = null;
        else {
            for (let guard = 0; guard < 64; guard++) {
                const c = cs[cs.length - 1];
                // back onto the line of the run before: its corner goes
                if (cs.length >= 2) {
                    const pa = cs[cs.length - 2], prev = pa[1] === c[1] ? 'h' : 'v';
                    if (prev === 'h' ? to[1] === c[1] : to[0] === c[0]) { cs.pop(); stroke.dir = prev; continue; }
                }
                const dx = Math.abs(to[0] - c[0]), dy = Math.abs(to[1] - c[1]);
                if (!stroke.dir || (cs.length === 1 && (stroke.dir === 'h' ? dx : dy) === 0)) stroke.dir = dx === 0 && dy === 0 ? null : dx >= dy ? 'h' : 'v';
                if (!stroke.dir) break;
                const end = along(c, stroke.dir);
                const len = stroke.dir === 'h' ? dx : dy, off = stroke.dir === 'h' ? dy : dx;
                if (len > 0 && off >= stroke.step) { cs.push(end); stroke.dir = stroke.dir === 'h' ? 'v' : 'h'; continue; }
                break;
            }
        }
        const lastRun = function (c) { return stroke.dir ? L.axisLine(c, along(c, stroke.dir)) : L.axisLine(c, to); };
        const segs = [], seen = {};
        const add = function (list) { list.forEach(function (k) { if (!seen[k]) { seen[k] = true; segs.push(k); } }); };
        for (let i = 1; i < cs.length; i++) add(L.axisLine(cs[i - 1], cs[i]).segs);
        const last = lastRun(cs[cs.length - 1]);
        add(last.segs);
        stroke.plan = M.wallPlan(map, segs);
        stroke.end = last.end;
        say(stroke.plan.bad.length ? 'refusedHere' : '');
    }

    // The row / column the shape tool would add or take out at p: { axis, insert, index } (index: the
    // edge line after which a line is added, or the tile line taken out)
    function lineAt(p) {
        const mode = $scope.ui.shapeMode;
        const axis = mode === 'addRow' || mode === 'delRow' ? 'y' : 'x';
        const v = axis === 'y' ? p.y : p.x, size = axis === 'y' ? map.length : map.width;
        if (mode === 'addRow' || mode === 'addCol') {
            const g = Math.max(0, Math.min(size, Math.round(v / TILE)));
            return { axis: axis, insert: true, index: 2 * g };
        }
        const t = Math.floor(v / TILE);
        if (t < 0 || t >= size || size <= 1) return null;
        return { axis: axis, insert: false, index: 2 * t + 1 };
    }

    // The custom room 4 picture covers the room 4 box: a line added inside the box adds a blank strip
    // to it, one taken out cuts its strip out (as in the classic editor); the stamps' kept turns /
    // rings move with it. Resolves to { picture, tokens } or null.
    function room4PictureFor(op) {
        const pic = map.room4CanvasSave;
        const r = W.room4Region(map);
        if (!pic || !r) return Promise.resolve(null);
        const tile = op.insert ? op.index / 2 : (op.index - 1) / 2;
        const lo = op.axis === 'x' ? r.minX : r.minY, hi = op.axis === 'x' ? r.maxX : r.maxY;
        if (op.insert ? !(tile > lo && tile <= hi) : !(tile >= lo && tile <= hi)) return Promise.resolve(null);
        const tiles = hi - lo + 1;
        return new Promise(function (resolve) {
            const img = new Image();
            img.onload = function () {
                const along = op.axis === 'x' ? img.width : img.height;
                const cut = function (t) { return Math.round(t * along / tiles); };
                const at = cut(tile - lo), strip = op.insert ? cut(1) : cut(tile - lo + 1) - at;
                const c = document.createElement('canvas');
                c.width = op.axis === 'x' ? img.width + (op.insert ? strip : -strip) : img.width;
                c.height = op.axis === 'y' ? img.height + (op.insert ? strip : -strip) : img.height;
                const g = c.getContext('2d');
                g.imageSmoothingEnabled = false;
                g.fillStyle = '#FFFFFF';
                g.fillRect(0, 0, c.width, c.height);
                const end = op.insert ? at : at + strip;
                if (op.axis === 'x') {
                    g.drawImage(img, 0, 0, at, img.height, 0, 0, at, img.height);
                    g.drawImage(img, end, 0, img.width - end, img.height, op.insert ? at + strip : at, 0, img.width - end, img.height);
                } else {
                    g.drawImage(img, 0, 0, img.width, at, 0, 0, img.width, at);
                    g.drawImage(img, 0, end, img.width, img.height - end, 0, op.insert ? at + strip : at, img.width, img.height - end);
                }
                const tokens = (map.room4Tokens || []).map(function (k) {
                    const v = (op.axis === 'x' ? k.fx * img.width : k.fy * img.height);
                    let nv = v;
                    if (op.insert) { if (v >= at) nv = v + strip; }
                    else if (v >= at && v < end) return null;
                    else if (v >= end) nv = v - strip;
                    const n = Object.assign({}, k);
                    if (op.axis === 'x') n.fx = +(nv / c.width).toFixed(5); else n.fy = +(nv / c.height).toFixed(5);
                    if (op.axis === 'x') n.fy = k.fy; else n.fx = k.fx;
                    return n;
                }).filter(Boolean);
                resolve({ picture: c.toDataURL('image/png'), tokens: tokens });
            };
            img.onerror = function () { resolve(null); };
            img.src = pic;
        });
    }

    function lineOp(op) {
        room4PictureFor(op).then(function (pic) {
            $scope.$apply(function () {
                begin();
                const done = op.insert ? M.insertLine(map, op.axis, op.index) : M.removeLine(map, op.axis, op.index);
                if (!done) { before = null; say('lineLimit'); return; }
                if (pic) { map.room4CanvasSave = pic.picture; map.room4Tokens = pic.tokens; }
                borders = M.resyncBorderWalls(map, borders);
                $scope.region = null;
                commit();
                view.setMap(map, true);
                view.fitIfAuto();
            });
        });
    }

    function paintShape(p) {
        const t = tileAt(p);
        if (!t || !M.setRoom(map, t.x, t.y, stroke.out ? 0 : 1)) return;
        borders = M.syncBorderWalls(map, borders);
    }

    function paintRoom(p) {
        const t = tileAt(p);
        if (!t || !M.setRoom(map, t.x, t.y, $scope.ui.room)) return;
        borders = M.syncBorderWalls(map, borders);
    }

    function victimNear(p) {
        const t = tileAt(p);
        if (!t) return null;
        const v = M.edgeVictim(map, t.x, t.y);
        if (!v) return null;
        const d = M.SIDES[v.dir];
        const vx = 6 * t.x + 4 * d[0], vy = 6 * t.y + 4 * d[1];
        return Math.hypot(p.x - vx, p.y - vy) < 2.5 ? { tile: t, victim: v } : null;
    }

    function slotNear(p) {
        const sl = M.slotAt(map, p.x, p.y);
        if (!sl || !M.slotVictim(map, sl.x, sl.y, sl.i)) return null;
        const pos = M.slotPos(sl.x, sl.y, sl.i, map);
        return Math.hypot(p.x - pos[0], p.y - pos[1]) < 1.8 ? sl : null;
    }

    // A victim, curve or wall the eraser would take at p
    function thingNear(p) {
        return !!(victimNear(p) || slotNear(p) || M.arcNear(map, p.x, p.y, reach()) || M.segNear(map, p.x, p.y, reach()));
    }

    // The floor of the tile under p the eraser takes off: a hole, swamp or checkpoint, or the start
    // (on a click only, not dragged over); null if there is none
    function floorNear(p, click) {
        const at = tileAt(p);
        if (!at) return null;
        const t = M.tileOf(map, at.x, at.y);
        if (t && (t.black || t.swamp || t.checkpoint)) return { tile: at, kind: 'clear' };
        const st = map.startTile;
        if (click && st && st.x === at.x && st.y === at.y) return { tile: at, kind: 'start' };
        return null;
    }

    function erase(p, floors, click) {
        if (floors) {
            const f = floorNear(p, click);
            if (!f) return;
            if (f.kind === 'start') map.startTile = { x: 0, y: 0, z: 0 };
            else M.setFloor(map, f.tile.x, f.tile.y, 'clear');
            return;
        }
        const v = victimNear(p);
        if (v) { M.clearVictim(map, v.tile.x, v.tile.y); return; }
        const sl = slotNear(p);
        if (sl) { M.clearSlotVictim(map, sl.x, sl.y, sl.i); return; }
        const a = M.arcNear(map, p.x, p.y, reach());
        if (a) { M.setCurve(map, a.x, a.y, a.q, 0); return; }
        const s = M.segNear(map, p.x, p.y, reach());
        if (!s) return;
        const rule = L.segRule(s, M.roomLookup(map));
        M.setWalls(map, rule.whole ? [s, L.otherHalf(s)] : [s], false);
    }

    // ---- select: a region of tiles - moved by dragging (Alt: a copy), copied, cut, pasted, cleared ----

    let clip = null;                 // what copy / cut took
    let lastTile = null;             // the tile under the pointer, where paste puts things
    $scope.region = null;            // { x0, y0, x1, y1 } tile indices
    $scope.hasClip = false;

    function tileIndex(p, clamp) {
        let tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
        if (clamp) { tx = Math.max(0, Math.min(map.width - 1, tx)); ty = Math.max(0, Math.min(map.length - 1, ty)); }
        return [tx, ty];
    }

    function rect(a, b) {
        return { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
    }

    function inRegion(t) {
        const r = $scope.region;
        return !!r && t[0] >= r.x0 && t[0] <= r.x1 && t[1] >= r.y0 && t[1] <= r.y1;
    }

    function regionDown(p, e) {
        const t = tileIndex(p, true);
        if (inRegion(t)) stroke = { move: true, start: t, dx: 0, dy: 0, copy: !!(e && e.altKey) };
        else { stroke = { selecting: true, a: t }; $scope.region = rect(t, t); }
    }

    function regionMove(p) {
        const t = tileIndex(p, true);
        const r = $scope.region;
        if (stroke.selecting) $scope.region = rect(stroke.a, t);
        else if (stroke.move) {
            // kept inside the map
            stroke.dx = Math.max(-r.x0, Math.min(map.width - 1 - r.x1, t[0] - stroke.start[0]));
            stroke.dy = Math.max(-r.y0, Math.min(map.length - 1 - r.y1, t[1] - stroke.start[1]));
        }
    }

    function regionUp() {
        if (stroke && stroke.move && (stroke.dx || stroke.dy)) moveRegion(stroke.dx, stroke.dy, stroke.copy);
        say($scope.region ? 'regionTip' : '');
    }

    function moveRegion(dx, dy, copy) {
        const r = $scope.region;
        const st = map.startTile;
        const startIn = st && st.x > 0 && inRegion([(st.x - 1) / 2, (st.y - 1) / 2]);
        const c = M.copyRegion(map, r);
        if (!copy) M.clearRegion(map, r);
        M.pasteRegion(map, c, r.x0 + dx, r.y0 + dy);
        if (startIn && !copy) map.startTile = { x: st.x + 2 * dx, y: st.y + 2 * dy, z: 0 };
        borders = M.resyncBorderWalls(map, borders);
        $scope.region = { x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy };
    }

    function regionAction(fn) {
        if (!map) return;
        begin();
        fn();
        commit();
        view.redraw();
    }

    $scope.copyRegion = function () {
        if (!$scope.region) return;
        clip = M.copyRegion(map, $scope.region);
        $scope.hasClip = true;
        say('regionCopied');
    };
    $scope.cutRegion = function () {
        if (!$scope.region) return;
        $scope.copyRegion();
        regionAction(function () { M.clearRegion(map, $scope.region); borders = M.resyncBorderWalls(map, borders); });
    };
    $scope.clearRegion = function () {
        if (!$scope.region) return;
        regionAction(function () { M.clearRegion(map, $scope.region); borders = M.resyncBorderWalls(map, borders); });
    };
    // at the tile under the pointer, or where the selection is
    $scope.pasteRegion = function () {
        if (!clip) return;
        const at = lastTile || ($scope.region ? [$scope.region.x0, $scope.region.y0] : [0, 0]);
        const x0 = Math.max(0, Math.min(map.width - clip.w, at[0])), y0 = Math.max(0, Math.min(map.length - clip.h, at[1]));
        regionAction(function () { M.pasteRegion(map, clip, x0, y0); borders = M.resyncBorderWalls(map, borders); });
        $scope.region = { x0: x0, y0: y0, x1: Math.min(map.width - 1, x0 + clip.w - 1), y1: Math.min(map.length - 1, y0 + clip.h - 1) };
    };
    // a copy beside the selection (right of it, or below when there is no room)
    $scope.duplicateRegion = function () {
        const r = $scope.region;
        if (!r) return;
        const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
        const dx = r.x1 + w < map.width ? w : 0, dy = dx ? 0 : (r.y1 + h < map.length ? h : 0);
        if (!dx && !dy) { say('regionNoRoom'); return; }
        regionAction(function () { moveRegion(dx, dy, true); });
    };
    $scope.nudgeRegion = function (dx, dy) {
        const r = $scope.region;
        if (!r || r.x0 + dx < 0 || r.y0 + dy < 0 || r.x1 + dx >= map.width || r.y1 + dy >= map.length) return;
        regionAction(function () { moveRegion(dx, dy, false); });
    };
    $scope.regionSize = function () {
        const r = $scope.region;
        return r ? (r.x1 - r.x0 + 1) + ' × ' + (r.y1 - r.y0 + 1) : '';
    };

    // ---- the victim tool: a placed victim clicked on is selected, and changed in the panel ----

    function selectWhere(where) {
        const v = where && M.victimAt(map, where);
        $scope.selected = v ? { where: where, victim: v, rot: v.rot, letter: v.type === 'CT' ? (W.cognitiveCodeToVictimLetter(v.code) || 'X') : '' } : null;
    }

    $scope.selectNone = function () { $scope.selected = null; view.redraw(); };

    $scope.changeSelected = function (change) {
        const sel = $scope.selected;
        if (!sel) return;
        begin();
        M.changeVictim(map, sel.where, change);
        commit();
        selectWhere(sel.where);
    };

    $scope.removeSelected = function () {
        const sel = $scope.selected;
        if (!sel) return;
        begin();
        M.removeVictim(map, sel.where);
        commit();
        $scope.selected = null;
    };

    function selectedPos() {
        const w = $scope.selected && $scope.selected.where;
        if (!w) return null;
        if (w.kind === 'slot') return M.slotPos(w.x, w.y, w.i, map);
        const d = M.SIDES[w.dir];
        return [6 * w.x + 4 * d[0], 6 * w.y + 4 * d[1]];
    }

    function quarterTile(p) {
        const t = tileAt(p);
        const room = t ? M.roomOf(map, t.x, t.y) : 0;
        return room === 2 || room === 3;
    }

    // A placed victim of the chosen kind is selected (its turn / rings in the panel, as the room 4
    // creator does); one of another kind takes the chosen kind
    function placeVictim(p) {
        if (quarterTile(p)) {
            const sl = M.slotAt(map, p.x, p.y);
            const where = { kind: 'slot', x: sl.x, y: sl.y, i: sl.i };
            const cur = M.slotVictim(map, sl.x, sl.y, sl.i);
            if (sameVictim(cur)) { selectWhere(where); return; }
            const rule = M.slotRule(map, sl.x, sl.y, sl.i);
            if (!rule.ok) { say('victim_' + rule.reason); return; }
            M.setSlotVictim(map, sl.x, sl.y, sl.i, $scope.ui.victim, $scope.ui.fake, victimOpts());
            selectWhere(null);
            return;
        }
        const s = sideAt(p);
        if (!s) return;
        const where = { kind: 'edge', x: s.tile.x, y: s.tile.y, dir: s.dir };
        const v = M.edgeVictim(map, s.tile.x, s.tile.y);
        if (v && v.dir === s.dir && sameVictim(v)) { selectWhere(where); return; }
        const rule = M.victimRule(map, s.tile.x, s.tile.y, s.dir);
        if (!rule.ok) { say('victim_' + rule.reason); return; }
        M.setVictim(map, s.tile.x, s.tile.y, s.dir, $scope.ui.victim, $scope.ui.fake, victimOpts());
        selectWhere(null);
    }

    // What the tool would do at p, for the preview
    function hoverAt(p) {
        const tool = $scope.ui.tool;
        const ti = tileIndex(p, false);
        lastTile = ti[0] >= 0 && ti[1] >= 0 && ti[0] < map.width && ti[1] < map.length ? ti : lastTile;
        if (tool === 'shape' && $scope.ui.shapeMode !== 'outline') {
            const op = lineAt(p);
            if (op) say('line_' + $scope.ui.shapeMode);
            return op ? { kind: 'line', op: op } : null;
        }
        if (tool === 'line') {
            if (stroke) return null;
            const step = stepAt(p);
            return { kind: 'point', at: L.snap(p.x, p.y, step, map.width, map.length), step: step };
        }
        if (tool === 'shape') {
            const t = tileAt(p);
            if (!t) return null;
            const out = M.isOutside(map, t.x, t.y);
            say(out ? 'shapeIn' : 'shapeOut');
            return { kind: 'tile', tile: t, color: out ? '#16a34a' : '#dc2626' };
        }
        if (tool === 'room' || tool === 'floor') {
            const t = tileAt(p);
            return t ? { kind: 'tile', tile: t } : null;
        }
        if (tool === 'select') {
            const t = tileIndex(p, false);
            say(inRegion(t) ? 'regionDrag' : 'regionPick');
            return null;
        }
        if (tool === 'curve') {
            const c = M.arcChoice(map, p.x, p.y);
            if (!c) return null;
            say(c.rule.ok ? '' : 'curve_' + c.rule.reason);
            return { kind: 'curve', choice: c };
        }
        if (tool === 'eraser') {
            const v = victimNear(p);
            if (v) return { kind: 'victim', tile: v.tile, dir: v.victim.dir };
            const sl = slotNear(p);
            if (sl) return { kind: 'spot', at: M.slotPos(sl.x, sl.y, sl.i, map), color: '#dc2626' };
            const a = M.arcNear(map, p.x, p.y, reach());
            if (a) return { kind: 'arc', arc: a, color: '#dc2626' };
            const s = M.segNear(map, p.x, p.y, reach());
            if (!s) {
                // while dragging over walls, floors are left alone
                const f = !(stroke && !stroke.floors) && floorNear(p, !stroke);
                return f ? { kind: 'tile', tile: f.tile, color: '#dc2626' } : null;
            }
            const rule = L.segRule(s, M.roomLookup(map));
            return { kind: 'segs', segs: rule.whole ? [s, L.otherHalf(s)] : [s], color: '#dc2626' };
        }
        if (tool === 'passage') {
            const s = sideAt(p);
            if (!s) return null;
            const b = nearEdge(p, s) && M.borderAt(map, s.ex, s.ey);
            if (b) {
                const at = M.passageSide(map, b, [s.tile.x, s.tile.y]);
                const here = M.tileOf(map, at[0], at[1]);
                const moved = at[0] !== s.tile.x || at[1] !== s.tile.y;
                say(moved ? 'passageRoom4' : here && here.color === b.pass.color ? 'passageClose' : 'passageOpen');
                return { kind: 'border', side: s, border: b, at: at };
            }
            const t = M.tileOf(map, s.tile.x, s.tile.y);
            const isPass = t && t.color && W.ROOM_PASSAGES.some(function (q) { return q.color === t.color; });
            say(isPass ? 'passageRemove' : 'passageHere');
            return isPass ? { kind: 'tile', tile: s.tile, color: '#dc2626' } : null;
        }
        if (tool === 'victim' && quarterTile(p)) {
            const sl = M.slotAt(map, p.x, p.y);
            const rule = M.slotRule(map, sl.x, sl.y, sl.i);
            say(rule.ok ? '' : 'victim_' + rule.reason);
            return { kind: 'spot', at: M.slotPos(sl.x, sl.y, sl.i, map), color: rule.ok ? '#16a34a' : '#dc2626', small: true };
        }
        if (tool === 'victim') {
            const s = sideAt(p);
            if (!s) return null;
            const rule = M.victimRule(map, s.tile.x, s.tile.y, s.dir);
            say(rule.ok ? '' : 'victim_' + rule.reason);
            return { kind: 'victimSpot', side: s, ok: rule.ok };
        }
        return null;
    }

    // ---- preview on the canvas (cm) ----------------------------------------------------------------

    function segLine(ctx, s) {
        const g = L.parseSeg(s);
        ctx.moveTo(6 * g.i, 6 * g.j);
        if (g.dir === 'v') ctx.lineTo(6 * g.i, 6 * (g.j + 1));
        else ctx.lineTo(6 * (g.i + 1), 6 * g.j);
    }

    function drawSegs(ctx, segs, color, width) {
        if (!segs.length) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'square';
        ctx.beginPath();
        segs.forEach(function (s) { segLine(ctx, s); });
        ctx.stroke();
    }

    function drawOverlay(ctx, v) {
        if (!map) return;
        const px = 1 / v.scale;
        drawFloatingWalls(ctx);
        drawLostVictims(ctx, px);
        const tool = $scope.ui.tool;
        // the borders where a passage can go, while the passage tool is out
        if (tool === 'passage') {
            ctx.lineWidth = 4 * px;
            ctx.setLineDash([6 * px, 4 * px]);
            for (let x = 1; x < 2 * map.width; x += 2) {
                for (let y = 1; y < 2 * map.length; y += 2) {
                    [[1, 0], [0, 1]].forEach(function (d) {
                        const b = M.borderAt(map, x + d[0], y + d[1]);
                        if (!b) return;
                        ctx.strokeStyle = b.pass.color;
                        ctx.beginPath();
                        const ex = 6 * (x + d[0]), ey = 6 * (y + d[1]);
                        if (d[0]) { ctx.moveTo(ex, ey - 5); ctx.lineTo(ex, ey + 5); } else { ctx.moveTo(ex - 5, ey); ctx.lineTo(ex + 5, ey); }
                        ctx.stroke();
                    });
                }
            }
            ctx.setLineDash([]);
        }
        if (stroke && stroke.plan) {
            drawSegs(ctx, stroke.plan.ok, 'rgba(37, 99, 235, 0.85)', 1.2);
            drawSegs(ctx, stroke.plan.bad, 'rgba(220, 38, 38, 0.85)', 1.2);
            [stroke.from, stroke.end].forEach(function (pt) { dot(ctx, 6 * pt[0], 6 * pt[1], 3.5 * px, '#2563eb'); });
            (stroke.corners || []).slice(1).forEach(function (pt) { dot(ctx, 6 * pt[0], 6 * pt[1], 2.5 * px, '#2563eb'); });
        }
        if (pointed) { drawPointed(ctx, px); return; }
        if (tool === 'passage') drawPassageHelp(ctx, px);
        if (tool === 'select' && $scope.region) {
            const r = $scope.region;
            const box = function (dx, dy, fill) {
                ctx.fillStyle = fill;
                ctx.fillRect(12 * (r.x0 + dx), 12 * (r.y0 + dy), 12 * (r.x1 - r.x0 + 1), 12 * (r.y1 - r.y0 + 1));
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2 * px;
                ctx.setLineDash([6 * px, 4 * px]);
                ctx.strokeRect(12 * (r.x0 + dx), 12 * (r.y0 + dy), 12 * (r.x1 - r.x0 + 1), 12 * (r.y1 - r.y0 + 1));
                ctx.setLineDash([]);
            };
            box(0, 0, 'rgba(37, 99, 235, 0.08)');
            if (stroke && stroke.move && (stroke.dx || stroke.dy)) box(stroke.dx, stroke.dy, stroke.copy ? 'rgba(22, 163, 74, 0.18)' : 'rgba(37, 99, 235, 0.18)');
        }
        const sp = selectedPos();
        if (sp) { ring(ctx, sp[0], sp[1], 2.4, '#f59e0b', px * 1.4); }
        if (!hover) return;
        if (hover.kind === 'line') {
            const o = hover.op;
            const w = map.width * TILE, h = map.length * TILE;
            if (o.insert) {
                const at = 6 * o.index;
                ctx.strokeStyle = '#16a34a';
                ctx.lineWidth = 3 * px;
                ctx.beginPath();
                if (o.axis === 'y') { ctx.moveTo(-6, at); ctx.lineTo(w + 6, at); } else { ctx.moveTo(at, -6); ctx.lineTo(at, h + 6); }
                ctx.stroke();
                dot(ctx, o.axis === 'y' ? -6 : at, o.axis === 'y' ? at : -6, 9 * px, '#16a34a');
                ctx.fillStyle = '#fff';
                ctx.font = '700 ' + (14 * px) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', o.axis === 'y' ? -6 : at, (o.axis === 'y' ? at : -6) + px);
            } else {
                const at = 6 * (o.index - 1);
                ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
                if (o.axis === 'y') ctx.fillRect(0, at, w, TILE); else ctx.fillRect(at, 0, TILE, h);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 2 * px;
                if (o.axis === 'y') ctx.strokeRect(0, at, w, TILE); else ctx.strokeRect(at, 0, TILE, h);
            }
            return;
        }
        if (hover.kind === 'curve') {
            const c = hover.choice;
            for (let v = 1; v <= 4; v++) arcPath(ctx, c.x, c.y, c.q, v, v === c.v ? (c.rule.ok ? 'rgba(37, 99, 235, 0.9)' : 'rgba(220, 38, 38, 0.9)') : 'rgba(100, 116, 139, 0.35)', v === c.v ? 1.2 : 0.5);
            return;
        }
        if (hover.kind === 'arc') {
            arcPath(ctx, hover.arc.x, hover.arc.y, hover.arc.q, hover.arc.v, hover.color, 1.4);
            return;
        }
        if (hover.kind === 'spot') {
            ring(ctx, hover.at[0], hover.at[1], hover.small ? 1.8 : 2.3, hover.color, px);
            return;
        }
        if (hover.kind === 'point') {
            dot(ctx, 6 * hover.at[0], 6 * hover.at[1], 4 * px, hover.step === 1 ? '#7c3aed' : '#2563eb');
        } else if (hover.kind === 'tile') {
            ctx.strokeStyle = hover.color || '#2563eb';
            ctx.lineWidth = 2.5 * px;
            ctx.strokeRect(6 * (hover.tile.x - 1) + px, 6 * (hover.tile.y - 1) + px, TILE - 2 * px, TILE - 2 * px);
        } else if (hover.kind === 'segs') {
            drawSegs(ctx, hover.segs, hover.color, 1.4);
        } else if (hover.kind === 'victim') {
            const d = M.SIDES[hover.dir];
            ring(ctx, 6 * hover.tile.x + 4 * d[0], 6 * hover.tile.y + 4 * d[1], 2.3, '#dc2626', px);
        } else if (hover.kind === 'border') {
            const s = hover.side;
            ctx.fillStyle = hover.border.pass.color;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(6 * (hover.at[0] - 1), 6 * (hover.at[1] - 1), TILE, TILE);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = hover.border.pass.color;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            const ex = 6 * s.ex, ey = 6 * s.ey;
            if (s.ex % 2 === 0) { ctx.moveTo(ex, ey - 6); ctx.lineTo(ex, ey + 6); } else { ctx.moveTo(ex - 6, ey); ctx.lineTo(ex + 6, ey); }
            ctx.stroke();
        } else if (hover.kind === 'victimSpot') {
            const s = hover.side, d = M.SIDES[s.dir];
            ring(ctx, 6 * s.tile.x + 4 * d[0], 6 * s.tile.y + 4 * d[1], 2.3, hover.ok ? '#16a34a' : '#dc2626', px);
        }
    }

    function arcPath(ctx, x, y, q, v, color, width) {
        const c = M.arcCentre(x, y, q, v);
        const start = [[-Math.PI / 2, 0], [0, Math.PI / 2], [Math.PI / 2, Math.PI], [Math.PI, 1.5 * Math.PI]][v - 1];
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(c[0], c[1], 6, start[0], start[1]);
        ctx.stroke();
    }

    // With the passage tool: what the room check says (gaps to close or mark, where a passage
    // would join a room that is not reached yet)
    function drawPassageHelp(ctx, px) {
        const tileBox = function (k, color, dash) {
            const t = k.split(',').map(Number);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3 * px;
            ctx.setLineDash(dash ? [5 * px, 4 * px] : []);
            ctx.strokeRect(12 * t[0] + 2 * px, 12 * t[1] + 2 * px, 12 - 4 * px, 12 - 4 * px);
            ctx.setLineDash([]);
        };
        if (!map.connCheckOff) {
            const marks = W.connectionStatus(map).marks;
            Object.keys(marks).forEach(function (k) {
                const m = marks[k];
                const color = (m.style && m.style['border-color']) || '#dc2626';
                tileBox(k, color, m.cls === 'hint');
            });
        }
    }

    // Everything a problem is about: the rest of the map dimmed, its places outlined
    function drawPointed(ctx, px) {
        const sh = pointed;
        const tiles = new Set((sh.tiles || []).map(function (t) { return t[0] + ',' + t[1]; }));
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
        ctx.beginPath();
        ctx.rect(-1e4, -1e4, 2e4, 2e4);
        // holes over what is pointed out, so it stays bright
        (sh.tiles || []).forEach(function (t) { ctx.rect(12 * t[0], 12 * t[1], 12, 12); });
        (sh.points || []).forEach(function (pt) { ctx.moveTo(pt[0] + 3, pt[1]); ctx.arc(pt[0], pt[1], 3, 0, 2 * Math.PI); });
        ctx.fill('evenodd');
        const glow = function (stroke, width) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
            ctx.lineWidth = width + 6 * px;
            stroke();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = width;
            stroke();
        };
        // the outline of the tiles together (their sides that touch no other of them)
        ctx.lineCap = 'round';
        glow(function () {
            ctx.beginPath();
            (sh.tiles || []).forEach(function (t) {
                const x = 12 * t[0], y = 12 * t[1];
                if (!tiles.has(t[0] + ',' + (t[1] - 1))) { ctx.moveTo(x, y); ctx.lineTo(x + 12, y); }
                if (!tiles.has((t[0] + 1) + ',' + t[1])) { ctx.moveTo(x + 12, y); ctx.lineTo(x + 12, y + 12); }
                if (!tiles.has(t[0] + ',' + (t[1] + 1))) { ctx.moveTo(x, y + 12); ctx.lineTo(x + 12, y + 12); }
                if (!tiles.has((t[0] - 1) + ',' + t[1])) { ctx.moveTo(x, y); ctx.lineTo(x, y + 12); }
            });
            ctx.stroke();
        }, 3 * px);
        (sh.points || []).forEach(function (pt) {
            glow(function () { ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.6, 0, 2 * Math.PI); ctx.stroke(); }, 3 * px);
        });
        (sh.segs || []).forEach(function (sg) {
            glow(function () { ctx.beginPath(); segLine(ctx, sg); ctx.stroke(); }, 1.6);
        });
        (sh.arcs || []).forEach(function (a) {
            const c = M.arcCentre(a.x, a.y, a.q, a.v);
            const start = [[-Math.PI / 2, 0], [0, Math.PI / 2], [Math.PI / 2, Math.PI], [Math.PI, 1.5 * Math.PI]][a.v - 1];
            glow(function () { ctx.beginPath(); ctx.arc(c[0], c[1], 6, start[0], start[1]); ctx.stroke(); }, 1.6);
        });
        ctx.restore();
    }

    function dot(ctx, x, y, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
    }

    function ring(ctx, x, y, r, color, px) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 * px;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // ---- files, keys, leaving ----------------------------------------------------------------------

    function readFile(file) {
        const reader = new FileReader();
        reader.onload = function () { $scope.$apply(function () { $scope.open(reader.result, file.name); }); };
        reader.readAsText(file);
    }

    document.getElementById('simBetaFile').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        $scope.$apply(function () { whenDiscarded(function () { readFile(file); }); });
    });

    document.getElementById('simBetaCanvas').addEventListener('dblclick', function (e) {
        if (!map) return;
        const r = e.target.getBoundingClientRect();
        const q = view.toPx(0, 0), sc = view.scale();
        const p = { x: (e.clientX - r.left - q[0]) / sc, y: (e.clientY - r.top - q[1]) / sc };
        const t = tileAt(p);
        if (t && M.roomOf(map, t.x, t.y) === 4 && (!map.area4Room || map.area4Room.type <= 1)) $scope.$apply($scope.openRoom4);
    });

    const stage = document.getElementById('simBetaStage');
    stage.addEventListener('dragover', function (e) { e.preventDefault(); });
    stage.addEventListener('drop', function (e) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        $scope.$apply(function () { whenDiscarded(function () { readFile(file); }); });
    });

    window.addEventListener('keydown', function (e) {
        // a dialog takes the keys: Esc closes it, Enter takes its main (blue) action
        if ($scope.dialog) {
            if (e.key === 'Escape') { e.preventDefault(); $scope.$apply(function () { $scope.closeDialog(null); }); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                // never a destructive one: without a main action Enter does nothing
                const main = $scope.dialog.actions.find(function (a) { return a.style === 'primary'; });
                if (main) $scope.$apply(function () { $scope.closeDialog(main.value); });
            }
            return;
        }
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !map) return;
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); $scope.$apply(e.shiftKey ? $scope.redo : $scope.undo); return; }
        if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); $scope.$apply($scope.redo); return; }
        if ($scope.ui.tool === 'select') {
            const act = (e.ctrlKey || e.metaKey) ? { c: $scope.copyRegion, x: $scope.cutRegion, v: $scope.pasteRegion, d: $scope.duplicateRegion }[k]
                : { delete: $scope.clearRegion, backspace: $scope.clearRegion }[k];
            if (act) { e.preventDefault(); $scope.$apply(act); return; }
            const arrow = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
            if (arrow && $scope.region && !e.ctrlKey && !e.metaKey) { e.preventDefault(); $scope.$apply(function () { $scope.nudgeRegion(arrow[0], arrow[1]); }); return; }
            if (k === 'escape') { $scope.$apply(function () { $scope.region = null; view.redraw(); }); return; }
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (k === 'escape') { $scope.$apply(cancelStroke); return; }
        const tool = $scope.tools.find(function (t) { return t.key.toLowerCase() === k; });
        if (tool) $scope.$apply(function () { $scope.setTool(tool.id); });
    });

    window.addEventListener('beforeunload', function (e) {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = '';
    });
}]);
