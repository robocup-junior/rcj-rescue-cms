// register the directive with your app module
var app = angular.module('LineEditor', ['ngTouch','lvl.services', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('LineEditorController', ['$scope', '$uibModal', '$log', '$http', '$translate', function ($scope, $uibModal, $log, $http, $translate) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    $scope.competitionId = competitionId;
    $scope.se_competition = competitionId;
    $translate('admin.lineMapEditor.import').then(function (val) {
        $("#select").fileinput({
            'showUpload': false,
            'showPreview': false,
            'showRemove': false,
            'showCancel': false,
            'msgPlaceholder': val,
            allowedFileExtensions: ['json'],
            msgValidationError: "ERROR"
        });
    }, function (translationId) {
        // = translationId;
    });

    $http.get("/api/competitions/").then(function (response) {
        $scope.competitions = response.data
        //console.log($scope.competitions)
    })

    var tileCountDb={};

    $scope.z = 0;
    $scope.tiles = {};
    $scope.startTile = {
        x: -1,
        y: -1,
        z: -1
    };
    $scope.startTile2 = {
        x: -1,
        y: -1,
        z: -1
    };
    $scope.height = 1;
    $scope.width = 1;
    $scope.length = 1;
    $scope.duration = 480;
    $scope.liveV = 2;
    $scope.deadV = 1;
    $scope.name = "Awesome Testbana";

    $scope.tileSets = [];
    $scope.tileSet = null;
    $scope.usedCount = {};
    $http.get("/api/maps/line/tilesets?populate=true").then(function (response) {
        $scope.tileSets = response.data
        $scope.tileSet = $scope.tileSets[0]
        if (mapId) {
            $http.get("/api/maps/line/" + mapId +
              "?populate=true").then(function (response) {
                //console.log(response)
                for (var i = 0; i < response.data.tiles.length; i++) {
                    $scope.tiles[response.data.tiles[i].x + ',' +
                    response.data.tiles[i].y + ',' +
                    response.data.tiles[i].z] = response.data.tiles[i];
                }
                $scope.competitionId = response.data.competition;
                $http.get("/api/competitions/" +
                  $scope.competitionId).then(function (response) {
                    $scope.competition = response.data;
                    $scope.league = response.data.leagues.find((l) => l.league == leagueId);
                })

                for(let t of $scope.tileSets){
                    if(t._id == response.data.tileSet){
                        console.log(t._id);
                        $scope.tileSet = t;
                        break;
                    }
                }

                $scope.startTile = response.data.startTile;
                $scope.startTile2 = response.data.startTile2;
                $scope.height = response.data.height;
                $scope.width = response.data.width;
                $scope.length = response.data.length;
                $scope.duration = response.data.duration || 480;
                $scope.name = response.data.name;
                $scope.finished = response.data.finished;
                $scope.liveV = response.data.victims.live;
                $scope.deadV = response.data.victims.dead;
                $scope.updateUsedCount();
                $scope.updateTileIndex();

            }, function (response) {
                console.log("Error: " + response.statusText);
            });
        } else {
            $http.get("/api/competitions/" +
              $scope.competitionId).then(function (response) {
                $scope.competition = response.data;
                $scope.league = response.data.leagues.find((l) => l.league == leagueId);
            })
        }
    }, function (response) {
        console.log("Error: " + response.statusText);
    });



    $scope.go = function (path) {
        window.location = path
    }
    
    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }

    $scope.changeFloor = function (z) {
        $scope.z = z;
    }

    $scope.rotateTile = function (x, y) {
        // If the tile doesn't exists yet
        if (!$scope.tiles[x + ',' + y + ',' + $scope.z])
            return;
        $scope.tiles[x + ',' + y + ',' + $scope.z].rot += 90;
        if ($scope.tiles[x + ',' + y + ',' + $scope.z].rot >= 360)
            $scope.tiles[x + ',' + y + ',' + $scope.z].rot = 0;
        $scope.updateTileIndex();
    }


    $scope.startNotSet = function () {
        if($scope.finished){
            return ($scope.startTile.x == -1 && $scope.startTile.y == -1 &&
              $scope.startTile.z == -1);
        }
        return false;
    };

    $scope.updateUsedCount = function(){
        console.log($scope.tiles)
        let newCount = {}

        for( key in $scope.tiles ) {
            if( $scope.tiles.hasOwnProperty(key) ) {
                if(!newCount[$scope.tiles[key].tileType._id])newCount[$scope.tiles[key].tileType._id] = 1;
                else newCount[$scope.tiles[key].tileType._id]++;
            }
        }
        $scope.usedCount = newCount;
    }

    $scope.updateTileIndex = function(){
        let tiles = [];
        for(let i in $scope.tiles){
            let tile = {};
            tile = $scope.tiles[i];
            tile.index = [];
            tile.next = [];
            const coords = i.split(',');
            tile.x = Number(coords[0]);
            tile.y = Number(coords[1]);
            tile.z = Number(coords[2]);
            tiles[tile.x + ',' + tile.y + ',' + tile.z] = tile;
        }
        let map = {
            startTile: $scope.startTile,
            startTile2: $scope.startTile2,
            tiles: tiles
        };
        let result = pathFinder(map);

        for(let i in result.tiles){
            $scope.tiles[i] = result.tiles[i];
        }
        console.log($scope.tiles)
        $scope.EvacuationAreaLoPIndex = result.EvacuationAreaLoPIndex;
        $scope.indexCount = result.indexCount;
    }



    $scope.tileRemain = function(tile){
        return tile.count - getTileUsedCountOther(tile) - null2zero($scope.usedCount[tile.tileType._id]);
    }

    function getTileUsedCountOther(tile){
        if(pubService) return 0;
        if(tileCountDb[$scope.tileSet._id]){
            if(tileCountDb[$scope.tileSet._id][tile.tileType._id] !== undefined){
                return tileCountDb[$scope.tileSet._id][tile.tileType._id];
            }
        }else{
            tileCountDb[$scope.tileSet._id] = {};
        }
        let mapi = null;
        if(mapId) mapi = mapId;
        let count = $.ajax({
            type: 'GET',
            url: '/api/maps/line/tileCount/' + mapi + '/' + $scope.tileSet._id,
            async: false,
            dataType: 'json'
        }).responseJSON;
        for(let c of count){
            tileCountDb[$scope.tileSet._id][c.tileId] = c.usedCount;
        }
    }

    function null2zero(tmp){
        if(tmp === undefined) return 0;
        return tmp;
    }

    $scope.saveMapAs = function () {
        if ($scope.startNotSet()) {
            Toast.fire({
                type: 'error',
                title: "Error",
                html: "You must define a starting && re-starting (after evacuation zone) tile by right-clicking a tile"
            })
            return;
        }

        if ($scope.saveasname == $scope.name && $scope.se_competition == competitionId) {
            Toast.fire({
                type: 'error',
                title: "Error",
                html: "You must have a new name when saving as!"
            })
            return;
        }
        var victims = {};
        victims.live = $scope.liveV;
        victims.dead = $scope.deadV;
        var map = {
            competition: $scope.se_competition,
            tileSet: $scope.tileSet._id,
            name: $scope.saveasname,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            duration: $scope.duration,
            finished: $scope.finished,
            startTile: $scope.startTile,
            startTile2: $scope.startTile2,
            tiles: $scope.tiles,
            victims: victims,
            league: leagueId
        };

        $http.post("/api/maps/line", map).then(function (response) {
            Toast.fire({
                type: 'success',
                title: "Created map!"
            })
            //console.log(response.data);
            window.location.replace("/admin/" + $scope.se_competition + "/" + leagueId + "/mapEditor/" + response.data.id)
        }, function (response) {
            console.log(response);
            console.log("Error: " + response.statusText);
            Toast.fire({
                type: 'error',
                title: "Error",
                html: response.data.msg
            })
        });
    }

    $scope.tileShow4Image = function(x,y,z){
        if($scope.tiles[x + ',' + y + ',' + z]) return true;
        for(let i=0,l=$scope.width;i<l;i++){
            if($scope.tiles[i + ',' + y + ',' + z]) return true;
        }

        return false;
    };

    $scope.makeImage = function(){
      window.scrollTo(0,0);
      html2canvas(document.getElementById("outputImageArea"),{
        scale: 5
      }).then(function(canvas) {
        let imgData = canvas.toDataURL();
        $http.post("/api/maps/line/image/" + mapId, {img: imgData}).then(function (response) {
          Toast.fire({
            type: 'success',
            title: "Created image!"
          })
        }, function (response) {
          console.log("Error: " + response.statusText);
          Toast.fire({
            type: 'error',
            title: "Error",
            html: response.data.msg
        })
        });
      });
    };

    $scope.makeImageDl = function(){
        $scope.updateTileIndex();
        window.scrollTo(0,0);
        html2canvas(document.getElementById("outputImageArea"),{
            scale: 5
        }).then(function(canvas) {
            let imgData = canvas.toDataURL();
            console.log(imgData);
            downloadURI(imgData,$scope.name + '.png')
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


    $scope.saveMap = function (callback = null) {
        if ($scope.startNotSet()) {
            Toast.fire({
                type: 'error',
                title: "Error",
                html: "You must define a starting && re-starting (after evacuation zone) tile by right-clicking a tile"
            })
            return;
        }

        var victims = {};
        victims.live = $scope.liveV;
        victims.dead = $scope.deadV;

        for(let i=0;i<$scope.tiles.length;i++){
            console.log($scope.tiles[i]);
        }

        var map = {
            competition: $scope.competitionId,
            tileSet: $scope.tileSet._id,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            duration: $scope.duration,
            finished: $scope.finished,
            startTile: $scope.startTile,
            startTile2: $scope.startTile2,
            tiles: $scope.tiles,
            victims: victims,
            image: $scope.imgData,
            league: leagueId
        };

        if (mapId) {
            $http.put("/api/maps/line/" + mapId, map).then(function (response) {
                if (callback == null) {
                    Toast.fire({
                        type: 'success',
                        title: "Updated map"
                    })
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
                } else {
                    callback();
                }                
            });
        } else {
            $http.post("/api/maps/line", map).then(function (response) {
                Toast.fire({
                    type: 'success',
                    title: "Created map"
                })
                window.location.replace("/admin/" + competitionId + "/" + leagueId + "/mapEditor/" + response.data.id)
            }, function (response) {
                console.log("Error: " + response.statusText);
                if (callback == null) {
                    Toast.fire({
                        type: 'error',
                        title: "Error",
                        html: response.data.msg
                    })
                } else {
                    callback();
                }
            });
        }
    }

    $scope.export = function () {
        var victims = {};
        victims.live = $scope.liveV;
        victims.dead = $scope.deadV;
        
        var map = {
            tileSet: $scope.tileSet._id,
            name: $scope.name,
            length: $scope.length,
            height: $scope.height,
            width: $scope.width,
            duration: $scope.duration,
            finished: $scope.finished,
            startTile: $scope.startTile,
            startTile2: $scope.startTile2,
            tiles: $scope.tiles,
            victims: victims
        };

        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(map))
        var downloadLink = document.createElement('a')
        document.body.appendChild(downloadLink);
        downloadLink.setAttribute("href", dataStr)
        downloadLink.setAttribute("download", $scope.name + '.json')
        downloadLink.click()
        document.body.removeChild(downloadLink);
    }


    $scope.openMaxScore = function(){
        $scope.saveMap(function () {
            $http.get(`/api/maps/line/${mapId}/maxScore`).then(function (response) {
                let lineTraceScore = response.data.raw_score;
                let finalScore = response.data.score;
                let html = `
                <div class='text-center'>
                    <i class='fas fa-calculator fa-3x'></i>
                </div><hr>
                <table class='custom'>
                    <thead>
                        <th>Line Trace Score</th>
                        <th>Final Score<br>(incl. Victim Score)</th>
                    </thead>
                    <tbody>
                        <td>${lineTraceScore}</td>
                        <td>${finalScore}</td>
                    </tbody>
                </table>
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

    // Check if File API is supported
    if (window.File) {
        var select = document.getElementById('select');

        // When a file is selected
        select.addEventListener('change', function (e) {
            // Get information about the selected file
            var fileData = e.target.files[0];

            var reader = new FileReader();
            // When file reading fails
            reader.onerror = function () {
                Toast.fire({
                    type: 'error',
                    title: "File Error",
                    html: "Failed to read files"
                })
            }
            // When file reading succeeds
            reader.onload = function () {
                var data = JSON.parse(reader.result);
                $scope.tiles = data.tiles;
                $scope.competitionId = competitionId;

                for(let t of $scope.tileSets){
                    if(t._id == data.tileSet){
                        $scope.tileSet = t;
                        break;
                    }
                }

                $scope.startTile = data.startTile;
                $scope.startTile2 = data.startTile2;
                $scope.numberOfDropTiles = data.numberOfDropTiles;
                $scope.height = data.height;
                $scope.width = data.width;
                $scope.length = data.length;
                $scope.duration = data.duration || 480;
                $scope.name = data.name;
                $scope.finished = data.finished;

                $scope.liveV = data.victims.live;
                $scope.deadV = data.victims.dead;
                /*for (let i = 0; i < data.tiles.length; i++) {
                    $scope.tiles[data.tiles[i].x + ',' +
                        data.tiles[i].y + ',' +
                        data.tiles[i].z] = data.tiles[i];
                }*/
                $scope.updateUsedCount();
                $scope.updateTileIndex();
                $scope.$apply();
            }

            // Execute file reading
            reader.readAsText(fileData);
        }, false);
    }


    $scope.open = function (x, y) {
        // If the tile doesn't exists yet
        if (!$scope.tiles[x + ',' + y + ',' + $scope.z]) {
            swal("Oops!", "Need to place a tile here before changing it.", "error");
            return;
        }

        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/line_editor_modal.html?gs',
            controller: 'ModalInstanceCtrl',
            size: 'sm',
            resolve: {
                tile: function () {
                    let t = $scope.tiles[x + ',' + y + ',' + $scope.z];
                    t.start = $scope.startTile.x == x && $scope.startTile.y == y && $scope.startTile.z == $scope.z;
                    t.start2 = $scope.startTile2.x == x && $scope.startTile2.y == y && $scope.startTile2.z == $scope.z;
                    return t;
                }
            }
        });

        modalInstance.result.then(function (response) {
            if (response[0]) {
                $scope.startTile.x = x;
                $scope.startTile.y = y;
                $scope.startTile.z = $scope.z;
            }else if($scope.startTile.x == x && $scope.startTile.y == y && $scope.startTile.z == $scope.z){
                $scope.startTile.x = -1;
                $scope.startTile.y = -1;
                $scope.startTile.z = -1;
            }
            if (response[1]) {
                $scope.startTile2.x = x;
                $scope.startTile2.y = y;
                $scope.startTile2.z = $scope.z;
            }else if($scope.startTile2.x == x && $scope.startTile2.y == y && $scope.startTile2.z == $scope.z){
                $scope.startTile2.x = -1;
                $scope.startTile2.y = -1;
                $scope.startTile2.z = -1;
            }
            $scope.updateTileIndex();
        }, function () {
            console.log('Modal dismissed at: ' + new Date());
            $scope.updateTileIndex();
        });
    };
}]);


// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', 'tile', function ($scope, $uibModalInstance, tile) {
    $scope.tile = tile;
    $scope.ok = function () {
        $uibModalInstance.close([$scope.tile.start, $scope.tile.start2]);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);


app.directive('ngRightClick', ['$parse', function ($parse) {
    return function (scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function (event) {
            scope.$apply(function () {
                event.preventDefault();
                fn(scope, {
                    $event: event
                });
            });
        });
    };
}]);


app.directive('tile', function () {
    return {
        scope: {
            tile: '='
        },
        restrict: 'E',
        templateUrl: '/templates/tile.html',
        link: function (scope, element, attrs) {
            scope.tilerotate = function (tilerot) {
                return tilerot;
            }
            scope.rotateRamp = function (direction) {
                switch (direction) {
                    case "bottom":
                        return "rot0";
                    case "top":
                        return "rot180";
                    case "left":
                        return "rot90";
                    case "right":
                        return "rot270";
                }
            };
            scope.isStart = function (tile) {
                //console.log(tile);
                return attrs.x == scope.$parent.startTile.x &&
                    attrs.y == scope.$parent.startTile.y &&
                    attrs.z == scope.$parent.startTile.z;
            };

            scope.isCheckPointTile = function(tile){
                if(tile) return tile.checkPoint;
                return false;
            };

            scope.isStart2 = function (tile) {
                return attrs.x == scope.$parent.startTile2.x &&
                  attrs.y == scope.$parent.startTile2.y &&
                  attrs.z == scope.$parent.startTile2.z;
            };

            scope.entranceOrExit = function (tile) {
                if(!tile) return false;

                if(tile.tileType._id != "58cfd6549792e9313b1610e1" && tile.tileType._id != "58cfd6549792e9313b1610e2") return false;

                if(tile.tileType._id == "58cfd6549792e9313b1610e1"){
                    //4side
                    let t;
                    //Top
                    t = scope.$parent.tiles[tile.x+","+(tile.y-1)+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                    //Left
                    t = scope.$parent.tiles[(tile.x-1)+","+tile.y+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                    //Right
                    t = scope.$parent.tiles[(tile.x+1)+","+tile.y+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                    //Bottom
                    t = scope.$parent.tiles[tile.x+","+(tile.y+1)+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                }else{
                    //2 side
                    if(tile.rot == 0 || tile.rot == 180){
                        // left or right
                        let t;
                        //Left
                        t = scope.$parent.tiles[(tile.x-1)+","+tile.y+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                        //Right
                        t = scope.$parent.tiles[(tile.x+1)+","+tile.y+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                    }else{
                        // top or bottom
                        let t;
                        //Top
                        t = scope.$parent.tiles[tile.x+","+(tile.y-1)+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                        //Bottom
                        t = scope.$parent.tiles[tile.x+","+(tile.y+1)+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                    }
                }
                return false;
            }

            scope.evacTapeRot = function (tile) {
                let rot = 0;
                if(!tile) return false;
                if(tile.tileType._id != "58cfd6549792e9313b1610e1" && tile.tileType._id != "58cfd6549792e9313b1610e2") return false;

                let dirEv = [];
                if(tile.tileType._id == "58cfd6549792e9313b1610e1"){ // ev1.png
                    dirEv = [0, 90, 180, 270];
                }else{
                    let r = tile.rot;
                    dirEv = [(90+r)%360, (180+r)%360, (270+r)%360];
                }
                let t;
                //Top
                t = scope.$parent.tiles[tile.x+","+(tile.y-1)+","+tile.z];
                if(t && dirEv.indexOf(0)>=0){
                    if (!evacTile(t)) {
                        rot = 0;
                    }
                }
                //Left
                t = scope.$parent.tiles[(tile.x-1)+","+tile.y+","+tile.z];
                if(t && dirEv.indexOf(270)>=0){
                    if (!evacTile(t)) {
                        rot = 270;
                    }
                }
                //Right
                t = scope.$parent.tiles[(tile.x+1)+","+tile.y+","+tile.z];
                if(t && dirEv.indexOf(90)>=0){
                    if (!evacTile(t)) {
                        rot = 90;
                    }
                }
                //Bottom
                t = scope.$parent.tiles[tile.x+","+(tile.y+1)+","+tile.z];
                if(t && dirEv.indexOf(180)>=0){
                    if (!evacTile(t)) {
                        rot = 180;
                    }
                }
                return rot%360;
            }
        }
    };
});

app.directive('tile4image', function () {
    return {
        scope: {
            tile: '='
        },
        restrict: 'E',
        templateUrl: '/templates/tile4Image.html',
        link: function (scope, element, attrs) {
            scope.tilerotate = function (tilerot) {
                return tilerot;
            }
            scope.rotateRamp = function (direction) {
                switch (direction) {
                    case "bottom":
                        return "rot0";
                    case "top":
                        return "rot180";
                    case "left":
                        return "rot90";
                    case "right":
                        return "rot270";
                }
            }
            scope.isStart = function (tile) {
                return attrs.x == scope.$parent.startTile.x &&
                  attrs.y == scope.$parent.startTile.y &&
                  attrs.z == scope.$parent.startTile.z;
            };

            scope.isCheckPointTile = function(tile){
                if(tile) return tile.checkPoint;
                return false;
            };

            scope.scoringItems = function (tile){
                if(tile) return tile.items.obstacles || tile.items.rampPoints || tile.items.speedbumps || tile.tileType.gaps || tile.tileType.intersections || tile.tileType.seesaw;
                return false;
            };

            scope.tileNumber = function (tile) {
                let txt = "";
                for(let i=0,l=tile.index.length;i<l;i++){
                        if(txt != "") txt += " , ";
                        txt += (tile.index[i]+1);
                };
                return txt;
            };

            scope.entranceOrExit = function (tile) {
                if(!tile) return false;
                if(tile.tileType._id != "58cfd6549792e9313b1610e1" && tile.tileType._id != "58cfd6549792e9313b1610e2") return false;

                if(tile.tileType._id == "58cfd6549792e9313b1610e1"){
                    let t;
                    //Top
                    t = scope.$parent.tiles[tile.x+","+(tile.y-1)+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                    //Left
                    t = scope.$parent.tiles[(tile.x-1)+","+tile.y+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                    //Right
                    t = scope.$parent.tiles[(tile.x+1)+","+tile.y+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                    //Bottom
                    t = scope.$parent.tiles[tile.x+","+(tile.y+1)+","+tile.z];
                    if(t){
                        if (!evacTile(t)) {
                            if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                            else return "Entrance";
                        }
                    }
                }else{
                    //2 side
                    if(tile.rot == 0 || tile.rot == 180){
                        // left or right
                        let t;
                        //Left
                        t = scope.$parent.tiles[(tile.x-1)+","+tile.y+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                        //Right
                        t = scope.$parent.tiles[(tile.x+1)+","+tile.y+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                    }else{
                        // top or bottom
                        let t;
                        //Top
                        t = scope.$parent.tiles[tile.x+","+(tile.y-1)+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                        //Bottom
                        t = scope.$parent.tiles[tile.x+","+(tile.y+1)+","+tile.z];
                        if(t){
                            if (!evacTile(t)) {
                                if(t.x == scope.$parent.startTile2.x && t.y == scope.$parent.startTile2.y && t.z == scope.$parent.startTile2.z) return "Exit";
                                else return "Entrance";
                            }
                        }
                    }
                }
                return false;
            }

            scope.evacTapeRot = function (tile) {
                let rot = 0;
                if(!tile) return false;
                if(tile.tileType._id != "58cfd6549792e9313b1610e1" && tile.tileType._id != "58cfd6549792e9313b1610e2") return false;

                let dirEv = [];
                if(tile.tileType._id == "58cfd6549792e9313b1610e1"){ // ev1.png
                    dirEv = [0, 90, 180, 270];
                }else{
                    let r = tile.rot;
                    dirEv = [(90+r)%360, (180+r)%360, (270+r)%360];
                }
                let t;
                //Top
                t = scope.$parent.tiles[tile.x+","+(tile.y-1)+","+tile.z];
                if(t && dirEv.indexOf(0)>=0){
                    if (!evacTile(t)) {
                        rot = 0;
                    }
                }
                //Left
                t = scope.$parent.tiles[(tile.x-1)+","+tile.y+","+tile.z];
                if(t && dirEv.indexOf(270)>=0){
                    if (!evacTile(t)) {
                        rot = 270;
                    }
                }
                //Right
                t = scope.$parent.tiles[(tile.x+1)+","+tile.y+","+tile.z];
                if(t && dirEv.indexOf(90)>=0){
                    if (!evacTile(t)) {
                        rot = 90;
                    }
                }
                //Bottom
                t = scope.$parent.tiles[tile.x+","+(tile.y+1)+","+tile.z];
                if(t && dirEv.indexOf(180)>=0){
                    if (!evacTile(t)) {
                        rot = 180;
                    }
                }
                return rot%360;
            }


        }
    };
});


app.directive('rotateOnClick', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var deg = 0;
            element.bind('click', function () {
                element.removeClass('rot' + deg);
                deg += 90;
                if (deg >= 360)
                    deg = 0;
                element.addClass('rot' + deg);
                element.attr("rot", deg);
            });
        }
    };
});


app.directive('lvlDraggable', ['$rootScope', 'uuid', function ($rootScope, uuid) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs, controller) {
            console.log("linking draggable element");
            angular.element(el).attr("draggable", "true");

            var id = angular.element(el).attr("id");

            if (!id) {
                id = uuid.new();
                angular.element(el).attr("id", id);
            }
            //console.log(id);
            el.bind("dragstart", function (e) {
                e.dataTransfer = e.originalEvent.dataTransfer;
                e.dataTransfer.setData('text', id);
                $rootScope.$emit("LVL-DRAG-START");
            });

            el.bind("dragend", function (e) {
                $rootScope.$emit("LVL-DRAG-END");
            });
        }
    };
}]);

app.directive('lvlDropTarget', ['$rootScope', 'uuid', function ($rootScope, uuid) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs, controller) {
            var id = angular.element(el).attr("id");
            if (!id) {
                id = uuid.new();
                angular.element(el).attr("id", id);
            }

            el.bind("dragover", function (e) {
                if (e.preventDefault) {
                    e.preventDefault(); // Necessary. Allows us to drop.
                }
                e.dataTransfer = e.originalEvent.dataTransfer;
                e.dataTransfer.dropEffect = 'move'; // See the section on the DataTransfer object.
                return false;
            });

            el.bind("dragenter", function (e) {
                // this / e.target is the current hover target.
                angular.element(e.target).addClass('lvl-over');
            });

            el.bind("dragleave", function (e) {
                angular.element(e.target).removeClass('lvl-over'); // this / e.target is previous target element.
            });

            el.bind("drop", function (e) {
                if (e.preventDefault) {
                    e.preventDefault(); // Necessary. Allows us to drop.
                }

                if (e.stopPropagation) {
                    e.stopPropagation(); // Necessary. Allows us to drop.
                }
                e.dataTransfer = e.originalEvent.dataTransfer;
                var data = e.dataTransfer.getData("text");
                var dest = document.getElementById(id);
                var src = document.getElementById(data);
                var drop = angular.element(dest); // The div where i dropped the tile
                var drag = angular.element(src); // The div where I lifted this tile


                // If we dropped something on an image this is back to the tool box
                if (drop[0].tagName == "IMG") {
                    // Remove the element from where we dragged it
                    delete scope.tiles[drag.attr("x") + "," + drag.attr("y") + "," +
                    drag.attr("z")];
                } else if (drag[0].tagName == "IMG") { // If we drag out an image, this is a new tile

                    scope.tiles[drop.attr("x") + "," + drop.attr("y") + "," +
                    drop.attr("z")] = {
                        rot: +drag.attr("rot"),
                        tileType: scope.tileSet.tiles.find(function (t) {
                            return t.tileType._id == drag.attr("tile-id")
                        }).tileType,
                        items: {
                            obstacles: 0,
                            speedbumps: 0,
                            rampPoints: false
                        }
                    };
                    // We dragged an non-existing tile
                } else if (!scope.tiles[drag.attr("x") + "," + drag.attr("y") + "," +
                    drag.attr("z")]) {
                    // Just ignore!
                    ;
                } else if (drag.attr("x") != drop.attr("x") ||
                    drag.attr("y") != drop.attr("y") ||
                    drag.attr("z") != drop.attr("z")) {
                    scope.tiles[drop.attr("x") + "," + drop.attr("y") + "," +
                    drop.attr("z")] =
                        scope.tiles[drag.attr("x") + "," + drag.attr("y") + "," +
                        drag.attr("z")];
                    // Remove the element from where we dragged it
                    delete scope.tiles[drag.attr("x") + "," + drag.attr("y") + "," +
                    drag.attr("z")];
                }
                scope.updateUsedCount();
                scope.updateTileIndex();
                scope.$apply();

            });

            $rootScope.$on("LVL-DRAG-START", function () {
                var el = document.getElementById(id);
                angular.element(el).addClass("lvl-target");
            });

            $rootScope.$on("LVL-DRAG-END", function () {
                var el = document.getElementById(id);
                angular.element(el).removeClass("lvl-target");
                angular.element(el).removeClass("lvl-over");
            });
        }
    };
}]);

