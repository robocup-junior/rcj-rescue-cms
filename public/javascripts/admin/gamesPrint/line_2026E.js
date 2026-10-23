var socket;
var app = angular.module("RunAdmin", ['ngTouch','ngAnimate', 'ui.bootstrap', 'ui.bootstrap.datetimepicker', 'pascalprecht.translate', 'ngCookies', 'ngFileUpload']);
app.controller('RunAdminController', ['$scope', '$http', '$log', '$location', '$translate', 'Upload', function ($scope, $http, $log, $location, $translate, Upload) {
        $scope.competitionId = competitionId
        $scope.showTeam = true;

        $http.get(`/api/competitions/${competitionId}`).then(function (response) {
            $scope.competition = response.data
            $scope.league = response.data.leagues.find((l) => l.league == leagueId);
            launchSocketIo();
            updateRunList();
            const setTitle = (runList) => { $scope.list = { comment: `${$scope.league.name} - ${runList}` }; };
            $translate('admin.print.runList').then(setTitle, setTitle);
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

        // "All" chip of the round/field filters: nothing selected means everything is shown
        $scope.noneSelected = function (selection) {
            return !Object.values(selection || {}).some(Boolean);
        };

        $scope.clearSelection = function (selection) {
            for (const key in selection) selection[key] = false;
        };

        // Plain-text victims for the Excel export
        $scope.victimText = function (run) {
            if (run.team.league == 'LineNL') {
                return `? ×${run.nlUnknownVictimCount || 0}, LIVE ×${run.nlLiveVictimCount || 0}, DEAD ×${run.nlDeadVictimCount || 0}`;
            }
            const level = run.evacuationLevel ? `Level ${run.evacuationLevel}` : '';
            const victims = (run.rescueOrder || []).map((v) => `${v.victimType}:${v.zoneType}`).join(', ');
            return [level, victims].filter(Boolean).join(' / ');
        };

        function updateRunList() {
            $http.get(`/api/runs/${$scope.league.type}/competition/${competitionId}?normalized=true`).then(function (response) {
                var runs = response.data.filter(r => r.team.league == leagueId);
                for (let run of runs) {
                    if (!run.team) {
                        run.team = {
                            'name': ""
                        };
                    }
                    if (run.nl) {
                        run.nlLiveVictimCount = run.nl.liveVictim.filter(victim => victim.identified).length;
                        run.nlDeadVictimCount = run.nl.deadVictim.filter(victim => victim.identified).length;
                        run.nlUnknownVictimCount = run.nl.liveVictim.filter(victim => victim.found && !victim.identified).length + run.nl.deadVictim.filter(victim => victim.found && !victim.identified).length;
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