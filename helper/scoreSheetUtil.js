/**
 * Defines four orientations
 * @type {Readonly<{RIGHT: number, BOTTOM: number, LEFT: number, TOP: number}>}
 */
const DirsEnum = Object.freeze({ RIGHT: 1, BOTTOM: 2, LEFT: 3, TOP: 4 });
module.exports.DirsEnum = DirsEnum;

const InputTypeEnum = Object.freeze({
    FIELD: 'fld',
    FIELDTILE: 'fldtl',
    POSMARK: 'pos',
    CHECKBOX: 'cb',
    TEXT: 'txt',
    MATRIXROW: 'mrow',
    MATRIX: 'm',
    MATRIXTEXT: 'mt',
    QR: 'qr',
});
module.exports.InputTypeEnum = InputTypeEnum;
