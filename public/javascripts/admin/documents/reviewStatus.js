var app = angular.module("ReviewStatus", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
app.controller('ReviewStatusController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.competitionId = competitionId;

    $scope.mode = "select";

    $http.get(`/api/document/${competitionId}/reviewStatus`).then(function (response) {
        $scope.reviewStatus = response.data
    })

    $http.get("/api/teams/leagues/all/" + competitionId).then(function (response) {
        $scope.leagues = response.data;
    });

    $http.get("/api/competitions/leagues").then(function (response) {
        $scope.leagues = response.data;
    })

    $scope.getLeagueName = function(lid) {
        return $scope.leagues.find((l) => l.id == lid).name;
    }

    $scope.goReviewed = function (teamId) {
        window.location = `/document/reviewed/${teamId}?return=/admin/${competitionId}/documents/reviewStatus`;
    }

    $scope.go = function (path) {
        window.location = path
    }

    $scope.getBadgeColor = function (team) {
        let assignedNum = team.assienedQuestionsNum;
        let answeredNum = team.answeredQuestionsNum;

        if (assignedNum == answeredNum) {
            return "badge-success";
        }
        if (answeredNum == 0) {
            return "badge-danger";
        }
        return "badge-warning";
    }

    $scope.sendReminder = function () {
        $http.get(`/api/document/${competitionId}/reviewStatus?sendReminder=true`).then(function (response) {
            Swal({
                type: 'success',
                title: "Remindered!",
                html: "The reminder email was sent successfully."
            })
        }, function (error) {
            Swal({
                type: 'error',
                title: "ERROR",
                html: error.data.msg
            })
        })
    }
    
}]);
