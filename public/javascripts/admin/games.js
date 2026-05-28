var socket;
var app = angular.module("RunAdmin", ['ngTouch','ngAnimate', 'ui.bootstrap', 'ui.bootstrap.datetimepicker', 'pascalprecht.translate', 'ngCookies', 'ngFileUpload']);
app.controller('RunAdminController', ['$scope', '$http', '$log', '$location', 'Upload', '$uibModal', function ($scope, $http, $log, $location, Upload, $uibModal) {
        $scope.runsReadFinished = false;
        $scope.showAddRun = false;
        $scope.showFilter = false;
        $scope.competitionId = competitionId
        $scope.showTeam = true;

        $http.get(`/api/competitions/${competitionId}`).then(function (response) {
            $scope.competition = response.data
            $scope.topComment = $scope.competition.name;
            $scope.league = response.data.leagues.find((l) => l.league == leagueId);
            launchSocketIo();
            updateRunList();

            $http.get(`/api/competitions/${competitionId}/${leagueId}/teams`).then(function (response) {
                $scope.teams = response.data
            })
    
            $http.get(`/api/competitions/${competitionId}/rounds`).then(function (response) {
                $scope.rounds = response.data
            })
    
            $http.get(`/api/competitions/${competitionId}/fields`).then(function (response) {
                $scope.fields = response.data
            })
    
            if ($scope.league.type != 'simulation') {
                $http.get(`/api/competitions/${competitionId}/${leagueId}/maps`).then(function (response) {
                    $scope.maps = {}
                    for (let i = 0; i < response.data.length; i++) {
                        if (!response.data[i].parent) {
                            $scope.maps[i] = response.data[i]
                        }
                    }
                })
            }
        })

        var runListTimer = null;
        var runListChanged = false;

        var timeOffset = new Date().getTimezoneOffset() * -1;

        function timerUpdateRunList() {
            if (runListChanged) {
                updateRunList();
                runListChanged = false;
                runListTimer = setTimeout(timerUpdateRunList, 1000 * 15);
            } else {
                runListTimer = null
            }
        }

        function launchSocketIo() {
            // launch socket.io
            socket = io({
                transports: ['websocket']
            }).connect(window.location.origin)
            socket.on('connect', function () {
                socket.emit('subscribe', `runs/${$scope.league.type}/${competitionId}`)
            })
            socket.on('changed', function () {
                runListChanged = true;
                if (runListTimer == null) {
                    updateRunList();
                    runListChanged = false;
                    runListTimer = setTimeout(timerUpdateRunList, 1000 * 15)
                }
            })
        }
        
        $scope.range = function (n) {
            arr = [];
            for (var i = 0; i < n; i++) {
                arr.push(i);
            }
            return arr;
        }

        $scope.addRun = function () {
            if ($scope.run === undefined ||
                $scope.run.round === undefined ||
                $scope.run.team === undefined ||
                ($scope.run.map === undefined && $scope.league.type != 'simulation') ||
                $scope.run.field === undefined) {
                return
            }

            var run = {
                round: $scope.run.round._id,
                team: $scope.run.team._id,
                field: $scope.run.field._id,
                competition: competitionId,
                startTime: $scope.startTime.getTime(),
                normalizationGroup: $scope.run.normalizationGroup
            }

            if ($scope.league.type != 'simulation') {
                run['map'] = $scope.run.map._id
            }

            $http.post(`/api/runs/${$scope.league.type}`, run).then(function (response) {
                updateRunList()
            }, function (error) {
                console.log(error)
                swal("Oops!", error.data.err, "error");
            })
        }

        $scope.allChecked = false;
        $scope.toggleAll = function () {
            $scope.allChecked = !$scope.allChecked;
            angular.forEach($scope.runs, function (run) {
                if($scope.list_filter(run)) run.checked = $scope.allChecked;
            });
        }

        $scope.selectAll = function () {
            angular.forEach($scope.runs, function (run) {
                if($scope.list_filter(run)) run.checked = true;
            });
        }

        $scope.removeSelectedRun = function () {
            var chk = [];
            angular.forEach($scope.runs, function (run) {
                if (run.checked) chk.push(run._id);
            });
            $scope.removeRun(chk.join(","));
        }

        $scope.removeRun = async function (runIds) {
            const {
                value: operation
            } = await swal({
                title: "Delete Run?",
                text: "Are you sure you want to remove the run?",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes, delete it!",
                confirmButtonColor: "#ec6c62",
                input: 'text',
                inputPlaceholder: 'Enter "DELETE" here',
                inputValidator: (value) => {
                    return value != 'DELETE' && 'You need to type "DELETE" !'
                }
            })

            if (operation) {
                $http.delete(`/api/runs/${$scope.league.type}/${runIds}`).then(function (response) {
                    updateRunList()
                }, function (error) {
                    console.log(error)
                })
            }
        }
        
        $scope.statusReset = async function (runIds) {
            const {
                value: operation
            } = await swal({
                title: "Reset Status?",
                text: "Are you sure you want to reset status?",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes, reset it!",
                confirmButtonColor: "#ec6c62",
                input: 'text',
                inputPlaceholder: 'Enter "RESET" here',
                inputValidator: (value) => {
                    return value != 'RESET' && 'You need to write "RESET" !'
                }
            })

            if (operation) {
                $http.put(`/api/runs/${$scope.league.type}/${runIds}`,{status: 0}).then(function (response) {
                    updateRunList()
                }, function (error) {
                    console.log(error)
                })
            }


        }

        $scope.editMode = false;
        let previousContents = null;
        $scope.toggleEdit = function(){
            $scope.editMode = !$scope.editMode;
            if ($scope.editMode) {
                // Copy previous contents
                previousContents = [];
            } else {
                let updates = [];
                for (let r of $scope.runs) {
                    let prvC = previousContents.find((c) => c._id == r._id);
                    console.log(prvC)
                    if (prvC == undefined || prvC.adjustment != r.adjustment) {
                        // Updated
                        updates.push(
                            {
                                _id: r._id,
                                adjustment: Number(r.adjustment)
                            }
                        );
                    }
                }

                if (updates.length > 0) {
                    $http.put(`/api/runs/${$scope.league.type}/bulk`, updates).then(function (response) {
                        updateRunList()
                    }, function (error) {
                        console.log(error)
                    })
                }
            }
        }
        
        var showAllRounds = true
        var showAllFields = true
        var showAllTeams = true
        var showAllTeamCodes = true
        $scope.teamName = ""
        $scope.teamCode = ""

        $scope.$watch('Rrounds', function (newValue, oldValue) {
            showAllRounds = true
            //console.log(newValue)
            for (let round in newValue) {
                if (newValue.hasOwnProperty(round)) {
                    if (newValue[round]) {
                        showAllRounds = false
                        return
                    }
                }
            }
        }, true)
        $scope.$watch('Rfields', function (newValue, oldValue) {
            //console.log(newValue)
            showAllFields = true
            for (let field in newValue) {
                if (newValue.hasOwnProperty(field)) {
                    if (newValue[field]) {
                        showAllFields = false
                        return
                    }
                }
            }
        }, true)
        $scope.$watch('teamCode', function (newValue, oldValue) {
            if (newValue == '') showAllTeamCodes = true
            else showAllTeamCodes = false
            return
        }, true)
        $scope.$watch('teamName', function (newValue, oldValue) {
            if (newValue == '') showAllTeams = true
            else showAllTeams = false
            return
        }, true)

        $scope.list_filter = function (value, index, array) {
            return (showAllRounds || $scope.Rrounds[value.round.name]) &&
                (showAllFields || $scope.Rfields[value.field.name]) && (showAllTeams || ~value.team.name.indexOf($scope.teamName)) && (showAllTeamCodes || ~value.team.teamCode.indexOf($scope.teamCode))
        }
        
        function objectSort(object) {
        var sorted = {};
        var arr = [];
        for (key in object) {
            if (object.hasOwnProperty(key)) {
                arr.push(key);
            }
        }
        arr.sort();

        for (var i = 0; i < arr.length; i++) {
            sorted[arr[i]] = object[arr[i]];
        }
        return sorted;
    }


        function updateRunList() {
            $http.get(`/api/runs/${$scope.league.type}/competition/${competitionId}?normalized=true`).then(function (response) {
                var runs = response.data.filter(r => r.team.league == leagueId);
                for (let run of runs) {
                    if (!run.team) {
                        run.team = {
                            'name': ""
                        };
                    }
                }
                $scope.runs = runs;
                if (!$scope.Rrounds && !$scope.Rfields) {
                    var rounds = {}
                    var fields = {}
                    for (var i = 0; i < $scope.runs.length; i++) {
                        try {
                            var round = $scope.runs[i].round.name
                            if (!rounds.hasOwnProperty(round)) {
                                rounds[round] = false
                            }
                        } catch (e) {

                        }

                        try {
                            var field = $scope.runs[i].field.name

                            if (!fields.hasOwnProperty(field)) {
                                fields[field] = false
                            }
                        } catch (e) {

                        }
                    }

                    $scope.Rrounds = objectSort(rounds)
                    $scope.Rfields = objectSort(fields)
                }
                $scope.runsReadFinished = true;
                $('.loader').remove();
            })
        }

        $scope.go_sign = function (runid) {
            swal({
                title: "Go sign page?",
                text: "Are you sure you want to go sign page?  If you click 'GO', the signatures will remove.",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "GO!",
                confirmButtonColor: "#ec6c62"
            }).then((result) => {
                if (result.value) {
                    $scope.go(`/${$scope.league.type}/sign/${runid}`);
                }
            })
        }


        $scope.go_scoreSheet2 = function (runId) {
          window.open(`/api/runs/${$scope.league.type}/scoresheet2?run=${runId}&offset=${timeOffset}`,"_blank");
        };

        $scope.go_judge = function (runid) {
            swal({
                title: "Go judge page?",
                text: "Are you sure you want to go judge page?  If you click 'GO', the time and signatures will remove.",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "GO!",
                confirmButtonColor: "#ec6c62"
            }).then((result) => {
                if (result.value) {
                    $scope.go(`/${$scope.league.type}/judge/${runid}`);
                }
            })
        }

        $scope.go_input = function (runid) {
            $scope.go(`/${$scope.league.type}/input/${runid}`);
        }

        $scope.statusColor = function(status){
          switch(status){
            case 2:
                return "#81ecec";
            case 3:
              return "#fdcb6e";
            case 4:
              return "#ffadad";
            case 5:
              return "#f7ff94";
            case 6:
              return "#91ffb8";
            default:
              return "";
          }
        }

        $scope.go = function (path) {
            const separator = path.includes('?') ? '&' : '?';
            path = path + separator + 'return=' + encodeURIComponent(window.location.pathname);
            window.location = path;
        }

        $scope.format = "yyyy-MM-dd"

        $scope.startDateOptions = {
            showWeeks: false
        };

        var start = new Date(Date.now() + 1000 * 60 * 5)

        start.setMinutes(start.getMinutes() - start.getMinutes() % 5)
        start.setSeconds(0)
        start.setMilliseconds(0)


        $scope.startTime = start
        $scope.startDate = start

        $scope.startDatePopup = {
            opened: false
        }
        $scope.openStartDate = function () {
            $scope.startDatePopup.opened = true
        }
        $scope.updateStartTime = function () {
            $scope.startTime.setFullYear($scope.startDate.getFullYear())
            $scope.startTime.setMonth($scope.startDate.getMonth())
            $scope.startTime.setDate($scope.startDate.getDate())
            $scope.startTime.setSeconds(0)
            $scope.startTime.setMilliseconds(0)

            $scope.startDate.setHours($scope.startTime.getHours())
            $scope.startDate.setMinutes($scope.startTime.getMinutes())
            $scope.startDate.setSeconds(0)
            $scope.startDate.setMilliseconds(0)
        }


        var scoreSheetStart = new Date(Date.now())
        scoreSheetStart.setHours(0);
        scoreSheetStart.setMinutes(0)
        scoreSheetStart.setSeconds(0)
        scoreSheetStart.setMilliseconds(0)

        $scope.scoreSheetStartDateTime = scoreSheetStart

        $scope.scoreSheetStartDatePopup = {
          opened: false
        }
        $scope.openScoreSheetStartDate = function () {
          $scope.scoreSheetStartDatePopup.opened = true
        }

        var scoreSheetEnd = new Date(Date.now() + 1000 * 60 * 60 * 24)
        scoreSheetEnd.setHours(0);
        scoreSheetEnd.setMinutes(0)
        scoreSheetEnd.setSeconds(0)
        scoreSheetEnd.setMilliseconds(0)

        $scope.scoreSheetEndDateTime = scoreSheetEnd

        $scope.scoreSheetEndDatePopup = {
          opened: false
        }
        $scope.openScoreSheetEndDate = function () {
          $scope.scoreSheetEndDatePopup.opened = true
        };


        $scope.openScoreSheetModal = function () {
          var modalInstance = $uibModal.open({
            templateUrl: 'scoreSheetModal.html',
            controller: 'ScoreSheetModalController',
            size: 'md',
            resolve: {
              data: function () {
                return {
                  competitionId: $scope.competitionId,
                  league: $scope.league,
                  scoreSheetStartDateTime: $scope.scoreSheetStartDateTime,
                  scoreSheetEndDateTime: $scope.scoreSheetEndDateTime,
                  startDateOptions: $scope.startDateOptions
                };
              }
            }
          });

          modalInstance.result.then(function (result) {
            $scope.scoreSheetStartDateTime = result.start;
            $scope.scoreSheetEndDateTime = result.end;
            $scope.go_scoreSheetInTimeRange2();
          }, function () {
            // Cancelled
          });
        };

        $scope.go_scoreSheetInTimeRange2 = function () {
          window.open(`/api/runs/${$scope.league.type}/scoresheet2?competition=${$scope.competitionId}&startTime=${$scope.scoreSheetStartDateTime.getTime()}&endTime=${ $scope.scoreSheetEndDateTime.getTime()}&offset=${timeOffset}`, "_blank")
        };
        
        $scope.total = function (lops) {
          let count = 0;
          for(let i=0,l=lops.length;i<l;i++){
            count += lops[i];
          }
          return count;
        }
}])
    .directive("runsReadFinished", ['$timeout', function ($timeout) {
        return function (scope, element, attrs) {
            if (scope.$last) {
                $('.refine').css("visibility", "visible");
                $('.loader').remove();
            }
        }
    }]);

app.controller('ScoreSheetModalController', ['$scope', '$uibModalInstance', 'data', function ($scope, $uibModalInstance, data) {
  $scope.competitionId = data.competitionId;
  $scope.league = data.league;
  $scope.scoreSheetStartDateTime = data.scoreSheetStartDateTime;
  $scope.scoreSheetEndDateTime = data.scoreSheetEndDateTime;
  $scope.startDateOptions = data.startDateOptions;

  $scope.scoreSheetStartDatePopup = {
    opened: false
  }
  $scope.openScoreSheetStartDate = function () {
    $scope.scoreSheetStartDatePopup.opened = true
  }

  $scope.scoreSheetEndDatePopup = {
    opened: false
  }
  $scope.openScoreSheetEndDate = function () {
    $scope.scoreSheetEndDatePopup.opened = true
  };

  $scope.ok = function () {
    $uibModalInstance.close({
      start: $scope.scoreSheetStartDateTime,
      end: $scope.scoreSheetEndDateTime
    });
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
}]);


$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'competition/' + competitionId);
});
