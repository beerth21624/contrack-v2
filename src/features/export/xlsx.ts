// ─── Sheet models → .xlsx (ExcelJS) ──────────────────────────────────────────
// ExcelJS is loaded on demand so it stays out of the page bundle until the user exports.
// The workbook holds the ปร.5-style summary "สรุป" first (it is what a submission starts with), then BOQ (Home).

import type { Borders, Cell, Workbook } from 'exceljs';
import type { Project } from '@/domain/project';
import { computeProject } from '@/domain/project';
import {
    boqFileBaseName, buildBoqSheet, PRINT_MARGINS, SHEET_COLUMNS, SHEET_FONT,
    type SheetCell, type SheetModel,
} from './boq-sheet';
import { buildBoqSummarySheet } from './boq-summary-sheet';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } };
const DOTTED = { style: 'dotted' as const, color: { argb: 'FF000000' } };
const ALL_BORDERS: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const BOTTOM_BORDER: Partial<Borders> = { bottom: THIN };
const DOTTED_BOTTOM: Partial<Borders> = { bottom: DOTTED };

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
    target.alignment = {
        vertical: s.valign ?? 'middle',
        ...(s.align !== undefined ? { horizontal: s.align } : {}),
        wrapText: s.wrap === true,
    };
    if (s.fill !== undefined) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.fill } };
    if (s.border === 'all') target.border = ALL_BORDERS;
    else if (s.border === 'bottom') target.border = BOTTOM_BORDER;
    else if (s.border === 'dotted') target.border = DOTTED_BOTTOM;
    if (s.numFmt !== undefined) target.numFmt = s.numFmt;
}

function addSheet(wb: Workbook, model: SheetModel) {
    const ws = wb.addWorksheet(model.sheetName, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: model.freezeRows, topLeftCell: `A${model.freezeRows + 1}`, showGridLines: false }],
        pageSetup: {
            paperSize: 9,   // A4
            orientation: model.print.orientation,
            fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            horizontalCentered: true,
            margins: { ...PRINT_MARGINS },
            printArea: model.print.printArea,
            printTitlesRow: model.print.printTitlesRow,
        },
        headerFooter: { oddHeader: model.print.header },
    });
    ws.columns = SHEET_COLUMNS.map(col => ({ key: col, width: model.columnWidths[col] ?? 2 }));
    for (const row of model.rows) {
        const xr = ws.getRow(row.r);
        if (row.height !== undefined) xr.height = row.height;
        for (const cell of row.cells) applyCell(xr.getCell(cell.col), cell);
    }
    for (const m of model.merges) ws.mergeCells(m);
    if (model.autoFilter !== undefined) ws.autoFilter = model.autoFilter;
}

/** Builds a workbook with one worksheet per sheet model, in order. */
export async function writeBoqWorkbook(...models: SheetModel[]): Promise<Workbook> {
    const wb = await newWorkbook();
    wb.creator = 'ConTrack';
    wb.created = new Date();
    // Cached results are written, but ExcelJS drops zero ones; recalculating on open also fills BAHTTEXT and links.
    wb.calcProperties.fullCalcOnLoad = true;
    for (const model of models) addSheet(wb, model);
    return wb;
}

/** The .xlsx bytes of a project's BOQ: the "สรุป" summary sheet, then BOQ (Home). */
export async function boqXlsxBuffer(project: Project): Promise<ArrayBuffer> {
    const { boq } = computeProject(project);
    const home = buildBoqSheet(boq, project.meta);
    const wb = await writeBoqWorkbook(buildBoqSummarySheet(boq, project.meta, home), home);
    const buf = await wb.xlsx.writeBuffer();
    return buf as ArrayBuffer;
}

/** Downloads the project's BOQ as `BOQ_<project>_Rev<rev>.xlsx` (browser only). */
export async function downloadBoqXlsx(project: Project): Promise<void> {
    const buffer = await boqXlsxBuffer(project);
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: XLSX_MIME }), `${boqFileBaseName(project.meta)}.xlsx`);
}
