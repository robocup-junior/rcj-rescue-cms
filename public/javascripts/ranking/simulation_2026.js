var app = angular.module("SimulationScore", ['ngTouch','datatables', 'pascalprecht.translate', 'ngCookies','ngSanitize'])
app.controller("SimulationScoreController", ['$scope', '$http', '$sce', '$translate', function ($scope, $http, $sce, $translate) {
    $scope.competitionId = competitionId;

    $scope.showTeam = true;

    $scope.go = function (path) {
        window.location = path
    }

    var runListTimer = null;
    var runListChanged = false;
    $scope.nowR = 4;
    $scope.top3 = true;
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
            if($scope.top3){
                $scope.top3 = !$scope.top3;
                $scope.time = 10;
            }else{
                if($scope.nowR + 5 < $scope.simulationRunsTop.length){
                    $scope.nowR += 6;
                    $scope.time = 10;
                }else{
                    window.parent.iframeEnd();
                    clearInterval(inter);
                }
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
            socket.emit('subscribe', `runs/simulation/${competitionId}`)
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
                html: `<iframe src="/simulation/view/${id}?iframe=true" style="margin-top:10px; border: none; width:100%; height: calc(100vh - 100px);"/>`,
                showCloseButton: true,
                showConfirmButton: false,
                width: '95%'
              })
        }
    }
}])

$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', `runs/simulation/${competitionId}`);
});