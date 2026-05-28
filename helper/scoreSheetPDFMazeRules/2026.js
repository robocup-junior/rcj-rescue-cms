const PDFDocument = require('pdfkit');
const pdf = require('../scoreSheetPDFUtil');
const qr = require('qr-image');
const fs = require('fs');
const { guessLanguage } = require('guesslanguage/lib/guessLanguage');
const glob = require('glob');

/**
 * Defines some important numbers for the placement of different objects in the scoresheet.
 */
const globalConfig = {
    paperSize: { x: 841.89, y: 595.28 },
};

function isExistFile(file) {
    try {
        fs.statSync(file);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') return false;
    }
}

function guessLanguagePromise(text) {
    return new Promise((resolve) => {
        guessLanguage.name(text, (name) => {
            return resolve(name);
        });
    });
}

function getFontPath(lang) {
    const list = glob.sync(`${__dirname}/../fonts/${lang}*`);
    if (list.length > 0) {
        return list[0];
    }
    return null;
}

function Range(first, last) {
    first = first.charCodeAt(0);
    last = last.charCodeAt(0);

    const result = new Array();
    for (let i = first; i <= last; i++) {
        result.push(String.fromCodePoint(i));
    }
    return result;
}

function drawRun(doc, config, scoringRun) {
    // Set template image as a background
    pdf.drawImage(
        doc,
        0,
        0,
        'scoresheet_generation/maze/base2024.png',
        841.89,
        595.28,
        'center'
    );

    // Draw competition name & logo
    pdf.drawTextWithAlign(
        doc,
        90,
        15,
        `${scoringRun.competition.name}  Scoresheet`,
        20,
        'black',
        660,
        'center'
    );
    if (
        scoringRun.competition.logo != '' &&
        scoringRun.competition.logo != '/images/noLogo.png'
    )
        pdf.drawImage(
            doc,
            730,
            5,
            scoringRun.competition.logo,
            100,
            30,
            'right'
        );
    else pdf.drawImage(doc, 730, 5, 'public/images/logo.png', 100, 30, 'right');

    // Draw run QR code
    if (
        scoringRun._id &&
        scoringRun._id.toString() !== '000000000000000000000000' &&
        !scoringRun.noQR
    ) {
        doc.image(
            qr.imageSync(`M;${scoringRun._id.toString()}`, { margin: 2 }),
            10,
            10,
            { width: 75 }
        );
    }

    let drawTeamName = scoringRun.team.name;
    if (scoringRun.team.teamCode) {
        drawTeamName = `${scoringRun.team.teamCode} ${drawTeamName}`;
    }
    // Draw team name
    pdf.drawTextWithAlign(
        doc,
        140,
        45,
        drawTeamName,
        15,
        'black',
        310,
        'center'
    );

    // Draw start time
    if (scoringRun.startTime) {
        const dateTime = new Date(scoringRun.startTime);
        if (!isNaN(dateTime.getTime())) {
            pdf.drawTextWithAlign(
                doc,
                140,
                65,
                `${`0${dateTime.getUTCHours()}`.slice(-2)}:${`0${dateTime.getUTCMinutes()}`.slice(
                    -2
                )}`,
                15,
                'black',
                75,
                'center'
            );
        }
    }

    // Draw round name
    pdf.drawTextWithAlign(
        doc,
        250,
        65,
        scoringRun.round.name,
        15,
        'black',
        115,
        'center'
    );

    // Draw field name
    pdf.drawTextWithAlign(
        doc,
        395,
        65,
        scoringRun.field.name,
        15,
        'black',
        55,
        'center'
    );

    // Draw map image
    if (
        isExistFile(`${__dirname}/../../tmp/course/${scoringRun.map._id}.png`)
    ) {
        pdf.drawImage(
            doc,
            30,
            92,
            `tmp/course/${scoringRun.map._id}.png`,
            418,
            475,
            'center'
        );
    }

    // Draw dice
    if (
        scoringRun.diceNumber &&
        scoringRun.diceNumber >= 1 &&
        scoringRun.diceNumber <= 6
    )
        pdf.drawImage(
            doc,
            460,
            460,
            `public/images/dice/${scoringRun.diceNumber}.png`,
            25,
            25,
            'center'
        );

    // System version
    pdf.drawText(
        doc,
        20,
        580,
        `©${process.env.cms_copyright}. This score sheet was generated with RCJ CMS v${process.env.cms_version}`,
        8,
        'black'
    );

    const cells = [];
    for (const cell of scoringRun.map.cells) {
        if (cell.isTile) cells[`${cell.x},${cell.y},${cell.z}`] = cell;
    }

    const big = Range('A', 'Z');
    const itemList = {
        allVictims: [],
        checkpoint: [],
        ramp: [],
        speedbump: [],
        steps: [],
        blue: [],
    };

    const maxKits = {
        PHI: 2,
        PSI: 1,
        OMEGA: 0,
    };
    const cognitiveColorValues = { K: -2, R: -1, Y: 0, G: 1, B: 2 };

    let victimIndex = 0;
    for (let j = 1, l = scoringRun.map.length * 2 + 1; j < l; j += 2) {
        for (let i = 1, m = scoringRun.map.width * 2 + 1; i < m; i += 2) {
            for (let k = 0; k < scoringRun.map.height; k++) {
                const coord = `${i},${j},${k}`;
                if (!cells[coord]) continue;
                const cell = cells[coord];
                const { tile } = cell;
                const isLinear = cell.isLinear;

                const victimPlaces = ['top', 'left', 'right', 'bottom'];
                for (const vp of victimPlaces) {
                    const victimType = tile.victims[vp];
                    if (victimType && victimType !== 'None') {
                        victimIndex++;
                        let kits = 0;
                        let imgCode = null;
                        let isDummy = false;
                        if (victimType === 'Cognitive') {
                            if (
                                tile.cognitiveTargets &&
                                tile.cognitiveTargets[vp] &&
                                tile.cognitiveTargets[vp].rings
                            ) {
                                const rings = tile.cognitiveTargets[vp].rings;
                                let total = 0;
                                for (let r = 1; r <= 5; r++) {
                                    total +=
                                        cognitiveColorValues[
                                            rings[`ring${r}`]
                                        ] || 0;
                                }
                                if (total === 2) kits = 2;
                                else if (total === 1) kits = 1;
                                else if (total === 0) kits = 0;
                                else isDummy = true;
                                imgCode = `${rings.ring1}${rings.ring2}${rings.ring3}${rings.ring4}${rings.ring5}`;
                            } else {
                                isDummy = true;
                            }
                        } else {
                            kits = maxKits[victimType] || 0;
                        }

                        if (!isDummy) {
                            itemList.allVictims.push({
                                type: victimType,
                                isLinear,
                                kits,
                                imgCode,
                                name: big[(victimIndex - 1) % 26],
                            });
                        }
                    }
                }

                if (tile.checkpoint) {
                    itemList.checkpoint.push({
                        name: itemList.checkpoint.length + 1,
                    });
                }
                if (tile.speedbump) {
                    itemList.speedbump.push({
                        name: itemList.speedbump.length + 1,
                    });
                }
                if (tile.ramp) {
                    itemList.ramp.push({ name: itemList.ramp.length + 1 });
                }
                if (tile.steps) {
                    itemList.steps.push({ name: itemList.steps.length + 1 });
                }
                if (tile.blue) {
                    itemList.blue.push({ name: itemList.blue.length + 1 });
                }
            }
        }
    }

    let x = 453; // width 360
    let y = 40;

    let base_size_x = 90;
    const base_size_y = 29;
    const text_padding = 7;

    // Draw all victims unified
    for (const v of itemList.allVictims) {
        if (x + base_size_x > 813.1) {
            x = 453;
            y += base_size_y;
        }
        let bg = 'scoresheet_generation/maze/';
        if (v.isLinear) {
            if (v.kits === 2) bg += 'l2.png';
            else if (v.kits === 1) bg += 'l1.png';
            else bg += 'l0.png';
        } else {
            if (v.kits === 2) bg += 'f2.png';
            else if (v.kits === 1) bg += 'f1.png';
            else bg += 'f0.png';
        }

        pdf.drawImage(doc, x, y, bg, base_size_x, 50, 'center');

        let icon = 'scoresheet_generation/maze/';
        if (v.type === 'Cognitive' && v.imgCode) {
            icon = `public/images/cognitive_targets/${v.imgCode}.png`;
        } else {
            icon += v.type.toLowerCase() + '.png';
        }

        pdf.drawImage(
            doc,
            x + 2,
            y + 2,
            icon,
            base_size_y - 5,
            base_size_y - 5,
            'center'
        );

        pdf.drawTextWithAlign(
            doc,
            x + 20,
            y + text_padding,
            v.name,
            20,
            'black',
            base_size_y,
            'center'
        );

        x += base_size_x;
    }

    if (x != 453) {
        x = 453;
        y += base_size_y + 5;
    } else {
        y += 5;
    }

    base_size_x = 60;
    // Draw box for "checkpoint"
    for (const e of itemList.checkpoint) {
        if (x + base_size_x > 813.1) {
            x = 453;
            y += base_size_y;
        }
        pdf.drawImage(
            doc,
            x,
            y,
            'scoresheet_generation/maze/element.png',
            base_size_x,
            50,
            'center'
        );
        pdf.drawImage(
            doc,
            x + 2,
            y + 2,
            'scoresheet_generation/maze/checkpoint.png',
            base_size_y - 5,
            base_size_y - 5,
            'center'
        );
        pdf.drawTextWithAlign(
            doc,
            x + 20,
            y + text_padding,
            e.name,
            20,
            'black',
            base_size_y,
            'center'
        );
        x += base_size_x;
    }

    // Draw box for "speedbump"
    for (const e of itemList.speedbump) {
        if (x + base_size_x > 813.1) {
            x = 453;
            y += base_size_y;
        }
        pdf.drawImage(
            doc,
            x,
            y,
            'scoresheet_generation/maze/element.png',
            base_size_x,
            50,
            'center'
        );
        pdf.drawImage(
            doc,
            x + 2,
            y + 2,
            'scoresheet_generation/maze/speedbump.png',
            base_size_y - 5,
            base_size_y - 5,
            'center'
        );
        pdf.drawTextWithAlign(
            doc,
            x + 20,
            y + text_padding,
            e.name,
            20,
            'black',
            base_size_y,
            'center'
        );
        x += base_size_x;
    }

    // Draw box for "ramp"
    for (const e of itemList.ramp) {
        if (x + base_size_x > 813.1) {
            x = 453;
            y += base_size_y;
        }
        pdf.drawImage(
            doc,
            x,
            y,
            'scoresheet_generation/maze/element.png',
            base_size_x,
            50,
            'center'
        );
        pdf.drawImage(
            doc,
            x + 2,
            y + 2,
            'scoresheet_generation/maze/ramp.png',
            base_size_y - 5,
            base_size_y - 5,
            'center'
        );
        pdf.drawTextWithAlign(
            doc,
            x + 20,
            y + text_padding,
            e.name,
            20,
            'black',
            base_size_y,
            'center'
        );
        x += base_size_x;
    }

    // Draw box for "steps"
    for (const e of itemList.steps) {
        if (x + base_size_x > 813.1) {
            x = 453;
            y += base_size_y;
        }
        pdf.drawImage(
            doc,
            x,
            y,
            'scoresheet_generation/maze/element.png',
            base_size_x,
            50,
            'center'
        );
        pdf.drawImage(
            doc,
            x + 2,
            y + 2,
            'scoresheet_generation/maze/steps.png',
            base_size_y - 5,
            base_size_y - 5,
            'center'
        );
        pdf.drawTextWithAlign(
            doc,
            x + 20,
            y + text_padding,
            e.name,
            20,
            'black',
            base_size_y,
            'center'
        );
        x += base_size_x;
    }

    // Draw box for "blue"
    for (const e of itemList.blue) {
        if (x + base_size_x * 2 > 813.1) {
            x = 453;
            y += base_size_y;
        }
        pdf.drawImage(
            doc,
            x,
            y,
            'scoresheet_generation/maze/element_blue.png',
            base_size_x * 2,
            50,
            'center'
        );
        pdf.drawImage(
            doc,
            x + 2,
            y + 2,
            'scoresheet_generation/maze/blue.png',
            base_size_y - 5,
            base_size_y - 5,
            'center'
        );
        pdf.drawTextWithAlign(
            doc,
            x + 20,
            y + text_padding,
            e.name,
            20,
            'black',
            base_size_y,
            'center'
        );
        x += base_size_x * 2;
    }
}

module.exports.generateScoreSheet = async function (res, rounds) {
    let font = null;
    if (rounds.length > 0) {
        const tmp = await guessLanguagePromise(rounds[0].competition.name);
        font = getFontPath(tmp);
    }

    const doc = new PDFDocument({ autoFirstPage: false });

    doc.pipe(res);

    if (font) doc.font(font);

    for (let i = 0; i < rounds.length; i++) {
        doc.addPage({
            margin: 0,
            size: [globalConfig.paperSize.x, globalConfig.paperSize.y],
        });
        drawRun(doc, globalConfig, rounds[i]);
    }

    doc.end();
};
