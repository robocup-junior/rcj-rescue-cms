var app = angular.module("TeamHome", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
app.controller('TeamHomeController', ['$scope', '$uibModal', '$log', '$http', '$translate', function ($scope, $uibModal, $log, $http, $translate) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
    

    $scope.competitionId = competitionId;
    updateTeamList();

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
        console.log($scope.competition)
    })

    $scope.Rleagues = {};
    $http.get("/api/teams/leagues").then(function (response) {
        $scope.leagues = response.data;
        for(let l of $scope.leagues){
            $scope.Rleagues[l] = false;
        }
    })

    function updateTeamList() {
        $http.get("/api/competitions/" + competitionId +
            "/teams").then(function (response) {
            $scope.teams = response.data;
        })
    }

    

    $scope.go = function (path) {
        window.location = path
    }

    var showAllLeagues = true;
    $scope.refineName = "";
    $scope.refineCode = "";
    $scope.refineRegion = "";

    $scope.$watch('Rleagues', function (newValue, oldValue) {
        showAllLeagues = true
        //console.log(newValue)
        for (let league in newValue) {
            if (newValue.hasOwnProperty(league)) {
                if (newValue[league]) {
                    showAllLeagues = false
                    return
                }
            }
        }
    }, true);

    $scope.list_filter = function (value, index, array) {
        return (showAllLeagues || $scope.Rleagues[value.league])  && (~value.name.indexOf($scope.refineName)) && (~value.teamCode.indexOf($scope.refineCode)) && (~value.country.indexOf($scope.refineRegion))
    }

    $scope.openLog = function(team){
        let logUrl = "/api/document/files/" + team._id + "/" + team.document.token + "/log.txt";
        $http.get(logUrl).then(function (response) {
            let log = response.data.split(/\r?\n/g);
            log = log.reverse().join('<br>');
            
            Swal.fire({
                title: 'Log Viewer',
                html: "<div style='text-align:left;max-height:calc(100vh - 200px);overflow:auto;'>" + log + "</div>",
                width: "100%",
                height: "100%",
                showCloseButton: true, 
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        })
        
    }

    $scope.copy = function(team){
        let link = `${location.protocol}//${location.host}/document/${team._id}/${team.document.token}`;
        if(navigator.clipboard){
            navigator.clipboard.writeText(link);
            Toast.fire({
                type: 'success',
                title: "Copied!",
                html: link
            });
        }else{
            Toast.fire({
                type: 'error',
                title: "Not supported!"
            });
        }
        
    }

    const lColor = [
        '#81ecec',
        '#74b9ff',
        '#a29bfe',
        '#ffeaa7',
        '#fab1a0',
        '#fd79a8',
        '#b2bec3'
    ]
    $scope.leagueColor = function(league){
        if (!$scope.leagues) return '';
        let lIndex = $scope.leagues.indexOf(league) % lColor.length;
        return lColor[lIndex];
    }
}]);
