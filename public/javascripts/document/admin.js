var app = angular.module("DocumentsAdmin", ['ngTouch','ngAnimate', 'pascalprecht.translate', 'ngCookies']);

app.controller("DocumentsAdminController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
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
    
    $scope.competitionId = competitionId

    $scope.go = function (path) {
        window.location = path
    }
    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
        $scope.defaultDeadline = new Date(response.data.documents.deadline * 1000);
        $scope.docSystemEnabled = response.data.documents.enable;
    })
    $http.get("/api/competitions/leagues").then(function (response) {
        $scope.leagues = response.data
    })

    $scope.set = function(){
        let data = {
            documents: {
                enable: $scope.docSystemEnabled,
                deadline: Math.round( $scope.defaultDeadline.getTime() / 1000 )
            }
        }
      
        $http.put("/api/competitions/" + $scope.competitionId, data).then(function (response) {
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

    $scope.deadlineColour = function(deadline){
        let today = new Date();
        let tomorrow = new Date();

        tomorrow.setDate(today.getDate() + 1);

        if(deadline > tomorrow) return '#bcffbc';
        if(deadline > today) return '#ffffc6';
        return '#ffcccc';
    }

    
}])
