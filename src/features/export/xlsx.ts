// ─── BOQ sheet model → .xlsx (ExcelJS) ───────────────────────────────────────
// ExcelJS is loaded on demand so it stays out of the page bundle until the user exports.

import type { Borders, Cell, Workbook } from 'exceljs';
import type { Project } from '@/domain/project';
import { computeProject } from '@/domain/project';
import {
    boqFileBaseName, buildBoqSheet, SHEET_COLUMN_WIDTHS, SHEET_COLUMNS, SHEET_FONT,
    type BoqSheetModel, type SheetCell,
} from './boq-sheet';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } };
const ALL_BORDERS: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const BOTTOM_BORDER: Partial<Borders> = { bottom: THIN };

async function newWorkbook(): Promise<Workbook> {
    // exceljs is CommonJS: its module.exports is the default export (as `import ExcelJS from 'exceljs'` elsewhere).
    const { default: lib } = await import('exceljs');
    return new lib.Workbook();
}

function applyCell(target: Cell, cell: SheetCell) {
    target.value = cell.formula !== undefined
        ? { formula: cell.formula, result: cell.value ?? 0 }
        : cell.value;
    const s = cell.style ?? {};
    target.font = {
        name: SHEET_FONT.name,
        size: s.size ?? SHEET_FONT.size,
        bold: s.bold === true,
        ...(s.color !== undefined ? { color: { argb: s.color } } : {}),
    };
    target.alignment = { vertical: 'middle', ...(s.align !== undefined ? { horizontal: s.align } : {}), wrapText: s.wrap === true };
    if (s.fill !== undefined) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.fill } };
    if (s.border === 'all') target.border = ALL_BORDERS;
    else if (s.border === 'bottom') target.border = BOTTOM_BORDER;
    if (s.numFmt !== undefined) target.numFmt = s.numFmt;
}

/** Builds the workbook for a sheet model (one sheet, laid out like BOQ (Home)). */
export async function writeBoqWorkbook(model: BoqSheetModel): Promise<Workbook> {
    const wb = await newWorkbook();
    wb.creator = 'ConTrack';
    wb.created = new Date();
    const ws = wb.addWorksheet(model.sheetName, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: model.freezeRows, topLeftCell: `A${model.freezeRows + 1}`, showGridLines: false }],
        pageSetup: {
            paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            margins: { left: 0.4, right: 0.2, top: 0.3, bottom: 0.4, header: 0, footer: 0 },
            printTitlesRow: `6:${model.freezeRows}`,
        },
    });
    ws.columns = SHEET_COLUMNS.map(col => ({ key: col, width: SHEET_COLUMN_WIDTHS[col] }));
    for (const row of model.rows) {
        const xr = ws.getRow(row.r);
        if (row.height !== undefined) xr.height = row.height;
        for (const cell of row.cells) applyCell(xr.getCell(cell.col), cell);
    }
    for (const m of model.merges) ws.mergeCells(m);
    ws.autoFilter = model.autoFilter;
    return wb;
}

/** The .xlsx bytes of a project's BOQ. */
export async function boqXlsxBuffer(project: Project): Promise<ArrayBuffer> {
    const { boq } = computeProject(project);
    const wb = await writeBoqWorkbook(buildBoqSheet(boq, project.meta));
    const buf = await wb.xlsx.writeBuffer();
    return buf as ArrayBuffer;
}

/** Downloads the project's BOQ as `BOQ_<project>_Rev<rev>.xlsx` (browser only). */
export async function downloadBoqXlsx(project: Project): Promise<void> {
    const buffer = await boqXlsxBuffer(project);
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: XLSX_MIME }), `${boqFileBaseName(project.meta)}.xlsx`);
}
