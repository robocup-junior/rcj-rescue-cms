var app = angular.module("MapAdmin", ['ngTouch','pascalprecht.translate', 'ngCookies', 'ui.bootstrap']);
app.controller("MapAdminController", ['$scope', '$http', '$uibModal', function ($scope, $http, $uibModal) {
    $scope.competitionId = competitionId

    

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
        $scope.league = response.data.leagues.find((l) => l.league == leagueId);
        updateMapList()
    })

    $scope.selectedMaps = {};
    $scope.allSelected = false;

    $scope.toggleSelect = function (map, event) {
        if (event) {
            event.stopPropagation();
        }
        $scope.selectedMaps[map._id] = !$scope.selectedMaps[map._id];
        updateAllSelectedState();
    }

    $scope.selectAll = function () {
        $scope.allSelected = !$scope.allSelected;
        for (let map of $scope.maps) {
            $scope.selectedMaps[map._id] = $scope.allSelected;
        }
    }

    function updateAllSelectedState() {
        if (!$scope.maps || $scope.maps.length === 0) {
            $scope.allSelected = false;
            return;
        }
        let all = true;
        for (let map of $scope.maps) {
            if (!$scope.selectedMaps[map._id]) {
                all = false;
                break;
            }
        }
        $scope.allSelected = all;
    }

    $scope.getSelectedCount = function () {
        let count = 0;
        for (let id in $scope.selectedMaps) {
            if ($scope.selectedMaps[id]) count++;
        }
        return count;
    }
    $scope.removeMap = function (map, event) {
        if (event) {
            event.stopPropagation();
        }
        Swal.fire({
            title: 'Delete Map?',
            text: "Are you sure you want to remove the map: " + map.name + "?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, delete it!',
            borderRadius: '1.25rem'
        }).then((result) => {
            if (result.isConfirmed) {
                $http.delete("/api/maps/" + $scope.league.type + "/" + map._id).then(function (response) {
                    Swal.fire({
                        title: 'Deleted!',
                        text: 'The map has been removed.',
                        icon: 'success',
                        borderRadius: '1.25rem'
                    });
                    updateMapList();
                }, function (error) {
                    Swal.fire(
                        'Error!',
                        'Failed to delete the map.',
                        'error'
                    );
                });
            }
        });
    }

    function updateMapList() {
        $http.get("/api/competitions/" + competitionId +
            "/" + $scope.league.league + "/maps").then(function (response) {
            $scope.maps = response.data
        })
    }
    
    $scope.openPrintModal = function () {
        var modalInstance = $uibModal.open({
            templateUrl: 'printSettingsModal.html',
            controller: 'PrintSettingsModalController',
            size: 'lg',
            resolve: {
                settings: function () {
                    return {
                        exportType: 'Maps',
                        exportFormat: 'PDF',
                        paperSize: 'A4',
                        includeLetterVictims: false,
                        includeCognitiveTargets: true
                    };
                }
            }
        });

        modalInstance.result.then(function (settings) {
            const selectedIds = [];
            for (let id in $scope.selectedMaps) {
                if ($scope.selectedMaps[id]) selectedIds.push(id);
            }
            const ids = selectedIds.join(',');
            
            let url = `/api/maps/maze/export?competition=${competitionId}&league=${leagueId}&ids=${ids}`;
            
            if (settings.exportType === 'Targets') {
                url += `&type=targets&paperSize=${settings.paperSize}&includeLetterVictims=${settings.includeLetterVictims}&includeCognitiveTargets=${settings.includeCognitiveTargets}`;
            } else if (settings.exportType === 'Scoresheets') {
                url += `&type=scoresheets&rule=2026`;
            } else if (settings.exportType === 'Maps') {
                url += `&type=maps&format=${settings.exportFormat.toLowerCase()}&paperSize=${settings.paperSize}`;
                
                if (settings.exportFormat === 'PNG') {
                    // Trigger individual downloads for PNG
                    selectedIds.forEach(id => {
                        const link = document.createElement('a');
                        link.href = `/api/maps/maze/${id}/image`;
                        link.download = `${id}.png`;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        setTimeout(() => {
                            document.body.removeChild(link);
                        }, 100);
                    });
                    return;
                }
            }
            
            if (url) {
                window.open(url, '_blank');
            }
        }, function () {
            // Cancelled
        });
    }

    $scope.go = function (path) {
        window.location = path
    }
}])

app.controller('PrintSettingsModalController', ['$scope', '$uibModalInstance', 'settings', function ($scope, $uibModalInstance, settings) {
    $scope.settings = settings;

    $scope.ok = function () {
        $uibModalInstance.close($scope.settings);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);
