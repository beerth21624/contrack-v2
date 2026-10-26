import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type ProjectMeta } from '@/domain/project';
import type { BoqItemRow, BoqResult } from '@/domain/boq/types';
import {
    buildBoqPrintModel, buildHeaderFields, fmtMoney, fmtQty, quantityBasis, type PrintDetailRow,
} from '../boq-print-model';

const sample = createProject('sample');
const boq = computeProject(sample).boq;
const model = buildBoqPrintModel(boq, { ...sample.meta, ownerName: ' คุณสมชาย ', documentDate: '26/10/2026', siteAddress: '' });

const item = (p: Partial<BoqItemRow>): BoqItemRow => ({
    type: 'item', key: 'k', excelRow: 0, desc: '', unit: '', qty: 0, qtySource: 'input', waste: 0, grossQty: 0,
    matUnit: 0, matTotal: 0, labUnit: 0, labTotal: 0, total: 0, editable: { qty: true },
    fromCalc: { qty: false, mat: false, lab: false }, ...p,
});

const meta = (p: Partial<ProjectMeta>): ProjectMeta => ({
    projectName: '', siteAddress: '', ownerName: '', revision: '', documentDate: '', preparedBy: '', ...p,
});

describe('page header model', () => {
    it('both forms: label, title and the fields of the estimate forms in order', () => {
        expect(model.summaryHeader.formLabel).toBe('รูปแบบตามแบบ ปร.5');
        expect(model.summaryHeader.title).toBe('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
        expect(model.detailHeader.formLabel).toBe('รูปแบบตามแบบ ปร.4');
        expect(model.detailHeader.title).toBe('แบบแสดงรายการ ปริมาณงาน และราคา');
        expect(model.summaryHeader.fields.map(f => f.label)).toEqual([
            'ชื่อโครงการ', 'ฉบับแก้ไขที่', 'สถานที่ก่อสร้าง', 'เจ้าของ/หน่วยงาน', 'แบบเลขที่', 'ประมาณราคาโดย', 'เมื่อวันที่',
        ]);
        expect(model.detailHeader.fields).toEqual(model.summaryHeader.fields);
        // only the site address takes a whole row; the others pair up left/right
        expect(model.summaryHeader.fields.filter(f => f.wide).map(f => f.key)).toEqual(['siteAddress']);
    });

    it('values are trimmed and blank ones kept as lines to fill in', () => {
        const byKey = Object.fromEntries(model.summaryHeader.fields.map(f => [f.key, f.value]));
        expect(byKey.ownerName).toBe('คุณสมชาย');
        expect(byKey.documentDate).toBe('26/10/2026');
        expect(byKey.siteAddress).toBe('');
        expect(byKey.drawingNo).toBe('');
        expect(byKey.projectName).toBe(sample.meta.projectName.trim());
        expect(byKey.preparedBy).toBe(sample.meta.preparedBy.trim());
    });

    it('takes an optional drawing number', () => {
        const fields = buildHeaderFields(meta({ projectName: ' บ้าน ' }), { drawingNo: ' A-01 ' });
        expect(fields.find(f => f.key === 'drawingNo')?.value).toBe('A-01');
        expect(fields.find(f => f.key === 'projectName')?.value).toBe('บ้าน');
    });
});

describe('BOQ print model', () => {
    it('summary: one line per construction section, totals add up', () => {
        expect(model.summary.map(l => l.no)).toEqual(boq.sections.filter(s => s.inConstructionTotal).map(s => s.no));
        expect(model.summary.some(l => l.no === 0)).toBe(false);
        const sum = model.summary.reduce((a, l) => a + l.total, 0);
        expect(sum).toBeCloseTo(boq.constructionTotal, 6);
        expect(model.constructionTotal).toBe(boq.constructionTotal);
        expect(model.constructionMat + model.constructionLab).toBeCloseTo(boq.constructionTotal, 6);
        expect(model.constructionTotalText.endsWith('สตางค์') || model.constructionTotalText.endsWith('บาทถ้วน')).toBe(true);
    });

    it('pre-construction (section 0) is shown separately, not in the construction total (D2)', () => {
        expect(model.preConstruction).toHaveLength(1);
        expect(model.preConstruction[0]).toMatchObject({ no: 0, title: 'งานตรวจสอบที่ดิน', total: 7500 });
        expect(model.preConstructionTotal).toBe(7500);
        expect(model.details.some(s => s.no === 0)).toBe(false);
        expect(model.preConstructionDetails.map(s => s.no)).toEqual([0]);
    });

    it('signature blocks: estimator (named), checker, approver', () => {
        expect(model.signatures).toEqual([
            { role: 'ผู้ประมาณราคา', name: sample.meta.preparedBy.trim() },
            { role: 'ผู้ตรวจสอบ', name: '' },
            { role: 'ผู้อนุมัติ', name: '' },
        ]);
    });

    it('details: rows without quantity or amount are left out; section totals kept', () => {
        const all = [...model.details, ...model.preConstructionDetails];
        const keys = new Set(all.flatMap(s => s.rows.map(r => r.key)));
        expect(keys.has('R12')).toBe(false);          // งานรื้อถอน: 0 เหมา
        expect(keys.has('R13')).toBe(true);           // ดินถม: 234 ลบ.ม., customer-supplied (no price) still listed
        for (const s of all) {
            const src = boq.sections.find(x => x.no === s.no);
            expect(src).toBeDefined();
            expect(s.total).toBe(src?.total);
            expect(s.subtotalLabel).toBe(`รวมหมวดที่ ${s.no}`);
            expect(s.rows.some(r => r.type === 'item')).toBe(true);
            const itemSum = s.rows.reduce((a, r) => a + (r.type === 'item' ? r.total : 0), 0);
            expect(itemSum).toBeCloseTo(s.total, 6);   // dropped rows are all zero
        }
    });

    it('every amount can be checked on paper: จำนวน × ราคาต่อหน่วย, or a note names the other quantity', () => {
        const items = model.details.flatMap(s => s.rows).filter((r): r is Extract<PrintDetailRow, { type: 'item' }> => r.type === 'item');
        const source = new Map(boq.sections.flatMap(s => s.rows).map(x => [x.key, x]));
        const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 1e-9);
        let noted = 0;
        for (const r of items) {
            const src = source.get(r.key);
            if (src?.type !== 'item') throw new Error(`no source row ${r.key}`);
            const shown = r.qty ?? 0;
            const quantities = [src.qtySource === 'none' ? 0 : src.qty, src.grossQty ?? 0];
            for (const [unit, amount, who] of [[r.matUnit, r.matTotal, 'ค่าวัสดุ'], [r.labUnit, r.labTotal, 'ค่าแรง']] as const) {
                if (unit === 0 || amount === 0) continue;
                const simple = quantities.some(q => close(unit * q, amount));
                if (close(unit * shown, amount) || !simple) continue;
                expect(r.qtyNote).toContain(who);   // priced on the other quantity: the note says so
                noted++;
            }
        }
        expect(noted).toBeGreaterThan(0);   // the sample prices some material on the gross quantity next to net-qty labour
    });

    it('a heading is kept only when one of its rows is shown', () => {
        const fake: BoqResult = {
            constructionTotal: 100, preConstructionTotal: 0,
            sections: [{
                no: 5, title: 'งานฐานราก ', calculators: [], inConstructionTotal: true, matTotal: 100, labTotal: 0, total: 100,
                rows: [
                    { type: 'heading', key: 'H1', excelRow: 1, itemNo: '1)', desc: 'เหล็กเสริม' },
                    item({ key: 'A', desc: '- เหล็ก RB9' }),
                    { type: 'heading', key: 'H2', excelRow: 2, itemNo: '2)', desc: 'เหล็กเสริมเสา' },
                    item({ key: 'B', desc: '- เหล็ก DB12', qty: 4, grossQty: 4, total: 100, matTotal: 100, matUnit: 25 }),
                    item({ key: 'C', itemNo: '3)', desc: 'ค่าขนส่ง' }),
                ],
            }],
        };
        const m = buildBoqPrintModel(fake, sample.meta);
        expect(m.details).toHaveLength(1);
        expect(m.details[0]?.title).toBe('งานฐานราก');
        expect(m.details[0]?.rows.map(r => r.key)).toEqual(['H2', 'B']);
        expect(m.preConstructionDetails).toEqual([]);
    });

    it('a blank project prints an empty summary without NaN', () => {
        const blank = createProject('blank');
        const m = buildBoqPrintModel(computeProject(blank).boq, blank.meta);
        for (const l of [...m.summary, ...m.preConstruction]) expect(Number.isFinite(l.total)).toBe(true);
        expect(m.projectName).toBe('');
        expect(m.summaryHeader.fields.every(f => f.value === '' || typeof f.value === 'string')).toBe(true);
    });
});

describe('quantity shown and the waste-allowance note', () => {
    it('material on gross, labour on net: net quantity, note on the material', () => {
        const r = item({ qty: 234, grossQty: 257.4, waste: 0.1, unit: 'ลบ.ม.', matUnit: 100, matTotal: 25740, labUnit: 10, labTotal: 2340 });
        expect(quantityBasis(r)).toEqual({ qty: 234, qtyNote: 'ค่าวัสดุคิดที่ 257.40 ลบ.ม. (เผื่อ 10%)' });
    });

    it('every amount on gross: gross quantity, noted as including the allowance', () => {
        const r = item({ qty: 100, grossQty: 105, waste: 0.05, matUnit: 10, matTotal: 1050 });
        expect(quantityBasis(r)).toEqual({ qty: 105, qtyNote: 'ปริมาณรวมเผื่อแล้ว 5%' });
    });

    it('no allowance, no gross, or no net quantity: no note', () => {
        expect(quantityBasis(item({ qty: 5, grossQty: 5, matUnit: 2, matTotal: 10 }))).toEqual({ qty: 5, qtyNote: '' });
        expect(quantityBasis(item({ qty: 5, grossQty: null, labUnit: 2, labTotal: 10 }))).toEqual({ qty: 5, qtyNote: '' });
        expect(quantityBasis(item({ qtySource: 'none', qty: 0, grossQty: 12, matUnit: 3, matTotal: 36 }))).toEqual({ qty: 12, qtyNote: '' });
        // amounts on net although an allowance exists
        expect(quantityBasis(item({ qty: 10, grossQty: 11, waste: 0.1, matUnit: 2, matTotal: 20 }))).toEqual({ qty: 10, qtyNote: '' });
    });
});

describe('print formatting', () => {
    it('formats money and quantities with 2 decimals and separators', () => {
        expect(fmtMoney(1850317.343)).toBe('1,850,317.34');
        expect(fmtMoney(0)).toBe('-');
        expect(fmtMoney(null)).toBe('-');
        expect(fmtQty(257.4)).toBe('257.40');
        expect(fmtQty(1234)).toBe('1,234.00');
        expect(fmtQty(null)).toBe('');
    });
});
