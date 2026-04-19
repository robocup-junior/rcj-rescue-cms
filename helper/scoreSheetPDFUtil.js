/**
 * Draws a checkbox with text
 * @param doc The document to draw the checkbox in
 * @param pos_x absolute x-position
 * @param pos_y absolute y-position
 * @param size size of the checkbox
 * @param text text to be shown next to the checkbox (no text if empty string)
 * @param dir direction of the checkbox where the text should be shown
 * @param color
 */

module.exports.drawText = function (doc, pos_x, pos_y, text, size, color) {
    doc.fontSize(size).fillColor(color).text(text, pos_x, pos_y);
};

module.exports.drawTextWithAlign = function (
    doc,
    pos_x,
    pos_y,
    text,
    size,
    color,
    width,
    align
) {
    doc.fontSize(size)
        .fillColor(color)
        .text(text, pos_x, pos_y, { width, align });
};

module.exports.drawImage = function (
    doc,
    pos_x,
    pos_y,
    uri,
    width,
    height,
    align,
    rot = 0
) {
    doc.rotate(rot, { origin: [pos_x + width / 2, pos_y + height / 2] }).image(
        uri,
        pos_x,
        pos_y,
        { fit: [width, height], align }
    );
    doc.rotate(-rot, { origin: [pos_x + width / 2, pos_y + height / 2] });
};

module.exports.drawRectangle = function (doc, pos_x, pos_y, width, height) {
    doc.rect(pos_x, pos_y, width, height).lineWidth(0.3).stroke();
};
