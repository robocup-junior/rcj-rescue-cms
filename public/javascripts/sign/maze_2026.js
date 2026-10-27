// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};
var socket;
let victimConstant = {};
let victimTypes = [];
const victimConstantWL = {
    "PHI": {
        "maxKitNum": 2,
        "linearPoint": 5,
        "floatingPoint": 15
    },
    "PSI": {
        "maxKitNum": 1,
        "linearPoint": 5,
        "floatingPoint": 15
    },
    "OMEGA": {
        "maxKitNum": 0,
        "linearPoint": 5,
        "floatingPoint": 15
    },
    "Cognitive": {
        "maxKitNum": 0,
        "linearPoint": 10,
        "floatingPoint": 30
    }
};

// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http', '$translate', '$cookies', function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {
    var txt_cap_sign, txt_cref_sign, txt_ref_sign, txt_no_sign, txt_complete, txt_confirm;
    $translate('maze.sign.cap_sign').then(function (val) {
        txt_cap_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('maze.sign.ref_sign').then(function (val) {
        txt_ref_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('maze.sign.cref_sign').then(function (val) {
        txt_cref_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('maze.sign.no_sign').then(function (val) {
        txt_no_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('maze.sign.complete').then(function (val) {
        txt_complete = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('maze.sign.confirm').then(function (val) {
        txt_confirm = val;
    }, function (translationId) {
        // = translationId;
    });

    $scope.countWords = ["Bottom", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Ninth"];
    $scope.z = 0;

    $scope.MisIdent = 0;

    $scope.signData = [null, null, null];

    $scope.cells = {};
    $scope.tiles = {};

    //$cookies.remove('sRotate')
    if ($cookies.get('sRotate')) {
        $scope.sRotate = Number($cookies.get('sRotate'));
    }
    else $scope.sRotate = 0;

    if (typeof runId !== 'undefined') {
        $scope.runId = runId;
        loadNewRun();
    }

    (function launchSocketIo() {
        // launch socket.io
        socket = io(window.location.origin, {
            transports: ['websocket']
        });
        if (typeof runId !== 'undefined') {
            socket.emit('subscribe', 'runs/' + runId);
            socket.on('data', function (data) {
                $scope.status = data.status;
                $scope.exitBonus = data.exitBonus;
                $scope.score = data.score;
                $scope.normalizedScore = data.normalizedScore;
                $scope.LoPs = data.LoPs;
                $scope.foundVictims = sum(data.foundVictims.map(v => v.count));
                $scope.distKits = data.distKits;
                $scope.MisIdent = data.misidentification;

                // Verified time by timekeeper
                $scope.minutes = data.time.minutes;
                $scope.seconds = data.time.seconds;

                // Scoring elements of the tiles
                for (var i = 0; i < data.tiles.length; i++) {
                    $scope.tiles[data.tiles[i].x + ',' +
                        data.tiles[i].y + ',' +
                        data.tiles[i].z] = data.tiles[i];
                }
                $scope.$apply();
                console.log("Updated view from socket.io");
            });
        }

    })();

    // The view and sign pages are covered by a loading screen until the map is complete (line_view.js)
    function pageLoaded() {
        if (typeof revealRunPage === 'function') revealRunPage(tile_size);
    }

    function loadNewRun() {
        $http.get("/api/runs/maze/" + runId +
            "?normalized=true").then(function (response) {
                $scope.status = response.data.status;
                $scope.exitBonus = response.data.exitBonus;
                $scope.field = response.data.field.name;
                $scope.round = response.data.round.name;
                $scope.score = response.data.score;
                $scope.normalizedScore = response.data.normalizedScore;
                $scope.team = response.data.team.name;
                $scope.league = response.data.team.league;
                $scope.competition = response.data.competition.name;
                $scope.competition_id = response.data.competition._id;
                $scope.LoPs = response.data.LoPs;
                $scope.foundVictims = sum(response.data.foundVictims.map(v => v.count));
                $scope.distKits = response.data.distKits;
                $scope.MisIdent = response.data.misidentification;

                // Verified time by timekeeper
                $scope.minutes = response.data.time.minutes;
                $scope.seconds = response.data.time.seconds;

                if (response.data.sign) {
                    $scope.cap_sig = response.data.sign.captain;
                    $scope.ref_sig = response.data.sign.referee;
                    $scope.refas_sig = response.data.sign.referee_as;
                }

                $scope.comment = response.data.comment;

                // Scoring elements of the tiles
                for (let i = 0; i < response.data.tiles.length; i++) {
                    $scope.tiles[response.data.tiles[i].x + ',' +
                        response.data.tiles[i].y + ',' +
                        response.data.tiles[i].z] = response.data.tiles[i];
                }

                // Get the map
                $http.get("/api/maps/maze/" + response.data.map +
                    "?populate=true").then(function (response) {
                        console.log(response.data);
                        $scope.startTile = response.data.startTile;
                        $scope.height = response.data.height;

                        $scope.width = response.data.width;
                        $scope.length = response.data.length;

                        $scope.leagueType = response.data.leagueType;

                        victimConstant = victimConstantWL;
            $scope.victimConstantWL = victimConstantWL;

                        for (let i = 0; i < response.data.cells.length; i++) {
                            $scope.cells[response.data.cells[i].x + ',' +
                                response.data.cells[i].y + ',' +
                                response.data.cells[i].z] = response.data.cells[i];
                        }

                        // Post-process cells to initialize cognitiveTargets for tiles with Cognitive victims
                        // This handles backward compatibility with saved data that predates cognitiveTargets
                        for (var key in $scope.cells) {
                            var cell = $scope.cells[key];
                            if (cell.isTile && cell.tile && cell.tile.victims) {
                                var directions = ['top', 'right', 'bottom', 'left'];
                                for (var j = 0; j < directions.length; j++) {
                                    var dir = directions[j];
                                    if (cell.tile.victims[dir] === 'Cognitive') {
                                        // Initialize cognitiveTargets if not exists
                                        if (!cell.tile.cognitiveTargets) {
                                            cell.tile.cognitiveTargets = {};
                                        }
                                        // Initialize this direction if not exists
                                        if (!cell.tile.cognitiveTargets[dir]) {
                                            cell.tile.cognitiveTargets[dir] = {
                                                rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' }
                                            };
                                        }
                                    }
                                }
                            }
                        }

                        width = response.data.width;
                        length = response.data.length;
                        drawMap();
                        $timeout(tile_size, 0);
                        $timeout(pageLoaded, 0);

                    }, function (response) {
                        console.log("Error: " + response.statusText);
                        pageLoaded();
                    });

            }, function (response) {
                console.log("Error: " + response.statusText);
                if (response.status == 401) {
                    $scope.go(`/home/access_denied?iframe=${iframe}`);
                }
            });
    }

    const cognitiveColorValues = {
        'K': -2,
        'R': -1,
        'Y': 0,
        'G': 1,
        'B': 2
    };

    $scope.getMaxKitNum = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.victims) return 0;
        let type = cell.tile.victims[direction];
        if (type === 'Cognitive') {
            if (!cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return 0;
            let rings = cell.tile.cognitiveTargets[direction].rings;
            let total = 0;
            for (let i = 1; i <= 5; i++) {
                total += cognitiveColorValues[rings['ring' + i]] || 0;
            }
            if (total === 2) return 2; // Harmed
            if (total === 1) return 1; // Stable
            return 0; // Unharmed or Dummy
        }
        return (victimConstant[type] ? victimConstant[type].maxKitNum : 0);
    };

    $scope.isDummy = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.victims) return false;
        let type = cell.tile.victims[direction];
        if (type === 'Cognitive') {
            if (!cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return true;
            let rings = cell.tile.cognitiveTargets[direction].rings;
            let total = 0;
            for (let i = 1; i <= 5; i++) {
                total += cognitiveColorValues[rings['ring' + i]] || 0;
            }
            if (total >= 0 && total <= 2) return false;
            return true; // Dummy
        }
        return false;
    };

    $scope.blueTilesVisited = function () {
        let count = 0;
        // Blue tiles of the map visited once: a second visit takes the tile out (as the server)
        for (const key in $scope.tiles) {
            const cell = $scope.cells[key];
            if (cell && cell.tile && cell.tile.blue && Number($scope.tiles[key].scoredItems.blue) === 1) {
                count++;
            }
        }
        return count;
    }

    $scope.stairsNavigation = function () {
        let count = 0;
        for (const key in $scope.tiles) {
            if ($scope.tiles[key].scoredItems.steps) {
                count++;
            }
        }
        return count;
    }

    $scope.rampNavigation = function () {
        let count = 0;
        for (const key in $scope.tiles) {
            if ($scope.tiles[key].scoredItems.ramp) {
                count++;
            }
        }
        return count;
    }

    $scope.exitBonusPoints = function () {
        if (!$scope.exitBonus) return 0;
        return $scope.foundVictims * 10 + $scope.blueTilesVisited() * 10 + $scope.stairsNavigation() * 5 + $scope.rampNavigation() * 5;
    }

    $scope.rescueDeploymentPoints = function () {
        return Math.min($scope.distKits, 8) * 10;
    }

    $scope.reliability = function () {
        const bonus = $scope.foundVictims * 10 + Math.min($scope.distKits, 8) * 10 + $scope.blueTilesVisited() * 10;
        if ($scope.leagueType == "entry") {
            return Math.max(bonus - ($scope.LoPs * 5), 0);
        } else {
            return Math.max(bonus - ($scope.LoPs * 15), 0);
        }
    }

    $scope.reliabilityLoPs = function () {
        const bonus = $scope.foundVictims * 10 + Math.min($scope.distKits, 8) * 10 + $scope.blueTilesVisited() * 10;
        if ($scope.leagueType == "entry") {
            return Math.min(bonus, $scope.LoPs * 5);
        } else {
            return Math.min(bonus, $scope.LoPs * 15);
        }
    }

    // Misidentifications take 5 points each, but never more than the rest of the score
    $scope.misIdentPoints = function () {
        return Math.min($scope.MisIdent * 5, $scope.allItemScore() + $scope.reliability() + $scope.exitBonusPoints());
    }

    $scope.changeFloor = function (z) {
        playSound(sClick);
        $scope.z = z;
        drawMap();
        $timeout(tile_size, 100);
    }

    $scope.tileRot = function (r) {
        playSound(sClick);
        $scope.sRotate += r;
        if ($scope.sRotate >= 360) $scope.sRotate -= 360;
        else if ($scope.sRotate < 0) $scope.sRotate += 360;
        drawMap();
        $timeout(tile_size, 0);

        $cookies.put('sRotate', $scope.sRotate, {
            path: '/'
        });
    }


    $scope.range = function (n) {
        arr = [];
        for (let i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }


    // The map as the view and sign pages draw it, for the floor and rotation shown (line_view.js)
    function drawMap() {
        if (typeof buildMazeMap === 'function')
            $scope.mazeView = buildMazeMap($scope.cells, $scope.width, $scope.length, $scope.z, $scope.sRotate);
    }

    $scope.victimImage = function (cell, side) {
        return mazeVictimImage(cell, side);
    }

    $scope.isUndefined = function (thing) {
        return (typeof thing === "undefined");
    }

    $scope.allItemScore = function () {
        let score = 0;
        for (let x = 1; x <= $scope.width * 2; x += 2) {
            for (let y = 1; y <= $scope.length * 2; y += 2) {
                score += $scope.tilePoint(x, y, 0, true);
            }
        }
        return score;
    }


    $scope.tileStatus = function (x, y, z, isTile) {
        // If this is a non-existent tile
        var cell = $scope.cells[x + ',' + y + ',' + z];
        if (!cell)
            return;
        if (!isTile)
            return;

        if (!$scope.tiles[x + ',' + y + ',' + z]) {
            $scope.tiles[x + ',' + y + ',' + z] = {
                scoredItems: {
                    speedbump: false,
                    checkpoint: false,
                    ramp: false,
                    steps: false,
                    blue: 0,
                    victims: {
                        top: false,
                        right: false,
                        left: false,
                        bottom: false
                    },
                    rescueKits: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0
                    }
                }
            };
        }
        var tile = $scope.tiles[x + ',' + y + ',' + z];

        // Current "score" for this tile
        var current = 0;
        // Max "score" for this tile. Score is added 1 for every passed mission
        var possible = 0;


        if (cell.tile.speedbump) {
            possible++;
            if (tile.scoredItems.speedbump) {
                current++;
            }
        }
        if (cell.tile.checkpoint) {
            possible++;
            if (tile.scoredItems.checkpoint) {
                current++;
            }
        }
        if (cell.tile.ramp) {
            possible += 1;
            if (tile.scoredItems.ramp) {
                current++;
            }
        }
        if (cell.tile.steps) {
            possible++;
            if (tile.scoredItems.steps) {
                current++;
            }
        }

        if (cell.tile.victims.top != "None") {
            if (!$scope.isDummy(cell, 'top')) {
                possible++;
                current += tile.scoredItems.victims.top;
                let mk = $scope.getMaxKitNum(cell, 'top');
                possible += mk;
                if (tile.scoredItems.victims.top) current += Math.min(tile.scoredItems.rescueKits.top, mk);
            }
        }
        if (cell.tile.victims.left != "None") {
            if (!$scope.isDummy(cell, 'left')) {
                possible++;
                current += tile.scoredItems.victims.left;
                let mk = $scope.getMaxKitNum(cell, 'left');
                possible += mk;
                if (tile.scoredItems.victims.left) current += Math.min(tile.scoredItems.rescueKits.left, mk);
            }
        }
        if (cell.tile.victims.right != "None") {
            if (!$scope.isDummy(cell, 'right')) {
                possible++;
                current += tile.scoredItems.victims.right;
                let mk = $scope.getMaxKitNum(cell, 'right');
                possible += mk;
                if (tile.scoredItems.victims.right) current += Math.min(tile.scoredItems.rescueKits.right, mk);
            }
        }
        if (cell.tile.victims.bottom != "None") {
            if (!$scope.isDummy(cell, 'bottom')) {
                possible++;
                current += tile.scoredItems.victims.bottom;
                let mk = $scope.getMaxKitNum(cell, 'bottom');
                possible += mk;
                if (tile.scoredItems.victims.bottom) current += Math.min(tile.scoredItems.rescueKits.bottom, mk);
            }
        }

        if (cell.tile.blue) {
            possible++;
            if (tile.scoredItems.blue > 0) {
                current++;
            }
        }

        if (tile.processing)
            return "processing";
        else if (current > 0 && current == possible)
            return "done";
        else if (current > 0)
            return "halfdone";
        else if (possible > 0)
            return "undone";
        else
            return "";
    }


    $scope.cellClick = function (x, y, z, isWall, isTile) {
        var cell = $scope.cells[x + ',' + y + ',' + z];
        if (!cell)
            return;
        if (!isTile)
            return;
        playSound(sClick);

        var tile = $scope.tiles[x + ',' + y + ',' + z];

        var validVictimsCount = 0;
        for (let dir in cell.tile.victims) {
            let type = cell.tile.victims[dir];
            if (type != "None") {
                if (type == "Cognitive") {
                    if (!$scope.isDummy(cell, dir)) {
                        validVictimsCount++;
                    }
                } else {
                    validVictimsCount++;
                }
            }
        }

        var scoreItemsCount = !!cell.tile.speedbump + !!cell.tile.checkpoint + !!cell.tile.steps + !!cell.tile.ramp + (!!cell.tile.blue ? 1 : 0);

        if (validVictimsCount > 0 || scoreItemsCount > 0) {
            // Open modal if there is at least one scorable thing
            $scope.open(x, y, z);
        }

    };

    $scope.tilePoint = function (x, y, z, isTile) {
        // If this is a non-existent tile
        var cell = $scope.cells[x + ',' + y + ',' + z];

        if (!cell)
            return 0;
        if (!isTile)
            return 0;

        if (!$scope.tiles[x + ',' + y + ',' + z]) {
            $scope.tiles[x + ',' + y + ',' + z] = {
                scoredItems: {
                    speedbump: false,
                    checkpoint: false,
                    ramp: false,
                    blue: 0,
                    victims: {
                        top: false,
                        right: false,
                        left: false,
                        bottom: false
                    },
                    rescueKits: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0
                    }
                }
            };
        }
        return itemPoints(cell, $scope.tiles[x + ',' + y + ',' + z]);
    };

    // The most the items on a tile can earn: all of them scored, with as many kits as count
    $scope.tileMaxPoint = function (x, y, z) {
        var cell = $scope.cells[x + ',' + y + ',' + z];
        if (!cell)
            return 0;
        return itemPoints(cell, {
            scoredItems: {
                speedbump: true,
                checkpoint: true,
                ramp: true,
                steps: true,
                blue: 1,
                victims: { top: true, right: true, bottom: true, left: true, floor: true },
                rescueKits: { top: 99, right: 99, bottom: 99, left: 99, floor: 99 }
            }
        });
    };

    // The points of the items on a tile: cell is its map cell, tile what the run scored on it
    function itemPoints(cell, tile) {
        // Current "score" for this tile
        var current = 0;


        if (cell.tile.speedbump) {
            if (tile.scoredItems.speedbump) {
                current += 5;
            }
        }
        if (cell.tile.checkpoint) {
            if (tile.scoredItems.checkpoint) {
                current += 10;
            }
        }
        if (cell.tile.ramp) {
            if (tile.scoredItems.ramp) {
                current += 10;
            }
        }
        if (cell.tile.steps) {
            if (tile.scoredItems.steps) {
                current += 10;
            }
        }

        let wallPointType = cell.isLinear ? 'linearPoint' : 'floatingPoint';

        function kitScoreForVictim(droppedKits, maxKitNum) {
            const valid = Math.max(0, Math.min(droppedKits || 0, maxKitNum || 0, 2));
            if (valid === 1) return 10;
            if (valid === 2) return 30;
            return 0;
        }

        if (cell.tile.victims.top in victimConstant) {
            if (!$scope.isDummy(cell, 'top')) {
                current += victimConstant[cell.tile.victims.top][wallPointType] * tile.scoredItems.victims.top;
                if (tile.scoredItems.victims.top) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.top,
                        $scope.getMaxKitNum(cell, 'top')
                    );
                }
            }
        }
        if (cell.tile.victims.right in victimConstant) {
            if (!$scope.isDummy(cell, 'right')) {
                current += victimConstant[cell.tile.victims.right][wallPointType] * tile.scoredItems.victims.right;
                if (tile.scoredItems.victims.right) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.right,
                        $scope.getMaxKitNum(cell, 'right')
                    );
                }
            }
        }
        if (cell.tile.victims.left in victimConstant) {
            if (!$scope.isDummy(cell, 'left')) {
                current += victimConstant[cell.tile.victims.left][wallPointType] * tile.scoredItems.victims.left;
                if (tile.scoredItems.victims.left) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.left,
                        $scope.getMaxKitNum(cell, 'left')
                    );
                }
            }
        }
        if (cell.tile.victims.bottom in victimConstant) {
            if (!$scope.isDummy(cell, 'bottom')) {
                current += victimConstant[cell.tile.victims.bottom][wallPointType] * tile.scoredItems.victims.bottom;
                if (tile.scoredItems.victims.bottom) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.bottom,
                        $scope.getMaxKitNum(cell, 'bottom')
                    );
                }
            }
        }
        const MAX_BLUE_BONUS = 40;
        const BLUE_VISIT_PENALTY = 10;

        if (cell.tile.blue && tile.scoredItems.blue > 0) {
            current += Math.max(0, MAX_BLUE_BONUS - tile.scoredItems.blue * BLUE_VISIT_PENALTY);
        }
        return current;
    }


    $scope.open = function (x, y, z) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/maze_view_modal_2026.html',
            controller: 'ModalInstanceCtrl',
            size: 'lm',
            resolve: {
                cell: function () {
                    return $scope.cells[x + ',' + y + ',' + z];
                },
                tile: function () {
                    return $scope.tiles[x + ',' + y + ',' + z];
                },
                sRotate: function () {
                    return $scope.sRotate;
                },
                leagueType: function () {
                    return $scope.leagueType;
                }
            }
        }).closed.then(function (result) {
            console.log("Closed modal");
        });
    };

    $scope.getParam = function (key) {
        var str = location.search.split("?");
        if (str.length < 2) {
            return "";
        }

        var params = str[1].split("&");
        for (var i = 0; i < params.length; i++) {
            var keyVal = params[i].split("=");
            if (keyVal[0] == key && keyVal.length == 2) {
                return decodeURIComponent(keyVal[1]);
            }
        }
        return "";
    }

    $scope.go = function (path) {
        playSound(sClick);
        socket.emit('unsubscribe', 'runs/' + runId);
        socket.emit('subscribe', 'runs/map/' + runId);
        window.location = path
    }


    // Signatures are written on a pad over the whole screen (signature_pad.js); signing again
    // replaces the signature only once the new one is done
    $scope.signing = null;
    $scope.padEmpty = true;
    var signPad = null;

    $scope.openSign = function (index) {
        $scope.signing = index;
        document.documentElement.classList.add('rv-overlay-open');
        $timeout(function () {
            if (!signPad) {
                signPad = new SignaturePad(document.getElementById('rv-pad'), function () {
                    $scope.$applyAsync(function () {
                        $scope.padEmpty = signPad.isEmpty();
                    });
                });
            }
            signPad.resize();
            signPad.clear();
        });
    }

    $scope.closeSign = function (save) {
        if (save && !signPad.isEmpty()) $scope.signData[$scope.signing] = signPad.toDataURL();
        $scope.signing = null;
        document.documentElement.classList.remove('rv-overlay-open');
    }

    $scope.undoSign = function () {
        signPad.undo();
    }

    $scope.eraseSign = function () {
        signPad.clear();
    }

    document.addEventListener('keydown', function (event) {
        if (event.key != 'Escape') return;
        if ($scope.signing !== null) $scope.$apply(function () { $scope.closeSign(false); });
        else if ($scope.sendState == 'confirm' || $scope.sendState == 'error') $scope.$apply($scope.cancelSend);
    });

    $scope.signedCount = function () {
        return $scope.signData.filter(function (data) {
            return data;
        }).length;
    }

    // Sending the run: the send button first leads to a missing signature, then to a sheet to check
    // the run once more before it is final; the sheet shows the sending, an error to retry, the end
    $scope.sendState = null;

    $scope.send_sign = function () {
        playSound(sClick);
        var missing = $scope.signData.findIndex(function (data) {
            return !data;
        });
        if (missing >= 0) {
            var slot = document.querySelectorAll('.rv-sign-slot')[missing];
            slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
            slot.classList.remove('is-missing');
            void slot.offsetWidth;
            slot.classList.add('is-missing');
            return;
        }
        $scope.sendState = 'confirm';
        document.documentElement.classList.add('rv-overlay-open');
    }

    $scope.cancelSend = function () {
        $scope.sendState = null;
        document.documentElement.classList.remove('rv-overlay-open');
    }

    $scope.confirmSend = function () {
        if ($scope.sendState == 'sending') return;
        $scope.sendState = 'sending';
        var run = {
            comment: $scope.comment,
            sign: {
                captain: $scope.signData[0],
                referee: $scope.signData[1],
                referee_as: $scope.signData[2]
            },
            status: 4
        };
        $http.put("/api/runs/maze/" + runId, run).then(function () {
            playSound(sInfo);
            $scope.sendState = 'done';
        }, function (response) {
            playSound(sError);
            $scope.sendState = 'error';
            console.log("Error: " + response.statusText);
        });
    }

    $scope.leaveSign = function () {
        if ($scope.getParam('return')) $scope.go($scope.getParam('return'));
        else $scope.go("/maze/" + $scope.competition_id + "/" + $scope.league);
    }

    $scope.wallColor = function(x,y,z){
        let cell = $scope.cells[x+','+y+','+z];
        if(!cell) return {};
        if(cell.isWall) {
            if (cell.isLinear) return {'background-color': 'black'};
            else if (cell.ignoreWall) return {'background-color': 'green'};
            else return {'background-color': 'navy'};
        }
    };

    var currentWidth = -1;


    $(window).on('load resize', function () {
        if (currentWidth == window.innerWidth) {
            return;
        }
        currentWidth = window.innerWidth;
        tile_size();
        $timeout(tile_size, 500);
        $timeout(tile_size, 3000);

    });

    // Iframe
    $scope.navColor = function (stat) {
        if (stat == 2) return '#e74c3c';
        if (stat == 3) return '#e67e22';
        return '#7f8c8d';
    }
    // Iframe

    if (timeIncrement) {
        // Increment timer in every second (setInterval)
        setInterval(function () {
            if ($scope.minutes < 8 && $scope.status == 2) {
                if ($scope.seconds < 59) {
                    $scope.seconds++;
                } else {
                    $scope.seconds = 0;
                    if ($scope.minutes < 59) {
                        $scope.minutes++;
                    } else {
                        $scope.minutes = 0;
                    }
                }
            }
            $scope.$apply();
        }, 1000);
    }
}]);


app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', 'cell', 'tile', 'sRotate', 'leagueType', function ($scope, $uibModalInstance, cell, tile, sRotate, leagueType) {
    $scope.victimConstantWL = victimConstantWL;
    $scope.cell = cell;
    $scope.tile = tile;
    $scope.leagueType = leagueType;
    $scope.hasVictims = (cell.tile.victims.top != "None") ||
        (cell.tile.victims.right != "None") ||
        (cell.tile.victims.bottom != "None") ||
        (cell.tile.victims.left != "None");

    $scope.lightStatus = function (light, kit) {
        if (light) return true;
        return false;
    };

    $scope.kitStatus = function (light, kit, direction) {
        const mk = $scope.getModalMaxKitNum($scope.cell, direction);
        return (Number(kit) >= mk);
    };

    $scope.getModalCognitiveImage = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction]) return '';
        let rings = cell.tile.cognitiveTargets[direction].rings;
        return '/images/cognitive_targets/' + rings.ring1 + rings.ring2 + rings.ring3 + rings.ring4 + rings.ring5 + '.png';
    };

    $scope.getColorValue = function (colorCode) {
        switch (colorCode) {
            case 'K': return 'Black';
            case 'R': return 'Red';
            case 'Y': return 'Yellow';
            case 'G': return 'Green';
            case 'B': return 'Blue';
            default: return colorCode;
        }
    };

    const cognitiveColorValues = {
        'K': -2,
        'R': -1,
        'Y': 0,
        'G': 1,
        'B': 2
    };

    $scope.getModalMaxKitNum = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.victims) return 0;
        if ($scope.leagueType === 'entry') return 1;
        let type = cell.tile.victims[direction];
        if (type === 'Cognitive') {
            if (!cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return 0;
            let rings = cell.tile.cognitiveTargets[direction].rings;
            let total = 0;
            for (let i = 1; i <= 5; i++) {
                total += cognitiveColorValues[rings['ring' + i]] || 0;
            }
            if (total === 2) return 2; // Harmed
            if (total === 1) return 1; // Stable
            return 0; // Unharmed or Dummy
        }
        return (victimConstant[type] ? victimConstant[type].maxKitNum : 0);
    };

    $scope.isModalDummy = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.victims) return false;
        let type = cell.tile.victims[direction];
        if (type === 'Cognitive') {
            if (!cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return true;
            let rings = cell.tile.cognitiveTargets[direction].rings;
            let total = 0;
            for (let i = 1; i <= 5; i++) {
                total += cognitiveColorValues[rings['ring' + i]] || 0;
            }
            if (total >= 0 && total <= 2) return false;
            return true; // Dummy
        }
        return false;
    };

    $scope.hasRealVictims = function() {
        if (!$scope.cell || !$scope.cell.tile || !$scope.cell.tile.victims) return false;
        let directions = ['top', 'bottom', 'left', 'right'];
        for (let dir of directions) {
            let type = $scope.cell.tile.victims[dir];
            if (type && type !== 'None') {
                if (!$scope.isModalDummy($scope.cell, dir)) return true;
            }
        }
        return false;
    };

    $scope.getModalVictimStatus = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.victims) return '';
        let type = cell.tile.victims[direction];
        if (type === 'None') return '';
        if (type === 'PHI') return 'Harmed';
        if (type === 'PSI') return 'Stable';
        if (type === 'OMEGA') return 'Unharmed';
        
        if (type === 'Cognitive') {
            if (!cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return 'Dummy';
            let rings = cell.tile.cognitiveTargets[direction].rings;
            let total = 0;
            for (let i = 1; i <= 5; i++) {
                total += cognitiveColorValues[rings['ring' + i]] || 0;
            }
            if (total === 2) return 'Harmed';
            if (total === 1) return 'Stable';
            if (total === 0) return 'Unharmed';
            return 'Dummy';
        }
        return '';
    };

    $scope.getModalVictimStatusColor = function(cell, direction) {
        let status = $scope.getModalVictimStatus(cell, direction);
        if (status === 'Harmed') return '#dc3545';
        if (status === 'Stable') return '#ffc107';
        if (status === 'Unharmed') return '#28a745';
        return '#6c757d';
    }

    $scope.getModalKitColor = function(cell, direction) {
        if (!cell || !cell.tile) return '#1e293b';
        let required = $scope.getModalMaxKitNum(cell, direction);
        let placed = $scope.tile.scoredItems.rescueKits[direction];
        if (placed >= required) return '#10b981'; // Green
        return '#ef4444'; // Red
    };

    $scope.modalRotateInv = function (dir) {
        var ro;
        switch (dir) {
            case 'top':
                ro = 0;
                break;
            case 'right':
                ro = 90;
                break;
            case 'left':
                ro = 270;
                break;
            case 'bottom':
                ro = 180;
                break;
        }
        ro -= sRotate;
        if (ro < 0) ro += 360;
        if (ro >= 360) ro -= 360;
        switch (ro) {
            case 0:
                return 'top';
            case 90:
                return 'right';
            case 180:
                return 'bottom';
            case 270:
                return 'left';
        }
    }

    $scope.modalRotate = function (dir) {
        var ro;
        switch (dir) {
            case 'top':
                ro = 0;
                break;
            case 'right':
                ro = 90;
                break;
            case 'left':
                ro = 270;
                break;
            case 'bottom':
                ro = 180;
                break;
        }
        ro += sRotate;
        if (ro >= 360) ro -= 360;
        switch (ro) {
            case 0:
                return 'top';
            case 90:
                return 'right';
            case 180:
                return 'bottom';
            case 270:
                return 'left';
        }
    }

    $scope.ok = function () {
        playSound(sClick);
        $uibModalInstance.close();
    };
}]);


function sum(array) {
    if (array.length == 0) return 0;
    return array.reduce(function (a, b) {
        return a + b;
    });
}

$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'runs/' + runId);
    socket.emit('subscribe', 'runs/map/' + runId);
});


let lastTouch = 0;
document.addEventListener('touchend', event => {
    const now = window.performance.now();
    if (now - lastTouch <= 500) {
        event.preventDefault();
    }
    lastTouch = now;
}, true);

window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = new AudioContext();

var getAudioBuffer = function (url, fn) {
    var req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';

    req.onreadystatechange = function () {
        if (req.readyState === 4) {
            if (req.status === 0 || req.status === 200) {
                context.decodeAudioData(req.response, function (buffer) {
                    fn(buffer);
                });
            }
        }
    };

    req.open('GET', url, true);
    req.send('');
};

var playSound = function (buffer) {
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
};

var sClick, sInfo, sError;
window.onload = function () {
    getAudioBuffer('/sounds/click.mp3', function (buffer) {
        sClick = buffer;
    });
    getAudioBuffer('/sounds/info.mp3', function (buffer) {
        sInfo = buffer;
    });
    getAudioBuffer('/sounds/error.mp3', function (buffer) {
        sError = buffer;
    });
};

function tile_size() {
    // The view and sign pages lay their map out in % and need no sizing (buildMazeMap in line_view.js)
    if (document.body.classList.contains('run-view')) return;
    // Same sizing as the judge page: scale the map from its top-left corner and center it in the column
    try {
        var mapTable = $('#mapTable');
        var mapTopLeft = $('#mapTopLeft');

        let areaWidth = mapTopLeft.width();
        let areaTopLeftY = mapTopLeft.offset().top;
        let tableWidth = mapTable.outerWidth();
        let tableHeight = mapTable.outerHeight();
        if (!areaWidth || !tableWidth) throw new Error('Map is not rendered yet');

        let scaleX = (areaWidth - 10) / tableWidth;
        let scaleY = (window.innerHeight - 200) / tableHeight;
        // Below the md breakpoint the map column is stacked under the side panel, so fit to width only
        let stacked = window.matchMedia('(max-width: 767.98px)').matches;
        let scale = (stacked || scaleY <= 0) ? scaleX : Math.min(scaleX, scaleY);

        $('#wrapTile').css({
            'width': tableWidth + 'px',
            'transform-origin': 'top left',
            'transform': `scale(${scale})`,
            'margin-left': Math.max(0, (areaWidth - tableWidth * scale) / 2) + 'px'
        });
        // The old iframe page keeps its controls in the same box; the run view does not
        $('.tilearea').css('height', tableHeight * scale + (document.body.classList.contains('run-view') ? 0 : 120));
    } catch (e) {
        // Outside the controller, so there is no $timeout here
        setTimeout(tile_size, 500);
    }
}
