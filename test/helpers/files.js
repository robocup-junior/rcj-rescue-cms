const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..');

/** Recursively list files under dir whose name ends with ext. */
function listFiles(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out.sort();
}

/** The fill colours a PDF paints with, as '#rrggbb', read from its (deflated) content streams. */
function pdfFillColours(pdf) {
  const text = pdf.toString('latin1');
  const colours = new Set();
  const start = /stream\r?\n/g;
  let m;
  while ((m = start.exec(text))) {
    const from = m.index + m[0].length;
    let content;
    try {
      content = zlib.inflateSync(pdf.subarray(from, text.indexOf('endstream', from))).toString('latin1');
    } catch (e) {
      continue; // fonts and images
    }
    for (const [, r, g, b] of content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:scn|rg)\b/g)) {
      colours.add('#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''));
    }
  }
  return colours;
}

module.exports = { ROOT, listFiles, pdfFillColours };
