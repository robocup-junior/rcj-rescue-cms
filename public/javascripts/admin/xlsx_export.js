// Exports a table exactly as shown (visible rows and columns) to an .xlsx file.
// - Multi-row headers are flattened into one row ("Games / Round 1").
// - A cell's data-xlsx attribute overrides its text; images contribute their alt text.
// - The file is named after the sheet header row (competition name + title) when present.
function exportTableXlsx(table) {
    const visible = (el) => el.getClientRects().length > 0;
    const textOf = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE || !visible(node)) return '';
        if (node.tagName === 'IMG') return node.alt ? ` ${node.alt} ` : '';
        return Array.from(node.childNodes, textOf).join('');
    };
    const cellText = (cell) => (cell.hasAttribute('data-xlsx') ? cell.getAttribute('data-xlsx') : textOf(cell))
        .replace(/\s+/g, ' ').trim();
    const toValue = (text) => /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;

    // Lay the header cells out on a grid so rowspan/colspan land on the right columns
    const headRows = Array.from(table.tHead.rows).filter((tr) => !tr.classList.contains('sheet-header-row'));
    const grid = headRows.map(() => []);
    headRows.forEach((tr, r) => {
        let c = 0;
        Array.from(tr.cells).filter(visible).forEach((cell) => {
            while (grid[r][c] !== undefined) c++;
            const text = cellText(cell);
            for (let dr = 0; dr < cell.rowSpan && r + dr < grid.length; dr++) {
                for (let dc = 0; dc < cell.colSpan; dc++) grid[r + dr][c + dc] = text;
            }
            c += cell.colSpan;
        });
    });
    const width = Math.max(0, ...grid.map((row) => row.length));
    const header = Array.from({ length: width }, (_, c) =>
        grid.map((row) => row[c]).filter((t, i, all) => t && t !== all[i - 1]).join(' / '));

    const rows = Array.from(table.tBodies).flatMap((tbody) => Array.from(tbody.rows).filter(visible))
        .map((tr) => Array.from(tr.cells).filter(visible).map((td) => toValue(cellText(td))));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow(header);
    rows.forEach((row) => sheet.addRow(row));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(width, 1) } };
    header.forEach((_, i) => {
        const longest = Math.max(...[header, ...rows].map((r) => String(r[i] ?? '').length));
        sheet.getColumn(i + 1).width = Math.min(Math.max(longest + 4, 8), 60);
    });

    const titleParts = Array.from(table.querySelectorAll('.sheet-header-row h3, .sheet-header-row h2'), cellText);
    const name = titleParts.filter(Boolean).join(' ') || 'export';

    workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
        a.click();
        URL.revokeObjectURL(url);
    });
}
