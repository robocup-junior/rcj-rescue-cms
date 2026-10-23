// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http','$translate', '$cookies',function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {


    $scope.runId = runId;
    var date = new Date();

    const http_config = {
        timeout: 10000
    };

    $scope.cells = {};
    $scope.tiles = {};

    const maxKits = {
        'PHI': 2, // Harmed (H)
        'PSI': 1, // Stable (S)
        'OMEGA': 0 // Unharmed (U)
    };

    const cognitiveColorValues = {
        'K': -2,
        'R': -1,
        'Y': 0,
        'G': 1,
        'B': 2
    };

    $scope.itemList = {
        "allVictims": [],
        "checkpoint":[],
        "ramp":[],
        "speedbump":[],
        "steps":[],
        "blue":[],
    };


    var db_cells;

    $http.get("/api/runs/maze/" + runId + "?populate=true").then(function (response) {
        $scope.team = response.data.team;
        $scope.round = response.data.round.name;
        $scope.field = response.data.field.name;
        $scope.competition = response.data.competition;
        $scope.LoPs = response.data.LoPs;
        $scope.MisIdent = response.data.misidentification;
        $scope.exitBonus = response.data.exitBonus;
        $scope.minutes = response.data.time.minutes;
        $scope.seconds = response.data.time.seconds;
        $scope.score = response.data.score;

        for (let i = 0; i < response.data.tiles.length; i++) {
            $scope.tiles[response.data.tiles[i].x + ',' +
                response.data.tiles[i].y + ',' +
                response.data.tiles[i].z] = response.data.tiles[i];
        }

        let mapId = response.data.map._id || response.data.map;

        $http.get("/api/maps/maze/" + mapId + "?populate=true").then(function (response) {
            const cellsMap = {};
            for (const cell of response.data.cells) {
                cellsMap[`${cell.x},${cell.y},${cell.z}`] = cell;
            }
            $scope.cells = cellsMap;

            function Range(first, last) {
                var first = first.charCodeAt(0);
                var last = last.charCodeAt(0);
                var result = new Array();
                for(var i = first; i <= last; i++) {
                    result.push(String.fromCodePoint(i));
                }
                return result;
            }

            let map = response.data;
            let big = Range('A', 'Z');
            let victimAlphabetIndex = 0;

            for(let j=1,l=map.length*2+1;j<l;j+=2) {
                for (let i = 1, m = map.width * 2 + 1; i < m; i += 2) {
                    for (let k = 0; k < map.height; k++) {
                        const coord = `${i},${j},${k}`;
                        if (!cellsMap[coord]) continue;
                        
                        let victims = cellsMap[coord].tile.victims;
                        let tile = cellsMap[coord].tile;
                        let victimPlaces = ['top', 'right', 'bottom', 'left'];
                        
                        for(let vp of victimPlaces) {
                            let victimType = victims[vp];
                            if(victimType && victimType !== "None") {
                                let isDummy = false;
                                if (victimType === 'Cognitive') {
                                    if (tile.cognitiveTargets && tile.cognitiveTargets[vp] && tile.cognitiveTargets[vp].rings) {
                                        let rings = tile.cognitiveTargets[vp].rings;
                                        let total = 0;
                                        for (let r = 1; r <= 5; r++) {
                                            total += cognitiveColorValues[rings[`ring${r}`]] || 0;
                                        }
                                        if (total < 0 || total > 2) isDummy = true;
                                    } else {
                                        isDummy = true;
                                    }
                                }

                                if(!isDummy) {
                                    let name = big[victimAlphabetIndex % 26];
                                    $scope.itemList.allVictims.push({
                                        x: i, y: j, z: k,
                                        name: name,
                                        direction: vp,
                                        type: victimType
                                    });
                                }
                                victimAlphabetIndex++;
                            }
                        }
                        if(tile.checkpoint){
                            $scope.itemList.checkpoint.push({
                                x: i, y: j, z: k,
                                name: $scope.itemList.checkpoint.length + 1,
                                type: 'checkpoint'
                            });
                        }
                        if(tile.speedbump){
                            $scope.itemList.speedbump.push({
                                x: i, y: j, z: k,
                                name: $scope.itemList.speedbump.length + 1,
                                type: 'speedbump'
                            });
                        }
                        if(tile.ramp){
                            $scope.itemList.ramp.push({
                                x: i, y: j, z: k,
                                name: $scope.itemList.ramp.length + 1,
                                type: 'ramp'
                            });
                        }
                        if(tile.steps){
                            $scope.itemList.steps.push({
                                x: i, y: j, z: k,
                                name: $scope.itemList.steps.length + 1,
                                type: 'steps'
                            });
                        }
                        if(tile.blue){
                            $scope.itemList.blue.push({
                                x: i, y: j, z: k,
                                name: $scope.itemList.blue.length + 1,
                                type: 'blue'
                            });
                        }
                    }
                }
            }
        });
    }, function (response) {
        console.log("Error: " + response.statusText);
        if (response.status == 401) {
            $scope.go('/home/access_denied');
        }
    });


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
        return (maxKits[type] || 0);
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

    $scope.getModalCognitiveImage = function (cell, direction) {
        if (!cell || !cell.tile || !cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return '';
        let rings = cell.tile.cognitiveTargets[direction].rings;
        return `/images/cognitive_targets/${rings.ring1}${rings.ring2}${rings.ring3}${rings.ring4}${rings.ring5}.png`;
    };

    $scope.range = function (n) {
        arr = [];
        for (let i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    $scope.clearStatus = function(item){
        if (!$scope.tiles[item.x + ',' + item.y + ',' + item.z]) {
            $scope.tiles[item.x + ',' + item.y + ',' + item.z] = {
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
            return false;
        }
        if(item.direction){//Victims
            return $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.victims[item.direction];
        }else if(item.type == 'blue'){
            return $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.blue > 0;
        }else{
            return $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems[item.type];
        }
    }

    $scope.kitStatus = function(item,number){
        if (!$scope.tiles[item.x + ',' + item.y + ',' + item.z]) {
            $scope.tiles[item.x + ',' + item.y + ',' + item.z] = {
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
            return false;
        }else{
            return $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.rescueKits[item.direction] >= number;
        }
    }

    $scope.toggleScored = function(item){
        playSound(sClick);
        if(item.direction) {//Victims
            $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.victims[item.direction] = !$scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.victims[item.direction];
        }else if(item.type == 'blue'){
            // No toggle for blue tiles now, just use stepper

        }else{
            $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems[item.type] = !$scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems[item.type];
        }
    }

    $scope.setKits = function(item, number){
        playSound(sClick);
        $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.rescueKits[item.direction] = number;
    }

    $scope.timeBuffer = "";
    
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
        let run = {};

        run.exitBonus = $scope.exitBonus;
        run.LoPs = $scope.LoPs;
        run.misidentification = $scope.MisIdent;

        // Scoring elements of the tiles
        run.tiles = $scope.tiles;

        // Verified time by timekeeper
        if($scope.minutes > 8 || $scope.seconds >= 60){
            playSound(sError);
            Swal.fire(
              'Error',
              'Please check time is correct!',
              'error'
            );
            return;
        }
        run.time = {};
        run.time.minutes = $scope.minutes;;
        run.time.seconds = $scope.seconds;
        run.status = 4;



        $http.put("/api/runs/maze/" + runId, run).then(function (response) {
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

        $http.put("/api/runs/maze/" + runId, run, http_config).then(function (response) {
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
    };

    $scope.go = function (path) {
        playSound(sClick);
        window.location = path
    };

    var saveContent = [];
    $scope.focused = function (name, event) {
        if (event && event.target) {
            event.target.select();
        }
    };

    $scope.blured = function (name) {
        if ($scope[name] === null || $scope[name] === undefined || $scope[name] === "") {
            $scope[name] = 0;
        }
    };

    $scope.changeExitBonus = function () {
        playSound(sClick);
        $scope.exitBonus = ! $scope.exitBonus
        upload_run({
            exitBonus: $scope.exitBonus
        });
    }

    function  checkNull(val) {
        if(val) return val;
        return 0;
    }

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

function fEnterChangeTab(){
    var oObject = "#inputcontent :input:not(:button):not(:hidden)";

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