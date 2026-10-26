// ─── BOQ (Home) → spreadsheet model (pure) ───────────────────────────────────
// Lays the computed BOQ out exactly like the Excel v5 sheet "BOQ (Home)" from row 6 down:
//   row 6 column groups (I6:J6 ค่าวัสดุ, K6:L6 ค่าแรงงาน), row 7 column headers, then per section: header row
//   (B no., C title, fill across B:N), item rows, `รวม >> ` sub-total row (J/L/M = SUM of the section), and after a
//   blank row the grand total (L `รวมต้นทุนก่อสร้างทั้งหมด`, M, N `บาท`). Column A (the Excel navigation bar) is kept
//   narrow, empty and outside the print area so every cell keeps its Excel address. Section 0 is outside the
//   construction total (decision D2) and is shown on its own line under the grand total.
// Rows 1–5 are the header block, in the wording of the Thai estimate forms (v5 cells kept: D2 project, D3 site,
//   D4 owner, M2 revision, M3 date, M4 prepared by; row 5 adds แบบเลขที่ to fill in).
// Print: A4 landscape, fit to one page wide, rows 6–7 repeated, "แผ่นที่ n/N" in the page header.
// The xlsx writer (`xlsx.ts`) only maps sheet models onto ExcelJS; everything testable lives here.

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

/** Colours of BOQ (Home) in v5 (ARGB), and the greys of the summary sheet. */
export const SHEET_FILL = {
    header: 'FFE3EBF9',   // rows 6–7 and section header rows
    input: 'FFFFF2CC',    // yellow input cells
    grandTotal: 'FFF3F3F3',
    grey: 'FFE6E6E6',     // summary sheet: column headers, total
    lightGrey: 'FFF2F2F2',
} as const;

/** The font of Thai official documents (v5 used Cordia New 16, which has the same metrics class). */
export const SHEET_FONT = { name: 'TH Sarabun New', size: 16 } as const;

/** Excel page-header font code for SHEET_FONT. */
const HEADER_FONT = `&"${SHEET_FONT.name},Regular"&14`;

/** Page margins in inches (about 2 cm; header/footer 0.8 cm). */
export const PRINT_MARGINS = { left: 0.79, right: 0.79, top: 0.79, bottom: 0.79, header: 0.31, footer: 0.31 } as const;

export interface SheetCellStyle {
    bold?: boolean;
    /** Font size (default SHEET_FONT.size). */
    size?: number;
    /** Font colour, ARGB. */
    color?: string;
    /** Fill, ARGB. */
    fill?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    wrap?: boolean;
    /** 'dotted' = a dotted bottom line to write on (header fields). */
    border?: 'all' | 'bottom' | 'dotted';
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
    | 'section' | 'heading' | 'item' | 'subtotal' | 'grandTotal' | 'preConstruction'
    | 'words' | 'factorF' | 'band' | 'signature';

export interface SheetRow {
    /** 1-based Excel row number. */
    r: number;
    kind: SheetRowKind;
    height?: number;
    cells: SheetCell[];
}

export interface SheetPrintSetup {
    orientation: 'portrait' | 'landscape';
    /** Printed range, e.g. 'B1:N311' (column A stays off the paper). */
    printArea: string;
    /** Rows repeated at the top of every printed page, e.g. '6:7'. */
    printTitlesRow: string;
    /** Excel page header (codes: &P page, &N pages, &R right section). */
    header: string;
}

/** One worksheet, ready for the xlsx writer. */
export interface SheetModel {
    sheetName: string;
    columnWidths: Partial<Record<SheetCol, number>>;
    rows: SheetRow[];
    merges: string[];
    /** Rows above this one stay frozen. */
    freezeRows: number;
    autoFilter?: string;
    print: SheetPrintSetup;
}

export interface BoqSheetModel extends SheetModel {
    /** Auto-filter range (Excel: B7:N<last body row>). */
    autoFilter: string;
    /** Row of the grand total. */
    grandTotalRow: number;
    /** Sub-total row of each section, by section number (the summary sheet links to J/L/M there). */
    subtotalRows: Record<number, number>;
}

export const SHEET_NAME = 'BOQ (Home)';
export const HEADER_ROW = 7;
export const FIRST_BODY_ROW = 8;

export const SHEET_TEXT = {
    title: 'แบบแสดงรายการ ปริมาณงาน และราคา',
    projectName: 'ชื่อโครงการ',
    siteAddress: 'สถานที่ก่อสร้าง',
    ownerName: 'เจ้าของ/หน่วยงาน',
    drawingNo: 'แบบเลขที่',
    revision: 'ฉบับแก้ไขที่',
    documentDate: 'เมื่อวันที่',
    preparedBy: 'ประมาณราคาโดย',
    groupMat: 'ค่าวัสดุ',
    groupLab: 'ค่าแรงงาน',
    subtotal: 'รวม >> ',
    constructionTotal: 'รวมต้นทุนก่อสร้างทั้งหมด',
    preConstruction: 'ค่าใช้จ่ายก่อนก่อสร้าง (ไม่รวมในต้นทุนก่อสร้าง)',
    baht: 'บาท',
    pageOf: 'แผ่นที่',
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
export function finite(v: number): number {
    return Number.isFinite(v) ? v : 0;
}

/** Text for an Excel header/footer section ("&" is a code there). */
export function headerText(s: string): string {
    return s.replace(/&/g, '&&');
}

/** "&R<font>[label   ]แผ่นที่ &P/&N" */
export function pageHeader(formLabel: string): string {
    const label = formLabel === '' ? '' : `${headerText(formLabel)}   `;
    return `&R${HEADER_FONT}${label}${SHEET_TEXT.pageOf} &P/&N`;
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

/** Header row: B label, D value on a dotted line; K label, M:N value on a dotted line (right pair optional). */
function metaRow(r: number, left: [string, string], right?: [string, string]): SheetRow {
    const label: SheetCellStyle = { bold: true, align: 'left' };
    const value: SheetCellStyle = { align: 'left', border: 'dotted' };
    const cells: SheetCell[] = [
        { col: 'B', value: left[0], style: label },
        { col: 'D', value: left[1].trim(), style: value },
    ];
    if (right !== undefined) {
        cells.push(
            { col: 'K', value: right[0], style: label },
            { col: 'M', value: right[1].trim(), style: value },
            { col: 'N', value: null, style: value },
        );
    }
    return { r, kind: 'meta', height: 24.75, cells };
}

/** The whole BOQ (Home) sheet for a computed BOQ and the project header fields. */
export function buildBoqSheet(boq: BoqResult, meta: ProjectMeta): BoqSheetModel {
    const rows: SheetRow[] = [];
    rows.push({
        r: 1, kind: 'title', height: 36,
        cells: [{ col: 'B', value: SHEET_TEXT.title, style: { bold: true, size: 22, align: 'center' } }],
    });
    rows.push(metaRow(2, [SHEET_TEXT.projectName, meta.projectName], [SHEET_TEXT.revision, meta.revision]));
    rows.push(metaRow(3, [SHEET_TEXT.siteAddress, meta.siteAddress], [SHEET_TEXT.documentDate, meta.documentDate]));
    rows.push(metaRow(4, [SHEET_TEXT.ownerName, meta.ownerName], [SHEET_TEXT.preparedBy, meta.preparedBy]));
    rows.push(metaRow(5, [SHEET_TEXT.drawingNo, '']));

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
    const subtotalRows: Record<number, number> = {};
    for (const s of boq.sections) {
        const out = sectionRows(s, r);
        rows.push(...out.rows);
        (s.inConstructionTotal ? constructionRefs : preRefs).push(`M${out.subtotalRow}`);
        subtotalRows[s.no] = out.subtotalRow;
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
        columnWidths: SHEET_COLUMN_WIDTHS,
        rows,
        merges: ['B1:N1', 'I6:J6', 'K6:L6'],
        freezeRows: HEADER_ROW,
        autoFilter: `B${HEADER_ROW}:N${lastBodyRow}`,
        print: {
            orientation: 'landscape',
            printArea: `B1:N${grandTotalRow + 1}`,
            printTitlesRow: `6:${HEADER_ROW}`,
            header: pageHeader(''),
        },
        grandTotalRow,
        subtotalRows,
    };
}

/** File name for an export of this project, without extension: `BOQ_<project>_Rev<revision>`. */
export function boqFileBaseName(meta: ProjectMeta): string {
    const clean = (s: string) => s.replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const name = clean(meta.projectName);
    const rev = clean(meta.revision);
    return ['BOQ', name, rev === '' ? '' : `Rev${rev}`].filter(p => p !== '').join('_');
}
