const logger = require('../../config/logger').mainLogger;

const ssrModules = {
    2026: require('./2026'),
};

function getSSR(rule = '2026') {
    if (ssrModules[rule]) {
        return ssrModules[rule];
    }
    logger.warn(`SSR for rule ${rule} not found, falling back to 2026`);
    return ssrModules['2026'];
}

async function drawLineCanvas(map, rule = '2026') {
    return getSSR(rule).drawLineCanvas(map);
}

async function drawLinePDF(doc, map, x, y, maxWidth, maxHeight, rule = '2026') {
    return getSSR(rule).drawLinePDF(doc, map, x, y, maxWidth, maxHeight);
}

async function generatePNG(map, rule = '2026') {
    return getSSR(rule).generatePNG(map);
}

module.exports = {
    drawLineCanvas,
    drawLinePDF,
    generatePNG,
    getSSR,
};
