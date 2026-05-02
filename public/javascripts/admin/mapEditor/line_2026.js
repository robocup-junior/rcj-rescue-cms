// register the directive with your app module
var app = angular.module('LineEditor', ['ngTouch','lvl.services', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('LineEditorController', ['$scope', '$rootScope', '$uibModal', '$log', '$http', '$translate', function ($scope, $rootScope, $uibModal, $log, $http, $translate) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    // History (Undo/Redo) Management
    let undoStack = [];
    let redoStack = [];

    $scope.saveHistory = function () {
        // Limit undo stack size to 50
        if (undoStack.length > 50) {
            undoStack.shift();
        }
        const state = {
            tiles: $scope.tiles,
            startTile: $scope.startTile,
            startTile2: $scope.startTile2
        };
        undoStack.push(JSON.stringify(state));
        redoStack = []; // Clear redo stack on new action
    };

    $scope.undo = function () {
        if (undoStack.length === 0) return;
        const currentState = {
            tiles: $scope.tiles,
            startTile: $scope.startTile,
            startTile2: $scope.startTile2
        };
        redoStack.push(JSON.stringify(currentState));
        const previousState = JSON.parse(undoStack.pop());
        $scope.tiles = previousState.tiles;
        $scope.startTile = previousState.startTile;
        $scope.startTile2 = previousState.startTile2;
        $scope.updateUsedCount();
        $scope.updateTileIndex();
        if (!$scope.$$phase) $scope.$apply();
    };

    $scope.redo = function () {
        if (redoStack.length === 0) return;
        const currentState = {
            tiles: $scope.tiles,
            startTile: $scope.startTile,
            startTile2: $scope.startTile2
        };
        undoStack.push(JSON.stringify(currentState));
        const nextState = JSON.parse(redoStack.pop());
        $scope.tiles = nextState.tiles;
        $scope.startTile = nextState.startTile;
        $scope.startTile2 = nextState.startTile2;
        $scope.updateUsedCount();
        $scope.updateTileIndex();
        if (!$scope.$$phase) $scope.$apply();
    };

    $scope.canUndo = function() {
        return undoStack.length > 0;
    };

    $scope.canRedo = function() {
        return redoStack.length > 0;
    };

    // Keyboard Shortcuts for Undo/Redo
    window.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const isZ = e.key === 'z' || e.key === 'Z';
        const isY = e.key === 'y' || e.key === 'Y';
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;

        if (isCmdOrCtrl && isZ && !e.shiftKey) {
            e.preventDefault();
            $scope.undo();
        } else if (isCmdOrCtrl && (isY || (isZ && e.shiftKey))) {
            e.preventDefault();
            $scope.redo();
        }
    });

    $scope.competitionId = competitionId;
    $scope.se_competition = competitionId;

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
                setTimeout($scope.centerMap, 100);

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
        
        $scope.saveHistory();
        $scope.tiles[x + ',' + y + ',' + $scope.z].rot += 90;
        if ($scope.tiles[x + ',' + y + ',' + $scope.z].rot >= 360)
            $scope.tiles[x + ',' + y + ',' + $scope.z].rot = 0;
        $scope.updateTileIndex();
    }

    $scope.selectedTiles = {};

    $scope.toggleSelection = function (x, y, z) {
        const key = x + ',' + y + ',' + z;
        if ($scope.selectedTiles[key]) {
            delete $scope.selectedTiles[key];
        } else if ($scope.tiles[key]) {
            $scope.selectedTiles[key] = true;
        }
    };

    $scope.selectTile = function (x, y, z) {
        const key = x + ',' + y + ',' + z;
        if ($scope.tiles[key]) {
            $scope.selectedTiles[key] = true;
        }
    };

    $scope.isSelected = function (x, y, z) {
        return !!$scope.selectedTiles[x + ',' + y + ',' + z];
    };

    $scope.clearSelection = function () {
        $scope.selectedTiles = {};
    };

    $scope.hasSelection = function () {
        return Object.keys($scope.selectedTiles).length > 0;
    };

    $scope.selectedCount = function () {
        return Object.keys($scope.selectedTiles).length;
    };

    $scope.handleTileClick = function (x, y, event) {
        if (event.ctrlKey || event.metaKey) {
            $scope.toggleSelection(x, y, $scope.z);
        } else if (event.shiftKey) {
            // Future: Implement range selection?
            $scope.toggleSelection(x, y, $scope.z);
        } else {
            // Normal click - rotate as before, or clear and select if we want that
            // For now, let's keep rotation on normal click to avoid breaking existing flow
            $scope.rotateTile(x, y);
        }
    };

    // Marquee Selection and Panning Logic
    let isPanning = false;
    let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
    let marqueeStart = { x: 0, y: 0 };
    $scope.isMarqueeActive = false;
    $scope.marqueeStyle = {};
    
    $scope.handleMapMouseDown = function (event) {
        // If clicking on a tile or its content, let the tile handle its own drag/click
        if (event.target.closest('tile')) return;

        // Middle click (1) or Right click (2) -> PANNING
        // Alt + Left click -> PANNING
        const isPanningButton = event.button === 1 || event.button === 2 || 
                               (event.button === 0 && event.altKey);

        if (isPanningButton) {
            $scope.isPanning = true;
            panStart = {
                x: event.clientX,
                y: event.clientY,
                scrollLeft: event.currentTarget.scrollLeft,
                scrollTop: event.currentTarget.scrollTop
            };
            event.currentTarget.style.cursor = 'grabbing';
            event.preventDefault();
        } else if (event.button === 0 && !event.shiftKey) {
            // Regular Left Click on background -> MARQUEE
            $scope.startMarquee(event);
        } else if (event.button === 0 && event.shiftKey) {
            // Shift + Left Click -> Also MARQUEE (additive selection)
            $scope.startMarquee(event);
        }
    };

    // Prevent context menu when right-dragging for pan
    window.addEventListener('contextmenu', function(e) {
        if ($scope.isPanning) {
            e.preventDefault();
        }
    }, false);

    $scope.handleMapMouseMove = function (event) {
        if ($scope.isPanning) {
            const dx = event.clientX - panStart.x;
            const dy = event.clientY - panStart.y;
            event.currentTarget.scrollLeft = panStart.scrollLeft - dx;
            event.currentTarget.scrollTop = panStart.scrollTop - dy;
        } else {
            $scope.moveMarquee(event);
        }
    };

    $scope.handleMapMouseUp = function (event) {
        if ($scope.isPanning) {
            $scope.isPanning = false;
            event.currentTarget.style.cursor = 'crosshair';
        } else {
            $scope.endMarquee(event);
        }
    };
    
    $scope.startMarquee = function (event) {
        event.preventDefault();
        $scope.isMarqueeActive = true;
        
        // Use offset coordinates relative to the scrollable content (aligner)
        const container = document.getElementById('map-container');
        const aligner = container.firstElementChild;
        const rect = aligner.getBoundingClientRect();
        
        marqueeStart = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        
        $scope.marqueeStyle = {
            'left': marqueeStart.x + 'px',
            'top': marqueeStart.y + 'px',
            'width': '0px',
            'height': '0px'
        };

        if (!event.ctrlKey && !event.metaKey) {
            $scope.clearSelection();
        }
        
        if (!$scope.$$phase) $scope.$apply();
    };

    $scope.moveMarquee = function (event) {
        if (!$scope.isMarqueeActive) return;
        
        const container = document.getElementById('map-container');
        const aligner = container.firstElementChild;
        const rect = aligner.getBoundingClientRect();
        const current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        
        const left = Math.min(marqueeStart.x, current.x);
        const top = Math.min(marqueeStart.y, current.y);
        const width = Math.abs(marqueeStart.x - current.x);
        const height = Math.abs(marqueeStart.y - current.y);
        
        $scope.marqueeStyle = {
            'left': left + 'px',
            'top': top + 'px',
            'width': width + 'px',
            'height': height + 'px'
        };
        
        if (!$scope.$$phase) $scope.$apply();
    };

    $scope.endMarquee = function (event) {
        if (!$scope.isMarqueeActive) return;
        
        const marquee = document.getElementById('selection-marquee');
        const mRect = marquee.getBoundingClientRect();
        
        if (mRect.width > 2 || mRect.height > 2) {
            // Find all slots that overlap with the marquee
            const slots = document.querySelectorAll('.slot');
            
            // If not holding ctrl/meta, clear existing selection
            if (!event.ctrlKey && !event.metaKey) {
                $scope.clearSelection();
            }

            slots.forEach(slot => {
                const sRect = slot.getBoundingClientRect();
                // Check if the slot is COMPLETELY inside the marquee
                if (sRect.left >= mRect.left && 
                    sRect.right <= mRect.right && 
                    sRect.top >= mRect.top && 
                    sRect.bottom <= mRect.bottom) {
                    
                    const scope = angular.element(slot).scope();
                    if (scope) {
                        $scope.selectTile(scope.c, scope.r, $scope.z);
                    }
                }
            });
        }
        
        $scope.isMarqueeActive = false;
        if (!$scope.$$phase) $scope.$apply();
    };


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

    $scope.openSaveAsModal = function () {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'saveAsModal_2026.html',
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

    $scope.bulkRotate = function () {
        const keys = Object.keys($scope.selectedTiles);
        if (keys.length === 0) return;
        
        for (let key of keys) {
            if ($scope.tiles[key]) {
                $scope.tiles[key].rot = ($scope.tiles[key].rot + 90) % 360;
            }
        }
        $scope.updateTileIndex();
    };

    $scope.bulkDelete = function () {
        const keys = Object.keys($scope.selectedTiles);
        if (keys.length === 0) return;
        
        for (let key of keys) {
            delete $scope.tiles[key];
        }
        $scope.clearSelection();
        $scope.updateUsedCount();
        $scope.updateTileIndex();
    };

    $scope.clipboard = null;
    $scope.isCutSource = function (x, y, z) {
        if (!$scope.isCutting || !$scope.clipboard || !$scope.clipboard.sourceKeys) return false;
        return $scope.clipboard.sourceKeys.includes(x + ',' + y + ',' + z);
    };

    $scope.copySelection = function (silent) {
        const keys = Object.keys($scope.selectedTiles);
        if (keys.length === 0) return;

        if (!silent) $scope.isCutting = false;
        
        // Find the bounding box to normalize coordinates (including Z)
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        for (let key of keys) {
            const coords = key.split(',').map(Number);
            const x = coords[0];
            const y = coords[1];
            const z = coords[2];
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
        }
        
        $scope.clipboard = {
            tiles: {},
            offsetX: minX,
            offsetY: minY,
            offsetZ: minZ
        };
        
        for (let key of keys) {
            if ($scope.tiles[key]) {
                const coords = key.split(',').map(Number);
                const x = coords[0];
                const y = coords[1];
                const z = coords[2];
                const relX = x - minX;
                const relY = y - minY;
                const relZ = z - minZ;
                $scope.clipboard.tiles[relX + ',' + relY + ',' + relZ] = angular.copy($scope.tiles[key]);
            }
        }
        
        if (!silent) {
            Toast.fire({
                type: 'info',
                title: "Copied " + keys.length + " tiles",
                text: "Stamp mode activated. Click to place."
            });

            // Directly enter stamp mode after copying
            $scope.isPasting = true;
            $scope.clearSelection();
        } else if ($scope.isCutting) {
            // For cutting, we store the original keys to delete them upon confirmation
            $scope.clipboard.sourceKeys = keys;
        }
    };

    $scope.lastMouseTile = { x: 0, y: 0 };
    $scope.updateMousePos = function (c, r) {
        $scope.lastMouseTile.x = c;
        $scope.lastMouseTile.y = r;
    };

    $scope.isPasting = false;
    $scope.togglePasteMode = function () {
        if (!$scope.clipboard) return;
        $scope.isPasting = !$scope.isPasting;
        if ($scope.isPasting) {
            $scope.clearSelection();
            Toast.fire({
                type: 'info',
                title: "Stamp Mode Active",
                text: "Click on the map to place tiles. Press Esc to cancel."
            });
        }
    };

    $scope.isInGhostRange = function (c, r) {
        if ((!$scope.isPasting && !$rootScope.isDraggingGroup) || !$scope.clipboard) return false;
        const rx = c - $scope.lastMouseTile.x;
        const ry = r - $scope.lastMouseTile.y;
        return !!$scope.clipboard.tiles[rx + ',' + ry + ',0'];
    };

    $scope.getGhostTile = function (c, r) {
        if (!$scope.clipboard) return null;
        const rx = c - $scope.lastMouseTile.x;
        const ry = r - $scope.lastMouseTile.y;
        return $scope.clipboard.tiles[rx + ',' + ry + ',0'];
    };

    $scope.isCutting = false;
    $scope.cutSelection = function () {
        if (!$scope.hasSelection()) return;
        $scope.isCutting = true;
        $scope.copySelection(true);
        $scope.isPasting = true;
        Toast.fire({
            type: 'info',
            title: "Cut Mode Active",
            text: "Stamp the tiles to complete the move."
        });
        $scope.clearSelection();
    };

    $scope.confirmPaste = function () {
        if (!$scope.isPasting || !$scope.clipboard) return;
        
        $scope.saveHistory();
        
        const targetX = $scope.lastMouseTile.x;
        const targetY = $scope.lastMouseTile.y;
        const targetZ = $scope.z;

        // If cutting, we need to delete the original tiles first (handled by copySelection storing them)
        // Wait, if cutting, the original tiles are still in $scope.tiles.
        // We should delete them now if we are in cut mode.
        if ($scope.isCutting && $scope.clipboard.sourceKeys) {
            for (let key of $scope.clipboard.sourceKeys) {
                delete $scope.tiles[key];
            }
        }

        for (let relKey in $scope.clipboard.tiles) {
            const coords = relKey.split(',').map(Number);
            const rx = coords[0];
            const ry = coords[1];
            const rz = coords[2];
            const newX = targetX + rx;
            const newY = targetY + ry;
            const newZ = targetZ + rz;
            
            if (newX >= 0 && newX < $scope.width && newY >= 0 && newY < $scope.length && newZ >= 0 && newZ < $scope.height) {
                const newKey = newX + ',' + newY + ',' + newZ;
                $scope.tiles[newKey] = angular.copy($scope.clipboard.tiles[relKey]);
                $scope.tiles[newKey].x = newX;
                $scope.tiles[newKey].y = newY;
                $scope.tiles[newKey].z = newZ;
                if (newZ == $scope.z) {
                    $scope.selectedTiles[newKey] = true;
                }
            }
        }
        
        $scope.isPasting = false;
        $scope.isCutting = false;
        $scope.updateUsedCount();
        $scope.updateTileIndex();
    };

    $scope.centerMap = function () {
        const container = document.getElementById('map-container');
        const mapTable = document.querySelector('.map-table-editor');
        if (container && mapTable) {
            const containerRect = container.getBoundingClientRect();
            const tableRect = mapTable.getBoundingClientRect();
            
            // Calculate current scroll position + relative distance from container edge
            const currentScrollLeft = container.scrollLeft;
            const currentScrollTop = container.scrollTop;
            
            // The table's absolute position within the scrollable content
            const tableLeftInContent = currentScrollLeft + (tableRect.left - containerRect.left);
            const tableTopInContent = currentScrollTop + (tableRect.top - containerRect.top);
            
            const targetLeft = tableLeftInContent + (tableRect.width / 2) - (containerRect.width / 2);
            const targetTop = tableTopInContent + (tableRect.height / 2) - (containerRect.height / 2);

            container.scrollTo({
                left: targetLeft,
                top: targetTop,
                behavior: 'smooth'
            });
        }
    };

    // Center when tiles are loaded or floor changes
    $scope.$watch('tiles', function(newVal) {
        if (newVal) setTimeout($scope.centerMap, 100);
    });
    
    // Initial center
    setTimeout($scope.centerMap, 500);

    // Keyboard Shortcuts
    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const isCopy = (e.ctrlKey || e.metaKey) && e.keyCode === 67; // Ctrl+C
        const isCut = (e.ctrlKey || e.metaKey) && e.keyCode === 88; // Ctrl+X
        const isPaste = (e.ctrlKey || e.metaKey) && e.keyCode === 86; // Ctrl+V
        const isDelete = e.keyCode === 46 || e.keyCode === 8; // Delete or Backspace
        const isEsc = e.keyCode === 27; // Esc

        $scope.$apply(function() {
            if (isCopy) {
                e.preventDefault();
                $scope.copySelection();
            } else if (isCut) {
                e.preventDefault();
                $scope.cutSelection();
            } else if (isPaste) {
                e.preventDefault();
                $scope.togglePasteMode();
            } else if (isDelete) {
                if ($scope.hasSelection()) {
                    e.preventDefault();
                    $scope.bulkDelete();
                }
            } else if (isEsc) {
                if ($scope.isPasting) {
                    $scope.isPasting = false;
                    $scope.isCutting = false;
                }
            }
        });
    });

    $scope.saveMapAs = function (newName, targetCompetitionId) {
        if ($scope.startNotSet()) {
            Toast.fire({
                type: 'error',
                title: "Error",
                html: "You must define a starting && re-starting (after evacuation zone) tile by right-clicking a tile"
            })
            return;
        }

        if (newName == $scope.name && targetCompetitionId == $scope.competitionId) {
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
            competition: targetCompetitionId,
            tileSet: $scope.tileSet._id,
            name: newName,
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
            window.location.replace("/admin/" + targetCompetitionId + "/" + leagueId + "/mapEditor/" + response.data.id)
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

    $scope.makeImage = function(silent = false){
      window.scrollTo(0,0);
      html2canvas(document.getElementById("outputImageArea"),{
        scale: 5
      }).then(function(canvas) {
        let imgData = canvas.toDataURL();
        $http.post("/api/maps/line/image/" + mapId, {img: imgData}).then(function (response) {
          if (!silent) {
            Toast.fire({
              type: 'success',
              title: "Created image!"
            })
          }
        }, function (response) {
          console.log("Error: " + response.statusText);
          if (!silent) {
            Toast.fire({
              type: 'error',
              title: "Error",
              html: response.data.msg
            })
          }
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
                    $scope.makeImage(true);
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
        const key = x + ',' + y + ',' + $scope.z;
        if (!$scope.tiles[key]) {
            swal("Oops!", "Need to place a tile here before changing it.", "error");
            return;
        }

        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: '/templates/line_editor_modal.html?gs',
            controller: 'ModalInstanceCtrl',
            resolve: {
                tile: function () {
                    // Clone the tile to prevent direct modification before OK
                    let t = angular.copy($scope.tiles[key]);
                    t.start = $scope.startTile.x == x && $scope.startTile.y == y && $scope.startTile.z == $scope.z;
                    t.start2 = $scope.startTile2.x == x && $scope.startTile2.y == y && $scope.startTile2.z == $scope.z;
                    return t;
                },
                z: function () {
                    return $scope.z;
                },
                height: function () {
                    return $scope.height;
                }
            }
        });

        modalInstance.result.then(function (modifiedTile) {
            $scope.saveHistory();
            
            // Apply modified values back to the original tile
            $scope.tiles[key].items = modifiedTile.items;
            $scope.tiles[key].checkPoint = modifiedTile.checkPoint;
            $scope.tiles[key].levelUp = modifiedTile.levelUp;
            $scope.tiles[key].levelDown = modifiedTile.levelDown;

            if (modifiedTile.start) {
                $scope.startTile.x = x;
                $scope.startTile.y = y;
                $scope.startTile.z = $scope.z;
            }else if($scope.startTile.x == x && $scope.startTile.y == y && $scope.startTile.z == $scope.z){
                $scope.startTile.x = -1;
                $scope.startTile.y = -1;
                $scope.startTile.z = -1;
            }
            if (modifiedTile.start2) {
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
            $scope.updateTileIndex();
        });
    };
}]);


// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

app.controller('ModalInstanceCtrl', ['$scope', '$uibModalInstance', 'tile', 'z', 'height', function ($scope, $uibModalInstance, tile, z, height) {
    $scope.tile = tile;
    $scope.z = z;
    $scope.height = height;
    $scope.cycleTileLevel = function (dir) {
        if ($scope.tile.levelUp === dir) {
            $scope.tile.levelUp = undefined;
            if ($scope.z > 0) $scope.tile.levelDown = dir;
        } else if ($scope.tile.levelDown === dir) {
            $scope.tile.levelDown = undefined;
        } else {
            if ($scope.z < $scope.height - 1) {
                $scope.tile.levelUp = dir;
                $scope.tile.levelDown = undefined;
            } else if ($scope.z > 0) {
                $scope.tile.levelDown = dir;
                $scope.tile.levelUp = undefined;
            }
        }
    };

    $scope.ok = function () {
        $uibModalInstance.close($scope.tile);
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
            
            // Helper to get the correct scope that has our map data
            const getMapScope = () => {
                let s = scope;
                while (s && !s.copySelection) {
                    s = s.$parent;
                }
                return s || scope;
            };

            // Pre-load a transparent pixel image to hide the native drag image
            const transparentImage = new Image();
            transparentImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

            el.bind("dragstart", function (e) {
                e.dataTransfer = e.originalEvent.dataTransfer;
                e.dataTransfer.setData('text', id);
                $rootScope.$emit("LVL-DRAG-START");
                
                const srcX = Number(attrs.x);
                const srcY = Number(attrs.y);
                const srcZ = Number(attrs.z);
                
                const mScope = getMapScope();
                if (mScope.isSelected && mScope.isSelected(srcX, srcY, srcZ)) {
                    // Moving a group! Activate ghost mode
                    
                    // Hide native drag image using the pre-loaded transparent image
                    if (e.dataTransfer.setDragImage) {
                        e.dataTransfer.setDragImage(transparentImage, 0, 0);
                    }

                    mScope.$apply(function() {
                        $rootScope.isDraggingGroup = true;
                        mScope.copySelection(true);
                        mScope.isPasting = true;
                        
                        // Calculate offset of the grabbed tile relative to the selection origin
                        $rootScope.dragOffset = {
                            x: srcX - mScope.clipboard.offsetX,
                            y: srcY - mScope.clipboard.offsetY
                        };
                        
                        // Add class to original tiles to make them semi-transparent
                        const selectedKeys = Object.keys(mScope.selectedTiles);
                        selectedKeys.forEach(key => {
                            const slot = document.querySelector(`.slot[ng-class*="${key}"]`);
                            if (slot) angular.element(slot).addClass('moving-source');
                        });
                    });
                }
            });

            el.bind("dragend", function (e) {
                $rootScope.$emit("LVL-DRAG-END");
                const mScope = getMapScope();
                mScope.$apply(function() {
                    if ($rootScope.isDraggingGroup) {
                        $rootScope.isDraggingGroup = false;
                        $rootScope.dragOffset = null;
                        mScope.isPasting = false;
                        document.querySelectorAll('.slot.moving-source').forEach(el => {
                            angular.element(el).removeClass('moving-source');
                        });
                    }
                });
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

            // Helper to get the correct scope that has our map data
            const getMapScope = () => {
                let s = scope;
                while (s && !s.copySelection) {
                    s = s.$parent;
                }
                return s || scope;
            };

            el.bind("dragover", function (e) {
                if (e.preventDefault) {
                    e.preventDefault(); // Necessary. Allows us to drop.
                }
                e.dataTransfer = e.originalEvent.dataTransfer;
                e.dataTransfer.dropEffect = 'move'; 
                
                // Update ghost position during drag
                const targetX = Number(attrs.x);
                const targetY = Number(attrs.y);
                const mScope = getMapScope();
                mScope.$apply(function() {
                    // Offset the origin of the ghost based on where we grabbed the selection
                    const originX = targetX - ($rootScope.dragOffset ? $rootScope.dragOffset.x : 0);
                    const originY = targetY - ($rootScope.dragOffset ? $rootScope.dragOffset.y : 0);
                    mScope.updateMousePos(originX, originY);
                });
                
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

                const destX = Number(drop.attr("x"));
                const destY = Number(drop.attr("y"));
                const destZ = Number(drop.attr("z"));

                const mScope = getMapScope();
                mScope.saveHistory();

                // If we dropped something on an image this is back to the tool box (Deletion)
                if (drop[0].tagName == "IMG") {
                    if (mScope.isSelected(drag.attr("x"), drag.attr("y"), drag.attr("z"))) {
                        // Delete all selected tiles
                        for (let key in mScope.selectedTiles) {
                            delete mScope.tiles[key];
                        }
                        mScope.clearSelection();
                    } else {
                        delete mScope.tiles[drag.attr("x") + "," + drag.attr("y") + "," +
                        drag.attr("z")];
                    }
                } else if (drag[0].tagName == "IMG") { // If we drag out an image, this is a new tile
                    mScope.tiles[destX + "," + destY + "," + destZ] = {
                        rot: +drag.attr("rot"),
                        tileType: mScope.tileSet.tiles.find(function (t) {
                            return t.tileType._id == drag.attr("tile-id")
                        }).tileType,
                        items: {
                            obstacles: 0,
                            speedbumps: 0,
                            rampPoints: false
                        }
                    };
                } else {
                    const srcX = Number(drag.attr("x"));
                    const srcY = Number(drag.attr("y"));
                    const srcZ = Number(drag.attr("z"));

                    if (mScope.isSelected(srcX, srcY, srcZ)) {
                        // Bulk Move
                        const offsetX = destX - srcX;
                        const offsetY = destY - srcY;
                        const offsetZ = destZ - srcZ;

                        const selectedKeys = Object.keys(mScope.selectedTiles);
                        
                        // First, extract all selected tiles
                        const movingTiles = {};
                        for (let key of selectedKeys) {
                            movingTiles[key] = mScope.tiles[key];
                            delete mScope.tiles[key];
                        }

                        // Then, place them in new positions
                        for (let key of selectedKeys) {
                            const coords = key.split(',').map(Number);
                            const newX = coords[0] + offsetX;
                            const newY = coords[1] + offsetY;
                            const newZ = coords[2] + offsetZ;
                            
                            // Only place if within bounds
                            if (newX >= 0 && newX < mScope.width && newY >= 0 && newY < mScope.length && newZ >= 0 && newZ < mScope.height) {
                                const newKey = newX + ',' + newY + ',' + newZ;
                                mScope.tiles[newKey] = movingTiles[key];
                                mScope.tiles[newKey].x = newX;
                                mScope.tiles[newKey].y = newY;
                                mScope.tiles[newKey].z = newZ;
                            }
                        }
                        
                        mScope.updateUsedCount();
                        mScope.updateTileIndex();
                        
                        // Update selection to new positions
                        mScope.clearSelection();
                        for (let key of selectedKeys) {
                            const coords = key.split(',').map(Number);
                            const newX = coords[0] + offsetX;
                            const newY = coords[1] + offsetY;
                            const newZ = coords[2] + offsetZ;
                            if (newX >= 0 && newX < mScope.width && newY >= 0 && newY < mScope.length && newZ >= 0 && newZ < mScope.height) {
                                mScope.selectedTiles[newX + ',' + newY + ',' + newZ] = true;
                            }
                        }
                    } else if (srcX != destX || srcY != destY || srcZ != destZ) {
                        // Single Move
                        mScope.tiles[destX + "," + destY + "," + destZ] =
                            mScope.tiles[srcX + "," + srcY + "," + srcZ];
                        delete mScope.tiles[srcX + "," + srcY + "," + srcZ];
                    }
                }
                mScope.updateUsedCount();
                mScope.updateTileIndex();
                mScope.$apply();

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

app.controller('SaveAsModalCtrl', ['$scope', '$uibModalInstance', 'competitions', 'currentCompetitionId', 'currentName', function ($scope, $uibModalInstance, competitions, currentCompetitionId, currentName) {
    $scope.competitions = competitions;
    $scope.se_competition = currentCompetitionId;
    $scope.asname = currentName + "_copy";

    $scope.saveAsOk = function () {
        $uibModalInstance.close({
            name: $scope.asname,
            competitionId: $scope.se_competition
        });
    };

    $scope.saveAsCancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);
