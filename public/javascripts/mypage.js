var app = angular.module("MyPage", ['ngTouch', 'pascalprecht.translate', 'ngCookies']);

app.controller("MyPageController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
    $scope.pass = {
        current: "",
        new: "",
        confirm: ""
    };
    $scope.validPassword = false;
    $scope.strengthWidth = "0%";
    $scope.strengthColor = "#e74c3c";
    $scope.strengthText = "";

    $scope.checkPassword = function () {
        var password = $scope.pass.new;
        var types = 0;
        if (/[a-z]/.test(password)) types++;
        if (/[A-Z]/.test(password)) types++;
        if (/[0-9]/.test(password)) types++;
        if (/[^A-Za-z0-9]/.test(password)) types++;

        var lengthValid = password.length >= 8;
        var typesValid = types >= 2;

        $scope.validPassword = lengthValid && typesValid;

        // Visual feedback for strength
        if (password.length === 0) {
            $scope.strengthWidth = "0%";
            $scope.strengthText = "";
        } else if (password.length < 8) {
            $scope.strengthWidth = "25%";
            $scope.strengthColor = "#e74c3c";
            $scope.strengthText = "Too short";
        } else if (types < 2) {
            $scope.strengthWidth = "50%";
            $scope.strengthColor = "#f1c40f";
            $scope.strengthText = "Need more variety";
        } else if (types === 2) {
            $scope.strengthWidth = "75%";
            $scope.strengthColor = "#3498db";
            $scope.strengthText = "Good";
        } else {
            $scope.strengthWidth = "100%";
            $scope.strengthColor = "#2ecc71";
            $scope.strengthText = "Strong";
        }
    };

    $scope.changePassword = function () {
        if (!$scope.validPassword || $scope.pass.new !== $scope.pass.confirm) {
            return;
        }

        $http.post("/api/users/me/password", $scope.pass).then(function (response) {
            swal({
                title: $translate.instant("mypage.passwordChanged"),
                type: "success"
            }).then(function() {
                window.location.reload();
            });
        }, function (error) {
            console.log(error);
            swal({
                title: $translate.instant("mypage.passwordError"),
                text: error.data.msg,
                type: "error"
            });
        });
    };

    $scope.go = function (path) {
        window.location = path;
    };
}]);
