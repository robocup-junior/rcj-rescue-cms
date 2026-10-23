// Exports a run table exactly as shown (filtered rows, visible columns) to an .xlsx file.
// A cell's data-xlsx attribute overrides its text, for cells that show icons instead of text.
function exportRunTableXlsx(table, competitionName, title) {
    const cellText = (cell) => cell.hasAttribute('data-xlsx')
        ? cell.getAttribute('data-xlsx')
        : cell.innerText.replace(/\s+/g, ' ').trim();
    const toValue = (text) => /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;

    const header = Array.from(table.querySelectorAll('thead tr:last-child th'), cellText);
    const rows = Array.from(table.querySelectorAll('tbody tr'),
        (tr) => Array.from(tr.children, (td) => toValue(cellText(td))));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Runs', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow(header);
    rows.forEach((row) => sheet.addRow(row));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
    header.forEach((_, i) => {
        const longest = Math.max(...[header, ...rows].map((r) => String(r[i] ?? '').length));
        sheet.getColumn(i + 1).width = Math.min(Math.max(longest + 4, 8), 60);
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${competitionName} ${title}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
        a.click();
        URL.revokeObjectURL(url);
    });
}
