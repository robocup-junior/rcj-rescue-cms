const logger = require('../config/logger').mainLogger;

const ssrModules = {
  '2026': require('./mazeSSR_2026')
};

function getSSR(rule = '2026') {
  if (ssrModules[rule]) {
    return ssrModules[rule];
  }
  logger.warn(`SSR for rule ${rule} not found, falling back to 2026`);
  return ssrModules['2026'];
}

async function drawMazeCanvas(map, rule = '2026') {
  return getSSR(rule).drawMazeCanvas(map);
}

async function drawMazePDF(doc, map, x, y, maxWidth, maxHeight, rule = '2026') {
  return getSSR(rule).drawMazePDF(doc, map, x, y, maxWidth, maxHeight);
}

async function generatePNG(map, rule = '2026') {
  return getSSR(rule).generatePNG(map);
}

async function generateSVG(map, rule = '2026') {
  return getSSR(rule).generateSVG(map);
}

module.exports = {
  drawMazeCanvas,
  drawMazePDF,
  generatePNG,
  generateSVG,
  getSSR
};
