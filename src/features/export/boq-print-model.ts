// ─── BOQ → printable document model for the house owner (pure) ──────────────
// Page 1: header fields + one line per construction section (material, labour, total, share of the total),
//         the construction total (figures and Thai words), and the pre-construction cost on its own (decision D2).
// Then:   the detailed list in BOQ (Home) column order. Rows with neither a quantity nor an amount are left out
//         (a blank project has hundreds of them); a heading is kept only when one of its rows is shown.

import type { BoqHeadingRow, BoqItemRow, BoqResult, BoqSectionResult } from '@/domain/boq/types';
import type { ProjectMeta } from '@/domain/project';
import { bahtText } from './baht-text';

export interface PrintSummaryLine {
    no: number;
    title: string;
    matTotal: number;
    labTotal: number;
    total: number;
    /** total ÷ construction total (0 when the construction total is 0). */
    share: number;
}

export type PrintDetailRow =
    | { type: 'heading'; key: string; itemNo: string; desc: string }
    | {
        type: 'item'; key: string; itemNo: string; desc: string; unit: string;
        qty: number | null; waste: number; grossQty: number | null;
        matUnit: number; matTotal: number; labUnit: number; labTotal: number; total: number; note: string;
    };

export interface PrintDetailSection {
    no: number;
    title: string;
    inConstructionTotal: boolean;
    rows: PrintDetailRow[];
    matTotal: number;
    labTotal: number;
    total: number;
}

export interface PrintMetaField {
    label: string;
    value: string;
}

export interface BoqPrintModel {
    title: string;
    projectName: string;
    ownerName: string;
    preparedBy: string;
    /** Header fields in display order; empty values are dropped. */
    fields: PrintMetaField[];
    summary: PrintSummaryLine[];
    constructionMat: number;
    constructionLab: number;
    constructionTotal: number;
    constructionTotalText: string;
    /** Sections outside the construction total (section 0, land inspection). */
    preConstruction: PrintSummaryLine[];
    preConstructionTotal: number;
    details: PrintDetailSection[];
}

export const PRINT_TEXT = {
    title: 'ใบประมาณราคาค่าก่อสร้าง (BOQ)',
    projectName: 'โครงการ',
    siteAddress: 'สถานที่ก่อสร้าง',
    ownerName: 'เจ้าของบ้าน',
    revision: 'Revision',
    documentDate: 'วันที่',
    preparedBy: 'ผู้จัดทำ',
    summaryTitle: 'สรุปราคาตามหมวดงาน',
    detailTitle: 'รายละเอียดราคา (BOQ)',
    colNo: 'ลำดับ',
    colSection: 'หมวดงาน',
    colItemNo: 'ขั้นตอน',
    colDesc: 'รายการ',
    colQty: 'ปริมาณ',
    colUnit: 'หน่วย',
    colWaste: '%เผื่อ',
    colGross: 'ปริมาณเผื่อแล้ว',
    colMat: 'ค่าวัสดุ',
    colLab: 'ค่าแรงงาน',
    colUnitPrice: 'ต่อหน่วย',
    colSum: 'รวม',
    colTotal: 'รวมทั้งหมด',
    colShare: '%',
    colNote: 'หมายเหตุ',
    subtotal: 'รวม',
    constructionTotal: 'รวมต้นทุนก่อสร้างทั้งหมด',
    preConstruction: 'ค่าใช้จ่ายก่อนก่อสร้าง (ไม่รวมในต้นทุนก่อสร้าง)',
    preConstructionNote: 'ไม่รวมในต้นทุนก่อสร้าง',
    baht: 'บาท',
    signPreparedBy: 'ผู้จัดทำ',
    signOwner: 'เจ้าของบ้าน',
    signDate: 'วันที่ ......../......../........',
    nothing: 'ยังไม่มีรายการ',
} as const;

const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/** An item worth showing to the owner: it has a quantity or an amount. */
export function isPrintableItem(r: BoqItemRow): boolean {
    return finite(r.total) !== 0 || (r.qtySource !== 'none' && finite(r.qty) !== 0) || (r.grossQty !== null && finite(r.grossQty) !== 0);
}

function detailItem(r: BoqItemRow): PrintDetailRow {
    return {
        type: 'item', key: r.key, itemNo: r.itemNo ?? '', desc: r.desc, unit: r.unit,
        qty: r.qtySource === 'none' ? null : finite(r.qty),
        waste: finite(r.waste),
        grossQty: r.grossQty === null ? null : finite(r.grossQty),
        matUnit: finite(r.matUnit), matTotal: finite(r.matTotal),
        labUnit: finite(r.labUnit), labTotal: finite(r.labTotal),
        total: finite(r.total),
        note: r.note ?? '',
    };
}

function detailRows(s: BoqSectionResult): PrintDetailRow[] {
    const out: PrintDetailRow[] = [];
    let pending: BoqHeadingRow | null = null;
    for (const r of s.rows) {
        if (r.type === 'heading') {
            pending = r;
            continue;
        }
        if (r.itemNo !== undefined && r.itemNo !== '') pending = null;   // a numbered item ends the heading's group
        if (!isPrintableItem(r)) continue;
        if (pending !== null) {
            out.push({ type: 'heading', key: pending.key, itemNo: pending.itemNo ?? '', desc: pending.desc });
            pending = null;
        }
        out.push(detailItem(r));
    }
    return out;
}

function summaryLine(s: BoqSectionResult, constructionTotal: number): PrintSummaryLine {
    const total = finite(s.total);
    return {
        no: s.no, title: s.title.trim(),
        matTotal: finite(s.matTotal), labTotal: finite(s.labTotal), total,
        share: constructionTotal !== 0 ? total / constructionTotal : 0,
    };
}

export function buildBoqPrintModel(boq: BoqResult, meta: ProjectMeta): BoqPrintModel {
    const constructionTotal = finite(boq.constructionTotal);
    const construction = boq.sections.filter(s => s.inConstructionTotal);
    const pre = boq.sections.filter(s => !s.inConstructionTotal);
    const fields: PrintMetaField[] = [
        { label: PRINT_TEXT.projectName, value: meta.projectName },
        { label: PRINT_TEXT.siteAddress, value: meta.siteAddress },
        { label: PRINT_TEXT.ownerName, value: meta.ownerName },
        { label: PRINT_TEXT.documentDate, value: meta.documentDate },
        { label: PRINT_TEXT.revision, value: meta.revision },
        { label: PRINT_TEXT.preparedBy, value: meta.preparedBy },
    ].map(f => ({ ...f, value: f.value.trim() })).filter(f => f.value !== '');

    const summary = construction.map(s => summaryLine(s, constructionTotal));
    return {
        title: PRINT_TEXT.title,
        projectName: meta.projectName.trim(),
        ownerName: meta.ownerName.trim(),
        preparedBy: meta.preparedBy.trim(),
        fields,
        summary,
        constructionMat: summary.reduce((a, l) => a + l.matTotal, 0),
        constructionLab: summary.reduce((a, l) => a + l.labTotal, 0),
        constructionTotal,
        constructionTotalText: bahtText(constructionTotal),
        preConstruction: pre.map(s => summaryLine(s, constructionTotal)),
        preConstructionTotal: finite(boq.preConstructionTotal),
        details: boq.sections
            .map((s): PrintDetailSection => ({
                no: s.no, title: s.title.trim(), inConstructionTotal: s.inConstructionTotal,
                rows: detailRows(s),
                matTotal: finite(s.matTotal), labTotal: finite(s.labTotal), total: finite(s.total),
            }))
            .filter(s => s.rows.some(r => r.type === 'item')),
    };
}

// ─── Display formatting (th-TH, like the BOQ page) ───────────────────────────

/** 1,234.50; zero and missing show "-" (the Excel accounting format). */
export function fmtMoney(v: number | null): string {
    if (v === null || !Number.isFinite(v) || Math.abs(v) < 0.005) return '-';
    return v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Quantity: up to 2 decimals, missing → empty. */
export function fmtQty(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return '';
    return v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Fraction → "10%" (zero → empty). */
export function fmtPercent(v: number, digits = 0): string {
    if (!Number.isFinite(v) || v === 0) return '';
    return `${(v * 100).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}
