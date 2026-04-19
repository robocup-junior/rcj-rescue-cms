module.exports.floodFill = function (map) {
    const cells = [];
    for (let i = 0; i < map.cells.length; i++) {
        const cell = map.cells[i];
        cells[`${cell.x},${cell.y},${cell.z}`] = cell;
    }

    const startTile =
        cells[`${map.startTile.x},${map.startTile.y},${map.startTile.z}`];

    floodFill(startTile, cells, {
        width: map.width,
        height: map.height,
        length: map.length,
    });

    map.cells = Object.values(cells);
};

function floodFill(tile, cells, dim) {
    if (tile.tile.reachable) {
        return;
    }
    tile.tile.reachable = true;

    if (cells[`${tile.x},${tile.y - 1},${tile.z}`] == null && tile.y - 2 > 0) {
        // top

        let top = cells[`${tile.x},${tile.y - 2},${tile.z}`];

        if (top == null) {
            top = {
                x: tile.x,
                y: tile.y - 2,
                z: tile.z,
                isTile: true,
                isWall: false,
                tile: {},
            };

            cells[`${tile.x},${tile.y - 2},${tile.z}`] = top;
        }

        floodFill(top, cells, dim);
    }
    if (
        cells[`${tile.x + 1},${tile.y},${tile.z}`] == null &&
        tile.x / 2 < dim.width
    ) {
        // right
        let right = cells[`${tile.x + 2},${tile.y},${tile.z}`];

        if (right == null) {
            right = {
                x: tile.x + 2,
                y: tile.y,
                z: tile.z,
                isTile: true,
                isWall: false,
                tile: {},
            };

            cells[`${tile.x + 2},${tile.y},${tile.z}`] = right;
        }

        floodFill(right, cells, dim);
    }
    if (
        cells[`${tile.x},${tile.y + 1},${tile.z}`] == null &&
        tile.y / 2 < dim.length
    ) {
        // bottom
        let bottom = cells[`${tile.x},${tile.y + 2},${tile.z}`];

        if (bottom == null) {
            bottom = {
                x: tile.x,
                y: tile.y + 2,
                z: tile.z,
                isTile: true,
                isWall: false,
                tile: {},
            };

            cells[`${tile.x},${tile.y}${2},${tile.z}`] = bottom;
        }

        floodFill(bottom, cells, dim);
    }
    if (cells[`${tile.x - 1},${tile.y},${tile.z}`] == null && tile.x - 2 > 0) {
        // left
        let left = cells[`${tile.x - 2},${tile.y},${tile.z}`];

        if (left == null) {
            left = {
                x: tile.x - 2,
                y: tile.y,
                z: tile.z,
                isTile: true,
                isWall: false,
                tile: {},
            };

            cells[`${tile.x - 2},${tile.y},${tile.z}`] = left;
        }

        floodFill(left, cells, dim);
    }
    if (tile.tile.changeFloorTo != null && tile.tile.changeFloorTo != tile.z) {
        // Up/down
        let elev = cells[`${tile.x},${tile.y},${tile.tile.changeFloorTo}`];

        if (elev == null) {
            elev = {
                x: tile.x,
                y: tile.y,
                z: tile.tile.changeFloorTo,
                isTile: true,
                isWall: false,
                tile: {
                    changeFloorTo: tile.z,
                },
            };

            cells[`${tile.x},${tile.y},${tile.tile.changeFloorTo}`] = elev;
        }

        floodFill(elev, cells, dim);
    }
}
