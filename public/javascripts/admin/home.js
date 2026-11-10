var app = angular.module("AdminHome", ['ngTouch','pascalprecht.translate', 'ngCookies', 'ui.bootstrap']);
app.controller("AdminHomeController", ['$scope', '$http', '$uibModal', function ($scope, $http, $uibModal) {
    $scope.competitionId = competitionId

    updateCompetitionList()

    $scope.go = function (path) {
        window.location = path
    }

    $scope.open = function (path){
        window.open(path, "_blank");
    }

    $scope.addCompetition = function () {
        const modalInstance = $uibModal.open({
            templateUrl: 'createCompetitionModal.html',
            controller: 'CreateCompetitionController',
            size: 'md'
        });

        modalInstance.result.then(function (name) {
            if (name) {
                var competition = {
                    name: name
                }

                $http.post("/api/competitions", competition).then(function (response) {
                    updateCompetitionList()
                }, function (error) {
                    console.log(error)
                    swal("Error", "Could not create competition.", "error")
                })
            }
        }, function () {
            console.log('Modal dismissed at: ' + new Date());
        });
    }

    $scope.removeCompetition = function (competition, event) {
        if (event) event.stopPropagation();

        const modalInstance = $uibModal.open({
            templateUrl: 'removeCompetitionModal.html',
            controller: 'RemoveCompetitionController',
            size: 'md',
            resolve: {
                competition: function () {
                    return competition;
                }
            }
        });

        modalInstance.result.then(function () {
            $http.delete("/api/competitions/" + competition._id).then(function (response) {
                updateCompetitionList()
            }, function (error) {
                console.log(error)
                swal("Error", "Could not remove competition.", "error")
            })
        }, function () {
            console.log('Modal dismissed at: ' + new Date());
        });
    }

    function updateCompetitionList() {
        $http.get("/api/competitions/").then(function (response) {
            $scope.competitions = response.data
        })
    }
}])

app.controller("CreateCompetitionController", ['$scope', '$uibModalInstance', function ($scope, $uibModalInstance) {
    $scope.competitionName = ""

    $scope.ok = function () {
        $uibModalInstance.close($scope.competitionName);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

app.controller("RemoveCompetitionController", ['$scope', '$uibModalInstance', 'competition', function ($scope, $uibModalInstance, competition) {
    $scope.competition = competition;
    $scope.confirmationText = "";

    $scope.ok = function () {
        $uibModalInstance.close();
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);
