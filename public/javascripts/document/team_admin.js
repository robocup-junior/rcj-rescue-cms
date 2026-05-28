var app = angular.module("TeamAdmin", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
app.controller('TeamAdminController', ['$scope', '$uibModal', '$log', '$http', '$translate', function ($scope, $uibModal, $log, $http, $translate) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
      
    let saved_mes;
    $translate('document.saved').then(function (val) {
        saved_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    $scope.competitionId = competitionId;
    updateTeamList();

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $scope.Rleagues = {};
    $http.get("/api/teams/leagues").then(function (response) {
        $scope.leagues = response.data;
        
        for(let l of $scope.leagues){
            $scope.Rleagues[l] = false;
        }
    })


    $scope.save = function(data){
        let deadline = null;
        if(data.document.deadline) {
            deadline = Math.round( data.document.deadline.getTime() / 1000 )
        }
        let tmp = {
            _id: data._id,
            competition: data.competition,
            document:{
                public: data.document.public,
                deadline: deadline,
                enabled: data.document.enabled,
                penalty: data.document.penalty
            }
        };

        $http.put("/api/competitions/" + competitionId + "/teams/documents", tmp).then(function (response) {
            Toast.fire({
                type: 'success',
                title: saved_mes
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        });
    }

    function updateTeamList() {
        $http.get("/api/competitions/" + competitionId +
            "/teams/documents").then(function (response) {
            $scope.teams = response.data;

            $scope.showCode = false;
            for(let t of $scope.teams){
                if(t.document.deadline){
                    t.document.deadline = new Date(t.document.deadline * 1000);
                }
            }
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

    $scope.deadlineColour = function(deadline){
        if(!deadline) return '';
        let today = new Date();
        let tomorrow = new Date();

        tomorrow.setDate(today.getDate() + 1);

        if(deadline > tomorrow) return '#bcffbc';
        if(deadline > today) return '#ffffc6';
        return '#ffcccc';
    }

    $scope.penaltyColor = function(penalty){
        if(penalty == 0) return '';
        return '#ffcccc';
    }
}]);
