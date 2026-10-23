var app = angular.module("CompetitionAdmin", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("CompetitionAdminController", ['$scope', '$http', function ($scope, $http) {
    $scope.competitionId = competitionId
    $scope.mailEnable = mailEnable
    $scope.go = function (path) {
        window.location = path
    }
    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data;
        $scope.leagues = response.data.leagues;
    })

    $scope.leagueImage = function (league) {
        switch (league.league) {
            case 'LineNL':
                return "LineNL";
            case 'MazeNL':
                return "MazeNL";
            default:
                return league.type;
        }
    }
}])
