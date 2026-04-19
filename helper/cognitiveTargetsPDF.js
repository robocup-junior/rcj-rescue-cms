const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a PDF with Cognitive Targets for printing
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
 * Extract unique cognitive targets from map cells
 * @param {Object} map - The maze map object
 * @returns {Array} - Array of unique color codes (e.g., ['YYYYY', 'RRRRR'])
 */
function extractCognitiveTargets(map) {
  const targets = new Set();
  
  if (!map.cells) return [];
  
  for (const cell of map.cells) {
    if (!cell.isTile || !cell.tile || !cell.tile.victims) continue;
    
    const directions = ['top', 'right', 'bottom', 'left'];
    for (const dir of directions) {
      if (cell.tile.victims[dir] === 'Cognitive' && 
          cell.tile.cognitiveTargets && 
          cell.tile.cognitiveTargets[dir] &&
          cell.tile.cognitiveTargets[dir].rings) {
        const rings = cell.tile.cognitiveTargets[dir].rings;
        const colorCode = rings.ring1 + rings.ring2 + rings.ring3 + rings.ring4 + rings.ring5;
        targets.add(colorCode);
      }
    }
  }
  
  return Array.from(targets).sort();
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
 * Draw a single cognitive target on the PDF
 * @param {PDFDocument} doc - The PDF document
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} colorCode - The color code (e.g., 'YYYYY')
 */
function drawCognitiveTarget(doc, x, y, colorCode) {
  const imagePath = path.join(__dirname, '../public/images/cognitive_targets', `${colorCode}.png`);
  const status = getVictimStatus(colorCode);
  const statusName = getStatusName(status);
  
  // Draw image if exists (no border)
  if (isExistFile(imagePath)) {
    doc.image(imagePath, x, y, {
      width: TARGET_SIZE,
      height: TARGET_SIZE
    });
  } else {
    // Draw placeholder text if image not found
    doc.fontSize(10);
    doc.text(colorCode, x, y + TARGET_SIZE / 2 - 5, {
      width: TARGET_SIZE,
      align: 'center'
    });
  }
  
  // Draw color code and status label below the target (1cm = 28.35 points for cutting)
  doc.fontSize(8);
  const labelText = `${colorCode} (${status}: ${statusName})`;
  doc.text(labelText, x, y + TARGET_SIZE + 28.35, {
    width: TARGET_SIZE,
    align: 'center'
  });
}

/**
 * Generate PDF with cognitive targets
 * @param {Object} map - The maze map object
 * @param {string} outputPath - Output file path (optional, for debugging)
 * @returns {PDFDocument} - The PDF document
 */
function generateCognitiveTargetsPDF(map, outputPath = null) {
  const targets = extractCognitiveTargets(map);
  
  if (targets.length === 0) {
    // Return null if no cognitive targets found
    return null;
  }
  
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: 'A4'
  });
  
  if (outputPath) {
    doc.pipe(fs.createWriteStream(outputPath));
  }
  
  let targetIndex = 0;
  
  while (targetIndex < targets.length) {
    doc.addPage();
    
    // Add header
    doc.fontSize(16);
    doc.text(`Cognitive Targets - ${map.name}`, 50, 20, {
      width: 495,
      align: 'center'
    });
    
    doc.fontSize(10);
    doc.text(`Page ${Math.floor(targetIndex / (COLS * ROWS)) + 1}`, 50, 40, {
      width: 495,
      align: 'center'
    });
    
    // Calculate layout to fit 3x3 on one page
    // Total height: 3 targets + 2 gaps between rows + header + margins
    const headerHeight = 35; // Reduced header space
    const bottomMargin = 20; // Reduced bottom margin
    const availableHeight = 841.89 - MARGIN_Y - headerHeight - bottomMargin;
    const cellHeight = availableHeight / ROWS;
    const availableWidth = 595.28 - (2 * MARGIN_X);
    const cellWidth = availableWidth / COLS;
    
    // Draw targets in grid
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (targetIndex >= targets.length) break;
        
        // Position target in grid
        const cellX = MARGIN_X + col * cellWidth;
        const cellY = MARGIN_Y + headerHeight + row * cellHeight;
        const x = cellX + (cellWidth - TARGET_SIZE) / 2;
        const y = cellY;
        
        drawCognitiveTarget(doc, x, y, targets[targetIndex]);
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
 */
function generateAndSendPDF(res, map, paperSize = 'A4') {
  const targets = extractCognitiveTargets(map);
  
  if (targets.length === 0) {
    return res.status(404).send({
      msg: 'No cognitive targets found in this map'
    });
  }
  
  // Validate paper size
  const validPaperSize = PAPER_SIZES[paperSize] ? paperSize : 'A4';
  
  // Get paper dimensions
  const size = PAPER_SIZES[validPaperSize];
  const pageWidth = size.width;
  const pageHeight = size.height;
  
  console.log(`Generating PDF with paper size: ${validPaperSize}, dimensions: ${pageWidth}x${pageHeight}`);
  
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: validPaperSize
  });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="cognitive-targets-${map.name}.pdf"`);
  
  doc.pipe(res);
  
  let targetIndex = 0;
  
  while (targetIndex < targets.length) {
    doc.addPage();
    
    // Add header
    doc.fontSize(16);
    doc.text(`Cognitive Targets - ${map.name}`, 50, 20, {
      width: pageWidth - 100,
      align: 'center'
    });
    
    doc.fontSize(10);
    doc.text(`Page ${Math.floor(targetIndex / (COLS * ROWS)) + 1}`, 50, 40, {
      width: pageWidth - 100,
      align: 'center'
    });
    
    // Calculate layout to fit 3x3 on one page
    // Total height: 3 targets + 2 gaps between rows + header + margins
    const headerHeight = 35; // Reduced header space
    const bottomMargin = 20; // Reduced bottom margin
    const availableHeight = pageHeight - MARGIN_Y - headerHeight - bottomMargin;
    const cellHeight = availableHeight / ROWS;
    const availableWidth = pageWidth - (2 * MARGIN_X);
    const cellWidth = availableWidth / COLS;
    
    // Draw targets in grid
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (targetIndex >= targets.length) break;
        
        // Position target in grid
        const cellX = MARGIN_X + col * cellWidth;
        const cellY = MARGIN_Y + headerHeight + row * cellHeight;
        const x = cellX + (cellWidth - TARGET_SIZE) / 2;
        const y = cellY;
        
        drawCognitiveTarget(doc, x, y, targets[targetIndex]);
        targetIndex++;
      }
    }
  }
  
  doc.end();
}

module.exports = {
  generateCognitiveTargetsPDF,
  generateAndSendPDF,
  extractCognitiveTargets
};
