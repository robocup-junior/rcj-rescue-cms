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
    $scope.competitionId = competitionId;
    $scope.mapId = mapId;
    $translate('admin.mazeMapEditor.import').then(function (val) {
        $("#select").fileinput({'showUpload':false, 'showPreview':false, 'showRemove':false, 'showCancel':false  ,'msgPlaceholder': val,allowedFileExtensions: ['json'] , msgValidationError: "ERROR"});
    }, function (translationId) {
        // = translationId;
    });
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
            $scope.finished = response.data.finished;
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
        let linear = $scope.cells[x + ',' + y + ',' + z].isLinear;
        let count = 0;
        for(let i=1,l=$scope.length*2+1;i<l;i+=2){
            for(let j=1,m=$scope.width*2+1;j<m;j+=2){
                for(let k=0;k<$scope.height;k++) {
                    if(!$scope.cells[j + ',' + i + ',' + k]) continue;
                    if($scope.cells[j + ',' + i + ',' + k].isLinear == linear){
                        let victims = $scope.cells[j + ',' + i + ',' + k].tile.victims;
                        if(victims){
                            if(victims.top == type) count++;
                            if(x == j && y == i && z == k && place == 'top'){
                                if(linear) return big[count-1];
                                else return small[count-1];
                            }
                            if(victims.left == type) count++;
                            if(x == j && y == i && z == k && place == 'left'){
                                if(linear) return big[count-1];
                                else return small[count-1];
                            }
                            if(victims.right == type) count++;
                            if(x == j && y == i && z == k && place == 'right'){
                                if(linear) return big[count-1];
                                else return small[count-1];
                            }
                            if(victims.bottom == type) count++;
                            if(x == j && y == i && z == k && place == 'bottom'){
                                if(linear) return big[count-1];
                                else return small[count-1];
                            }
                            if(victims.floor == type) count++;
                            if(x == j && y == i && z == k && place == 'floor'){
                                if(linear) return big[count-1];
                                else return small[count-1];
                            }
                        }
                    }
                }
                
            }
        }
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
    var small = Range('α', 'ω');

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

    $scope.makeImage = function(){
        window.scrollTo(0,0);
        html2canvas(document.getElementById("outputImageArea"),{
            scale: 5
        }).then(function(canvas) {
            let ctx = canvas.getContext("2d");

            //Detect image area
            let topY = 0;
            for(let y=0;y<canvas.height;y++){
                let imagedata = ctx.getImageData(canvas.width/2, y, 1, 1);
                if(imagedata.data[0] != 255){
                    topY = y;
                    break;
                }
            }
            let bottomY = 0;
            for(let y=canvas.height-1;y>=0;y--){
                let imagedata = ctx.getImageData(canvas.width/2, y, 1, 1);
                if(imagedata.data[0] != 255){
                    bottomY = y;
                    break;
                }
            }
            mem_canvas = document.createElement("canvas");
            mem_canvas.width = canvas.width;
            mem_canvas.height = bottomY-topY;
            ctx2 = mem_canvas.getContext("2d");
            ctx2.drawImage(canvas, 0, topY, canvas.width, bottomY-topY, 0, 0, canvas.width, bottomY-topY);
            let imgData = mem_canvas.toDataURL();
            $http.post("/api/maps/line/image/" + mapId, {img: imgData}).then(function (response) {
                alert("Created image!");
            }, function (response) {
                console.log(response);
                console.log("Error: " + response.statusText);
                alert(response.data.msg);
            });
        });
    };

    $scope.makeImageDl = function(){
        window.scrollTo(0,0);
        html2canvas(document.getElementById("outputImageArea"),{
            scale: 5
        }).then(function(canvas) {
            let ctx = canvas.getContext("2d");

            //Detect image area
            let topY = 0;
            for(let y=0;y<canvas.height;y++){
                let imagedata = ctx.getImageData(canvas.width/2, y, 1, 1);
                if(imagedata.data[0] != 255){
                    topY = y;
                    break;
                }
            }
            let bottomY = 0;
            for(let y=canvas.height-1;y>=0;y--){
                let imagedata = ctx.getImageData(canvas.width/2, y, 1, 1);
                if(imagedata.data[0] != 255){
                    bottomY = y;
                    break;
                }
            }
            mem_canvas = document.createElement("canvas");
            mem_canvas.width = canvas.width;
            mem_canvas.height = bottomY-topY;
            ctx2 = mem_canvas.getContext("2d");
            ctx2.drawImage(canvas, 0, topY, canvas.width, bottomY-topY, 0, 0, canvas.width, bottomY-topY);
            let imgData = mem_canvas.toDataURL();
            downloadURI(imgData,$scope.name+'.png')
        });
    };

    function downloadURI(uri, name) {
        var link = document.createElement("a");
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        delete link;
    }

    $scope.wallColor = function(x,y,z){
        let cell = $scope.cells[x+','+y+','+z];
        if(!cell) return {};
        if(cell.isWall) {
            if (cell.isLinear) return {'background-color': 'black'};
            else if (cell.ignoreWall) return {'background-color': 'green'};
            else return {'background-color': 'navy'};
        }
    };

    $scope.saveMapAs = function (name) {
        if ($scope.startNotSet()) {
            alert("You must define a starting tile by clicking a tile");
            return;
        }
        if (name == $scope.name && $scope.se_competition == competitionId) {
            alert("You must have a new name when saving as!");
            return;
        }


        var map = {
            competition: $scope.se_competition,
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
        console.log($scope.cells)
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
            templateUrl: '/templates/maze_editor_modal_2025.html',
            controller: 'ModalInstanceCtrl',
            size: 'sm',
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
}]);


// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', 'x', 'y', 'z', function ($scope, $uibModalInstance, x, y, z) {
    $scope.cell = $scope.$parent.cells[x + ',' + y + ',' + z];
    $scope.leagueType = $scope.$parent.leagueType;
    $scope.isStart = $scope.$parent.startTile.x == x &&
        $scope.$parent.startTile.y == y &&
        $scope.$parent.startTile.z == z;
    $scope.height = $scope.$parent.height;
    $scope.z = z;
    $scope.oldFloorDestination = $scope.cell.tile.changeFloorTo;
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
        $scope.$parent.recalculateLinear();
    }

    $scope.startChanged = function () {
        if ($scope.isStart) {
            $scope.$parent.startTile.x = x;
            $scope.$parent.startTile.y = y;
            $scope.$parent.startTile.z = z;
        }
    }
    
    $scope.blackChanged = function () {
        $scope.$parent.recalculateLinear();
    }

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }
    $scope.ok = function () {
        $scope.$parent.recalculateLinear();
        $uibModalInstance.close();
    };
}]);
