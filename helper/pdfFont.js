"use strict";

const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

// PDFKit draws a string with a single font, so applyFont() splits each string into runs and
// draws every run with the first font in this chain that has its glyphs.
// - Noto Sans CJK: Japanese, Chinese, Korean, plus Latin-1 (German, Spanish, ...), Greek, Cyrillic
// - Noto Sans: the rest of Latin (Polish, Czech, Turkish, Vietnamese, ...), accented Greek
// Each entry lists where the font may be: the project's fonts/ folder first, then system packages.
const FONT_CHAIN = [
  {
    collection: true,
    paths: [
      path.join(__dirname, '../fonts/NotoSansCJK-Regular.ttc'),
      '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc', // Alpine: font-noto-cjk
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', // Debian / Ubuntu: fonts-noto-cjk
      '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc', // Fedora
    ],
  },
  {
    paths: [
      path.join(__dirname, '../fonts/NotoSans-Regular.ttf'),
      '/usr/share/fonts/noto/NotoSans-Regular.ttf', // Alpine: font-noto
      '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf', // Debian / Ubuntu: fonts-noto-core
      '/usr/share/fonts/google-noto/NotoSans-Regular.ttf', // Fedora
    ],
  },
  {
    // Wide coverage on a Mac, for development without the Noto fonts
    paths: ['/System/Library/Fonts/Supplemental/Arial Unicode.ttf'],
  },
];

// Every face in the CJK collection has the same glyphs; the region only decides how Han characters are drawn
const REGIONS = ['jp', 'kr', 'sc', 'tc', 'hk'];

// The PDF layouts were made with PDFKit's default Helvetica, which puts the top of a capital letter
// at the y given to text(). Noto's ascender is much taller than its capitals, so text drawn with it
// sits low. Each font gets Helvetica's vertical metrics, scaled to that font's own capital height.
const HELVETICA = { ascender: 718, descender: -207, lineGap: 231 };

function matchHelveticaMetrics(pdfFont, face) {
  const scale = 1000 / face.unitsPerEm;
  let capHeight = face.capHeight * scale;
  if (!(capHeight > 0)) capHeight = face.glyphForCodePoint(0x48).bbox.maxY * scale; // 'H'
  if (!(capHeight > 0)) return;
  const ratio = capHeight / HELVETICA.ascender;
  pdfFont.ascender = capHeight;
  pdfFont.descender = HELVETICA.descender * ratio;
  pdfFont.lineGap = HELVETICA.lineGap * ratio;
}

let installedFonts;

// The fonts of FONT_CHAIN that are installed, read once and kept in memory
function loadFonts() {
  if (installedFonts) return installedFonts;

  const custom = process.env.PDF_FONT_PATH;
  const chain = custom ? [{ collection: /\.(ttc|otc)$/i.test(custom), paths: [custom] }, ...FONT_CHAIN] : FONT_CHAIN;

  installedFonts = [];
  for (const entry of chain) {
    const file = entry.paths.find((p) => fs.existsSync(p));
    if (!file) continue;
    installedFonts.push({ buffer: fs.readFileSync(file), collection: !!entry.collection });
  }
  return installedFonts;
}

function detectRegion(text) {
  const forced = (process.env.PDF_CJK_REGION || '').toLowerCase();
  if (REGIONS.includes(forced)) return forced;
  if (/[぀-ヿㇰ-ㇿ]/.test(text)) return 'jp';
  if (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(text)) return 'kr';
  if (/[㐀-鿿]/.test(text)) return 'sc';
  return 'jp';
}

// Split text into runs of characters that one font can draw. A run keeps its font while that
// font has the glyph, so a word is not broken up between fonts.
function splitRuns(text, faces) {
  const runs = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const last = runs[runs.length - 1];
    if (last && faces[last.font].hasGlyphForCodePoint(cp)) {
      last.text += ch;
      continue;
    }
    let font = faces.findIndex((face) => face.hasGlyphForCodePoint(cp));
    if (font < 0) font = last ? last.font : 0;
    if (last && last.font === font) last.text += ch;
    else runs.push({ font, text: ch });
  }
  return runs;
}

/**
 * Set fonts on the document so that the text it prints, in any of the languages the CMS is
 * used in, is drawn without missing glyphs.
 * The texts are what the document will print (competition, team and map names, ...); they decide
 * which regional face of Noto Sans CJK is used.
 * Leaves PDFKit's default Helvetica in place when no font is installed.
 * @param {PDFDocument} doc
 * @param {...string} texts
 * @returns {boolean} whether a font was set
 */
function applyFont(doc, ...texts) {
  const fonts = loadFonts();
  if (fonts.length === 0) return false;

  const region = detectRegion(texts.filter(Boolean).join(' '));
  const names = [];
  const faces = [];
  fonts.forEach((font, i) => {
    const family = font.collection ? `NotoSansCJK${region}-Regular` : undefined;
    names.push(`pdf-font-${i}`);
    faces.push(fontkit.create(font.buffer, family));
    doc.registerFont(names[i], font.buffer, family);
    doc.font(names[i]);
    matchHelveticaMetrics(doc._font, faces[i]);
  });
  doc.font(names[0]);
  const ascender = doc._font.ascender;
  if (fonts.length === 1) return true;

  const text = doc.text;
  doc.text = function (str, ...args) {
    const runs = splitRuns(str == null ? '' : String(str), faces);
    if (runs.length <= 1) {
      this.font(names[runs.length ? runs[0].font : 0]);
      text.call(this, str, ...args);
    } else {
      // text(str, options) or text(str, x, y, options)
      const hasPosition = !(args[0] && typeof args[0] === 'object');
      const options = (hasPosition ? args[2] : args[0]) || {};
      if (hasPosition) {
        if (args[0] != null) this.x = args[0];
        if (args[1] != null) this.y = args[1];
      }
      const { x, y } = this;
      const widths = runs.map((run) => {
        this.font(names[run.font]);
        return this.widthOfString(run.text, options);
      });
      const total = widths.reduce((sum, w) => sum + w, 0);
      const width = options.width != null ? options.width : this.page.width - x - this.page.margins.right;

      if (total <= width && !options.continued && !/\n/.test(str)) {
        // One line: place the runs side by side on the baseline of the main font.
        // PDFKit's continued text cannot center or right-align runs in different fonts.
        let runX = x;
        if (options.align === 'center') runX += (width - total) / 2;
        else if (options.align === 'right') runX += width - total;
        const baseline = y + (ascender / 1000) * this._fontSize;
        runs.forEach((run, i) => {
          this.font(names[run.font]);
          text.call(this, run.text, runX, baseline, {
            ...options, width: undefined, align: 'left', lineBreak: false, baseline: 'alphabetic',
          });
          runX += widths[i];
        });
        this.font(names[0]);
        this.x = x;
        this.y = y + this.currentLineHeight(true) + (options.lineGap || this._lineGap || 0);
      } else {
        // Wrapping text: chain the runs; alignment is only approximate
        runs.forEach((run, i) => {
          this.font(names[run.font]);
          text.call(this, run.text, { ...options, continued: i < runs.length - 1 || !!options.continued });
        });
      }
    }
    this.font(names[0]);
    return this;
  };
  return true;
}

module.exports = {
  applyFont
};
