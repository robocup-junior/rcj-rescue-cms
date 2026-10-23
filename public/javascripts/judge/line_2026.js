/*********************************************************************************/
// This file is a RoboCup Junior Rescue 2024 rule correspondence version. //
/*********************************************************************************/
// register the directive with your app module

var app = angular.module('ddApp', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};
var txt_multi;
var txt_gap;
var txt_obstacle;
var txt_ramp;
var txt_intersection;
var txt_bump;
var txt_checkpoint;

// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http', '$translate', '$cookies', function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {

  var db_mtile;
  var txt_score_element, txt_not_yet, txt_timeup, txt_timeup_mes, txt_lops, txt_lops_mes, txt_cantvisit, txt_start,
    txt_implicit;
  $translate('line.judge.js.score_element').then(function (val) {
    txt_score_element = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.not_yet').then(function (val) {
    txt_not_yet = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.timeup.title').then(function (val) {
    txt_timeup = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.timeup.content').then(function (val) {
    txt_timeup_mes = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.lops.title').then(function (val) {
    txt_lops = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.lops.content').then(function (val) {
    txt_lops_mes = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.cantvisit').then(function (val) {
    txt_cantvisit = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.start').then(function (val) {
    txt_start = val;
  }, function (translationId) {
    // = translationId;
  });
  $translate('line.judge.js.implicit').then(function (val) {
    txt_implicit = val;
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
  $translate('line.judge.js.checkpoint').then(function (val) {
    txt_checkpoint = val;
  }, function (translationId) {
    // = translationId;
  });


  $scope.sync = 0;
  $scope.runIds = runId.split(',');
  $scope.runNum = $scope.runIds.length;
  $scope.nowRun = 0;

  function setRunId(index){
    $scope.runId = $scope.runIds[index];
    runId = $scope.runIds[index];
    $scope.nowRun = index;

    $scope.z = 0;
    
    $scope.startedTime = false;
    $scope.time = 0;
    $scope.startUnixTime = 0;
    $scope.EvacuationAreaLoPIndex = 0;


    $scope.victim_list = [];
    $scope.victim_tmp = [];
    $scope.LoPs = [];
    $scope.victimNL_Dead = [];
    $scope.victimNL_Live = [];

    $scope.checkTeam = $scope.checkRound = $scope.checkMember = $scope.checkMachine = false;
    loadNewRun();
    $(window).scrollTop(0);
  }
  

  
  $scope.toggleCheckTeam = function () {
    $scope.checkTeam = !$scope.checkTeam;
    playSound(sClick);
  };
  $scope.toggleCheckRound = function () {
    $scope.checkRound = !$scope.checkRound;
    playSound(sClick);
  };
  $scope.toggleCheckMember = function () {
    $scope.checkMember = !$scope.checkMember;
    playSound(sClick);
  };
  $scope.toggleCheckMachine = function () {
    $scope.checkMachine = !$scope.checkMachine;
    playSound(sClick);
  };
  $scope.checks = function () {
    return ($scope.checkTeam & $scope.checkRound & $scope.checkMember & $scope.checkMachine)
  };

  const http_config = {
    timeout: 10000
  };

  function upload_run(data) {
    if ($scope.networkError) {
      $scope.saveEverything();
      return;
    }

    $scope.sync++;
    $http.put("/api/runs/line/" + runId, Object.assign(data, {
      time: {
        minutes: Math.floor($scope.time / 60000),
        seconds: Math.floor(($scope.time % 60000) / 1000)
      }
    }), http_config).then(function (response) {
      if(response.statusCode == 202){
        setTimeout($scope.upload_run, 100, data);
        return;
      }
      $scope.sync--;
      $scope.score = response.data.score;
    }, function (response) {
      if (response.status == 401) {
        $scope.go('/home/access_denied');
      }
      $scope.networkError = true;
    });

  }

  var date = new Date();
  var prevTime = 0;

  if ($cookies.get('sRotate')) {
    $scope.sRotate = Number($cookies.get('sRotate'));
  } else $scope.sRotate = 0;


  // Scoring elements of the tiles
  $scope.stiles = [];
  // Map (images etc.) for the tiles
  $scope.mtiles = [];

  if (document.referrer.indexOf('sign') != -1) {
    $scope.checked = true;
    $scope.fromSign = true;
    $timeout($scope.tile_size, 10);
    $timeout($scope.tile_size, 200);
  } else {

  }

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
  

  function loadNewRun() {
    $http.get("/api/runs/line/" + runId + "?populate=true").then(function (response) {
      $scope.LoPs = response.data.LoPs;
      
      $scope.exitBonus = response.data.exitBonus;
      $scope.field = response.data.field.name;
      $scope.score = response.data.score;
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
      $scope.status = response.data.status;

      prevTime = $scope.time;

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
      $http.get("/api/maps/line/" + response.data.map + "?populate=true").then(function (response) {
        console.log(response);
        $scope.height = response.data.height;

        $scope.width = response.data.width;
        $scope.length = response.data.length;
        $scope.duration = response.data.duration || 480;
        width = response.data.width;
        length = response.data.length;
        $scope.startTile = response.data.startTile;
        $scope.startTile2 = response.data.startTile2;
        //$scope.numberOfDropTiles = response.data.numberOfDropTiles;
        $scope.mtiles = {};

        // Get max victim count
        $scope.maxLiveVictims = response.data.victims.live;
        $scope.maxDeadVictims = response.data.victims.dead;


        $scope.mapIndexCount = response.data.indexCount;
        if($scope.maxLiveVictims == 0 && $scope.maxDeadVictims == 0){
          $scope.EvacuationAreaLoPIndex = -1;
        }else{
          $scope.EvacuationAreaLoPIndex = response.data.EvacuationAreaLoPIndex;
        }

        db_mtile = response.data.tiles;
        for (var i = 0; i < response.data.tiles.length; i++) {
          $scope.mtiles[response.data.tiles[i].x + ',' +
          response.data.tiles[i].y + ',' +
          response.data.tiles[i].z] = response.data.tiles[i];
        }

        $timeout($scope.tile_size, 0);
        $timeout($scope.tile_size, 500);
        //$timeout($scope.tile_size, 1000);
        $timeout($scope.tile_size, 1500);
        $timeout($scope.tile_size, 3000);


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

  setRunId(0);

  $scope.range = function (n) {
    arr = [];
    for (var i = 0; i < n; i++) {
      arr.push(i);
    }
    return arr;
  };

  $scope.TimeReset = function () {
    playSound(sClick);
    prevTime = 0;
    $scope.time = 0;
    $scope.saveEverything();
  };

  $scope.infochecked = function () {
    playSound(sClick);
    $scope.checked = true;
    //$timeout($scope.tile_size, 10);
    $timeout($scope.tile_size, 200);
    $timeout($scope.tile_size, 2000);
    scrollTo(0, 0);
  };

  $scope.changeFloor = function (z) {
    playSound(sClick);
    $scope.z = z;
    $timeout($scope.tile_size, 100);
    $timeout($scope.tile_size, 2000);
  };

  $scope.tileRot = function (r) {
    playSound(sClick);
    $scope.sRotate += r;
    if ($scope.sRotate >= 360) $scope.sRotate -= 360;
    else if ($scope.sRotate < 0) $scope.sRotate += 360;
    $timeout($scope.tile_size, 0);

    $cookies.put('sRotate', $scope.sRotate, {
      path: '/'
    });
  };

  $scope.decrement = function (index) {
    playSound(sClick);
    if ($scope.LoPs[index])
      $scope.LoPs[index]--;
    else
      $scope.LoPs[index] = 0;
    if ($scope.LoPs[index] < 0)
      $scope.LoPs[index] = 0;

    upload_run({
      LoPs: $scope.LoPs
    });
  };
  $scope.increment = function (index, last) {
    playSound(sClick);
    if ($scope.LoPs[index])
      $scope.LoPs[index]++;
    else
      $scope.LoPs[index] = 1;

    upload_run({
      LoPs: $scope.LoPs
    });
    if ($scope.LoPs[index] >= 3 && !last) {
      playSound(sInfo);
      swal(txt_lops, txt_lops_mes, "info");
    }

  };

  $scope.calc_victim_type_lop_multiplier = function (lop=-1){
    if(lop == -1) lop = $scope.LoPs[$scope.EvacuationAreaLoPIndex];

    let multiplier = Math.max(1400 - 50*lop, 1250);
    return multiplier/1000;
  };

  $scope.calc_victim_multipliers = function (index){
    let victim = $scope.victim_list[index];
    if (victim == undefined) return 0;

    // Effective check
    if(victim.victimType == "LIVE" && victim.zoneType == "RED") return 1.0;
    if(victim.victimType == "DEAD" && victim.zoneType == "GREEN") return 1.0;

    // Effective check for dead victim
    if (victim.victimType == "DEAD") {
      let liveCount = 0;
      for (i of $scope.range(index)) {
        let v = $scope.victim_list[i]
        if (v.victimType == "LIVE") liveCount ++;
      }
      if (liveCount != $scope.maxLiveVictims) return 1.0;
    }
    
    return $scope.calc_victim_type_lop_multiplier($scope.LoPs[$scope.EvacuationAreaLoPIndex]);    
  };

  $scope.victim_bk_color = function (index, zoneType) {
    let m = $scope.calc_victim_multipliers(index);
    if (m == 0 || zoneType != $scope.victim_list[index].zoneType) return '#fff';
    if (m == 1) return '#ccc';
    if (zoneType == "RED") return '#ffc1ff';
    return '#e0ffc1';
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
    console.log(tmp);
  };

  $scope.delete_victim = function (index) {
    playSound(sClick);
    $scope.victim_list.splice(index, 1);

    upload_run({
      rescueOrder: $scope.victim_list
    });

  };
  $scope.delete_victim_tmp = function (index) {
    playSound(sClick);
    $scope.victim_tmp.splice(index, 1);
  };

  $scope.victimRegist = function (zoneType) {
    playSound(sClick);
    let live = 0;
    let dead = 0;
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

    upload_run({
      rescueOrder: $scope.victim_list
    });
  };

  $scope.victim_tmp_clear = function () {
    playSound(sClick);
    $scope.victim_tmp = [];
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
  };


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
  };


  $scope.changeShowedUp = function () {
    playSound(sClick);

    upload_run({
      showedUp: $scope.showedUp
    });


  };
  $scope.changeExitBonus = function () {
    playSound(sClick);
    $scope.exitBonus = !$scope.exitBonus;
    if ($scope.exitBonus && $scope.startedTime) {
      $scope.startedTime = false;
      date = new Date();
      $scope.time = prevTime + (date.getTime() - $scope.startUnixTime);
      prevTime = $scope.time;
      $scope.minutes = Math.floor($scope.time / 60000);
      $scope.seconds = Math.floor(($scope.time % 60000) / 1000)
    }

    $scope.saveEverything();
  };

  function findItem(item,tile) {
    for(let i=0;i<tile.length;i++){
        if(tile[i].item == item) return i;
    }
    return null;
  }

  $scope.isCheckPoint = function(tile) {
    return findItem("checkpoint", tile.scoredItems) != null;
  }

  $scope.doScoring = function (x, y, z) {
    var mtile = $scope.mtiles[x + ',' + y + ',' + z];
    var stile = [];
    var stileIndex = [];
    var isCheckpointTile = false;
    var httpdata = {
      tiles: {}
    };

    // If this is not a created tile
    if (!mtile || mtile.index.length == 0)
      return;
    playSound(sClick);
    for (var i = 0; i < mtile.index.length; i++) {
      stile.push($scope.stiles[mtile.index[i]]);
      stileIndex.push(mtile.index[i]);
      if ($scope.isCheckPoint($scope.stiles[mtile.index[i]])) {
        isCheckpointTile = true;
      }
    }


    // If the run is started, allow to score a point
    if ($scope.time > 0) {
      var total = (mtile.items.obstacles > 0 ||
        mtile.items.speedbumps > 0 ||
        mtile.tileType.gaps > 0 ||
        mtile.tileType.intersections > 0 ||
        mtile.tileType.seesaw > 0 ||
        undefined2false(mtile.items.rampPoints)) * mtile.index.length;

      // Add the number of possible passes for drop tiles
      if (isCheckpointTile) {
        total = 0;
        for (let i = 0; i < stile.length; i++) {
          if (stileIndex[i] < $scope.mapIndexCount) {
            total++;
          }
        }
      }


      if (isStart(mtile)) {
        $scope.showedUp = !$scope.showedUp;
        $scope.changeShowedUp();
        return;
      }


      if (total > 1) {
        // Show modal
        $scope.open(x, y, z);
        // Save data from modal when closing it
      } else if (total == 1) {
        console.log(stile);
        for(let i=0;i<stile[0].scoredItems.length;i++) {
          stile[0].scoredItems[i].scored = !stile[0].scoredItems[i].scored;
        }
        httpdata.tiles[mtile.index[0]] = stile[0];
        $scope.stiles[mtile.index[0]] = stile[0];
        upload_run(httpdata);
      }
    }
  };


  $scope.open = function (x, y, z) {
    var modalInstance = $uibModal.open({
      animation: true,
      templateUrl: '/templates/line_judge_modal.html',
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
          var nine = [];
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
        startTile2: function(){
            return $scope.startTile2;
        },
        isCheckPoint: function () {
          return $scope.isCheckPoint;
        }
      }
    }).closed.then(function (result) {
      console.log("Closed modal");
      upload_run({
        tiles: $scope.stiles
      });
    });
  };

  $scope.saveEverything = function () {
    var run = {};
    run.LoPs = $scope.LoPs;
    run.exitBonus = $scope.exitBonus;
    run.rescueOrder = $scope.victim_list;
    run.showedUp = $scope.showedUp;
    run.started = $scope.started;
    run.tiles = $scope.stiles;
    $scope.minutes = Math.floor($scope.time / 60000);
    $scope.seconds = Math.floor(($scope.time % 60000) / 1000);
    run.time = {
      minutes: $scope.minutes,
      seconds: $scope.seconds
    };
    $scope.sync++;
    $http.put("/api/runs/line/" + runId, run, http_config).then(function (response) {
      if(response.statusCode == 202){
        setTimeout($scope.saveEverything, 100);
        return;
      }
      $scope.score = response.data.score;
      $scope.networkError = false;
      $scope.sync = 0;
    }, function (response) {
      console.log("Error: " + response.statusText);
      $scope.networkError = true;
    });
    //console.log("Update run", run);


  };

  $scope.confirm = function () {
    if ((!$scope.showedUp || $scope.showedUp == null) && $scope.score > 0) {
      playSound(sError);
      swal("Oops!", txt_implicit, "error");
    } else {
      playSound(sClick);
      var run = {};
      run.LoPs = $scope.LoPs;
      run.exitBonus = $scope.exitBonus;
      run.rescueOrder = $scope.victim_list;
      run.showedUp = $scope.showedUp;
      run.started = $scope.started;
      run.tiles = $scope.stiles;
      run.time = {
        minutes: $scope.minutes,
        seconds: $scope.seconds
      };
      run.status = 3;


      $scope.sync++;
      $http.put("/api/runs/line/" + runId, run, http_config).then(function (response) {
        if(response.statusCode == 202){
          setTimeout($scope.confirm, 100);
          return;
        }
        $scope.score = response.data.score;
        $scope.sync--;
        $scope.go('/line/sign/' + runId + '?return=' + $scope.getParam('return'));
      }, function (response) {
        console.log("Error: " + response.statusText);
        $scope.networkError = true;
      });
    }
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
  };

  $scope.go = function (path) {
    playSound(sClick);
    window.location = path
  };

  function isStart(tile) {
    if (!tile)
      return;
    return tile.x == $scope.startTile.x &&
      tile.y == $scope.startTile.y &&
      tile.z == $scope.startTile.z;
  }

  function undefined2false(tmp) {
    if (tmp) return true;
    return false;
  }

  $scope.tile_size = function () {
    try {
      var b = $('.tilearea');
      //console.log('コンテンツ本体：' + b.height() + '×' + b.width());
      //console.log('window：' + window.innerHeight);
      if ($scope.sRotate % 180 == 0) {
        var tilesize_w = ($('.tilearea').width() - 2 * width) / width;
        var tilesize_h = (window.innerHeight - 130) / length;
      } else {
        var tilesize_w = ($('.tilearea').width() - 2 * length) / length;
        var tilesize_h = (window.innerHeight - 130) / width;
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

      if ($scope.sRotate % 180 == 0) {
        $('#wrapTile').css('width', (tilesize + 3) * width);
      } else {
        $('#wrapTile').css('width', (tilesize + 3) * length);
      }

      if(movie){
        $('#card_area').css('height', (window.innerHeight - 130 - $('#video_area').height()));
      }else{
        $('#card_area').css('height', (window.innerHeight - 130));
      }
      
      //if (b.height() == 0) $timeout($scope.tile_size, 500);
    } catch (e) {
      $timeout($scope.tile_size, 500);
    }
  };

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

app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', '$timeout', 'mtile', 'mtiles', 'stiles', 'nineTile', 'sRotate', 'startTile', 'startTile2', 'isCheckPoint', function ($scope, $uibModalInstance, $timeout, mtile, mtiles, stiles, nineTile, sRotate, startTile, startTile2, isCheckPoint) {
  $scope.mtile = mtile;
  $scope.sRotate = sRotate;
  $scope.stiles = stiles;
  $scope.nineTile = nineTile;
  $scope.isCheckPoint = isCheckPoint;
  $scope.words = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
  $scope.evacTapeRot = function (tile) {
    let rot = 0;
    if(tile.evacEntrance>=0){
        rot = tile.evacEntrance;
    }else if(tile.evacExit>=0){
        rot = tile.evacExit;
    }                
    rot += sRotate;
    return rot%360;
  }
  function dir2num(dir){
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
  for(let i in mtile.next_dir){
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
    var possible = 0;
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
  };

  $scope.toggle_scored = function (num) {
    playSound(sClick);
    try {
      for(let i=0;i<$scope.stiles[num].scoredItems.length;i++) {
        $scope.stiles[num].scoredItems[i].scored = !$scope.stiles[num].scoredItems[i].scored;
      }
      $timeout($uibModalInstance.close, 300);
    } catch (e) {
      console.log(e);
    }

  };


  $scope.tilerotate = function (tilerot) {
    //console.log(tilerot);
    if (!tilerot) return $scope.sRotate;
    var ro = tilerot + $scope.sRotate;
    if (ro >= 360) ro -= 360;
    else if (ro < 0) ro += 360;
    //console.log(ro);
    return ro;
  };

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
  };

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
  };

  $scope.ok = function () {
    playSound(sClick);
    $uibModalInstance.close();
  };
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
      };
      $scope.tileNumber = function (tile) {
        $scope.tileN = 1;
        var ret_txt = "";
        if (!tile) return;

        var possible = 0;

        var count = function (list) {
          for (var i = 0; i < list.length; i++) {
            possible++;
          }
        };
        count(tile.scoredItems.gaps);
        count(tile.scoredItems.seesaw);
        count(tile.scoredItems.speedbumps);
        count(tile.scoredItems.intersections);
        count(tile.scoredItems.obstacles);
        if (possible != 0) return;

        for (var i = 0; i < tile.index.length; i++) {
          if (i != 0) ret_txt += ',';
          ret_txt += tile.index[i] + 1;
        }
        return ret_txt;
      };

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
        return isStart(tile);
      };

      $scope.evacTapeRot = function (tile) {
        let rot = 0;
        if(tile.evacEntrance>=0){
            rot = tile.evacEntrance;
        }else if(tile.evacExit>=0){
            rot = tile.evacExit;
        }                
        rot += $scope.$parent.sRotate;
        return rot%360;
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
      };

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