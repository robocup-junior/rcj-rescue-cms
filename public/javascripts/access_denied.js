var app = angular.module("AD", ['ngTouch','pascalprecht.translate', 'ngCookies']);

app.controller("ADController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
    $scope.go = function (path) {
        window.location = path
    }

    // Back to where the visitor came from; with no page to go back to, home.
    $scope.back = function () {
        if (document.referrer && window.history.length > 1) window.history.back();
        else window.location = '/home';
    }

}]);
