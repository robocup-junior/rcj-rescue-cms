// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
let maxKit={};

// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http','$translate', '$cookies',function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {

    $scope.runIds = runId.split(',');
    $scope.runNum = $scope.runIds.length;
    $scope.nowRun = 0;

    function setRunId(index){
        $scope.runId = $scope.runIds[index];
        runId = $scope.runIds[index];
        $scope.nowRun = index;
    
        $scope.sync = 0;
        $scope.z = 0;
        $scope.startedTime = false;
        $scope.time = 0;
        $scope.startUnixTime = 0;
        $scope.cells = {};
        $scope.tiles = {};
        $scope.leagueType = null;
        loadNewRun();
        $(window).scrollTop(0);
    }
    setRunId(0);

    if(movie){
        $scope.movie = movie;
        $scope.token = token;
        $http.get("/api/document/files/" + teamId + '/' + token).then(function (response) {
            $scope.uploaded = response.data;
        })
        
        $scope.checkUploaded = function(name){
            return($scope.uploaded.some((n) => new RegExp('^' + name + '\\.*').test(n)));
        }
        
        $scope.getVideoLink = function(path){
            return("/api/document/files/" + teamId + "/" + token + "/" + path);
        }
        
        $scope.getVideoList = function(name){
            let res = $scope.uploaded.filter(function(value) {
                return new RegExp('^' + name + '\\.*').test(value);
            });
            res.sort(function(first, second){
                if ( first.match(/.mp4/)) {
                    return -1;
                }
                if ( second.match(/.mp4/)) {
                    return -1;
                }
            });
            return res;
        }
    }
    

    var date = new Date();
    var prevTime = 0;

    $scope.checkTeam = $scope.checkRound = $scope.checkMember = $scope.checkMachine = false;
    $scope.toggleCheckTeam = function(){
        $scope.checkTeam = !$scope.checkTeam;
        playSound(sClick);
    }
    $scope.toggleCheckRound = function(){
        $scope.checkRound = !$scope.checkRound;
        playSound(sClick);
    }
    $scope.toggleCheckMember = function(){
        $scope.checkMember = !$scope.checkMember;
        playSound(sClick);
    }
    $scope.toggleCheckMachine = function(){
        $scope.checkMachine = !$scope.checkMachine;
        playSound(sClick);
    }

    $scope.checks = function(){
        return ($scope.checkTeam & $scope.checkRound & $scope.checkMember & $scope.checkMachine)
    }

    


    const http_config = {
        timeout: 10000
    };

    // Saving the run. Requests go one at a time, in order: what changes while one is on its way
    // waits, merged into the next (each part with its latest value). Two at once were refused by
    // the server (VersionError), and one overtaking another could save an older value. `done` is
    // called once what it came with is saved; what failed is kept for the next save or the resend
    var unsent = null;
    var unsentDone = [];
    var sending = false;

    function save(data, done) {
        // The tiles are merged one by one, so that a tile's change does not drop another's
        var tiles = Object.assign({}, unsent && unsent.tiles, data.tiles);
        unsent = Object.assign(unsent || {}, data);
        if (data.tiles) unsent.tiles = tiles;
        if (done) unsentDone.push(done);
        if (!sending) sendNext();
    }

    function keepUnsent(data, done) {
        var tiles = Object.assign({}, data.tiles, unsent && unsent.tiles);
        unsent = Object.assign(data, unsent || {});
        if (Object.keys(tiles).length) unsent.tiles = tiles;
        unsentDone = done.concat(unsentDone);
    }

    function sendNext() {
        if (!unsent) return;
        var data = unsent;
        var done = unsentDone;
        unsent = null;
        unsentDone = [];
        sending = true;
        $scope.sync++;
        $http.put("/api/runs/maze/" + runId, data, http_config).then(function (response) {
            sending = false;
            $scope.sync--;
            // The score could not be worked out yet: again in a moment
            if (response.status == 202) {
                keepUnsent(data, done);
                $timeout(sendNext, 100);
                return;
            }
            $scope.score = response.data.score;
            $scope.networkError = false;
            done.forEach(function (f) {
                f();
            });
            sendNext();
        }, function (response) {
            sending = false;
            $scope.sync--;
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
            keepUnsent(data, done);
            $scope.networkError = true;
        });
    }

    function upload_run(data) {
        if ($scope.networkError) {
            $scope.saveEverything();
            return;
        }
        save(Object.assign(data, {
            time: {
                minutes: Math.floor($scope.time / 60000),
                seconds: Math.floor(($scope.time % 60000) / 1000)
            }
        }));
    }

    $scope.lopProcessing = false;

    if($cookies.get('sRotate')){
        $scope.sRotate = Number($cookies.get('sRotate'));
    }
    else $scope.sRotate = 0;

    $scope.cells = {};
    $scope.tiles = {};

    $scope.startedScoring = false;

    var db_cells;

    function loadNewRun(){
        $http.get("/api/runs/maze/" + runId +
        "?populate=true").then(function (response) {
            $scope.exitBonus = response.data.exitBonus;
            $scope.field = response.data.field.name;
            $scope.round = response.data.round.name;
            $scope.score = response.data.score;
            $scope.team = response.data.team;
            $scope.league = response.data.team.league;
            $scope.competition = response.data.competition;
            $scope.LoPs = response.data.LoPs;
            $scope.MisIdent = response.data.misidentification;
            $scope.diceSelect = response.data.diceNumber;

            // Verified time by timekeeper
            $scope.minutes = response.data.time.minutes;
            $scope.seconds = response.data.time.seconds;
            $scope.time = ($scope.minutes * 60 + $scope.seconds)*1000;
            prevTime = $scope.time;

            // Scoring elements of the tiles
            for (let i = 0; i < response.data.tiles.length; i++) {
                $scope.tiles[response.data.tiles[i].x + ',' +
                    response.data.tiles[i].y + ',' +
                    response.data.tiles[i].z] = response.data.tiles[i];
            }


            $scope.loadMap(response.data.map);

            if (document.referrer.indexOf('sign') != -1) {
                $scope.checked = true;
                $timeout($scope.tile_size, 10);
                $timeout($scope.tile_size, 200);
            }else{
            }



        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
            pageLoaded();
        });
    }

    // Takes the loading screen away once the map is drawn (line_view.js)
    function pageLoaded() {
        if (typeof revealRunPage === 'function') revealRunPage($scope.tile_size);
    }

    // The map as the view and sign pages draw it, for the floor and rotation shown (line_view.js)
    function drawMap() {
        if (typeof buildMazeMap === 'function' && $scope.width)
            $scope.mazeView = buildMazeMap($scope.cells, $scope.width, $scope.length, $scope.z, $scope.sRotate);
    }

    $scope.victimImage = function (cell, side) {
        return mazeVictimImage(cell, side);
    };


    $scope.randomDice = function(){
        playSound(sClick);
        var a = Math.floor( Math.random() * 6 ) + 5;
        $scope.diceSelect = 0;
        //Animation
        setTimeout(diceAnimation, 100, a)
    }

    function diceAnimation(num){
        $scope.diceSelect += 1;
        if($scope.diceSelect > 5) $scope.diceSelect -= 6;
        $scope.$apply();
        if(num > 0){
            setTimeout(diceAnimation,100,num-1);
        }else{
            //Set selected map
            $scope.changeMap($scope.diceSelect);
        }
    }

    $scope.changeMap = function(n){
        $scope.sync++;
        $http.put("/api/runs/maze/map/" + runId, {
            map: $scope.dice[n],
            diceNumber: n
        }).then(function (response) {
            $scope.loadMap(response.data.map._id);
            $scope.sync--;
            $scope.diceSelect = n;
        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
            $scope.networkError = true;
        });
    }

    $scope.loadMap = function(mapId){
        // Get the map
        $http.get("/api/maps/maze/" + mapId +
            "?populate=true").then(function (response) {
            console.log(response.data);
            $scope.startTile = response.data.startTile;
            $scope.height = response.data.height;

            $scope.width = response.data.width;
            $scope.length = response.data.length;
            $scope.duration = response.data.duration || 480;
            $scope.leagueType = response.data.leagueType;
            // Identification bonus
            maxKit={
                'Red': 1,
                'Green': 1
            };

            if(response.data.parent){
                if(!$scope.dice){
                    $http.get("/api/maps/maze/" + response.data.parent).then(function (response) {
                        $scope.dice = response.data.dice;
                    }, function (response) {
                        console.log("Error: " + response.statusText);
                    });
                }

            }else{
                $scope.dice = response.data.dice;
            }

            for (let i = 0; i < response.data.cells.length; i++) {
                $scope.cells[response.data.cells[i].x + ',' +
                    response.data.cells[i].y + ',' +
                    response.data.cells[i].z] = response.data.cells[i];
            }

            db_cells = response.data.cells;

            width = response.data.width;
            length = response.data.length;
            drawMap();
            $timeout(pageLoaded, 0);

        }, function (response) {
            console.log("Error: " + response.statusText);
            pageLoaded();
        });
    }

    $scope.range = function (n) {
        arr = [];
        for (let i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    // Setting the time by hand (the time of the run): in seconds, kept from 0 to the run's duration,
    // shown as minutes and seconds and used when the timer starts again
    function setTime(total) {
        total = Math.max(0, Math.min($scope.duration || 480, total));
        $scope.minutes = Math.floor(total / 60);
        $scope.seconds = total % 60;
        $scope.time = total * 1000;
        prevTime = $scope.time;
    }

    $scope.stepTime = function (seconds) {
        if ($scope.startedTime) return;
        playSound(sClick);
        setTime(($scope.minutes || 0) * 60 + ($scope.seconds || 0) + seconds);
    };

    // After typing: numbers only, seconds over 59 carried into the minutes
    $scope.tidyTime = function () {
        if ($scope.startedTime) return;
        setTime((parseInt($scope.minutes, 10) || 0) * 60 + (parseInt($scope.seconds, 10) || 0));
    };

    $scope.timeReset = function () {
        playSound(sClick);
        prevTime = 0;
        $scope.time = 0;
        $scope.saveEverything();
    }

    $scope.infochecked = function () {
        playSound(sClick);
        $scope.checked = true;
        //$timeout($scope.tile_size, 10);
        $timeout($scope.tile_size, 200);
        $timeout($scope.tile_size, 2000);
        scrollTo( 0, 0 ) ;
    }
    $scope.decrement = function () {
        playSound(sClick);
        $scope.LoPs--;
        if ($scope.LoPs < 0)
            $scope.LoPs = 0;

        upload_run({
          LoPs: $scope.LoPs
        });

    }
    $scope.increment = function () {
        playSound(sClick);
        $scope.LoPs++;

        upload_run({
          LoPs: $scope.LoPs
        });
    }

    $scope.decrementMis = function () {
        playSound(sClick);
        $scope.MisIdent--;
        if ($scope.MisIdent < 0)
            $scope.MisIdent = 0;

        upload_run({
          misidentification: $scope.MisIdent
        });

    }
    $scope.incrementMis = function () {
        playSound(sClick);
        $scope.MisIdent++;

        upload_run({
          misidentification: $scope.MisIdent
        });
    }

    $scope.changeFloor = function (z){
        playSound(sClick);
        $scope.z = z;
        drawMap();
    }

    $scope.tileRot = function (r){
        playSound(sClick);
        $scope.sRotate += r;
        if($scope.sRotate >= 360)$scope.sRotate -= 360;
        else if($scope.sRotate < 0) $scope.sRotate+= 360;
        drawMap();

        $cookies.put('sRotate', $scope.sRotate, {
          path: '/'
        });
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

    var tick = function () {
        if ($scope.startedTime) {
            date = new Date();
            $scope.time = prevTime + (date.getTime() - $scope.startUnixTime);
            $scope.minutes = Math.floor($scope.time / 60000);
            $scope.seconds = Math.floor(($scope.time % 60000) / 1000);
            if ($scope.time >= $scope.duration*1000) {
                playSound(sTimeup);
                $scope.startedTime = !$scope.startedTime;
                $scope.time = $scope.duration*1000;
                prevTime = $scope.time;
                $scope.saveEverything();
                // The stop asked is moot: the run is over, which the sheet says
                $scope.stopAsked = false;
                $scope.timeUp = true;
            }
            $timeout(tick, 1000);
        }
    }

    // Stopping the timer is asked twice, as it runs to the end of the run. The time of the first
    // tap is the one recorded when the stop is confirmed; kept running, the timer just goes on
    $scope.stopAsked = false;
    $scope.askStop = function (asked) {
        playSound(sClick);
        if (asked) $scope.stopAt = prevTime + (new Date().getTime() - $scope.startUnixTime);
        $scope.stopAsked = asked;
    };

    $scope.confirmStop = function () {
        playSound(sClick);
        $scope.stopAsked = false;
        $scope.startedTime = false;
        $scope.time = $scope.stopAt;
        prevTime = $scope.time;
        $scope.saveEverything();
    };

    // The time of the run is up: the sheet says so, with the time recorded, and goes on to the sign
    // page or is closed to look over the run first (the finish card goes on from there too)
    $scope.timeUp = false;
    $scope.closeTimeUp = function () {
        playSound(sClick);
        $scope.timeUp = false;
    };

    // The page behind a sheet stays still; Escape closes the sheet (and keeps the timer running)
    $scope.$watchGroup(['stopAsked', 'timeUp'], function (open) {
        document.documentElement.classList.toggle('rv-overlay-open', !!(open[0] || open[1]));
    });
    document.addEventListener('keydown', function (event) {
        if (event.key != 'Escape') return;
        if ($scope.timeUp) $scope.$apply($scope.closeTimeUp);
        else if ($scope.stopAsked) $scope.$apply(function () {
            $scope.askStop(false);
        });
    });

    $scope.toggleScoring = function(){
        playSound(sClick);
        $scope.startedScoring = !$scope.startedScoring;
    }

    $scope.toggleTime = function () {
        playSound(sClick);
        // Start/stop timer
        $scope.startedTime = !$scope.startedTime;
        $scope.stopAsked = false;
        if ($scope.startedTime) {
            // Start the timer
            $timeout(tick, 0);
            date = new Date();
            $scope.startUnixTime = date.getTime();

            upload_run({
              status: 2
            });
        } else {
            // Save everything when you stop the time
            date = new Date();
            $scope.time = prevTime + (date.getTime() - $scope.startUnixTime);
            prevTime = $scope.time;
            $scope.saveEverything();
        }
    }

    $scope.changeExitBonus = function () {
        playSound(sClick);
        $scope.exitBonus = ! $scope.exitBonus
        if ($scope.exitBonus && $scope.startedTime) {
            $scope.startedTime = false;
            date = new Date();
            $scope.time = prevTime + (date.getTime() - $scope.startUnixTime);
            prevTime = $scope.time;
            $scope.minutes = Math.floor($scope.time / 60000);
            $scope.seconds = Math.floor(($scope.time % 60000) / 1000)
        }
        $scope.saveEverything();
    }

    $scope.isUndefined = function (thing) {
        return (typeof thing === "undefined");
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
                    steps:  false,
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
            possible+=1;
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
        if(cell.tile.victims.top != "None"){
            possible++;
            current += tile.scoredItems.victims.top;
            possible += maxKit[cell.tile.victims.top];
            current += Math.min(tile.scoredItems.rescueKits.top,maxKit[cell.tile.victims.top]);
        }
        if(cell.tile.victims.left != "None"){
            possible++;
            current += tile.scoredItems.victims.left;
            possible += maxKit[cell.tile.victims.left];
            current += Math.min(tile.scoredItems.rescueKits.left,maxKit[cell.tile.victims.left]);
        }
        if(cell.tile.victims.right != "None"){
            possible++;
            current += tile.scoredItems.victims.right;
            possible += maxKit[cell.tile.victims.right];
            current += Math.min(tile.scoredItems.rescueKits.right,maxKit[cell.tile.victims.right]);
        }
        if(cell.tile.victims.bottom != "None"){
            possible++;
            current += tile.scoredItems.victims.bottom;
            possible += maxKit[cell.tile.victims.bottom];
            current += Math.min(tile.scoredItems.rescueKits.bottom,maxKit[cell.tile.victims.bottom]);
        }
        if(cell.tile.victims.floor != "None"){
            possible++;
            current += tile.scoredItems.victims.floor;
            console.log(current)
            possible += maxKit[cell.tile.victims.floor];
            current += Math.min(tile.scoredItems.rescueKits.floor,maxKit[cell.tile.victims.floor]);
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


    $scope.tilePoint = function (x, y, z, isTile) {
        var cell = $scope.cells[x + ',' + y + ',' + z];
        if (!cell || !isTile) return 0;
        var tile = $scope.tiles[x + ',' + y + ',' + z];
        if (!tile) return 0;

        var current = 0;
        if (cell.tile.speedbump && tile.scoredItems.speedbump) current += 5;
        if (cell.tile.checkpoint && tile.scoredItems.checkpoint) current += 10;
        if (cell.tile.victims.floor && cell.tile.victims.floor != "None" && tile.scoredItems.victims.floor) {
            current += cell.isLinear ? 15 : 30;
            if (tile.scoredItems.rescueKits.floor > 0) current += 10;
        }
        return current;
    };

    $scope.cellClick = function (x, y, z, isWall, isTile) {
        var cell = $scope.cells[x + ',' + y + ',' + z];
        if (!cell)
            return;
        if (!isTile)
            return;
        playSound(sClick);

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

        var hasVictims = (cell.tile.victims.top != "None") ||
            (cell.tile.victims.right != "None") ||
            (cell.tile.victims.bottom != "None") ||
            (cell.tile.victims.left != "None") ||
            (cell.tile.victims.floor != "None");

        // Total number of scorable things on this tile
        var total = !!cell.tile.speedbump + !!cell.tile.checkpoint + !!cell.tile.steps + !!cell.tile.ramp + hasVictims;
        console.log("totalt antal saker", total);
        console.log("Has victims", hasVictims);

        if (total == 1 && !hasVictims) {
            if (cell.tile.speedbump) {
                tile.scoredItems.speedbump = !tile.scoredItems.speedbump;
            }
            if (cell.tile.checkpoint) {
                tile.scoredItems.checkpoint = !tile.scoredItems.checkpoint;
            }
            if (cell.tile.ramp) {
                tile.scoredItems.ramp = !tile.scoredItems.ramp;
            }
            if (cell.tile.steps) {
                tile.scoredItems.steps = !tile.scoredItems.steps;
            }
            var httpdata = {
                tiles: {
          [x + ',' + y + ',' + z]: tile
                }
            };
            upload_run(httpdata);
        } else if (total > 1 || hasVictims) {
            // Open modal for multi-select
            $scope.open(x, y, z);
        }

    }

    $scope.open = function (x, y, z) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/maze_judge_modal_2026E.html',
            controller: 'ModalInstanceCtrl',
            windowClass: 'rv-maze-modal',
            resolve: {
                cell: function () {
                    return $scope.cells[x + ',' + y + ',' + z];
                },
                tile: function () {
                    return $scope.tiles[x + ',' + y + ',' + z];
                },
                sRotate: function (){
                    return $scope.sRotate;
                },
                leagueType: function () {
                    return $scope.leagueType;
                }
            }
        }).closed.then(function (result) {
            let httpdata = {
                tiles: {
          [x + ',' + y + ',' + z]: $scope.tiles[x + ',' + y + ',' + z]
                }
            };
            upload_run(httpdata);
        });
    };

    $scope.saveEverything = function () {
        var run = {}
        run.exitBonus = $scope.exitBonus;
        run.LoPs = $scope.LoPs;
        run.misidentification = $scope.MisIdent;

        // Scoring elements of the tiles
        run.tiles = $scope.tiles;
        $scope.minutes = Math.floor($scope.time / 60000)
        $scope.seconds = Math.floor(($scope.time % 60000) / 1000)
        run.time = {
            minutes: $scope.minutes,
            seconds: $scope.seconds
        };

        save(run);
    };

    $scope.confirm = function () {
        playSound(sClick);
        var run = {}
        run.exitBonus = $scope.exitBonus;
        run.LoPs = $scope.LoPs;
        run.misidentification = $scope.MisIdent;

        // Scoring elements of the tiles
        run.tiles = $scope.tiles;

        // Verified time by timekeeper
        run.time = {};
        run.time.minutes = $scope.minutes;;
        run.time.seconds = $scope.seconds;
        run.status = 3;

        // On to the sign page once this, after all before it, is saved
        save(run, function () {
            $scope.go('/maze/sign/' + runId + '?return=' + $scope.getParam('return'));
        });
    };

    $scope.nextRun = function (flag) {
        playSound(sClick);
        var run = {}
        run.exitBonus = $scope.exitBonus;
        run.LoPs = $scope.LoPs;
        run.misidentification = $scope.MisIdent;

        // Scoring elements of the tiles
        run.tiles = $scope.tiles;

        // Verified time by timekeeper
        run.time = {};
        run.time.minutes = $scope.minutes;;
        run.time.seconds = $scope.seconds;
        run.status = 3;

        // On to the next run, or done, once this, after all before it, is saved
        save(run, function () {
            if(flag){
                setRunId($scope.nowRun+1);
                $(window).scrollTop(0);
            }
            else{
            Swal.fire({
                title: 'Complete!',
                html: 'Scoring completed! Please close this tab.',
                type: 'success'
            }).then((result) => {
                window.close();
            })
            }
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
        window.location = path
    }

    // The map scales with its card by itself (line_view.css); nothing to size
    $scope.tile_size = function () {};

var currentWidth = -1;


$(window).on('load resize', function () {
    if (currentWidth == window.innerWidth) {
        return;
    }
    currentWidth = window.innerWidth;
    $scope.tile_size();

});

}]);


// A number shown in two digits (the seconds of the time of the run: 0:05), read back as a number
app.directive('rvTwoDigits', function () {
    return {
        require: 'ngModel',
        link: function ($scope, element, attrs, ngModel) {
            ngModel.$formatters.push(function (value) {
                return value == null || value === '' ? value : ('0' + value).slice(-2);
            });
            ngModel.$parsers.push(function (value) {
                return value === '' ? value : parseInt(value, 10);
            });
        }
    };
});

// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

app.controller('ModalInstanceCtrl', ['$scope','$uibModalInstance','cell','tile','sRotate','leagueType',function ($scope, $uibModalInstance, cell, tile, sRotate, leagueType) {
    $scope.cell = cell;
    $scope.tile = tile;
    $scope.leagueType = leagueType;
    $scope.hasVictims = (cell.tile.victims.top != "None") ||
        (cell.tile.victims.right != "None") ||
        (cell.tile.victims.bottom != "None") ||
        (cell.tile.victims.left != "None") ||
        (cell.tile.victims.floor != "None");
    $scope.clickSound = function(){
        playSound(sClick);
    };

    $scope.incKits = function (direction) {
        playSound(sClick);
        $scope.tile.scoredItems.rescueKits[direction]++;
    };

    $scope.decKits = function (direction) {
        playSound(sClick);
        $scope.tile.scoredItems.rescueKits[direction]--;
        if ($scope.tile.scoredItems.rescueKits[direction] < 0) {
            $scope.tile.scoredItems.rescueKits[direction] = 0;
        }
    };

    $scope.changeRamp = function(){
        playSound(sClick);
        $scope.tile.scoredItems.ramp = !$scope.tile.scoredItems.ramp;
    };

    $scope.changeCheckPoint = function(){
        playSound(sClick);
        $scope.tile.scoredItems.checkpoint = !$scope.tile.scoredItems.checkpoint;
    };

    $scope.changeSpeedbump = function(){
        playSound(sClick);
        $scope.tile.scoredItems.speedbump = !$scope.tile.scoredItems.speedbump;
    };

    $scope.changeSteps = function(){
        playSound(sClick);
        $scope.tile.scoredItems.steps = !$scope.tile.scoredItems.steps;
    };

    $scope.toggleVictim = function (direction) {
        playSound(sClick);
        $scope.tile.scoredItems.victims[direction] = !$scope.tile.scoredItems.victims[direction];
        // Identification is only valid for a found victim
        if (!$scope.tile.scoredItems.victims[direction]) {
            $scope.tile.scoredItems.rescueKits[direction] = 0;
        }
    };

    $scope.toggleIdentified = function (direction) {
        if (!$scope.tile.scoredItems.victims[direction]) return;
        playSound(sClick);
        $scope.tile.scoredItems.rescueKits[direction] = $scope.tile.scoredItems.rescueKits[direction] > 0 ? 0 : 1;
    };


    $scope.lightStatus = function(light, kit){
        if(light) return true;
        return false;
    };

    $scope.kitStatus = function(light, kit, type){
        return (maxKit[type] <= kit);
    };

    $scope.modalRotate = function(dir){
        var ro;
        switch(dir){
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
        if(ro >= 360)ro -= 360;
        switch(ro){
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

var getAudioBuffer = function(url, fn) {
  var req = new XMLHttpRequest();
  req.responseType = 'arraybuffer';

  req.onreadystatechange = function() {
    if (req.readyState === 4) {
      if (req.status === 0 || req.status === 200) {
        context.decodeAudioData(req.response, function(buffer) {
          fn(buffer);
        });
      }
    }
  };

  req.open('GET', url, true);
  req.send('');
};

var playSound = function(buffer) {
  var source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
};

var sClick,sInfo,sError,sTimeup;
window.onload = function() {
  getAudioBuffer('/sounds/click.mp3', function(buffer) {
      sClick = buffer;
  });
  getAudioBuffer('/sounds/info.mp3', function(buffer) {
      sInfo = buffer;
  });
  getAudioBuffer('/sounds/error.mp3', function(buffer) {
      sError = buffer;
  });
  getAudioBuffer('/sounds/timeup.mp3', function(buffer) {
      sTimeup = buffer;
  });
};
