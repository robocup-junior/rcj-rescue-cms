// World export (.wbt) and room checks of the Simulation 2026 editor, shared with the new editor
// (beta). Works on the map as the editor holds it: cells keyed "x,y,z" (tiles at odd x and y, the
// edges between them at even ones), roomTiles, startTile, area4Room and the room 4 presets in area4.
// Loads in the browser as window.SimWorld2026 and in Node through require (tests).
(function (root) {
    // DISABLE_RANDOMNESS (set by the editor page, or by tests) makes the export the same every time
    function noRandom() {
        return typeof DISABLE_RANDOMNESS !== 'undefined' && DISABLE_RANDOMNESS;
    }

    const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

    // [0, 1, ..., n - 1], as the editor's range()
    function range(n) {
        const arr = [];
        for (let i = 0; i < n; i++) arr.push(i);
        return arr;
    }

    // Room 4 presets (Erebus Area4_1 / Area4_2); a new list each time, with new token turns
    function area4Presets() {
        return [
            {value: "None", type: 0},
            {value: "Custom Room", type: 1},
            {
                value: "Option 1 (7x5)", 
                type: 2,
                width: 7,
                height: 5,
                room1Tile: [0, -1],
                room3Tile: [6, -1],
                humans: [
                    {
                        x: 0.01,
                        z: 0.238,
                        rot: 1.5708,
                        frontRotation: getRandomAngle(),
                        type: "harmed",
                        score: 15,
                    }
                ],
                hazards: [
                    {
                        x: 0.548,
                        z: 0.193396,
                        rot: 1.05,
                        frontRotation: getRandomAngle(),
                        type: "P",
                        score: 30,
                    }
                ],
            },
            {
                value: "Option 2 (6x6)", 
                type: 3,
                width: 6,
                height: 6,
                room1Tile: [-1, 0],
                room3Tile: [2, 6],
                humans: [
                    {
                        x: 0.33,
                        z: 0.3,
                        rot: 0,
                        frontRotation: getRandomAngle(),
                        type: "unharmed",
                        score: 15,
                    },
                    {
                        x: 0.4991,
                        z: 0.27366,
                        rot: 2.0944,
                        frontRotation: getRandomAngle(),
                        type: "harmed",
                        score: 15,
                    }
                ],
                hazards: [
                    {
                        x: 0.14,
                        z: 0.299,
                        rot: 0,
                        frontRotation: getRandomAngle(),
                        type: "C",
                        score: 30,
                    },
                    {
                        x: 0.564142,
                        z: 0.474142,
                        rot: 0.785398,
                        frontRotation: getRandomAngle(),
                        type: "P",
                        score: 30,
                    }
                ],
            },
        ];
    }

    function getRandomAngle() {
        if (noRandom()) return 0
        return Math.random() * 3.14 * 2.0
    }

    function checkRoomNumber(map, x,y,z) {
        for (let i = 0; i < map.roomTiles.length; i++) {
            if(map.roomTiles[i].find(cord => cord === `${x},${y},${z}`)){
                return i + 2;
            }
        }
        return 1;
    }

    function checkRoomNumberKey(map, key) {
        for (let i = 0; i < map.roomTiles.length; i++) {
            if(map.roomTiles[i].find(cord => cord === key)){
                return i + 2;
            }
        }
        return 1;
    }

    function checkForExternalWalls(map, pos, walls) {
        let thisWall = walls[pos[1]][pos[0]];
        if(!thisWall.is_reachable) return [false, false, false, false];

        //Surrounding tiles
        let around = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        let otherTiles = [false, false, false, false];

        let d = 0;

        for(let a of around){
            //Get the tiles position
            let xPos = pos[0] + a[0];
            let yPos = pos[1] + a[1];
            //If it is a valid positon
            if(xPos > -1 && xPos < map.width && yPos > -1 && yPos < map.length){
                //Add the tiles present data
                if(!walls[yPos][xPos].is_reachable) otherTiles[d] = false;
                else otherTiles[d] = true;
            }else{
                //No tile present
                otherTiles[d] = false;
            }

            //Add one to direction counter
            d = d + 1
        }
        //Convert to needed walls
        externalsNeeded = [!otherTiles[0], !otherTiles[1], !otherTiles[2], !otherTiles[3]]
        return externalsNeeded
    }

    function checkForNotch(map, pos, walls) {
        //Variables to store if each notch is needed
        let needLeft = false;
        let needRight = false;

        //No notches needed if there is not a floor
        if(!walls[pos[1]][pos[0]].is_reachable) return [false, false, 0];

        let rotations = [3.14159, 1.57079, 0, -1.57079];

        //Surrounding tiles
        let around = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        //Tiles to check if notches are needed
        let notchAround = [[[ 1, -1], [-1, -1]],
                           [[ 1,  1], [ 1, -1]],
                           [[-1,  1], [ 1,  1]],
                           [[-1, -1], [-1,  1]]];

        //Current direction
        let d = 0;
        //Number of surrounding tiles
        let surround = 0;

        //Direction of present tile
        let dire = -1;

        //Iterate for surrounding tiles
        for(a of around){
            //If x axis is within array
            if(pos[0] + a[0] < map.width && pos[0] + a[0] > -1){
                //If y axis is within array
                if(pos[1] + a[1] < map.length && pos[1] + a[1] > -1){
                    //If there is a tile there
                    if(walls[pos[1] + a[1]][pos[0] + a[0]].is_reachable){
                        //Add to number of surrounding tiles
                        surround = surround + 1
                        //Store direction
                        dire = d
                    }
                }
            }
            //Increment direction
            d = d + 1
        }

        let rotation = 0
        //If there was only one connected tile and there is a valid stored direction
        if(surround == 1 && dire > -1 && dire < notchAround.length){
            //Get the left and right tile positions to check
            let targetLeft = [pos[0] + notchAround[dire][0][0], pos[1] + notchAround[dire][0][1]];
            let targetRight = [pos[0] + notchAround[dire][1][0], pos[1] + notchAround[dire][1][1]];

            //If the left tile is a valid target position
            if(targetLeft[0] < map.width && targetLeft[0] > -1 && targetLeft[1] < map.length && targetLeft[1] > -1){
                //If there is no tile there
                if(!walls[targetLeft[1]][targetLeft[0]].is_reachable){
                    //A left notch is needed
                    needLeft = true;
                }
            }

            //If the right tile is a valid target position
            if(targetRight[0] < map.width && targetRight[0] > -1 && targetRight[1] < map.length && targetRight[1] > -1){
                //If there is no tile there
                if(!walls[targetRight[1]][targetRight[0]].is_reachable){
                    //A right notch is needed
                    needRight = true;
                }
            }

            rotation = rotations[dire];
        }

        //Return information about needed notches
        return [needLeft, needRight, rotation]
    }

    function is_truthy(v){
        if(v) return true;
        return false;
    }

    function getRandomArbitrary(min, max) {
        if (noRandom()) return (min + max) / 2
        return Math.random() * (max - min) + min;
    }

    function orgRound(value, base) {
        return Math.round(value / base) * base;
    }

    //tag proto file creation

    const HUMAN_PLACE_TOP    = 0;
    const HUMAN_PLACE_RIGHT  = 1;
    const HUMAN_PLACE_BOTTOM = 2;
    const HUMAN_PLACE_LEFT   = 3;

    // tag quaternions
    /**
    * @typedef {Object} Quaternion
    * @property {number} x
    * @property {number} y
    * @property {number} z
    * @property {number} w
    */

    /**
    * @param {Quaternion} q
    * @returns {Quaternion}
    * @see {@link https://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm} for reference implementation in java.
    */
    function normalize_quaternion(q) {
        let n = Math.sqrt(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w);
        return {
            x: q.x / n,
            y: q.y / n,
            z: q.z / n,
            w: q.w / n
        }
    }

    /**
    * @param {Quaternion} q1
    * @param {Quaternion} q2
    * @returns {Quaternion}
    * @see {@link https://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm} for reference implementation in java.
    */
    function multiply_quaternions(q1, q2) {
        return {
            x:  q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x,
            y: -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y,
            z:  q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z,
            w: -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w
        }
    }

    /**
    * @typedef {Object} AxisAngle
    * @property {number} x
    * @property {number} y
    * @property {number} z
    * @property {number} angle
    */

    /**
    * @param {AxisAngle} a
    * @returns {Quaternion}
    * @see {@link https://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm} for reference implementation in java.
    */
    function axis_angle_to_quaternion(a) {
        let s = Math.sin(a.angle/2);
        return {
            x: a.x * s,
            y: a.y * s,
            z: a.z * s,
            w: Math.cos(a.angle/2)
        }
    }

    /**
    * @param {Quaternion} q
    * @returns {AxisAngle}
    * @see {@link https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToAngle/index.htm} for reference implementation in java.
    */
    function quaternion_to_axis_angle(q) {
        // if w>1, acos and sqrt will produce errors
        if (q.w > 1) normalize_quaternion(q);
        let angle = 2 * Math.acos(q.w);
        let s = Math.sqrt(1-q.w*q.w); // if quaternion is normalized w is less than 1, so term is always positive
        if (s < 0.001) { // avoid divide by zero
            return {
                x: q.x,
                y: q.y,
                z: q.z,
                angle: angle
            }
        } else {
            return {
                x: q.x / s, // normalize axis
                y: q.y / s,
                z: q.z / s,
                angle: angle
            }
        }
    }

    // tag rotation wall tokens

    /**
    * Calculate rotation for wall tokens
    * @param {number} y_rot
    * @param {number} front_rot
    * @returns {AxisAngle}
    */
    function calculateWallTokenRot(y_rot, front_rot) {
        let z_rot_quat = axis_angle_to_quaternion({x: 0, y: 0, z: 1, angle: front_rot})
        let y_rot_quat = axis_angle_to_quaternion({x: 0, y: 1, z: 0, angle: y_rot    }) 
        /**
        * Multiplying two quaternions is equivalent to applying their rotations one after the
        * other in a procedural way, just that the second factor is applied first. So we basically do:
        *
        *  . . . .                      .                        .
        *  .     .  rot. on z axis    .   .    rot. on y axis   . .
        *  .     .       -->        .       .        -->       .   .
        *  . . . .                    .   .                     . .
        *                               .                        .
        */
        let final_rot_quat = multiply_quaternions(y_rot_quat, z_rot_quat)
        let final_rot = quaternion_to_axis_angle(final_rot_quat)
        return final_rot;
    }

    const HUMAN_NONE    = 0;
    const HUMAN_H       = 1;
    const HUMAN_U       = 2;
    const HUMAN_S       = 3;
    const HUMAN_F       = 5;
    const HUMAN_P       = 6;
    const HUMAN_C       = 7;
    const HUMAN_O       = 8;
    const HUMAN_CT_FAKE = 9; // CT with sum outside [0,3] → CTfake, scoreWorth 0

    /**
    * @param {string} str
    * @returns {number}
    */
    function human_str_to_type(str) {
        switch (str) {
            case 'None': return HUMAN_NONE;
            case 'H'   : return HUMAN_H;
            case 'U'   : return HUMAN_U;
            case 'S'   : return HUMAN_S;
            case 'F'   : return HUMAN_F;
            case 'P'   : return HUMAN_P;
            case 'C'   : return HUMAN_C;
            case 'O'   : return HUMAN_O;
        } 
    }
    
    function cognitive_string_to_hazmat(str) {
        let sum = 0
        for (const c of str) {
            switch (c) {
            case 'K': sum += -2; break;
            case 'R': sum += -1; break;
            case 'Y': sum += 0; break;
            case 'G': sum += 1; break;
            case 'B': sum += 2; break;
            }
        }
        console.log("sum = ", sum)

        switch (sum) {
        case 0: return HUMAN_F;
        case 1: return HUMAN_P;
        case 2: return HUMAN_C;
        case 3: return HUMAN_O;
        default: return HUMAN_CT_FAKE; // sum outside [0,3] → CTfake
        }
    }

    function cognitiveCodeToVictimLetter(code) {
        if (!code || code.length !== 5) return null;
        let sum = 0;
        for (const c of code) {
            switch (c) {
            case 'K': sum += -2; break;
            case 'R': sum += -1; break;
            case 'Y': sum +=  0; break;
            case 'G': sum +=  1; break;
            case 'B': sum +=  2; break;
            }
        }
        const map = {0: 'F', 1: 'P', 2: 'C', 3: 'O'};
        return map[sum] !== undefined ? map[sum] : null;
    }

    // tag tile typedef
    /**
     * @typedef {Object} Tile
     * @property {boolean} is_reachable
     * @property {boolean} is_checkpoint
     * @property {boolean} is_black
     * @property {boolean} is_start
     * @property {boolean} is_swamp
     * @property {boolean} is_obstacle
     * @property {boolean} is_linear
     *
     * @property {Array  } whole_walls
     * @property {Number } wall_token_type
     * @property {Number } wall_token_place
     * @property {Number } wall_token_front_rot
     * @poperty  {boolean} wall_token_is_fake
     *
     * @property {string } inner_half_walls
     * @property {string } outer_half_walls
     * @property {Number } outer_half_walls_info
     * @property {string } curved_walls
     * @property {Array  } half_wall_tokens
     * @property {Array  } half_wall_tokens_front_rot
     * @poperty  {Array  } half_wall_tokens_fakes
     *
     * @property {string } floor_color
     * @property {Number } room_number
     */

    function createWorld(map, hooks) {
        function get_cell(x, y, z) {
            return map.cells[x + ',' + y + ',' + z];
        }

        let tiles = [];
        for (let x=1, l=map.length*2+1; x<l; x+=2){
            let row = [];
            for (let z=1, m=map.width*2+1; z<m; z+=2){
                row.push({
                    is_reachable               : false,
                    is_checkpoint              : false,
                    is_black                   : false,
                    is_start                   : false,
                    is_swamp                   : false,
                    is_obstacle                : false,
                    is_linear                  : false,

                    whole_walls                : [0, 0, 0, 0],
                    wall_token_type            : 0,
                    wall_token_place           : 0,
                    wall_token_front_rot       : 0,
                    wall_token_is_fake         : false,
                    wall_token_cognitive_code  : '',

                    inner_half_walls           : '',
                    outer_half_walls           : '',
                    outer_half_walls_info      : 0,
                    curved_walls               : '',
                    half_wall_tokens           : [],
                    half_wall_cognitives       : [''],
                    half_wall_tokens_front_rot : [],
                    half_wall_tokens_fakes     : [],
                    half_wall_tokens_cognitive_codes : [],

                    floor_color                : '0.635 0.635 0.635',
                    room_number                : 0,
                });
            }
            tiles.push(row);
        }
        for(let y=1, l=map.length*2+1; y<l; y+=2){
            for(let x=1, m=map.width*2+1; x<m; x+=2){
                let thisCell = get_cell(x, y, 0);
                let tile = tiles[(y-1)/2][(x-1)/2]

                tile.whole_walls      = [0, 0, 0, 0]
                tile.outer_half_walls = [0, 0, 0, 0]

                if (get_cell(x, y-2, 0) == null
                &&  get_cell(x, y-1, 0)
                &&  get_cell(x, y-1, 0).isWall
                ) tile.whole_walls[0] = 1;

                if (get_cell(x+1, y, 0) 
                &&  get_cell(x+1, y, 0).isWall
                ) tile.whole_walls[1] = 1;

                if (get_cell(x, y+1, 0) 
                &&  get_cell(x, y+1, 0).isWall
                ) tile.whole_walls[2] = 1;

                if (get_cell(x-2, y, 0) == null 
                &&  get_cell(x-1, y, 0) 
                &&  get_cell(x-1, y, 0).isWall
                ) tile.whole_walls[3] = 1;

                if (y == 1
                && get_cell(x, y-1, 0) 
                && get_cell(x, y-1, 0).halfWall > 0) {
                    get_cell(x, y, 0).tile.halfTile = 1;
                    tile.outer_half_walls[0] = get_cell(x, y-1, 0).halfWall;
                }

                if (get_cell(x+1, y, 0)
                &&  get_cell(x+1, y, 0).halfWall > 0) {
                    get_cell(x, y, 0).tile.halfTile = 1;
                    tile.outer_half_walls[1] = get_cell(x+1, y, 0).halfWall;
                }

                if(get_cell(x, y+1, 0) 
                && get_cell(x, y+1, 0).halfWall > 0) {
                    get_cell(x, y, 0).tile.halfTile = 1;
                    tile.outer_half_walls[2] = get_cell(x, y+1, 0).halfWall;
                }

                if (x == 1 
                && get_cell(x-1, y, 0) 
                && get_cell(x-1, y, 0).halfWall > 0) {
                    get_cell(x, y, 0).tile.halfTile = 1;
                    tile.outer_half_walls[3] = get_cell(x-1, y, 0).halfWall;
                }

                let floorColor = '0.635 0.635 0.635';
                //stores shortening, lengthing of outer half walls
                tile.outer_half_walls_info = [1, 1, 1, 1];
                if (!thisCell)      { continue; }
                if (!thisCell.tile) { continue; }

                tile.wall_token_type  = HUMAN_NONE
                tile.wall_token_place = HUMAN_PLACE_TOP
                if (thisCell.tile.victims) {
                    if (thisCell.tile.victims.top) {
                        tile.wall_token_type = human_str_to_type(thisCell.tile.victims.top);
                        tile.wall_token_place = HUMAN_PLACE_TOP
                    } else if (thisCell.tile.victims.right) {
                        tile.wall_token_type = human_str_to_type(thisCell.tile.victims.right);
                        tile.wall_token_place = HUMAN_PLACE_RIGHT
                    } else if(thisCell.tile.victims.bottom){
                        tile.wall_token_type = human_str_to_type(thisCell.tile.victims.bottom);
                        tile.wall_token_place = HUMAN_PLACE_BOTTOM;
                    } else if(thisCell.tile.victims.left){
                        tile.wall_token_type = human_str_to_type(thisCell.tile.victims.left);
                        tile.wall_token_place = HUMAN_PLACE_LEFT;
                    }
                }
                if (thisCell.tile.cognitives) {
                    if (thisCell.tile.cognitives.top_code) {
                        tile.wall_token_cognitive_code = thisCell.tile.cognitives.top_code
                        tile.wall_token_type = cognitive_string_to_hazmat(thisCell.tile.cognitives.top_code);
                        tile.wall_token_place = HUMAN_PLACE_TOP
                    } else if (thisCell.tile.cognitives.right_code) {
                        tile.wall_token_cognitive_code = thisCell.tile.cognitives.right_code
                        tile.wall_token_type = cognitive_string_to_hazmat(thisCell.tile.cognitives.right_code);
                        tile.wall_token_place = HUMAN_PLACE_RIGHT
                    } else if (thisCell.tile.cognitives.bottom_code){
                        tile.wall_token_cognitive_code = thisCell.tile.cognitives.bottom_code
                        tile.wall_token_type = cognitive_string_to_hazmat(thisCell.tile.cognitives.bottom_code);
                        tile.wall_token_place = HUMAN_PLACE_BOTTOM;
                    } else if (thisCell.tile.cognitives.left_code){
                        tile.wall_token_cognitive_code = thisCell.tile.cognitives.left_code
                        tile.wall_token_type = cognitive_string_to_hazmat(thisCell.tile.cognitives.left_code);
                        tile.wall_token_place = HUMAN_PLACE_LEFT;
                    } else {
                        console.log("")
                    }
                }

                /**
                 * @param {number} d
                 * @returns {number}
                 */
                function degreesToRadians(d) {
                    return d * (Math.PI / 180);
                }

                tile.wall_token_front_rot = 0
                if (thisCell.tile.single_victim_rotation) {
                    tile.wall_token_front_rot = degreesToRadians(thisCell.tile.single_victim_rotation)
                }

                tile.wall_token_is_fake = false;
                if (thisCell.tile.victim_is_fake) {
                    tile.wall_token_is_fake = true;
                }

                if (thisCell.tile.color) {
                    floorColor = '';
                    if (thisCell.tile.color == '#08D508') // area 1 <-> 4
                        map.connect14 = [x, y];
                    else if (thisCell.tile.color == '#e71a1a') // area 3 <-> 4
                        map.connect34 = [x, y]
                    for (i = 1; i < 7; i += 2)
                        floorColor += String(parseInt('0x' + thisCell.tile.color.substring(i, i + 2)) / 255.0) + ' ';
                }
                // using array.slice[] to make copy of the array, so no state is accidentally kept on the ui between world generations
                tile.inner_half_walls = thisCell.tile.halfWallIn.slice() 
                tile.curved_walls = '[' + thisCell.tile.curve.toString() + ']';

                tile.is_reachable               = is_truthy(thisCell.reachable);
                tile.is_checkpoint              = is_truthy(thisCell.tile.checkpoint);
                tile.is_black                   = is_truthy(thisCell.tile.black);
                tile.is_swamp                   = is_truthy(thisCell.tile.swamp);
                tile.is_obstacle                = is_truthy(thisCell.tile.obstacle);
                tile.is_linear                  = is_truthy(thisCell.isLinear);
                tile.is_start                   = (x == map.startTile.x && y == map.startTile.y);

                tile.half_wall_tokens_cognitive_codes = thisCell.tile.halfWallCognitives

                // Normalize: objects with numeric keys (e.g. {"0":"1"}) -> sparse array
                function objToArray(val) {
                    if (!val || Array.isArray(val)) return val || [];
                    var arr = [];
                    Object.keys(val).forEach(function(k) { arr[parseInt(k)] = val[k]; });
                    return arr;
                }
                arr2 = objToArray(tile.half_wall_tokens_cognitive_codes);
                tile.half_wall_tokens_cognitive_codes = arr2;
                arr1 = objToArray(thisCell.tile.halfWallVic);
                tile.half_wall_tokens = []

                console.log("half_wall_tokens_cognitive_codes", tile.half_wall_tokens_cognitive_codes)
                console.log("arr1", arr1)
                console.log("arr2", arr2)

                for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
                    if (arr1[i]) {
                        tile.half_wall_tokens.push(arr1[i])
                    } else if (arr2[i]) {
                        tile.half_wall_tokens.push(cognitive_string_to_hazmat(arr2[i]))
                    } else {
                        tile.half_wall_tokens.push(undefined)
                    }
                }

                console.log(tile.half_wall_tokens)
                //tile.half_wall_tokens           = 

                tile.half_wall_tokens_front_rot = objToArray(thisCell.tile.halfWallVicRots).map(Number).map(degreesToRadians);
                tile.half_wall_tokens_fakes     = thisCell.tile.halfWallVicFakes;
                tile.floor_color                = floorColor;
                tile.room_number                = checkRoomNumber(map, x,y,0);
            }
        }
        
        const DIR_NORTH = 0;
        const DIR_EAST  = 1;
        const DIR_SOUTH = 2;
        const DIR_WEST  = 3;
        function vectorRotate(vector, dir) {
            switch (dir) {
                case DIR_NORTH: return [vector[0], vector[1]]
                case DIR_EAST : return [-1 * vector[1], vector[0]]
                case DIR_SOUTH: return [-1 * vector[0], -1 * vector[1]]
                case DIR_WEST : return [vector[1], -1 * vector[0]]
            }
        }

        function inBounds(z, x) {
            return (z >= 0) && (z < map.length) && (x >= 0) && (x < map.width);
        }


        let arr = [];
        //General scale for tiles - adjusts position and size of pieces and obstacles
        let tileScale = [0.4, 0.4, 0.4];
        //The vertical position of the floor
        let floorPos = -0.075 * tileScale[1];

        //Strings to hold the tile parts
        let allTiles = "";
        //Strings to hold the boundaries for special tiles
        let allCheckpointBounds = "";
        let allTrapBounds = "";
        let allGoalBounds = "";
        let allSwampBounds = "";
        let allObstacles = "";

        const boundsPart = ({name, id, xmin, zmin, xmax, zmax, y}) => `
        DEF boundary Group {
            children [
              DEF ${name}${id}min Transform {
                    translation ${xmin} ${y} ${zmin}
              }
              DEF ${name}${id}max Transform {
                    translation ${xmax} ${y} ${zmax}
              }
            ]
          }
        `;

        const area4Part = ({roomNum, x, y, rot, width, height, xScale, yScale, zScale, area4Width, area4Height}) => `
        Area4_${roomNum-1} {
            X ${x}
            Y ${y}
            DIR ${rot}
            width ${width}
            height ${height}
            xScale ${xScale}
            zScale ${zScale}
            yScale ${yScale}
            area4Width ${area4Width}
            area4Height ${area4Height}
        }
        `;


        function hsu_to_greek_letters(hsu) {
            switch(hsu) {
                case "harmed": return "phi"
                case "stable": return  "psi"
                case "unharmed": return "omega"
            }
            console.log("UNREACHABLE: invalid victim name")
        }

        function visualHumanPart({x, z, rot, frontRotation, is_fake, id, type, score}) {
            r = calculateWallTokenRot(rot, frontRotation)
            name = "Victim"
            if (is_fake) {
                name = "Fake"
                type = hsu_to_greek_letters(type)
            }
            return `
            ${name} {
                translation ${x} 0 ${z}
                rotation ${r.x} ${r.y} ${r.z} ${r.angle}
                name "${name}${id}"
                type "${type}"
                scoreWorth ${score}
            }
            `;
        }

        function hazardPart({x, z, rot, frontRotation, id, type, score}) {
            r = calculateWallTokenRot(rot, frontRotation)
            return `
            CognitiveTarget {
                translation ${x} 0 ${z}
                rotation ${r.x} ${r.y} ${r.z} ${r.angle}
                name "Hazard${id}"
                type "${type}"
                scoreWorth ${score}
            }
            `;
        }

        const obstaclePart = ({id, xSize, ySize, zSize, x, y, z, rot}) => `
        DEF OBSTACLE${id} Solid {
            translation ${x} ${y} ${z}
			rotation 0 1 0 ${rot}
            children [
                Shape {
                    appearance Appearance {
						material Material {
						diffuseColor 0.45 0.45 0.45
						}
                    }
                    geometry DEF OBSTACLEBOX${id} Box {
						size ${xSize} ${ySize} ${zSize}
                    }
                }
            ]
            name "obstacle${id}"
            boundingObject USE OBSTACLEBOX${id}
	    recognitionColors [
			0.45 0.45 0.45
		]
        }
        `;

        const groupPart = ({data, name}) => `
        DEF ${name} Group {
            children [
              ${data}
            ]
        }
        `;

        const supervisorPart = ({time}) => `
        DEF MAINSUPERVISOR Robot {
            children [
              Receiver {
                channel 1
              }
              Emitter {
                channel 1
              }
            ]
            supervisor TRUE
            controller "MainSupervisor"
            customData "${time}"
            window "MainSupervisorWindow"
          }
        `;

        //Upper left corner to start placing tiles from
        let width = map.width;
        let height = map.length;
        let startX = -(map.width * (0.3 * tileScale[0]) / 2.0);
        let startZ = -(map.length * (0.3 * tileScale[2]) / 2.0);

        let fileData = `#VRML_SIM R2022b utf8
        EXTERNPROTO "../protos/TexturedBackgroundLight.proto"
        EXTERNPROTO "../protos/TexturedBackground.proto"
        EXTERNPROTO "../protos/curvedWall.proto"
        EXTERNPROTO "../protos/halfTile.proto"
        EXTERNPROTO "../protos/CognitiveTarget.proto"
        EXTERNPROTO "../protos/HazardMap.proto"
        EXTERNPROTO "../protos/Fake.proto"
        EXTERNPROTO "../protos/obstacle.proto"
        EXTERNPROTO "../protos/Victim.proto"
        EXTERNPROTO "../protos/worldTile.proto"
        EXTERNPROTO "../protos/Area4_1.proto"
        EXTERNPROTO "../protos/Area4_2.proto"
        IMPORTABLE EXTERNPROTO "../protos/custom_robot.proto"

        WorldInfo {
          basicTimeStep 16
          coordinateSystem "NUE"
          contactProperties [
            ContactProperties {
              material1  "TILE"
              material2  "NO_FRIC"
              coulombFriction 0
              bounce 0
              bumpSound ""
              rollSound ""
              slideSound ""
            }
          ]
        }
        DEF Viewpoint Viewpoint {
          orientation -0.683263 0.683263 0.257493 2.63756
          position -0.08 ${0.2*height} ${0.17*height}
        }
        TexturedBackground {
        }
        TexturedBackgroundLight {
        }
        `;

        //Y rotation of humans for each wall
        let humanRotation = [3.14, 1.57, 0, -1.57]
        let humanRotationCurve = [2.355, 0.785, -0.785, -2.355];

        let halfWallVicPos = [[-0.075, -0.136], [-0.014, -0.075], [-0.075, -0.014], [-0.136, -0.075], 
                              [ 0.075, -0.136], [ 0.136, -0.075], [ 0.075, -0.014], [ 0.014, -0.074], 
                              [-0.075,  0.014], [-0.014,  0.075], [-0.075,  0.136], [-0.136,  0.075],
                              [ 0.075,  0.014], [ 0.136,  0.075], [ 0.075,  0.136], [ 0.014,  0.075]];

        let curveWallVicPos = [[-0.022, -0.039], [-0.022, -0.022], [-0.039, -0.023], [-0.038, -0.038],
                               [ 0.038, -0.039], [ 0.038, -0.022], [ 0.021, -0.023], [ 0.022, -0.038],
                               [-0.022,  0.021], [-0.022,  0.038], [-0.039,  0.037], [-0.038,  0.022],
                               [ 0.038,  0.021], [ 0.038,  0.038], [ 0.021,  0.037], [ 0.022,  0.022]];
        //Offsets for visual and thermal humans
        let humanOffset = [
            [0,                      -0.1375 * tileScale[2]],
            [ 0.1375 * tileScale[0],  0                    ],
            [0,                       0.1375 * tileScale[2]],
            [-0.1375 * tileScale[0],  0                    ]
        ]
        let hazardOffset = [
            [ 0,                     -0.136 * tileScale[2]],
            [ 0.136 * tileScale[0],   0                   ],
            [ 0,                      0.136 * tileScale[2]],
            [-0.136 * tileScale[0],   0                   ]
        ]
        let humanOffsetCurve = [
            [-0.008,  0.008],
            [-0.008, -0.008],
            [ 0.008, -0.008],
            [ 0.008,  0.008]
        ]
        //Names of types of visual human
        let humanTypesVisual = ["harmed", "unharmed", "stable"]
        //Names of types of hazards
        let hazardTypes = ["F", "P", "C", "O"]

        //Id numbers used to give a unique but interable name to tile pieces
        let tileId     = 0
        let checkId    = 0
        let trapId     = 0
        let goalId     = 0
        let swampId    = 0
        let humanId    = 0
        let fakeHumanId    = 0
        let obstacleId = 0
        let hazardId   = 0

        //Resolve corners
        // halfwallout 10, hallwallin 11, halfwalloutinfo 15
        for(let x = 0; x < map.length+1; x++) {
            for(let z = 0; z < map.width+1; z++) {

                let verticalWalls = 0;
                let horizontalWalls = 0;
                let topLeft = false;

                if((tiles[x-1] != null && tiles[x-1][ z ] != null && (tiles[x-1][ z ].whole_walls[3] > 0 || tiles[x-1][ z ].outer_half_walls[3] == 1))
                || (tiles[x-1] != null && tiles[x-1][z-1] != null && (tiles[x-1][z-1].whole_walls[1] > 0 || tiles[x-1][z-1].outer_half_walls[1] == 1))) verticalWalls++; //North wall

                if((tiles[ x ] != null && tiles[ x ][ z ] != null && (tiles[ x ][ z ].whole_walls[0] > 0 || tiles[ x ][ z ].outer_half_walls[0] == 1))
                || (tiles[x-1] != null && tiles[x-1][ z ] != null && (tiles[x-1][ z ].whole_walls[2] > 0 || tiles[x-1][ z ].outer_half_walls[2] == 1))) horizontalWalls++;

                if((tiles[ x ] != null && tiles[ x ][ z ] != null && (tiles[ x ][ z ].whole_walls[3] > 0 || tiles[ x ][ z ].outer_half_walls[3] == 2))
                || (tiles[ x ] != null && tiles[ x ][z-1] != null && (tiles[ x ][z-1].whole_walls[1] > 0 || tiles[ x ][z-1].outer_half_walls[1] == 2))) verticalWalls++;

                if((tiles[x-1] != null && tiles[x-1][z-1] != null && (tiles[x-1][z-1].whole_walls[2] > 0 || tiles[x-1][z-1].outer_half_walls[2] == 2))
                || (tiles[ x ] != null && tiles[ x ][z-1] != null && (tiles[ x ][z-1].whole_walls[0] > 0 || tiles[ x ][z-1].outer_half_walls[0] == 2))) horizontalWalls++;

                //Very special case for top left corner
                if((tiles[x] != null && tiles[x][z] != null && (tiles[x][z].whole_walls[0] > 0 || tiles[x][z].outer_half_walls[0] == 1))
                || (tiles[x] != null && tiles[x][z] != null && (tiles[x][z].whole_walls[3] > 0 || tiles[x][z].outer_half_walls[3] == 2))) topLeft = true;


                if(horizontalWalls > 0 && verticalWalls > 0) {
                    //North wall
                    if (tiles[x-1] != null && tiles[x-1][ z ] && tiles[x-1][ z ].whole_walls[3] > 0)
                        tiles[x-1][ z ].whole_walls[3] = (tiles[x-1][ z ].whole_walls[3]) * 3;
                    else if (tiles[x-1] != null && tiles[x-1][z-1] && tiles[x-1][z-1].whole_walls[1] > 0)
                        tiles[x-1][z-1].whole_walls[1] = (tiles[x-1][z-1].whole_walls[1]) * 3;
                    else if(tiles[x-1] != null && tiles[x-1][ z ] && tiles[x-1][ z ].outer_half_walls[3] == 1)
                        tiles[x-1][ z ].outer_half_walls_info[3] *= 3;
                    else if( tiles[x-1] != null && tiles[x-1][z-1] && tiles[x-1][z-1].outer_half_walls[1] == 1)
                        tiles[x-1][z-1].outer_half_walls_info[1] *= 3;

                    if     ((tiles[x-1] != null && tiles[x-1][z] && tiles[x-1][z].whole_walls[2] > 0 )) tiles[x-1][z].whole_walls[2] = (tiles[x-1][z].whole_walls[2]) * horizontalWalls == 1 ? 5 : 2;
                    else if( tiles[ x ] != null && tiles[ x ][z] && tiles[ x ][z].whole_walls[0] > 0 )  tiles[ x ][z].whole_walls[0] = (tiles[x  ][z].whole_walls[0]) * 2;
                    else if((tiles[x-1] != null && tiles[x-1][z] && tiles[x-1][z].outer_half_walls[2] == 1)) tiles[x-1][z].outer_half_walls_info[2] *= horizontalWalls == 1 ? 5 : 2;
                    else if( tiles[ x ] != null && tiles[ x ][z] && tiles[ x ][z].outer_half_walls[0] == 1)  tiles[ x ][z].outer_half_walls_info[0] *= 2;

                    if     ((tiles[x] != null && tiles[x][z-1] && tiles[x][z-1].whole_walls [1] > 0))  tiles[x][z-1].whole_walls[1] = (tiles[x][z-1].whole_walls[1]) * 2;
                    else if( tiles[x] != null && tiles[x][z]   && tiles[x][z  ].whole_walls [3] > 0)   tiles[x][z  ].whole_walls[3] = (tiles[x][z  ].whole_walls[3]) * 2;
                    else if((tiles[x] != null && tiles[x][z-1] && tiles[x][z-1].outer_half_walls[1] == 2)) tiles[x][z-1].outer_half_walls_info[1] *= 2; 
                    else if( tiles[x] != null && tiles[x][z]   && tiles[x][z  ].outer_half_walls[3] == 2)  tiles[x][z  ].outer_half_walls_info[3] *= 2; 

                    if     ((tiles[x  ] != null && tiles[x  ][z-1] && tiles[x  ][z-1].whole_walls[0] > 0))  tiles[x  ][z-1].whole_walls[0] = (tiles[x  ][z-1].whole_walls[0]) * 3;
                    else if (tiles[x-1] != null && tiles[x-1][z-1] && tiles[x-1][z-1].whole_walls[2] > 0)   tiles[x-1][z-1].whole_walls[2] = (tiles[x-1][z-1].whole_walls[2]) * 3;
                    else if((tiles[x  ] != null && tiles[x  ][z-1] && tiles[x  ][z-1].outer_half_walls[0] == 2)) tiles[x  ][z-1].outer_half_walls_info[0] *= 3; 
                    else if (tiles[x-1] != null && tiles[x-1][z-1] && tiles[x-1][z-1].outer_half_walls[2] == 2)  tiles[x-1][z-1].outer_half_walls_info[2] *= 3; 

                    if (topLeft && horizontalWalls == 1 && verticalWalls == 1) {
                        // If the left and top walls are the only horizontal and vertical walls

                        tiles[x][z].whole_walls[0] /= 2;
                        tiles[x][z].whole_walls[3] /= 2;
                        if (tiles[x][z].outer_half_walls[0] == 1) tiles[x][z].outer_half_walls_info[0] /= 2;
                        if (tiles[x][z].outer_half_walls[3] == 1) tiles[x][z].outer_half_walls_info[3] /= 2;
                    }
                }

                //inner half tile walls along horizontal edge of 2 different tiles
                horizontalWalls = 0;
                verticalWalls = 0;
                if(tiles[ x ] != null && tiles[ x ][z] != null && tiles[ x ][z].inner_half_walls[0] > 0) verticalWalls++;
                if(tiles[x-1] != null && tiles[x-1][z] != null && tiles[x-1][z].inner_half_walls[2] > 0) verticalWalls++;
                if(tiles[ x ] != null && tiles[ x ][z] != null && tiles[ x ][z].outer_half_walls[0] > 0) horizontalWalls++;
                if(tiles[x-1] != null && tiles[x-1][z] != null && tiles[x-1][z].outer_half_walls[2] > 0) horizontalWalls++;
                if(horizontalWalls > 0 && verticalWalls > 0) {

                    if(tiles[ x ] != null && tiles[ x ][z] != null && tiles[ x ][z].inner_half_walls[0] > 0) tiles[ x ][z].inner_half_walls[0] *= 2;
                    if(tiles[x-1] != null && tiles[x-1][z] != null && tiles[x-1][z].inner_half_walls[2] > 0) tiles[x-1][z].inner_half_walls[2] *= 3;

                    if     (tiles[x] != null && tiles[x][z] != null && tiles[x][z].outer_half_walls[0] == 1) tiles[x][z].outer_half_walls_info[0] *= 3;
                    else if(tiles[x] != null && tiles[x][z] != null && tiles[x][z].outer_half_walls[0] == 2) tiles[x][z].outer_half_walls_info[0] *= horizontalWalls == 1 ? 5 : 2;

                    if     (tiles[x-1] != null && tiles[x-1][z] != null && tiles[x-1][z].outer_half_walls[2] == 1) tiles[x-1][z].outer_half_walls_info[2] *= 2;
                    else if(tiles[x-1] != null && tiles[x-1][z] != null && tiles[x-1][z].outer_half_walls[2] == 2) tiles[x-1][z].outer_half_walls_info[2] *= horizontalWalls == 1 ? 5 : 2;
                }

                horizontalWalls = 0;
                verticalWalls = 0;

                //inner half tile walls in center
                if(tiles[x] != null && tiles[x][z] != null) {
                    if(tiles[x][z].inner_half_walls[0] > 0) verticalWalls++;
                    if(tiles[x][z].inner_half_walls[1] > 0) horizontalWalls++;
                    if(tiles[x][z].inner_half_walls[2] > 0) verticalWalls++;
                    if(tiles[x][z].inner_half_walls[3] > 0) horizontalWalls++;

                    if(verticalWalls > 0 && horizontalWalls > 0) {
                        tiles[x][z].inner_half_walls[0] *= 3;
                        tiles[x][z].inner_half_walls[1] *= horizontalWalls == 1 ? 5 : 2;
                        tiles[x][z].inner_half_walls[2] *= 2;
                        tiles[x][z].inner_half_walls[3] *= 3;
                    }
                }

                horizontalWalls = 0;
                verticalWalls = 0;
                //inner half tile walls along vertical edge of 2 different tiles
                if(tiles[x] != null && (tiles[x][ z ] != null && tiles[x][ z ].outer_half_walls[3] > 0)) verticalWalls++;
                if(tiles[x] != null &&  tiles[x][z-1] != null && tiles[x][z-1].outer_half_walls[1] > 0) verticalWalls++;

                if(tiles[x] != null && tiles[x][ z ] != null && tiles[x][ z ].inner_half_walls[3] > 0) horizontalWalls++;
                if(tiles[x] != null && tiles[x][z-1] != null && tiles[x][z-1].inner_half_walls[1] > 0) horizontalWalls++;

                if(verticalWalls > 0 && horizontalWalls > 0) {
                    if     (tiles[x] != null && tiles[x][z] != null && tiles[x][z].outer_half_walls[3] == 2) tiles[x][z].outer_half_walls_info[3] *= 3;
                    else if(tiles[x] != null && tiles[x][z] != null && tiles[x][z].outer_half_walls[3] == 1) tiles[x][z].outer_half_walls_info[3] *= 2;

                    if     (tiles[x] != null && tiles[x][z-1] != null && tiles[x][z-1].outer_half_walls[1] == 2) tiles[x][z-1].outer_half_walls_info[1] *= 3;
                    else if(tiles[x] != null && tiles[x][z-1] != null && tiles[x][z-1].outer_half_walls[1] == 1) tiles[x][z-1].outer_half_walls_info[1] *= 2;

                    if(tiles[x] != null && tiles[x][ z ] != null && tiles[x][ z ].inner_half_walls[3] > 0) tiles[x][ z ].inner_half_walls[3] *= horizontalWalls == 1 ? 5 : 2;
                    if(tiles[x] != null && tiles[x][z-1] != null && tiles[x][z-1].inner_half_walls[1] > 0) tiles[x][z-1].inner_half_walls[1] *= 3;
                }
            }
        }

        //String to hold all the humans/hazards
        let allHumans = ""
        let allFakes = ""
        let allHazards = ""
        for(let x=0;x<map.width;x++){
            for(let z=0;z<map.length;z++){
                //Check which corners and external walls and notches are needed
                let externals = checkForExternalWalls(map, [x, z], tiles)
                //Name to be given to the tile
                let tileName = "TILE"
                tile = tiles[z][x]
                if(tile.is_start) tileName = "START_TILE"
                //Create a new tile with all the data
                let _cellKey = String(x * 2 + 1) + "," + String(z * 2 + 1) + ",0";
                let _cell = map.cells[_cellKey];
                if (_cell && _cell.tile && _cell.tile.halfTile) {
                    let t1w = [
                        tile.outer_half_walls[UP] == 1 ? tile.outer_half_walls_info[UP] : 0,
                        tile.inner_half_walls[UP],
                        tile.inner_half_walls[3],
                        tile.outer_half_walls[3] == 2 ? tile.outer_half_walls_info[3] : 0
                    ].map(Number);

                    let t2w = [
                        tile.outer_half_walls[UP] == 2 ? tile.outer_half_walls_info[0] : 0,
                        tile.outer_half_walls[1] == 2 ? tile.outer_half_walls_info[1] : 0,
                        tile.inner_half_walls[1],
                        0
                    ].map(Number); 

                    let t3w = [
                        0,
                        tile.inner_half_walls[2],
                        tile.outer_half_walls[2] == 1 ? tile.outer_half_walls_info[2] : 0,
                        tile.outer_half_walls[3] == 1 ? tile.outer_half_walls_info[3] : 0
                    ].map(Number);

                    let t4w = [
                        0,
                        tile.outer_half_walls[1] == 1 ? tile.outer_half_walls_info[1] : 0,
                        tile.outer_half_walls[2] == 2 ? tile.outer_half_walls_info[2] : 0,
                        0
                    ].map(Number);

                    console.log("b", tile.outer_half_walls);
                    
                    let t1e = [externals[UP], false           , false          , externals[LEFT]];
                    let t2e = [externals[UP], externals[RIGHT], false          , false          ];
                    let t3e = [false        , false           , externals[DOWN], externals[LEFT]];
                    let t4e = [false        , externals[RIGHT], externals[DOWN], false          ];

                    tile_string = `
        DEF ${tileName} halfTile {
            xPos ${x}
            zPos ${z}
            floor ${tile.is_reachable && !tile.is_black }
            topWall ${   tile.whole_walls[UP]   }
            rightWall ${ tile.whole_walls[RIGHT]}
            bottomWall ${tile.whole_walls[DOWN] }
            leftWall ${  tile.whole_walls[LEFT] }
            tile1Walls [ ${t1w[UP]}, ${t1w[RIGHT]}, ${t1w[DOWN]}, ${t1w[LEFT]} ]
            tile2Walls [ ${t2w[UP]}, ${t2w[RIGHT]}, ${t2w[DOWN]}, ${t2w[LEFT]} ]
            tile3Walls [ ${t3w[UP]}, ${t3w[RIGHT]}, ${t3w[DOWN]}, ${t3w[LEFT]} ]
            tile4Walls [ ${t4w[UP]}, ${t4w[RIGHT]}, ${t4w[DOWN]}, ${t4w[LEFT]} ]
            tile1External [ ${t1e[UP]}, ${t1e[RIGHT]}, ${t1e[DOWN]}, ${t1e[LEFT]} ]
            tile2External [ ${t2e[UP]}, ${t2e[RIGHT]}, ${t2e[DOWN]}, ${t2e[LEFT]} ]
            tile3External [ ${t3e[UP]}, ${t3e[RIGHT]}, ${t3e[DOWN]}, ${t3e[LEFT]} ]
            tile4External [ ${t4e[UP]}, ${t4e[RIGHT]}, ${t4e[DOWN]}, ${t4e[LEFT]} ]
            curve ${tile.curved_walls}
            start ${tile.is_start}
            trap ${tile.is_black}
            checkpoint ${tile.is_checkpoint}
            swamp ${tile.is_swamp}
            width ${width}
            height ${height}
            id "${tileId}"
            xScale ${tileScale[0]}
            yScale ${tileScale[1]}
            zScale ${tileScale[2]}
            tileColor ${tile.floor_color}
            room ${tile.room_number}
          }
        `;
                    tile_string = tile_string.replace(/true/g, "TRUE")
                    tile_string = tile_string.replace(/false/g, "FALSE")
                }
                else {
                    tile_string = `
        DEF ${tileName} worldTile {
            xPos ${x}
            zPos ${z}
            floor ${tile.is_reachable && !tile.is_black}
            topWall ${   tile.whole_walls[UP]   }
            rightWall ${ tile.whole_walls[RIGHT]}
            bottomWall ${tile.whole_walls[DOWN] }
            leftWall ${  tile.whole_walls[LEFT] }
            topExternal ${   externals[UP]   }
            rightExternal ${ externals[RIGHT]}
            bottomExternal ${externals[DOWN] }
            leftExternal ${  externals[LEFT] }
            start ${tile.is_start}
            trap ${tile.is_black}
            checkpoint ${tile.is_checkpoint}
            swamp ${tile.is_swamp}
            width ${width}
            height ${height}
            id "${tileId}"
            xScale ${tileScale[0]}
            yScale ${tileScale[1]}
            zScale ${tileScale[2]}
            tileColor ${tile.floor_color}
            room ${tile.room_number}
          }
        `
                    tile_string = tile_string.replace(/true/g, "TRUE")
                    tile_string = tile_string.replace(/false/g, "FALSE")
                }
                allTiles += tile_string


                let xmin = (x * 0.3 * tileScale[0] + startX) - (0.15 * tileScale[0])
                let zmin = (z * 0.3 * tileScale[2] + startZ) - (0.15 * tileScale[2])
                let xmax = (x * 0.3 * tileScale[0] + startX) + (0.15 * tileScale[0])
                let zmax = (z * 0.3 * tileScale[2] + startZ) + (0.15 * tileScale[2])

                //checkpoint
                if (tile.is_checkpoint) {
                    allCheckpointBounds += boundsPart({
                        name: "checkpoint",
                        id: checkId,
                        xmin, zmin, xmax, zmax,
                        y: floorPos
                    });
                    checkId += 1
                }
                //trap
                if (tile.is_black) {
                    //Add bounds to the trap boundaries
                    allTrapBounds += boundsPart({
                        name: "trap",
                        id: trapId,
                        xmin, zmin, xmax, zmax,
                        y: floorPos
                    });
                    trapId += 1
                }
                //goal
                if (tile.is_start) {
                    allGoalBounds += boundsPart({
                        name: "start",
                        id: goalId,
                        xmin, zmin, xmax, zmax,
                        y: floorPos
                    });
                    goalId += 1
                }
                if (tile.is_swamp) {
                    allSwampBounds += boundsPart({
                        name: "swamp",
                        id: swampId,
                        xmin, zmin, xmax, zmax,
                        y: floorPos
                    });
                    swampId +=1
                }
                //Increment id counter
                tileId += 1

                //Human
                if(tile.wall_token_type != 0){
                    //Position of tile
                    let humanPos = [
                        (x * 0.3 * tileScale[0]) + startX ,
                        (z * 0.3 * tileScale[2]) + startZ
                    ]
                    let humanRot = humanRotation[tile.wall_token_place]
                    //Randomly move human left and right on wall
                    let randomOffset = [0, 0]
                    if ((inBounds(z-1, x  ) && tiles[z-1][x  ].wall_token_type == 0) &&  // ensure no adjacent tile victims (random offset can place too close)
                        (inBounds(z+1, x  ) && tiles[z+1][x  ].wall_token_type == 0) && 
                        (inBounds(z  , x-1) && tiles[z  ][x-1].wall_token_type == 0) && 
                        (inBounds(z  , x+1) && tiles[z  ][x+1].wall_token_type == 0)) {
                        if(tile.wall_token_place == HUMAN_PLACE_TOP || tile.wall_token_place == HUMAN_PLACE_BOTTOM){
                            //X offset for top and bottom
                            randomOffset = [orgRound(getRandomArbitrary(-0.1 * tileScale[0], 0.1 * tileScale[0]), 0.001), 0]
                        } else {
                            //Z offset for left and right
                            randomOffset = [0, orgRound(getRandomArbitrary(-0.1 * tileScale[2], 0.1 * tileScale[2]), 0.001)]
                        }
                    }
                    randomOffset=[0,0] //remove random offset because its causing too many issues with CT
                    if (tile.wall_token_type >= 5){ //hazards (includes HUMAN_CT_FAKE=9)
                        humanPos[0] = humanPos[0] + hazardOffset[tile.wall_token_place][0] + randomOffset[0]
                        humanPos[1] = humanPos[1] + hazardOffset[tile.wall_token_place][1] + randomOffset[1]
                        let score = (tile.wall_token_type === HUMAN_CT_FAKE) ? 0 : (tile.is_linear ? 10 : 30)
                        allHazards = allHazards + hazardPart({
                            x: humanPos[0],
                            z: humanPos[1],
                            rot: humanRot,
                            frontRotation: tile.wall_token_front_rot,
                            is_fake: tile.wall_token_is_fake,
                            id: hazardId,
                            type: tile.wall_token_cognitive_code,
                            score: score
                        })
                        hazardId = hazardId + 1
                    } else { //humans
                        humanPos[0] = humanPos[0] + humanOffset[tile.wall_token_place][0] + randomOffset[0]
                        humanPos[1] = humanPos[1] + humanOffset[tile.wall_token_place][1] + randomOffset[1]
                        let score = 15
                        if(tile.is_linear) score = 5
                        if (tile.wall_token_is_fake) {
                            allFakes = allFakes + visualHumanPart({
                                x: humanPos[0],
                                z: humanPos[1],
                                rot: humanRot,
                                frontRotation: tile.wall_token_front_rot,
                                is_fake: tile.wall_token_is_fake,
                                id: humanId,
                                type: humanTypesVisual[tile.wall_token_type - 1],
                                score: 0
                            })
                            fakeHumanId = fakeHumanId + 1
                        } else {
                            allHumans = allHumans + visualHumanPart({
                                x: humanPos[0],
                                z: humanPos[1],
                                rot: humanRot,
                                frontRotation: tile.wall_token_front_rot,
                                is_fake: tile.wall_token_is_fake,
                                id: humanId,
                                type: humanTypesVisual[tile.wall_token_type - 1],
                                score: score
                            })
                            humanId = humanId + 1
                        }
                    }
                }
                if(tile.half_wall_tokens){
                    for (var i in range(16)) {
                        if (tile.half_wall_tokens[i] || (tile.half_wall_tokens_cognitive_codes && tile.half_wall_tokens_cognitive_codes[i])) {
                            let humanType = Number(tile.half_wall_tokens[i]);
                            let humanPos = [(x * 0.3 * tileScale[0]) + startX , (z * 0.3 * tileScale[2]) + startZ]
                            let humanFrontRotation = tile.half_wall_tokens_front_rot[i];
                            console.log("Fakes: ", tile.half_wall_tokens_fakes);
                            let humanIsFake        = tile.half_wall_tokens_fakes[i];
                            console.log("humanIsFake: ", humanIsFake);
                            console.log("i: ", i);
                            if (humanFrontRotation === undefined) humanFrontRotation = 0;
                            let score = 30
                            if(tile.is_linear) score = 10
                            //Curved Wall Humans
                            let curveWallArr = JSON.parse(tile.curved_walls);
                            if (curveWallArr[parseInt(i / 4)]) {
                                let curveDir = curveWallArr[parseInt(i / 4)] - 1;
                                let inside = 0;
                                let ind = parseInt(i / 4) * 4 + curveDir;
                                // if victim is on inside or outside of curve
                                if (!(curveDir == (parseInt(i) + 2) % 4 || curveDir == (parseInt(i) + 1) % 4)) {
                                    console.log("outside");
                                    inside = 1;
                                    curveDir = (curveDir + 2) % 4;
                                } else {
                                    console.log("inside");
                                }
                                if (humanType >= 0 && humanType <= 3) { // is human victim
                                    console.log("HP: " + humanPos);
                                    console.log("Curve Offset: " + curveWallVicPos[ind] + " " + ind + " " + i);
                                    console.log("Curvedir: " + curveDir);
                                    console.log("Inside: " + inside);
                                    console.log("In/Out X: " + humanOffsetCurve[curveDir][0] * inside);
                                    console.log("In/Out Z: " + humanOffsetCurve[curveDir][1] * inside);
                                    console.log("X: " + humanPos[0] + curveWallVicPos[ind][0] + humanOffsetCurve[curveDir][0] * inside);
                                    console.log("Z: " + humanPos[1] + curveWallVicPos[ind][1] + humanOffsetCurve[curveDir][1] * inside);
                                    score = score / 2;
                                    //allHumans = allHumans + visualHumanPart({x: humanPos[0], z: humanPos[1], rot: humanRotationCurve[curveDir], id: humanId, type: humanTypesVisual[walls[z][x][13][i] - 1], score: score})
                                    if (humanIsFake) {
                                        allFakes = allFakes + visualHumanPart({
                                            x: humanPos[0] + curveWallVicPos[ind][0] + humanOffsetCurve[curveDir][0] * inside,
                                            z: humanPos[1] + curveWallVicPos[ind][1] + humanOffsetCurve[curveDir][1] * inside,
                                            rot: humanRotationCurve[curveDir],
                                            frontRotation: humanFrontRotation,
                                            is_fake: humanIsFake,
                                            id: humanId,
                                            type: humanTypesVisual[tile.half_wall_tokens[i] - 1],
                                            score: 0
                                        })
                                        fakeHumanId = fakeHumanId + 1

                                    } else {
                                        allHumans = allHumans + visualHumanPart({
                                            x: humanPos[0] + curveWallVicPos[ind][0] + humanOffsetCurve[curveDir][0] * inside,
                                            z: humanPos[1] + curveWallVicPos[ind][1] + humanOffsetCurve[curveDir][1] * inside,
                                            rot: humanRotationCurve[curveDir],
                                            frontRotation: humanFrontRotation,
                                            is_fake: humanIsFake,
                                            id: humanId,
                                            type: humanTypesVisual[tile.half_wall_tokens[i] - 1],
                                            score: score
                                        })
                                        humanId = humanId + 1
                                    }
                                } else if (humanType >= 5) { // is hazmat sign (includes CTfake=9)
                                    let cogOffsetFactor = inside ? inside : 0.25;
                                    let hazScore = (humanType === HUMAN_CT_FAKE) ? 0 : score;
                                    allHazards = allHazards + hazardPart({
                                        x: humanPos[0] + curveWallVicPos[ind][0] + humanOffsetCurve[curveDir][0] * cogOffsetFactor,
                                        z: humanPos[1] + curveWallVicPos[ind][1] + humanOffsetCurve[curveDir][1] * cogOffsetFactor,
                                        rot: humanRotationCurve[curveDir],
                                        frontRotation: humanFrontRotation,
                                        is_fake: humanIsFake,
                                        id: hazardId,
                                        type: tile.half_wall_tokens_cognitive_codes[i],
                                        score: hazScore
                                    })
                                    hazardId = hazardId + 1
                                } else if (isNaN(humanType) && tile.half_wall_tokens_cognitive_codes[i]) { // invalid CT code (legacy fallback)
                                    let cogOffsetFactor = inside ? inside : 0.25;
                                    allHazards = allHazards + hazardPart({
                                        x: humanPos[0] + curveWallVicPos[ind][0] + humanOffsetCurve[curveDir][0] * cogOffsetFactor,
                                        z: humanPos[1] + curveWallVicPos[ind][1] + humanOffsetCurve[curveDir][1] * cogOffsetFactor,
                                        rot: humanRotationCurve[curveDir],
                                        frontRotation: humanFrontRotation,
                                        is_fake: humanIsFake,
                                        id: hazardId,
                                        type: tile.half_wall_tokens_cognitive_codes[i],
                                        score: 0
                                    })
                                    hazardId = hazardId + 1
                                }
                            }
                            //Half Wall Humans
                            else {
                                if (humanType >= 0 && humanType <= 3) {
                                    score = score / 2;
                                    if (humanIsFake) {
                                        allFakes = allFakes + visualHumanPart({
                                            x: humanPos[0] + halfWallVicPos[i][0] * tileScale[0],
                                            z: humanPos[1] + halfWallVicPos[i][1] * tileScale[2],
                                            rot: humanRotation[i % 4],
                                            frontRotation: humanFrontRotation,
                                            is_fake: humanIsFake,
                                            id: humanId,
                                            type: humanTypesVisual[tile.half_wall_tokens[i] - 1],
                                            score: 0
                                        })
                                        fakeHumanId = fakeHumanId + 1
                                    } else {
                                        allHumans = allHumans + visualHumanPart({
                                            x: humanPos[0] + halfWallVicPos[i][0] * tileScale[0],
                                            z: humanPos[1] + halfWallVicPos[i][1] * tileScale[2],
                                            rot: humanRotation[i % 4],
                                            frontRotation: humanFrontRotation,
                                            is_fake: humanIsFake,
                                            id: humanId,
                                            type: humanTypesVisual[tile.half_wall_tokens[i] - 1],
                                            score: score
                                        })
                                        humanId = humanId + 1
                                    }
                                }
                                else if (humanType >= 5) { // is hazmat sign (includes CTfake=9)
                                    let hazScore = (humanType === HUMAN_CT_FAKE) ? 0 : score;
                                    allHazards = allHazards + hazardPart({
                                        x: humanPos[0] + halfWallVicPos[i][0] * tileScale[0],
                                        z: humanPos[1] + halfWallVicPos[i][1] * tileScale[2],
                                        rot: humanRotation[i % 4],
                                        frontRotation: humanFrontRotation,
                                        is_fake: humanIsFake,
                                        id: hazardId,
                                        type: tile.half_wall_tokens_cognitive_codes[i],
                                        score: hazScore
                                    })
                                    hazardId = hazardId + 1
                                } else if (isNaN(humanType) && tile.half_wall_tokens_cognitive_codes[i]) { // invalid CT code (legacy fallback)
                                    allHazards = allHazards + hazardPart({
                                        x: humanPos[0] + halfWallVicPos[i][0] * tileScale[0],
                                        z: humanPos[1] + halfWallVicPos[i][1] * tileScale[2],
                                        rot: humanRotation[i % 4],
                                        frontRotation: humanFrontRotation,
                                        is_fake: humanIsFake,
                                        id: hazardId,
                                        type: tile.half_wall_tokens_cognitive_codes[i],
                                        score: 0
                                    })
                                    hazardId = hazardId + 1
                                }
                            }
                        }
                    }
                }
                //Obstacle
                if(tile.is_obstacle != 0){
                    //Default height for static obstacle
                    let height = 0.15

                    //Default size contstraints for static obstacle
                    let minSize = 5
                    let maxSize = 15

                    //Generate random size
                    let width = getRandomArbitrary(minSize, maxSize) / 100.0
                    let depth = getRandomArbitrary(minSize, maxSize) / 100.0

                    //Calculate radius of obstacle
                    let r = (((width / 2.0) ** 2) + ((depth / 2.0) ** 2)) ** 0.50

                    //Boundaries of tile to pick
                    console.log(r)
                    let xBounds = [-0.1 + r, 0.1 - r]
                    let zBounds = [-0.1 + r, 0.1 - r]

                    //Get the centre position of the tile
                    let tPos = [(x * 0.3 * tileScale[0]) + startX , (z * 0.3 * tileScale[2]) + startZ]

                    //Get a random position
                    let pos = [orgRound(getRandomArbitrary(xBounds[0], xBounds[1]), 0.00001), orgRound(getRandomArbitrary(zBounds[0], zBounds[1]), 0.00001)]
                    //Offset with tile position
                    pos[0] = pos[0] + tPos[0]
                    pos[1] = pos[1] + tPos[1]

                    //Random rotation for obstacle
                    let rot = orgRound(getRandomArbitrary(0.00, 6.28), 0.001)

                    allObstacles += obstaclePart({
                        id: obstacleId,
                        xSize: width  * tileScale[0],
                        ySize: height * tileScale[1],
                        zSize: depth  * tileScale[2],
                        x: pos[0], y: 0, z: pos[1],
                        rot: rot
                    })
                    //Increment id counter
                    obstacleId = obstacleId + 1

                }
            }
        }

        // area 4 positioning
        if (map.area4Room.value == "Custom Room") {
            allTiles = allTiles + hooks.createArea4Solid();
            map.room4VicTypes = [];
            let scoringElements = hooks.createArea4Victims(humanId, hazardId);
            allHumans += scoringElements[0];
            allHazards += scoringElements[1];
            allFakes += scoringElements[2];
        }
        else {
            room4 = map.area4[map.area4Room.type]
            if (map.area4Room.type != 0 && map.connect14 && map.connect34) {
                connect14 = [(map.connect14[0] - 1) / 2, (map.connect14[1] - 1) / 2]
                connect34 = [(map.connect34[0] - 1) / 2, (map.connect34[1] - 1) / 2]
                area4X = 0
                area4Y = 0
                area4Rot = 0

                area4X = connect14[0]
                area4Y = connect14[1]

                if      (connect34[0] - connect14[0] == room4.room3Tile[0] - room4.room1Tile[0] &&
                         connect34[1] - connect14[1] == room4.room3Tile[1] - room4.room1Tile[1]) area4Rot = DIR_NORTH;
                else if (connect14[0] - connect34[0] == room4.room3Tile[1] - room4.room1Tile[1] &&
                         connect34[1] - connect14[1] == room4.room3Tile[0] - room4.room1Tile[0]) area4Rot = DIR_EAST;
                else if (connect14[0] - connect34[0] == room4.room3Tile[0] - room4.room1Tile[0] &&
                         connect14[1] - connect34[1] == room4.room3Tile[1] - room4.room1Tile[1]) area4Rot = DIR_SOUTH;
                else if (connect34[0] - connect14[0] == room4.room3Tile[1] - room4.room1Tile[1] &&
                         connect14[1] - connect34[1] == room4.room3Tile[0] - room4.room1Tile[0]) area4Rot = DIR_WEST;

                startTrans = vectorRotate(room4.room1Tile, area4Rot)
                area4X -= startTrans[0]
                area4Y -= startTrans[1]
                allTiles = allTiles + area4Part({ roomNum: map.area4Room.type, x: area4X, y: area4Y, rot: area4Rot, width: width, height: height, xScale: tileScale[0], yScale: tileScale[1], zScale: tileScale[2], area4Width: room4.width, area4Height: room4.height})

                area4Width = room4.width
                area4Height = room4.height
                if (area4Rot == DIR_EAST || area4Rot == DIR_WEST) {
                    area4Width = room4.height
                    area4Height = room4.width
                }
                xOffset = -(width  * 0.3 * tileScale[0] / 2.0) + area4X * 0.3 * tileScale[0]
                zOffset = -(height * 0.3 * tileScale[1] / 2.0) + area4Y * 0.3 * tileScale[1]
                area4Humans = room4.humans
                for (i = 0; i < area4Humans.length; i++) {
                    vicPosTrans = vectorRotate([area4Humans[i].x, area4Humans[i].z], area4Rot)
                    thisHuman = {
                        x: vicPosTrans[0] + xOffset,
                        z: vicPosTrans[1] + zOffset,
                        rot: area4Humans[i].rot + area4Rot * -1.57,
                        frontRotation: getRandomAngle(),
                        id: humanId,
                        is_fake: area4Humans[i].is_fake,
                        type: area4Humans[i].type,
                        score: area4Humans[i].score,
                    }
                    if (thisHuman.is_fake) {
                        thisHuman.score = 0;
                        allFakes += visualHumanPart(thisHuman)
                        fakeHumanId += 1
                    } else {
                        allHumans += visualHumanPart(thisHuman)
                        humanId += 1
                    }
                }
                area4Hazards = room4.hazards
                for (i = 0; i < area4Hazards.length; i++) {
                    hazPosTrans = vectorRotate([area4Hazards[i].x, area4Hazards[i].z], area4Rot)
                    thisHazard = {
                        x: hazPosTrans[0] + xOffset,
                        z: hazPosTrans[1] + zOffset,
                        rot: area4Hazards[i].rot + area4Rot * -1.57,
                        frontRotation: getRandomAngle(),
                        id: hazardId,
                        // Erebus 2026 only shows/scores targets whose type is a 5-letter ring code
                        type: randomCognitiveCode(area4Hazards[i].type),
                        score: area4Hazards[i].score,
                    }
                    allHazards += hazardPart(thisHazard)
                    hazardId += 1
                }
            }
        }

        //Add the data pieces to the file data
        fileData = fileData + groupPart({data: allTiles,            name: "WALLTILES"})
        fileData = fileData + groupPart({data: allCheckpointBounds, name: "CHECKPOINTBOUNDS"})
        fileData = fileData + groupPart({data: allTrapBounds,       name: "TRAPBOUNDS"})
        fileData = fileData + groupPart({data: allGoalBounds,       name: "STARTBOUNDS"})
        fileData = fileData + groupPart({data: allSwampBounds,      name: "SWAMPBOUNDS"})
        fileData = fileData + groupPart({data: allObstacles,        name: "OBSTACLES"})
        fileData = fileData + groupPart({data: allHumans,           name: "HUMANGROUP"})
        fileData = fileData + groupPart({data: allFakes,            name: "FAKES"})
        fileData = fileData + groupPart({data: allHazards,          name: "TARGETGROUP"})
        fileData = fileData + supervisorPart({time: map.time})
        return fileData

    }

    // ---- Room 4 presets: where they can go -------------------------------------------------
    // A preset (Erebus Area4_1 / Area4_2) has a fixed size in tiles. The world export anchors it on
    // the 1<->4 passage (green) and turns it so the 3<->4 passage (red) lands on the preset's own
    // entrance (room1Tile / room3Tile). The checks below use the same geometry as the export, so
    // the editor only offers a preset that the export will really place on the room 4 area.
    const PASSAGE_14 = '#08D508';
    const PASSAGE_34 = '#e71a1a';

    function rotateTiles(v, dir) {   // same as vectorRotate in the world export
        switch (dir) {
            case 0: return [v[0], v[1]];
            case 1: return [-v[1], v[0]];
            case 2: return [-v[0], -v[1]];
            case 3: return [v[1], -v[0]];
        }
    }

    // Tiles covered by a preset whose tile 0 is at `origin`, turned by `dir`. Erebus places tiles and
    // the Area4 protos by tile centre and turns Area4 about the centre of its tile 0, so tile indices
    // rotate like points (as in the export).
    function presetBounds(preset, origin, dir) {
        const corners = [[0, 0], [preset.width - 1, 0], [0, preset.height - 1], [preset.width - 1, preset.height - 1]]
            .map(function (c) { return rotateTiles(c, dir); });
        const xs = corners.map(function (c) { return c[0]; });
        const ys = corners.map(function (c) { return c[1]; });
        return {
            minX: origin[0] + Math.min.apply(null, xs), maxX: origin[0] + Math.max.apply(null, xs),
            minY: origin[1] + Math.min.apply(null, ys), maxY: origin[1] + Math.max.apply(null, ys)
        };
    }

    function room4Region(map) {
        const tiles = (map.roomTiles && map.roomTiles[2]) || [];
        if (!tiles.length) return null;
        const pts = tiles.map(function (key) {
            const p = key.split(',').map(Number);
            return [(p[0] - 1) / 2, (p[1] - 1) / 2];
        });
        const xs = pts.map(function (p) { return p[0]; });
        const ys = pts.map(function (p) { return p[1]; });
        const r = { minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys) };
        r.w = r.maxX - r.minX + 1;
        r.h = r.maxY - r.minY + 1;
        r.isRect = new Set(pts.map(function (p) { return p[0] + ',' + p[1]; })).size === r.w * r.h;
        return r;
    }

    function passageTiles(map, color) {
        const found = [];
        Object.keys(map.cells).forEach(function (key) {
            const cell = map.cells[key];
            if (!cell.isTile || !cell.tile || cell.tile.color !== color) return;
            const p = key.split(',').map(Number);
            found.push([(p[0] - 1) / 2, (p[1] - 1) / 2]);
        });
        return found;
    }

    function samePoint(a, b) {
        return a[0] === b[0] && a[1] === b[1];
    }

    function inMap(map, p) {
        return p[0] >= 0 && p[1] >= 0 && p[0] < map.width && p[1] < map.length;
    }

    // Everything the page needs about one preset: can it be chosen, does it fit, where it goes
    function presetStatus(map, preset, region, greens, reds) {
        const status = { size: preset.width + ' × ' + preset.height, sizeOk: false, ok: false, issues: [], candidates: [], placement: null };
        if (!region) { status.issues.push('noRegion'); return status; }
        status.region = region.w + ' × ' + region.h;
        if (!region.isRect) { status.issues.push('notRect'); return status; }
        status.sizeOk = (region.w === preset.width && region.h === preset.height) || (region.w === preset.height && region.h === preset.width);
        if (!status.sizeOk) { status.issues.push('wrongSize'); return status; }

        // Orientations whose footprint is exactly the room 4 area, and the passage tiles they need
        for (let dir = 0; dir < 4; dir++) {
            const b = presetBounds(preset, [0, 0], dir);
            if (b.maxX - b.minX + 1 !== region.w || b.maxY - b.minY + 1 !== region.h) continue;
            const origin = [region.minX - b.minX, region.minY - b.minY];
            const green = [origin[0] + rotateTiles(preset.room1Tile, dir)[0], origin[1] + rotateTiles(preset.room1Tile, dir)[1]];
            const red = [origin[0] + rotateTiles(preset.room3Tile, dir)[0], origin[1] + rotateTiles(preset.room3Tile, dir)[1]];
            if (!inMap(map, green) || !inMap(map, red)) continue;
            status.candidates.push({ dir: dir, origin: origin, green: green, red: red });
        }
        if (!status.candidates.length) { status.issues.push('noRoomForPassages'); return status; }

        if (greens.length !== 1) status.issues.push(greens.length ? 'manyGreen' : 'noGreen');
        if (reds.length !== 1) status.issues.push(reds.length ? 'manyRed' : 'noRed');
        if (greens.length === 1 && reds.length === 1) {
            const match = status.candidates.find(function (c) { return samePoint(c.green, greens[0]) && samePoint(c.red, reds[0]); });
            if (match) status.placement = match;
            else status.issues.push('passageMismatch');
        }
        status.ok = !!status.placement;
        return status;
    }


    // ---- Passages between rooms -----------------------------------------------------------
    // Areas are joined by one-tile passages with a coloured floor (rules 3.3.2 / 3.3.4 / 3.4). Where
    // two different rooms meet, every gap a robot might get through has to be such a passage tile
    // (or be closed by a wall). A passage tile belongs to one of its two rooms and opens onto both,
    // and a room counts as connected once passages link it, directly or through other rooms, to room 1.
    const ROOM_PASSAGES = [
        { color: '#1a1ae6', from: 1, to: 2, name: 'admin.simMapEditor.passageBlue' },
        { color: '#e7e71a', from: 1, to: 3, name: 'admin.simMapEditor.passageYellow' },
        { color: '#08D508', from: 1, to: 4, name: 'admin.simMapEditor.passageGreen' },
        { color: '#4d1a99', from: 2, to: 3, name: 'admin.simMapEditor.passagePurple' },
        { color: '#e7991a', from: 2, to: 4, name: 'admin.simMapEditor.passageOrange' },
        { color: '#e71a1a', from: 3, to: 4, name: 'admin.simMapEditor.passageRed' }
    ];

    // Room number of every tile on the first floor, keyed by tile index "x,y"
    function tileRooms(map) {
        const rooms = {};
        for (let x = 0; x < map.width; x++) for (let y = 0; y < map.length; y++) rooms[x + ',' + y] = 1;
        (map.roomTiles || []).forEach(function (list, i) {
            (list || []).forEach(function (key) {
                const p = key.split(',').map(Number);
                const k = (p[0] - 1) / 2 + ',' + (p[1] - 1) / 2;
                if (p[2] === 0 && k in rooms) rooms[k] = i + 2;
            });
        });
        return rooms;
    }

    function tileNeighbours(k, rooms) {
        const p = k.split(',').map(Number);
        return [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .map(function (d) { return (p[0] + d[0]) + ',' + (p[1] + d[1]); })
            .filter(function (n) { return n in rooms; });
    }

    function tileAt(map, k) {
        const p = k.split(',').map(Number);
        const cell = map.cells[(2 * p[0] + 1) + ',' + (2 * p[1] + 1) + ',0'];
        return cell && cell.tile;
    }

    // ---- Where the robot fits ---------------------------------------------------------------
    // Sizes in cm as built by Erebus: 12 cm tiles, 1 cm walls, and a robot body that is a cylinder
    // of radius 3.7 cm (E-puck-custom-default-FLU.proto). So a half-tile gap (5 cm between the
    // walls) is too narrow, while a whole tile or a half wall next to an open edge is not.
    const TILE_CM = 12, WALL_HALF_CM = 0.5, ROBOT_RADIUS_CM = 3.7;

    // Wall centre lines on the first floor: tile edges, half walls, inner half walls and the
    // quarter-circle walls (radius 6 cm, centred on a corner of their quarter tile)
    function wallShapes(map) {
        const shapes = [];
        const seg = function (x1, y1, x2, y2) { shapes.push({ type: 'seg', x1: x1, y1: y1, x2: x2, y2: y2 }); };
        Object.keys(map.cells).forEach(function (key) {
            const p = key.split(',').map(Number);
            if (p[2] !== 0) return;
            const cell = map.cells[key];
            const ex = p[0], ey = p[1];
            if (ex % 2 === 0 && ey % 2 === 1) {          // vertical edge; half wall 1 = lower half
                if (cell.isWall) seg(6 * ex, 6 * (ey - 1), 6 * ex, 6 * (ey + 1));
                else if (cell.halfWall == 1) seg(6 * ex, 6 * ey, 6 * ex, 6 * (ey + 1));
                else if (cell.halfWall == 2) seg(6 * ex, 6 * (ey - 1), 6 * ex, 6 * ey);
            } else if (ex % 2 === 1 && ey % 2 === 0) {   // horizontal edge; half wall 1 = left half
                if (cell.isWall) seg(6 * (ex - 1), 6 * ey, 6 * (ex + 1), 6 * ey);
                else if (cell.halfWall == 1) seg(6 * (ex - 1), 6 * ey, 6 * ex, 6 * ey);
                else if (cell.halfWall == 2) seg(6 * ex, 6 * ey, 6 * (ex + 1), 6 * ey);
            } else if (ex % 2 === 1 && ey % 2 === 1 && cell.tile) {
                const cx = 6 * ex, cy = 6 * ey;          // tile centre
                const inner = cell.tile.halfWallIn || [];
                if (inner[0]) seg(cx, cy - 6, cx, cy);    // up, right, down, left from the centre
                if (inner[1]) seg(cx, cy, cx + 6, cy);
                if (inner[2]) seg(cx, cy, cx, cy + 6);
                if (inner[3]) seg(cx - 6, cy, cx, cy);
                (cell.tile.curve || []).forEach(function (v, q) {
                    if (!v) return;
                    // quarter tiles NW, NE, SW, SE; the curve value names where the arc bulges, so
                    // its centre is the opposite corner: 1 (NE) -> SW, 2 (SE) -> NW, 3 (SW) -> NE, 4 (NW) -> SE
                    const ox = cx - 6 + (q % 2) * 6, oy = cy - 6 + Math.floor(q / 2) * 6;
                    const c = [[0, 6], [0, 0], [6, 0], [6, 6]][v - 1];
                    if (!c) return;
                    shapes.push({ type: 'arc', cx: ox + c[0], cy: oy + c[1], r: 6, dx: c[0] === 0 ? 1 : -1, dy: c[1] === 0 ? 1 : -1 });
                });
            }
        });
        return shapes;
    }

    function shapeDistance(s, x, y) {
        if (s.type === 'seg') {
            const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
            const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (y - s.y1) * vy) / (vx * vx + vy * vy)));
            return Math.hypot(x - s.x1 - t * vx, y - s.y1 - t * vy);
        }
        // the arc runs from (cx + dx r, cy) to (cx, cy + dy r)
        const px = x - s.cx, py = y - s.cy;
        if (px * s.dx >= 0 && py * s.dy >= 0) return Math.abs(Math.hypot(px, py) - s.r);
        return Math.min(Math.hypot(px - s.dx * s.r, py), Math.hypot(px, py - s.dy * s.r));
    }

    // fits(x, y): whether the robot body fits with its centre at (x, y) cm
    function robotFits(map) {
        const reach = ROBOT_RADIUS_CM + WALL_HALF_CM;
        const buckets = {};
        wallShapes(map).forEach(function (s) {
            const box = s.type === 'seg'
                ? [Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2)]
                : [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
            for (let i = Math.floor((box[0] - reach) / TILE_CM); i <= Math.floor((box[2] + reach) / TILE_CM); i++)
                for (let j = Math.floor((box[1] - reach) / TILE_CM); j <= Math.floor((box[3] + reach) / TILE_CM); j++)
                    (buckets[i + ',' + j] = buckets[i + ',' + j] || []).push(s);
        });
        return function (x, y) {
            const list = buckets[Math.floor(x / TILE_CM) + ',' + Math.floor(y / TILE_CM)] || [];
            return list.every(function (s) { return shapeDistance(s, x, y) >= reach; });
        };
    }

    // Whether the robot can cross the edge between the neighbouring tiles a and b: somewhere on
    // that edge its centre fits between the walls, and neither side is a hole
    function edgePassable(map, a, b, fits) {
        const ta = tileAt(map, a), tb = tileAt(map, b);
        if ((ta && ta.black) || (tb && tb.black)) return false;
        const p = a.split(',').map(Number), q = b.split(',').map(Number);
        for (let d = 0.125; d < TILE_CM; d += 0.25) {
            const x = p[0] === q[0] ? TILE_CM * p[0] + d : TILE_CM * Math.max(p[0], q[0]);
            const y = p[1] === q[1] ? TILE_CM * p[1] + d : TILE_CM * Math.max(p[1], q[1]);
            if (fits(x, y)) return true;
        }
        return false;
    }

    function passageBetween(r1, r2) {
        return ROOM_PASSAGES.find(function (pass) {
            return (pass.from === r1 && pass.to === r2) || (pass.from === r2 && pass.to === r1);
        });
    }

    function connectionStatus(map) {
        const rooms = tileRooms(map);
        const keys = Object.keys(rooms);
        const present = { 1: true };
        keys.forEach(function (k) { present[rooms[k]] = true; });
        const status = { show: false, ok: true, rooms: [], issues: [], marks: {} };
        const fits = robotFits(map);
        // A room 4 preset brings its own walls, open only at its entrances (checked by the preset
        // placement check), so the room 4 border is left to that check
        const presetRoom4 = map.area4Room && map.area4Room.type >= 2;

        // The passage tiles that are placed, and whether each really opens onto its two rooms
        const links = [];
        ROOM_PASSAGES.forEach(function (pass) {
            let missing = 0, misplaced = false;
            keys.forEach(function (k) {
                const tile = tileAt(map, k);
                if (!tile || tile.color !== pass.color) return;
                status.show = true;
                if (!present[pass.from] || !present[pass.to]) {
                    missing = present[pass.from] ? pass.to : pass.from;
                    status.marks[k] = { cls: 'bad' };
                    return;
                }
                const own = rooms[k];
                const other = own === pass.from ? pass.to : pass.from;
                const opens = function (room) {
                    return tileNeighbours(k, rooms).some(function (n) { return rooms[n] === room && edgePassable(map, k, n, fits); });
                };
                if ((own === pass.from || own === pass.to) && opens(own) && opens(other)) links.push(pass);
                else { misplaced = true; status.marks[k] = { cls: 'bad' }; }
            });
            if (missing) status.issues.push({ key: 'passageNoRoom', pass: pass, room: missing });
            if (misplaced) status.issues.push({ key: 'passageMisplaced', pass: pass });
        });

        // Gaps the robot fits through between two different rooms that are not a passage tile of their colour
        const gaps = {};
        const gapRooms = {};
        keys.forEach(function (k) {
            tileNeighbours(k, rooms).forEach(function (n) {
                if (k > n) return;   // each edge once
                const ra = rooms[k], rb = rooms[n];
                if (ra === rb || (presetRoom4 && (ra === 4 || rb === 4)) || !edgePassable(map, k, n, fits)) return;
                const pass = passageBetween(ra, rb);
                const tk = tileAt(map, k), tn = tileAt(map, n);
                if ((tk && tk.color === pass.color) || (tn && tn.color === pass.color)) return;
                if (!gaps[pass.color]) gaps[pass.color] = { key: 'unmarkedGap', pass: pass, count: 0 };
                gaps[pass.color].count++;
                gapRooms[ra] = gapRooms[rb] = true;
                // marked on the side of the higher-numbered room, the room being joined
                const t = ra > rb ? k : n;
                if (!status.marks[t] || status.marks[t].cls === 'hint') status.marks[t] = { cls: 'gap', style: { 'border-color': pass.color } };
            });
        });
        ROOM_PASSAGES.forEach(function (pass) {
            if (gaps[pass.color]) status.issues.push(gaps[pass.color]);
        });

        // Rooms reached from room 1 through the passages
        const reached = { 1: true };
        let grew = true;
        while (grew) {
            grew = false;
            links.forEach(function (l) {
                if (reached[l.from] !== reached[l.to]) { reached[l.from] = reached[l.to] = true; grew = true; }
            });
        }

        [2, 3, 4].forEach(function (room) {
            if (!present[room]) return;
            status.show = true;
            const own = keys.filter(function (k) { return rooms[k] === room; });
            const linked = ROOM_PASSAGES.filter(function (pass) {
                return (pass.from === room || pass.to === room) && links.indexOf(pass) > -1;
            });
            // Passages that could join this room: the rooms it borders, and the tiles on the border
            const options = [];
            ROOM_PASSAGES.forEach(function (pass) {
                if (pass.from !== room && pass.to !== room) return;
                const other = pass.from === room ? pass.to : pass.from;
                if (!present[other]) return;
                const border = own.filter(function (k) {
                    return tileNeighbours(k, rooms).some(function (n) { return rooms[n] === other; });
                });
                if (border.length) options.push({ pass: pass, border: border });
            });
            const entry = { room: room, linked: linked, reached: !!reached[room], gap: !!gapRooms[room], options: options };
            status.rooms.push(entry);
            if (entry.reached) return;
            status.ok = false;
            // Where to put a passage, unless the preset frames or the gap marks already show it
            if ((room === 4 && presetRoom4) || gapRooms[room]) return;
            options.forEach(function (o) {
                o.border.forEach(function (k) {
                    if (!status.marks[k]) status.marks[k] = { cls: 'hint', style: { 'border-color': o.pass.color } };
                });
            });
        });
        if (status.issues.length) status.ok = false;
        return status;
    }


    // For the custom room 4 creator: the map's walls (cm, as for the connection check), its holes
    // and the start, to draw the walls around room 4 and work out where the robot can get to
    function mapGeometry(map) {
        const holes = [];
        Object.keys(map.cells).forEach(function (key) {
            const p = key.split(',').map(Number);
            const cell = map.cells[key];
            if (p[2] === 0 && cell.isTile && cell.tile && cell.tile.black) holes.push([(p[0] - 1) / 2, (p[1] - 1) / 2]);
        });
        const st = map.startTile;
        const hasStart = st && st.z == 0 && st.x > 0 && st.y > 0;
        // Openings of room 4 (no whole wall towards a floor tile outside it, with the passage colour of
        // that tile) and its checkpoint tiles; rule 3.5.3 wants a checkpoint right behind each passage
        const room4 = {};
        ((map.roomTiles && map.roomTiles[2]) || []).forEach(function (key) {
            const p = key.split(',').map(Number);
            if (p[2] === 0) room4[(p[0] - 1) / 2 + ',' + (p[1] - 1) / 2] = true;
        });
        const entrances = [], checkpoints = [];
        Object.keys(room4).forEach(function (k) {
            const t = k.split(',').map(Number);
            const cell = map.cells[(2 * t[0] + 1) + ',' + (2 * t[1] + 1) + ',0'];
            if (cell && cell.tile && cell.tile.checkpoint) checkpoints.push(t);
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
                const nx = t[0] + d[0], ny = t[1] + d[1];
                if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.length || room4[nx + ',' + ny]) return;
                const edge = map.cells[(2 * t[0] + 1 + d[0]) + ',' + (2 * t[1] + 1 + d[1]) + ',0'];
                if (edge && edge.isWall) return;
                const next = map.cells[(2 * nx + 1) + ',' + (2 * ny + 1) + ',0'];
                if (next && next.tile && next.tile.black) return;
                // the colour of the passage to the room on the other side (1-4 green, 2-4 orange,
                // 3-4 red), or of the passage tile itself when there is one
                const tileColor = (next && next.tile && next.tile.color) || '';
                const other = checkRoomNumberKey(map, (2 * nx + 1) + ',' + (2 * ny + 1) + ',0');
                const pass = ROOM_PASSAGES.find(function (p) { return p.from === other && p.to === 4; });
                entrances.push({ tile: t, dir: d, color: tileColor || (pass ? pass.color : ''), passage: !!tileColor,
                    room: other, half: !!(edge && edge.halfWall > 0) });
            });
        });
        return {
            entrances: entrances,
            checkpoints: checkpoints,
            shapes: wallShapes(map),
            holes: holes,
            width: map.width,
            length: map.length,
            start: hasStart ? { x: 6 * st.x, y: 6 * st.y } : null,
            tileCm: TILE_CM,
            wallHalfCm: WALL_HALF_CM,
            robotRadiusCm: ROBOT_RADIUS_CM
        };
    };

    // For the tile dialog: the room of the tile at cell (x, y, z), the other rooms the robot can
    // get to from it, and whether it opens onto its own room. A passage colour can be chosen only
    // where the check would accept it: the tile is in one of the two rooms and the robot can pass
    // from it into both (walls, half walls, curved walls and holes taken into account).
    // Null / always allowed when the check is off or off the first floor.
    function tileRoomInfo(map, x, y, z) {
        if (map.connCheckOff || z != 0) return null;
        const rooms = tileRooms(map);
        const k = (x - 1) / 2 + ',' + (y - 1) / 2;
        if (!(k in rooms)) return null;
        const fits = robotFits(map);
        const borders = [];
        let ownOpen = false;
        tileNeighbours(k, rooms).forEach(function (n) {
            if (!edgePassable(map, k, n, fits)) return;
            if (rooms[n] === rooms[k]) ownOpen = true;
            else if (borders.indexOf(rooms[n]) < 0) borders.push(rooms[n]);
        });
        return { room: rooms[k], borders: borders.sort(), ownOpen: ownOpen };
    };

    function passageAllowed(info, pass) {
        if (!info) return true;
        if (!info.ownOpen || (info.room !== pass.from && info.room !== pass.to)) return false;
        return info.borders.indexOf(info.room === pass.from ? pass.to : pass.from) > -1;
    };

    // Generates a random 5-character CT code from {K,R,Y,G,B} where:
    // K=-2, R=-1, Y=0, G=1, B=2.
    // For F=0, P=1, C=2, O=3: sum of chars equals the target value (valid CT).
    // For X (CTfake): sum must NOT be in [0,3] (invalid CT).
    function randomCognitiveCode(hazardType) {
        const chars  = ['K', 'R', 'Y', 'G', 'B'];
        const values = { 'K': -2, 'R': -1, 'Y': 0, 'G': 1, 'B': 2 };
        if (hazardType === 'X') {
            // CTfake: generate until sum is outside [0, 3]
            while (true) {
                let code = '';
                let sum = 0;
                for (let i = 0; i < 5; i++) {
                    let c = chars[Math.floor(Math.random() * chars.length)];
                    code += c;
                    sum += values[c];
                }
                if (sum < 0 || sum > 3) return code;
            }
        } else {
            const targetSumMap = { 'F': 0, 'P': 1, 'C': 2, 'O': 3 };
            const targetSum = targetSumMap[hazardType];
            while (true) {
                let code = '';
                let sum = 0;
                for (let i = 0; i < 4; i++) {
                    let c = chars[Math.floor(Math.random() * chars.length)];
                    code += c;
                    sum += values[c];
                }
                let needed = targetSum - sum;
                if (needed >= -2 && needed <= 2) {
                    let lastChar = Object.keys(values).find(k => values[k] === needed);
                    return code + lastChar;
                }
                // sum of first 4 chars doesn't allow a valid 5th char, retry
            }
        }
    }

    // Reachable tiles and linear walls from the start tile, as the editor works them out before
    // each export (cell.reachable, cell.isLinear, cell.virtualWall), and the tile arrays the export
    // reads. Creates the tile cells it reaches.
    function recalculate(map) {
        function get_cell(x, y, z) {
            return map.cells[x + ',' + y + ',' + z];
        }

        function set_cell(x, y, z, val) {
            map.cells[x + ',' + y + ',' + z] = val;
        }

        function init_cell(x, y, z) {
            map.cells[x + ',' + y + ',' + z] = {};
        }

        function startNotSet() {
            return map.startTile.x == 0 && map.startTile.y == 0 && map.startTile.z == 0;
        }

        // tag recalculate
        function recalculateLinear() {
            console.log("update");
            //console.log(map.cells)
                //console.log(map.cells);
            if (startNotSet())
                return;
    
            // Reset all previous linear walls
            for (var index in map.cells) {
                map.cells[index].isLinear = false;
                map.cells[index].virtualWall = false;
                map.cells[index].reachable= false;
                map.cells[index].explored= false;
                if (map.cells[index].tile) {
                    if(map.cells[index].tile.curve == undefined)
                        map.cells[index].tile.curve = [0, 0, 0, 0]; //NW quadrant, NE, SW, SE
                    if(map.cells[index].tile.halfWallIn == undefined)
                        map.cells[index].tile.halfWallIn = [0, 0, 0, 0];
                    if(!map.cells[index].tile.halfWallVic)
                        map.cells[index].tile.halfWallVic = [];
                    if(!map.cells[index].tile.halfWallVicRots)
                        map.cells[index].tile.halfWallVicRots = [];
                    if(!map.cells[index].tile.halfWallVicFakes)
                        map.cells[index].tile.halfWallVicFakes = [];
                    if(!map.cells[index].tile.halfWallCognitives)
                        map.cells[index].tile.halfWallCognitives = [];
                }
            }
            
            // Set to virtual wall around the black tile and start tile
            let startTilePosition = map.startTile.x + "," + map.startTile.y + "," + map.startTile.z;
            for (var index in map.cells) {
                if (map.cells[index].tile) {
                    if (map.cells[index].tile.black || index == startTilePosition) {
                        var x = Number(index.split(',')[0]);
                        var y = Number(index.split(',')[1]);
                        var z = Number(index.split(',')[2]);
                        // if(map.cells[x + "," + (y-1) + "," + z]) map.cells[x + "," + (y-1) + "," + z].virtualWall = true;
                        // else map.cells[x + "," + (y-1) + "," + z] = {virtualWall: true};
    
                        if (!get_cell(x,   y-1, z)) init_cell(x,   y-1, z)
                        if (!get_cell(x+1, y,   z)) init_cell(x+1, y,   z)
                        if (!get_cell(x-1, y,   z)) init_cell(x-1, y,   z)
                        if (!get_cell(x,   y+1, z)) init_cell(x,   y+1, z)
    
                        get_cell(x,   y-1, z).virtualWall = true;
                        get_cell(x+1, y,   z).virtualWall = true;
                        get_cell(x-1, y,   z).virtualWall = true;
                        get_cell(x,   y+1, z).virtualWall = true;
    
                    }
                }
            }
    
            // Start it will all 4 walls around the starting tile
    
            recurs(map.startTile.x - 1, map.startTile.y    , map.startTile.z);
            recurs(map.startTile.x + 1, map.startTile.y    , map.startTile.z);
            recurs(map.startTile.x,     map.startTile.y - 1, map.startTile.z);
            recurs(map.startTile.x,     map.startTile.y + 1, map.startTile.z);
    
            //Top Left
            recurs(map.startTile.x-1, map.startTile.y - 2, map.startTile.z);
            recurs(map.startTile.x-2, map.startTile.y - 1, map.startTile.z);
    
            //Top Right
            recurs(map.startTile.x+1, map.startTile.y - 2, map.startTile.z);
            recurs(map.startTile.x+2, map.startTile.y - 1, map.startTile.z);
    
            //Bottom Left
            recurs(map.startTile.x-1, map.startTile.y + 2, map.startTile.z);
            recurs(map.startTile.x-2, map.startTile.y + 1, map.startTile.z);
    
            //Bottom Right
            recurs(map.startTile.x+1, map.startTile.y + 2, map.startTile.z);
            recurs(map.startTile.x+2, map.startTile.y + 1, map.startTile.z);
    
            //Search reachable tiles
            quarterReachable = [];
            reachable(map.startTile.x, map.startTile.y, map.startTile.z);
        }
    
        const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
        let quarterReachable;
    
        function curveBlock(toDir, fromDir, curve) {
            // if continuing straight, any curve wall will block
            // if curve has orientation 2 or 4, the following are blocked:
            //      UP <-> RIGHT, DOWN <-> LEFT 
            //      aka toDir + fromDir == 1 || toDir + fromDir == 5
            // if curve has orientation 1 or 3, the following are blocked:
            //      UP <-> LEFT, DOWN <-> RIGHT
            //      aka toDir + 1 and fromDir + 1 satisfies prev condition 
            const tmpToDir = (toDir + 1) % 4, tmpFromDir = (fromDir + 1) % 4;
            return curve != 0 && ((toDir == (fromDir + 2) % 4) || 
                    (curve % 2 == 0 && (toDir + fromDir == 1 || toDir + fromDir == 5)) || 
                    (curve % 2 == 1 && (tmpToDir + tmpFromDir == 1 || tmpToDir + tmpFromDir == 5)));
        }
    
        function getHalfWall(x, y, z) {
            if (!get_cell(x, y, z)) return 0;
            return get_cell(x, y, z).halfWall;
        }
    
        function getWall(x, y, z) {
            if (!get_cell(x, y, z)) return 0;
            return get_cell(x, y, z).isWall;
        }
    
        function blocked(x, y, z, halfWallSide) {
            return getWall(x,y,z) || getHalfWall(x,y,z) == halfWallSide;
        }
    
        function reachable(x,y,z,i=-1,dir=-1){
            if(x<0 || x>map.width*2 || y<0 || y>map.length*2) return;
            let cell = get_cell(x, y, z);
            if (cell) {
                if (!cell.tile.halfTile) i = -1; // if going from quarter tile to full tile
                if (i == -1 && !cell.tile.halfTile) { // if going from full tile to full tile
                    if (cell.reachable) return;
                    cell.reachable = true;
                } else {
                    const qr = quarterReachable[i+','+x+','+y+','+z];
                    if ((cell.tile.curve[i] == 0 && qr != undefined) ||
                        (cell.tile.curve[i] != 0 && qr != undefined && qr.find((i) => {return i == dir}) != undefined)) return;
    
                    if (qr == undefined)
                        quarterReachable[i+','+x+','+y+','+z] = [dir];
                    else
                        quarterReachable[i+','+x+','+y+','+z].push(dir);
                    cell.reachable = true;
                }
            } else {
                set_cell(x, y, z,
                    {
                        isTile: true,
                        tile: {
                            changeFloorTo: z,
                            halfWallIn: [0,0,0,0],
                            curve: [0,0,0,0]
                        },
                        reachable: true
                    }
                )
            }
            cell = get_cell(x, y, z)
    
            //console.log(`${x},${y},${z}`)
            //console.log(cell)
    
            if (cell.tile.halfTile && i == -1) {
                // check if going from non quarter title to quarter tile
    
                if ((dir == UP && !blocked(x,y-1,z,1)) || dir == -1)
                    reachable(x,y,z,0,UP);
                if ((dir == UP && !blocked(x,y-1,z,2)) || dir == -1)
                    reachable(x,y,z,1,UP);
                if ((dir == RIGHT && !blocked(x+1,y,z,2)) || dir == -1)
                    reachable(x,y,z,1,RIGHT);
                if ((dir == RIGHT && !blocked(x+1,y,z,1)) || dir == -1)
                    reachable(x,y,z,3,RIGHT);
                if ((dir == DOWN && !blocked(x,y+1,z,2)) || dir == -1)
                    reachable(x,y,z,3,DOWN);
                if ((dir == DOWN && !blocked(x,y+1,z,1)) || dir == -1)
                    reachable(x,y,z,2,DOWN);
                if ((dir == LEFT && !blocked(x-1,y,z,1)) || dir == -1)
                    reachable(x,y,z,2,LEFT);
                if ((dir == LEFT && !blocked(x-1,y,z,2)) || dir == -1)
                    reachable(x,y,z,0,LEFT);
            }
            else if (i == -1) {
                // full tile navigation
    
                //Upper
                if(!((map.cells[x+','+(y-1)+','+z] && map.cells[x+','+(y-1)+','+z].isWall))) {
                    reachable(x,y-2,z,-1,DOWN)
                }
    
                //console.log(((cell.tile.halfWallIn[3] || cell.tile.curve[0] || cell.tile.curve[2]) && (cell.tile.halfWallIn[1] || cell.tile.curve[1] || cell.tile.curve[3])))
                //console.log(!((map.cells[x+','+(y+1)+','+z] && map.cells[x+','+(y+1)+','+z].isWall) || ((cell.tile.halfWallIn[3] || cell.tile.curve[0] || cell.tile.curve[2]) && (cell.tile.halfWallIn[1] || cell.tile.curve[1] || cell.tile.curve[3]))))
                //Bottom
                if(!((map.cells[x+','+(y+1)+','+z] && map.cells[x+','+(y+1)+','+z].isWall))) {
                    reachable(x,y+2,z,-1,UP)
                }
    
                //Right
                if(!((map.cells[(x+1)+','+y+','+z] && map.cells[(x+1)+','+y+','+z].isWall))) {
                    reachable(x+2,y,z,-1,LEFT)
                }
    
                //Left
                if(!((map.cells[(x-1)+','+y+','+z] && map.cells[(x-1)+','+y+','+z].isWall))) {
                    reachable(x-2,y,z,-1,RIGHT)
                }
            }
            else {
                //quarter tile navigation
                // +-+-+
                // |a|b|
                // +-+-+    (1 tile)
                // |c|d|
                // +-+-+
                // a: i = 0
                // b: i = 1
                // c: i = 2
                // d: i = 3
    
                // dir represents direction of entry into quarter tile
                // relevant for calculating traversable curved walls
    
                if (i == 0) {
                    if (!(blocked(x,y-1,z,1) || 
                        curveBlock(UP, dir, cell.tile.curve[i])))
                        reachable(x, y-2, z, 2, DOWN);           // up
                    if (!(cell.tile.halfWallIn[UP] ||
                        curveBlock(RIGHT, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 1, LEFT);             // right
                    if (!(cell.tile.halfWallIn[LEFT] ||
                        curveBlock(DOWN, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 2, UP);               // down
                    if (!(blocked(x-1,y,z,2) || 
                        curveBlock(LEFT, dir, cell.tile.curve[i])))
                        reachable(x-2, y, z, 1, RIGHT);          // left
                }
                else if (i == 1) {
                    if (!(blocked(x,y-1,z,2) || 
                        curveBlock(UP, dir, cell.tile.curve[i])))
                        reachable(x, y-2, z, 3, DOWN);
                    if (!(blocked(x+1,y,z,2) || 
                        curveBlock(RIGHT, dir, cell.tile.curve[i])))
                        reachable(x+2, y, z, 0, LEFT);
                    if (!(cell.tile.halfWallIn[RIGHT] ||
                        curveBlock(DOWN, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 3, UP);
                    if (!(cell.tile.halfWallIn[UP] ||
                        curveBlock(LEFT, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 0, RIGHT);
                }
                else if (i == 2) {
                    if (!(cell.tile.halfWallIn[LEFT] ||
                        curveBlock(UP, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 0, DOWN);
                    if (!(cell.tile.halfWallIn[DOWN] ||
                        curveBlock(RIGHT, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 3, LEFT);
                    if (!(blocked(x,y+1,z,1) || 
                        curveBlock(DOWN, dir, cell.tile.curve[i])))
                        reachable(x, y+2, z, 0, UP);
                    if (!(blocked(x-1,y,z,1) || 
                        curveBlock(LEFT, dir, cell.tile.curve[i])))
                        reachable(x-2, y, z, 3, RIGHT);
                }
                else if (i == 3) {
                    if (!(cell.tile.halfWallIn[RIGHT] ||
                        curveBlock(UP, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 1, DOWN);
                    if (!(blocked(x+1,y,z,1) || 
                        curveBlock(RIGHT, dir, cell.tile.curve[i])))
                        reachable(x+2, y, z, 2, LEFT);
                    if (!(blocked(x,y+1,z,2) || 
                        curveBlock(DOWN, dir, cell.tile.curve[i])))
                        reachable(x, y+2, z, 1, UP);
                    if (!(cell.tile.halfWallIn[DOWN] ||
                        curveBlock(LEFT, dir, cell.tile.curve[i])))
                        reachable(x, y, z, 2, RIGHT);
                }
            }
        }
    
    
        function isOdd(num) {
            return num % 2;
        }
    
        function recurs(x, y, z, fromDir=-1) {
            if (x < 0 || y < 0 || z < 0) {
                return;
            }
    
            let cell = get_cell(x, y, z)
    
            // If this is a wall that doesn't exists
            if (!cell)
                return;
            // Outside of the current maze size.
            if (x > map.width  * 2 + 1 || x < 0 ||
                y > map.length * 2 + 1 || y < 0 ||
                z > map.height         || z < 0)
                return;
    
            // Already visited this, returning
            if (cell.isLinear) return;
    
            if (cell.isWall || cell.virtualWall) {
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
                    recurs(x + 2, y, z, 3);
                    recurs(x - 2, y, z, 1);
                    recurs(x - 1, y - 1, z, 2);
                    recurs(x - 1, y + 1, z, 0);
                    recurs(x + 1, y - 1, z, 2);
                    recurs(x + 1, y + 1, z, 0);
                    // Explore the wall in the tile (TOP)
                    exploreWallInTile(x, y - 1, z, 2);
                    // Explore the wall in the tile (BOTTOM)
                    exploreWallInTile(x, y + 1, z, 0);
    
                    checkCurve(x-2, y-1, z, 3);
                    checkCurve(x-2, y+1, z, 1);
                    checkCurve(x+2, y-1, z, 2);
                    checkCurve(x+2, y-1, z, 0);
    
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
                    recurs(x, y - 2, z, 2);
                    recurs(x, y + 2, z, 0);
                    recurs(x - 1, y - 1, z, 1);
                    recurs(x - 1, y + 1, z, 1);
                    recurs(x + 1, y - 1, z, 3);
                    recurs(x + 1, y + 1, z, 3);
                    // Explore the wall in the tile (LEFT)
                    exploreWallInTile(x - 1, y, z, 1)
                    // Explore the wall in the tile (RIGHT)
                    exploreWallInTile(x + 1, y, z, 3)
    
                    checkCurve(x-1, y-2, z, 3);
                    checkCurve(x-1, y+2, z, 1);
                    checkCurve(x+1, y-2, z, 2);
                    checkCurve(x+1, y-2, z, 0);
                }
    
            }
            
            if(cell.halfWall > 0){
                if(fromDir == 4) cell.isLinear = true;
                if(x%2 == 0){
                    // Vertical
                    if(cell.halfWall == 1 && (fromDir == 2 || fromDir == 4)){
                        cell.isLinear = true;
                        recurs(x, y + 2, z, 0);
                        recurs(x + 1, y + 1, z, 3);
                        recurs(x - 1, y + 1, z, 1);
                        
                        // Explore the wall in the tile (LEFT)
                        exploreWallInTile(x - 1, y, z, 1)
                        // Explore the wall in the tile (RIGHT)
                        exploreWallInTile(x + 1, y, z, 3)
    
                        curveFromHalfWall(x-1, y, z, 1)
                        curveFromHalfWall(x+1, y, z, 3)
                    }else if(cell.halfWall == 2 && (fromDir == 0 || fromDir == 4)){
                        cell.isLinear = true;
                        recurs(x, y - 2, z, 2);
                        recurs(x + 1, y - 1, z, 3);
                        recurs(x - 1, y - 1, z, 1);
                        
                        // Explore the wall in the tile (LEFT)
                        exploreWallInTile(x - 1, y, z, 1)
                        // Explore the wall in the tile (RIGHT)
                        exploreWallInTile(x + 1, y, z, 3)
    
                        curveFromHalfWall(x-1, y, z, 1)
                        curveFromHalfWall(x+1, y, z, 3)
                    }
                }else{
                    // Horizontal
                    if(cell.halfWall == 1 && (fromDir == 3 || fromDir == 4)){
                        cell.isLinear = true;
                        recurs(x - 2, y, z, 1);
                        recurs(x - 1, y - 1, z, 2);
                        recurs(x - 1, y + 1, z, 0);              
                        // Explore the wall in the tile (TOP)
                        exploreWallInTile(x, y - 1, z, 2)
                        // Explore the wall in the tile (BOTTOM)
                        exploreWallInTile(x, y + 1, z, 0)
    
                        curveFromHalfWall(x, y-1, z, 2)
                        curveFromHalfWall(x, y+1, z, 0)
                    }else if(cell.halfWall == 2 && (fromDir == 1 || fromDir == 4)){
                        cell.isLinear = true;
                        recurs(x + 2, y, z, 3);
                        recurs(x + 1, y - 1, z, 2);
                        recurs(x + 1, y + 1, z, 0);
                        // Explore the wall in the tile (TOP)
                        exploreWallInTile(x, y - 1, z, 2)
                        // Explore the wall in the tile (BOTTOM)
                        exploreWallInTile(x, y + 1, z, 0)
    
                        curveFromHalfWall(x, y-1, z, 2)
                        curveFromHalfWall(x, y+1, z, 0)
                    }
                }
            }
        }
    
        function checkCurve(x, y, z, from){
            let cell = get_cell(x, y, z)
    
            // If this is a wall that doesn't exists
            if (!cell) return;
            if (!cell.tile) return;
            if (!cell.tile.curve) return;
    
            switch(from){
                case 0:
                    if(cell.tile.curve[0] == 1 || cell.tile.curve[2] == 3){
                        halfTileFromCenter(x, y, z);
                        curveFromCenter(x, y, z, from);
                    }
                    break;
                case 1:
                    if(cell.tile.curve[1] == 2 || cell.tile.curve[1] == 4){
                        halfTileFromCenter(x, y, z);
                        curveFromCenter(x, y, z, from);
                    }
                    break;
                case 2:
                    if(cell.tile.curve[2] == 2 || cell.tile.curve[2] == 4){
                        halfTileFromCenter(x, y, z);
                        curveFromCenter(x, y, z, from);
                    }
                    break;
                case 3:
                    if(cell.tile.curve[3] == 1 || cell.tile.curve[3] == 3){
                        halfTileFromCenter(x, y, z);
                        curveFromCenter(x, y, z, from);
                    }
                    break;
            }
        }
    
        function exploreWallInTile(x, y, z, fromDir){
            if (x < 0 || y < 0 || z < 0) {
                return;
            }
            
            let cell = get_cell(x, y, z)
    
            // If this is a wall that doesn't exists
            if (!cell) return;
    
            if(!cell.tile) return;
            if(!cell.tile.halfWallIn) return;
            if(!cell.tile.halfWallIn[fromDir]) return;
            if(cell.explored) return;
            else cell.explored = true;
            
            halfTileFromCenter(x, y, z, fromDir);
            curveFromCenter(x, y, z);
        }
    
        function halfTileFromCenter(x, y, z, exclude=-1){
            let cell = get_cell(x, y, z)
    
            // If this is a wall that doesn't exists
            if (!cell) return;
    
            for(let i=0; i<4; i++){
                if(cell.tile.halfWallIn[i] && i != exclude){
                    switch(i){
                        case 0:
                            setTileLinear(x, y - 2, z);
                            recurs(x, y - 1, z, 4);
                            exploreWallInTile(x, y - 2, z, 2)
                            break;
                        case 1:
                            setTileLinear(x + 2, y, z);
                            recurs(x + 1, y, z, 4);
                            exploreWallInTile(x + 2, y, z, 3);
                            break;
                        case 2:
                            setTileLinear(x, y + 2, z);
                            recurs(x, y + 1, z, 4);
                            exploreWallInTile(x, y + 2, z, 0);
                            break;
                        case 3:
                            setTileLinear(x - 2, y, z);
                            recurs(x - 1, y, z, 4);
                            exploreWallInTile(x - 2, y, z, 1);
                            break;
                    }
    
                }
            }
        }
    
        function curveFromHalfWall(x, y, z, start){
            let cell = get_cell(x, y, z)
            // If this is a wall that doesn't exists
            if (!cell) return;
    
            switch(start){
                case 0:
                    if(cell.tile.curve[0] == 2 || cell.tile.curve[0] == 4){
                        recurs(x-1, y, z, 4);
                        setTileLinear(x-2, y, z);
                    }
                    if(cell.tile.curve[1] == 1 || cell.tile.curve[1] == 3){
                        recurs(x+1, y, z, 4);
                        setTileLinear(x+2, y, z);
                    }
                    break;
                case 1:
                    if(cell.tile.curve[3] == 2 || cell.tile.curve[3] == 4){
                        recurs(x, y+1, z, 4);
                        setTileLinear(x, y+2, z);
                    }
                    if(cell.tile.curve[1] == 1 || cell.tile.curve[1] == 3){
                        recurs(x, y-1, z, 4);
                        setTileLinear(x, y-2, z);
                    }
                    break;
                case 2:
                    if(cell.tile.curve[3] == 2 || cell.tile.curve[3] == 4){
                        recurs(x+1, y, z, 4);
                        setTileLinear(x+2, y, z);
                    }
                    if(cell.tile.curve[2] == 1 || cell.tile.curve[2] == 3){
                        recurs(x-1, y, z, 4);
                        setTileLinear(x-2, y, z);
                    }
                    break;
                case 3:
                    if(cell.tile.curve[0] == 2 || cell.tile.curve[0] == 4){
                        recurs(x, y-1, z, 4);
                        setTileLinear(x, y-2, z);
                    }
                    if(cell.tile.curve[2] == 1 || cell.tile.curve[2] == 3){
                        recurs(x, y+1, z, 4);
                        setTileLinear(x, y+2, z);
                    }
                    break;
            }
        }
    
        function curveFromCenter(x, y, z, exclude=-1){
            let cell = get_cell(x, y, z)
            // If this is a wall that doesn't exists
            if (!cell) return;
            if((cell.tile.curve[0] == 1 || cell.tile.curve[0] == 3) && exclude != 0){
                // to TOP LEFT
                recurs(x - 1, y-2, z, 2);
                recurs(x - 1, y, z, 0);
                recurs(x - 2, y-1, z, 1);
                recurs(x, y-1, z, 3);
                setTileLinear(x, y-2, z);
                setTileLinear(x-2, y-2, z);
                setTileLinear(x-2, y, z);
            }
            if((cell.tile.curve[1] == 2 || cell.tile.curve[1] == 4) && exclude != 1){
                // to TOP RIGHT
                recurs(x + 1, y-2, z, 2);
                recurs(x + 1, y, z, 0);
                recurs(x + 2, y-1, z, 3);
                recurs(x, y-1, z, 1);
                setTileLinear(x, y-2, z);
                setTileLinear(x+2, y-2, z);
                setTileLinear(x+2, y, z);
            }
            if((cell.tile.curve[3] == 1 || cell.tile.curve[3] == 3) && exclude != 3){
                // to BOTTOM RIGHT
                recurs(x + 1, y+2, z, 0);
                recurs(x + 1, y, z, 2);
                recurs(x + 2, y+1, z, 3);
                recurs(x, y+1, z, 1);
                setTileLinear(x+2, y, z);
                setTileLinear(x+2, y+2, z);
                setTileLinear(x, y+2, z);
            }
            if((cell.tile.curve[2] == 2 || cell.tile.curve[2] == 4) && exclude != 2){
                // to BOTTOM LEFT
                recurs(x - 1, y+2, z, 0);
                recurs(x - 1, y, z, 2);
                recurs(x - 2, y+1, z, 1);
                recurs(x, y+1, z, 3);
                setTileLinear(x-2, y, z);
                setTileLinear(x-2, y+2, z);
                setTileLinear(x, y+2, z);
            }
        }
    
        function setTileLinear(x, y, z) {
            if (x < 0 || y < 0 || z < 0) {
                return;
            }
    
            // Check that this is an actual tile, not a wall
            var cell = get_cell(x, y, z)
            if (cell) {
                cell.isLinear = true;
            } else {
                set_cell(x, y, z, {
                    isTile: true,
                    isLinear: true,
                    tile: {
                        changeFloorTo: z
                    }
                })
            }
        }

        return recalculateLinear();
    }

    const api = {
        recalculate: recalculate,
        HUMAN_PLACE_TOP: HUMAN_PLACE_TOP,
        HUMAN_PLACE_RIGHT: HUMAN_PLACE_RIGHT,
        HUMAN_PLACE_BOTTOM: HUMAN_PLACE_BOTTOM,
        HUMAN_PLACE_LEFT: HUMAN_PLACE_LEFT,
        HUMAN_NONE: HUMAN_NONE,
        HUMAN_H: HUMAN_H,
        HUMAN_U: HUMAN_U,
        HUMAN_S: HUMAN_S,
        HUMAN_F: HUMAN_F,
        HUMAN_P: HUMAN_P,
        HUMAN_C: HUMAN_C,
        HUMAN_O: HUMAN_O,
        HUMAN_CT_FAKE: HUMAN_CT_FAKE,
        PASSAGE_14: PASSAGE_14,
        PASSAGE_34: PASSAGE_34,
        ROOM_PASSAGES: ROOM_PASSAGES,
        TILE_CM: TILE_CM,
        WALL_HALF_CM: WALL_HALF_CM,
        ROBOT_RADIUS_CM: ROBOT_RADIUS_CM,
        area4Presets: area4Presets,
        getRandomAngle: getRandomAngle,
        checkRoomNumber: checkRoomNumber,
        checkRoomNumberKey: checkRoomNumberKey,
        checkForExternalWalls: checkForExternalWalls,
        checkForNotch: checkForNotch,
        is_truthy: is_truthy,
        getRandomArbitrary: getRandomArbitrary,
        orgRound: orgRound,
        normalize_quaternion: normalize_quaternion,
        multiply_quaternions: multiply_quaternions,
        axis_angle_to_quaternion: axis_angle_to_quaternion,
        quaternion_to_axis_angle: quaternion_to_axis_angle,
        calculateWallTokenRot: calculateWallTokenRot,
        human_str_to_type: human_str_to_type,
        cognitive_string_to_hazmat: cognitive_string_to_hazmat,
        cognitiveCodeToVictimLetter: cognitiveCodeToVictimLetter,
        createWorld: createWorld,
        presetBounds: presetBounds,
        room4Region: room4Region,
        passageTiles: passageTiles,
        samePoint: samePoint,
        inMap: inMap,
        presetStatus: presetStatus,
        tileRooms: tileRooms,
        tileNeighbours: tileNeighbours,
        tileAt: tileAt,
        wallShapes: wallShapes,
        shapeDistance: shapeDistance,
        robotFits: robotFits,
        edgePassable: edgePassable,
        passageBetween: passageBetween,
        connectionStatus: connectionStatus,
        mapGeometry: mapGeometry,
        tileRoomInfo: tileRoomInfo,
        passageAllowed: passageAllowed,
        randomCognitiveCode: randomCognitiveCode,
        area4Presets: area4Presets,
        noRandom: noRandom
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SimWorld2026 = api;
})(typeof window !== 'undefined' ? window : globalThis);
