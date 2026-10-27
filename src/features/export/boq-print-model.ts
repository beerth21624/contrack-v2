// ─── BOQ → printable document model (pure) ───────────────────────────────────
// Laid out like the Thai public-sector estimate forms (format only; no agency, no Factor F computed):
//   ปร.5 summary — header block, one line per construction section (material, labour, total), the construction
//                  cost total (figures and Thai words), a blank "Factor F (ถ้ามี)" line, the pre-construction cost
//                  (section 0) on its own (decision D2), and three signature blocks.
//   ปร.4 detail  — header block, then per section: a bold section row, its items, "รวมหมวดที่ n"; the construction
//                  cost total; then section 0 under its own heading. Rows with neither a quantity nor an amount are
//                  left out (a blank project has hundreds of them); a heading is kept only when one of its rows is.
// Every number comes from the computed BOQ; nothing is recalculated here.

import type { BoqHeadingRow, BoqItemRow, BoqResult, BoqSectionResult } from '@/domain/boq/types';
import type { ProjectMeta } from '@/domain/project';
import { bahtText } from './baht-text';

/** Which forms to print. */
export type PrintPart = 'all' | 'summary' | 'detail';

export interface PrintSummaryLine {
    no: number;
    title: string;
    matTotal: number;
    labTotal: number;
    total: number;
}

export type PrintDetailRow =
    | {
        type: 'heading'; key: string; itemNo: string; desc: string;
        /** An un-numbered group heading (e.g. "งานคานดาดฟ้า"): the rows under it are numbered from 1) again. */
        group: boolean;
    }
    | {
        type: 'item'; key: string; itemNo: string; desc: string; unit: string;
        /** Quantity shown in จำนวน (net qty; gross qty when every amount of the row is priced on it). */
        qty: number | null;
        matUnit: number; matTotal: number; labUnit: number; labTotal: number; total: number;
        note: string;
        /** Says which amount is priced on the gross quantity (waste allowance), when it is not the shown one. */
        qtyNote: string;
    };

export interface PrintDetailSection {
    no: number;
    title: string;
    inConstructionTotal: boolean;
    rows: PrintDetailRow[];
    matTotal: number;
    labTotal: number;
    total: number;
    /** "รวมหมวดที่ n" */
    subtotalLabel: string;
}

export type PrintHeaderFieldKey =
    | 'projectName' | 'revision' | 'siteAddress' | 'ownerName' | 'drawingNo' | 'preparedBy' | 'documentDate';

export interface PrintHeaderField {
    key: PrintHeaderFieldKey;
    label: string;
    /** Trimmed; '' prints as a blank (dotted) line to fill in by hand. */
    value: string;
    /** Spans the whole header width (otherwise half of a two-column row). */
    wide: boolean;
}

/** Header block printed at the top of each form. */
export interface PrintPageHeader {
    /** Top-right form label, e.g. "รูปแบบตามแบบ ปร.5". */
    formLabel: string;
    title: string;
    /** In display order: left/right pairs, `wide` fields on their own row. */
    fields: PrintHeaderField[];
}

export interface PrintSignature {
    role: string;
    /** Name printed in the parentheses ('' = blank line). */
    name: string;
}

export interface BoqPrintModel {
    projectName: string;
    summaryHeader: PrintPageHeader;
    detailHeader: PrintPageHeader;
    /** Construction sections (in the construction total). */
    summary: PrintSummaryLine[];
    constructionMat: number;
    constructionLab: number;
    constructionTotal: number;
    constructionTotalText: string;
    /** Sections outside the construction total (section 0, land inspection). */
    preConstruction: PrintSummaryLine[];
    preConstructionTotal: number;
    /** Detail of the construction sections that have something to show. */
    details: PrintDetailSection[];
    /** Detail of the pre-construction sections that have something to show. */
    preConstructionDetails: PrintDetailSection[];
    signatures: PrintSignature[];
}

export interface BoqPrintOptions {
    /** แบบเลขที่ (drawing number); not part of the project data yet, so blank by default. */
    drawingNo?: string;
}

export const PRINT_TEXT = {
    formSummary: 'รูปแบบตามแบบ ปร.5',
    formDetail: 'รูปแบบตามแบบ ปร.4',
    summaryTitle: 'แบบสรุปผลการประมาณราคาค่าก่อสร้าง',
    detailTitle: 'แบบแสดงรายการ ปริมาณงาน และราคา',
    projectName: 'ชื่อโครงการ',
    revision: 'ฉบับแก้ไขที่',
    siteAddress: 'สถานที่ก่อสร้าง',
    ownerName: 'เจ้าของ/หน่วยงาน',
    drawingNo: 'แบบเลขที่',
    preparedBy: 'ประมาณราคาโดย',
    documentDate: 'เมื่อวันที่',
    colNo: 'ลำดับที่',
    colDesc: 'รายการ',
    colSection: 'รายการ (หมวดงาน)',
    colQty: 'จำนวน',
    colUnit: 'หน่วย',
    colMat: 'ค่าวัสดุ',
    colLab: 'ค่าแรงงาน',
    colUnitPrice: 'ราคาต่อหน่วย',
    colAmount: 'จำนวนเงิน',
    colMatLab: 'รวมค่าวัสดุและค่าแรงงาน',
    colTotal: 'รวม',
    colNote: 'หมายเหตุ',
    currency: '(บาท)',
    subtotalPrefix: 'รวมหมวดที่',
    constructionTotal: 'รวมค่างานต้นทุน',
    inWords: 'ตัวอักษร',
    factorF: 'Factor F (ถ้ามี)',
    preConstruction: 'ค่าใช้จ่ายก่อนการก่อสร้าง (ไม่รวมในค่างานต้นทุน)',
    preConstructionNote: 'ไม่รวมในค่างานต้นทุน',
    baht: 'บาท',
    signPrepared: 'ผู้ประมาณราคา',
    signChecked: 'ผู้ตรวจสอบ',
    signApproved: 'ผู้อนุมัติ',
    signName: 'ลงชื่อ',
    signPosition: 'ตำแหน่ง',
    signDate: 'วันที่',
    pageOf: 'แผ่นที่',
    matShort: 'ค่าวัสดุ',
    labShort: 'ค่าแรง',
    pricedAt: 'คิดที่',
    allowance: 'เผื่อ',
    grossIncluded: 'ปริมาณรวมเผื่อแล้ว',
    grossRounded: 'ปริมาณปัดเศษแล้ว',
    nothing: 'ยังไม่มีรายการ',
} as const;

const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/** An item worth printing: it has a quantity or an amount. */
export function isPrintableItem(r: BoqItemRow): boolean {
    return finite(r.total) !== 0 || (r.qtySource !== 'none' && finite(r.qty) !== 0) || (r.grossQty !== null && finite(r.grossQty) !== 0);
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 1e-9);

/**
 * Which quantity an amount is priced on: 'gross' when unit price × gross qty gives it and × net qty does not,
 * 'net' when × net qty gives it, otherwise 'other' (zero, or no simple product: nothing to explain).
 */
function amountBasis(unit: number, amount: number, net: number, gross: number): 'net' | 'gross' | 'other' {
    if (amount === 0 || unit === 0) return 'other';
    if (close(unit * net, amount)) return 'net';
    if (close(unit * gross, amount)) return 'gross';
    return 'other';
}

/** Waste fraction → "10%" (up to 2 decimals). */
function wastePct(v: number): string {
    return `${(v * 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })}%`;
}

/**
 * The quantity for the จำนวน column and, when an amount is priced on the other quantity, a note saying so — so
 * จำนวน × ราคาต่อหน่วย = จำนวนเงิน can be checked on paper (material is mostly priced on the gross quantity, labour
 * on the net one: Excel J = I×H, L = K×E).
 */
export function quantityBasis(r: BoqItemRow): { qty: number | null; qtyNote: string } {
    const gross = r.grossQty === null ? null : finite(r.grossQty);
    if (r.qtySource === 'none') return { qty: gross, qtyNote: '' };
    const net = finite(r.qty);
    if (gross === null || close(gross, net)) return { qty: net, qtyNote: '' };
    const mat = amountBasis(finite(r.matUnit), finite(r.matTotal), net, gross);
    const lab = amountBasis(finite(r.labUnit), finite(r.labTotal), net, gross);
    const waste = finite(r.waste);
    if (mat !== 'net' && lab !== 'net' && (mat === 'gross' || lab === 'gross')) {
        // every priced amount uses the gross quantity: show it, and say it includes the allowance
        return { qty: gross, qtyNote: waste > 0 ? `${PRINT_TEXT.grossIncluded} ${wastePct(waste)}` : PRINT_TEXT.grossRounded };
    }
    const who = mat === 'gross' && lab === 'gross'
        ? `${PRINT_TEXT.matShort}และ${PRINT_TEXT.labShort}`
        : mat === 'gross' ? PRINT_TEXT.matShort : lab === 'gross' ? PRINT_TEXT.labShort : '';
    if (who === '') return { qty: net, qtyNote: '' };
    const unit = r.unit.trim();
    const allowance = waste > 0 ? ` (${PRINT_TEXT.allowance} ${wastePct(waste)})` : '';
    return { qty: net, qtyNote: `${who}${PRINT_TEXT.pricedAt} ${fmtQty(gross)}${unit !== '' ? ` ${unit}` : ''}${allowance}` };
}

function detailItem(r: BoqItemRow): PrintDetailRow {
    const { qty, qtyNote } = quantityBasis(r);
    return {
        type: 'item', key: r.key, itemNo: (r.itemNo ?? '').trim(), desc: r.desc, unit: r.unit, qty,
        matUnit: finite(r.matUnit), matTotal: finite(r.matTotal),
        labUnit: finite(r.labUnit), labTotal: finite(r.labTotal),
        total: finite(r.total),
        note: (r.note ?? '').trim(),
        qtyNote,
    };
}

const numbered = (itemNo: string | undefined) => (itemNo ?? '').trim() !== '';

/**
 * The printed rows of a section. Rows with nothing to price are left out, so the numbered rows ("1)", "2)" …) are
 * numbered again in print order: a form must not jump from 1) to 3). Un-numbered sub-items keep their blank number.
 *
 * Two kinds of heading come before items:
 *   - an un-numbered group heading (section 12 "งานคานดาดฟ้า" / "งานพื้นดาดฟ้า", section 26 "งานตู้ควบคุมระบบไฟฟ้า" /
 *     "อุปกรณ์ไฟฟ้า") opens a group that the template numbers from 1) again; it runs to the next group heading;
 *   - a numbered heading ("1) เหล็กเสริม") heads the un-numbered sub-items after it; the next numbered row ends it.
 * Each is printed just before the first printed item under it, and only then; a printed group heading restarts
 * the count, so where nothing was left out the printed numbers are the template's (and the Excel export's).
 */
function detailRows(s: BoqSectionResult): PrintDetailRow[] {
    const out: PrintDetailRow[] = [];
    let group: BoqHeadingRow | null = null;   // group heading not printed yet
    let head: BoqHeadingRow | null = null;    // numbered heading not printed yet
    let n = 0;
    const renumber = (itemNo: string | undefined) => (numbered(itemNo) ? `${++n})` : '');
    for (const r of s.rows) {
        if (r.type === 'heading') {
            if (numbered(r.itemNo)) {
                head = r;
            } else {
                group = r;
                head = null;
            }
            continue;
        }
        if (numbered(r.itemNo)) head = null;   // a numbered item ends the numbered heading's sub-items
        if (!isPrintableItem(r)) continue;
        if (group !== null) {
            out.push({ type: 'heading', key: group.key, itemNo: '', desc: group.desc, group: true });
            group = null;
            n = 0;
        }
        if (head !== null) {
            out.push({ type: 'heading', key: head.key, itemNo: renumber(head.itemNo), desc: head.desc, group: false });
            head = null;
        }
        out.push({ ...detailItem(r), itemNo: renumber(r.itemNo) });
    }
    return out;
}

function summaryLine(s: BoqSectionResult): PrintSummaryLine {
    return {
        no: s.no, title: s.title.trim(),
        matTotal: finite(s.matTotal), labTotal: finite(s.labTotal), total: finite(s.total),
    };
}

function detailSection(s: BoqSectionResult): PrintDetailSection {
    return {
        no: s.no, title: s.title.trim(), inConstructionTotal: s.inConstructionTotal,
        rows: detailRows(s),
        matTotal: finite(s.matTotal), labTotal: finite(s.labTotal), total: finite(s.total),
        subtotalLabel: `${PRINT_TEXT.subtotalPrefix} ${s.no}`,
    };
}

const hasItems = (s: PrintDetailSection) => s.rows.some(r => r.type === 'item');

/** The header fields, the same on both forms (blank values stay, as lines to fill in). */
export function buildHeaderFields(meta: ProjectMeta, options: BoqPrintOptions = {}): PrintHeaderField[] {
    const f = (key: PrintHeaderFieldKey, value: string | undefined, wide = false): PrintHeaderField => ({
        key, label: PRINT_TEXT[key], value: (value ?? '').trim(), wide,
    });
    return [
        f('projectName', meta.projectName), f('revision', meta.revision),
        f('siteAddress', meta.siteAddress, true),
        f('ownerName', meta.ownerName), f('drawingNo', options.drawingNo),
        f('preparedBy', meta.preparedBy), f('documentDate', meta.documentDate),
    ];
}

export function buildBoqPrintModel(boq: BoqResult, meta: ProjectMeta, options: BoqPrintOptions = {}): BoqPrintModel {
    const constructionTotal = finite(boq.constructionTotal);
    const construction = boq.sections.filter(s => s.inConstructionTotal);
    const pre = boq.sections.filter(s => !s.inConstructionTotal);
    const fields = buildHeaderFields(meta, options);
    const summary = construction.map(summaryLine);
    return {
        projectName: meta.projectName.trim(),
        summaryHeader: { formLabel: PRINT_TEXT.formSummary, title: PRINT_TEXT.summaryTitle, fields },
        detailHeader: { formLabel: PRINT_TEXT.formDetail, title: PRINT_TEXT.detailTitle, fields },
        summary,
        constructionMat: summary.reduce((a, l) => a + l.matTotal, 0),
        constructionLab: summary.reduce((a, l) => a + l.labTotal, 0),
        constructionTotal,
        constructionTotalText: bahtText(constructionTotal),
        preConstruction: pre.map(summaryLine),
        preConstructionTotal: finite(boq.preConstructionTotal),
        details: construction.map(detailSection).filter(hasItems),
        preConstructionDetails: pre.map(detailSection).filter(hasItems),
        signatures: [
            { role: PRINT_TEXT.signPrepared, name: meta.preparedBy.trim() },
            { role: PRINT_TEXT.signChecked, name: '' },
            { role: PRINT_TEXT.signApproved, name: '' },
        ],
    };
}

// ─── Display formatting (th-TH digits and separators, like the BOQ page) ─────

/** 1,234.50; zero and missing show "-" (the Excel accounting format). */
export function fmtMoney(v: number | null): string {
    if (v === null || !Number.isFinite(v) || Math.abs(v) < 0.005) return '-';
    return v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Quantity: always 2 decimals so the column lines up on the decimal point; missing → empty. */
export function fmtQty(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return '';
    return v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
