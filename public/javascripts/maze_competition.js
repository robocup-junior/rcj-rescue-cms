var app = angular.module("MazeCompetition", ['ngTouch','pascalprecht.translate', 'ngCookies','ngSanitize', 'ui.bootstrap']);
var socket;
app.controller("MazeCompetitionController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
        $scope.competitionId = competitionId
        $scope.isJudge = isJudge
        if (isJudge == 0) $scope.show_ended = true
        else $scope.show_ended = false
        var val_go_judge, val_no_judge;
        $translate('maze.competition.js.go_judge').then(function (val) {
            val_go_judge = val;
        }, function (translationId) {
            // = translationId;
        });
        $translate('maze.competition.js.no_judge').then(function (val) {
            val_no_judge = val;
        }, function (translationId) {
            // = translationId;
        });

        function updateTime() {
            $scope.curTime = new Date().getTime()
            setTimeout(updateTime, 1000 * 60)
        }
        updateTime()


        var showAllRounds = true
        var showAllFields = true
        var showAllTeams = true
        $scope.teamName = ""

        
        $http.get(`/api/runs/maze/competition/${competitionId}?populate=true&minimum=true&ended=false`).then(function (response) {
            $scope.runs = response.data
        })

        $http.get("/api/competitions/" + competitionId).then(function (response) {
            $scope.competition = response.data;
            $scope.rankingOpen = $scope.competition.leagues.reduce((result, current) => {
                result[current.league] = current.disclose;
                return result;
            }, {})

            $scope.rankingMode = $scope.competition.leagues.reduce((result, current) => {
                result[current.league] = current.mode;
                return result;
            }, {})
        })
        
        $http.get("/api/competitions/leagues/" + league).then(function (response) {
            $scope.league = response.data
        })

        // launch socket.io
        socket = io(window.location.origin, {
            transports: ['websocket']
        });
        if (typeof competitionId !== 'undefined') {
            socket.emit('subscribe', 'runs/maze/' + competitionId + '/status');

            socket.on('StatusChanged', function () {
                $scope.update_list();
                $scope.$apply();
                //console.log($scope.runs);
                console.log("Updated view from socket.io");
            });
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
            //arr.reverse();

            for (var i = 0; i < arr.length; i++) {
                sorted[arr[i]] = object[arr[i]];
            }
            return sorted;
        }

        $scope.update_list = function () {
            
            $http.get(`/api/runs/maze/competition/${competitionId}?populate=true&minimum=true&ended=${$scope.show_ended}`).then(function (response) {
                var runs = response.data.filter(r => r.team.league == league);

                for (let run of runs) {
                    if (!run.team) {
                        run.team = {
                            'name': ""
                        };
                    }
                }

                $scope.runs = runs;

                var rounds = {}
                var fields = {}
                for (var i = 0; i < runs.length; i++) {
                    try {
                        var round = runs[i].round.name
                        if (!rounds.hasOwnProperty(round)) {
                            rounds[round] = false
                        }
                    } catch (e) {

                    }

                    try {
                        var field = runs[i].field.name

                        if (!fields.hasOwnProperty(field)) {
                            fields[field] = false
                        }
                    } catch (e) {

                    }


                }
                $scope.rounds = objectSort(rounds)
                $scope.fields = objectSort(fields)
            });
        }

        $scope.$watch('rounds', function (newValue, oldValue) {
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
        $scope.$watch('fields', function (newValue, oldValue) {
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
        $scope.$watch('teamName', function (newValue, oldValue) {
            if (newValue == '') showAllTeams = true
            else showAllTeams = false
            return
        }, true)

        $scope.update_list()

        $scope.list_filter = function (value, index, array) {
            if (!value.field) {
                return (showAllRounds || $scope.rounds[value.round.name]) && showAllFields && (~value.team.name.indexOf($scope.teamName) || showAllTeams)
            }
            return (showAllRounds || $scope.rounds[value.round.name]) &&
                (showAllFields || $scope.fields[value.field.name]) && (showAllTeams || ~value.team.name.indexOf($scope.teamName))
        }


        $scope.go = function (path) {
            socket.emit('unsubscribe', 'runs/maze/' + competitionId + '/status');
            window.location = path
        }

        $scope.go_judge = function (path, team_name) {
            socket.emit('unsubscribe', 'runs/maze/' + competitionId + '/status');
            swal({
                title: team_name,
                text: val_go_judge,
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes",
            }).then((result) => {
                if (result.value) {
                    $scope.go(path);
                }
            })
        }

        $scope.no_judge = function () {
            swal("Oops!", val_no_judge, "error");
        }
    }])
    .directive("runsReadFinished", ['$timeout', function ($timeout) {
        return function (scope, element, attrs) {
            if (scope.$last) {
                $('.refine').css("visibility", "visible");
                $('.loader').remove();
                $timeout(function () {
                    $('table.comp').exTableFilter({
                        filters: {
                            1: {
                                append: {
                                    to: 'div.filter-round',
                                    type: 'checkbox'
                                }
                            },
                            3: {
                                append: {
                                    to: 'div.filter-arena',
                                    type: 'checkbox'
                                }
                            }
                        }
                    });
                });
            }
        }
    }])


$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'runs/maze/' + competitionId + '/status');
});
