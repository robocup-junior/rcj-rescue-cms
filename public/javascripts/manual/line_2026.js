/*********************************************************************************/
// This file is a RoboCup Junior Rescue 2023 rule correspondence version. //
/*********************************************************************************/

// register the directive with your app module

var app = angular.module('ddApp', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};

app.filter('numberFixedLen', function () {
    return function (n, len) {
        var num = parseInt(n, 10);
        len = parseInt(len, 10);
        if (isNaN(num) || isNaN(len)) {
            return n;
        }
        num = '' + num;
        while (num.length < len) {
            num = '0' + num;
        }
        return num;
    };
});


// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http', '$translate', '$cookies', function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {
    $scope.runId = runId;

    $scope.lastModifiedIndex = 0;
    $scope.z = 0;
    $scope.startedTime = false;
    $scope.time = 0;
    $scope.startUnixTime = 0;


    $scope.victim_list = [];
    $scope.victim_tmp = [];
    $scope.LoPs = [];
    $scope.timeBuffer = "";



    const http_config = {
        timeout: 10000
    };

    var tileReset = true;

    var date = new Date();
    var prevTime = 0;
    var tileReset = true;



    // Scoring elements of the tiles
    $scope.stiles = [];
    // Map (images etc.) for the tiles
    $scope.mtiles = [];


    function loadNewRun() {
        $http.get("/api/runs/line/" + runId +
            "?populate=true").then(function (response) {

            $scope.LoPs = response.data.LoPs;
            $scope.exitBonus = response.data.exitBonus;
            $scope.field = response.data.field.name;
            $scope.score = response.data.score;
            $scope.raw_score = response.data.raw_score;
            $scope.multiplier = response.data.multiplier;
            $scope.showedUp = response.data.showedUp;
            $scope.started = response.data.started;
            $scope.round = response.data.round.name;
            $scope.team = response.data.team;
            $scope.league = response.data.team.league;
            $scope.competition = response.data.competition;
            // Verified time by timekeeper
            $scope.minutes = response.data.time.minutes;
            $scope.seconds = response.data.time.seconds;
            $scope.time = ($scope.minutes * 60 + $scope.seconds) * 1000;
            $scope.timeBuffer = (String($scope.minutes).padStart(2, '0') + String($scope.seconds).padStart(2, '0')).replace(/^0+/, '');
            if (!$scope.timeBuffer) $scope.timeBuffer = "";

            $scope.status = response.data.status;
            if($scope.status > 2) $scope.lastModifiedIndex = 100;


            prevTime = $scope.time;

            var started = response.data.started;

            $scope.victim_list = response.data.rescueOrder;

            // Scoring elements of the tiles
            $scope.stiles = response.data.tiles;
            let checkPointNumber = 1;
            for(let i in $scope.stiles){
                if ($scope.isCheckPoint($scope.stiles[i])) {
                    marker[i] = checkPointNumber;
                    checkPointNumber++;
                }
            }


            // Get the map
            $http.get("/api/maps/line/" + response.data.map +
              "?populate=true").then(function (response) {
                $scope.height = response.data.height;

                $scope.width = response.data.width;
                $scope.length = response.data.length;
                width = response.data.width;
                length = response.data.length;
                $scope.startTile = response.data.startTile;
                $scope.mtiles = {};
                $scope.mtilesById = {};

                // Get max victim count
                $scope.maxLiveVictims = response.data.victims.live;
                $scope.maxDeadVictims = response.data.victims.dead;

                $scope.mapIndexCount = response.data.indexCount;
                $scope.EvacuationAreaLoPIndex = response.data.EvacuationAreaLoPIndex;

                $scope.mtilesByIndex = {};
                for (var i = 0; i < response.data.tiles.length; i++) {
                    let t = response.data.tiles[i];
                    let z = (t.z === undefined || t.z === null) ? 0 : t.z;
                    $scope.mtiles[t.x + ',' + t.y + ',' + z] = t;
                    if (t._id) $scope.mtilesById[t._id] = t;
                    if (t.index && t.index.length > 0) {
                        for (let idx of t.index) {
                            $scope.mtilesByIndex[idx] = t;
                        }
                    }
                }

                // Calculate score sheets layout [Simuate]
                let index = 0;
                let x = 440;
                let y = 35;
                let x2 = 440;
                let y2 = 35;
                let base_size_x = 95;
                let base_size_y = 36;
                let base_size_x2 = 76;
                let base_size_y2 = 29;

                let el1 = [];
                let elow1 = 0;
                let el2 = [];
                let elow2 = 0;

                let lopIndex = 0;

                y+=base_size_y; // Start tile
                y2+=base_size_y2;
                let tmp = {
                    index : 0,
                    start: true
                }
                if(!el1[elow1]) el1[elow1] = [];
                el1[elow1].push(tmp);
                if(!el2[elow2]) el2[elow2] = [];
                el2[elow2].push(tmp);


                for(let tile of $scope.stiles){
                    if(tile.scoredItems.length == 0){
                        index++;
                        continue;
                    }
                    if(tile.scoredItems[0].item == "checkpoint"){
                        if(y>330-base_size_y*2){
                            x += base_size_x;
                            y = 35;
                            elow1 ++;
                        }
                        if(y2>330-base_size_y2*2){
                            x2 += base_size_x2;
                            y2 = 35;
                            elow2 ++;
                        }
                        tile.index = index;
                        tile.LoP = lopIndex;
                        if(!$scope.LoPs[lopIndex]) $scope.LoPs[lopIndex] = 0;
                        if(lopIndex == $scope.EvacuationAreaLoPIndex) tile.evacLoP = true;
                        lopIndex++;
                        if(!el1[elow1]) el1[elow1] = [];
                        el1[elow1].push(tile);
                        if(!el2[elow2]) el2[elow2] = [];
                        el2[elow2].push(tile);

                        y+=base_size_y*2;
                        y2+=base_size_y2*2;
                        if(y>330-base_size_y){
                            x += base_size_x;
                            y = 35;
                            elow1 ++;
                        }
                        if(y2>330-base_size_y2){
                            x2 += base_size_x2;
                            y2 = 35;
                            elow2 ++;
                        }

                    }else{
                        tile.index = index;
                        if(!el1[elow1]) el1[elow1] = [];
                        el1[elow1].push(tile);
                        if(!el2[elow2]) el2[elow2] = [];
                        el2[elow2].push(tile);

                        y+=base_size_y;
                        y2+=base_size_y2;
                        if(y>330-base_size_y){
                            x += base_size_x;
                            y = 35;
                            elow1 ++;
                        }
                        if(y2>330-base_size_y2){
                            x2 += base_size_x2;
                            y2 = 35;
                            elow2 ++;
                        }
                    }

                    index++;
                }

                tmp = {
                    index : index,
                    afterLoP: true,
                    LoP: lopIndex
                }
                if(!$scope.LoPs[lopIndex]) $scope.LoPs[lopIndex] = 0;
                if(!el1[elow1]) el1[elow1] = [];
                el1[elow1].push(tmp);
                if(!el2[elow2]) el2[elow2] = [];
                el2[elow2].push(tmp);

                if(el1.length <= 6) $scope.elementList = el1;
                else $scope.elementList = el2;
            }, function (response) {
                console.log("Error: " + response.statusText);
            });


        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
        });
    }




    loadNewRun();

    function findItem(item,tile) {
        for(let i=0;i<tile.length;i++){
            if(tile[i].item == item) return i;
        }
        return null;
    }

    $scope.isCheckPoint = function(tile) {
        if(tile.scoredItems) return findItem("checkpoint", tile.scoredItems) != null;
        return false;
    }

    $scope.getTileImage = function(tile) {
        if(!tile) return null;
        if(tile.start) return "/images/tiles/tile-0.png";
        
        // Try to get map tile object first
        let mtile = null;
        
        // 1. Try index-based lookup (most reliable for Line Rescue path)
        if ($scope.mtilesByIndex && tile.index !== undefined && tile.index !== null) {
            mtile = $scope.mtilesByIndex[tile.index];
        }
        
        // 2. Try ID match
        if(!mtile && $scope.mtilesById && tile.tileId) mtile = $scope.mtilesById[tile.tileId];
        if(!mtile && $scope.mtilesById && typeof tile.tile === "string") mtile = $scope.mtilesById[tile.tile];
        if(!mtile && $scope.mtilesById && tile.tileType && typeof tile.tileType === "string") mtile = $scope.mtilesById[tile.tileType];

        // 3. Try coordinate match
        if (!mtile && $scope.mtiles && tile.x !== undefined) {
            let z = (tile.z === undefined || tile.z === null) ? 0 : tile.z;
            mtile = $scope.mtiles[tile.x + ',' + tile.y + ',' + z];
        }
        
        // 4. Extract image name
        let imgName = null;
        if(mtile && mtile.tileType && mtile.tileType.image) imgName = mtile.tileType.image;
        else if(tile.tileType && tile.tileType.image) imgName = tile.tileType.image;
        else if(tile.image) imgName = tile.image;

        if(imgName) return "/images/tiles/" + imgName;
        return null;
    }

    $scope.numberStyle = function(item){
        if(item.evacLoP) return {color: '#FA4261',backgroundColor: '#FFC4CE'};
        if($scope.isCheckPoint(item) || item.start) return {color: 'orange',backgroundColor: '#FFE7D2'};
        return {color: '#42C8FA'};
    }

    $scope.itemChange = function(item){
        playSound(sClick);

        if(item.start){
            $scope.showedUp = !$scope.showedUp;
            if($scope.lastModifiedIndex < item.index) $scope.lastModifiedIndex = item.index;
            changerAfterAll(item,$scope.showedUp);
            return;
        }

        let status = !item.scoredItems[0].scored;
        for(let i of item.scoredItems){
            i.scored = status;
        }
        if($scope.lastModifiedIndex < item.index) $scope.lastModifiedIndex = item.index;
        changerAfterAll(item,status);
    }

    function changerAfterAll(item,status){
        if($scope.lastModifiedIndex > item.index) return;
        let flag = false;
        for(let list of $scope.elementList){
            for(let l of list){
                if(flag && l.scoredItems){
                    for(let i of l.scoredItems){
                        i.scored = status;
                    }
                }

                if(l.index == item.index) flag = true;
            }
        }
    }

    $scope.itemSuccess = function(item){
        if(item.start) return $scope.showedUp;
        if(item.afterLoP) return false;
        if(item.scoredItems && item.scoredItems.length > 0) {
            return item.scoredItems[0].scored;
        }
        return false;
    }

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    $scope.count_victim_list = function (type) {
        let count = 0;
        for (victiml of $scope.victim_list) {
          if (!victiml.victimType.indexOf(type)) {
            count++;
          }
        }
        return count;
      };
    
      $scope.count_victim_tmp = function (type) {
        let count = 0;
        for (victiml of $scope.victim_tmp) {
          if (!victiml.indexOf(type)) {
            count++;
          }
        }
        return count;
      };
    
      $scope.addVictimTmp = function (type) {
        playSound(sClick);
        if (type == "LIVE") {
          if ($scope.count_victim_list("LIVE") + $scope.count_victim_tmp("LIVE") >= $scope.maxLiveVictims) return;
        } else if(type == "DEAD") {
          if ($scope.count_victim_list("DEAD") + $scope.count_victim_tmp("DEAD") >= $scope.maxDeadVictims) return;
        }
        $scope.victim_tmp.push(type);
      };
    
      $scope.addVictim = function (victimType, zoneType) {
        let tmp = {};
        tmp.zoneType = zoneType;
        if (victimType == "LIVE") {
          tmp.victimType = "LIVE";
          if ($scope.count_victim_list("LIVE") >= $scope.maxLiveVictims) return;
        } else if(victimType == "DEAD") {
          tmp.victimType = "DEAD";
          if ($scope.count_victim_list("DEAD") >= $scope.maxDeadVictims) return;
        }
        $scope.victim_list.push(tmp);
      };
    
      $scope.delete_victim = function (index) {
        playSound(sClick);
        $scope.victim_list.splice(index, 1);
      };

      $scope.delete_victim_tmp = function (index) {
        playSound(sClick);
        $scope.victim_tmp.splice(index, 1);
      };

      $scope.getVictimAt = function (sequenceIndex, zoneType) {
        if (!$scope.victim_list || sequenceIndex === undefined || $scope.victim_list.length <= sequenceIndex) return null;
        let victim = $scope.victim_list[sequenceIndex];
        if (victim && victim.zoneType === zoneType) return victim;
        return null;
      };

      $scope.getVictimIndexAt = function (sequenceIndex, zoneType) {
        if (!$scope.victim_list || sequenceIndex === undefined || $scope.victim_list.length <= sequenceIndex) return -1;
        let victim = $scope.victim_list[sequenceIndex];
        if (victim && victim.zoneType === zoneType) return sequenceIndex;
        return -1;
      };
    
      $scope.victimRegist = function (zoneType) {
        playSound(sClick);
        let live = 0;
        let dead = 0;
        let kit = 0;
        for (victiml of $scope.victim_tmp) {
          if (!victiml.indexOf("LIVE")) {
            live++;
          } else if (!victiml.indexOf("DEAD")) {
            dead++;
          }
        }
        for (let i = 0; i < live; i++) {
          $scope.addVictim("LIVE", zoneType);
        }
        for (let i = 0; i < dead; i++) {
          $scope.addVictim("DEAD", zoneType);
        }
    
        $scope.victim_tmp_clear();
      };
    
      $scope.victim_tmp_clear = function () {
        playSound(sClick);
        $scope.victim_tmp = [];
      };

    $scope.addTimeDigit = function(num) {
        if ($scope.timeBuffer.length >= 4) return;
        $scope.timeBuffer += num;
        $scope.syncTime();
    };

    $scope.clearTime = function() {
        $scope.timeBuffer = "";
        $scope.syncTime();
    };

    $scope.backspaceTime = function() {
        $scope.timeBuffer = $scope.timeBuffer.slice(0, -1);
        $scope.syncTime();
    };

    $scope.syncTime = function() {
        let val = parseInt($scope.timeBuffer) || 0;
        let sec = val % 100;
        let min = Math.floor(val / 100);
        
        if (sec > 59) sec = 59;
        if (min > 8) min = 8;
        
        $scope.minutes = min;
        $scope.seconds = sec;
    };

    $scope.getTimeDisplay = function() {
        let s = $scope.timeBuffer.padStart(4, '0');
        return s.slice(0, 2) + ":" + s.slice(2);
    };

    // Keyboard support for time entry
    document.addEventListener('keydown', function(e) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        
        if (e.key >= '0' && e.key <= '9') {
            $scope.$apply(() => $scope.addTimeDigit(e.key));
        } else if (e.key === 'Backspace') {
            $scope.$apply(() => $scope.backspaceTime());
        } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
            $scope.$apply(() => $scope.clearTime());
        }
    });


    $scope.send = function () {
            playSound(sClick);
            var run = {}
            run.LoPs = $scope.LoPs;
            run.exitBonus = $scope.exitBonus;
            run.rescueOrder = $scope.victim_list;
            run.showedUp = true;
            run.started = true;

            run.tiles = $scope.stiles;
            run.time = {
                minutes: $scope.minutes,
                seconds: $scope.seconds
            };
            run.status = 4;

            $http.put("/api/runs/line/" + runId, run, http_config).then(function (response) {
                $scope.go($scope.getParam('return'));
            }, function (response) {
                console.log("Error: " + response.statusText);
                playSound(sError);
                Swal.fire(
                  'Error',
                  response.statusText,
                  'error'
                );
            });
    };

    $scope.approval = function () {
        playSound(sClick);
        var run = {}

        run.status = 6;

        $http.put("/api/runs/line/" + runId, run, http_config).then(function (response) {
            $scope.go($scope.getParam('return'));
        }, function (response) {
            console.log("Error: " + response.statusText);
            playSound(sError);
            Swal.fire(
              'Error',
              response.statusText,
              'error'
            );
        });
    };

    $scope.cancel = function(){
        $scope.go($scope.getParam('return'));
    }

    $scope.changeExitBonus = function () {
        playSound(sClick);
        $scope.exitBonus = !$scope.exitBonus
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
        window.location = path
    }


    function undefined2false(tmp){
        if(tmp) return true;
        return false;
    }

    var saveContent = [];
    $scope.focused = function (name,i) {
        if(i || i == 0){
            if(!saveContent[name]) saveContent[name] = [];
            saveContent[name][i] = $scope[name][i];
            $scope[name][i] = null;
        }else {
            if($scope[name] >= 0) {
                saveContent[name] = $scope[name];
                $scope[name] = "";
            }
        }
       fEnterChangeTab();
    };

    $scope.blured = function (name,i,flag) {

        if(i || i == 0){
            if($scope[name][i] == null){
                $scope[name][i] = saveContent[name][i];
                if($scope[name][i] == null && flag) {
                    $scope[name].splice(i, 1);
                    moveFocusNumber((i-1)*2+4);
                }
            }else if($scope[name][i] == 0 && flag){
                $scope[name].splice(i, 1);
            }
        }else{
            if($scope[name] == ""){
                if(typeof($scope[name]) == 'number'){
                    console.log("NUMBER");
                }else{
                    $scope[name] = saveContent[name];
                }
            }
        }
        fEnterChangeTab();
    };

    $scope.arriveMark = function (i) {
        if($scope.arrive[i] == null) return saveContent['arrive'][i];
        return $scope.arrive[i];
    }

}]);

function moveFocusNumber(num){
    var oObject = "#inputcontent :input:not(:button):not(:hidden)";
    cNext = ":eq(" + num + ")";
    $(oObject + cNext).focus();
}

function fEnterChangeTab(){
    var oObject = "#inputcontent :input:not(:button):not(:hidden)";
    $(oObject).off("keypress");
    $(oObject).keypress(function(e) {
        var c = e.which ? e.which : e.keyCode;
        if (c == 13) {
            var index = $(oObject).index(this);
            var cNext = "";
            var nLength = $(oObject).length;
            for(i=index;i<nLength;i++){
                cNext = e.shiftKey ? ":lt(" + index + "):last" : ":gt(" + index + "):first";
                if ($(oObject + cNext).attr("readonly") == "readonly") {
                    if (e.shiftKey) index--;
                    else index++;
                }
                else if ($(oObject + cNext).prop("disabled") == true) {
                    if (e.shiftKey) index--;
                    else index++;
                }
                else break;
            }
            if (index == nLength - 1) {
                if (! e.shiftKey){
                    cNext = ":eq(1)";
                }
            }
            if (index == 0) {
                if (e.shiftKey) {
                    cNext = ":eq(" + (nLength - 1) + ")";
                }
            }
            $(oObject + cNext).focus();
            e.preventDefault();
        }
    });
}

if(window.attachEvent){
    window.attachEvent('onload',fEnterChangeTab);
}
else if (window.opera){
    window.addEventListener('load',fEnterChangeTab,false);
}
else {
    window.addEventListener('load',fEnterChangeTab,false);
}

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

var sClick, sInfo, sError, sTimeup;
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
    getAudioBuffer('/sounds/timeup.mp3', function (buffer) {
        sTimeup = buffer;
    });

};
