// ─── Dev mode: the number trace as a spreadsheet workbook (one table per sheet, with filters) ───
// ExcelJS is loaded on demand (as src/features/export/xlsx.ts does), so it stays out of the page bundle.
import type { Workbook } from 'exceljs';

export interface TraceSheet {
    name: string;
    columns: { header: string; width: number }[];
    rows: (string | number)[][];
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Sheet names: at most 31 characters, none of : \ / ? * [ ]. */
const sheetName = (name: string): string => name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);

export async function traceWorkbook(sheets: readonly TraceSheet[]): Promise<Workbook> {
    // exceljs is CommonJS: its module.exports is the default export.
    const { default: lib } = await import('exceljs');
    const wb = new lib.Workbook();
    wb.creator = 'ConTrack';
    wb.created = new Date();
    for (const s of sheets) {
        const ws = wb.addWorksheet(sheetName(s.name), { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = s.columns.map(c => ({ header: c.header, width: c.width }));
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        for (const r of s.rows) ws.addRow(r).alignment = { vertical: 'top', wrapText: true };
        if (s.columns.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, s.rows.length + 1), column: s.columns.length } };
    }
    return wb;
}

export async function downloadTraceWorkbook(sheets: readonly TraceSheet[], fileBase: string): Promise<void> {
    const wb = await traceWorkbook(sheets);
    const buffer = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: XLSX_MIME }), `${fileBase}.xlsx`);
}
