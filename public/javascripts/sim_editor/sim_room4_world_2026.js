// Custom room 4 in the world export of the Simulation 2026 editor: walls and wall tokens read from
// the room 4 picture with OpenCV (browser only). Shared with the new editor (beta).
// SimRoom4World2026.create(map) gives { createArea4Solid, createArea4Victims, room4CorrectSize } for a
// map as the editor holds it, with room4Img (an Image of room4CanvasSave, loaded) and canvasWidth /
// canvasHeight; they go to SimWorld2026.createWorld as its hooks.
var SimRoom4World2026 = (function () {
    const W = SimWorld2026;
    const calculateWallTokenRot = W.calculateWallTokenRot;
    const getRandomAngle = W.getRandomAngle;
    const randomCognitiveCode = W.randomCognitiveCode;

    function create(map) {
        function wallShapes() {
            return W.wallShapes(map);
        }

        // The turn / ring code kept for the stamp whose centre is (cx, cy) picture pixels: the entry of
        // map.room4Tokens ({fx, fy} = fractions of the picture) nearest to it, within a stamp's reach
        function tokenMeta(cx, cy) {
            const list = map.room4Tokens || [];
            const w = map.room4Img.naturalWidth || map.room4Img.width, h = map.room4Img.naturalHeight || map.room4Img.height;
            const reach = Math.max(w, h) / 40;
            let best = null, bestD = reach;
            list.forEach(function (t) {
                const d = Math.hypot(t.fx * w - cx, t.fy * h - cy);
                if (d < bestD) { bestD = d; best = t; }
            });
            return best;
        }

        // A kept ring code, when it is of the type of the stamp (F P C O, or X for a fake target)
        function metaCode(meta, type) {
            if (!meta || !meta.code || !/^[KRYGB]{5}$/.test(meta.code)) return null;
            const letter = W.cognitiveCodeToVictimLetter(meta.code) || 'X';
            return letter === type ? meta.code : null;
        }

    // tag custom room 4
    function room4CorrectSize() {
        return true;
        //let img = cv.imread(imgElement);

        let context = room4CanvasSave.getContext('2d');
        let imgData = context.getImageData(0, 0, canvasWidth, canvasHeight);
        let img = cv.matFromImageData(imgData); 

        let minX = -1;
        let maxX = 0;
        let minY = -1;
        let maxY = 0;
        let width = 0;
        let height = 0;
        
        for (let i = 0; i < map.roomTiles[2].length; i++) {
            let tileStr = map.roomTiles[2][i];
            let x = tileStr.slice(0, tileStr.indexOf(","));
            let y = tileStr.slice(tileStr.indexOf(",")+1, tileStr.lastIndexOf(","));
            if (x < minX || minX == -1)
                minX = x;
            if (x > maxX)
                maxX = x;
            if (y < minY || minY == -1)
                minY = y;
            if (y > maxY)
                maxY = y;
        }

        width = (maxX - minX) / 2 + 1;
        height = (maxY - minY) / 2 + 1;
        if (width / height != img.size().width / img.size().height)
            return false;
        return true;
    }

    function has(contPoints, x, y) {
        for (let i = 0; i < contPoints.length; i++) {
        let compX = contPoints[i][0];
        let compY = contPoints[i][1];

        // Complete equality
        /* if (compX == x && compY == y)
            return true; */

        // proximity
        let dist = 0.002;
        if (Math.pow(compX - x, 2) + Math.pow(compY - y, 2) < Math.pow(dist, 2))
            return true;

        // single-axis proximity
        /* let dist = 0.0005;
        if (Math.abs(compX - x) < dist || Math.abs(compY - y) < dist)
            return true; */
        }
        return false;
    }

    let room4xOffset = 0;
    let room4zOffset = 0;
    let fullContPoints = [];
    let imgWidth = 0;
    let imgHeight = 0;
    let room4Width = 0;
    let room4Height = 0;
    let roundDigits = 5;

    function createArea4Solid() {
        let minX = -1;
        let maxX = 0;
        let minY = -1;
        let maxY = 0;
        
        for (let i = 0; i < map.roomTiles[2].length; i++) {
            let tileStr = map.roomTiles[2][i];
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

        //let src = cv.imread(imgElement);
        /*let context = map.room4CanvasSave.getContext('2d');
        let imgData = context.getImageData(0, 0, map.canvasWidth, map.canvasHeight);
        let src = cv.matFromImageData(imgData);*/
        let src = cv.imread(map.room4Img);

        let im = new cv.Mat();

        let blackLow = new cv.Mat(src.rows, src.cols, src.type(), [0, 0, 0, 0]);
        let blackHigh = new cv.Mat(src.rows, src.cols, src.type(), [50, 50, 50, 255]);
        cv.inRange(src, blackLow, blackHigh, im);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(
            im,
            contours,
            hierarchy,
            cv.RETR_EXTERNAL,
            cv.CHAIN_APPROX_SIMPLE
        );

        let mazeWidthScale = 0.4;
        let mazeHeightScale = 0.4;
        let wallHeight = 0.06;
        let outputStr = "";
        imgWidth = src.size().width;
        imgHeight = src.size().height;
        room4Width *= 0.3 * mazeWidthScale;
        room4Height *= 0.3 * mazeHeightScale;

        let xStart = -((map.width / 2.0) + 0.5) * (0.3 * mazeWidthScale);
        let zStart = -((map.length / 2.0) + 0.5) * (0.3 * mazeHeightScale);
        let xRelPos = x * 0.3 * mazeWidthScale;
        let zRelPos = y * 0.3 * mazeHeightScale;
        let xCoord = xRelPos + xStart;
        let zCoord = zRelPos + zStart;
        zCoord -= 0.005;

        room4xOffset = xCoord;
        room4zOffset = zCoord;
        outputStr += `Solid {\n
                translation ` + xCoord.toString() + ' -0.03 ' + zCoord.toString() + `\n
                rotation 0 1 0 0\n
                name "Area4"\n
                children [\n
            `;

        fullContPoints = [];
        for (let i = 0; i < contours.size(); i++) {
            outputStr +=
                "Solid {\n children [\n DEF CURVED" + String(i) + " Shape { \nappearance Appearance { \nmaterial Material { \ndiffuseColor 0.2 0.47 0.52 \n} \n}\ngeometry IndexedFaceSet { \ncoord Coordinate { \npoint [\n";

            let contour = contours.get(i);
            let points = contour.data32S;
            let contPoints = [];
            fullContPoints.push([]);

            for (let j = 0; j < points.length; j += 2) {
                let row = points[j + 1];
                let col = points[j];
                let x = ((col / imgWidth) * room4Width).toFixed(roundDigits);
                let y = ((row / imgHeight) * room4Height).toFixed(roundDigits);

                if (!has(contPoints, x, y)) {
                    outputStr += x.toString() + " " + "0" + " " + y.toString() + ",";
                    outputStr +=
                        x.toString() + " " + wallHeight + " " + y.toString() + ",";
                    contPoints.push([x, y]);
                    fullContPoints[i].push([row, col]);
                }
            }

            outputStr += "\n]\n}\ncoordIndex [\n";
            for (let j = 0; j < contPoints.length - 1; j++) {
                outputStr +=
                (j * 2).toString() + "," +
                ((j + 1) * 2).toString() + "," +
                ((j + 1) * 2 + 1).toString() + "," +
                (j * 2 + 1).toString() + "," +
                "-1,";
            }
            let tmp = contPoints.length - 1;
            outputStr +=
                (tmp * 2).toString() + "," +
                "0" + "," +
                "1" + "," +
                (tmp * 2 + 1).toString() + "," +
                "-1,";
            for (let j = 0; j < contPoints.length; j++)
                outputStr += (j * 2 + 1).toString() + ",";
            outputStr += "-1,\n]\n}\n}\n]\n" +
                            "boundingObject USE CURVED" + String(i) + 
                            "\nname \"curved" + String(i) + "\"\n}";
        }
        outputStr += '\n]\n}\n';

        // Victims of the picture can also stand on the map's own walls around room 4 (the creator
        // lets them attach there), so those walls join the outlines the victims look for
        fullContPoints = fullContPoints.concat(mapWallRings(x * 12, y * 12, imgWidth / (room4Width * 100), imgWidth, imgHeight));

        return outputStr;
    }

    // Outlines (as [row, col] picture pixels) of the map walls that reach into the room 4 picture: each
    // wall as the loop around its two faces, 1 cm apart, like the outline of a wall drawn in the picture
    function mapWallRings(x0cm, y0cm, pxPerCm, imgW, imgH) {
        const rings = [];
        const half = W.WALL_HALF_CM;
        const toPx = function (p) { return [(p[1] - y0cm) * pxPerCm, (p[0] - x0cm) * pxPerCm]; };
        const inside = function (pts) {
            return pts.some(function (q) { return q[0] >= -2 && q[1] >= -2 && q[0] <= imgH + 2 && q[1] <= imgW + 2; });
        };
        const step = Math.max(0.25, 2 / pxPerCm);   // about every 2 px
        wallShapes().forEach(function (sh) {
            const loop = [];
            if (sh.type === 'seg') {
                const len = Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1);
                if (!len) return;
                const nx = -(sh.y2 - sh.y1) / len * half, ny = (sh.x2 - sh.x1) / len * half;
                const n = Math.max(1, Math.ceil(len / step));
                for (let i = 0; i <= n; i++) loop.push([sh.x1 + (sh.x2 - sh.x1) * i / n + nx, sh.y1 + (sh.y2 - sh.y1) * i / n + ny]);
                for (let i = n; i >= 0; i--) loop.push([sh.x1 + (sh.x2 - sh.x1) * i / n - nx, sh.y1 + (sh.y2 - sh.y1) * i / n - ny]);
            } else {
                const a1 = sh.dx > 0 ? 0 : Math.PI, a2 = sh.dy > 0 ? Math.PI / 2 : -Math.PI / 2;
                let diff = a2 - a1;
                while (diff <= -Math.PI) diff += 2 * Math.PI;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                const n = Math.max(4, Math.ceil(Math.abs(diff) * (sh.r + half) / step));
                for (let i = 0; i <= n; i++) {
                    const ang = a1 + diff * i / n;
                    loop.push([sh.cx + Math.cos(ang) * (sh.r + half), sh.cy + Math.sin(ang) * (sh.r + half)]);
                }
                for (let i = n; i >= 0; i--) {
                    const ang = a1 + diff * i / n;
                    loop.push([sh.cx + Math.cos(ang) * (sh.r - half), sh.cy + Math.sin(ang) * (sh.r - half)]);
                }
            }
            const px = loop.map(toPx);
            if (inside(px)) rings.push(px);
        });
        return rings;
    }

    function dist(point1, point2) {
        return Math.sqrt(Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2));
    }



    function createArea4Victims(startHumanId, startHazardId) {
        let outputStrVic = "";
        let outputStrHaz = "";
        let outputStrFake = "";
        const scoringTypes = [
            { type: "harmed",   weight: 1/11, category: "victim" },
            { type: "stable",   weight: 1/11, category: "victim" },
            { type: "unharmed", weight: 1/11, category: "victim" },
            { type: "P",        weight: 1/11, category: "hazard" },
            { type: "O",        weight: 1/11, category: "hazard" },
            { type: "F",        weight: 1/11, category: "hazard" },
            { type: "C",        weight: 1/11, category: "hazard" },
            { type: "X",        weight: 1/11, category: "hazard" },
            { type: "psi",      weight: 1/11, category: "fake"   },
            { type: "phi",      weight: 1/11, category: "fake"   },
            { type: "omega",    weight: 1/11, category: "fake"   },
        ];
        function weightedRandomType() {
            let r = Math.random();
            let cumulative = 0;
            for (let i = 0; i < scoringTypes.length; i++) {
                cumulative += scoringTypes[i].weight;
                if (r < cumulative) return i;
            }
            return scoringTypes.length - 1;
        }

        // let src = cv.imread(imgElement);
        /*let context = map.room4CanvasSave.getContext('2d');
        let imgData = context.getImageData(0, 0, map.canvasWidth, map.canvasHeight);
        let src = cv.matFromImageData(imgData);*/
        let src = cv.imread(map.room4Img);

        let vicIm = new cv.Mat()
        let low = new cv.Mat(src.rows, src.cols, src.type(), [100, 0, 0, 0]);
        let high = new cv.Mat(src.rows, src.cols, src.type(), [255, 50, 50, 255]);
        cv.inRange(src, low, high, vicIm);

        let vicContours = new cv.MatVector();
        let vicHierarchy = new cv.Mat();
        cv.findContours(
            vicIm,
            vicContours,
            vicHierarchy,
            cv.RETR_EXTERNAL,
            cv.CHAIN_APPROX_SIMPLE
        );

        map.area4VicScore = 0;
        // A stamp carries its type (SimRoom4); other tokens keep the random type they got before
        const keepTypes = map.room4VicTypes.length === vicContours.size();
        if (!keepTypes)
            map.room4VicTypes = []
        for (let x = 0; x < vicContours.size(); x++) {
            let M = cv.moments(vicContours.get(x), false);
            let cx = M.m10/M.m00;
            let cy = M.m01/M.m00;
            let point = [cy, cx];

            let closePoint = [0, 0];
            let closeDist = -1;
            let closeIndex = [0, 0];

            for (let i = 0; i < fullContPoints.length; i++) {
                for (let j = 0; j < fullContPoints[i].length; j++) {
                    let curDist = dist(fullContPoints[i][j], point);
                    if (curDist < closeDist || closeDist == -1) {
                        closePoint = fullContPoints[i][j];
                        closeDist = curDist;
                        closeIndex = [i, j];
                    }
                }
            }

            // what the creator kept for the stamp here (map.room4Tokens: turn in degrees, ring code)
            const meta = tokenMeta(cx, cy);

            let vicWidth = 0.016;
            let angle = 0;
            let frontAngle = meta && meta.rot !== null && meta.rot !== undefined ? Number(meta.rot) * Math.PI / 180 : getRandomAngle();
            let nextPoint = 0;
            let prevPoint = 0;

            let npInd = [closeIndex[0], closeIndex[1]];
            let ppInd = [closeIndex[0], closeIndex[1]];
            vicWidth = vicWidth * imgWidth / room4Width;
            // walk both ways along the outline until the two ends are a victim width apart (at most once
            // round, so a short outline cannot keep it going)
            let walk = fullContPoints[closeIndex[0]].length;
            while (walk-- > 0 && dist(fullContPoints[npInd[0]][npInd[1]], fullContPoints[ppInd[0]][ppInd[1]]) < vicWidth) {
                if (ppInd[1] == 0) {
                    ppInd[1] = fullContPoints[ppInd[0]].length - 1;
                    npInd[1] += 1;
                }
                else if (npInd[1] == fullContPoints[npInd[0]].length - 1) {
                    ppInd[1] -= 1;
                    npInd[1] = 0;
                }
                else {
                    ppInd[1] -= 1;
                    npInd[1] += 1;
                }
            }
            
            let midPoint = [(fullContPoints[ppInd[0]][ppInd[1]][0] + fullContPoints[npInd[0]][npInd[1]][0]) / 2,
                            (fullContPoints[ppInd[0]][ppInd[1]][1] + fullContPoints[npInd[0]][npInd[1]][1]) / 2]
            if (dist(midPoint, point) > dist(closePoint, point)) { // convex wall
                if (closeIndex[1] == 0) {
                    nextPoint = fullContPoints[closeIndex[0]][closeIndex[1]+1];
                    prevPoint = fullContPoints[closeIndex[0]][fullContPoints[closeIndex[0]].length-1];
                }
                else if (closeIndex[1] == fullContPoints[closeIndex[0]].length-1) {
                    nextPoint = fullContPoints[closeIndex[0]][0];
                    prevPoint = fullContPoints[closeIndex[0]][closeIndex[1]-1];
                }
                else {
                    nextPoint = fullContPoints[closeIndex[0]][closeIndex[1]+1];
                    prevPoint = fullContPoints[closeIndex[0]][closeIndex[1]-1];
                }
            }
            else { // concave wall
                nextPoint = fullContPoints[npInd[0]][npInd[1]] // (y, x), i.e. (row, col)
                prevPoint = fullContPoints[ppInd[0]][ppInd[1]]
                closePoint = midPoint;
            }

            angle = Math.atan(-1*(prevPoint[0] - nextPoint[0]) / (prevPoint[1] - nextPoint[1])); // times -1 because axis different
            if (prevPoint[1] - nextPoint[1] < 0)
                angle = 3.14 + angle

            finalAngles = calculateWallTokenRot(angle, frontAngle);

            // Push closePoint slightly into the room (toward the blob centroid)
            // to avoid signs clipping inside the wall.
            // vicWidth is in pixels at this point (~1 victim width away from wall surface).
            let offsetPx = vicWidth * 0.1;
            let dRow = point[0] - closePoint[0];
            let dCol = point[1] - closePoint[1];
            let dLen = Math.sqrt(dRow * dRow + dCol * dCol);
            let shiftedPoint = closePoint;
            if (dLen > 0) {
                shiftedPoint = [
                    closePoint[0] + (dRow / dLen) * offsetPx,
                    closePoint[1] + (dCol / dLen) * offsetPx
                ];
            }

            let vicX = parseFloat(((shiftedPoint[1] / imgWidth) * room4Width).toFixed(roundDigits)) + room4xOffset;
            let vicY = parseFloat(((shiftedPoint[0] / imgHeight) * room4Height).toFixed(roundDigits)) + room4zOffset;

            let randIdx = SimRoom4.contourType(src, vicContours.get(x));
            if (!scoringTypes[randIdx]) {
                if (!keepTypes || !scoringTypes[map.room4VicTypes[x]]) {
                    if (W.noRandom())
                        randIdx = parseInt(0.5 * scoringTypes.length);
                    else
                        randIdx = weightedRandomType();
                } else {
                    randIdx = map.room4VicTypes[x];
                    // Re-roll if cached index maps to a disabled type (weight 0)
                    if (scoringTypes[randIdx].weight === 0)
                        randIdx = weightedRandomType();
                }
            }
            map.room4VicTypes[x] = randIdx;
            let chosen = scoringTypes[randIdx];

            if (chosen.category === "victim") {
                outputStrVic += `Victim {
                    translation ` + vicX.toString() + ' 0 ' + vicY.toString() + `
                    rotation ${finalAngles.x} ${finalAngles.y} ${finalAngles.z} ${finalAngles.angle}
                    name "Victim` + startHumanId.toString() + `"
                    type "` + chosen.type + `"
                    scoreWorth 15
                }
                `;
                startHumanId += 1;
            } else if (chosen.category === "hazard") {
                outputStrHaz += `CognitiveTarget {
                    translation ` + vicX.toString() + ' 0 ' + vicY.toString() + `
                    rotation ${finalAngles.x} ${finalAngles.y} ${finalAngles.z} ${finalAngles.angle}
                    name "Hazard` + startHazardId.toString() + `"
                    type "` + (metaCode(meta, chosen.type) || randomCognitiveCode(chosen.type)) + `"
                    scoreWorth ` + (chosen.type === 'X' ? 0 : 30) + `
                }
                `;
                startHazardId += 1;
            } else { // fake: psi, phi, omega; turned at random like the real victims (rule 3.7.11)
                let fakeAngles = calculateWallTokenRot(angle, frontAngle);
                outputStrFake +=
                `Fake {
                    translation ` + vicX.toString() + ' 0 ' + vicY.toString() + `
                    rotation ${fakeAngles.x} ${fakeAngles.y} ${fakeAngles.z} ${fakeAngles.angle}
                    name "Fake` + startHumanId.toString() + `"
                    type "` + chosen.type + `"
                    scoreWorth 0
                }
                `;
                startHumanId += 1;
            }

            /*cv.circle(src, new cv.Point(cx, cy), 3, new cv.Scalar(0, 255, 0, 255), 5);
            cv.circle(src, new cv.Point(nextPoint[1], nextPoint[0]), 5, new cv.Scalar(0, 255, 255, 255), 5);
            cv.circle(src, new cv.Point(prevPoint[1], prevPoint[0]), 5, new cv.Scalar(0, 255, 255, 255), 5);
            //cv.circle(src, new cv.Point(closePoint[1], closePoint[0]), 5, new cv.Scalar(0, 0, 255, 255), 5);
            showImg(src);*/
        }
        return [outputStrVic, outputStrHaz, outputStrFake];
    }

        return { createArea4Solid: createArea4Solid, createArea4Victims: createArea4Victims, room4CorrectSize: room4CorrectSize };
    }

    // Wall token types a custom room 4 stamp can carry; idx is the scoring type of createArea4Victims.
    // Colours as the victims of the new editor (beta): letter victims blue, fakes grey, CT by type.
    const stampTypes = [
        { idx: 0,  kind: 'victim', symbol: 'Φ', color: '#2563eb', name: 'admin.simMapEditor.room4Creator.types.harmed' },
        { idx: 1,  kind: 'victim', symbol: 'Ψ', color: '#2563eb', name: 'admin.simMapEditor.room4Creator.types.stable' },
        { idx: 2,  kind: 'victim', symbol: 'Ω', color: '#2563eb', name: 'admin.simMapEditor.room4Creator.types.unharmed' },
        // fake victims are letter victims too (3D letters), so they sit with them
        { idx: 9,  kind: 'fake', symbol: 'Φ', color: '#94a3b8', name: 'admin.simMapEditor.room4Creator.types.fakeHarmed' },
        { idx: 8,  kind: 'fake', symbol: 'Ψ', color: '#94a3b8', name: 'admin.simMapEditor.room4Creator.types.fakeStable' },
        { idx: 10, kind: 'fake', symbol: 'Ω', color: '#94a3b8', name: 'admin.simMapEditor.room4Creator.types.fakeUnharmed' },
        { idx: 5,  kind: 'ct', symbol: 'F', color: '#d32f2f', name: 'admin.simMapEditor.ctF' },
        { idx: 3,  kind: 'ct', symbol: 'P', color: '#6a1b9a', name: 'admin.simMapEditor.ctP' },
        { idx: 6,  kind: 'ct', symbol: 'C', color: '#1565c0', name: 'admin.simMapEditor.ctC' },
        { idx: 4,  kind: 'ct', symbol: 'O', color: '#e65100', name: 'admin.simMapEditor.ctO' },
        { idx: 7,  kind: 'fakect', symbol: '×', color: '#6c757d', name: 'admin.simMapEditor.ctFake' }
    ];

    return { create: create, stampTypes: stampTypes };
})();
