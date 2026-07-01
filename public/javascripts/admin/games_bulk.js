var xmlHttp;
var obj = [];

var app = angular.module("RunAdmin", ['ngTouch','pascalprecht.translate', 'ngCookies', 'ui.select']);
app.controller("RunAdminController", ['$scope', '$http', function ($scope, $http) {
    $scope.competitionId = competitionId;
    $scope.leagueId = leagueId;

    $http.get(`/api/competitions/${competitionId}`).then(function (response) {
        $scope.competition = response.data;
        $scope.league = response.data.leagues.find((l) => l.league == leagueId);
    
        $http.get(`/api/competitions/${competitionId}/${leagueId}/teams`).then(function (response) {
            $scope.teams = response.data
            $scope.generator.selectedTeams = response.data.slice();
        })
        
        $http.get(`/api/competitions/${competitionId}/rounds`).then(function (response) {
            $scope.rounds = response.data
            $scope.generator.selectedRounds = response.data.slice();
        })
        
        $http.get(`/api/competitions/${competitionId}/fields`).then(function (response) {
            $scope.fields = response.data
            $scope.generator.selectedFields = response.data.slice();
        })
        
        if ($scope.league.type != 'simulation') {
            $http.get(`/api/competitions/${competitionId}/${leagueId}/maps`).then(function (response) {
                $scope.maps = []
                for (let i = 0; i < response.data.length; i++) {
                    if (!response.data[i].parent) {
                        $scope.maps.push(response.data[i]);
                    }
                }
    
                $scope.generator.selectedMaps = $scope.maps.slice();
            })
        }
    })
    
    function find(array,key){
        for(let data of array){
            if(data.name === key)return data._id;
        }
        swal("Error", key + " is not exist!", "error");
        console.log("ERROR : " + key);
        return -1;
    }
    
    function findT(array,key){
        for(let data of array){
            if(data.name === key)return data._id;
        }
        var group = parseInt(key);
        if(isNaN(group)){
            swal("Error", key + " is not exist!", "error");
            return -1;
        }
        else{
            return null;
        }
    }
    
    function findTG(array,key){
        for(let data of array){
            if(data.name === key)return null;
        }
        var group = parseInt(key);
        if(!isNaN(group)){
            
            return group;
        }
        swal("Error", key + " is not exist!", "error");
        return -1;
    }


    $scope.addRun = function () {
        $scope.processing = true;
        $scope.error = false;
        $scope.total = obj.length - 1;
        $scope.now = 0;
        next_add();
    }
    $scope.go = function (path) {
        window.location = path
    }
    
    $scope.mode = 'csv';
    
    $scope.generator = {
        scheduleMode: 'scrambled',
        selectedTeams: [],
        selectedRounds: [],
        selectedFields: [],
        selectedMaps: [],
        slotMinutes: 12,
        smallBreakMultiplier: 3,
        lunchBreakMinutes: 90,
        startTime: '',
        totalDays: 2
    };
    
    $scope.generatedRuns = [];

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${d} ${h}:${min}`;
    }

    $scope.generateSchedule = function () {
        if (!$scope.teams || !$scope.rounds || !$scope.fields) {
            swal("Error", "Teams, rounds, or fields not loaded yet!", "error");
            return;
        }

        if ($scope.league.type != 'simulation' && (!$scope.maps || !$scope.maps.length)) {
            swal("Error", "Maps not loaded yet!", "error");
            return;
        }

        const teams = ($scope.generator.selectedTeams || []).map(t => t.name);

        const rounds = ($scope.generator.selectedRounds || []).map(r => r.name);
        const fields = ($scope.generator.selectedFields || []).map(f => f.name);
        const maps = ($scope.generator.selectedMaps || []).map(m => m.name);
        
        if (!teams.length || !rounds.length || !fields.length) {
            swal('Error', 'Please select at least one team, one round and one field.', 'error');
            return;
        }
        
        if ($scope.league.type != 'simulation' && !maps.length) {
            swal('Error', 'Please select at least one map.', 'error');
            return;
        }

        if ($scope.league.type != 'simulation' && rounds.length !== maps.length) {
            swal('Error', 'Number of selected rounds must match number of selected maps.', 'error');
            return;
        }
        
        const numFields = fields.length;
        const totalDays = parseInt($scope.generator.totalDays) || 2;
        const numRounds = rounds.length;
        const numNormGroups = $scope.league.type != 'simulation' ? maps.length : rounds.length;

        const scheduleMode = $scope.generator.scheduleMode || 'fixedMap';

        if (numRounds % numFields !== 0) {
            swal('Error', 'For a valid schedule, the number of rounds must be divisible by the number of selected fields.', 'error');
            return;
        }

        const expectedDays = numRounds / numFields;
        if (totalDays !== expectedDays) {
            swal('Error', `Selected days (${totalDays}) must equal rounds / fields (${expectedDays}).`, 'error');
            return;
        }

        const roundsPerDay = Math.floor(numRounds / totalDays);
        const slotMinutes = parseInt($scope.generator.slotMinutes) || 12;
        const smallBreakMultiplier = parseInt($scope.generator.smallBreakMultiplier) || 3;
        const lunchBreakMinutes = parseInt($scope.generator.lunchBreakMinutes) || 90;

        if (!numFields || !numRounds || !roundsPerDay) {
            swal("Error", "Invalid generator configuration!", "error");
            return;
        }

        let start = new Date($scope.generator.startTime);
        if (isNaN(start.getTime())) {
            start = new Date();
        }

        const originalStartHour = start.getHours();
        const originalStartMinute = start.getMinutes();

        const shuffledTeams = teams.slice();
        for (let i = shuffledTeams.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = shuffledTeams[i];
            shuffledTeams[i] = shuffledTeams[j];
            shuffledTeams[j] = tmp;
        }

        let columns = [];
        for (let i = 0; i < numFields; i++) {
            columns.push([]);
        }
        shuffledTeams.forEach(function (team, idx) {
            columns[idx % numFields].push(team);
        });

        const rows = [];
        const objRows = [];

        const header = ['Round', 'Team name'];
        if ($scope.league.type != 'simulation') {
            header.push('Map name');
        }
        header.push('Field name', 'Start Time', 'Normalization Group ID');
        rows.push(header);

        let dayCount = 0;

        for (let r = 0; r < numRounds; r++) {
            const currentRoundInDay = r % roundsPerDay;

            for (let i = 0; i < numFields; i++) {
                if (columns[i].length > 0) {
                    columns[i] = columns[i].slice(1).concat(columns[i].slice(0, 1));
                }
            }

            let shiftCount;
            if (numFields === 4 && totalDays === 2) {
                const shiftCountList = [
                    [0, 3, 1, 2],
                    [2, 0, 1, 3]
                ];
                shiftCount = shiftCountList[dayCount] ? shiftCountList[dayCount][r % numFields] : r % numFields;
            } else {
                shiftCount = (dayCount + r) % numFields;
            }

            // fixedMap:
            //   Round defines map/normalization group.
            // scrambled:
            //   Field defines map/normalization group and teams rotate between them.
            const shiftedColumns = columns.slice(shiftCount).concat(columns.slice(0, shiftCount));
            const maxLen = Math.max.apply(null, columns.map(function (column) { return column.length; }));

            for (let slot = 0; slot < maxLen; slot++) {
                const slotTime = new Date(start);

                for (let idx = 0; idx < numFields; idx++) {
                    const teamName = shiftedColumns[idx][slot] || '';
                    if (teamName === '') {
                        continue;
                    }

                    const roundName = rounds[r];
                    let normId;
                    let mapName;
                    let fieldName;

                    if (scheduleMode === 'fixedMap') {
                        normId = r + 1;
                        mapName = $scope.league.type != 'simulation' ? maps[r] : '';
                        fieldName = fields[idx];
                    } else {
                        normId = idx + 1 + (numFields * dayCount);

                        fieldName = fields[idx];

                        mapName = $scope.league.type != 'simulation'
                            ? (maps[normId - 1] || maps[(normId - 1) % maps.length])
                            : '';
                    }
                    const startTime = formatDate(slotTime);

                    if ($scope.league.type != 'simulation') {
                        rows.push([roundName, teamName, mapName, fieldName, startTime, normId]);
                    } else {
                        rows.push([roundName, teamName, fieldName, startTime, normId]);
                    }

                    objRows.push({
                        round: roundName,
                        team: teamName,
                        map: mapName,
                        field: fieldName,
                        startTime: startTime,
                        normalizationGroup: normId
                    });
                }

                start = new Date(start.getTime() + slotMinutes * 60000);
            }

            if ((r + 1) % roundsPerDay !== 0) {
                if ((r + 1) % roundsPerDay === 2) {
                    start = new Date(start.getTime() + lunchBreakMinutes * 60000);
                } else {
                    start = new Date(start.getTime() + (slotMinutes * smallBreakMultiplier * 60000));
                }
            }

            if ((r + 1) % roundsPerDay === 0 && r !== numRounds - 1) {
                const nextDay = new Date(start);
                nextDay.setDate(nextDay.getDate() + 1);
                nextDay.setHours(originalStartHour, originalStartMinute, 0, 0);
                start = new Date(nextDay.getTime() + 60 * 60000);
                dayCount++;
            }
        }

        obj = rows;
        $scope.generatedRuns = objRows;
        renderPreview();
    }

    // --- Preview Table Renderer ---
    function renderPreview() {
        var result = document.getElementById('result');
        if (!obj || !obj.length) {
            result.innerHTML = '';
            return;
        }
        var insert = '<table class="custom"><thead><tr><th>Round</th><th>Team name</th>';
        if ($scope.league && $scope.league.type != 'simulation') {
            insert += '<th>Map name</th>';
        }
        insert += '<th>Field name</th><th>Start Time</th><th>Normalization Group ID</th></tr></thead><tbody>';
        for (var i = 1; i < obj.length; i++) {
            insert += '<tr>';
            insert += '<td>';
            insert += obj[i][0];
            insert += '</td>';

            insert += '<td>';
            insert += obj[i][1];
            insert += '</td>';

            if ($scope.league && $scope.league.type != 'simulation') {
                insert += '<td>';
                insert += obj[i][2];
                insert += '</td>';
            }

            insert += '<td>';
            insert += obj[i][$scope.league && $scope.league.type != 'simulation' ? 3 : 2];
            insert += '</td>';

            insert += '<td>';
            insert += new Date(obj[i][$scope.league && $scope.league.type != 'simulation' ? 4 : 3]);
            insert += '</td>';

            insert += '<td>';
            insert += obj[i][$scope.league && $scope.league.type != 'simulation' ? 5 : 4];
            insert += '</td>';

            insert += '</tr>';
        }
        insert += '</tbody></table>';
        result.innerHTML = insert;
    }

    

    exe = function () {
        const isSim = $scope.league && $scope.league.type == 'simulation';
        var time = new Date(obj[$scope.now][isSim ? 3 : 4]);

        var run = {
            round: find($scope.rounds,obj[$scope.now][0]),
            team: findT($scope.teams,obj[$scope.now][1]),
            group: findTG($scope.teams,obj[$scope.now][1]),
            field: find($scope.fields,obj[$scope.now][isSim ? 2 : 3]),
            competition: competitionId,
            startTime: time.getTime(),
            normalizationGroup: obj[$scope.now][isSim ? 4 : 5]
        }

        if (!isSim) {
            run['map'] = find($scope.maps,obj[$scope.now][2]);
        }
        

        $http.post(`/api/runs/${$scope.league.type}`, run).then(function (response) {
            next_add();
        }, function (error) {
            console.log(error)
            swal("Oops!", error.data.err, "error");
            $scope.processing = false;
            $scope.completed = false;
            $scope.error = true;
            if ($scope.$root.$$phase != '$apply' && $scope.$root.$$phase != '$digest') {
                $scope.$apply();
            }
            return;
        })

    }

    next_add = function () {
        $scope.now++;
        console.log("NEXT ->" + $scope.now);
        if ($scope.now > obj.length - 1) {
            $scope.processing = false;
            $scope.completed = true;
            $scope.error = false;
            if ($scope.$root.$$phase != '$apply' && $scope.$root.$$phase != '$digest') {
                $scope.$apply();
            }
            return;
        }
        setTimeout(exe, 10);

    }



        // File APIに対応しているか確認
        if (window.File) {
            var result = document.getElementById('result');
            var select = document.getElementById('select');

            // ファイルが選択されたとき
            select.addEventListener('change', function (e) {
                // 選択されたファイルの情報を取得
                var fileData = e.target.files[0];

                var reader = new FileReader();
                // ファイル読み取りに失敗したとき
                reader.onerror = function () {
                    alert('ファイル読み取りに失敗しました')
                }
                // ファイル読み取りに成功したとき
                reader.onload = function () {
                    // 行単位で配列にする
                    obj = $.csv()(reader.result);
                    console.log(obj)
                    renderPreview();
                }

                // ファイル読み取りを実行
                reader.readAsText(fileData, 'Shift_JIS');
            }, false);
        }


    /* Usage:
     *  jQuery.csv()(csvtext)		returns an array of arrays representing the CSV text.
     *  jQuery.csv("\t")(tsvtext)		uses Tab as a delimiter (comma is the default)
     *  jQuery.csv("\t", "'")(tsvtext)	uses a single quote as the quote character instead of double quotes
     *  jQuery.csv("\t", "'\"")(tsvtext)	uses single & double quotes as the quote character
     *  jQuery.csv(",", "", "\n")(tsvtext)	カンマ区切りで改行コード「\n」
     */
    jQuery.extend({
        csv: function (delim, quote, lined) {
            delim = typeof delim == "string" ? new RegExp("[" + (delim || ",") +
                    "]") : typeof delim ==
                "undefined" ? "," : delim;
            quote = typeof quote == "string" ? new RegExp("^[" + (quote || '"') +
                    "]") : typeof quote ==
                "undefined" ? '"' : quote;
            lined = typeof lined == "string" ? new RegExp("[" + (lined || "\r\n") +
                    "]+") : typeof lined ==
                "undefined" ? "\r\n" : lined;

            function splitline(v) {
                // Split the line using the delimitor
                var arr = v.split(delim),
                    out = [],
                    q;
                for (var i = 0, l = arr.length; i < l; i++) {
                    if (q = arr[i].match(quote)) {
                        for (j = i; j < l; j++) {
                            if (arr[j].charAt(arr[j].length - 1) == q[0]) {
                                break;
                            }
                        }
                        var s = arr.slice(i, j + 1).join(delim);
                        out.push(s.substr(1, s.length - 2));
                        i = j;
                    } else {
                        out.push(arr[i]);
                    }
                }

                return out;
            }

            return function (text) {
                var lines = text.split(lined);
                for (var i = 0, l = lines.length; i < l; i++) {
                    lines[i] = splitline(lines[i]);
                }

                // 最後の行を削除
                var last = lines.length - 1;
                if (lines[last].length == 1 && lines[last][0] == "") {
                    lines.splice(last, 1);
                }

                return lines;
            };
        }
    });


}])
