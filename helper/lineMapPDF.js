const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const lineSSR = require('./lineSSR');

const PAPER_SIZES = {
    A4: { width: 595.28, height: 841.89 },
    Letter: { width: 612, height: 792 },
};

function isExistFile(file) {
    try {
        fs.statSync(file);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') return false;
    }
}

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

async function generateAndSendBulkMapImagesPDF(
    res,
    maps,
    competitionName,
    leagueName,
    paperSize = 'A4'
) {
    const validPaperSize = PAPER_SIZES[paperSize] ? paperSize : 'A4';
    const size = PAPER_SIZES[validPaperSize];
    const pageWidth = size.width;
    const pageHeight = size.height;

    const doc = new PDFDocument({
        autoFirstPage: false,
        size: validPaperSize,
        margin: 0,
    });

    const jaFont = getPDFFont();
    if (jaFont) {
        doc.font(jaFont);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `inline; filename="bulk-maps.pdf"; filename*=UTF-8''${encodeURIComponent(`maps-${competitionName}-${leagueName}.pdf`)}`
    );

    doc.pipe(res);

    for (const map of maps) {
        const buffer = await lineSSR.generatePNG(map, map.rule || '2026');
        const img = doc.openImage(buffer);
        let orientation = img.width > img.height ? 'landscape' : 'portrait';

        doc.addPage({
            size: validPaperSize,
            layout: orientation,
            margin: 30,
        });

        const currentPageWidth =
            orientation === 'landscape' ? pageHeight : pageWidth;
        const currentPageHeight =
            orientation === 'landscape' ? pageWidth : pageHeight;

        // Header
        doc.fontSize(14).text(competitionName, { align: 'center' });
        doc.fontSize(11).text(`${leagueName} - ${map.name}`, {
            align: 'center',
        });
        doc.moveDown(1);

        const availableWidth = currentPageWidth - 60;
        const availableHeight = currentPageHeight - 120;

        doc.image(img, 30, 80, {
            fit: [availableWidth, availableHeight],
            align: 'center',
            valign: 'center',
        });
    }

    doc.end();
}

module.exports = {
    generateAndSendBulkMapImagesPDF,
};
