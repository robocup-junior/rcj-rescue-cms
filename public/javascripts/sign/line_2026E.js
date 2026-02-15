// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};
var socket;
var txt_multi;
var txt_gap;
var txt_obstacle;
var txt_ramp;
var txt_intersection;
var txt_bump;
var rotate = 0;
// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http', '$translate', '$cookies', function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {

    var txt_cap_sign, txt_cref_sign, txt_ref_sign, txt_no_sign, txt_complete, txt_confirm;
    $translate('line.sign.cap_sign').then(function (val) {
        txt_cap_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.sign.ref_sign').then(function (val) {
        txt_ref_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.sign.cref_sign').then(function (val) {
        txt_cref_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.sign.no_sign').then(function (val) {
        txt_no_sign = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.sign.complete').then(function (val) {
        txt_complete = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.sign.confirm').then(function (val) {
        txt_confirm = val;
    }, function (translationId) {
        // = translationId;
    });

    $translate('line.judge.js.multi').then(function (val) {
        txt_multi = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.judge.js.gap').then(function (val) {
        txt_gap = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.judge.js.obstacle').then(function (val) {
        txt_obstacle = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.judge.js.ramp').then(function (val) {
        txt_ramp = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.judge.js.intersection').then(function (val) {
        txt_intersection = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('line.judge.js.bump').then(function (val) {
        txt_bump = val;
    }, function (translationId) {
        // = translationId;
    });


    //$cookies.remove('sRotate')
    if ($cookies.get('sRotate')) {
        $scope.sRotate = Number($cookies.get('sRotate'));
    }
    else $scope.sRotate = 0;
    rotate = $scope.sRotate ;

    $scope.z = 0;

    // Scoring elements of the tiles
    $scope.stiles = [];
    // Map (images etc.) for the tiles
    $scope.mtiles = [];

    $scope.checkPointDistance = [];

    $scope.victim_list = [];
    $scope.LoPs = [];

    $scope.victimNL_Live = [];
    $scope.victimNL_Dead = [];

    $scope.enableSign = [false, false, false];
    $scope.signData = [null, null, null];

    $scope.sum = function (arr) {
        if (arr.length == 0) return 0;
        return arr.reduce(function (prev, current, i, arr) {
            return prev + current;
        });
    };


    if (typeof runId !== 'undefined') {
        $scope.runId = runId;
        loadNewRun();
    }

    socket = io(window.location.origin, {
        transports: ['websocket']
    });
    function launchSocketIo() {        
        if (typeof runId !== 'undefined') {
            socket.emit('subscribe', 'runs/' + runId);

            socket.on('data', function (data) {
                //console.log(data);
                $scope.status = data.status;
                $scope.evacuationLevel = data.evacuationLevel;
                $scope.kitLevel = data.kitLevel;
                $scope.exitBonus = data.exitBonus;
                $scope.stiles = data.tiles;
                $scope.score = data.score;
                $scope.raw_score = data.raw_score;
                $scope.normalizedScore = data.normalizedScore;
                $scope.multiplier = data.multiplier;
                $scope.showedUp = data.showedUp;
                $scope.LoPs = data.LoPs;
                $scope.LoPs_total = 0;
                for (var i = 0; i < $scope.LoPs.length; i++) {
                    $scope.LoPs_total += $scope.LoPs[i];
                }
                $scope.minutes = data.time.minutes;
                $scope.seconds = data.time.seconds;

                $scope.victim_list = data.rescueOrder;

                if (data.nl) {
                    $scope.victimNL_Dead = data.nl.deadVictim;
                    $scope.victimNL_Live = data.nl.liveVictim;
                }


                $scope.checkPointDistance = [];
                let tmp = {
                    dis: 1,
                    status: $scope.showedUp,
                    point: 5 * $scope.showedUp
                }
                $scope.checkPointDistance.push(tmp);
                let prevCheckPoint = 0;
                let j = 0;
                for (let i in $scope.stiles) {
                    if ($scope.isCheckPoint($scope.stiles[i])) {
                        let tmp = {
                            dis: i - prevCheckPoint,
                            status: $scope.stiles[i].scoredItems[findItem("checkpoint", $scope.stiles[i].scoredItems)].scored,
                            point: (i - prevCheckPoint) * $scope.stiles[i].scoredItems[findItem("checkpoint", $scope.stiles[i].scoredItems)].scored * $scope.LoPsCountPoint($scope.LoPs[j])
                        }
                        $scope.checkPointDistance.push(tmp);
                        prevCheckPoint = i;
                        j++;
                    }
                }
                $scope.$apply();
                console.log("Updated view from socket.io");
            });
        }

    }

    launchSocketIo();
    setInterval(launchSocketIo, 15000);

    function loadNewRun() {
        $http.get("/api/runs/line/" + runId +
            "?normalized=true").then(function (response) {
                $scope.status = response.data.status;
                $scope.LoPs = response.data.LoPs;
                $scope.LoPs_total = 0;
                for (var i = 0; i < $scope.LoPs.length; i++) {
                    $scope.LoPs_total += $scope.LoPs[i];
                }
                $scope.evacuationLevel = response.data.evacuationLevel;
                $scope.kitLevel = response.data.kitLevel;
                $scope.exitBonus = response.data.exitBonus;
                $scope.field = response.data.field.name;
                $scope.score = response.data.score;
                $scope.raw_score = response.data.raw_score;
                $scope.normalizedScore = response.data.normalizedScore;
                $scope.multiplier = response.data.multiplier;
                $scope.showedUp = response.data.showedUp;
                $scope.started = response.data.started;
                $scope.round = response.data.round.name;
                $scope.team = response.data.team.name;
                $scope.league = response.data.team.league;
                $scope.competition = response.data.competition.name;
                $scope.competition_id = response.data.competition._id;
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
                $scope.stiles = response.data.tiles;

                let checkPointNumber = 1;
                $scope.checkPointDistance = [];
                let tmp = {
                    dis: 1,
                    status: $scope.showedUp,
                    point: 5 * $scope.showedUp
                }
                $scope.checkPointDistance.push(tmp);
                let prevCheckPoint = 0;
                let j = 0;
                for (let i in $scope.stiles) {
                    if ($scope.isCheckPoint($scope.stiles[i])) {
                        marker[i] = checkPointNumber;
                        checkPointNumber++;

                        let tmp = {
                            dis: i - prevCheckPoint,
                            status: $scope.stiles[i].scoredItems[findItem("checkpoint", $scope.stiles[i].scoredItems)].scored,
                            point: (i - prevCheckPoint) * $scope.stiles[i].scoredItems[findItem("checkpoint", $scope.stiles[i].scoredItems)].scored * $scope.LoPsCountPoint($scope.LoPs[j])
                        }
                        $scope.checkPointDistance.push(tmp);
                        prevCheckPoint = i;
                        j++;
                    }
                }

                $scope.victim_list = response.data.rescueOrder;

                if (response.data.nl) {
                    $scope.victimNL_Dead = response.data.nl.deadVictim;
                    $scope.victimNL_Live = response.data.nl.liveVictim;
                }

                // Get the map
                $http.get("/api/maps/line/" + response.data.map +
                    "?populate=true").then(function (response) {
                        console.log(response.data);

                        $scope.height = response.data.height;
                        $timeout(tile_size, 0);

                        $scope.width = response.data.width;
                        $scope.length = response.data.length;
                        width = response.data.width;
                        length = response.data.length;
                        $scope.startTile = response.data.startTile;
                        $scope.startTile2 = response.data.startTile2;
                        $scope.numberOfDropTiles = response.data.numberOfDropTiles;;
                        $scope.mtiles = {};

                        // Get max victim count
                        $scope.maxLiveVictims = response.data.victims.live;
                        $scope.maxDeadVictims = response.data.victims.dead;

                        $scope.mapIndexCount = response.data.indexCount;

                        $scope.EvacuationAreaLoPIndex = response.data.EvacuationAreaLoPIndex;

                        for (let i = 0; i < response.data.tiles.length; i++) {
                            $scope.mtiles[response.data.tiles[i].x + ',' +
                                response.data.tiles[i].y + ',' +
                                response.data.tiles[i].z] = response.data.tiles[i];
                        }

                        $timeout(tile_size, 0);
                        $timeout(tile_size, 500);
                        $timeout(tile_size, 1500);
                        $timeout(tile_size, 3000);

                    }, function (response) {
                        console.log("Error: " + response.statusText);
                    });
            }, function (response) {
                console.log("Error: " + response.statusText);
                if (response.status == 401) {
                    $scope.go(`/home/access_denied?iframe=${iframe}`);
                }
            });
    }

    function findItem(item, tile) {
        for (let i = 0; i < tile.length; i++) {
            if (tile[i].item == item) return i;
        }
        return null;
    }

    $scope.isCheckPoint = function (tile) {
        return findItem("checkpoint", tile.scoredItems) != null;
    }

    $scope.victim_bk_color = function (index, zoneType) {
        let m = $scope.calc_victim_multipliers(index);
        if (m == 0 || zoneType != $scope.victim_list[index].zoneType) return '#fff';
        if (m == 1) return '#ccc';
        if (zoneType == "RED") return '#ffc1ff';
        return '#e0ffc1';
    }

    $scope.nlPoints = function () {
        let point = 0;
        for (let victim of $scope.victimNL_Live) {
            point += 10 * victim.found + 20 * victim.identified;
        }
        for (let victim of $scope.victimNL_Dead) {
            point += 10 * victim.found + 10 * victim.identified;
        }
        return point;
    }


    $scope.LoPsCountPoint = function (n) {
        if (n == 0) return 5;
        if (n == 1) return 3;
        if (n == 2) return 1;
        return 0;
    }

    $scope.checkTotal = function () {
        let ret = 0;
        for (let i in $scope.checkPointDistance) {
            ret += $scope.checkPointDistance[i].point;
        }
        return ret;
    };

    $scope.exitBonusPoints = function () {
        return $scope.exitBonus * 30;
    };


    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    $scope.getOpacity = function (x, y) {
        var stackedTiles = 0;
        for (var z = 0; z < $scope.height; z++) {
            if ($scope.mtiles[x + ',' + y + ',' + z])
                stackedTiles++;
        }
        return 1.0 / stackedTiles;
    }

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
        window.location = path;
    }

    $scope.changeFloor = function (z) {
        playSound(sClick);
        $scope.z = z;
        $timeout(tile_size, 100);
        $timeout(tile_size, 2000);
    }

    $scope.tileRot = function (r) {
        playSound(sClick);
        $scope.sRotate += r;
        if ($scope.sRotate >= 360) $scope.sRotate -= 360;
        else if ($scope.sRotate < 0) $scope.sRotate += 360;
        rotate = $scope.sRotate;
        $timeout(tile_size, 0);

        $cookies.put('sRotate', $scope.sRotate, {
            path: '/'
        });
    }

    $scope.totalNumberOf = function (objects) {
        return objects.gaps + objects.speedbumps + objects.obstacles +
            objects.intersections;
    }

    $scope.showElements = function (x, y, z) {
        var mtile = $scope.mtiles[x + ',' + y + ',' + z];
        var isCheckPointTile = false;
        var stile = [];
        var stileIndex = [];

        // If this is not a created tile
        if (!mtile || mtile.index.length == 0)
            return;
        playSound(sClick);
        for (var i = 0; i < mtile.index.length; i++) {
            stile.push($scope.stiles[mtile.index[i]]);
            stileIndex.push(mtile.index[i])
            if ($scope.isCheckPoint($scope.stiles[mtile.index[i]])) {
                isCheckPointTile = true;
            }
        }


        var total = (mtile.items.obstacles > 0 ||
            mtile.items.speedbumps > 0 ||
            mtile.tileType.gaps > 0 ||
            mtile.tileType.intersections > 0 ||
            mtile.tileType.seesaw > 0 ||
            undefined2false(mtile.items.rampPoints)) * mtile.index.length;

        // Add the number of possible passes for drop tiles
        if (isCheckPointTile) {
            total = 0;
            for (let i = 0; i < stile.length; i++) {
                if (stileIndex[i] < $scope.mapIndexCount) {
                    total++;
                }
            }
        }


        if (total == 0) {
            return;
        } else if (total > 1) {
            // Show modal
            $scope.open(x, y, z);
            // Save data from modal when closing it
        }
    }


    $scope.open = function (x, y, z) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/line_view_modal.html',
            controller: 'ModalInstanceCtrl',
            size: 'lm',
            resolve: {
                mtile: function () {
                    return $scope.mtiles[x + ',' + y + ',' + z];
                },
                mtiles: function () {
                    return $scope.mtiles;
                },
                stiles: function () {
                    return $scope.stiles;
                },
                sRotate: function () {
                    return $scope.sRotate;
                },
                startTile: function () {
                    return $scope.startTile;
                },
                nineTile: function () {
                    var nine = []
                    if ($scope.sRotate == 0) {
                        nine[0] = $scope.mtiles[(x - 1) + ',' + (y - 1) + ',' + z];
                        nine[1] = $scope.mtiles[(x) + ',' + (y - 1) + ',' + z];
                        nine[2] = $scope.mtiles[(x + 1) + ',' + (y - 1) + ',' + z];
                        nine[3] = $scope.mtiles[(x - 1) + ',' + (y) + ',' + z];
                        nine[4] = $scope.mtiles[(x) + ',' + (y) + ',' + z];
                        nine[5] = $scope.mtiles[(x + 1) + ',' + (y) + ',' + z];
                        nine[6] = $scope.mtiles[(x - 1) + ',' + (y + 1) + ',' + z];
                        nine[7] = $scope.mtiles[(x) + ',' + (y + 1) + ',' + z];
                        nine[8] = $scope.mtiles[(x + 1) + ',' + (y + 1) + ',' + z];
                    } else if ($scope.sRotate == 180) {
                        nine[8] = $scope.mtiles[(x - 1) + ',' + (y - 1) + ',' + z];
                        nine[7] = $scope.mtiles[(x) + ',' + (y - 1) + ',' + z];
                        nine[6] = $scope.mtiles[(x + 1) + ',' + (y - 1) + ',' + z];
                        nine[5] = $scope.mtiles[(x - 1) + ',' + (y) + ',' + z];
                        nine[4] = $scope.mtiles[(x) + ',' + (y) + ',' + z];
                        nine[3] = $scope.mtiles[(x + 1) + ',' + (y) + ',' + z];
                        nine[2] = $scope.mtiles[(x - 1) + ',' + (y + 1) + ',' + z];
                        nine[1] = $scope.mtiles[(x) + ',' + (y + 1) + ',' + z];
                        nine[0] = $scope.mtiles[(x + 1) + ',' + (y + 1) + ',' + z];
                    } else if ($scope.sRotate == 90) {
                        nine[2] = $scope.mtiles[(x - 1) + ',' + (y - 1) + ',' + z];
                        nine[5] = $scope.mtiles[(x) + ',' + (y - 1) + ',' + z];
                        nine[8] = $scope.mtiles[(x + 1) + ',' + (y - 1) + ',' + z];
                        nine[1] = $scope.mtiles[(x - 1) + ',' + (y) + ',' + z];
                        nine[4] = $scope.mtiles[(x) + ',' + (y) + ',' + z];
                        nine[7] = $scope.mtiles[(x + 1) + ',' + (y) + ',' + z];
                        nine[0] = $scope.mtiles[(x - 1) + ',' + (y + 1) + ',' + z];
                        nine[3] = $scope.mtiles[(x) + ',' + (y + 1) + ',' + z];
                        nine[6] = $scope.mtiles[(x + 1) + ',' + (y + 1) + ',' + z];
                    } else if ($scope.sRotate == 270) {
                        nine[6] = $scope.mtiles[(x - 1) + ',' + (y - 1) + ',' + z];
                        nine[3] = $scope.mtiles[(x) + ',' + (y - 1) + ',' + z];
                        nine[0] = $scope.mtiles[(x + 1) + ',' + (y - 1) + ',' + z];
                        nine[7] = $scope.mtiles[(x - 1) + ',' + (y) + ',' + z];
                        nine[4] = $scope.mtiles[(x) + ',' + (y) + ',' + z];
                        nine[1] = $scope.mtiles[(x + 1) + ',' + (y) + ',' + z];
                        nine[8] = $scope.mtiles[(x - 1) + ',' + (y + 1) + ',' + z];
                        nine[5] = $scope.mtiles[(x) + ',' + (y + 1) + ',' + z];
                        nine[2] = $scope.mtiles[(x + 1) + ',' + (y + 1) + ',' + z];
                    }
                    return nine;
                },
                startTile2: function () {
                    return $scope.startTile2;
                },
                isCheckPoint: function () {
                    return $scope.isCheckPoint;
                }
            }
        }).closed.then(function (result) {

        });
    };

    $scope.success_message = function () {
        playSound(sInfo);
        swal({
            title: 'Recorded!',
            text: txt_complete,
            type: 'success'
        }).then((result) => {
            if (result.value) {
                if ($scope.getParam('return')) $scope.go($scope.getParam('return'));
                else $scope.go("/line/" + $scope.competition_id + "/" + $scope.league);
            }
        })
        console.log("Success!!");
    }

    $scope.toggleSign = function (index) {
        $scope.enableSign[index] = !$scope.enableSign[index];
        if (!$scope.enableSign[index]) {
            let datapair;
            switch (index) {
                case 0:
                    datapair = $("#cap_sig").jSignature("getData", "svgbase64");
                    break;
                case 1:
                    datapair = $("#ref_sig").jSignature("getData", "svgbase64");
                    break;
                case 2:
                    datapair = $("#refas_sig").jSignature("getData", "svgbase64")
                    break;
            }
            $scope.signData[index] = "data:" + datapair[0] + "," + datapair[1];
        } else {
            if (!$scope.signData[index]) setTimeout(initSign, 100, index);
        }
    }

    function initSign(index) {
        switch (index) {
            case 0:
                $("#cap_sig").jSignature();
                break;
            case 1:
                $("#ref_sig").jSignature();
                break;
            case 2:
                $("#refas_sig").jSignature();
                break;
        }
    }

    $scope.clearSign = function (index) {
        switch (index) {
            case 0:
                $("#cap_sig").jSignature("clear");
                break;
            case 1:
                $("#ref_sig").jSignature("clear");
                break;
            case 2:
                $("#refas_sig").jSignature("clear");
                break;
        }
        $scope.toggleSign(index);
    }

    $scope.send_sign = function () {
        playSound(sClick);
        var run = {}
        run.comment = $scope.comment;
        run.sign = {}
        var err_mes = ""
        if (!$scope.signData[0]) {
            err_mes += "[" + txt_cap_sign + "] "
        } else {
            run.sign.captain = $scope.signData[0]
        }

        if (!$scope.signData[1]) {
            err_mes += "[" + txt_ref_sign + "] "
        } else {
            run.sign.referee = $scope.signData[1]
        }

        if (!$scope.signData[2]) {
            err_mes += "[" + txt_cref_sign + "] "
        } else {
            run.sign.referee_as = $scope.signData[2]
        }


        if (err_mes != "") {
            playSound(sError);
            swal("Oops!", err_mes + txt_no_sign, "error");
            return;
        }
        playSound(sInfo);
        swal({
            title: "Finish Run?",
            text: txt_confirm,
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, finish it!",
            confirmButtonColor: "#ec6c62"
        }).then((result) => {
            if (result.value) {
                console.log("STATUS UPDATED(4)")
                run.status = 4;
                $http.put("/api/runs/line/" + runId, run).then(function (response) {
                    setTimeout($scope.success_message, 500);
                }, function (response) {
                    playSound(sError);
                    swal("Oops", "We couldn't connect to the server! Please notice to system manager.", "error");
                    console.log("Error: " + response.statusText);
                });
            }
        })

    }

    function undefined2false(tmp) {
        if (tmp) return true;
        return false;
    }

    // Iframe
    $scope.victimImgPath = function (victim) {
        switch (victim.victimType) {
            case 'LIVE':
                return 'liveVictim.png';
            case 'DEAD':
                return 'deadVictim.png';
            case 'KIT':
                return 'rescueKit.png';
        }
    }

    $scope.evacZoneColor = function (victim) {
        switch (victim.zoneType) {
            case 'GREEN':
                return "#d6ffd6";
            case 'RED':
                return "#ffd6d6";
        }
    }

    $scope.navColor = function (stat) {
        if (stat == 2) return '#e74c3c';
        if (stat == 3) return '#e67e22';
        return '#7f8c8d';
    }
    // Iframe

    var currentWidth = -1;


    $(window).on('load resize', function () {
        if (currentWidth == window.innerWidth) {
            return;
        }
        currentWidth = window.innerWidth;
        tile_size();

    });

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


}]).directive("tileLoadFinished", ['$timeout', function ($timeout) {
    return function (scope, element, attrs) {
        if (scope.$last) {
            $timeout(function () {
                tile_size();
            }, 500);
            $timeout(function () {
                tile_size();
            }, 1000);
        }
    }
}]);


app.directive('tile', function () {
    return {
        scope: {
            tile: '='
        },
        restrict: 'E',
        templateUrl: '/templates/tile.html',
        link: function ($scope, element, attrs) {
            $scope.tilerotate = function (tilerot) {
                if (!tilerot) return $scope.$parent.sRotate;
                var ro = tilerot + $scope.$parent.sRotate;
                if (ro >= 360) ro -= 360;
                else if (ro < 0) ro += 360;
                return ro;
            }
            $scope.tileNumber = function (tile) {
                $scope.tileN = 1;
                var ret_txt = "";
                if (!tile) return;

                var possible = 0;

                var count = function (list) {
                    for (var i = 0; i < list.length; i++) {
                        possible++;
                    }
                }
                count(tile.scoredItems.gaps);
                count(tile.scoredItems.seesaw);
                count(tile.scoredItems.speedbumps);
                count(tile.scoredItems.intersections);
                count(tile.scoredItems.obstacles);
                if (possible != 0) return;

                for (var i = 0; i < tile.index.length; i++) {
                    if (i != 0) ret_txt += ','
                    ret_txt += tile.index[i] + 1;
                }
                return ret_txt;
            }
            $scope.checkpointNumber = function (tile) {
                var ret_txt = "";
                if (!tile) return;
                for (var i = 0; i < tile.index.length; i++) {
                    if (marker[tile.index[i]]) {
                        if (ret_txt != "") ret_txt += '&'
                        ret_txt += marker[tile.index[i]];
                    } else {
                        return ret_txt;
                    }
                }
                return ret_txt;
            }


            $scope.isCheckPointTile = function (tile) {
                if (!tile || tile.index.length == 0)
                    return;
                return $scope.$parent.isCheckPoint($scope.$parent.stiles[tile.index[0]]);
            }

            function isStart(tile) {
                if (!tile)
                    return;
                return tile.x == $scope.$parent.startTile.x &&
                    tile.y == $scope.$parent.startTile.y &&
                    tile.z == $scope.$parent.startTile.z;
            }

            $scope.isStart = function (tile) {
                if (!tile)
                    return;
                return tile.x == $scope.$parent.startTile.x &&
                    tile.y == $scope.$parent.startTile.y &&
                    tile.z == $scope.$parent.startTile.z;
            }

            $scope.evacTapeRot = function (tile) {
                let rot = 0;
                if (tile.evacEntrance >= 0) {
                    rot = tile.evacEntrance;
                } else if (tile.evacExit >= 0) {
                    rot = tile.evacExit;
                }
                rot += $scope.$parent.sRotate;
                return rot % 360;
            }

            $scope.tileStatus = function (tile) {
                // If this is a non-existent tile
                if ((!tile || tile.index.length == 0) && !isStart(tile))
                    return;

                // If this tile has no scoring elements we should just return empty string
                if (tile.items.obstacles == 0 &&
                    tile.items.speedbumps == 0 &&
                    !tile.items.rampPoints &&
                    tile.tileType.gaps == 0 &&
                    tile.tileType.seesaw == 0 &&
                    tile.tileType.intersections == 0 &&
                    !$scope.isCheckPointTile(tile) && !isStart(tile)
                ) {
                    return;
                }

                // Number of successfully passed times
                var successfully = 0;
                // Number of times it is possible to pass this tile
                var possible = 0;

                for (let i = 0; i < tile.index.length; i++) {
                    for (let j = 0; j < $scope.$parent.stiles[tile.index[i]].scoredItems.length; j++) {
                        possible++;
                        if ($scope.$parent.stiles[tile.index[i]].scoredItems[j].scored) {
                            successfully++;
                        }
                    }
                }

                if ((possible > 0 && successfully == possible) ||
                    (isStart(tile) && $scope.$parent.showedUp))
                    return "done";
                else if (successfully > 0)
                    return "halfdone";
                else if (possible > 0 || (isStart(tile) && !$scope.$parent.showedUp))
                    return "undone";
                else
                    return "";
            }

            $scope.tilePoint = function (tile) {
                // If this is a non-existent tile
                if ((!tile || tile.index.length == 0) && !isStart(tile))
                    return -1;

                // If this tile has no scoring elements we should just return empty string
                if (tile.items.obstacles == 0 &&
                    tile.items.speedbumps == 0 &&
                    !tile.items.rampPoints &&
                    tile.tileType.gaps == 0 &&
                    tile.tileType.seesaw == 0 &&
                    tile.tileType.intersections == 0
                ) {
                    return -1;
                }

                // Number of successfully passed times
                var successfully = 0;

                for (var i = 0; i < tile.index.length; i++) {
                    for (let j = 0; j < $scope.$parent.stiles[tile.index[i]].scoredItems.length; j++) {
                        switch ($scope.$parent.stiles[tile.index[i]].scoredItems[j].item) {
                            case "gap":
                                successfully += 10 * $scope.$parent.stiles[tile.index[i]].scoredItems[j].scored;
                                break;
                            case "intersection":
                                successfully += 10 * $scope.$parent.stiles[tile.index[i]].scoredItems[j].scored * $scope.$parent.stiles[tile.index[i]].scoredItems[j].count;
                                break;
                            case "obstacle":
                                successfully += 20 * $scope.$parent.stiles[tile.index[i]].scoredItems[j].scored * $scope.$parent.stiles[tile.index[i]].scoredItems[j].count;
                                break;
                            case "speedbump":
                                successfully += 10 * $scope.$parent.stiles[tile.index[i]].scoredItems[j].scored;
                                break;
                            case "ramp":
                                successfully += 10 * $scope.$parent.stiles[tile.index[i]].scoredItems[j].scored * $scope.$parent.stiles[tile.index[i]].scoredItems[j].count;
                                break;
                        }

                    }
                }
                return successfully;
            }

            $scope.rotateRamp = function (direction) {
                var ro;
                switch (direction) {
                    case "bottom":
                        ro = 0;
                        break;
                    case "top":
                        ro = 180;
                        break;
                    case "left":
                        ro = 90;
                        break;
                    case "right":
                        ro = 270;
                        break;
                }
                ro += $scope.$parent.sRotate;
                if (ro >= 360) ro -= 360;
                else if (ro < 0) ro += 360;
                switch (ro) {
                    case 0:
                        return;
                    case 180:
                        return "fa-rotate-180";
                    case 90:
                        return "fa-rotate-90";
                    case 270:
                        return "fa-rotate-270";
                }
            }

        }
    };
});



app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', 'mtile', 'mtiles', 'stiles', 'nineTile', 'sRotate', 'startTile', 'startTile2', 'isCheckPoint', function ($scope, $uibModalInstance, mtile, mtiles, stiles, nineTile, sRotate, startTile, startTile2, isCheckPoint) {
    $scope.mtile = mtile;
    $scope.sRotate = sRotate;
    $scope.stiles = stiles;
    $scope.nineTile = nineTile;
    $scope.isCheckPoint = isCheckPoint;
    $scope.words = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
    $scope.evacTapeRot = function (tile) {
        let rot = 0;
        if (tile.evacEntrance >= 0) {
            rot = tile.evacEntrance;
        } else if (tile.evacExit >= 0) {
            rot = tile.evacExit;
        }
        rot += sRotate;
        return rot % 360;
    }
    function dir2num(dir) {
        switch (dir) {
            case "top":
                return 0;
            case "right":
                return 90;
            case "bottom":
                return 180;
            case "left":
                return 270;
        }
    }
    $scope.next = [];
    for (let i in mtile.next_dir) {
        let nd = (dir2num(mtile.next_dir[i]) + sRotate) % 360;
        switch (nd) {
            case 0:
                $scope.next.top = mtile.index[i];
                break;
            case 90:
                $scope.next.right = mtile.index[i];
                break;
            case 180:
                $scope.next.bottom = mtile.index[i];
                break;
            case 270:
                $scope.next.left = mtile.index[i];
                break;
        }
    }

    $scope.dirStatus = function (tile) {
        if (tile.scoredItems.length == 0) return;

        // Number of successfully passed times
        var successfully = 0;
        // Number of times it is possible to pass this tile
        var possible = 0
        for (let i = 0; i < tile.scoredItems.length; i++) {
            possible++;
            if (tile.scoredItems[i].scored) {
                successfully++;
            }
        }

        if (possible > 0 && successfully == possible)
            return "done";
        else if (successfully > 0)
            return "halfdone";
        else if (possible > 0)
            return "undone";
        else
            return "";
    }

    $scope.tilerotate = function (tilerot) {
        if (!tilerot) return $scope.sRotate;
        var ro = tilerot + $scope.sRotate;
        if (ro >= 360) ro -= 360;
        else if (ro < 0) ro += 360;
        return ro;
    }

    $scope.isCheckPointTile = function (tile) {
        if (!tile || tile.index.length == 0)
            return;
        return $scope.isCheckPoint($scope.stiles[tile.index[0]]);
    }

    $scope.isStart = function (tile) {
        if (!tile)
            return;
        return tile.x == startTile.x &&
            tile.y == startTile.y &&
            tile.z == startTile.z;
    }

    $scope.rotateRamp = function (direction) {
        var ro;
        switch (direction) {
            case "bottom":
                ro = 0;
                break;
            case "top":
                ro = 180;
                break;
            case "left":
                ro = 90;
                break;
            case "right":
                ro = 270;
                break;
        }
        ro += $scope.sRotate;
        if (ro >= 360) ro -= 360;
        else if (ro < 0) ro += 360;
        switch (ro) {
            case 0:
                return;
            case 180:
                return "fa-rotate-180";
            case 90:
                return "fa-rotate-90";
            case 270:
                return "fa-rotate-270";
        }
    }
    $scope.ok = function () {
        playSound(sClick);
        $uibModalInstance.close();
    };

}]);



$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'runs/' + runId);
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

var sClick, sError, sInfo;
window.onload = function () {
    getAudioBuffer('/sounds/click.mp3', function (buffer) {
        sClick = buffer;
    });
    getAudioBuffer('/sounds/error.mp3', function (buffer) {
        sError = buffer;
    });
    getAudioBuffer('/sounds/info.mp3', function (buffer) {
        sInfo = buffer;
    });
};

function tile_size() {
    try {
        var b = $('.tilearea');
        //console.log('コンテンツ本体：' + b.height() + '×' + b.width());
        //console.log('window：' + window.innerHeight);
        if (rotate % 180 == 0) {
            var tilesize_w = ($('.tilearea').width() - 2 * width) / width;
            var tilesize_h = (window.innerHeight - 140) / length;
        } else {
            var tilesize_w = ($('.tilearea').width() - 2 * length) / length;
            var tilesize_h = (window.innerHeight - 140) / width;
        }

        //console.log('tilesize_w:' + tilesize_w);
        //console.log('tilesize_h:' + tilesize_h);
        if (tilesize_h > tilesize_w) var tilesize = tilesize_w;
        else var tilesize = tilesize_h;
        $('tile').css('height', tilesize);
        $('tile').css('width', tilesize);
        $('.tile-image').css('height', tilesize);
        $('.tile-image').css('width', tilesize);
        $('.tile-font').css('font-size', tilesize - 10);
        $('.tile-font-1-25').css('font-size', tilesize / 3);
        $('.slot').css('height', tilesize);
        $('.slot').css('width', tilesize);
        $('.chnumtxt').css('font-size', tilesize / 6);
        $('.tile-point').css('font-size', tilesize / 2 + "px");
        if (rotate % 180 == 0) {
            $('#wrapTile').css('width', (tilesize + 3) * width);
        } else {
            $('#wrapTile').css('width', (tilesize + 3) * length);
        }

        $('#card_area').css('height', (window.innerHeight - 130));
        if (b.height() == 0) setTimeout("tile_size()", 1000);
    } catch (e) {
        setTimeout("tile_size()", 1000);
    }
}