var socket;
var app = angular.module("RunAdmin", ['ngTouch','ngAnimate', 'ui.bootstrap', 'ui.bootstrap.datetimepicker', 'pascalprecht.translate', 'ngCookies', 'ngFileUpload']);
app.controller('RunAdminController', ['$scope', '$http', '$log', '$location', 'Upload', function ($scope, $http, $log, $location, Upload) {
        $scope.competitionId = competitionId
        $scope.showTeam = true;

        $scope.DisplayMode = {
            LIST: 'list',
            RANKING: 'ranking'
        };

        $scope.displayMode = $scope.DisplayMode.LIST;
        $scope.rankingTable = [];

        $scope.tableOptions = {
            showRaw: true,
            showNorm: false,
            showRuns: false,
            showTeamCode: true,
            showTeamName: true,
            showTime: true
        };

        var runListTimer = null;
        var runListChanged = false;

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
                socket.emit('subscribe', 'runs/maze/' + competitionId)
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

        $http.get(`/api/competitions/${competitionId}`).then(function (response) {
            $scope.competition = response.data;
            $scope.league = response.data.leagues.find((l) => l.league == leagueId);
            launchSocketIo();
            updateRunList();
            $scope.list = { comment: `${$scope.competition.name} - ${$scope.league.name}` };
            $scope.ranking = { comment: `${$scope.league.name} - Round Scores` };
        })

        // --- Ranking helpers ---

        var showAllRounds = true
        var showAllFields = true
        var showAllTeams = true
        $scope.teamName = ""

        $scope.$watch('Rrounds', function (newValue, oldValue) {
            showAllRounds = true
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

        $scope.list_filter = function (value, index, array) {
            return (showAllRounds || $scope.Rrounds[value.round.name]) &&
                (showAllFields || $scope.Rfields[value.field.name]) && (showAllTeams || ~value.team.name.indexOf($scope.teamName))
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

        function initializeRankingView() {
            if (!$scope.runs) return;

            const groups = {};

            for (const run of $scope.runs) {
                const group = run.normalizationGroup;

                if (group != null) {
                    groups[String(group)] = true;
                }
            }

            $scope.Rgroups = objectSort(groups);

            // false means "not explicitly selected".
            // rebuildRankingTable() treats "no groups selected" as "show all groups".
            Object.keys($scope.Rgroups).forEach(g => {
                $scope.Rgroups[g] = false;
            });
        }

        // --- Ranking Table ---
        function rebuildRankingTable() {
            if (!$scope.runs) {
                $scope.rankingTable = [];
                $scope.selectedRankingGroups = [];
                return;
            }

            if (!$scope.Rgroups) {
                initializeRankingView();
            }

            if (!$scope.Rgroups) {
                $scope.rankingTable = [];
                $scope.selectedRankingGroups = [];
                return;
            }

            // Get selected normalization groups
            const selectedGroups = Object.keys($scope.Rgroups).filter(g => $scope.Rgroups[g]);
            $scope.selectedRankingGroups = selectedGroups.length
                ? selectedGroups.sort()
                : Object.keys($scope.Rgroups || {}).sort();
            const activeGroups = $scope.selectedRankingGroups;

            // Group runs by team
            const teams = {};
            for (const run of $scope.runs) {
                if (!run.team) continue;
                const teamId = run.team._id || run.team.teamCode || run.team.name;
                const groupKey = String(run.normalizationGroup);
                if (!activeGroups.includes(groupKey)) {
                    continue;
                }
                if (!teams[teamId]) {
                    teams[teamId] = {
                        name: run.team.name,
                        teamCode: run.team.teamCode,
                        totalRawScore: 0,
                        totalNormalizedScore: 0,
                        totalSeconds: 0,
                        runCount: 0,
                        groups: {}
                    };
                }
                if (!teams[teamId].groups[groupKey]) {
                    teams[teamId].groups[groupKey] = {
                        rawScore: null,
                        normalizedScore: null,
                        runCount: 0
                    };
                }
                // Only count the best run per group per team
                const group = teams[teamId].groups[groupKey];
                // Calculate run time in seconds
                const runTimeSeconds =
                    Number(run.time?.minutes || 0) * 60 +
                    Number(run.time?.seconds || 0);

                // If there is no run yet, or this run has a higher normalized score, or same score but lower time
                if (
                    group.normalizedScore === null ||
                    run.normalizedScore > group.normalizedScore ||
                    (
                        run.normalizedScore === group.normalizedScore &&
                        runTimeSeconds < (group.timeSeconds ?? Infinity)
                    )
                ) {
                    group.rawScore = run.score;
                    group.normalizedScore = run.normalizedScore;
                    group.timeSeconds = runTimeSeconds;
                    group.runCount = 1;
                }
            }
            // Calculate totals and build $scope.rankingTable
            $scope.rankingTable = Object.values(teams)
                .map(team => {
                    let totalNorm = 0;
                    let totalRaw = 0;
                    let runCount = 0;
                    let totalSeconds = 0;
                    activeGroups.forEach(group => {
                        const g = team.groups[group];
                        if (g && g.rawScore !== null) {
                            totalRaw += Number(g.rawScore || 0);
                        }
                        if (g && g.normalizedScore !== null) {
                            totalNorm += g.normalizedScore;
                            runCount += 1;
                            if (g.timeSeconds != null) {
                                totalSeconds += g.timeSeconds;
                            }
                        }
                    });
                    const groupScores = {};
                    activeGroups.forEach(group => {
                        groupScores[group] = team.groups[group] || {
                            rawScore: null,
                            normalizedScore: null,
                            runCount: 0
                        };
                    });
                    Object.keys(groupScores).forEach(group => {
                        const score = groupScores[group].normalizedScore;

                        groupScores[group].formattedNormalizedScore =
                            score == null
                                ? null
                                : (score === 1
                                    ? '1'
                                    : Number(score).toFixed(2));
                    });
                    return {
                        ...team,
                        totalRawScore: parseFloat(totalRaw.toFixed(10)),
                        totalNormalizedScore: totalNorm,
                        runCount: runCount,
                        totalSeconds: totalSeconds,
                        groupScores,
                        meanNormalizedScore: runCount > 0 ? totalNorm / runCount : 0,
                        totalTime:
                            Math.floor(totalSeconds / 60) + ':' +
                            String(totalSeconds % 60).padStart(2, '0')
                    };
                })
                .filter(team => team.runCount > 0);
            // Custom sort
            $scope.rankingTable.sort(function(a, b) {
                const scoreA = $scope.tableOptions.showNorm
                    ? (a.meanNormalizedScore || 0)
                    : (a.totalRawScore || 0);

                const scoreB = $scope.tableOptions.showNorm
                    ? (b.meanNormalizedScore || 0)
                    : (b.totalRawScore || 0);

                if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                }

                return (a.totalSeconds || 0) - (b.totalSeconds || 0);
            });
        }

        $scope.getRoundColspan = function () {
            return $scope.selectedRankingGroups.length *
                (($scope.tableOptions.showRaw ? 1 : 0) +
                 ($scope.tableOptions.showNorm ? 1 : 0));
        };

        $scope.$watch('displayMode', function(newValue) {
            if (newValue === $scope.DisplayMode.RANKING) {
                rebuildRankingTable();
            }
        });

        $scope.$watch('Rgroups', function () {
            if ($scope.displayMode === $scope.DisplayMode.RANKING) {
                rebuildRankingTable();
            }
        }, true);

        $scope.$watch('tableOptions', function () {
            if ($scope.displayMode === $scope.DisplayMode.RANKING) {
                rebuildRankingTable();
            }
        }, true);

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
                $('.loader').remove();
            })
        }

        $scope.go = function (path) {
            window.location = path + '?return=' + window.location.pathname;
        }

        $scope.victimOrder = function (victim) {
            const order = {
                'PHI': 1,
                'PSI': 2,
                'OMEGA': 3,
                'H': 1,
                'S': 2,
                'U': 3,
                'Cognitive:H': 4,
                'Cognitive:S': 5,
                'Cognitive:U': 6,
                'Cognitive': 7
            };
            return order[victim.type] || 99;
        };
}])


$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'competition/' + competitionId);
});
