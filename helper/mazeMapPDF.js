const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mazeSSR = require('./mazeSSR');

/**
 * Generates a PDF with Cognitive Targets and optionally Letter Victims for printing
 * Layout: 3 columns x 3 rows = 9 targets per page
 * Each target: 5cm x 5cm (141.73 x 141.73 points)
 * Supports A4 and Letter paper sizes
 */

// Paper size dimensions in points
const PAPER_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 }
};

// Constants for layout
const TARGET_SIZE = 141.73; // 5cm in points (1cm = 28.346 points)
const MARGIN_X = 28.35; // 1cm margin
const MARGIN_Y = 30; // Reduced top margin
const GAP_X = 28.35; // 1cm gap between targets horizontally
const GAP_Y = 45; // Reduced gap between rows to fit 3x3 on one page
const COLS = 3;
const ROWS = 3;

// Color to value mapping
const colorValues = {
  'B': -2,
  'R': -1,
  'Y': 0,
  'G': 1,
  'C': 2
};

function isExistFile(file) {
  try {
    fs.statSync(file);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
  }
}

/**
 * Find a suitable font for international characters (bundled in the project)
 */
function getPDFFont() {
  const projectFonts = [
    path.join(__dirname, '../fonts/noto-sans-cjk.ttc'),
    path.join(__dirname, '../fonts/noto-sans.ttf'),
    path.join(__dirname, '../fonts/ja.ttf'),
    path.join(__dirname, '../fonts/ja.otf'),
  ];
  
  for (const f of projectFonts) {
    if (isExistFile(f)) return f;
  }
  
  return null;
}

/**
 * Extract unique cognitive targets and optionally letter victims from map cells with victim numbers
 * @param {Object} map - The maze map object
 * @param {boolean} includeLetterVictims - Whether to include letter victims
 * @returns {Array} - Array of objects with target details
 */
function extractTargets(map, includeLetterVictims = false, includeCognitiveTargets = true) {
  if (!map.cells) return [];

  // Calculate victim numbers using the same logic as maze_2026.js
  const victimNumberMap = new Map(); // position+direction -> letter
  let victimCount = 0;

  // Get map dimensions
  let maxX = 0, maxY = 0, maxZ = 0;
  for (const cell of map.cells) {
    if (cell.isTile) {
      if (cell.x > maxX) maxX = cell.x;
      if (cell.y > maxY) maxY = cell.y;
      if (cell.z > maxZ) maxZ = cell.z;
    }
  }

  // Count victims in the same order as frontend (y -> x -> z -> directions)
  for (let i = 1; i <= maxY; i += 2) { // y (length)
    for (let j = 1; j <= maxX; j += 2) { // x (width)
      for (let k = 0; k <= maxZ; k++) { // z (height)
        const cell = map.cells.find(c => c.x === j && c.y === i && c.z === k);
        if (!cell || !cell.isTile || !cell.tile || !cell.tile.victims) continue;

        const victims = cell.tile.victims;
        const victimPlaces = ['top', 'left', 'right', 'bottom'];

        for (const dir of victimPlaces) {
          const victimType = victims[dir];
          if (victimType && victimType !== 'None') {
            victimCount++;
            const key = `${j},${i},${k},${dir}`;
            const letter = String.fromCharCode(64 + victimCount); // 1=A, 2=B, etc.
            victimNumberMap.set(key, letter);
          }
        }
      }
    }
  }

  // Now extract cognitive targets and letter victims
  const targets = [];

  for (const cell of map.cells) {
    if (!cell.isTile || !cell.tile || !cell.tile.victims) continue;

    const directions = ['top', 'right', 'bottom', 'left'];
    for (const dir of directions) {
      const victimType = cell.tile.victims[dir];

      if (includeCognitiveTargets && victimType === 'Cognitive' &&
        cell.tile.cognitiveTargets &&
        cell.tile.cognitiveTargets[dir] &&
        cell.tile.cognitiveTargets[dir].rings) {
        const rings = cell.tile.cognitiveTargets[dir].rings;
        const colorCode = rings.ring1 + rings.ring2 + rings.ring3 + rings.ring4 + rings.ring5;

        const key = `${cell.x},${cell.y},${cell.z},${dir}`;
        const victimLetter = victimNumberMap.get(key) || null;

        targets.push({
          type: 'Cognitive',
          colorCode: colorCode,
          victimLetter: victimLetter
        });
      } else if (includeLetterVictims && ['PHI', 'PSI', 'OMEGA'].includes(victimType)) {
        const key = `${cell.x},${cell.y},${cell.z},${dir}`;
        const victimLetter = victimNumberMap.get(key) || null;

        targets.push({
          type: 'Letter',
          victimType: victimType,
          victimLetter: victimLetter
        });
      }
    }
  }

  return targets.sort((a, b) => {
    // Sort by victim letter (A, B, C...)
    if (a.victimLetter && b.victimLetter) {
      return a.victimLetter.localeCompare(b.victimLetter);
    }
    if (a.victimLetter) return -1;
    if (b.victimLetter) return 1;

    // Sort by type
    if (a.type !== b.type) return a.type.localeCompare(b.type);

    // Final fallback
    return (a.colorCode || a.victimType).localeCompare(b.colorCode || b.victimType);
  });
}

/**
 * Calculate victim status from color code
 * @param {string} colorCode - The color code (e.g., 'YYYYY')
 * @returns {string} - Status abbreviation (H/S/U/D)
 */
function getVictimStatus(colorCode) {
  let total = 0;
  for (const char of colorCode) {
    total += colorValues[char] || 0;
  }

  if (total === 2) return 'H'; // Harmed
  if (total === 1) return 'S'; // Stable
  if (total === 0) return 'U'; // Unharmed
  return 'D'; // Dummy
}

/**
 * Get full status name
 * @param {string} status - Status abbreviation
 * @returns {string} - Full status name
 */
function getStatusName(status) {
  const names = {
    'H': 'Harmed',
    'S': 'Stable',
    'U': 'Unharmed',
    'D': 'Dummy'
  };
  return names[status] || status;
}

/**
 * Draw a single target (Cognitive or Letter) on the PDF
 * @param {PDFDocument} doc - The PDF document
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} target - The target object
 */
function drawTarget(doc, x, y, target) {
  let imagePath = '';
  let labelText = '';

  if (target.type === 'Cognitive') {
    const colorCode = target.colorCode;
    imagePath = path.join(__dirname, '../public/images/cognitive_targets', `${colorCode}.png`);
    const status = getVictimStatus(colorCode);
    const statusName = getStatusName(status);
    labelText = `${colorCode} (${status}: ${statusName})`;
  } else {
    const victimType = target.victimType;
    const fileMap = {
      'PHI': 'harmed',
      'PSI': 'stable',
      'OMEGA': 'unharmed'
    };
    const statusMap = {
      'PHI': 'H',
      'PSI': 'S',
      'OMEGA': 'U'
    };
    const status = statusMap[victimType];
    imagePath = path.join(__dirname, '../public/images/letter_victims', `${fileMap[victimType]}.png`);
    labelText = `${victimType} (${status}: ${getStatusName(status)})`;
  }

  const victimLetter = target.victimLetter;

  // Draw image if exists
  if (isExistFile(imagePath)) {
    doc.image(imagePath, x, y, {
      width: TARGET_SIZE,
      height: TARGET_SIZE
    });
  } else {
    // Draw placeholder text if image not found
    doc.fontSize(10);
    doc.text(target.colorCode || target.victimType, x, y + TARGET_SIZE / 2 - 5, {
      width: TARGET_SIZE,
      align: 'center'
    });
  }

  // Label and victim number placement
  const labelY = y + TARGET_SIZE + 28.35;

  if (victimLetter) {
    const circleX = x + 5;
    const circleY = labelY + 4;
    const circleRadius = 7.5;

    // Draw pink circle
    doc.circle(circleX, circleY, circleRadius)
      .fill('#e84393');

    // Draw letter in white
    doc.fontSize(9)
      .fillColor('#ffffff')
      .text(victimLetter, circleX - 4, circleY - 3.5, {
        width: 8,
        align: 'center'
      });

    // Reset fill color
    doc.fillColor('#000000');

    // Draw label to the right of the circle
    doc.fontSize(8);
    doc.text(labelText, x + 18, labelY, {
      width: TARGET_SIZE - 18,
      align: 'center'
    });
  } else {
    doc.fontSize(8);
    doc.text(labelText, x, labelY, {
      width: TARGET_SIZE,
      align: 'center'
    });
  }
}

/**
 * Generate PDF with targets
 * @param {Object} map - The maze map object
 * @param {string} outputPath - Output file path (optional)
 * @param {boolean} includeLetterVictims - Whether to include letter victims
 * @returns {PDFDocument} - The PDF document
 */
function generateCompetitionTargetsPDF(map, outputPath = null, includeLetterVictims = false, includeCognitiveTargets = true) {
  const targets = extractTargets(map, includeLetterVictims, includeCognitiveTargets);

  if (targets.length === 0) {
    return null;
  }

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: 'A4',
    margin: 0
  });

  const jaFont = getPDFFont();
  if (jaFont) {
    doc.font(jaFont);
  }

  if (outputPath) {
    doc.pipe(fs.createWriteStream(outputPath));
  }

  let targetIndex = 0;

  while (targetIndex < targets.length) {
    doc.addPage();

    // Header
    doc.fontSize(16);
    const title = includeLetterVictims ? `Letter Victims / Cognitive Targets - ${map.name}` : `Cognitive Targets - ${map.name}`;
    doc.text(title, 50, 20, {
      width: 495,
      align: 'center'
    });

    doc.fontSize(10);
    doc.text(`Page ${Math.floor(targetIndex / (COLS * ROWS)) + 1}`, 50, 40, {
      width: 495,
      align: 'center'
    });

    const headerHeight = 35;
    const bottomMargin = 20;
    const availableHeight = 841.89 - MARGIN_Y - headerHeight - bottomMargin;
    const cellHeight = availableHeight / ROWS;
    const availableWidth = 595.28 - (2 * MARGIN_X);
    const cellWidth = availableWidth / COLS;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (targetIndex >= targets.length) break;

        const cellX = MARGIN_X + col * cellWidth;
        const cellY = MARGIN_Y + headerHeight + row * cellHeight;
        const x = cellX + (cellWidth - TARGET_SIZE) / 2;
        const y = cellY;

        drawTarget(doc, x, y, targets[targetIndex]);
        targetIndex++;
      }
    }
  }

  doc.end();
  return doc;
}

/**
 * Generate PDF and pipe to response
 * @param {Object} res - Express response object
 * @param {Object} map - The maze map object
 * @param {string} paperSize - Paper size ('A4' or 'Letter')
 * @param {boolean} includeLetterVictims - Whether to include letter victims
 */
function generateAndSendPDF(res, map, paperSize = 'A4', includeLetterVictims = false, includeCognitiveTargets = true) {
  const targets = extractTargets(map, includeLetterVictims, includeCognitiveTargets);

  if (targets.length === 0) {
    return res.status(404).send({
      msg: 'No targets found in this map'
    });
  }

  const validPaperSize = PAPER_SIZES[paperSize] ? paperSize : 'A4';
  const size = PAPER_SIZES[validPaperSize];
  const pageWidth = size.width;
  const pageHeight = size.height;

  console.log(`Generating PDF: ${validPaperSize}, includeLetterVictims: ${includeLetterVictims}`);

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: validPaperSize,
    margin: 0
  });

  const jaFont = getPDFFont();
  if (jaFont) {
    doc.font(jaFont);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="targets.pdf"; filename*=UTF-8''${encodeURIComponent(`targets-${map.name}.pdf`)}`);

  doc.pipe(res);

  let targetIndex = 0;

  while (targetIndex < targets.length) {
    doc.addPage();

    doc.fontSize(16);
    const title = includeLetterVictims ? `Letter Victims / Cognitive Targets - ${map.name}` : `Cognitive Targets - ${map.name}`;
    doc.text(title, 50, 20, {
      width: pageWidth - 100,
      align: 'center'
    });

    doc.fontSize(10);
    doc.text(`Page ${Math.floor(targetIndex / (COLS * ROWS)) + 1}`, 50, 40, {
      width: pageWidth - 100,
      align: 'center'
    });

    const headerHeight = 35;
    const bottomMargin = 20;
    const availableHeight = pageHeight - MARGIN_Y - headerHeight - bottomMargin;
    const cellHeight = availableHeight / ROWS;
    const availableWidth = pageWidth - (2 * MARGIN_X);
    const cellWidth = availableWidth / COLS;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (targetIndex >= targets.length) break;

        const cellX = MARGIN_X + col * cellWidth;
        const cellY = MARGIN_Y + headerHeight + row * cellHeight;
        const x = cellX + (cellWidth - TARGET_SIZE) / 2;
        const y = cellY;

        drawTarget(doc, x, y, targets[targetIndex]);
        targetIndex++;
      }
    }
  }

  doc.end();
}

/**
 * Generate a bulk PDF for multiple maps and pipe to response
 * @param {Object} res - Express response object
 * @param {Array} maps - Array of maze map objects
 * @param {string} competitionName - Name of the competition
 * @param {string} leagueName - Name of the league
 * @param {string} paperSize - Paper size ('A4' or 'Letter')
 * @param {boolean} includeLetterVictims - Whether to include letter victims
 * @param {boolean} includeCognitiveTargets - Whether to include cognitive targets
 */
function generateAndSendBulkPDF(res, maps, competitionName, leagueName, paperSize = 'A4', includeLetterVictims = false, includeCognitiveTargets = true) {
  const validPaperSize = PAPER_SIZES[paperSize] ? paperSize : 'A4';
  const size = PAPER_SIZES[validPaperSize];
  const pageWidth = size.width;
  const pageHeight = size.height;

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: validPaperSize,
    margin: 0
  });

  const jaFont = getPDFFont();
  if (jaFont) {
    doc.font(jaFont);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bulk-targets.pdf"; filename*=UTF-8''${encodeURIComponent(`targets-${competitionName}-${leagueName}.pdf`)}`);

  doc.pipe(res);

  for (const map of maps) {
    const targets = extractTargets(map, includeLetterVictims, includeCognitiveTargets);
    if (targets.length === 0) continue;

    let targetIndex = 0;
    let mapPage = 0;

    while (targetIndex < targets.length) {
      doc.addPage();
      mapPage++;

      doc.fontSize(14);
      const title = `${competitionName} - ${leagueName}`;
      doc.text(title, 50, 15, {
        width: pageWidth - 100,
        align: 'center'
      });

      doc.fontSize(11);
      doc.text(map.name, 50, 32, {
        width: pageWidth - 100,
        align: 'center'
      });

      doc.fontSize(9);
      doc.text(`Page ${mapPage}`, 50, 48, {
        width: pageWidth - 100,
        align: 'center'
      });

      const headerHeight = 45;
      const bottomMargin = 20;
      const availableHeight = pageHeight - MARGIN_Y - headerHeight - bottomMargin;
      const cellHeight = availableHeight / ROWS;
      const availableWidth = pageWidth - (2 * MARGIN_X);
      const cellWidth = availableWidth / COLS;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (targetIndex >= targets.length) break;

          const cellX = MARGIN_X + col * cellWidth;
          const cellY = MARGIN_Y + headerHeight + row * cellHeight;
          const x = cellX + (cellWidth - TARGET_SIZE) / 2;
          const y = cellY;

          drawTarget(doc, x, y, targets[targetIndex]);
          targetIndex++;
        }
      }
    }
  }

  doc.end();
}

/**
 * Generate a bulk PDF with map images for multiple maps
 * @param {Object} res - Express response object
 * @param {Array} maps - Array of maze map objects
 * @param {string} competitionName - Name of the competition
 * @param {string} leagueName - Name of the league
 * @param {string} paperSize - Paper size ('A4' or 'Letter')
 */
async function generateAndSendBulkMapImagesPDF(res, maps, competitionName, leagueName, paperSize = 'A4') {
  const validPaperSize = PAPER_SIZES[paperSize] ? paperSize : 'A4';
  const size = PAPER_SIZES[validPaperSize];
  const pageWidth = size.width;
  const pageHeight = size.height;

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: validPaperSize,
    margin: 0
  });

  const jaFont = getPDFFont();
  if (jaFont) {
    doc.font(jaFont);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bulk-maps.pdf"; filename*=UTF-8''${encodeURIComponent(`maps-${competitionName}-${leagueName}.pdf`)}`);

  doc.pipe(res);

  for (const map of maps) {
    const buffer = await mazeSSR.generatePNG(map, map.rule || '2026');
    const img = doc.openImage(buffer);
    let orientation = img.width > img.height ? 'landscape' : 'portrait';

    doc.addPage({
      size: validPaperSize,
      layout: orientation,
      margin: 30
    });

    const currentPageWidth = orientation === 'landscape' ? pageHeight : pageWidth;
    const currentPageHeight = orientation === 'landscape' ? pageWidth : pageHeight;

    // Header
    doc.fontSize(14).text(competitionName, { align: 'center' });
    doc.fontSize(11).text(`${leagueName} - ${map.name}`, { align: 'center' });
    doc.moveDown(1);

    const availableWidth = currentPageWidth - 60;
    const availableHeight = currentPageHeight - 120;

    doc.image(img, 30, 80, { fit: [availableWidth, availableHeight], align: 'center', valign: 'center' });
  }

  doc.end();
}

module.exports = {
  generateCompetitionTargetsPDF,
  generateAndSendPDF,
  generateAndSendBulkPDF,
  generateAndSendBulkMapImagesPDF,
  extractCognitiveTargets: extractTargets // Keep old name for compatibility if needed
};
