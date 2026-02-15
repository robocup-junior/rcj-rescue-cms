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

    $scope.victimsList = {
        "H": {
            "image": "H.png",
            "kit": 2
        },
        "S": {
            "image": "S.png",
            "kit": 1
        },
        "U": {
            "image": "U.png",
            "kit": 0
        },
        "Red": {
            "image": "Red.png",
            "kit": 2
        },
        "Yellow": {
            "image": "Yellow.png",
            "kit": 1
        },
        "Green": {
            "image": "Green.png",
            "kit": 0
        }
    };

    $scope.itemList = {
        "H":{
            "linear":[],
            "floating":[]
        },
        "S":{
            "linear":[],
            "floating":[]
        },
        "U":{
            "linear":[],
            "floating":[]
        },
        "Red":{
            "linear":[],
            "floating":[]
        },
        "Yellow":{
            "linear":[],
            "floating":[]
        },
        "Green":{
            "linear":[],
            "floating":[]
        },
        "checkpoint":[],
        "ramp":[],
        "speedbump":[],
        "steps":[],
    };

    var db_cells;

    $http.get("/api/runs/maze/" + runId +
        "?populate=true").then(function (response) {

        console.log(response.data);
        $scope.exitBonus = response.data.exitBonus;
        $scope.field = response.data.field.name;
        $scope.round = response.data.round.name;
        $scope.team = response.data.team;
        $scope.league = response.data.team.league;
        $scope.competition = response.data.competition;
        $scope.LoPs = response.data.LoPs;
        $scope.MisIdent = response.data.misidentification;
        $scope.score = response.data.score;

        // Verified time by timekeeper
        $scope.minutes = response.data.time.minutes;
        $scope.seconds = response.data.time.seconds;

        // Scoring elements of the tiles
        for (let i = 0; i < response.data.tiles.length; i++) {
            $scope.tiles[response.data.tiles[i].x + ',' +
                response.data.tiles[i].y + ',' +
                response.data.tiles[i].z] = response.data.tiles[i];
        }

        let mapId = response.data.map;

        function Range(first, last) {
            var first = first.charCodeAt(0);
            var last = last.charCodeAt(0);
            var result = new Array();
            for(var i = first; i <= last; i++) {
                result.push(String.fromCodePoint(i));
            }
            return result;
        }

        $http.get("/api/maps/maze/" + mapId +
          "?populate=true").then(function (response) {
            console.log(response.data);
            $scope.startTile = response.data.startTile;
            $scope.height = response.data.height;

            $scope.width = response.data.width;
            $scope.length = response.data.length;

            for (let i = 0; i < response.data.cells.length; i++) {
                $scope.cells[response.data.cells[i].x + ',' +
                response.data.cells[i].y + ',' +
                response.data.cells[i].z] = response.data.cells[i];
            }

            db_cells = response.data.cells;

            let map = response.data;
            let cells = $scope.cells;
            let big = Range('A', 'Z');
            let small = Range('α', 'ω');

            for(let j=1,l=map.length*2+1;j<l;j+=2) {
                for (let i = 1, m = map.width * 2 + 1; i < m; i += 2) {
                    for (let k = 0; k < map.height; k++) {
                        if (!cells[`${i},${j},${k}`]) continue
                        let victimLF =  cells[`${i},${j},${k}`].isLinear?"linear":"floating";
                        let victims = cells[`${i},${j},${k}`].tile.victims;
                        let tile = cells[`${i},${j},${k}`].tile;
                        let victimType = "None";

                        victimType = victims.top;
                        if(victimType != "None"){
                            let name;
                            if(victimLF == "linear") name = big[$scope.itemList[victimType][victimLF].length];
                            else name = small[$scope.itemList[victimType][victimLF].length];
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: name,
                                direction: "top"
                            }
                            $scope.itemList[victimType][victimLF].push(tmp);
                        }

                        victimType = victims.left;
                        if(victimType != "None"){
                            let name;
                            if(victimLF == "linear") name = big[$scope.itemList[victimType][victimLF].length];
                            else name = small[$scope.itemList[victimType][victimLF].length];
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: name,
                                direction: "left"
                            }
                            $scope.itemList[victimType][victimLF].push(tmp);
                        }

                        victimType = victims.right;
                        if(victimType != "None"){
                            let name;
                            if(victimLF == "linear") name = big[$scope.itemList[victimType][victimLF].length];
                            else name = small[$scope.itemList[victimType][victimLF].length];
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: name,
                                direction: "right"
                            }
                            $scope.itemList[victimType][victimLF].push(tmp);
                        }

                        victimType = victims.bottom;
                        if(victimType != "None"){
                            let name;
                            if(victimLF == "linear") name = big[$scope.itemList[victimType][victimLF].length];
                            else name = small[$scope.itemList[victimType][victimLF].length];
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: name,
                                direction: "bottom"
                            }
                            $scope.itemList[victimType][victimLF].push(tmp);
                        }

                        if(tile.checkpoint){
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: $scope.itemList.checkpoint.length+1,
                                type: "checkpoint"
                            }
                            $scope.itemList.checkpoint.push(tmp);
                        }

                        if(tile.speedbump){
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: $scope.itemList.speedbump.length+1,
                                type: "speedbump"
                            }
                            $scope.itemList.speedbump.push(tmp);
                        }

                        if(tile.ramp){
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: $scope.itemList.ramp.length+1,
                                type: "ramp"
                            }
                            $scope.itemList.ramp.push(tmp);
                        }

                        if(tile.steps){
                            let tmp = {
                                x: i,
                                y: j,
                                z: k,
                                name: $scope.itemList.steps.length+1,
                                type: "steps"
                            }
                            $scope.itemList.steps.push(tmp);
                        }
                    }
                }
            }
        }, function (response) {
            console.log("Error: " + response.statusText);
        });

    }, function (response) {
        console.log("Error: " + response.statusText);
        if (response.status == 401) {
            $scope.go('/home/access_denied');
        }
    });


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
        }else{
            $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems[item.type] = !$scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems[item.type];
        }
    }

    $scope.setKits = function(item, number){
        playSound(sClick);
        $scope.tiles[item.x + ',' + item.y + ',' + item.z].scoredItems.rescueKits[item.direction] = number;
    }

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
    $scope.focused = function (name) {
        saveContent[name] = $scope[name];
        $scope[name] = "";
    };

    $scope.blured = function (name) {
        console.log($scope[name]);
        if($scope[name] == ""){
            if(typeof($scope[name]) == 'number'){
                console.log("NUMBER");
            }else{
                $scope[name] = saveContent[name];
            }

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