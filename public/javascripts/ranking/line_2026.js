var socket;

var app = angular.module("LineScore", ['ngTouch','datatables', 'ui.bootstrap', 'ngAnimate', 'pascalprecht.translate', 'ngCookies','ngSanitize']);
app.controller("LineScoreController", ['$scope', '$http', '$sce', '$translate', function ($scope, $http, $sce, $translate) {
    $scope.competitionId = competitionId

    $scope.showTeam = true;

    $scope.go = function (path) {
        window.location = path
    }

    var runListTimer = null;
    var runListChanged = false;
    $scope.nowR = 4;
    $scope.showFrom = 0;
    $scope.time = 10;
    var inter;
    launchSocketIo()
    getRankInfo()

    $scope.comment = [];
    $scope.comment.bottom = "The scores are based on the sum of all the run (the minimum score is not subtracted yet).";

    const currentLang = $translate.proposedLanguage() || $translate.use();
    $scope.displayLang = currentLang;

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data;
        $scope.league = response.data.leagues.find((l) => l.league == leagueId);
        $scope.comment.top = $scope.league.name;
    })

    function updateTime(){
        $scope.time--;
        if($scope.time == 0){
            if ($scope.showFrom == 0) {
                window.parent.iframeEnd();
                clearInterval(inter);
            } else {
                $scope.showFrom -= 6;
                if ($scope.showFrom < 0) $scope.showFrom = 0;
                $scope.time = 10;
            }
        }
        $scope.$apply();
    }
    
    $scope.startSig = function(){
        inter = setInterval(updateTime, 1000);
    }

    function getRankInfo(callback) {
        $http.get(`/api/ranking/${competitionId}/${leagueId}`).then(function (response) {
            var rankingInfo = response.data;
            $scope.documentBlock = response.data.documentBlockTitles;
            $scope.ranking = rankingInfo.ranking;
            $scope.runGroups = rankingInfo.runGroups;
            
            $scope.showMode = rankingInfo.modeDetails;
            $scope.showMode.teamCode = $scope.ranking.some(t => t.team.teamCode);

            $scope.maxGameNum = $scope.runGroups.length;

            if (callback != null && callback.constructor == Function) {
                callback()
            }
            var now = new Date();
            $scope.updateTime = now.toLocaleString();
            if ($scope.ranking.length >= 4) {
                $scope.showFrom = Math.floor(($scope.ranking.length - 4) / 6) * 6 + 3;
            } else {
                $scope.showFrom = 0;
            }
        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go(`/home/access_denied`);
            }
        });
    }


    function timerUpdateRunList() {
        if (runListChanged) {
            getRankInfo();
            runListChanged = false;
            runListTimer = setTimeout(timerUpdateRunList, 1000 * 15);
        } else {
            runListTimer = null
        }
    }

    function launchSocketIo() {
        // launch socket.io
        socket = io({
            transports: ['websocket']
        }).connect(window.location.origin)
        socket.on('connect', function () {
            socket.emit('subscribe', `runs/line/${competitionId}`)
        })
        socket.on('changed', function () {
            runListChanged = true;
            if (runListTimer == null) {
                getRankInfo();
                runListChanged = false;
                runListTimer = setTimeout(timerUpdateRunList, 1000 * 15)
            }
        })
    }

    $scope.langContent = function(data, target){
        data[target] = $sce.trustAsHtml(data.filter( function( value ) {
            return value.language == $scope.displayLang;
        })[0][target]);

        return(data[target]);
    }

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    $scope.openRunDetails = function(id) {
        if (id) {
            Swal.fire({
                title: ``,
                html: `<iframe src="/line/view/${id}?iframe=true" style="margin-top:10px; border: none; width:100%; height: calc(100vh - 100px);"/>`,
                showCloseButton: true,
                showConfirmButton: false,
                width: '95%'
              })
        }
    }

    $scope.victimImgPath = function(victim) {
        switch(victim.victimType) {
            case 'LIVE':
                return 'liveVictim.png';
            case 'DEAD':
                return 'deadVictim.png';
            case 'KIT':
                return 'rescueKit.png';
        }
    }

    $scope.evacZoneColor = function(victim) {
        switch(victim.zoneType) {
            case 'GREEN':
                return "#d6ffd6";
            case 'RED':
                return "#ffd6d6";
        }
    }
}]);

$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', `runs/line/${competitionId}`);
});
