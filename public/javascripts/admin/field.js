var app = angular.module("FieldAdmin", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("FieldAdminController", ['$scope', '$http', function ($scope, $http) {
    $scope.competitionId = competitionId

    updateFieldList()

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $http.get("/api/teams/leagues").then(function (response) {
        $scope.leagues = response.data
    })

    $scope.addField = function () {
        var field = {
            name: $scope.fieldName,
            competition: competitionId
        }

        $http.post("/api/fields", field).then(function (response) {
            updateFieldList()
        }, function (error) {
            console.log(error)
        })
    }

    $scope.removeField = function (field) {
        swal({
            title: "Remove field?",
            text: "Are you sure you want to remove the field: " +
                field.name + '?',
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Remove it!",
            confirmButtonColor: "#ec6c62"
        }).then((result) => {
            if (result.value) {
            $http.delete("/api/fields/" + field._id).then(function (response) {
                updateFieldList()
            }, function (error) {
                console.log(error)
            })
            }
        })
    }
    
    $scope.go = function (path) {
        window.location = path
    }

    function updateFieldList() {
        $http.get("/api/competitions/" + competitionId +
            "/fields").then(function (response) {
            $scope.fields = response.data
        })
    }
}])
