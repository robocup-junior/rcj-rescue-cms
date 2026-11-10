var app = angular.module("CompetitionHome", ['ngTouch','pascalprecht.translate', 'ngCookies','ngSanitize']);
const SUPPORTED_LEAGUE_TYPES = ['line', 'maze', 'simulation'];
app.controller("CompetitionHomeController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
    $scope.secretCommand = false;
    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })
    // Signage is only listed for logged-in users
    if (loggedIn) {
        $http.get("/api/signage").then(function (response) {
            $scope.signs = response.data
        })
    }

    $http.get("/api/teams/leagues/all/" + competitionId).then(function (response) {
        $scope.leagues = response.data.filter(l => SUPPORTED_LEAGUE_TYPES.includes(l.type));
    });

    $scope.go = function (path) {
        window.location = path
    }

    $scope.goLeaguePage = function (league) {
        let path = `/${league.type}/${competitionId}/${league.id}`
        window.location = path
    }

    $scope.leagueImage = function (league) {
        switch (league.id) {
            case 'LineNL':
                return "LineNL";
            case 'MazeNL':
                return "MazeNL";
            default:
                return league.type;
        }
    }
    
    cheet('↑ ↑ ↓ ↓ ← → ← → b a', function () {
        $scope.secretCommand = !$scope.secretCommand;
        $scope.$apply();
    });

}]);
