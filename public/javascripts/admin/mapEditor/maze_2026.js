// register the directive with your app module
var app = angular.module('MazeEditor', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('MazeEditorController', ['$scope', '$uibModal', '$log', '$http','$translate', function ($scope, $uibModal, $log, $http, $translate) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
    $scope.pdfSettings = {
        noQR: true
    };
    $scope.competitionId = competitionId;
    $scope.mapId = mapId;
    if(!pubService){
        $http.get("/api/competitions/").then(function (response) {
            $scope.competitions = response.data
            $scope.se_competition = competitionId
        })
        $http.get("/api/competitions/" + $scope.competitionId + "/" + leagueId + "/maps").then(function (response) {
            $scope.maps = {}
            for (let i = 0; i < response.data.length; i++) {
                if (response.data[i].parent == mapId || response.data[i]._id == mapId) {
                    $scope.maps[i] = response.data[i]
                }
            }
        })
    }

    $scope.z = 0;
    $scope.startTile = {
        x: 0,
        y: 0,
        z: 0
    };
    $scope.height = 1;
    $scope.width = 1;
    $scope.length = 1;
    $scope.duration = 480;
    $scope.name = "Awesome Testbana";
    $scope.cells = {};
    $scope.dice = [];
    $scope.saveasname ="";
    $scope.finished = true;
    $scope.leagueType = "standard";

    if(!pubService){
        $http.get("/api/competitions/" +
          $scope.competitionId).then(function (response) {
            $scope.competition = response.data;
            $scope.league = response.data.leagues.find((l) => l.league == leagueId);
        })
    }


    if (mapId) {
        
        $http.get("/api/maps/maze/" + mapId +
            "?populate=true").then(function (response) {
            console.log(response.data);
            $scope.startTile = response.data.startTile;
            $scope.height = response.data.height;
            $scope.width = response.data.width;
            $scope.duration = response.data.duration || 480;
            $scope.length = response.data.length;
            $scope.name = response.data.name;
            $scope.finished = true;
            $scope.competitionId = response.data.competition;
            $scope.leagueType = response.data.leagueType;


            try {
                $scope.parent = response.data.parent;
            } catch (e) {
                $scope.parent = "";
            }
            if (response.data.dice) {
                $scope.dice = response.data.dice;
            } else {
                $scope.dice = [];
                for (let i = 0; i < 6; i++) {
                    $scope.dice[i] = mapId
                }
            }




            for (var i = 0; i < response.data.cells.length; i++) {
                $scope.cells[response.data.cells[i].x + ',' +
                    response.data.cells[i].y + ',' +
                    response.data.cells[i].z] = response.data.cells[i];

            }

            // Post-process cells to initialize cognitiveTargets for tiles with Cognitive victims
            // This handles backward compatibility with saved data that predates cognitiveTargets
            for (var key in $scope.cells) {
                var cell = $scope.cells[key];
                if (cell.isTile && cell.tile && cell.tile.victims) {
                    var directions = ['top', 'right', 'bottom', 'left'];
                    for (var j = 0; j < directions.length; j++) {
                        var dir = directions[j];
                        if (cell.tile.victims[dir] === 'Cognitive') {
                            // Initialize cognitiveTargets if not exists
                            if (!cell.tile.cognitiveTargets) {
                                cell.tile.cognitiveTargets = {};
                            }
                            // Initialize this direction if not exists
                            if (!cell.tile.cognitiveTargets[dir]) {
                                cell.tile.cognitiveTargets[dir] = {
                                    rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' }
                                };
                            }
                        }
                    }
                }
            }

        });
    }
    

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }
    
    $scope.changeFloor = function (z){
        $scope.z = z;
    }
    
    $scope.go = function (path) {
        window.location = path
    }

    $scope.$watchCollection('startTile', function (newValue, oldValue) {
        $scope.recalculateLinear();
    });
    
    $scope.$watchCollection('cells', function (newValue, oldValue) {
        
        $scope.recalculateLinear();
    });

    $scope.isUndefined = function (thing) {
        return (typeof thing === "undefined");
    }
    $scope.recalculateLinear = function () {
        //console.log($scope.cells)
        $scope.virtualWall = [];
        //console.log($scope.cells);
        if ($scope.startNotSet())
            return;

        // Reset all previous linear walls
        for (var index in $scope.cells) {
            $scope.cells[index].isLinear = false;
            $scope.cells[index].virtualWall = false;
            $scope.cells[index].ignoreWall = false;
            $scope.cells[index].changeFloorWall = undefined;
            if ($scope.cells[index].tile) {
                $scope.cells[index].tile.reachable= false;
            }       
        }
        
        let startTilePosition = $scope.startTile.x + "," + $scope.startTile.y + "," + $scope.startTile.z;
        for (var index in $scope.cells) {
            if($scope.cells[index].tile){
                let tile = $scope.cells[index].tile;
                var x = Number(index.split(',')[0]);
                var y = Number(index.split(',')[1]);
                var z = Number(index.split(',')[2]);
                // Set to virtual wall around the black tile and start tile
                if(tile.black || index == startTilePosition){
                    setVirtualWall(x, y-1, z);
                    setVirtualWall(x+1, y, z);
                    setVirtualWall(x-1, y, z);
                    setVirtualWall(x, y+1, z);
                }

                // Remove wall from elevator
                if (tile.changeFloorTo != undefined && tile.changeFloorTo != z) {
                    setIgnoreWall(x, y-1, z, tile.changeFloorTo);
                    setIgnoreWall(x+1, y, z, tile.changeFloorTo);
                    setIgnoreWall(x-1, y, z, tile.changeFloorTo);
                    setIgnoreWall(x, y+1, z, tile.changeFloorTo);
                }
            }
        }

        // Start it will all 4 + 8 walls around the starting tile
        recurs($scope.startTile.x - 1, $scope.startTile.y, $scope.startTile.z);
        recurs($scope.startTile.x + 1, $scope.startTile.y, $scope.startTile.z);
        recurs($scope.startTile.x, $scope.startTile.y - 1, $scope.startTile.z);
        recurs($scope.startTile.x, $scope.startTile.y + 1, $scope.startTile.z);

        //Top Left
        recurs($scope.startTile.x-1, $scope.startTile.y - 2, $scope.startTile.z);
        recurs($scope.startTile.x-2, $scope.startTile.y - 1, $scope.startTile.z);

        //Top Right
        recurs($scope.startTile.x+1, $scope.startTile.y - 2, $scope.startTile.z);
        recurs($scope.startTile.x+2, $scope.startTile.y - 1, $scope.startTile.z);

        //Bottom Left
        recurs($scope.startTile.x-1, $scope.startTile.y + 2, $scope.startTile.z);
        recurs($scope.startTile.x-2, $scope.startTile.y + 1, $scope.startTile.z);

        //Bottom Right
        recurs($scope.startTile.x+1, $scope.startTile.y + 2, $scope.startTile.z);
        recurs($scope.startTile.x+2, $scope.startTile.y + 1, $scope.startTile.z);

        reachable($scope.startTile.x, $scope.startTile.y, $scope.startTile.z);
    }

    function isOdd(num) {
        return num % 2;
    }

    function reachable(x, y, z) {
        if (x > $scope.width * 2 + 1 || x < 0 ||
            y > $scope.length * 2 + 1 || y < 0 ||
            z > $scope.height || z < 0)
            return;
    
        if ($scope.cells[pos(x,y,z)] != undefined && $scope.cells[pos(x,y,z)].tile && $scope.cells[pos(x,y,z)].tile.reachable) return;
        setReachable(x, y, z);

        // Top
        if (!wallExist(x, y-1, z)) {
            reachable(x, y-2, z);
        }
        // Right
        if (!wallExist(x+1, y, z)) {
            reachable(x+2, y, z);
        }
        // Left
        if (!wallExist(x-1, y, z)) {
            reachable(x-2, y, z);
        }
        // Bottom
        if (!wallExist(x, y+1, z)) {
            reachable(x, y+2, z);
        }

        // Elevator
        if ($scope.cells[pos(x,y,z)].tile.changeFloorTo != undefined && $scope.cells[pos(x,y,z)].tile.changeFloorTo != z) {
            reachable(x, y, $scope.cells[pos(x,y,z)].tile.changeFloorTo);
        }
    }

    function pos(x, y, z) {
        return `${x},${y},${z}`;
    }

    function wallExist(x, y, z) {
        let cell = $scope.cells[pos(x,y,z)];
        if (!cell) return false;
        return cell.isWall == true;
    }

    function setReachable(x, y, z) {
        if ($scope.cells[pos(x,y,z)]) {
            $scope.cells[pos(x,y,z)].tile.reachable = true;
        } else {
            $scope.cells[pos(x,y,z)] = {
                isTile: true,
                isLinear: false,
                tile: {
                    reachable: true
                }
            };
        }
    }

    function setIgnoreWall(x, y, z, nextLvl) {
        if ($scope.cells[pos(x,y,z)]) {
            $scope.cells[pos(x,y,z)].ignoreWall = !(wallExist(x,y,z) && wallExist(x,y,nextLvl));
            $scope.cells[pos(x,y,z)].changeFloorWall = nextLvl;
        } else {
            $scope.cells[pos(x,y,z)] = {
                ignoreWall: !(wallExist(x,y,z) && wallExist(x,y,nextLvl)),
                changeFloorWall: nextLvl
            };
        }
    }

    function setVirtualWall(x, y, z) {
        if ($scope.cells[pos(x,y,z)]) {
            $scope.cells[pos(x,y,z)].virtualWall = true;
        } else {
            $scope.cells[pos(x,y,z)] = {
                virtualWall: true
            };
        }
    }

    function recurs(x, y, z) {
        if (x < 0 || y < 0 || z < 0) {
            return;
        }

        var cell = $scope.cells[x + ',' + y + ',' + z];
        
        

        
        // If this is a wall that doesn't exists
        if (!cell)
            return;
        // Outside of the current maze size. 
        if (x > $scope.width * 2 + 1 || x < 0 ||
            y > $scope.length * 2 + 1 || y < 0 ||
            z > $scope.height || z < 0)
            return;

        // Already visited this, returning
        if (cell.isLinear)
            return;
        if ((cell.isWall || cell.virtualWall) && cell.ignoreWall != true) {
            cell.isLinear = true;

            // horizontal walls
            if (isOdd(x) && !isOdd(y)) {
                // Set tiles around this wall to linear
                setTileLinear(x - 2, y - 1, z);
                setTileLinear(x, y - 1, z);
                setTileLinear(x + 2, y - 1, z);
                setTileLinear(x - 2, y + 1, z);
                setTileLinear(x, y + 1, z);
                setTileLinear(x + 2, y + 1, z);
                // Check neighbours
                recurs(x + 2, y, z);
                recurs(x - 2, y, z);
                recurs(x - 1, y - 1, z);
                recurs(x - 1, y + 1, z);
                recurs(x + 1, y - 1, z);
                recurs(x + 1, y + 1, z);
            } // Vertical wall
            else if (!isOdd(x) && isOdd(y)) {
                // Set tiles around this wall to linear
                setTileLinear(x - 1, y - 2, z);
                setTileLinear(x - 1, y, z);
                setTileLinear(x - 1, y + 2, z);
                setTileLinear(x + 1, y - 2, z);
                setTileLinear(x + 1, y, z);
                setTileLinear(x + 1, y + 2, z);
                // Check neighbours
                recurs(x, y - 2, z);
                recurs(x, y + 2, z);
                recurs(x - 1, y - 1, z);
                recurs(x - 1, y + 1, z);
                recurs(x + 1, y - 1, z);
                recurs(x + 1, y + 1, z);
            }
        }

        if (cell.isWall && cell.ignoreWall != true && cell.changeFloorWall != undefined) {
            cell.isLinear = true;

            // horizontal walls
            if (isOdd(x) && !isOdd(y)) {
                // Set tiles around this wall to linear
                setTileLinear(x - 2, y - 1, cell.changeFloorWall);
                setTileLinear(x, y - 1, cell.changeFloorWall);
                setTileLinear(x + 2, y - 1, cell.changeFloorWall);
                setTileLinear(x - 2, y + 1, cell.changeFloorWall);
                setTileLinear(x, y + 1, cell.changeFloorWall);
                setTileLinear(x + 2, y + 1, cell.changeFloorWall);
                // Check neighbours
                recurs(x + 2, y, cell.changeFloorWall);
                recurs(x - 2, y, cell.changeFloorWall);
                recurs(x - 1, y - 1, cell.changeFloorWall);
                recurs(x - 1, y + 1, cell.changeFloorWall);
                recurs(x + 1, y - 1, cell.changeFloorWall);
                recurs(x + 1, y + 1, cell.changeFloorWall);
            } // Vertical wall
            else if (!isOdd(x) && isOdd(y)) {
                // Set tiles around this wall to linear
                setTileLinear(x - 1, y - 2, cell.changeFloorWall);
                setTileLinear(x - 1, y, cell.changeFloorWall);
                setTileLinear(x - 1, y + 2, cell.changeFloorWall);
                setTileLinear(x + 1, y - 2, cell.changeFloorWall);
                setTileLinear(x + 1, y, cell.changeFloorWall);
                setTileLinear(x + 1, y + 2, cell.changeFloorWall);
                // Check neighbours
                recurs(x, y - 2, cell.changeFloorWall);
                recurs(x, y + 2, cell.changeFloorWall);
                recurs(x - 1, y - 1, cell.changeFloorWall);
                recurs(x - 1, y + 1, cell.changeFloorWall);
                recurs(x + 1, y - 1, cell.changeFloorWall);
                recurs(x + 1, y + 1, cell.changeFloorWall);
            }
        }
    }

    function setTileLinear(x, y, z) {
        if (x < 0 || y < 0 || z < 0) {
            return;
        }

        // Check that this is an actual tile, not a wall
        var cell = $scope.cells[x + ',' + y + ',' + z];
        if (cell) {
            cell.isLinear = true;
        } else {
            $scope.cells[x + ',' + y + ',' + z] = {
                isTile: true,
                isLinear: true,
                tile: {
                    changeFloorTo: z
                }
            };
        }
    }

    $scope.startNotSet = function () {
        return $scope.startTile.x == 0 && $scope.startTile.y == 0 &&
            $scope.startTile.z == 0;
    }


    $scope.childNew = function (num) {
        if ($scope.startNotSet()) {
            alert("You must define a starting tile by clicking a tile");
            return;
        }
        var map = {
            competition: $scope.competitionId,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            leagueType: $scope.leagueType,
            league: leagueId
        };
        console.log(map);
        console.log("Update map", mapId);
        console.log("Competition ID", $scope.competitionId);
        if (mapId) {
            $http.put("/api/maps/maze/" + mapId, map).then(function (response) {
                console.log(response.data);
            }, function (response) {
                console.log(response);
                console.log("Error: " + response.statusText);
                alert(response.data.msg + ": " + response.data.err);
            });
        } else {
            $http.post("/api/maps/maze", map).then(function (response) {
                console.log(response.data);
            }, function (response) {
                console.log(response);
                console.log("Error: " + response.statusText);
                alert(response.data.msg + ": " + response.data.err);
            });
        }


        if ($scope.startNotSet()) {
            alert("You must define a starting tile by clicking a tile");
            return;
        }


        var map = {
            competition: $scope.competitionId,
            parent: $scope.mapId,
            name: $scope.name + " - Pattern: " + num,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            leagueType: $scope.leagueType,
            league: leagueId
        };
        $http.post("/api/maps/maze", map).then(function (response) {
            console.log(response.data);
            $scope.dice[num-1] = response.data.id;
            $scope.saveMap($scope.dice[num-1]);
        }, function (response) {
            console.log(response);
            console.log("Error: " + response.statusText);
            alert(response.data.msg);
        });
        
        
    }

    $scope.itemNumber = function(type,x,y,z){
        let count = 0;
        for(let i=1,l=$scope.length*2+1;i<l;i+=2){
            for(let j=1,m=$scope.width*2+1;j<m;j+=2){
                for(let k=0;k<$scope.height;k++) {
                    if(!$scope.cells[j + ',' + i + ',' + k]) continue;
                    if($scope.cells[j + ',' + i + ',' + k].tile[type]) count++;
                    if(x == j && y == i && z == k) return count;
                }
            }
        }
        return count;
    };

    $scope.victimNumber = function(type,x,y,z,place){
        let count = 0;
        for(let i=1,l=$scope.length*2+1;i<l;i+=2){
            for(let j=1,m=$scope.width*2+1;j<m;j+=2){
                for(let k=0;k<$scope.height;k++) {
                    if(!$scope.cells[j + ',' + i + ',' + k]) continue;
                    let victims = $scope.cells[j + ',' + i + ',' + k].tile.victims;
                    if(victims){
                        // Count all victim types consecutively
                        let victimPlaces = ['top', 'left', 'right', 'bottom'];
                        for(let p = 0; p < victimPlaces.length; p++){
                            let vp = victimPlaces[p];
                            if (victims[vp] == 'None') continue;
                            count++;
                            if(x == j && y == i && z == k && place == vp){
                                return big[count-1];
                            }
                        }
                    }
                }
            }
        }
    };

    $scope.isDummy = function (x, y, z, direction) {
        let cell = $scope.cells[x + ',' + y + ',' + z];
        if (!cell || !cell.tile || !cell.tile.victims) return false;
        let type = cell.tile.victims[direction];
        if (type === 'Cognitive') {
            if (!cell.tile.cognitiveTargets || !cell.tile.cognitiveTargets[direction] || !cell.tile.cognitiveTargets[direction].rings) return true;
            let rings = cell.tile.cognitiveTargets[direction].rings;
            let colorValues = { 'B': -2, 'R': -1, 'Y': 0, 'G': 1, 'C': 2 };
            let total = 0;
            for (let i = 1; i <= 5; i++) {
                total += colorValues[rings['ring' + i]] || 0;
            }
            if (total >= 0 && total <= 2) return false;
            return true; // Dummy
        }
        return false;
    };

    function Range(first, last) {
        var first = first.charCodeAt(0);
        var last = last.charCodeAt(0);
        var result = new Array();
        for(var i = first; i <= last; i++) {
            result.push(String.fromCodePoint(i));
        }
        return result;
    }
    var big = Range('A', 'Z');
    var small = Range('a', 'z');

    $scope.isVictim = function(type,x,y,z){
        if($scope.cells[x + ',' + y + ',' + z] && $scope.cells[x + ',' + y + ',' + z].tile){
            if($scope.cells[x + ',' + y + ',' + z].tile.victims.bottom == type) return true;
            if($scope.cells[x + ',' + y + ',' + z].tile.victims.top == type) return true;
            if($scope.cells[x + ',' + y + ',' + z].tile.victims.right == type) return true;
            if($scope.cells[x + ',' + y + ',' + z].tile.victims.left == type) return true;
            if($scope.cells[x + ',' + y + ',' + z].tile.victims.floor == type) return true;
        }
        return false;
    };

    $scope.makeImageDl = function(){
        window.location.href = "/api/maps/maze/image/" + $scope.mapId;
    };

    $scope.hasPrintableTargets = function() {
        for (const key in $scope.cells) {
            const cell = $scope.cells[key];
            if (cell.isTile && cell.tile && cell.tile.victims) {
                const directions = ['top', 'right', 'bottom', 'left'];
                for (const dir of directions) {
                    const v = cell.tile.victims[dir];
                    if (v === 'Cognitive' || v === 'PHI' || v === 'PSI' || v === 'OMEGA' || v === 'H' || v === 'S' || v === 'U') {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    $scope.hasCognitiveTargetsOnly = function() {
        for (const key in $scope.cells) {
            const cell = $scope.cells[key];
            if (cell.isTile && cell.tile && cell.tile.victims) {
                const directions = ['top', 'right', 'bottom', 'left'];
                for (const dir of directions) {
                    if (cell.tile.victims[dir] === 'Cognitive') {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    // Initialize paper size selection using object to avoid scope inheritance issues
    $scope.pdfSettings = {
        paperSize: 'A4',
        includeLetterVictims: true,
        includeCognitiveTargets: true,
        noQR: true,
        exportType: 'Maps',
        exportFormat: 'PDF'
    };

    $scope.onPaperSizeChange = function() {
        console.log('Paper size changed to:', $scope.pdfSettings.paperSize);
    };

    $scope.printMapImage = function() {
        const paperSize = $scope.pdfSettings.paperSize || 'A4';
        const map = {
            competition: $scope.competitionId,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            leagueType: $scope.leagueType,
            league: leagueId,
            paperSize: paperSize,
            competitionName: $scope.competition ? $scope.competition.name : 'Competition',
            leagueName: leagueId
        };

        $http.post('/api/maps/maze/map-image-pdf', map, { responseType: 'arraybuffer' })
            .then(function(response) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const fileURL = URL.createObjectURL(blob);
                window.open(fileURL, '_blank');
            }, function(response) {
                console.error("PDF Error", response);
                alert("Error generating PDF");
            });
    };

    $scope.generateOutput = function() {
        if ($scope.pdfSettings.exportType === 'Targets') {
            $scope.generateCompetitionTargetsPDF();
        } else if ($scope.pdfSettings.exportType === 'Scoresheets') {
            $scope.generateScoreSheet();
        } else if ($scope.pdfSettings.exportType === 'Maps') {
            if ($scope.pdfSettings.exportFormat === 'PDF') {
                $scope.printMapImage();
            } else {
                $scope.makeImageDl();
            }
        }
    };

    $scope.generateCompetitionTargetsPDF = function() {
        const paperSize = $scope.pdfSettings.paperSize;
        const includeLetterVictims = $scope.pdfSettings.includeLetterVictims;
        const includeCognitiveTargets = $scope.pdfSettings.includeCognitiveTargets;
        
        if (!includeLetterVictims && !includeCognitiveTargets) {
            alert("Please select at least one target type to print");
            return;
        }

        const map = {
            competition: $scope.competitionId,
            dice: $scope.dice,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            duration: $scope.duration,
            width: $scope.width,
            leagueType: $scope.leagueType,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            league: leagueId,
            paperSize: paperSize,
            includeLetterVictims: includeLetterVictims,
            includeCognitiveTargets: includeCognitiveTargets
        };
        
        $http.post('/api/maps/maze/competition-targets-pdf', map, { responseType: 'arraybuffer' })
            .then(function(response) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const fileURL = URL.createObjectURL(blob);
                window.open(fileURL, '_blank');
            }, function(response) {
                console.error("PDF Error", response);
                alert("Error generating PDF");
            });
    };


    $scope.wallColor = function(x,y,z){
        let cell = $scope.cells[x+','+y+','+z];
        if(!cell) return {};
        if(cell.isWall) {
            if (cell.isLinear) return {'background-color': 'black'};
            else if (cell.ignoreWall) return {'background-color': 'green'};
            else return {'background-color': 'navy'};
        }
    };

    $scope.openSaveAsModal = function () {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'saveAsModal.html',
            controller: 'SaveAsModalCtrl',
            size: 'md',
            resolve: {
                competitions: function () {
                    return $scope.competitions;
                },
                currentCompetitionId: function () {
                    return $scope.competitionId;
                },
                currentName: function () {
                    return $scope.name;
                }
            }
        });

        modalInstance.result.then(function (result) {
            $scope.saveMapAs(result.name, result.competitionId);
        }, function () {
            $log.info('Modal dismissed at: ' + new Date());
        });
    };


    $scope.saveMapAs = function (name, competitionId) {
        if ($scope.startNotSet()) {
            alert("You must define a starting tile by clicking a tile");
            return;
        }
        if (name == $scope.name && $scope.se_competition == competitionId) {
            alert("You must have a new name when saving as!");
            return;
        }


        var map = {
            competition: competitionId,
            name: name,
            length: $scope.length,
            height: $scope.height,
            duration: $scope.duration,
            width: $scope.width,
            leagueType: $scope.leagueType,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            league: leagueId
        };
        $http.post("/api/maps/maze", map).then(function (response) {
            alert("Created map!");
            console.log(response.data);
            window.location.replace("/admin/" + $scope.se_competition + "/" + leagueId + "/mapEditor/" + response.data.id)
        }, function (response) {
            console.log(response);
            console.log("Error: " + response.statusText);
            alert(response.data.msg);
        });
    }

    $scope.saveMap = function (loc, callback = null) {
        if ($scope.startNotSet()) {
            alert("You must define a starting tile by clicking a tile");
            return;
        }
        var map = {
            competition: $scope.competitionId,
            dice: $scope.dice,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            duration: $scope.duration,
            width: $scope.width,
            leagueType: $scope.leagueType,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            league: leagueId
        };
        if (mapId) {
            $http.put("/api/maps/maze/" + mapId, map).then(function (response) {
                if (callback == null) {
                    Toast.fire({
                        type: 'success',
                        title: "Updated map"
                    })
                    if (loc) window.location.replace("/admin/" + competitionId + "/" + leagueId + "/mapEditor/" + loc)
                } else {
                    callback();
                }
            }, function (response) {
                console.log("Error: " + response.statusText);
                if (callback == null) {
                    Toast.fire({
                        type: 'error',
                        title: "Error",
                        html: response.data.msg
                    })
                    if (loc) window.location.replace("/admin/" + competitionId + "/" + leagueId + "/mapEditor/" + loc)
                } else {
                    callback();
                }
            });
        } else {
            $http.post("/api/maps/maze", map).then(function (response) {
                Toast.fire({
                    type: 'success',
                    title: "Created map"
                })
                if (loc) window.location.replace("/admin/" + competitionId + "/" + leagueId + "/mapEditor/" + loc)
                else window.location.replace("/admin/" + competitionId + "/" + leagueId + "/mapEditor/" + response.data.id)
            }, function (response) {
                console.log("Error: " + response.statusText);
                if (callback == null) {
                    Toast.fire({
                        type: 'error',
                        title: "Error",
                        html: response.data.msg
                    })
                    if (loc) window.location.replace("/admin/" + competitionId + "/" + leagueId + "/mapEditor/" + loc)
                } else {
                    callback();
                }
            });
        }
    }

    $scope.openMaxScore = function(){
        $scope.saveMap(null, function () {
            $http.get(`/api/maps/maze/${mapId}/maxScore`).then(function (response) {
                let score = response.data.score;
                let html = `
                <div class='text-center'>
                    <i class='fas fa-calculator fa-3x'></i>
                </div><hr>
                <p style='font-size:50px'>${score}</p>
                `;
                Swal.fire({
                    html: html,
                    showCloseButton: true, 
                })
            }, function (response) {
                console.log("Error: " + response.statusText);
            });
        });
    }
    
    $scope.export = function(){
        var map = {
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            leagueType: $scope.leagueType,
            duration: $scope.duration,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells
        };
         var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(map))
         var downloadLink = document.createElement('a')
         document.body.appendChild(downloadLink);
         downloadLink.setAttribute("href",dataStr)
         downloadLink.setAttribute("download", $scope.name + '.json')
         downloadLink.click()
         document.body.removeChild(downloadLink);
    }
    
     // File APIに対応しているか確認
        if (window.File) {
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
                    var data = JSON.parse(reader.result);
                    $scope.cells = data.cells;
                    $scope.competitionId = competitionId;

                    $scope.startTile = data.startTile;
                    $scope.numberOfDropTiles = data.numberOfDropTiles;
                    $scope.height = data.height;
                    $scope.width = data.width;
                    $scope.length = data.length;
                    $scope.duration = data.duration || 480;
                    $scope.name = data.name;
                    $scope.finished = data.finished;
                    $scope.leagueType = data.leagueType;
                    
                    if(data.startTile) $scope.cells[data.startTile.x + ',' + data.startTile.y + ',' + data.startTile.z].tile.checkpoint = false;
                    
                    $scope.$apply();
                }

                // ファイル読み取りを実行
                reader.readAsText(fileData);
            }, false);
        }


    $scope.showRow = function (r, z) {
        for (let c of $scope.range(2*$scope.width + 1)) {
            let cell = $scope.cells[`${c},${r},${z}`];
            if (!cell) continue;
            if (cell.isTile) {
                if (cell.tile.reachable) {
                    return true;
                }
            } else {
                // Check surrounding tiles
                if (r % 2 == 1) {
                    // Check left and right
                    if (
                        checkTileReachable(c-1, r, z) ||
                        checkTileReachable(c+1, r, z)
                    ) {
                        return true;
                    }
                } else {
                    // Check up and bottom
                    if (
                        checkTileReachable(c, r-1, z) ||
                        checkTileReachable(c, r+1, z)
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Show cell for output image with specific conditions (per-cell basis):
    // - Tile cells (odd c, odd r): show if tile exists (isTile)
    // - Horizontal wall cells (odd c, even r): show if tile above OR below exists
    // - Vertical wall cells (even c, odd r): show if tile left OR right exists
    // - Intersection cells (even c, even r): show if any adjacent tile exists
    $scope.showCellOutput = function (c, r, z) {
        const isTileCol = c % 2 === 1;
        const isTileRow = r % 2 === 1;
        
        // Tile cell (intersection of tile row and tile column)
        if (isTileCol && isTileRow) {
            return checkTileExists(c, r, z);
        }
        
        // Horizontal wall cell (between tile rows)
        if (isTileCol && !isTileRow) {
            return checkTileExists(c, r - 1, z) || checkTileExists(c, r + 1, z);
        }
        
        // Vertical wall cell (between tile columns)
        if (!isTileCol && isTileRow) {
            return checkTileExists(c - 1, r, z) || checkTileExists(c + 1, r, z);
        }
        
        // Intersection cell (corner) - show if any adjacent tile exists
        return checkTileExists(c - 1, r - 1, z) || 
               checkTileExists(c + 1, r - 1, z) ||
               checkTileExists(c - 1, r + 1, z) || 
               checkTileExists(c + 1, r + 1, z);
    }
    
    // Check if a tile exists at the given coordinates
    function checkTileExists(c, r, z) {
        let cell = $scope.cells[`${c},${r},${z}`];
        if (!cell) return false;
        return cell.isTile;
    }

    function checkTileReachable(c, r, z) {
        let cell = $scope.cells[`${c},${r},${z}`];
        if (!cell) return false;
        if (!cell.isTile) return false;
        if (cell.tile.reachable) {
            return true;
        }
        return false;
    }

    $scope.cellClick = function (x, y, z, isWall, isTile) {

        var cell = $scope.cells[x + ',' + y + ',' + z];

        // If wall 
        if (isWall) {
            if (!cell) {
                $scope.cells[x + ',' + y + ',' + z] = {
                    isWall: true,
                    halfWall: 0
                };
            } else {
                if(cell.isWall){
                    cell.isWall = false;
                    /*cell.halfWall = 1;
                }else if(cell.halfWall == 1){
                    cell.halfWall = 2;
                }else if(cell.halfWall == 2){
                    cell.halfWall = 0;*/
                }else{
                    cell.isWall = true;
                }
            }
        } else if (isTile) {
            if (!cell) {
                $scope.cells[x + ',' + y + ',' + z] = {
                    isTile: true,
                    tile: {
                        changeFloorTo: z
                    }
                };
            }
            $scope.open(x, y, z);
        }
        $scope.recalculateLinear();
    }

    $scope.open = function (x, y, z) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/maze_editor_modal_2026.html',
            controller: 'ModalInstanceCtrl',
            size: 'lg',
            windowClass: 'modal-centered',
            scope: $scope,
            resolve: {
                x: function () {
                    return x;
                },
                y: function () {
                    return y;
                },
                z: function () {
                    return z;
                }
            }
        });
    };
    
    $scope.generateScoreSheet = function() {
        const map = {
            competition: $scope.competitionId,
            dice: $scope.dice,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            duration: $scope.duration,
            width: $scope.width,
            leagueType: $scope.leagueType,
            finished: $scope.finished,
            startTile: $scope.startTile,
            cells: $scope.cells,
            league: leagueId,
            rule: '2026',
            noQR: $scope.pdfSettings.noQR
        };
        
        $http.post('/api/maps/maze/scoresheet', map, { responseType: 'arraybuffer' })
            .then(function(response) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const fileURL = URL.createObjectURL(blob);
                window.open(fileURL, '_blank');
            }, function(response) {
                console.error("PDF Error", response);
                alert("Error generating PDF");
            });
    };
}]);


// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', '$uibModal', 'x', 'y', 'z', function ($scope, $uibModalInstance, $uibModal, x, y, z) {
    $scope.cell = $scope.$parent.cells[x + ',' + y + ',' + z];
    $scope.leagueType = $scope.$parent.leagueType;
    $scope.isStart = $scope.$parent.startTile.x == x &&
        $scope.$parent.startTile.y == y &&
        $scope.$parent.startTile.z == z;
    $scope.height = $scope.$parent.height;
    $scope.z = z;
    $scope.oldFloorDestination = $scope.cell.tile.changeFloorTo;

    // Initialize victims object if not exists
    if (!$scope.cell.tile.victims) {
        $scope.cell.tile.victims = {
            top: 'None',
            bottom: 'None',
            left: 'None',
            right: 'None'
        };
    }

    // Initialize cognitiveTargets container if not exists
    if (!$scope.cell.tile.cognitiveTargets) {
        $scope.cell.tile.cognitiveTargets = {};
    }
    // Initialize each direction if not exists (preserves existing data)
    var directions = ['top', 'bottom', 'left', 'right'];
    for (var i = 0; i < directions.length; i++) {
        var dir = directions[i];
        if (!$scope.cell.tile.cognitiveTargets[dir]) {
            $scope.cell.tile.cognitiveTargets[dir] = {
                rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' }
            };
        }
    }

    $scope.elevatorChanged = function (newValue) {
        console.log("old", $scope.oldFloorDestination);
        console.log("new", newValue);
        // Remove the old one
        if ($scope.oldFloorDestination != z &&
            $scope.$parent.cells[x + ',' + y + ',' + $scope.oldFloorDestination]) {
            console.log("Remove old elevator on " + x + ',' + y + ',' +
                $scope.oldFloorDestination);
            $scope.$parent.cells[x + ',' + y + ',' +
                $scope.oldFloorDestination].tile.changeFloorTo = $scope.oldFloorDestination;
        }

        // Set the new one
        if ($scope.$parent.cells[x + ',' + y + ',' + newValue]) {
            console.log("Create new elevator on " + x + ',' + y + ',' + newValue +
                " (1) to floor " + z);
            $scope.$parent.cells[x + ',' + y + ',' + newValue].tile.changeFloorTo = z;
        } else {
            console.log("Create new elevator on " + x + ',' + y + ',' + newValue +
                " (2) to floor " + z);
            $scope.$parent.cells[x + ',' + y + ',' + newValue] = {
                isTile: true,
                tile: {
                    changeFloorTo: z
                }
            };
        }
        $scope.oldFloorDestination = newValue;
        $scope.propertyChanged();
        $scope.$parent.recalculateLinear();
    }

    $scope.startChanged = function () {
        if ($scope.isStart) {
            $scope.$parent.startTile.x = x;
            $scope.$parent.startTile.y = y;
            $scope.$parent.startTile.z = z;
        }
    }

    $scope.hasVictims = function() {
        if (!$scope.cell || !$scope.cell.tile || !$scope.cell.tile.victims) return false;
        var v = $scope.cell.tile.victims;
        return (v.top && v.top !== 'None') ||
               (v.bottom && v.bottom !== 'None') ||
               (v.left && v.left !== 'None') ||
               (v.right && v.right !== 'None');
    };

    $scope.isVictimDisabled = function() {
        if (!$scope.cell || !$scope.cell.tile) return false;
        return $scope.cell.tile.black || 
               $scope.cell.tile.checkpoint || 
               $scope.cell.tile.blue || 
               $scope.cell.tile.red || 
               $scope.cell.tile.speedbump || 
               $scope.cell.tile.steps || 
               $scope.cell.tile.ramp ||
               ($scope.cell.tile.changeFloorTo !== undefined && $scope.cell.tile.changeFloorTo !== z);
    };

    $scope.propertyChanged = function () {
        if ($scope.isVictimDisabled()) {
            $scope.cell.tile.victims.top = 'None';
            $scope.cell.tile.victims.bottom = 'None';
            $scope.cell.tile.victims.left = 'None';
            $scope.cell.tile.victims.right = 'None';
        }
        $scope.$parent.recalculateLinear();
    };

    $scope.blackChanged = function () {
        $scope.propertyChanged();
    }

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    $scope.getCognitiveTargetImage = function(direction) {
        if (!$scope.cell.tile.victims || 
            $scope.cell.tile.victims[direction] !== 'Cognitive' ||
            !$scope.cell.tile.cognitiveTargets ||
            !$scope.cell.tile.cognitiveTargets[direction]) {
            return '';
        }
        var rings = $scope.cell.tile.cognitiveTargets[direction].rings;
        var colorCode = rings.ring1 + rings.ring2 + rings.ring3 + rings.ring4 + rings.ring5;
        return '/images/cognitive_targets/' + colorCode + '.png';
    }

    $scope.getCognitiveStatusColor = function(direction) {
        if (!$scope.cell.tile.cognitiveTargets || !$scope.cell.tile.cognitiveTargets[direction]) {
            return '#6c757d';
        }
        var rings = $scope.cell.tile.cognitiveTargets[direction].rings;
        var colorValues = { 'B': -2, 'R': -1, 'Y': 0, 'G': 1, 'C': 2 };
        var total = 0;
        for (var i = 1; i <= 5; i++) {
            total += colorValues[rings['ring' + i]] || 0;
        }
        // H (Harmed) -> Red, S (Stable) -> Yellow, U (Unharmed) -> Green, D (Dummy) -> Gray
        if (total === 2) return '#dc3545'; // Red for Harmed
        if (total === 1) return '#ffc107'; // Yellow for Stable
        if (total === 0) return '#28a745'; // Green for Unharmed
        return '#6c757d'; // Gray for Dummy
    }

    $scope.getCognitiveStatusBgColor = function(direction) {
        if (!$scope.cell.tile.cognitiveTargets || !$scope.cell.tile.cognitiveTargets[direction]) {
            return '#f8f9fa';
        }
        var rings = $scope.cell.tile.cognitiveTargets[direction].rings;
        var colorValues = { 'B': -2, 'R': -1, 'Y': 0, 'G': 1, 'C': 2 };
        var total = 0;
        for (var i = 1; i <= 5; i++) {
            total += colorValues[rings['ring' + i]] || 0;
        }
        // Light background colors
        if (total === 2) return '#f8d7da'; // Light red for Harmed
        if (total === 1) return '#fff3cd'; // Light yellow for Stable
        if (total === 0) return '#d4edda'; // Light green for Unharmed
        return '#f8f9fa'; // Light gray for Dummy
    }

    $scope.getCognitiveStatusBgColorHover = function(direction) {
        if (!$scope.cell.tile.cognitiveTargets || !$scope.cell.tile.cognitiveTargets[direction]) {
            return '#e9ecef';
        }
        var rings = $scope.cell.tile.cognitiveTargets[direction].rings;
        var colorValues = { 'B': -2, 'R': -1, 'Y': 0, 'G': 1, 'C': 2 };
        var total = 0;
        for (var i = 1; i <= 5; i++) {
            total += colorValues[rings['ring' + i]] || 0;
        }
        // Slightly darker hover colors
        if (total === 2) return '#f5c6cb'; // Darker light red for Harmed
        if (total === 1) return '#ffeeba'; // Darker light yellow for Stable
        if (total === 0) return '#c3e6cb'; // Darker light green for Unharmed
        return '#e9ecef'; // Darker light gray for Dummy
    }

    $scope.openCognitiveTargetSettings = function(direction) {
        // Ensure cognitiveTargets exists
        if (!$scope.cell.tile.cognitiveTargets) {
            $scope.cell.tile.cognitiveTargets = {};
        }
        // Ensure the direction exists with default rings
        if (!$scope.cell.tile.cognitiveTargets[direction]) {
            $scope.cell.tile.cognitiveTargets[direction] = {
                rings: { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' }
            };
        }

        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/maze_cognitive_target_modal_2026.html',
            controller: 'CognitiveTargetModalCtrl',
            size: 'lg',
            resolve: {
                direction: function() {
                    return direction;
                },
                cognitiveData: function() {
                    return $scope.cell.tile.cognitiveTargets[direction];
                }
            }
        });

        modalInstance.result.then(function(result) {
            $scope.cell.tile.cognitiveTargets[direction] = result;
        });
    }
}]);

app.controller('SaveAsModalCtrl', ['$scope', '$uibModalInstance', 'competitions', 'currentCompetitionId', 'currentName', function ($scope, $uibModalInstance, competitions, currentCompetitionId, currentName) {
    $scope.competitions = competitions;
    $scope.se_competition = currentCompetitionId;
    $scope.asname = currentName + "_copy";

    $scope.ok = function () {
        $uibModalInstance.close({
            name: $scope.asname,
            competitionId: $scope.se_competition
        });
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

app.controller('CognitiveTargetModalCtrl', ['$scope', '$uibModalInstance', 'direction', 'cognitiveData', function ($scope, $uibModalInstance, direction, cognitiveData) {
    $scope.direction = direction;
    $scope.rings = (cognitiveData && cognitiveData.rings) ? angular.copy(cognitiveData.rings) : { ring1: 'Y', ring2: 'Y', ring3: 'Y', ring4: 'Y', ring5: 'Y' };
    
    var colorValues = {
        'B': -2,
        'R': -1,
        'Y': 0,
        'G': 1,
        'C': 2
    };

    $scope.updatePreview = function() {
        var colorCode = $scope.rings.ring1 + $scope.rings.ring2 + $scope.rings.ring3 + $scope.rings.ring4 + $scope.rings.ring5;
        $scope.previewImage = '/images/cognitive_targets/' + colorCode + '.png';
    }

    $scope.calculateTotalValue = function() {
        var total = 0;
        for (var i = 1; i <= 5; i++) {
            total += colorValues[$scope.rings['ring' + i]] || 0;
        }
        return total;
    }

    $scope.getColorValue = function(color) {
        return colorValues[color] || 0;
    }

    $scope.getVictimStatus = function() {
        var total = $scope.calculateTotalValue();
        if (total === 2) {
            return 'harmed';
        } else if (total === 1) {
            return 'stable';
        } else if (total === 0) {
            return 'unharmed';
        } else {
            return 'dummy';
        }
    }

    $scope.autoSetRings = function(targetStatus) {
        var targetSum;
        switch (targetStatus) {
            case 'harmed':
                targetSum = 2;
                break;
            case 'stable':
                targetSum = 1;
                break;
            case 'unharmed':
                targetSum = 0;
                break;
            case 'dummy':
                targetSum = null;
                break;
            default:
                targetSum = 0;
        }

        var colors = ['B', 'R', 'Y', 'G', 'C'];
        var maxAttempts = 100;
        var attempts = 0;

        while (attempts < maxAttempts) {
            for (var i = 1; i <= 5; i++) {
                $scope.rings['ring' + i] = colors[Math.floor(Math.random() * colors.length)];
            }

            var currentSum = $scope.calculateTotalValue();
            var currentStatus = $scope.getVictimStatus();

            if (targetStatus === 'dummy') {
                if (currentStatus === 'dummy') {
                    break;
                }
            } else if (currentSum === targetSum) {
                break;
            }

            attempts++;
        }

        $scope.updatePreview();
    }

    $scope.updatePreview();

    $scope.ok = function() {
        $uibModalInstance.close({
            rings: $scope.rings
        });
    }

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    }
}]);
