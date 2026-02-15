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
  var first = first.charCodeAt(0);
  var last = last.charCodeAt(0);
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
    pdf.drawImage(doc, 730, 5, scoringRun.competition.logo, 100, 30, 'right');
  else pdf.drawImage(doc, 730, 5, 'public/images/logo.png', 100, 30, 'right');

  // Draw run QR code
  doc.image(
    qr.imageSync(`M;${scoringRun._id.toString()}`, { margin: 2 }),
    10,
    10,
    { width: 75 }
  );

  let drawTeamName = scoringRun.team.name;
  if (scoringRun.team.teamCode) {
    drawTeamName = `${scoringRun.team.teamCode} ${drawTeamName}`
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
  const dateTime = new Date(scoringRun.startTime);
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
  if (isExistFile(`${__dirname}/../../tmp/course/${scoringRun.map._id}.png`)) {
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
  if (scoringRun.diceNumber)
    pdf.drawImage(
      doc,
      460,
      460,
      `public/images/dice/${scoringRun.diceNumber}.png`,
      25,
      25,
      'center'
    );
  else
    pdf.drawTextWithAlign(
      doc,
      460,
      460,
      'Error: Dice pattern!',
      15,
      'red',
      150,
      'left'
    );

  // System version
  pdf.drawText(doc, 20, 580, `©${process.env.cms_copyright}. This score sheet was generated with RCJ CMS v${process.env.cms_version}`, 8, 'black');

  const cells = [];
  for (const cell of scoringRun.map.cells) {
    if (cell.isTile) cells[`${cell.x},${cell.y},${cell.z}`] = cell;
  }

  const big = Range('A', 'Z');
  const small = Range('a', 'z');
  const itemList = {
    H: {
      linear: [],
      floating: [],
    },
    S: {
      linear: [],
      floating: [],
    },
    U: {
      linear: [],
      floating: [],
    },
    Red: {
      linear: [],
      floating: [],
    },
    Yellow: {
      linear: [],
      floating: [],
    },
    Green: {
      linear: [],
      floating: [],
    },
    checkpoint: [],
    ramp: [],
    speedbump: [],
    steps: [],
  };
  for (let j = 1, l = scoringRun.map.length * 2 + 1; j < l; j += 2) {
    for (let i = 1, m = scoringRun.map.width * 2 + 1; i < m; i += 2) {
      for (let k = 0; k < scoringRun.map.height; k++) {
        if (!cells[`${i},${j},${k}`]) continue
        const victimLF = cells[`${i},${j},${k}`].isLinear ? 'linear' : 'floating';
        const { victims } = cells[`${i},${j},${k}`].tile;
        const { tile } = cells[`${i},${j},${k}`];
        let victimType = 'None';

        victimType = victims.top;
        if (victimType != 'None') {
          let name;
          if (victimLF == 'linear')
            name = big[itemList[victimType][victimLF].length];
          else name = small[itemList[victimType][victimLF].length];
          const tmp = {
            x: i,
            y: j,
            z: k,
            name,
          };
          itemList[victimType][victimLF].push(tmp);
        }

        victimType = victims.left;
        if (victimType != 'None') {
          let name;
          if (victimLF == 'linear')
            name = big[itemList[victimType][victimLF].length];
          else name = small[itemList[victimType][victimLF].length];
          const tmp = {
            x: i,
            y: j,
            z: k,
            name,
          };
          itemList[victimType][victimLF].push(tmp);
        }

        victimType = victims.right;
        if (victimType != 'None') {
          let name;
          if (victimLF == 'linear')
            name = big[itemList[victimType][victimLF].length];
          else name = small[itemList[victimType][victimLF].length];
          const tmp = {
            x: i,
            y: j,
            z: k,
            name,
          };
          itemList[victimType][victimLF].push(tmp);
        }

        victimType = victims.bottom;
        if (victimType != 'None') {
          let name;
          if (victimLF == 'linear')
            name = big[itemList[victimType][victimLF].length];
          else name = small[itemList[victimType][victimLF].length];
          const tmp = {
            x: i,
            y: j,
            z: k,
            name,
          };
          itemList[victimType][victimLF].push(tmp);
        }

        if (tile.checkpoint) {
          const tmp = {
            x: i,
            y: j,
            z: k,
            name: itemList.checkpoint.length + 1,
          };
          itemList.checkpoint.push(tmp);
        }

        if (tile.speedbump) {
          const tmp = {
            x: i,
            y: j,
            z: k,
            name: itemList.speedbump.length + 1,
          };
          itemList.speedbump.push(tmp);
        }

        if (tile.ramp) {
          const tmp = {
            x: i,
            y: j,
            z: k,
            name: itemList.ramp.length + 1,
          };
          itemList.ramp.push(tmp);
        }

        if (tile.steps) {
          const tmp = {
            x: i,
            y: j,
            z: k,
            name: itemList.steps.length + 1,
          };
          itemList.steps.push(tmp);
        }
      }
    }
  }

  let x = 453; // width 360
  let y = 40;

  let base_size_x = 90;
  const base_size_y = 29;
  const text_padding = 7;

  // Draw box for victim "H" (Linear)
  for (const v of itemList.H.linear) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/l2.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/H.png',
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for victim "H" (Floating)
  for (const v of itemList.H.floating) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/f2.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/H.png',
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 23,
      y + 2,
      `scoresheet_generation/maze/${v.name}.png`,
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    x += base_size_x;
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  if (x != 453) {
    x = 453;
    y += base_size_y;
  }
  // Draw box for victim "S" (Linear)
  for (const v of itemList.S.linear) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/l1.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/S.png',
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for victim "S" (Floating)
  for (const v of itemList.S.floating) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/f1.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/S.png',
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 23,
      y + 2,
      `scoresheet_generation/maze/${v.name}.png`,
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    x += base_size_x;
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  if (x != 453) {
    x = 453;
    y += base_size_y;
  }
  // Draw box for victim "U" (Linear)
  for (const v of itemList.U.linear) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/l0.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/U.png',
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for victim "U" (Floating)
  for (const v of itemList.U.floating) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/f0.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/U.png',
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 23,
      y + 2,
      `scoresheet_generation/maze/${v.name}.png`,
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    x += base_size_x;
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  if (x != 453) {
    x = 453;
    y += base_size_y;
  }
  // Draw box for victim "Red" (Linear)
  for (const v of itemList.Red.linear) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/l2.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/red.png',
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for victim "Red" (Floating)
  for (const v of itemList.Red.floating) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/f2.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/red.png',
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 23,
      y + 2,
      `scoresheet_generation/maze/${v.name}.png`,
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    x += base_size_x;
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  if (x != 453) {
    x = 453;
    y += base_size_y;
  }
  // Draw box for victim "Yellow" (Linear)
  for (const v of itemList.Yellow.linear) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/l1.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/yellow.png',
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for victim "Yellow" (Floating)
  for (const v of itemList.Yellow.floating) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/f1.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/yellow.png',
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 23,
      y + 2,
      `scoresheet_generation/maze/${v.name}.png`,
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    x += base_size_x;
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  if (x != 453) {
    x = 453;
    y += base_size_y;
  }
  // Draw box for victim "Green" (Linear)
  for (const v of itemList.Green.linear) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/l0.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/green.png',
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for victim "Green" (Floating)
  for (const v of itemList.Green.floating) {
    pdf.drawImage(
      doc,
      x,
      y,
      'scoresheet_generation/maze/f0.png',
      base_size_x,
      50,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 2,
      y + 2,
      'scoresheet_generation/maze/green.png',
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    pdf.drawImage(
      doc,
      x + 23,
      y + 2,
      `scoresheet_generation/maze/${v.name}.png`,
      base_size_y - 5,
      base_size_y - 5,
      'center'
    );
    x += base_size_x;
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for "speedbump"
  for (const e of itemList.speedbump) {
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for "ramp"
  for (const e of itemList.ramp) {
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
  }

  // Draw box for "steps"
  for (const e of itemList.steps) {
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
    if (x >= 810) {
      x = 453;
      y += base_size_y;
    }
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
