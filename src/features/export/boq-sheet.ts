// ─── BOQ (Home) → spreadsheet model (pure) ───────────────────────────────────
// Lays the computed BOQ out exactly like the Excel v5 sheet "BOQ (Home)":
//   row 1 title, rows 2–4 header block (B/D and K/M), row 6 column groups (I6:J6 ค่าวัสดุ, K6:L6 ค่าแรงงาน),
//   row 7 column headers, then per section: header row (B no., C title, fill across B:N), item rows,
//   `รวม >> ` sub-total row (J/L/M = SUM of the section), and after a blank row the grand total
//   (L `รวมต้นทุนก่อสร้างทั้งหมด`, M, N `บาท`). Column A (the Excel navigation bar) is kept narrow and empty so every
//   cell keeps its Excel address. Section 0 is outside the construction total (decision D2) and is shown on its own
//   line under the grand total.
// The xlsx writer (`xlsx.ts`) only maps this model onto ExcelJS; everything testable lives here.

import type { BoqItemRow, BoqResult, BoqSectionResult } from '@/domain/boq/types';
import type { ProjectMeta } from '@/domain/project';

export type SheetCol = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N';

export const SHEET_COLUMNS: readonly SheetCol[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

/** Column widths of BOQ (Home) in v5 (A is the navigation bar there: kept as a thin margin). */
export const SHEET_COLUMN_WIDTHS: Record<SheetCol, number> = {
    A: 2, B: 7.71, C: 13.43, D: 56.14, E: 13, F: 13, G: 13, H: 13, I: 13, J: 13, K: 13, L: 13, M: 18.71, N: 32.29,
};

/** Number formats used by BOQ (Home) in v5. */
export const NUM_FMT = {
    /** E, H, I, J, K, L, M of item and sub-total rows (zero shows as "-"). */
    accounting: '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@',
    /** G (waste, stored as a fraction). */
    percent: '0%',
    /** M310 grand total. */
    grandTotal: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)',
    /** B section number (0.0 in Excel, shown 0, 1, 2 …). */
    integer: '0',
} as const;

/** Colours of BOQ (Home) in v5 (ARGB). */
export const SHEET_FILL = {
    header: 'FFE3EBF9',   // rows 6–7 and section header rows
    input: 'FFFFF2CC',    // yellow input cells
    grandTotal: 'FFF3F3F3',
} as const;

export const SHEET_FONT = { name: 'Cordia New', size: 16 } as const;

export interface SheetCellStyle {
    bold?: boolean;
    /** Font size (default SHEET_FONT.size). */
    size?: number;
    /** Font colour, ARGB. */
    color?: string;
    /** Fill, ARGB. */
    fill?: string;
    align?: 'left' | 'center' | 'right';
    wrap?: boolean;
    border?: 'all' | 'bottom';
    numFmt?: string;
}

export interface SheetCell {
    col: SheetCol;
    value: string | number | null;
    /** Excel formula (without "="); `value` is its cached result. */
    formula?: string;
    style?: SheetCellStyle;
}

export type SheetRowKind =
    | 'title' | 'meta' | 'spacer' | 'groupHeader' | 'columnHeader'
    | 'section' | 'heading' | 'item' | 'subtotal' | 'grandTotal' | 'preConstruction';

export interface SheetRow {
    /** 1-based Excel row number. */
    r: number;
    kind: SheetRowKind;
    height?: number;
    cells: SheetCell[];
}

export interface BoqSheetModel {
    sheetName: string;
    rows: SheetRow[];
    merges: string[];
    /** Rows above this one stay frozen (Excel: ySplit 7). */
    freezeRows: number;
    /** Auto-filter range (Excel: B7:N<last body row>). */
    autoFilter: string;
    /** Row of the grand total. */
    grandTotalRow: number;
}

export const SHEET_NAME = 'BOQ (Home)';
export const HEADER_ROW = 7;
export const FIRST_BODY_ROW = 8;

export const SHEET_TEXT = {
    title: '  โปรแกรมประมาณราคางานก่อสร้าง (BOQ)',
    projectName: '  📂 โครงการ',
    siteAddress: '  📍 สถานที่ก่อสร้าง',
    ownerName: '  👤 เจ้าของบ้าน',
    revision: '📝 Revision',
    documentDate: '📅 Date',
    preparedBy: '👤 Prepared By',
    groupMat: 'ค่าวัสดุ',
    groupLab: 'ค่าแรงงาน',
    subtotal: 'รวม >> ',
    constructionTotal: 'รวมต้นทุนก่อสร้างทั้งหมด',
    preConstruction: 'ค่าใช้จ่ายก่อนก่อสร้าง (ไม่รวมในต้นทุนก่อสร้าง)',
    baht: 'บาท',
} as const;

/** Row 7 headers, verbatim from v5 (H has a line break in Excel). */
export const COLUMN_HEADERS: [SheetCol, string][] = [
    ['B', 'No.'], ['C', 'ขั้นตอน'], ['D', 'รายการ'], ['E', 'ปริมาณ'], ['F', 'หน่วย'], ['G', '%เผื่อ'],
    ['H', 'ปริมาณ\nเผื่อแล้ว'], ['I', 'ต่อหน่วย'], ['J', 'รวม'], ['K', 'ต่อหน่วย'], ['L', 'รวม'], ['M', 'รวมทั้งหมด'],
    ['N', 'หมายเหตุ'],
];

const BODY_COLS: SheetCol[] = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

const money = (fill?: string): SheetCellStyle => ({ numFmt: NUM_FMT.accounting, align: 'right', border: 'all', fill });

/** A finite number, or 0 (the engine never returns NaN, but a corrupt input must not break the file). */
function finite(v: number): number {
    return Number.isFinite(v) ? v : 0;
}

function itemCells(row: BoqItemRow): SheetCell[] {
    const qtyIsInput = row.qtySource === 'input';
    return [
        { col: 'B', value: null, style: { border: 'all' } },
        { col: 'C', value: row.itemNo ?? null, style: { align: 'center', border: 'all' } },
        { col: 'D', value: row.desc, style: { align: 'left', border: 'all' } },
        { col: 'E', value: row.qtySource === 'none' ? null : finite(row.qty), style: money(qtyIsInput ? SHEET_FILL.input : undefined) },
        { col: 'F', value: row.unit, style: { align: 'center', border: 'all' } },
        { col: 'G', value: finite(row.waste), style: { numFmt: NUM_FMT.percent, align: 'right', border: 'all', fill: SHEET_FILL.input } },
        { col: 'H', value: row.grossQty === null ? null : finite(row.grossQty), style: money() },
        { col: 'I', value: finite(row.matUnit), style: money(SHEET_FILL.input) },
        { col: 'J', value: finite(row.matTotal), style: money() },
        { col: 'K', value: finite(row.labUnit), style: money(SHEET_FILL.input) },
        { col: 'L', value: finite(row.labTotal), style: money() },
        { col: 'M', value: finite(row.total), style: money() },
        { col: 'N', value: row.note ?? null, style: { align: 'left', border: 'all' } },
    ];
}

function sectionRows(s: BoqSectionResult, startRow: number): { rows: SheetRow[]; subtotalRow: number } {
    const rows: SheetRow[] = [];
    let r = startRow;
    rows.push({
        r: r++, kind: 'section', height: 24,
        cells: BODY_COLS.map((col): SheetCell => {
            const base: SheetCellStyle = { fill: SHEET_FILL.header, bold: true, border: 'all' };
            if (col === 'B') return { col, value: s.no, style: { ...base, align: 'center', numFmt: NUM_FMT.integer } };
            if (col === 'C') return { col, value: s.title.trim(), style: { ...base, align: 'left' } };
            return { col, value: null, style: base };
        }),
    });
    const first = r;
    for (const row of s.rows) {
        if (row.type === 'heading') {
            rows.push({
                r: r++, kind: 'heading', height: 24,
                cells: BODY_COLS.map((col): SheetCell => {
                    if (col === 'C') return { col, value: row.itemNo ?? null, style: { align: 'center', border: 'all' } };
                    if (col === 'D') return { col, value: row.desc, style: { align: 'left', border: 'all' } };
                    return { col, value: null, style: { border: 'all' } };
                }),
            });
        } else {
            rows.push({ r: r++, kind: 'item', height: 24, cells: itemCells(row) });
        }
    }
    const last = r - 1;
    const sum = (col: 'J' | 'L' | 'M', value: number): SheetCell => ({
        col, value: finite(value),
        formula: last >= first ? `SUM(${col}${first}:${col}${last})` : undefined,
        style: { ...money(), bold: true },
    });
    const subtotalRow = r;
    rows.push({
        r: r++, kind: 'subtotal', height: 24,
        cells: BODY_COLS.map((col): SheetCell => {
            if (col === 'D') return { col, value: SHEET_TEXT.subtotal, style: { bold: true, align: 'right', border: 'all' } };
            if (col === 'J') return sum('J', s.matTotal);
            if (col === 'L') return sum('L', s.labTotal);
            if (col === 'M') return sum('M', s.total);
            return { col, value: null, style: { border: 'all' } };
        }),
    });
    return { rows, subtotalRow };
}

function metaRow(r: number, left: [string, string], right: [string, string], border: 'bottom'): SheetRow {
    return {
        r, kind: 'meta', height: 24.75,
        cells: [
            { col: 'B', value: left[0], style: { bold: true, border } },
            { col: 'C', value: null, style: { border } },
            { col: 'D', value: left[1], style: { border } },
            { col: 'K', value: right[0], style: { bold: true, border } },
            { col: 'L', value: null, style: { border } },
            { col: 'M', value: right[1], style: { align: 'left', border } },
        ],
    };
}

/** The whole BOQ (Home) sheet for a computed BOQ and the project header fields. */
export function buildBoqSheet(boq: BoqResult, meta: ProjectMeta): BoqSheetModel {
    const rows: SheetRow[] = [];
    const projectName = meta.projectName.trim();
    rows.push({
        r: 1, kind: 'title', height: 58.5,
        cells: [{
            col: 'B',
            value: projectName === '' ? SHEET_TEXT.title : `${SHEET_TEXT.title}\n  ${projectName}`,
            style: { bold: true, size: 23, wrap: true },
        }],
    });
    rows.push(metaRow(2, [SHEET_TEXT.projectName, meta.projectName], [SHEET_TEXT.revision, meta.revision], 'bottom'));
    rows.push(metaRow(3, [SHEET_TEXT.siteAddress, meta.siteAddress], [SHEET_TEXT.documentDate, meta.documentDate], 'bottom'));
    rows.push(metaRow(4, [SHEET_TEXT.ownerName, meta.ownerName], [SHEET_TEXT.preparedBy, meta.preparedBy], 'bottom'));
    rows.push({ r: 5, kind: 'spacer', cells: [] });

    const headerStyle: SheetCellStyle = { fill: SHEET_FILL.header, bold: true, align: 'center', border: 'all', wrap: true };
    rows.push({
        r: 6, kind: 'groupHeader', height: 24.75,
        cells: BODY_COLS.map((col): SheetCell => ({
            col,
            value: col === 'I' ? SHEET_TEXT.groupMat : col === 'K' ? SHEET_TEXT.groupLab : null,
            style: headerStyle,
        })),
    });
    rows.push({
        r: HEADER_ROW, kind: 'columnHeader', height: 49.5,
        cells: COLUMN_HEADERS.map(([col, value]): SheetCell => ({ col, value, style: headerStyle })),
    });

    let r = FIRST_BODY_ROW;
    const constructionRefs: string[] = [];
    const preRefs: string[] = [];
    for (const s of boq.sections) {
        const out = sectionRows(s, r);
        rows.push(...out.rows);
        (s.inConstructionTotal ? constructionRefs : preRefs).push(`M${out.subtotalRow}`);
        r += out.rows.length;
    }
    const lastBodyRow = r - 1;

    const grandTotalRow = lastBodyRow + 2;   // Excel: sub-total row 308, blank 309, grand total 310
    rows.push({
        r: grandTotalRow, kind: 'grandTotal', height: 26.25,
        cells: [
            { col: 'L', value: SHEET_TEXT.constructionTotal, style: { bold: true, align: 'right' } },
            {
                col: 'M', value: finite(boq.constructionTotal),
                formula: constructionRefs.length > 0 ? constructionRefs.join('+') : undefined,
                style: { bold: true, size: 20, color: 'FF7F7F7F', fill: SHEET_FILL.grandTotal, align: 'right', numFmt: NUM_FMT.grandTotal },
            },
            { col: 'N', value: SHEET_TEXT.baht, style: { align: 'left' } },
        ],
    });
    rows.push({
        r: grandTotalRow + 1, kind: 'preConstruction', height: 24,
        cells: [
            { col: 'L', value: SHEET_TEXT.preConstruction, style: { align: 'right' } },
            {
                col: 'M', value: finite(boq.preConstructionTotal),
                formula: preRefs.length > 0 ? preRefs.join('+') : undefined,
                style: { align: 'right', numFmt: NUM_FMT.grandTotal },
            },
            { col: 'N', value: SHEET_TEXT.baht, style: { align: 'left' } },
        ],
    });

    return {
        sheetName: SHEET_NAME,
        rows,
        merges: ['I6:J6', 'K6:L6'],
        freezeRows: HEADER_ROW,
        autoFilter: `B${HEADER_ROW}:N${lastBodyRow}`,
        grandTotalRow,
    };
}

/** File name for an export of this project, without extension: `BOQ_<project>_Rev<revision>`. */
export function boqFileBaseName(meta: ProjectMeta): string {
    const clean = (s: string) => s.replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const name = clean(meta.projectName);
    const rev = clean(meta.revision);
    return ['BOQ', name, rev === '' ? '' : `Rev${rev}`].filter(p => p !== '').join('_');
}
