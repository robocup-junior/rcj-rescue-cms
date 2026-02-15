// register the directive with your app module
var app = angular.module('ddApp', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};
var socket;

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

    $scope.enableSign = [false,false,false];
    $scope.signData = [null,null,null];

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
                $scope.score = data.score;
                // Verified time by timekeeper
                $scope.minutes = data.time.minutes;
                $scope.seconds = data.time.seconds;

                $scope.$apply();
                console.log("Updated view from socket.io");
            });
        }

    })();

    function loadNewRun() {
        $http.get("/api/runs/simulation/" + runId +
            "?normalized=true").then(function (response) {
            $scope.field = response.data.field.name;
            $scope.round = response.data.round.name;
            $scope.score = response.data.score;
            $scope.team = response.data.team.name;
            $scope.league = response.data.team.league;
            $scope.competition = response.data.competition.name;
            $scope.competition_id = response.data.competition._id;

            // Verified time by timekeeper
            $scope.minutes = response.data.time.minutes;
            $scope.seconds = response.data.time.seconds;

            if(response.data.sign){
                $scope.cap_sig = response.data.sign.captain;
                $scope.ref_sig = response.data.sign.referee;
                $scope.refas_sig = response.data.sign.referee_as;
            }

            $scope.comment = response.data.comment;
        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go(`/home/access_denied?iframe=${iframe}`);
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


    $scope.isUndefined = function (thing) {
        return (typeof thing === "undefined");
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
        socket.emit('subscribe', 'runs/map/' + runId);
        window.location = path
    }


    $scope.success_message = function () {
        playSound(sInfo);
        swal({
            title: 'Recorded!',
            text: txt_complete,
            type: 'success'
        }).then((result) => {
            if (result.value) {
                if($scope.getParam('return')) $scope.go($scope.getParam('return'));
                else $scope.go("/simulation/" + $scope.competition_id + "/" + $scope.league);
            }
        })
        console.log("Success!!");
    }

    $scope.toggleSign = function(index){
        $scope.enableSign[index] = !$scope.enableSign[index];
        if(!$scope.enableSign[index]){
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
        }else{
            if(!$scope.signData[index]) setTimeout(initSign,100,index);
        }
    }

    function initSign(index){
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

    $scope.clearSign = function(index){
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
                run.status = 4;
                $http.put("/api/runs/simulation/" + runId, run).then(function (response) {
                    setTimeout($scope.success_message, 500);
                }, function (response) {
                    playSound(sError);
                    swal("Oops", "We couldn't connect to the server! Please notice to system manager.", "error");
                    console.log("Error: " + response.statusText);
                });
            }

        })


    }

    $scope.wallColor = function(x,y,z,rotate=0){
        let cell = $scope.cells[x+','+y+','+z];
        if(!cell) return {};
        if(cell.isWall) return cell.isLinear?{'background-color': 'black'}:{'background-color': 'navy'};

        if(cell.halfWall > 0){
            let direction = 180*(cell.halfWall-1)+(y%2==1?0:90);

            //Wall color
            let color = 'navy';
            switch (direction) {
                case 0:
                    if(wallCheck($scope.cells[(x-1)+','+(y+1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x+1)+','+(y+1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x)+','+(y+2)+','+z])) color = 'black';
                    break;
                case 90:
                    if(wallCheck($scope.cells[(x-1)+','+(y+1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x-1)+','+(y-1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x-2)+','+(y)+','+z])) color = 'black';
                    break;
                case 180:
                    if(wallCheck($scope.cells[(x-1)+','+(y-1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x+1)+','+(y-1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x)+','+(y-2)+','+z])) color = 'black';
                    break;
                case 270:
                    if(wallCheck($scope.cells[(x+1)+','+(y+1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x+1)+','+(y-1)+','+z])) color = 'black';
                    if(wallCheck($scope.cells[(x+2)+','+(y)+','+z])) color = 'black';
                    break;
            }

            direction += rotate;
            if(direction>=360) direction-=360;

            let gradient = String(direction) + "deg," + color + " 0%," + color + " 50%,white 50%,white 100%";
            return {'background': 'linear-gradient(' + gradient + ')'};

        }

    };

    function wallCheck(cell){
        if(!cell) return false;
        return cell.isWall && cell.isLinear;
    }

    $scope.tile_size = function () {
        try {
            var b = $('.tilearea');

            if($scope.sRotate%180 == 0){
                var tilesize_w = (b.width()-2*(width+1)) / (width+1 + (width+1)/12);
                var tilesize_h = (window.innerHeight - 130) /(length + length/12*(length+1));
            }else{
                var tilesize_w = (b.width() - (20 + 11 * (length + 1))) / length;
                var tilesize_h = (window.innerHeight - (130 + 11 * (width + 1))) /width;
            }


            if (tilesize_h > tilesize_w) var tilesize = tilesize_w;
            else var tilesize = tilesize_h;

            $('.tile-image-container').css('height', tilesize);
            $('.tile-image-container').css('width', tilesize);
            $('.tile-image').css('height', tilesize);
            $('.tile-image').css('width', tilesize);
            $('.tile').css('height', tilesize);
            $('.tile').css('width', tilesize);
            $('.tile-font').css('font-size', tilesize - 10);
            $('.cell').css('padding', tilesize/12);
            $('.tile-point').css('font-size', tilesize/2 + "px");
            $('.tile-point').css('line-height', tilesize + "px");
            if (b.height() == 0) $timeout($scope.tile_size, 500);

            if($scope.sRotate%180 == 0){
                $('#wrapTile').css('width', (tilesize+10)*width+11);
            }else{
                $('#wrapTile').css('width', (tilesize+10)*length+11);
            }
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
    $timeout($scope.tile_size, 500);
    $timeout($scope.tile_size, 3000);

});

    }]);


app.controller('ModalInstanceCtrl', ['$scope','$uibModalInstance','cell','tile','sRotate','leagueType',function ($scope, $uibModalInstance, cell, tile, sRotate, leagueType) {
    $scope.cell = cell;
    $scope.tile = tile;
    $scope.leagueType = leagueType;
    $scope.hasVictims = (cell.tile.victims.top != "None") ||
        (cell.tile.victims.right != "None") ||
        (cell.tile.victims.bottom != "None") ||
        (cell.tile.victims.left != "None") ||
        (cell.tile.victims.floor != "None");

    $scope.lightStatus = function(light, kit){
        if(light) return true;
        return false;
    };

    $scope.kitStatus = function(light, kit, type){
        return (victimConstant[type].maxKitNum <= kit);
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


function sum(array) {
    if (array.length == 0) return 0;
    return array.reduce(function(a,b){
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

var sClick,sInfo,sError;
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
};
