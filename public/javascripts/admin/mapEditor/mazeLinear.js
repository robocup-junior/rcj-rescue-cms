// Linear wall / reachable tile detection for the Maze map editors.
// Shared by the 2026 and 2026E editors (browser: window.MazeLinear) and by the tests (Node: require).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MazeLinear = factory();
})(this, function () {
    function startNotSet(startTile) {
        return startTile.x == 0 && startTile.y == 0 && startTile.z == 0;
    }

    /**
     * Recalculates isLinear, virtualWall, ignoreWall and tile.reachable for every cell.
     * @param $scope object with cells (keyed "x,y,z"), startTile, width, length and height; cells is updated in place
     */
    function recalculate($scope) {
        function recalculateLinear() {
            //console.log($scope.cells)
            $scope.virtualWall = [];
            //console.log($scope.cells);
            if (startNotSet($scope.startTile))
                return;

            // Reset all previous linear walls
            for (var index in $scope.cells) {
                $scope.cells[index].isLinear = false;
                $scope.cells[index].virtualWall = false;
                $scope.cells[index].ignoreWall = false;
                $scope.cells[index].changeFloorWall = undefined;
                if ($scope.cells[index].tile) {
                    $scope.cells[index].tile.reachable = false;
                }
            }

            let startTilePosition = $scope.startTile.x + "," + $scope.startTile.y + "," + $scope.startTile.z;
            for (var index in $scope.cells) {
                if ($scope.cells[index].tile) {
                    let tile = $scope.cells[index].tile;
                    var x = Number(index.split(',')[0]);
                    var y = Number(index.split(',')[1]);
                    var z = Number(index.split(',')[2]);
                    // Set to virtual wall around the black tile and start tile
                    if (tile.black || index == startTilePosition) {
                        setVirtualWall(x, y - 1, z);
                        setVirtualWall(x + 1, y, z);
                        setVirtualWall(x - 1, y, z);
                        setVirtualWall(x, y + 1, z);
                    }

                    // Remove wall from elevator
                    if (tile.changeFloorTo != undefined && tile.changeFloorTo != z) {
                        setIgnoreWall(x, y - 1, z, tile.changeFloorTo);
                        setIgnoreWall(x + 1, y, z, tile.changeFloorTo);
                        setIgnoreWall(x - 1, y, z, tile.changeFloorTo);
                        setIgnoreWall(x, y + 1, z, tile.changeFloorTo);
                    }
                }
            }

            // Start it will all 4 + 8 walls around the starting tile
            recurs($scope.startTile.x - 1, $scope.startTile.y, $scope.startTile.z);
            recurs($scope.startTile.x + 1, $scope.startTile.y, $scope.startTile.z);
            recurs($scope.startTile.x, $scope.startTile.y - 1, $scope.startTile.z);
            recurs($scope.startTile.x, $scope.startTile.y + 1, $scope.startTile.z);

            //Top Left
            recurs($scope.startTile.x - 1, $scope.startTile.y - 2, $scope.startTile.z);
            recurs($scope.startTile.x - 2, $scope.startTile.y - 1, $scope.startTile.z);

            //Top Right
            recurs($scope.startTile.x + 1, $scope.startTile.y - 2, $scope.startTile.z);
            recurs($scope.startTile.x + 2, $scope.startTile.y - 1, $scope.startTile.z);

            //Bottom Left
            recurs($scope.startTile.x - 1, $scope.startTile.y + 2, $scope.startTile.z);
            recurs($scope.startTile.x - 2, $scope.startTile.y + 1, $scope.startTile.z);

            //Bottom Right
            recurs($scope.startTile.x + 1, $scope.startTile.y + 2, $scope.startTile.z);
            recurs($scope.startTile.x + 2, $scope.startTile.y + 1, $scope.startTile.z);

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

            if ($scope.cells[pos(x, y, z)] != undefined && $scope.cells[pos(x, y, z)].tile && $scope.cells[pos(x, y, z)].tile.reachable) return;
            setReachable(x, y, z);

            // Top
            if (!wallExist(x, y - 1, z)) {
                reachable(x, y - 2, z);
            }
            // Right
            if (!wallExist(x + 1, y, z)) {
                reachable(x + 2, y, z);
            }
            // Left
            if (!wallExist(x - 1, y, z)) {
                reachable(x - 2, y, z);
            }
            // Bottom
            if (!wallExist(x, y + 1, z)) {
                reachable(x, y + 2, z);
            }

            // Elevator
            if ($scope.cells[pos(x, y, z)].tile.changeFloorTo != undefined && $scope.cells[pos(x, y, z)].tile.changeFloorTo != z) {
                reachable(x, y, $scope.cells[pos(x, y, z)].tile.changeFloorTo);
            }
        }

        function pos(x, y, z) {
            return `${x},${y},${z}`;
        }

        function wallExist(x, y, z) {
            let cell = $scope.cells[pos(x, y, z)];
            if (!cell) return false;
            return cell.isWall == true;
        }

        function setReachable(x, y, z) {
            if ($scope.cells[pos(x, y, z)]) {
                $scope.cells[pos(x, y, z)].tile.reachable = true;
            } else {
                $scope.cells[pos(x, y, z)] = {
                    isTile: true,
                    isLinear: false,
                    tile: {
                        reachable: true
                    }
                };
            }
        }

        function setIgnoreWall(x, y, z, nextLvl) {
            if ($scope.cells[pos(x, y, z)]) {
                $scope.cells[pos(x, y, z)].ignoreWall = !(wallExist(x, y, z) && wallExist(x, y, nextLvl));
                $scope.cells[pos(x, y, z)].changeFloorWall = nextLvl;
            } else {
                $scope.cells[pos(x, y, z)] = {
                    ignoreWall: !(wallExist(x, y, z) && wallExist(x, y, nextLvl)),
                    changeFloorWall: nextLvl
                };
            }
        }

        function setVirtualWall(x, y, z) {
            if ($scope.cells[pos(x, y, z)]) {
                $scope.cells[pos(x, y, z)].virtualWall = true;
            } else {
                $scope.cells[pos(x, y, z)] = {
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

        recalculateLinear();
    }

    return { recalculate: recalculate };
});
