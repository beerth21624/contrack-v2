// ─── BOQ → "สรุป" sheet in the layout of the summary form ปร.5 (pure) ────────
// Rows 1–5 title and header block, row 7 column headers (ลำดับ | รายการ (หมวดงาน) | ค่าวัสดุ | ค่าแรงงาน | รวม |
// หมายเหตุ), one row per construction section linked to its sub-total on BOQ (Home) (J/L/M), รวมค่างานต้นทุน
// (SUM), the amount in Thai words (Excel BAHTTEXT), a blank "Factor F (ถ้ามี)" line (nothing computed), the
// pre-construction cost (section 0) on its own (decision D2), and three signature blocks.
// Cached values come from the computed BOQ, so the file reads right before Excel recalculates.
// Print: A4 portrait, fit to one page wide, row 7 repeated, "รูปแบบตามแบบ ปร.5  แผ่นที่ n/N" in the page header.

import type { BoqResult } from '@/domain/boq/types';
import type { ProjectMeta } from '@/domain/project';
import { bahtText } from './baht-text';
import {
    finite, NUM_FMT, pageHeader, SHEET_FILL,
    type BoqSheetModel, type SheetCell, type SheetCellStyle, type SheetCol, type SheetModel, type SheetRow,
} from './boq-sheet';

export const SUMMARY_SHEET_NAME = 'สรุป';
export const SUMMARY_HEADER_ROW = 7;
export const SUMMARY_FIRST_ROW = 8;

export const SUMMARY_TEXT = {
    formLabel: 'รูปแบบตามแบบ ปร.5',
    title: 'แบบสรุปผลการประมาณราคาค่าก่อสร้าง',
    projectName: 'ชื่อโครงการ',
    revision: 'ฉบับแก้ไขที่',
    siteAddress: 'สถานที่ก่อสร้าง',
    ownerName: 'เจ้าของ/หน่วยงาน',
    drawingNo: 'แบบเลขที่',
    preparedBy: 'ประมาณราคาโดย',
    documentDate: 'เมื่อวันที่',
    colNo: 'ลำดับ',
    colSection: 'รายการ (หมวดงาน)',
    colMat: 'ค่าวัสดุ\n(บาท)',
    colLab: 'ค่าแรงงาน\n(บาท)',
    colTotal: 'รวม\n(บาท)',
    colNote: 'หมายเหตุ',
    constructionTotal: 'รวมค่างานต้นทุน',
    inWords: 'ตัวอักษร',
    factorF: 'Factor F (ถ้ามี)',
    preConstruction: 'ค่าใช้จ่ายก่อนการก่อสร้าง (ไม่รวมในค่างานต้นทุน)',
    preConstructionNote: 'ไม่รวมในค่างานต้นทุน',
    signPrepared: 'ผู้ประมาณราคา',
    signChecked: 'ผู้ตรวจสอบ',
    signApproved: 'ผู้อนุมัติ',
    signName: 'ลงชื่อ',
    signPosition: 'ตำแหน่ง',
    signDate: 'วันที่',
} as const;

/** B ลำดับ, C รายการ, D ค่าวัสดุ, E ค่าแรงงาน, F รวม, G หมายเหตุ (sized for one portrait page at about 90 %). */
export const SUMMARY_COLUMN_WIDTHS: Partial<Record<SheetCol, number>> = {
    A: 2, B: 6, C: 32, D: 15, E: 15, F: 16, G: 12,
};

const TABLE_COLS: SheetCol[] = ['B', 'C', 'D', 'E', 'F', 'G'];
const DOTS = '.'.repeat(36);

/** Sheet reference for formulas, e.g. 'BOQ (Home)'!M14. */
const ref = (sheet: string, cell: string) => `'${sheet.replace(/'/g, "''")}'!${cell}`;
/** An Excel string literal. */
const str = (s: string) => `"${s.replace(/"/g, '""')}"`;

const cellStyle = (extra: SheetCellStyle = {}): SheetCellStyle => ({ border: 'all', valign: 'top', ...extra });
const moneyStyle = (extra: SheetCellStyle = {}): SheetCellStyle =>
    cellStyle({ numFmt: NUM_FMT.accounting, align: 'right', ...extra });

/** Cells for a merged range: the value in the first one, the same style on all (so borders run the whole width). */
function spanCells(cols: SheetCol[], value: string | number | null, style: SheetCellStyle, formula?: string): SheetCell[] {
    return cols.map((col, i): SheetCell => (i === 0 ? { col, value, formula, style } : { col, value: null, style }));
}

const span = (r: number, cols: SheetCol[]) => `${cols[0]}${r}:${cols[cols.length - 1]}${r}`;

export function buildBoqSummarySheet(boq: BoqResult, meta: ProjectMeta, boqSheet: BoqSheetModel): SheetModel {
    const T = SUMMARY_TEXT;
    const rows: SheetRow[] = [];
    const merges: string[] = [];
    const merged = (r: number, cols: SheetCol[]) => { if (cols.length > 1) merges.push(span(r, cols)); };

    rows.push({
        r: 1, kind: 'title', height: 33,
        cells: spanCells(TABLE_COLS, T.title, { bold: true, size: 20, align: 'center', valign: 'middle' }),
    });
    merged(1, TABLE_COLS);

    // Header block: "label  value" on a dotted line; empty values stay as lines to fill in.
    const LEFT: SheetCol[] = ['B', 'C', 'D'];
    const RIGHT: SheetCol[] = ['E', 'F', 'G'];
    const field = (label: string, value: string) => (value.trim() === '' ? label : `${label}  ${value.trim()}`);
    const fieldStyle: SheetCellStyle = { align: 'left', valign: 'bottom', border: 'dotted' };
    const metaRow = (r: number, left: [string, string], right?: [string, string]) => {
        const leftCols = right === undefined ? TABLE_COLS : LEFT;
        const cells = spanCells(leftCols, field(...left), fieldStyle);
        merged(r, leftCols);
        if (right !== undefined) {
            cells.push(...spanCells(RIGHT, field(...right), fieldStyle));
            merged(r, RIGHT);
        }
        rows.push({ r, kind: 'meta', height: 24.75, cells });
    };
    metaRow(2, [T.projectName, meta.projectName], [T.revision, meta.revision]);
    metaRow(3, [T.siteAddress, meta.siteAddress]);
    metaRow(4, [T.ownerName, meta.ownerName], [T.drawingNo, '']);
    metaRow(5, [T.preparedBy, meta.preparedBy], [T.documentDate, meta.documentDate]);
    rows.push({ r: 6, kind: 'spacer', height: 12, cells: [] });

    const headStyle = cellStyle({ bold: true, align: 'center', valign: 'middle', wrap: true, fill: SHEET_FILL.grey });
    rows.push({
        r: SUMMARY_HEADER_ROW, kind: 'columnHeader', height: 45,
        cells: ([
            ['B', T.colNo], ['C', T.colSection], ['D', T.colMat], ['E', T.colLab], ['F', T.colTotal], ['G', T.colNote],
        ] as [SheetCol, string][]).map(([col, value]): SheetCell => ({ col, value, style: headStyle })),
    });

    const sectionRow = (r: number, s: BoqResult['sections'][number], note: string): SheetRow => {
        const sub = boqSheet.subtotalRows[s.no];
        const link = (col: 'J' | 'L' | 'M') => (sub === undefined ? undefined : ref(boqSheet.sheetName, `${col}${sub}`));
        return {
            r, kind: 'section', height: 24,
            cells: [
                { col: 'B', value: s.no, style: cellStyle({ align: 'center', numFmt: NUM_FMT.integer }) },
                { col: 'C', value: s.title.trim(), style: cellStyle({ align: 'left', wrap: true }) },
                { col: 'D', value: finite(s.matTotal), formula: link('J'), style: moneyStyle() },
                { col: 'E', value: finite(s.labTotal), formula: link('L'), style: moneyStyle() },
                { col: 'F', value: finite(s.total), formula: link('M'), style: moneyStyle() },
                { col: 'G', value: note === '' ? null : note, style: cellStyle({ align: 'left', wrap: true }) },
            ],
        };
    };

    let r = SUMMARY_FIRST_ROW;
    const construction = boq.sections.filter(s => s.inConstructionTotal);
    for (const s of construction) rows.push(sectionRow(r++, s, ''));
    const lastSectionRow = r - 1;

    const totalRow = r++;
    const totalStyle = moneyStyle({ bold: true, fill: SHEET_FILL.grey });
    const sumOf = (col: 'D' | 'E' | 'F', value: number): SheetCell => ({
        col, value: finite(value),
        formula: lastSectionRow >= SUMMARY_FIRST_ROW ? `SUM(${col}${SUMMARY_FIRST_ROW}:${col}${lastSectionRow})` : undefined,
        style: totalStyle,
    });
    const constructionTotal = finite(boq.constructionTotal);
    rows.push({
        r: totalRow, kind: 'grandTotal', height: 26.25,
        cells: [
            { col: 'B', value: null, style: totalStyle },
            { col: 'C', value: T.constructionTotal, style: cellStyle({ bold: true, align: 'center', fill: SHEET_FILL.grey }) },
            sumOf('D', construction.reduce((a, s) => a + finite(s.matTotal), 0)),
            sumOf('E', construction.reduce((a, s) => a + finite(s.labTotal), 0)),
            sumOf('F', constructionTotal),
            { col: 'G', value: null, style: totalStyle },
        ],
    });

    const wordsRow = r++;
    rows.push({
        r: wordsRow, kind: 'words', height: 24,
        cells: spanCells(
            TABLE_COLS, `(${T.inWords} ${bahtText(constructionTotal)})`,
            cellStyle({ bold: true, align: 'center', wrap: true }),
            `${str(`(${T.inWords} `)}&BAHTTEXT(F${totalRow})&${str(')')}`,
        ),
    });
    merged(wordsRow, TABLE_COLS);

    rows.push({
        r: r++, kind: 'factorF', height: 24,
        cells: [
            { col: 'B', value: null, style: cellStyle() },
            { col: 'C', value: `${T.factorF} ${'.'.repeat(20)}`, style: cellStyle({ align: 'left' }) },
            ...(['D', 'E', 'F', 'G'] as SheetCol[]).map((col): SheetCell => ({ col, value: null, style: cellStyle() })),
        ],
    });

    const pre = boq.sections.filter(s => !s.inConstructionTotal);
    if (pre.length > 0) {
        r++;
        const bandRow = r++;
        rows.push({
            r: bandRow, kind: 'band', height: 24,
            cells: spanCells(TABLE_COLS, T.preConstruction, cellStyle({ bold: true, align: 'left', fill: SHEET_FILL.lightGrey })),
        });
        merged(bandRow, TABLE_COLS);
        for (const s of pre) rows.push({ ...sectionRow(r++, s, T.preConstructionNote), kind: 'preConstruction' });
    }

    // Signature blocks: ผู้ประมาณราคา (C) | ผู้ตรวจสอบ (D:E) | ผู้อนุมัติ (F:G).
    r += 2;
    const blocks: { cols: SheetCol[]; role: string; name: string }[] = [
        { cols: ['C'], role: T.signPrepared, name: meta.preparedBy.trim() },
        { cols: ['D', 'E'], role: T.signChecked, name: '' },
        { cols: ['F', 'G'], role: T.signApproved, name: '' },
    ];
    const signLines: ((b: typeof blocks[number]) => string)[] = [
        b => b.role,
        () => `${T.signName} ${DOTS}`,
        b => (b.name === '' ? `(${DOTS})` : `( ${b.name} )`),
        () => `${T.signPosition} ${DOTS}`,
        () => `${T.signDate} ${DOTS}`,
    ];
    signLines.forEach((line, i) => {
        const row = r++;
        rows.push({
            r: row, kind: 'signature', height: i === 1 ? 42 : 24,
            cells: blocks.flatMap(b => {
                merged(row, b.cols);
                return spanCells(b.cols, line(b), { align: 'center', valign: 'bottom', bold: i === 0 });
            }),
        });
    });
    const lastRow = r - 1;

    return {
        sheetName: SUMMARY_SHEET_NAME,
        columnWidths: SUMMARY_COLUMN_WIDTHS,
        rows,
        merges,
        freezeRows: SUMMARY_HEADER_ROW,
        print: {
            orientation: 'portrait',
            printArea: `B1:G${lastRow}`,
            printTitlesRow: `${SUMMARY_HEADER_ROW}:${SUMMARY_HEADER_ROW}`,
            header: pageHeader(T.formLabel),
        },
    };
}
