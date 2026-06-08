var socket;
// Requires SheetJS (XLSX) library loaded globally.
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
            showTeamCode: true,
            showTeamName: false,
            showTime: true,
            showRuns: false
        };

        // Helper functions for URL state
        function loadOptionsFromUrl() {
            const params = new URLSearchParams(window.location.search);

            // Handle displayMode from URL
            const displayMode = params.get('displayMode');
            if (displayMode === $scope.DisplayMode.RANKING || displayMode === $scope.DisplayMode.LIST) {
                $scope.displayMode = displayMode;
            }

            const bool = (key, fallback) => {
                const v = params.get(key);
                return v == null ? fallback : v === '1' || v === 'true';
            };

            $scope.tableOptions.showRaw = bool('showRaw', $scope.tableOptions.showRaw);
            $scope.tableOptions.showNorm = bool('showNorm', $scope.tableOptions.showNorm);
            $scope.tableOptions.showTeamCode = bool('showTeamCode', $scope.tableOptions.showTeamCode);
            $scope.tableOptions.showTeamName = bool('showTeamName', $scope.tableOptions.showTeamName);
            $scope.tableOptions.showTime = bool('showTime', $scope.tableOptions.showTime);
            $scope.tableOptions.showRuns = bool('showRuns', $scope.tableOptions.showRuns);

            const groups = params.get('groups');
            return groups ? groups.split(',') : [];
        }

        function updateUrl() {
            const params = new URLSearchParams();

            params.set('showRaw', $scope.tableOptions.showRaw ? '1' : '0');
            params.set('showNorm', $scope.tableOptions.showNorm ? '1' : '0');
            params.set('showTeamCode', $scope.tableOptions.showTeamCode ? '1' : '0');
            params.set('showTeamName', $scope.tableOptions.showTeamName ? '1' : '0');
            params.set('showTime', $scope.tableOptions.showTime ? '1' : '0');
            params.set('showRuns', $scope.tableOptions.showRuns ? '1' : '0');

            if ($scope.Rgroups) {
                const selectedGroups = Object.keys($scope.Rgroups)
                    .filter(g => $scope.Rgroups[g]);

                if (selectedGroups.length) {
                    params.set('groups', selectedGroups.join(','));
                }
            }

            // Add displayMode to URL
            params.set('displayMode', $scope.displayMode);

            history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        }

        const initialGroups = loadOptionsFromUrl();

        $http.get(`/api/competitions/${competitionId}`).then(function (response) {
            $scope.competition = response.data
            $scope.league = response.data.leagues.find((l) => l.league == leagueId);
            launchSocketIo();
            updateRunList();
            $scope.topComment = `${$scope.competition.name} - ${$scope.league.name}`;
        })

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

        var showAllRounds = true
        var showAllFields = true
        var showAllTeams = true
        $scope.teamName = ""

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
        $scope.$watch('Rgroups', function () {
            rebuildRankingTable();
            updateUrl();
        }, true)

        $scope.$watch('tableOptions', function () {
            rebuildRankingTable();
            updateUrl();
        }, true);

        // Watch displayMode and update URL when it changes
        $scope.$watch('displayMode', function () {
            updateUrl();
        });

        $scope.$watch('teamName', function (newValue, oldValue) {
            if (newValue == '') showAllTeams = true
            else showAllTeams = false
            return
        }, true)
        $scope.$watch('Rrounds', function () {
            rebuildRankingTable();
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

        function rebuildRankingTable() {
            if (!$scope.runs) return;

            let selectedRounds = [];
            let selectedGroups = [];

            if ($scope.Rrounds) {
                selectedRounds = Object.keys($scope.Rrounds)
                    .filter(r => $scope.Rrounds[r]);
            }

            if ($scope.Rgroups) {
                selectedGroups = Object.keys($scope.Rgroups)
                    .filter(g => $scope.Rgroups[g]);
            }

            const filterRounds = selectedRounds.length > 0;
            const filterGroups = selectedGroups.length > 0;

            $scope.selectedRankingGroups = filterGroups
                ? selectedGroups.sort()
                : Object.keys($scope.Rgroups || {}).sort();

            const teams = {};

            for (const run of $scope.runs) {
                if (filterRounds && !selectedRounds.includes(run.round?.name)) {
                    continue;
                }

                if (filterGroups && !selectedGroups.includes(String(run.normalizationGroup))) {
                    continue;
                }

                const teamId = run.team?._id || run.team?.teamCode || run.team?.name;
                if (!teamId) continue;

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

                // Group key as string for normalizationGroup
                const groupKey = String(run.normalizationGroup);
                const rawScore = Number(run.raw_score || run.score || 0);
                const normalizedScore = Number(run.normalizedScore || 0);

                if (!teams[teamId].groups[groupKey]) {
                    teams[teamId].groups[groupKey] = {
                        rawScore: null,
                        normalizedScore: null,
                        runCount: 0
                    };
                }

                // Only keep the latest run per group (replace previous)
                teams[teamId].groups[groupKey].rawScore = rawScore;
                teams[teamId].groups[groupKey].normalizedScore = normalizedScore;
                teams[teamId].groups[groupKey].runCount = 1;

                teams[teamId].runCount++;
                teams[teamId].totalRawScore += rawScore;
                teams[teamId].totalNormalizedScore += normalizedScore;

                if (run.time) {
                    teams[teamId].totalSeconds +=
                        (Number(run.time.minutes || 0) * 60) +
                        Number(run.time.seconds || 0);
                }
            }


           $scope.rankingTable = Object.values(teams)
                .map(team => ({
                    ...team,
                    groupScores: angular.copy(team.groups),
                    totalNormalizedScore: team.runCount > 0
                        ? team.totalNormalizedScore / team.runCount
                        : 0,
                    totalTime:
                        Math.floor(team.totalSeconds / 60) + ':' +
                        String(team.totalSeconds % 60).padStart(2, '0')
                }))
                .sort((a, b) => {
                    const useNormalized = $scope.tableOptions.showNorm;

                    const scoreA = useNormalized
                        ? Number(a.totalNormalizedScore || 0)
                        : Number(a.totalRawScore || 0);

                    const scoreB = useNormalized
                        ? Number(b.totalNormalizedScore || 0)
                        : Number(b.totalRawScore || 0);

                    // Higher score first
                    if (scoreB !== scoreA) {
                        return scoreB - scoreA;
                    }

                    // Tie breaker: lower total time wins
                    return a.totalSeconds - b.totalSeconds;
                });
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

                rebuildRankingTable();

                if (!$scope.Rrounds && !$scope.Rfields) {
                    var rounds = {}
                    var fields = {}
                    var groups = {}
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

                        try {
                            var group = $scope.runs[i].normalizationGroup;

                            if (group != null && !groups.hasOwnProperty(group)) {
                                groups[group] = false;
                            }
                        } catch (e) {

                        }
                    }

                    $scope.Rrounds = objectSort(rounds)
                    $scope.Rfields = objectSort(fields)
                    $scope.Rgroups = objectSort(groups)
                    // Apply initial groups from URL if present
                    if (initialGroups.length) {
                        initialGroups.forEach(g => {
                            if ($scope.Rgroups.hasOwnProperty(g)) {
                                $scope.Rgroups[g] = true;
                            }
                        });
                    }
                    rebuildRankingTable();
                }
                $('.loader').remove();
            })
        }

        $scope.exportRankingPdf = function () {
            const element = document.getElementById('ranking-export');

            if (!element) {
                console.error('ranking-export element not found');
                return;
            }

            const filename = `${$scope.competition.name}_${$scope.league.name}_Ranking.pdf`;

            html2pdf()
                .set({
                    margin: [10, 10, 10, 10],
                    filename,
                    image: {
                        type: 'jpeg',
                        quality: 1
                    },
                    html2canvas: {
                        scale: 2,
                        useCORS: true
                    },
                    jsPDF: {
                        unit: 'mm',
                        format: 'a4',
                        orientation: 'landscape'
                    }
                })
                .from(element)
                .save();
        };

        $scope.exportRankingXlsx = function () {
            if (!$scope.rankingTable || !$scope.rankingTable.length) {
                return;
            }

            const headerStyle = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '61C5BB' } },
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } }
                }
            };

            const oddRowStyle = {
                font: { bold: true },
                alignment: { horizontal: 'center' },
                border: {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                }
            };

            const evenRowStyle = {
                ...oddRowStyle,
                fill: { fgColor: { rgb: 'F5F3EC' } }
            };

            const headers = ['Rank'];

            if ($scope.tableOptions.showTeamCode) headers.push('Team Code');
            if ($scope.tableOptions.showTeamName) headers.push('Team Name');

            for (const group of ($scope.selectedRankingGroups || [])) {
                if ($scope.tableOptions.showRaw) headers.push(`Round ${group}`);
                if ($scope.tableOptions.showNorm) headers.push(`Normalized Round ${group}`);
            }

            if ($scope.tableOptions.showRaw && !$scope.tableOptions.showNorm) {
                headers.push('TOTAL');
            }

            if ($scope.tableOptions.showNorm) {
                headers.push('Mean Normalized TOTAL');
            }

            if ($scope.tableOptions.showTime) headers.push('Time');
            if ($scope.tableOptions.showRuns) headers.push('Runs');

            const title = $scope.topComment || `${$scope.competition.name} - ${$scope.league.name}`;

            const data = [
                [title],
                [],
                headers
            ];

            $scope.rankingTable.forEach((team, index) => {
                const row = [index + 1];

                if ($scope.tableOptions.showTeamCode) row.push(team.teamCode);
                if ($scope.tableOptions.showTeamName) row.push(team.name);

                for (const group of ($scope.selectedRankingGroups || [])) {
                    const score = team.groupScores[group];

                    if ($scope.tableOptions.showRaw) {
                        row.push(score ? score.rawScore : '');
                    }

                    if ($scope.tableOptions.showNorm) {
                        row.push(score ? Number(score.normalizedScore.toFixed(3)) : '');
                    }
                }

                if ($scope.tableOptions.showRaw && !$scope.tableOptions.showNorm) {
                    row.push(team.totalRawScore);
                }

                if ($scope.tableOptions.showNorm) {
                    row.push(Number(team.totalNormalizedScore.toFixed(3)));
                }

                if ($scope.tableOptions.showTime) row.push(team.totalTime);
                if ($scope.tableOptions.showRuns) row.push(team.runCount);

                data.push(row);
            });

            const ws = XLSX.utils.aoa_to_sheet(data);

            const lastColumn = headers.length - 1;

            ws['!merges'] = ws['!merges'] || [];
            ws['!merges'].push({
                s: { r: 0, c: 0 },
                e: { r: 1, c: lastColumn }
            });

            ws['A1'].s = {
                font: {
                    bold: true,
                    sz: 24
                },
                alignment: {
                    vertical: 'center',
                    horizontal: 'left'
                }
            };

            ws['!rows'] = ws['!rows'] || [];
            ws['!rows'][0] = { hpt: 45 };
            ws['!rows'][1] = { hpt: 10 };
            ws['!rows'][2] = { hpt: 30 };

            ws['!cols'] = headers.map((h, index) => {
                // Rank column smaller than the rest
                if (index === 0) {
                    return { wch: 6 };
                }

                // Roughly half the previous width
                return {
                    wch: Math.max(Math.ceil((String(h).length + 4) / 2), 8)
                };
            });

            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let C = range.s.c; C <= range.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: 2, c: C });
                if (ws[addr]) ws[addr].s = headerStyle;
            }

            for (let R = 3; R <= range.e.r; R++) {
                const rowStyle = R % 2 === 0 ? evenRowStyle : oddRowStyle;

                for (let C = range.s.c; C <= range.e.c; C++) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (ws[addr]) ws[addr].s = rowStyle;
                }
            }

            if ($scope.competition && $scope.competition.logo) {
                try {
                    const imgData = $scope.competition.logo;

                    if (!ws['!images']) {
                        ws['!images'] = [];
                    }

                    ws['!images'].push({
                        name: 'CompetitionLogo',
                        data: imgData,
                        opts: {
                            base64: true
                        },
                        position: {
                            type: 'twoCellAnchor',
                            attrs: {
                                from: {
                                    col: Math.max(lastColumn - 2, 0),
                                    row: 0
                                },
                                to: {
                                    col: lastColumn + 1,
                                    row: 2
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.warn('Failed to add logo to XLSX', e);
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Ranking');

            XLSX.writeFile(
                wb,
                `${$scope.competition.name}_${$scope.league.name}_Ranking.xlsx`
            );
        };

        $scope.go = function (path) {
            path = path + '?return=' + window.location.pathname;
            window.location = path
        }
        
        $scope.total = function (lops) {
            let count = 0;
            for(let i=0,l=lops.length;i<l;i++){
              count += lops[i];
            }
            return count;
          }
  
          $scope.active_victim = function (victims, index){
              let victim = victims[index];
              if (victim == undefined) return false;
          
              // Effective check
              if(victim.victimType == "LIVE" && victim.zoneType == "RED") return false;
              if(victim.victimType == "DEAD" && victim.zoneType == "GREEN") return false;
              if(victim.victimType == "KIT" && victim.zoneType == "RED") return false;
          
              // Effective check for dead victim
              if (victim.victimType == "DEAD") {
                let liveCount = 0;
                for (i of $scope.range(index)) {
                  let v = victims[i]
                  if (v.victimType == "LIVE" && v.zoneType == "GREEN") liveCount ++;
                }
                if (liveCount != 2) return false;
              }
              
              return true;    
          };
  
          $scope.victimImgPath = function(victim) {
              switch(victim.victimType) {
                  case 'LIVE':
                      return 'liveVictim.png';
                  case 'DEAD':
                      return 'deadVictim.png';
                  case 'KIT':
                      return 'rescueKit.png';
              }
          }
      
          $scope.evacZoneColor = function(victim) {
              switch(victim.zoneType) {
                  case 'GREEN':
                      return "#1dd1a1";
                  case 'RED':
                      return "#e55039";
              }
          }
}])


$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'competition/' + competitionId);
});
