/* Tags:
 *      recalculate
 *      proto file creation
 *      quaternions
 *      rotation wall tokens
 *      tile typedef
 *      json read
 *      custom room 4
 *      max score
 *      draw custom room 4
 *
 *  You can use the search function in your editor with "tag nameoftag" to more easily navigate around the file.
 *  For example, starting to search:
 *
 *      tag quat
 *
 *  should get you to the section of about quaternions.
 */

DISABLE_RANDOMNESS = false

// register the directive with your app module
var app = angular.module('SimEditor', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('SimEditorController', ['$scope', '$uibModal', '$log', '$http','$translate', function ($scope, $uibModal, $log, $http, $translate) {

    // World export and checks (sim_world_2026.js); the editor's map is its $scope
    const W = SimWorld2026;
    const PASSAGE_14 = W.PASSAGE_14;
    const PASSAGE_34 = W.PASSAGE_34;
    const WALL_HALF_CM = W.WALL_HALF_CM;
    const getRandomAngle = W.getRandomAngle;
    function checkRoomNumber(...args) { return W.checkRoomNumber($scope, ...args); }
    function checkRoomNumberKey(...args) { return W.checkRoomNumberKey($scope, ...args); }
    const calculateWallTokenRot = W.calculateWallTokenRot;
    const cognitiveCodeToVictimLetter = W.cognitiveCodeToVictimLetter;
    function createWorld() { return W.createWorld($scope, { createArea4Solid: createArea4Solid, createArea4Victims: createArea4Victims }); }
    const presetBounds = W.presetBounds;
    function room4Region(...args) { return W.room4Region($scope, ...args); }
    function passageTiles(...args) { return W.passageTiles($scope, ...args); }
    function presetStatus(...args) { return W.presetStatus($scope, ...args); }
    function wallShapes(...args) { return W.wallShapes($scope, ...args); }
    function connectionStatus(...args) { return W.connectionStatus($scope, ...args); }
    const randomCognitiveCode = W.randomCognitiveCode;

    $scope.competitionId = competitionId;
    $scope.mapId = mapId;

    let trans = [];
    function loadTranslation(tag){
        $translate(`admin.simMapEditor.js.${tag}`).then(function (val) {
            trans[tag] = val;
        }, function (translationId) {
        // = translationId;
        });
    }

    loadTranslation("startTileError");

    $scope.z = 0;
    $scope.startTile = {
        x: 0,
        y: 0,
        z: 0
    };
    $scope.height = 1;
    $scope.width = 1;
    $scope.length = 1;
    $scope.time = 480;
    $scope.name = "Awesome world";
    $scope.cells = {};
    $scope.dice = [];
    $scope.saveasname ="";
    $scope.finished = true;
    $scope.selectRoom = -1;
    $scope.roomTiles = [[], [], []];
    $scope.roomColors = ["red", "green", "blue"]
    $scope.area4Room = 0
    $scope.room4VicTypes = [];
    $scope.room4Tokens = [];
    $scope.room4StampTypes = SimRoom4World2026.stampTypes;
    $scope.area4 = SimWorld2026.area4Presets();

    // Custom room 4 setup
    $scope.room4Img = new Image;
    /*let imgElement = document.getElementById("inputImg");
    let inputElement = document.getElementById("selectImg");
    inputElement.addEventListener("change", (e) => {
        imgElement.src = URL.createObjectURL(e.target.files[0]);
    }, false);*/

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

    function get_cell(x, y, z) {
        return $scope.cells[x +','+y+','+z]
    }

    function set_cell(x, y, z, val) {
        $scope.cells[x +','+y+','+z] = val;
    }

    function init_cell(x, y, z) {
        $scope.cells[x +','+y+','+z] = {};
    }

    // tag recalculate (sim_world_2026.js)
    $scope.recalculateLinear = function () {
        $scope.virtualWall = [];
        return W.recalculate($scope);
    };

    $scope.startNotSet = function () {
        return $scope.startTile.x == 0 && $scope.startTile.y == 0 &&
            $scope.startTile.z == 0;
    }

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
        let cell = get_cell(x, y, z)
        if(cell && cell.tile) {
            if(cell.tile.victims.bottom == type) return true;
            if(cell.tile.victims.top    == type) return true;
            if(cell.tile.victims.right  == type) return true;
            if(cell.tile.victims.left   == type) return true;
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

    $scope.tileColour = function(x, y, z, rotate=0){
        let cell = get_cell(x, y, z)
        if (!cell) return {};
        if (cell.isWall) {
            if (cell.isLinear)
                return {'background-color': 'black'};
            else
                return {'background-color': 'navy'};
        }

        if(cell.halfWall > 0){
            let direction = 180*(cell.halfWall-1)+(y%2==1?0:90);

            //Wall color
            let color = 'navy';
            if(cell.isLinear) color = 'black';

            direction += rotate;
            if(direction>=360) direction-=360;

            let gradient = String(direction) + "deg," + color + " 0%," + color + " 50%,white 50%,white 100%";
            return {'background': 'linear-gradient(' + gradient + ')'};

        }
        if (x % 2 == 1 && y % 2 == 1){
            let css = {};
            if(cell.isLinear){
                css['background-color'] = '#fffdea';
            }else{
                css['background-color'] = '#b4ffd5';
            }
            if(cell.tile.color) css['background-color'] = cell.tile.color;
            if(cell.tile.swamp) css['background-color'] = '#CD853F';
            if(cell.tile.black) css['background-color'] = '#000000';
            if(cell.tile.checkpoint) css['background-image'] = 'linear-gradient(to top left, #A5A5A5, #BABAC2, #E8E8E8, #A5A5A5, #BABAC2)';
            let roomNumber = checkRoomNumber(x,y,z);
            if(roomNumber === 2){
                css['border-color'] = '#359ef4';
                css['border-width'] = '3px';
            }else if(roomNumber === 3){
                css['border-color'] = '#ed9aef';
                css['border-width'] = '3px';
            }else if(roomNumber === 4){
                css['border-color'] = '#7500FF';
                css['border-width'] = '3px';
            }
            if(!cell.reachable) css['background-color'] = '#636e72';
            return css;
        }
        return {};
            
    };



    $scope.export = function(){
        /*let canvas = document.getElementById('room4canvas');
        let ctx = canvas.getContext('2d');
        let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let src = cv.matFromImageData(imgData);
        cv.imshow('outputCanvas', src);*/

        $scope.recalculateLinear();
        if ($scope.area4Room.value == "Custom Room") {
            createArea4Solid();
            createArea4Victims(0, 0);
        }
        var map = {
            name           : $scope.name,
            length         : $scope.length,
            height         : $scope.height,
            width          : $scope.width,
            finished       : $scope.finished,
            startTile      : $scope.startTile,
            cells          : $scope.cells,
            roomTiles      : $scope.roomTiles,
            time           : $scope.time,
            area4Room      : $scope.area4Room,
            room4CanvasSave: $scope.room4CanvasSave,
            room4VicTypes  : $scope.room4VicTypes,
            room4Tokens    : $scope.room4Tokens || [],
            connCheckOff   : !!$scope.connCheckOff,
        };
         var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(map))
         var downloadLink = document.createElement('a')
         document.body.appendChild(downloadLink);
         downloadLink.setAttribute("href",dataStr)
         downloadLink.setAttribute("download", $scope.name + '.json')
         downloadLink.click()
         document.body.removeChild(downloadLink);
    }

    $scope.exportW = function(){
        if($scope.startNotSet()){
            Swal.fire({
                type: 'error',
                title: 'Oops...',
                text: trans['startTileError'],
            });
            return;
        }
        const area4Problems = presetProblems();
        if (area4Problems.length) {
            Swal.fire({
                type: 'error',
                title: $translate.instant('admin.simMapEditor.area4Check.exportTitle'),
                html: '<ul style="text-align:left">' + area4Problems.map(function (key) {
                    return '<li>' + $translate.instant('admin.simMapEditor.area4Check.' + key) + '</li>';
                }).join('') + '</ul>'
            });
            return;
        }
        const roomProblems = $scope.connCheckOff ? [] : connectionProblems();
        if (roomProblems.length) {
            Swal.fire({
                type: 'error',
                title: $translate.instant('admin.simMapEditor.connCheck.exportTitle'),
                html: '<ul style="text-align:left">' + roomProblems.map(function (text) {
                    return '<li>' + text + '</li>';
                }).join('') + '</ul>'
            });
            return;
        }
        if($scope.area4Room.value == "Custom Room" && !room4CorrectSize()) {
            Swal.fire({
                type: 'error',
                title: 'Oops...',
                text: 'For input image for custom room 4: width:height ratio of image does not match width:height ratio of room 4 in maze'
            });
            return;
        }
        $scope.recalculateLinear();
        let w = createWorld();
        let blob = new Blob([w],{type:"text/plan"});
        let link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = $scope.name+'.wbt';
        link.click();
    }



    // tag json read

    // File APIに対応しているか確認
    // Check if the File API is supported
    if (window.File) {
        var select = document.getElementById('select');

        // ファイルが選択されたとき
        // when a file is selected
        select.addEventListener('change', function (e) {
            // 選択されたファイルの情報を取得
            // Get the data of the selected file.
            var fileData = e.target.files[0];

            var reader = new FileReader();
            // ファイル読み取りに失敗したとき
            // if reading the file failed
            reader.onerror = function () {
                alert('ファイル読み取りに失敗しました')
                alert('Failed to read the file')
            }
            // ファイル読み取りに成功したとき
            // if the file was read correctly 
            reader.onload = function () {
                var data = JSON.parse(reader.result);
                $scope.cells         = data.cells;
                $scope.competitionId = competitionId;

                // Sync cognitive codes to cell.tile.victims so score calc picks them up
                const _cogDirs = ['top', 'right', 'bottom', 'left'];
                const _letterToNum = {F: 5, P: 6, C: 7, O: 8};
                Object.keys($scope.cells).forEach(function(key) {
                    const _cell = $scope.cells[key];
                    if (_cell.isTile && _cell.tile) {
                        if (_cell.tile.cognitives) {
                            _cogDirs.forEach(function(dir) {
                                const code = _cell.tile.cognitives[dir + '_code'];
                                if (!code) return;
                                if (!_cell.tile.victims) _cell.tile.victims = {};
                                const letter = cognitiveCodeToVictimLetter(code);
                                if (letter) _cell.tile.victims[dir] = letter;
                            });
                        }
                        if (_cell.tile.halfWallCognitives) {
                            for (var _i = 0; _i < 16; _i++) {
                                var _code = _cell.tile.halfWallCognitives[_i];
                                if (!_code || _code.length !== 5) continue;
                                if (!_cell.tile.halfWallVic) _cell.tile.halfWallVic = [];
                                var _letter = cognitiveCodeToVictimLetter(_code);
                                if (_letter) _cell.tile.halfWallVic[_i] = _letterToNum[_letter];
                            }
                        }
                    }
                });

                $scope.startTile         = data.startTile;
                $scope.numberOfDropTiles = data.numberOfDropTiles;
                $scope.height            = data.height;
                $scope.width             = data.width;
                $scope.length            = data.length;
                $scope.name              = data.name;
                $scope.time              = data.time;
                $scope.finished          = data.finished;

                $scope.roomTiles       = data.roomTiles;
                $scope.area4Room       = data.area4Room;
                $scope.connCheckOff    = !!data.connCheckOff;
                $scope.room4CanvasSave = data.room4CanvasSave || null;
                // turns / ring codes of the room 4 stamps (custom room 4 creator)
                $scope.room4Tokens     = data.room4Tokens || [];
                // A map without a custom room 4 picture leaves the image empty: assigning undefined
                // to src would request "<page>/undefined" from the server
                if ($scope.room4CanvasSave) $scope.room4Img.src = $scope.room4CanvasSave;
                else $scope.room4Img = new Image();
                if (data.room4VicTypes != undefined)
                    $scope.room4VicTypes = data.room4VicTypes;

                $scope.updateRoom4Pick();

                if(data.startTile) $scope.cells[data.startTile.x + ',' + data.startTile.y + ',' + data.startTile.z].tile.checkpoint = false;

                $scope.$apply();
            }

            // ファイル読み取りを実行
            // Actually read the file
            reader.readAsText(fileData);
        }, false);
    }

    // ---- Inserting and removing rows / columns (as in the Maze editor) ----------------------
    // Grid indices: tiles are odd, the walls between them even. Everything keyed by position
    // moves with the grid: cells, the room tiles, the start tile and the custom room 4 picture.
    function gridKeyShift(key, axis, from, amount) {
        const p = key.split(',').map(Number);
        const i = axis === 'x' ? 0 : 1;
        if (p[i] < from) return key;
        p[i] += amount;
        return p.join(',');
    }

    function room4Box() {
        const tiles = (($scope.roomTiles && $scope.roomTiles[2]) || []).map(function (k) { return k.split(',').map(Number); })
            .filter(function (p) { return p[2] === 0; });
        if (!tiles.length) return null;
        const xs = tiles.map(function (p) { return (p[0] - 1) / 2; }), ys = tiles.map(function (p) { return (p[1] - 1) / 2; });
        return { minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys) };
    }

    // The custom room 4 picture covers the room 4 box; a tile column / row added inside the box
    // adds a blank strip to it, one removed inside it cuts its strip out
    function adjustRoom4Picture(axis, tileIndex, insert, box) {
        if (!$scope.room4CanvasSave || !box) return;
        const lo = axis === 'x' ? box.minX : box.minY, hi = axis === 'x' ? box.maxX : box.maxY;
        if (insert ? !(tileIndex > lo && tileIndex <= hi) : !(tileIndex >= lo && tileIndex <= hi)) return;
        const tiles = hi - lo + 1;
        const img = new Image();
        img.onload = function () {
            const along = axis === 'x' ? img.width : img.height;
            const cut = function (t) { return Math.round(t * along / tiles); };
            const at = cut(tileIndex - lo), strip = cut(1);
            const c = document.createElement('canvas');
            c.width = axis === 'x' ? img.width + (insert ? strip : -(cut(tileIndex - lo + 1) - at)) : img.width;
            c.height = axis === 'y' ? img.height + (insert ? strip : -(cut(tileIndex - lo + 1) - at)) : img.height;
            const x = c.getContext('2d');
            x.imageSmoothingEnabled = false;
            x.fillStyle = '#FFFFFF';
            x.fillRect(0, 0, c.width, c.height);
            const end = insert ? at : cut(tileIndex - lo + 1);
            if (axis === 'x') {
                x.drawImage(img, 0, 0, at, img.height, 0, 0, at, img.height);
                x.drawImage(img, end, 0, img.width - end, img.height, insert ? at + strip : at, 0, img.width - end, img.height);
            } else {
                x.drawImage(img, 0, 0, img.width, at, 0, 0, img.width, at);
                x.drawImage(img, 0, end, img.width, img.height - end, 0, insert ? at + strip : at, img.width, img.height - end);
            }
            $scope.$applyAsync(function () {
                $scope.room4CanvasSave = c.toDataURL('image/png');
                $scope.room4Img.src = $scope.room4CanvasSave;
            });
        };
        img.src = $scope.room4CanvasSave;
    }

    function insertLine(axis, gridIndex) {
        const size = axis === 'x' ? $scope.width : $scope.length;
        const atEnd = gridIndex >= 2 * size;
        // at the far end the border walls move out with the new edge
        const from = atEnd ? gridIndex : gridIndex + 1;
        const box = room4Box();
        adjustRoom4Picture(axis, gridIndex / 2, true, box);

        const cells = {};
        Object.keys($scope.cells).forEach(function (key) {
            cells[gridKeyShift(key, axis, from, 2)] = $scope.cells[key];
        });
        const fresh = gridIndex + 1;           // the new tile line
        const other = axis === 'x' ? $scope.length : $scope.width;
        const keyAt = function (a, b) { return axis === 'x' ? a + ',' + b + ',0' : b + ',' + a + ',0'; };
        // walls that run across the new line (the outer walls among them) are carried over it
        for (let b = 0; b <= 2 * other; b += 2) {
            const before = cells[keyAt(fresh - 2, b)], after = cells[keyAt(fresh + 2, b)];
            const wallBefore = gridIndex > 0 && before && before.isWall;
            const wallAfter = !atEnd && after && after.isWall;
            if ((wallBefore && wallAfter) || (gridIndex === 0 && wallAfter) || (atEnd && wallBefore)) {
                cells[keyAt(fresh, b)] = { isWall: true, halfWall: 0 };
            }
        }
        $scope.cells = cells;

        // rooms: shift, and a new tile between two tiles of the same room joins it
        const rooms = ($scope.roomTiles || []).map(function (list) {
            return (list || []).map(function (key) { return gridKeyShift(key, axis, from, 2); });
        });
        if (gridIndex > 0 && !atEnd) {
            for (let b = 1; b < 2 * other; b += 2) {
                rooms.forEach(function (list) {
                    if (list.indexOf(keyAt(fresh - 2, b)) > -1 && list.indexOf(keyAt(fresh + 2, b)) > -1) list.push(keyAt(fresh, b));
                });
            }
        }
        $scope.roomTiles = rooms;

        const st = $scope.startTile;
        if (st && (axis === 'x' ? st.x : st.y) >= from) {
            if (axis === 'x') st.x += 2; else st.y += 2;
        }
        if (axis === 'x') $scope.width++; else $scope.length++;
        $scope.recalculateLinear();
    }

    function removeLine(axis, gridIndex) {
        const size = axis === 'x' ? $scope.width : $scope.length;
        if (size <= 1) return;
        const atEnd = gridIndex >= 2 * size - 1;
        // the tile line goes with the wall line after it; at the far end with the one before it,
        // so the border walls stay
        const gone = atEnd ? [gridIndex - 1, gridIndex] : [gridIndex, gridIndex + 1];
        const box = room4Box();
        adjustRoom4Picture(axis, (gridIndex - 1) / 2, false, box);

        const i = axis === 'x' ? 0 : 1;
        const cells = {};
        Object.keys($scope.cells).forEach(function (key) {
            const p = key.split(',').map(Number);
            if (gone.indexOf(p[i]) > -1) return;
            cells[gridKeyShift(key, axis, gone[1] + 1, -2)] = $scope.cells[key];
        });
        $scope.cells = cells;
        $scope.roomTiles = ($scope.roomTiles || []).map(function (list) {
            return (list || []).filter(function (key) { return Number(key.split(',')[i]) !== gridIndex; })
                .map(function (key) { return gridKeyShift(key, axis, gone[1] + 1, -2); });
        });
        const st = $scope.startTile;
        if (st) {
            const v = axis === 'x' ? st.x : st.y;
            if (v >= gridIndex) {
                const nv = Math.max(1, v - 2);
                if (axis === 'x') st.x = nv; else st.y = nv;
            }
        }
        if (axis === 'x') $scope.width--; else $scope.length--;
        $scope.recalculateLinear();
    }

    $scope.addColumn = function (gridX) { insertLine('x', gridX); };
    $scope.removeColumn = function (gridX) { removeLine('x', gridX); };
    $scope.addRow = function (gridY) { insertLine('y', gridY); };
    $scope.removeRow = function (gridY) { removeLine('y', gridY); };

    $scope.selectRoom2 = function() {
        if ($scope.selectRoom != 0) {
            $scope.selectRoom = 0;
        }
        else {
            $scope.selectRoom = -1;
        }
    }

    $scope.selectRoom3 = function() {
        if ($scope.selectRoom != 1) {
            $scope.selectRoom = 1;
        }
        else {
            $scope.selectRoom = -1;
        }
    }

    $scope.selectRoom4 = function() {
        if ($scope.selectRoom != 2) {
            $scope.selectRoom = 2;
        }
        else {
            $scope.selectRoom = -1;
        }
    }

    // The "Create Custom Room 4" button is shown by the page (ng-show) when the custom room is picked
    $scope.updateRoom4Pick = function() {};

    // Starts as "None" (this used to be done by ng-init on the old select)
    if (!$scope.area4Room) $scope.area4Room = $scope.area4[0];

    $scope.pickArea4Room = function(room) {
        if (!$scope.presetAvailable(room)) return;
        $scope.area4Room = room;
    };

    $scope.isArea4Room = function(room) {
        return !!$scope.area4Room && $scope.area4Room.value === room.value;
    };

    // Recomputed when the room 4 area, the passages or the chosen room change
    $scope.area4Status = {};
    $scope.area4Overlay = {};
    $scope.$watch(function () {
        const region = (($scope.roomTiles && $scope.roomTiles[2]) || []).join(';');
        const passages = passageTiles(PASSAGE_14).join(';') + '|' + passageTiles(PASSAGE_34).join(';');
        return [region, passages, $scope.area4Room && $scope.area4Room.type, $scope.width, $scope.length].join('#');
    }, function () {
        const region = room4Region();
        const greens = passageTiles(PASSAGE_14);
        const reds = passageTiles(PASSAGE_34);
        const statuses = {};
        $scope.area4.forEach(function (room) {
            if (room.type >= 2) statuses[room.type] = presetStatus(room, region, greens, reds);
        });
        $scope.area4Status = statuses;

        // Map preview for the chosen preset: its footprint, and where the passages have to be
        const overlay = {};
        const chosen = $scope.area4Room && statuses[$scope.area4Room.type];
        if (chosen) {
            const cellKey = function (p) { return (2 * p[0] + 1) + ',' + (2 * p[1] + 1); };
            if (chosen.placement) {
                const b = presetBounds($scope.area4Room, chosen.placement.origin, chosen.placement.dir);
                for (let x = b.minX; x <= b.maxX; x++) for (let y = b.minY; y <= b.maxY; y++) overlay[cellKey([x, y])] = { cls: 'fit' };
            } else if (region && chosen.sizeOk) {
                for (let x = region.minX; x <= region.maxX; x++) for (let y = region.minY; y <= region.maxY; y++) overlay[cellKey([x, y])] = { cls: 'pending' };
                const many = chosen.candidates.length > 1;
                chosen.candidates.forEach(function (c, i) {
                    const mark = many ? String.fromCharCode(65 + i) : '';
                    overlay[cellKey(c.green)] = { cls: 'need-green', label: mark };
                    overlay[cellKey(c.red)] = { cls: 'need-red', label: mark };
                });
            }
        }
        $scope.area4Overlay = overlay;
    });

    $scope.area4OverlayAt = function (c, r) {
        return $scope.area4Overlay[c + ',' + r];
    };

    $scope.presetAvailable = function (room) {
        if (room.type < 2) return true;
        const st = $scope.area4Status[room.type];
        return !!st && st.sizeOk;
    };

    $scope.presetStatusOf = function (room) {
        return $scope.area4Status[room.type];
    };

    // The check can be switched off for a map (saved with it): then nothing is checked, marked,
    // restricted or blocked
    $scope.connCheckOff = false;
    $scope.toggleConnCheck = function () {
        $scope.connCheckOff = !$scope.connCheckOff;
    };
    $scope.connStatus = { show: false, ok: true, rooms: [], issues: [], marks: {} };
    $scope.$watch(function () {
        if ($scope.connCheckOff) return 'off';
        const parts = [];
        Object.keys($scope.cells).forEach(function (key) {
            const cell = $scope.cells[key];
            if (cell.isWall || cell.halfWall > 0) parts.push(key + (cell.isWall ? 'w' : 'h' + cell.halfWall));
            if (cell.isTile && cell.tile) {
                const t = cell.tile;
                const inner = (t.halfWallIn || []).join('') + (t.curve || []).join('');
                if (t.color || t.black || /[1-9]/.test(inner)) parts.push(key + '=' + (t.color || '') + (t.black ? 'b' : '') + inner);
            }
        });
        return [($scope.roomTiles || []).map(function (l) { return (l || []).join(';'); }).join('|'),
            parts.join(';'), $scope.area4Room && $scope.area4Room.type, $scope.width, $scope.length].join('#');
    }, function () {
        $scope.connStatus = $scope.connCheckOff ? { show: false, ok: true, rooms: [], issues: [], marks: {} } : connectionStatus();
    });

    $scope.connMarkAt = function (c, r) {
        return $scope.connStatus.marks[(c - 1) / 2 + ',' + (r - 1) / 2];
    };

    $scope.room4MapGeometry = function () { return W.mapGeometry($scope); };
    $scope.tileRoomInfo = function (x, y, z) { return W.tileRoomInfo($scope, x, y, z); };
    $scope.passageAllowed = W.passageAllowed;

    // Connection problems as messages (for the world export)
    function connectionProblems() {
        const st = connectionStatus();
        const t = function (key, params) { return $translate.instant('admin.simMapEditor.connCheck.' + key, params); };
        const problems = st.rooms.filter(function (entry) { return !entry.reached; }).map(function (entry) {
            return t('notConnected', { room: entry.room });
        });
        st.issues.forEach(function (issue) {
            problems.push(t(issue.key, { name: $translate.instant(issue.pass.name), from: issue.pass.from, to: issue.pass.to, room: issue.room, count: issue.count }));
        });
        return problems;
    }

    // Problems that stop the chosen preset from being placed (for the world export)
    function presetProblems() {
        if (!$scope.area4Room || $scope.area4Room.type < 2) return [];
        const st = $scope.area4Status[$scope.area4Room.type];
        if (!st) return ['noRegion'];
        return st.ok ? [] : st.issues;
    }
    
    // tag custom room 4 (sim_room4_world_2026.js)
    const room4World = SimRoom4World2026.create($scope);
    const room4CorrectSize = room4World.room4CorrectSize;
    const createArea4Solid = room4World.createArea4Solid;
    const createArea4Victims = room4World.createArea4Victims;
    let room4Width = 0, room4Height = 0;     // of the room 4 area, for the creator's picture size

    $scope.activateExteriorWalls = function () {
        var W = $scope.width * 2;
        var L = $scope.length * 2;
        var z = $scope.z;
        // Top row (y=0) and bottom row (y=L): horizontal walls, x odd
        for (var x = 1; x < W; x += 2) {
            [0, L].forEach(function (y) {
                var key = x + ',' + y + ',' + z;
                if (!$scope.cells[key]) $scope.cells[key] = {};
                $scope.cells[key].isWall = true;
                $scope.cells[key].halfWall = 0;
            });
        }
        // Left column (x=0) and right column (x=W): vertical walls, y odd
        for (var y = 1; y < L; y += 2) {
            [0, W].forEach(function (x) {
                var key = x + ',' + y + ',' + z;
                if (!$scope.cells[key]) $scope.cells[key] = {};
                $scope.cells[key].isWall = true;
                $scope.cells[key].halfWall = 0;
            });
        }
    }

    $scope.cellClick = function (x, y, z, isWall, isTile) {
        var cell = $scope.cells[x + ',' + y + ',' + z];
        var halfWallTile;
        var intx = parseInt(x), inty = parseInt(y);
        console.log(cell)

        // If wall
        if (isWall) {
            if (!cell) {
                $scope.cells[x + ',' + y + ',' + z] = {
                    isWall: true,
                    halfWall: 0
                };
            } else {
                halfWallTile = false;
                if (intx % 2 == 0) {
                    if (intx != 0) {
                        halfWallTile = ($scope.roomTiles[0].indexOf(String(intx - 1) + ',' + y + ',' + z) > -1 ||
                                        $scope.roomTiles[1].indexOf(String(intx - 1) + ',' + y + ',' + z) > -1);
                    }
                    if (!halfWallTile && intx != $scope.width * 2) {
                        halfWallTile = ($scope.roomTiles[0].indexOf(String(intx + 1) + ',' + y + ',' + z) > -1 ||
                                        $scope.roomTiles[1].indexOf(String(intx + 1) + ',' + y + ',' + z) > -1);
                    }
                }
                else {
                    if (inty != 0) {
                        halfWallTile = ($scope.roomTiles[0].indexOf(x + ',' + String(inty - 1) + ',' + z) > -1 ||
                                        $scope.roomTiles[1].indexOf(x + ',' + String(inty - 1) + ',' + z) > -1);
                    }
                    if (!halfWallTile && inty != $scope.length * 2) {
                        halfWallTile = ($scope.roomTiles[0].indexOf(x + ',' + String(inty + 1) + ',' + z) > -1 ||
                                        $scope.roomTiles[1].indexOf(x + ',' + String(inty + 1) + ',' + z) > -1);
                    }
                }
                if (halfWallTile) {
                    if(cell.isWall){
                        cell.isWall = false;
                        cell.halfWall = 1;
                    }else if(cell.halfWall == 1){
                        cell.halfWall = 2;
                    }else if(cell.halfWall == 2){
                        cell.halfWall = 0;
                    }else{
                        cell.isWall = true;
                    }
                }
                else {
                    if(cell.isWall){
                        cell.isWall = false;
                    }else{
                        cell.isWall = true;
                    }
                }
            }
        } else if (isTile) {
            if (!cell) {
                cell = $scope.cells[x + ',' + y + ',' + z] = {
                    isTile: true,
                    tile: {
                        changeFloorTo: z,
                        halfTile: 0
                    }
                };
            }
            if ($scope.selectRoom != -1 && cell) {
                let undo = false
                for (a = 0; a < $scope.roomTiles.length; a++) {
                    if ($scope.roomTiles[a]) {
                        for (b = 0; b < $scope.roomTiles[a].length; b++) {
                            if ($scope.roomTiles[a][b] == x+','+y+','+z) {
                                var i = (parseInt(y - 1) / 2 * $scope.width + (parseInt(x - 1) / 2));
                                $(".tile").get(i).style.setProperty("--tileColor", "#b4ffd5");
                                $scope.roomTiles[a].splice(b, 1);
                                get_cell(x, y, z).tile.halfTile = 0;
                                if (a == $scope.selectRoom)
                                    undo = true;
                            }
                        }
                    }
                }
                if (!undo) {
                    $scope.roomTiles[$scope.selectRoom].push(x+','+y+','+z);
                    var i = (parseInt(y - 1) / 2 * $scope.width + (parseInt(x - 1) / 2));
                    if ($scope.selectRoom == 0) {
                        $(".tile").get(i).style.setProperty("--tileColor", "#359ef4");
                        get_cell(x, y, z).tile.halfTile = 1;
                        get_cell(x, y, z).tile.curve = [0, 0, 0, 0];   // room 2 has no curved walls
                        console.log('a')
                    }
                    else if ($scope.selectRoom == 1) {
                        $(".tile").get(i).style.setProperty("--tileColor", "#ed9aef");
                        get_cell(x, y, z).tile.halfTile = 1;
                        console.log('b')
                    }
                    else if ($scope.selectRoom == 2)
                        $(".tile").get(i).style.setProperty("--tileColor", "#7500FF");
                }
            }
            $scope.open(x, y, z);
        }
        $scope.recalculateLinear();
    }

    // modals
    $scope.open = function (x, y, z) {
        if ($scope.selectRoom == -1) {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: '/templates/sim_editor/sim_editor_modal.2026.html',
                controller: 'ModalInstanceCtrl',
                size: 'lg',
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
        }
    };

    $scope.setCognitiveVictim = function(cell, dir, code) {
        if (!cell.tile.victims) cell.tile.victims = {};
        const letter = cognitiveCodeToVictimLetter(code);
        if (letter) {
            cell.tile.victims[dir] = letter;
        } else {
            delete cell.tile.victims[dir];
        }
    };

    const _hwLetterToNum = {F: 5, P: 6, C: 7, O: 8};

    $scope.setHalfWallCognitive = function(cell, idx, code) {
        if (!cell.tile.halfWallVic) cell.tile.halfWallVic = [];
        const letter = cognitiveCodeToVictimLetter(code);
        if (letter) {
            cell.tile.halfWallVic[idx] = _hwLetterToNum[letter];
        } else if (code) {
            cell.tile.halfWallVic[idx] = null;
        } else {
            const cur = cell.tile.halfWallVic[idx];
            if (cur === null || (cur >= 5 && cur <= 8)) cell.tile.halfWallVic[idx] = '';
        }
    };

    $scope.halfWallCogLabel = function(tile, idx) {
        if (!tile || !tile.halfWallCognitives) return '';
        return cognitiveCodeToVictimLetter(tile.halfWallCognitives[idx]) || '';
    };

    $scope.halfWallCogIsFake = function(tile, idx) {
        if (!tile || !tile.halfWallCognitives) return false;
        var code = tile.halfWallCognitives[idx];
        if (!code || code.length !== 5) return false;
        return !cognitiveCodeToVictimLetter(code);
    };

    var _cogLetterColors = {F: '#d32f2f', P: '#6a1b9a', C: '#1565c0', O: '#e65100'};
    $scope.cogLetterStyle = function(letter) {
        return {
            color: _cogLetterColors[letter] || '#b35c00',
            textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff'
        };
    };

    function _firstCogLabel(arr, indices) {
        if (!arr) return '';
        for (var i = 0; i < indices.length; i++) {
            var code = arr[indices[i]];
            if (code && code.length === 5) {
                var letter = cognitiveCodeToVictimLetter(code);
                if (letter) return letter;
            }
        }
        return '';
    }

    function _hasCogCode(arr, indices) {
        if (!arr) return false;
        for (var i = 0; i < indices.length; i++) {
            if (arr[indices[i]] && arr[indices[i]].length === 5) return true;
        }
        return false;
    }

    $scope.cogTopLabel = function(tile) {
        if (!tile) return '';
        var direct = tile.cognitives && tile.cognitives.top_code ? (cognitiveCodeToVictimLetter(tile.cognitives.top_code) || '') : '';
        return direct || _firstCogLabel(tile.halfWallCognitives, [0, 4, 1, 7]);
    };
    $scope.cogRightLabel = function(tile) {
        if (!tile) return '';
        var direct = tile.cognitives && tile.cognitives.right_code ? (cognitiveCodeToVictimLetter(tile.cognitives.right_code) || '') : '';
        return direct || _firstCogLabel(tile.halfWallCognitives, [5, 13, 6, 12]);
    };
    $scope.cogBottomLabel = function(tile) {
        if (!tile) return '';
        var direct = tile.cognitives && tile.cognitives.bottom_code ? (cognitiveCodeToVictimLetter(tile.cognitives.bottom_code) || '') : '';
        return direct || _firstCogLabel(tile.halfWallCognitives, [10, 14, 9, 15]);
    };
    $scope.cogLeftLabel = function(tile) {
        if (!tile) return '';
        var direct = tile.cognitives && tile.cognitives.left_code ? (cognitiveCodeToVictimLetter(tile.cognitives.left_code) || '') : '';
        return direct || _firstCogLabel(tile.halfWallCognitives, [3, 11, 2, 8]);
    };

    // Fake victims (Φ/Ψ/Ω exported as decoys worth 0 points) are drawn in their own colour on the map.
    // Each map image shows one victim type on one side of the tile, which can stand for the wall victim
    // and several half-wall positions: 'fake' when all of them are fake, 'mixed' when only some are.
    const _sideHalfWallIndices = { top: [0, 4, 1, 7], right: [5, 13, 6, 12], bottom: [10, 14, 9, 15], left: [3, 11, 2, 8] };
    const _letterToHalfWallNum = { H: 1, U: 2, S: 3 };

    $scope.victimImageClass = function(tile, side, letter) {
        if (!tile) return '';
        let fake = 0, real = 0;
        if (tile.victims && tile.victims[side] === letter) {
            if (tile.victim_is_fake) fake++; else real++;
        }
        if (tile.halfWallVic) {
            for (const i of _sideHalfWallIndices[side]) {
                if (Number(tile.halfWallVic[i]) !== _letterToHalfWallNum[letter]) continue;
                if (tile.halfWallVicFakes && tile.halfWallVicFakes[i]) fake++; else real++;
            }
        }
        if (!fake) return '';
        return real ? 'sim-fake-victim-mixed' : 'sim-fake-victim';
    };

    $scope.cogTopIsFake = function(tile) {
        if (!tile) return false;
        var hasCode = (tile.cognitives && tile.cognitives.top_code && tile.cognitives.top_code.length === 5) || _hasCogCode(tile.halfWallCognitives, [0, 4, 1, 7]);
        return hasCode && !$scope.cogTopLabel(tile);
    };
    $scope.cogRightIsFake = function(tile) {
        if (!tile) return false;
        var hasCode = (tile.cognitives && tile.cognitives.right_code && tile.cognitives.right_code.length === 5) || _hasCogCode(tile.halfWallCognitives, [5, 13, 6, 12]);
        return hasCode && !$scope.cogRightLabel(tile);
    };
    $scope.cogBottomIsFake = function(tile) {
        if (!tile) return false;
        var hasCode = (tile.cognitives && tile.cognitives.bottom_code && tile.cognitives.bottom_code.length === 5) || _hasCogCode(tile.halfWallCognitives, [10, 14, 9, 15]);
        return hasCode && !$scope.cogBottomLabel(tile);
    };
    $scope.cogLeftIsFake = function(tile) {
        if (!tile) return false;
        var hasCode = (tile.cognitives && tile.cognitives.left_code && tile.cognitives.left_code.length === 5) || _hasCogCode(tile.halfWallCognitives, [3, 11, 2, 8]);
        return hasCode && !$scope.cogLeftLabel(tile);
    };

    // tag max score
    $scope.openMaxScore = function(){
        let victimScore = 0;
        let checkpointScore = 0;
        let exitBonus = 0;
        const victims = ["H", "S", "U"];
        const hazards = ["P", "O", "F", "C"];
        const areaMultiplier = [0, 1, 1.25, 1.5, 2];
        Object.keys($scope.cells).map(function(key){
            let cell = $scope.cells[key];
            if(cell.isTile){
                if(cell.tile.victims && !cell.tile.victim_is_fake){
                    Object.keys(cell.tile.victims).map(function(dir){
                        if(victims.includes(cell.tile.victims[dir])){
                            victimScore += (cell.isLinear ? 5 : 15) * areaMultiplier[checkRoomNumberKey(key)];
                            victimScore += 10 * areaMultiplier[checkRoomNumberKey(key)];
                        }else if(hazards.includes(cell.tile.victims[dir])){
                            victimScore += (cell.isLinear ? 10 : 30) * areaMultiplier[checkRoomNumberKey(key)];
                            victimScore += 20 * areaMultiplier[checkRoomNumberKey(key)];
                        }
                    });
                }
                if(cell.tile.halfWallVic){
                    for(let i of $scope.range(16)){
                        let raw = cell.tile.halfWallVic[i];
                        if(raw === null || raw === undefined || raw === '' || raw === 0) continue;
                        if(cell.tile.halfWallVicFakes && cell.tile.halfWallVicFakes[i]) continue;
                        let v = Number(raw);
                        if(v >= 1 && v <= 3){
                            victimScore += (cell.isLinear ? 5 : 15) * areaMultiplier[checkRoomNumberKey(key)];
                            victimScore += 10 * areaMultiplier[checkRoomNumberKey(key)];
                        }else if(v >= 5 && v <= 8){
                            victimScore += (cell.isLinear ? 10 : 30) * areaMultiplier[checkRoomNumberKey(key)];
                            victimScore += 20 * areaMultiplier[checkRoomNumberKey(key)];
                        }
                    }
                }
                
                if(cell.tile.checkpoint){
                    checkpointScore += 10 * areaMultiplier[checkRoomNumberKey(key)];
                }
            }
        });
        if ($scope.area4Room.value == "Custom Room") {
            createArea4Solid();
            createArea4Victims(0, 0);
            // room4VicTypes index into the scoring types of createArea4Victims:
            // 0-2 letter victims, 3-6 cognitive targets (P/O/F/C), 7 fake target, 8-10 fake victims
            for (let i = 0; i < $scope.room4VicTypes.length; i++) {
                const t = $scope.room4VicTypes[i];
                if (t <= 2)
                    victimScore += (15 + 10) * areaMultiplier[4];
                else if (t <= 6)
                    victimScore += (30 + 20) * areaMultiplier[4];
            }
        }
        else if ($scope.area4Room.type >= 2 && !presetProblems().length) {
            for (let i = 0; i < $scope.area4Room.humans.length; i++)
                victimScore += ($scope.area4Room.humans[i].score + 10) * areaMultiplier[4];
            for (let i = 0; i < $scope.area4Room.hazards.length; i++)
                victimScore += ($scope.area4Room.hazards[i].score + 20) * areaMultiplier[4];
        }
        

        if(victimScore > 0) exitBonus += (victimScore + checkpointScore) * 0.1

        const t = function (key) { return $translate.instant('admin.simMapEditor.maxScore.' + key); };
        const fmt = function (value) { return Number(value).toFixed(2).replace(/\.00$/, ''); };
        const rows = [
            { icon: 'fa-user-injured', label: t('tokens'), value: victimScore },
            { icon: 'fa-flag-checkered', label: t('checkpoints'), value: checkpointScore },
            { icon: 'fa-door-open', label: t('exitBonus'), value: exitBonus },
            { icon: 'fa-map', label: t('mapBonus'), value: 1.2*(victimScore + checkpointScore + exitBonus) }
        ];
        let html = `
            <div class='sim-score'>
                <div class='sim-score-total'>
                    <span class='sim-score-total-label'><i class='fas fa-calculator'></i>${t('total')}</span>
                    <span class='sim-score-total-value'>${fmt(2.2*(victimScore + checkpointScore + exitBonus))}</span>
                </div>
                <div class='sim-score-rows'>
                    ${rows.map(function (row) {
                        return `<div class='sim-score-row'><span><i class='fas ${row.icon}'></i>${row.label}</span><strong>${fmt(row.value)}</strong></div>`;
                    }).join('')}
                </div>
                <div class='sim-score-note'>${t('note')}</div>
            </div>
        `;
        Swal.fire({
            html: html,
            showCloseButton: true,
            customClass: 'sim-score-popup',
            confirmButtonText: 'OK'
        })

    }
    
    $scope.openCustomRoom4 = function() {
        if ($scope.roomTiles[2].length > 0) {
            let minX = -1;
            let maxX = 0;
            let minY = -1;
            let maxY = 0;
            
            for (let i = 0; i < $scope.roomTiles[2].length; i++) {
                let tileStr = $scope.roomTiles[2][i];
                let x = tileStr.slice(0, tileStr.indexOf(","));
                let y = tileStr.slice(tileStr.indexOf(",")+1, tileStr.lastIndexOf(","));
                x = parseInt(x);
                y = parseInt(y);
                if (x < minX || minX == -1)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY || minY == -1)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            }
            let x = (minX - 1) / 2;
            let y = (minY - 1) / 2;
            room4Width = (maxX - minX) / 2 + 1;
            room4Height = (maxY - minY) / 2 + 1;
            // Picture resolution: 1600 px on the longer side, so it stays sharp drawn screen-wide
            const room4Block = Math.floor(1600 / Math.max(room4Width, room4Height));
            $scope.canvasWidth = room4Block * room4Width;
            $scope.canvasHeight = room4Block * room4Height;

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: '/templates/sim_editor/custom_room_4_modal.2026.html',
                controller: 'CustomRoom4ModalCtrl',
                size: 'xl',
                windowClass: 'sim-r4-window',
                scope: $scope,
                resolve: {
                    x: function() {
                        return 3;
                    }
                }
            });
        }
    };
}]);


// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

// Cognitive targets are stored as a 5-letter ring code (K, R, Y, G, B). The type is decided by the
// sum of the ring values, as in the Maze editor: 0 = F, 1 = P, 2 = C, 3 = O, anything else is fake.
// Erebus draws the code from the outside in (first letter = outermost ring), while the rules number
// the rings from the centre and the preview images (shared with the maze editor) are named centre
// first. So the code is kept in Erebus order and reversed only for display.
var SimCognitive = (function () {
    var values = { K: -2, R: -1, Y: 0, G: 1, B: 2 };
    var types = [
        { letter: 'F', sum: 0, color: '#d32f2f', bg: '#fdecea', name: 'admin.simMapEditor.ctF' },
        { letter: 'P', sum: 1, color: '#6a1b9a', bg: '#f3e5f5', name: 'admin.simMapEditor.ctP' },
        { letter: 'C', sum: 2, color: '#1565c0', bg: '#e3f2fd', name: 'admin.simMapEditor.ctC' },
        { letter: 'O', sum: 3, color: '#e65100', bg: '#fff3e0', name: 'admin.simMapEditor.ctO' },
        { letter: null, sum: null, color: '#6c757d', bg: '#f1f3f5', name: 'admin.simMapEditor.ctFake' }
    ];
    function isCode(code) {
        return typeof code === 'string' && /^[KRYGB]{5}$/.test(code);
    }
    function sum(code) {
        var total = 0;
        for (var i = 0; i < code.length; i++) total += values[code[i]] || 0;
        return total;
    }
    function type(code) {
        if (!isCode(code)) return null;
        var total = sum(code);
        return types.find(function (t) { return t.sum === total; }) || types[types.length - 1];
    }
    return {
        values: values,
        types: types,
        isCode: isCode,
        sum: sum,
        type: type,
        // Rings from the centre outwards (rule numbering) <-> Erebus code
        centreFirst: function (code) {
            return code.split('').reverse();
        },
        fromCentreFirst: function (rings) {
            return rings.slice().reverse().join('');
        },
        // Drawn by CSS (cognitive_target.js), which takes the rings from the centre
        style: function (code) {
            return isCode(code) ? cognitiveTarget.style(code.split('').reverse().join('')) : {};
        }
    };
})();

app.controller('ModalInstanceCtrl',['$scope', '$uibModalInstance', '$uibModal', '$translate', 'x', 'y', 'z', function ($scope, $uibModalInstance, $uibModal, $translate, x, y, z) {
    // Floor colours of the one-tile passages between areas (rules 3.3.4 / 3.4). The values are what
    // the world export looks for, so they must not change.
    $scope.passageColors = [
        { color: '#1a1ae6', from: 1, to: 2, name: 'admin.simMapEditor.passageBlue' },
        { color: '#e7e71a', from: 1, to: 3, name: 'admin.simMapEditor.passageYellow' },
        { color: '#08D508', from: 1, to: 4, name: 'admin.simMapEditor.passageGreen' },
        { color: '#4d1a99', from: 2, to: 3, name: 'admin.simMapEditor.passagePurple' },
        { color: '#e7991a', from: 2, to: 4, name: 'admin.simMapEditor.passageOrange' },
        { color: '#e71a1a', from: 3, to: 4, name: 'admin.simMapEditor.passageRed' }
    ];
    // Only the colours of the rooms this tile lies between can be chosen (unless the room
    // connection check is off)
    $scope.passageInfo = $scope.$parent.tileRoomInfo ? $scope.$parent.tileRoomInfo(x, y, z) : null;
    $scope.passageOk = function (p) {
        return !$scope.$parent.passageAllowed || $scope.$parent.passageAllowed($scope.passageInfo, p);
    };
    $scope.passageAvailable = function () {
        return $scope.passageColors.some($scope.passageOk);
    };

    // Wall tokens go on walls only (rules 3.7.2), so a place without a wall cannot take one. A token
    // already there stays selectable so it can be seen and removed.
    function edgeCell(dx, dy) {
        return $scope.$parent.cells[(Number(x) + dx) + ',' + (Number(y) + dy) + ',' + z];
    }
    const WALL_SIDES = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
    $scope.wallAt = function (dir) {
        const c = edgeCell(WALL_SIDES[dir][0], WALL_SIDES[dir][1]);
        return !!(c && c.isWall);
    };
    // Half-wall slot i = quarter tile (NW, NE, SW, SE) * 4 + side (top, right, bottom, left). A slot
    // sits on the tile edge (whole wall, or the half wall covering that half: 1 = left / lower half),
    // on an inner half wall, or - when its quarter tile has a curved wall - on that curve.
    $scope.halfWallSlotHasWall = function (i) {
        const q = Math.floor(i / 4), side = i % 4, qx = q % 2, qy = Math.floor(q / 2);
        const t = $scope.cell && $scope.cell.tile;
        if (!t) return false;
        if (t.curve && t.curve[q]) return true;
        const inner = t.halfWallIn || [];
        const outer = function (dx, dy, half) {
            const c = edgeCell(dx, dy);
            return !!c && (c.isWall || c.halfWall == half);
        };
        switch (side) {
            case 0: return qy === 0 ? outer(0, -1, qx + 1) : !!inner[qx ? 1 : 3];
            case 1: return qx === 1 ? outer(1, 0, qy ? 1 : 2) : !!inner[qy ? 2 : 0];
            case 2: return qy === 1 ? outer(0, 1, qx + 1) : !!inner[qx ? 1 : 3];
            case 3: return qx === 0 ? outer(-1, 0, qy ? 1 : 2) : !!inner[qy ? 2 : 0];
        }
        return false;
    };
    console.log($scope.cell)
    $scope.cell = $scope.$parent.cells[x + ',' + y + ',' + z];
    $scope.isStart = $scope.$parent.startTile.x == x &&
        $scope.$parent.startTile.y == y &&
        $scope.$parent.startTile.z == z;
    $scope.height = $scope.$parent.height;
    $scope.z = z;
    $scope.oldFloorDestination = $scope.cell.tile.changeFloorTo;

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

    // Inner walls of a room 2 / room 3 tile, drawn as a 240 x 240 diagram (quarter tiles 120).
    // Half walls run from the centre to the middle of a side (0 up, 1 right, 2 down, 3 left).
    // Curves are quarter circles in a quarter tile (NW, NE, SW, SE); the value names where the
    // arc bulges (1 NE, 2 SE, 3 SW, 4 NW). Room 2 takes half walls only, so it gets no curves.
    $scope.isRoom2 = (($scope.$parent.roomTiles && $scope.$parent.roomTiles[0]) || []).indexOf(x + ',' + y + ',' + z) > -1;
    $scope.inner = { hoverQ: -1, hoverSlot: -1, hoverArm: -1 };
    $scope.innerArms = [
        { i: 0, x1: 120, y1: 0, x2: 120, y2: 120, icon: 'fa-arrow-up', name: 'top' },
        { i: 1, x1: 120, y1: 120, x2: 240, y2: 120, icon: 'fa-arrow-right', name: 'right' },
        { i: 2, x1: 120, y1: 120, x2: 120, y2: 240, icon: 'fa-arrow-down', name: 'bottom' },
        { i: 3, x1: 0, y1: 120, x2: 120, y2: 120, icon: 'fa-arrow-left', name: 'left' }
    ];
    $scope.innerQuarters = ['nw', 'ne', 'sw', 'se'].map(function (name, q) {
        return { q: q, name: name, x: (q % 2) * 120, y: Math.floor(q / 2) * 120 };
    });
    $scope.innerSlots = [];
    $scope.innerQuarters.forEach(function (Q) {
        [[60, 20], [100, 60], [60, 100], [20, 60]].forEach(function (p, side) {
            $scope.innerSlots.push({ i: Q.q * 4 + side, x: Q.x + p[0], y: Q.y + p[1] });
        });
    });
    // walls on the tile's sides (edited on the map), whole or half (1 = left / lower half)
    $scope.innerOuter = [];
    [[0, -1, 0, 0, 240, 0], [1, 0, 240, 0, 240, 240], [0, 1, 0, 240, 240, 240], [-1, 0, 0, 0, 0, 240]].forEach(function (s) {
        const c = edgeCell(s[0], s[1]);
        if (!c) return;
        let a = [s[2], s[3]], b = [s[4], s[5]];
        if (!c.isWall) {
            if (c.halfWall != 1 && c.halfWall != 2) return;
            const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const lowerOrLeft = c.halfWall == 1;
            if (s[1] !== 0) { if (lowerOrLeft) b = m; else a = m; }   // top / bottom: 1 = left half
            else { if (lowerOrLeft) a = m; else b = m; }              // left / right: 1 = lower half
        }
        $scope.innerOuter.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    });
    $scope.curvePath = function (q, v, size) {
        const s = size || 120, ox = size ? 0 : (q % 2) * 120, oy = size ? 0 : Math.floor(q / 2) * 120;
        const c = [[0, 1], [0, 0], [1, 0], [1, 1]][v - 1];
        if (!c) return '';
        const cx = ox + c[0] * s, cy = oy + c[1] * s, dx = c[0] === 0 ? 1 : -1, dy = c[1] === 0 ? 1 : -1;
        return 'M' + (cx + dx * s) + ' ' + cy + ' A' + s + ' ' + s + ' 0 0 ' + (dx * dy > 0 ? 1 : 0) + ' ' + cx + ' ' + (cy + dy * s);
    };
    $scope.toggleArm = function (i) {
        const t = $scope.cell && $scope.cell.tile;
        if (!t) return;
        if (!t.halfWallIn) t.halfWallIn = [0, 0, 0, 0];
        t.halfWallIn[i] = !t.halfWallIn[i];
    };
    $scope.setCurve = function (q, v) {
        const t = $scope.cell && $scope.cell.tile;
        if (!t || (v && $scope.isRoom2)) return;
        if (!t.curve) t.curve = [0, 0, 0, 0];
        t.curve[q] = v;
    };
    // clicking a quarter tile in the diagram steps through no curve and the four curves
    $scope.cycleCurve = function (q) {
        const t = $scope.cell && $scope.cell.tile;
        if (!t || $scope.isRoom2) return;
        $scope.setCurve(q, ((Number(t.curve && t.curve[q]) || 0) + 1) % 5);
    };
    $scope.hasCurve = function () {
        const t = $scope.cell && $scope.cell.tile;
        return !!(t && t.curve && t.curve.some(function (v) { return v; }));
    };
    $scope.clearCurves = function () {
        for (let q = 0; q < 4; q++) $scope.setCurve(q, 0);
    };
    $scope.slotUsed = function (i) {
        const t = $scope.cell && $scope.cell.tile;
        return !!(t && ((t.halfWallVic && t.halfWallVic[i] && t.halfWallVic[i] != 0) || (t.halfWallCognitives && t.halfWallCognitives[i])));
    };

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }
    // Cognitive targets: edited in their own dialog, like the Maze editor
    function openCognitiveTarget(code, label, onSet) {
        $uibModal.open({
            animation: true,
            templateUrl: '/templates/sim_editor/cognitive_target_modal.2026.html',
            controller: 'SimCognitiveTargetModalCtrl',
            size: 'lg',
            resolve: {
                code: function () { return code; },
                label: function () { return label; }
            }
        }).result.then(onSet, angular.noop);
    }

    $scope.cogStyle = SimCognitive.style;
    $scope.cogType = SimCognitive.type;

    $scope.wallCogCode = function (dir) {
        return ($scope.cell.tile.cognitives && $scope.cell.tile.cognitives[dir + '_code']) || '';
    };

    $scope.editWallCognitive = function (dir) {
        $translate('admin.simMapEditor.' + dir).then(function (label) { return label; }, function () { return dir; }).then(function (label) {
            openCognitiveTarget($scope.wallCogCode(dir), label, function (code) {
                // Only one victim per tile
                $scope.cell.tile.victims = {};
                $scope.cell.tile.cognitives = {};
                $scope.cell.tile.cognitives[dir + '_code'] = code;
                $scope.setCognitiveVictim($scope.cell, dir, code);
            });
        });
    };

    $scope.clearWallCognitive = function (dir) {
        if ($scope.cell.tile.cognitives) $scope.cell.tile.cognitives[dir + '_code'] = '';
        $scope.setCognitiveVictim($scope.cell, dir, '');
    };

    $scope.halfWallCogCode = function (idx) {
        return ($scope.cell.tile.halfWallCognitives && $scope.cell.tile.halfWallCognitives[idx]) || '';
    };

    $scope.editHalfWallCognitive = function (idx) {
        openCognitiveTarget($scope.halfWallCogCode(idx), '#' + (idx + 1), function (code) {
            if (!$scope.cell.tile.halfWallCognitives) $scope.cell.tile.halfWallCognitives = {};
            $scope.cell.tile.halfWallCognitives[idx] = code;
            $scope.setHalfWallCognitive($scope.cell, idx, code);
        });
    };

    $scope.clearHalfWallCognitive = function (idx) {
        if ($scope.cell.tile.halfWallCognitives) $scope.cell.tile.halfWallCognitives[idx] = '';
        $scope.setHalfWallCognitive($scope.cell, idx, '');
    };

    // Victim rotation: symbol shown in the dial preview
    const _wallSymbols = { H: 'Φ', S: 'Ψ', U: 'Ω' };
    const _halfWallSymbols = { 1: 'Φ', 3: 'Ψ', 2: 'Ω' };

    $scope.wallVictimSymbol = function () {
        const victims = $scope.cell.tile.victims || {};
        for (const dir of ['top', 'right', 'bottom', 'left']) {
            if (_wallSymbols[victims[dir]]) return _wallSymbols[victims[dir]];
        }
        return '';
    };

    $scope.wallVictimDir = function () {
        const victims = $scope.cell.tile.victims || {};
        return ['top', 'right', 'bottom', 'left'].find(function (dir) { return _wallSymbols[victims[dir]]; }) || '';
    };

    $scope.wallHasCognitive = function () {
        const cognitives = $scope.cell.tile.cognitives || {};
        return ['top', 'right', 'bottom', 'left'].some(function (dir) { return SimCognitive.isCode(cognitives[dir + '_code']); });
    };

    // Rotation and "fake" exist only for letter victims (Φ/Ψ/Ω). When the letter victim goes away
    // (None, or a cognitive target instead), clear them so they don't linger, e.g. in the max score.
    $scope.$watch(function () { return $scope.wallVictimSymbol(); }, function (symbol) {
        if (symbol) return;
        if ($scope.cell.tile.victim_is_fake) $scope.cell.tile.victim_is_fake = false;
        if ($scope.cell.tile.single_victim_rotation) $scope.cell.tile.single_victim_rotation = 0;
    });

    $scope.$watch(function () {
        let key = '';
        for (let i = 0; i < 16; i++) key += $scope.halfWallSymbol(i) ? '1' : '0';
        return key;
    }, function (key) {
        const tile = $scope.cell.tile;
        for (let i = 0; i < 16; i++) {
            if (key[i] === '1') continue;
            if (tile.halfWallVicFakes && tile.halfWallVicFakes[i]) tile.halfWallVicFakes[i] = false;
            if (tile.halfWallVicRots && Number(tile.halfWallVicRots[i])) tile.halfWallVicRots[i] = 0;
        }
    });

    $scope.halfWallSymbol = function (idx) {
        return (($scope.cell.tile.halfWallVic && _halfWallSymbols[Number($scope.cell.tile.halfWallVic[idx])]) || '');
    };

    $scope.halfWallRotation = function (idx) {
        return Number(($scope.cell.tile.halfWallVicRots && $scope.cell.tile.halfWallVicRots[idx]) || 0);
    };

    $scope.editHalfWallRotation = function (idx) {
        $uibModal.open({
            animation: true,
            templateUrl: '/templates/sim_editor/rotation_modal.html',
            controller: 'SimRotationModalCtrl',
            windowClass: 'sim-rot-modal',
            resolve: {
                angle: function () { return $scope.halfWallRotation(idx); },
                symbol: function () { return $scope.halfWallSymbol(idx); },
                image: function () { return ''; },
                label: function () { return '#' + (idx + 1); }
            }
        }).result.then(function (angle) {
            if (!$scope.cell.tile.halfWallVicRots) $scope.cell.tile.halfWallVicRots = {};
            $scope.cell.tile.halfWallVicRots[idx] = angle;
        }, angular.noop);
    };

    $scope.ok = function () {
        $scope.$parent.recalculateLinear();
        $uibModalInstance.close();
    };

}]);

app.controller('SimCognitiveTargetModalCtrl', ['$scope', '$uibModalInstance', 'code', 'label', function ($scope, $uibModalInstance, code, label) {
    $scope.label = label;
    // rings[0] is ring 1, the centre (rules 3.7); the stored code is in Erebus order (outside first)
    $scope.rings = SimCognitive.centreFirst(SimCognitive.isCode(code) ? code : 'YYYYY');
    $scope.ringNumbers = [1, 2, 3, 4, 5];
    $scope.types = SimCognitive.types;
    $scope.colors = [
        { code: 'K', name: 'admin.mazeMapEditor.cBlack', active: 'btn-dark', idle: 'btn-outline-secondary' },
        { code: 'R', name: 'admin.mazeMapEditor.cRed', active: 'btn-danger', idle: 'btn-outline-danger' },
        { code: 'Y', name: 'admin.mazeMapEditor.yellow', active: 'btn-warning', idle: 'btn-outline-warning' },
        { code: 'G', name: 'admin.mazeMapEditor.green', active: 'btn-success', idle: 'btn-outline-success' },
        { code: 'B', name: 'admin.mazeMapEditor.cyan', active: 'btn-info', idle: 'btn-outline-info' }
    ];

    function currentCode() {
        return SimCognitive.fromCentreFirst($scope.rings);
    }

    $scope.setRing = function (i, color) {
        $scope.rings[i] = color;
    };
    $scope.colorValue = function (color) {
        return SimCognitive.values[color];
    };
    $scope.total = function () {
        return SimCognitive.sum(currentCode());
    };
    $scope.previewStyle = function () {
        return SimCognitive.style(currentCode());
    };
    $scope.typeLetter = function () {
        return SimCognitive.type(currentCode()).letter;
    };
    $scope.typeName = function () {
        return SimCognitive.type(currentCode()).name;
    };
    $scope.typeColor = function () {
        return SimCognitive.type(currentCode()).color;
    };
    $scope.typeBgColor = function () {
        return SimCognitive.type(currentCode()).bg;
    };

    // Pick random rings that give the requested type
    $scope.autoSet = function (type) {
        var letters = Object.keys(SimCognitive.values);
        for (var attempt = 0; attempt < 500; attempt++) {
            var rings = [];
            for (var i = 0; i < 5; i++) rings.push(letters[Math.floor(Math.random() * letters.length)]);
            if (SimCognitive.type(rings.join('')) === type) {
                $scope.rings = rings;
                return;
            }
        }
    };

    $scope.ok = function () {
        $uibModalInstance.close(currentCode());
    };
    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

app.controller('SimRotationModalCtrl', ['$scope', '$uibModalInstance', 'angle', 'symbol', 'image', 'label', function ($scope, $uibModalInstance, angle, symbol, image, label) {
    $scope.value = { angle: angle };
    $scope.symbol = symbol;
    $scope.image = image;
    $scope.label = label;
    $scope.ok = function () {
        $uibModalInstance.close($scope.value.angle);
    };
    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

// Rotation of a victim symbol on its wall, in degrees (0-359). Seen from the robot, a positive
// angle turns the symbol clockwise, the same way the preview is drawn.
// The rotation dial (simRotationDial) is in rotation_dial.js.

// The custom room 4 creator (CustomRoom4ModalCtrl) is in room4_creator.js, shared by both years.
