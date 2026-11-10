var app = angular.module("Scanner", ['ngTouch','pascalprecht.translate', 'ngCookies','ngSanitize']);
app.controller("ScannerController", ['$scope', '$http', '$translate', '$window', function ($scope, $http, $translate, $window) {
    $scope.secretCommand = false;
    
    // Fallback for mode
    if (!$scope.mode) $scope.mode = $window.mode;

    $scope.go = function (path) {
        $window.location.href = path;
    }

    function focusInput() {
        const el = document.getElementById("first");
        if (el) {
            el.focus();
            if (!el.getAttribute('data-blur-listener')) {
                el.setAttribute('data-blur-listener', 'true');
                el.addEventListener('blur', function() {
                    setTimeout(focusInput, 10);
                });
            }
        }
    }

    // Initial focus
    setTimeout(focusInput, 500);

    // Keep focus
    $window.onblur = focusInput;
    $window.onclick = focusInput;
    
    $scope.$watch('entered', function(newValue) {
        if (newValue) setTimeout(focusInput, 500);
    });
    
    $scope.$watch('mode', function(newValue) {
        if (newValue) setTimeout(focusInput, 500);
    });

    $scope.handleKeydown = function(e) {
        if (e.keyCode == 13) {
            // QR scanners typically send string + Enter. 
            // We should process whatever is in $scope.data
            if (!$scope.data || $scope.data.length < 3) return;
            
            let result = $scope.data.split(';');
            let url = "";
            let currentMode = $scope.mode || $window.mode;
            
            switch (result[0]) {
                case 'L':
                    url = "/line/" + currentMode + "/" + result[1] + "?return=/home/scanner/" + currentMode;
                    break;
                case 'M':
                    url = "/maze/" + currentMode + "/" + result[1] + "?return=/home/scanner/" + currentMode;
                    break;
            }
            
            if (currentMode == "admin") {
                $scope.entered = true;
                setTimeout(focusInput, 100);
            } else if (url) {
                $scope.go(url);
            }
        }
    }

    $scope.adminGo = function (mode2) {
        if (!$scope.data) return;
        let result = $scope.data.split(';');
        let url = "";
        let currentMode = $scope.mode || $window.mode;
        
        switch (result[0]) {
            case 'L':
                url = "/line/" + mode2 + "/" + result[1] + "?return=/home/scanner/" + currentMode;
                break;
            case 'M':
                url = "/maze/" + mode2 + "/" + result[1] + "?return=/home/scanner/" + currentMode;
                break;
        }
        if (url) $scope.go(url);
    }

}]);
