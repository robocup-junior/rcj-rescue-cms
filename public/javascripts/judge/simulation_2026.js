// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
let maxKit={};

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

    var date = new Date();
    var prevTime = 0;

    $scope.checkTeam = $scope.checkRound = $scope.checkMember = false;
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

    $scope.checks = function(){
        return ($scope.checkTeam & $scope.checkRound & $scope.checkMember)
    }

    const http_config = {
        timeout: 10000
    };

    function upload_run(data) {
        if ($scope.networkError) {
            $scope.saveEverything();
        }

        $scope.sync++;
        $http.put("/api/runs/simulation/" + runId, Object.assign(data, {
            time: {
                minutes: Math.floor($scope.time / 60000),
                seconds: Math.floor(($scope.time % 60000) / 1000)
            }
        }), http_config).then(function (response) {
            console.log(response);
            //$scope.score = response.data.score;
            $scope.sync--;
        }, function (response) {
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
            $scope.networkError = true;
        });

    }


    $scope.startedScoring = false;

    loadNewRun();

    function loadNewRun(){
        $http.get("/api/runs/simulation/" + runId +
        "?populate=true").then(function (response) {
            $scope.score = response.data.score;
            $scope.team = response.data.team;
            $scope.league = response.data.team.league;
            $scope.competition = response.data.competition;
            $scope.round = response.data.round.name;
            $scope.field = response.data.field.name;

            // Verified time by timekeeper
            $scope.minutes = response.data.time.minutes;
            $scope.seconds = response.data.time.seconds;
            $scope.time = ($scope.minutes * 60 + $scope.seconds)*1000;
            prevTime = $scope.time;

            if (document.referrer.indexOf('sign') != -1) {
                $scope.checked = true;
                $timeout($scope.tile_size, 10);
                $timeout($scope.tile_size, 200);
            }
        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
        });
    }


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

    var tick = function () {
        if ($scope.startedTime) {
            date = new Date();
            $scope.time = prevTime + (date.getTime() - $scope.startUnixTime);
            $scope.minutes = Math.floor($scope.time / 60000);
            $scope.seconds = Math.floor(($scope.time % 60000) / 1000);
            if ($scope.time >= 600*1000) {
                playSound(sTimeup);
                $scope.startedTime = !$scope.startedTime;
                $scope.time = 600*1000;
                $scope.saveEverything();
                swal(txt_timeup, '', "info");
            }
            $timeout(tick, 1000);
        }
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


    $scope.isUndefined = function (thing) {
        return (typeof thing === "undefined");
    }

    $scope.saveEverything = function () {
        $scope.minutes = Math.floor($scope.time / 60000)
        $scope.seconds = Math.floor(($scope.time % 60000) / 1000)

        var run = {
            score: $scope.score,
            time: {
                minutes: $scope.minutes,
                seconds: $scope.seconds
            }
        };        

        $http.put("/api/runs/simulation/" + runId, run, http_config).then(function (response) {
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
        var run = {
            score: $scope.score,
            time: {
                minutes: $scope.minutes,
                seconds: $scope.seconds
            },
            status: 3
        }

        $http.put("/api/runs/simulation/" + runId, run).then(function (response) {
            $scope.score = response.data.score;
            $scope.go('/simulation/sign/' + runId + '?return=' + $scope.getParam('return'));
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
