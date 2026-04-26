// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
let maxKit={
    'PHI': 2,
    'PSI': 1,
    'OMEGA': 0,
    'Red': 2,
    'Yellow': 1,
    'Green': 0
};

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
    "Red": {
        "maxKitNum": 2,
        "linearPoint": 10,
        "floatingPoint": 30
    },
    "Yellow": {
        "maxKitNum": 1,
        "linearPoint": 10,
        "floatingPoint": 30
    },
    "Green": {
        "maxKitNum": 0,
        "linearPoint": 10,
        "floatingPoint": 30
    },
    "Cognitive": {
        "maxKitNum": 0,
        "linearPoint": 5,
        "floatingPoint": 15
    }
};

// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http','$translate', '$cookies',function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {

    var txt_timeup,txt_timeup_mes;

    $translate('maze.judge.js.timeup.title').then(function (val) {
        txt_timeup = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('maze.judge.js.timeup.content').then(function (val) {
        txt_timeup_mes = val;
    }, function (translationId) {
        // = translationId;
    });

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

    function upload_run(data) {
        if ($scope.networkError) {
            $scope.saveEverything();
            return;
        }

        $scope.sync++;
        $http.put("/api/runs/maze/" + runId, Object.assign(data, {
            time: {
                minutes: Math.floor($scope.time / 60000),
                seconds: Math.floor(($scope.time % 60000) / 1000)
            }
        }), http_config).then(function (response) {
            console.log(response);
            $scope.score = response.data.score;
            $scope.sync--;
        }, function (response) {
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
            $scope.networkError = true;
        });
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
        });
    }
    

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
            
            victimConstant = victimConstantWL;

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

            for (let i = 0; i < response.data.cells.length; i++) {
                if (!response.data.cells[i].tile.cognitiveTargets) response.data.cells[i].tile.cognitiveTargets = {};
                if (response.data.cells[i].tile.victims.top == 'Cognitive' && !response.data.cells[i].tile.cognitiveTargets.top) response.data.cells[i].tile.cognitiveTargets.top = { rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' } };
                if (response.data.cells[i].tile.victims.right == 'Cognitive' && !response.data.cells[i].tile.cognitiveTargets.right) response.data.cells[i].tile.cognitiveTargets.right = { rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' } };
                if (response.data.cells[i].tile.victims.bottom == 'Cognitive' && !response.data.cells[i].tile.cognitiveTargets.bottom) response.data.cells[i].tile.cognitiveTargets.bottom = { rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' } };
                if (response.data.cells[i].tile.victims.left == 'Cognitive' && !response.data.cells[i].tile.cognitiveTargets.left) response.data.cells[i].tile.cognitiveTargets.left = { rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' } };
            }

            $timeout($scope.tile_size, 100);

        }, function (response) {
            console.log("Error: " + response.statusText);
        });
    }

    const cognitiveColorValues = {
        'B': -2,
        'R': -1,
        'Y': 0,
        'G': 1,
        'C': 2
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
        return (victimConstantWL[type] ? victimConstantWL[type].maxKitNum : 0);
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

    $scope.range = function (n) {
        arr = [];
        for (let i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

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
    }

    $scope.tileRot = function (r){
        playSound(sClick);
        $scope.sRotate += r;
        if($scope.sRotate >= 360)$scope.sRotate -= 360;
        else if($scope.sRotate < 0) $scope.sRotate+= 360;
        $timeout($scope.tile_size, 50);

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
                $scope.saveEverything();
                swal(txt_timeup, '', "info");
            }
            $timeout(tick, 1000);
        }
    }

    $scope.toggleScoring = function(){
        playSound(sClick);
        $scope.startedScoring = !$scope.startedScoring;
    }

    $scope.toggleTime = function () {
        playSound(sClick);
        // Start/stop timer
        $scope.startedTime = !$scope.startedTime;
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
            if (!$scope.isDummy(cell, 'top')) {
                possible++;
                current += tile.scoredItems.victims.top;
                let mk = $scope.getMaxKitNum(cell, 'top');
                possible += mk;
                if (tile.scoredItems.victims.top) current += Math.min(tile.scoredItems.rescueKits.top, mk);
            }
        }
        if(cell.tile.victims.left != "None"){
            if (!$scope.isDummy(cell, 'left')) {
                possible++;
                current += tile.scoredItems.victims.left;
                let mk = $scope.getMaxKitNum(cell, 'left');
                possible += mk;
                if (tile.scoredItems.victims.left) current += Math.min(tile.scoredItems.rescueKits.left, mk);
            }
        }
        if(cell.tile.victims.right != "None"){
            if (!$scope.isDummy(cell, 'right')) {
                possible++;
                current += tile.scoredItems.victims.right;
                let mk = $scope.getMaxKitNum(cell, 'right');
                possible += mk;
                if (tile.scoredItems.victims.right) current += Math.min(tile.scoredItems.rescueKits.right, mk);
            }
        }
        if(cell.tile.victims.bottom != "None"){
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

        if (cell.tile.victims.top in victimConstantWL) {
            if (!$scope.isDummy(cell, 'top')) {
                current += victimConstantWL[cell.tile.victims.top][wallPointType] * tile.scoredItems.victims.top;
                if (tile.scoredItems.victims.top) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.top,
                        $scope.getMaxKitNum(cell, 'top')
                    );
                }
            }
        }
        if (cell.tile.victims.right in victimConstantWL) {
            if (!$scope.isDummy(cell, 'right')) {
                current += victimConstantWL[cell.tile.victims.right][wallPointType] * tile.scoredItems.victims.right;
                if (tile.scoredItems.victims.right) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.right,
                        $scope.getMaxKitNum(cell, 'right')
                    );
                }
            }
        }
        if (cell.tile.victims.left in victimConstantWL) {
            if (!$scope.isDummy(cell, 'left')) {
                current += victimConstantWL[cell.tile.victims.left][wallPointType] * tile.scoredItems.victims.left;
                if (tile.scoredItems.victims.left) {
                    current += kitScoreForVictim(
                        tile.scoredItems.rescueKits.left,
                        $scope.getMaxKitNum(cell, 'left')
                    );
                }
            }
        }
        if (cell.tile.victims.bottom in victimConstantWL) {
            if (!$scope.isDummy(cell, 'bottom')) {
                current += victimConstantWL[cell.tile.victims.bottom][wallPointType] * tile.scoredItems.victims.bottom;
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

        if (validVictimsCount > 0) {
            // Rule: One or more valid victims or cognitive targets -> ALWAYS open the modal
            $scope.open(x, y, z);
        } else if (scoreItemsCount > 1) {
            // Rule: Multiple scorable items -> Open modal
            $scope.open(x, y, z);
        } else if (scoreItemsCount == 1) {
            if (cell.tile.blue) {
                // Blue tile is a counter, so open modal for input
                $scope.open(x, y, z);
            } else {
                // Exactly one simple score item -> toggle immediately without modal
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
            }
        }
        // If scoreItemsCount == 0 and validVictimsCount == 0 (e.g., dummy only), do nothing

    }

    $scope.open = function (x, y, z) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/maze_judge_modal.html',
            controller: 'ModalInstanceCtrl',
            size: 'lm',
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

        console.log("Update run", run);
        $http.put("/api/runs/maze/" + runId, run, http_config).then(function (response) {
            $scope.score = response.data.score;
            $scope.networkError = false;
            $scope.sync = 0;
        }, function (response) {
            console.log("Error: " + response.statusText);
            $scope.networkError = true;
        });
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

        $http.put("/api/runs/maze/" + runId, run).then(function (response) {
            $scope.score = response.data.score;
            $scope.go('/maze/sign/' + runId + '?return=' + $scope.getParam('return'));
        }, function (response) {
            console.log("Error: " + response.statusText);
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

        $http.put("/api/runs/maze/" + runId, run).then(function (response) {
            $scope.score = response.data.score;
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
        }, function (response) {
            console.log("Error: " + response.statusText);
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

    $scope.tile_size = function () {
        try {
            var mapTable = $('#mapTable');

            let areaTopLeftX = document.getElementById("mapTopLeft").getBoundingClientRect().left + window.pageXOffset;
            let areaTopLeftY = document.getElementById("mapTopLeft").getBoundingClientRect().top + window.pageYOffset;

            let scaleX = (window.innerWidth - areaTopLeftX - 10) / mapTable.width();
            let scaleY = (window.innerHeight - areaTopLeftY - 10) / mapTable.height();
            let scale = Math.min(scaleX, scaleY);

            if (scaleX > scaleY) {
                $('#wrapTile').css('transform-origin', 'top center');
            } else {
                $('#wrapTile').css('transform-origin', 'top left');
            }

            $('#wrapTile').css('transform', `scale(${scale})`);
            $('.tilearea').css('height', mapTable.height() * scale + areaTopLeftY - 50);
        } catch (e) {
            $timeout($scope.tile_size, 500);
        }
      }

var currentWidth = -1;


$(window).on('load resize', function () {
    if (currentWidth == window.innerWidth) {
        return;
    }
    currentWidth = window.innerWidth;
    $scope.tile_size();

});

}]);


// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

app.controller('ModalInstanceCtrl', ['$scope','$uibModalInstance','cell','tile','sRotate','leagueType',function ($scope, $uibModalInstance, cell, tile, sRotate, leagueType) {
    $scope.cell = cell;
    $scope.tile = tile;
    $scope.leagueType = leagueType;
    $scope.hasVictims = (cell.tile.victims.top != "None") ||
        (cell.tile.victims.right != "None") ||
        (cell.tile.victims.bottom != "None") ||
        (cell.tile.victims.left != "None");
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

    $scope.incrementBlue = function(){
        playSound(sClick);
        $scope.tile.scoredItems.blue++;
    };

    $scope.decrementBlue = function(){
        playSound(sClick);
        $scope.tile.scoredItems.blue--;
        if ($scope.tile.scoredItems.blue < 0) {
            $scope.tile.scoredItems.blue = 0;
        }
    };

    $scope.lightStatus = function(light, kit){
        if(light) return true;
        return false;
    };

    $scope.kitStatus = function(light, kit, direction){
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
            case 'B': return 'Black';
            case 'R': return 'Red';
            case 'Y': return 'Yellow';
            case 'G': return 'Green';
            case 'C': return 'Cyan';
            default: return colorCode;
        }
    };

    const cognitiveColorValues = {
        'B': -2,
        'R': -1,
        'Y': 0,
        'G': 1,
        'C': 2
    };

    $scope.getModalMaxKitNum = function (cell, direction) {
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
        return (maxKit[type] || 0);
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
