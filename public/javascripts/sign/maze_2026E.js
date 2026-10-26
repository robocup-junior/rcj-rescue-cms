// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};
var socket;
let victimConstant = {};
let victimTypes = [];
const victimConstantNL = {
    "Red": {
        "maxKitNum": 1,
        "linearPoint": 15,
        "floatingPoint": 30
    },
    "Green": {
        "maxKitNum": 1,
        "linearPoint": 15,
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

                        // Maze Entry 2026 is always scored with the entry rules
                        $scope.leagueType = "entry";
                        victimConstant = victimConstantNL;

                        for (let i = 0; i < response.data.cells.length; i++) {
                            $scope.cells[response.data.cells[i].x + ',' +
                                response.data.cells[i].y + ',' +
                                response.data.cells[i].z] = response.data.cells[i];
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

    $scope.reliability = function () {
        if ($scope.leagueType == "entry") {
            return Math.max(($scope.foundVictims * 10) - ($scope.LoPs * 5), 0);
        } else {
            return Math.max(($scope.foundVictims + $scope.distKits - $scope.LoPs) * 10, 0);
        }
    }

    $scope.reliabilityLoPs = function () {
        if ($scope.leagueType == "entry") {
            return Math.min($scope.foundVictims * 10, $scope.LoPs * 5);
        } else {
            return Math.min(($scope.foundVictims + $scope.distKits) * 10, $scope.LoPs * 10);
        }
    }

    // Misidentifications take 5 points each, but never more than the rest of the score
    $scope.misIdentPoints = function () {
        return Math.min($scope.MisIdent * 5, $scope.allItemScore() + $scope.reliability() + ($scope.exitBonus ? $scope.foundVictims * 10 : 0));
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
                    victims: {
                        top: false,
                        right: false,
                        left: false,
                        bottom: false,
                        floor: false
                    },
                    rescueKits: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        floor: 0
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
            possible++;
            current += tile.scoredItems.victims.top;
            possible += victimConstant[cell.tile.victims.top].maxKitNum;
            current += Math.min(tile.scoredItems.rescueKits.top, victimConstant[cell.tile.victims.top].maxKitNum);
        }
        if (cell.tile.victims.left != "None") {
            possible++;
            current += tile.scoredItems.victims.left;
            possible += victimConstant[cell.tile.victims.left].maxKitNum;
            current += Math.min(tile.scoredItems.rescueKits.left, victimConstant[cell.tile.victims.left].maxKitNum);
        }
        if (cell.tile.victims.right != "None") {
            possible++;
            current += tile.scoredItems.victims.right;
            possible += victimConstant[cell.tile.victims.right].maxKitNum;
            current += Math.min(tile.scoredItems.rescueKits.right, victimConstant[cell.tile.victims.right].maxKitNum);
        }
        if (cell.tile.victims.bottom != "None") {
            possible++;
            current += tile.scoredItems.victims.bottom;
            possible += victimConstant[cell.tile.victims.bottom].maxKitNum;
            current += Math.min(tile.scoredItems.rescueKits.bottom, victimConstant[cell.tile.victims.bottom].maxKitNum);
        }
        if (cell.tile.victims.floor != "None") {
            possible++;
            current += tile.scoredItems.victims.floor;
            possible += victimConstant[cell.tile.victims.floor].maxKitNum;
            current += Math.min(tile.scoredItems.rescueKits.floor, victimConstant[cell.tile.victims.floor].maxKitNum);
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

        var hasVictims = (cell.tile.victims.top != "None") ||
            (cell.tile.victims.right != "None") ||
            (cell.tile.victims.bottom != "None") ||
            (cell.tile.victims.left != "None") ||
            (cell.tile.victims.floor != "None");
        // Total number of scorable things on this tile
        var total = !!cell.tile.speedbump + !!cell.tile.checkpoint + !!cell.tile.steps + cell.tile.ramp + hasVictims;

        if (total > 1 || hasVictims) {
            // Open modal for multi-select
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
                    victims: {
                        top: false,
                        right: false,
                        left: false,
                        bottom: false,
                        floor: false
                    },
                    rescueKits: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        floor: 0
                    }
                }
            };
        }
        var tile = $scope.tiles[x + ',' + y + ',' + z];

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
                current += 5;
            }
        }

        let wallPointType = cell.isLinear ? 'linearPoint' : 'floatingPoint';

        if (cell.tile.victims.top in victimConstant) {
            current += victimConstant[cell.tile.victims.top][wallPointType] * tile.scoredItems.victims.top;
            current += 10 * Math.min(tile.scoredItems.rescueKits.top, victimConstant[cell.tile.victims.top].maxKitNum);
        }
        if (cell.tile.victims.right in victimConstant) {
            current += victimConstant[cell.tile.victims.right][wallPointType] * tile.scoredItems.victims.right;
            current += 10 * Math.min(tile.scoredItems.rescueKits.right, victimConstant[cell.tile.victims.right].maxKitNum);
        }
        if (cell.tile.victims.left in victimConstant) {
            current += victimConstant[cell.tile.victims.left][wallPointType] * tile.scoredItems.victims.left;
            current += 10 * Math.min(tile.scoredItems.rescueKits.left, victimConstant[cell.tile.victims.left].maxKitNum);
        }
        if (cell.tile.victims.bottom in victimConstant) {
            current += victimConstant[cell.tile.victims.bottom][wallPointType] * tile.scoredItems.victims.bottom;
            current += 10 * Math.min(tile.scoredItems.rescueKits.bottom, victimConstant[cell.tile.victims.bottom].maxKitNum);
        }
        if (cell.tile.victims.floor in victimConstant) {
            current += victimConstant[cell.tile.victims.floor][wallPointType] * tile.scoredItems.victims.floor;
            current += 10 * Math.min(tile.scoredItems.rescueKits.floor, victimConstant[cell.tile.victims.floor].maxKitNum);
        }

        return current;
    };


    $scope.open = function (x, y, z) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/maze_view_modal_2026E.html',
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
    $scope.cell = cell;
    $scope.tile = tile;
    $scope.leagueType = leagueType;
    $scope.hasVictims = (cell.tile.victims.top != "None") ||
        (cell.tile.victims.right != "None") ||
        (cell.tile.victims.bottom != "None") ||
        (cell.tile.victims.left != "None") ||
        (cell.tile.victims.floor != "None");

    $scope.lightStatus = function (light, kit) {
        if (light) return true;
        return false;
    };

    $scope.kitStatus = function (light, kit, type) {
        return (victimConstant[type].maxKitNum <= kit);
    };

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