"use strict";

const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// The server image has no system fonts, so text drawn with a generic family
// such as sans-serif comes out blank. Register the bundled font and draw with it.
const FONT_FAMILY = 'SSR Inter';
GlobalFonts.registerFromPath(path.join(__dirname, '../public/fonts/inter/Inter-Bold.ttf'), FONT_FAMILY);

// Returns a CSS font string for the given pixel size, with sans-serif as a fallback.
function boldFont(px) {
  return `bold ${px}px "${FONT_FAMILY}", sans-serif`;
}

module.exports = {
  boldFont
};
