var app = angular.module("Inspection", ['ngTouch', 'pascalprecht.translate', 'ngCookies', 'ngFileUpload', 'ngAlertify', 'pascalprecht.translate']);
app.controller("InspectionController", ['$scope', '$http', 'Upload', '$timeout', 'alertify', '$translate', function ($scope, $http, Upload, $timeout, alertify, $translate) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    let upload_mes;
    $translate('document.uploaded').then(function (val) {
        upload_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    
    $scope.competitionId = competitionId;
    $scope.teamId = teamId;
    $scope.updateTime = 0;

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $http.get("/api/competitions/" + competitionId + "/teams/" + teamId).then(function (response) {
        $scope.team = response.data;
        if($scope.team.inspected){
            $("#slider-cancel").slideToUnlock({ useData: true, unlockfn: function() {
                $http.put("/api/teams/" + competitionId + "/" + teamId, {
                    inspected: false
                }).then(function (response) {
                    $scope.go('/home/' + competitionId + '/teams');
                })
            }});
        }else{
            $("#slider-inspected").slideToUnlock({ useData: true, unlockfn: function() {
                $http.put("/api/teams/" + competitionId + "/" + teamId, {
                    inspected: true
                }).then(function (response) {
                    $scope.go('/home/' + competitionId + '/teams');
                })
            }});
        }
    })

    $scope.go = function (path) {
        window.location = path
    }

    $scope.getParam = function (key) {
        var str = location.search.split("?");
        if (str.length < 2) {
            return "";
        }

        var params = str[1].split("&");
        for (var i = 0; i < params.length; i++) {
            var keyVal = params[i].split("=");
            if (keyVal[0] == key && keyVal.length == 2) {
                return decodeURIComponent(keyVal[1]);
            }
        }
        return "";
    }

    $scope.range = function (n) {
        var arr = [];
        for (var i = 0; i < n; ++i) arr.push(i);

        return arr;
    }

    $scope.teamPhoto = {fileName: "teamPhoto"};
    $scope.robotPhoto = {fileName: "robotPhoto"};

    // Called from the photo <img> onload/onerror to switch between the photo and the placeholder
    $scope.photoLoaded = function (name, loaded) {
        $scope.$applyAsync(function () {
            $scope[name].loaded = loaded;
        });
    };

    $scope.uploadFiles = function(question, file, errFiles) {
        question.f = file;
        question.errFile = errFiles && errFiles[0];
        if(question.errFile){
            Toast.fire({
                type: 'error',
                title: "Error",
                html: question.errFile.$error + ' : ' + question.errFile.$errorParam
            })
        }
        if (file) {
            question.uploading = true;
            file.upload = Upload.upload({
                url: '/api/document/inspection/files/' + teamId + '/' + question.fileName,
                data: {file: file}
            });

            file.upload.then(function (response) {
                $timeout(function () {
                    $scope.updateTime = new Date().getTime()/1000;
                    file.result = response.data;
                    Toast.fire({
                        type: 'success',
                        title: upload_mes
                    })
                    delete question.f;
                });
            }, function (response) {
                if (response.status > 0){
                     question.errorMsg = response.status + ': ' + response.data.msg;
                     Toast.fire({
                        type: 'error',
                        title: "Error: " + response.statusText,
                        html: response.data.msg
                    })
                }
            }, function (evt) {
                file.progress = Math.min(100, parseInt(100.0 * 
                                         evt.loaded / evt.total));
            });
        }   
    }
    
}])
