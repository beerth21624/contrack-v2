import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '@/domain/project';
import type { BoqItemRow, BoqResult } from '@/domain/boq/types';
import { buildBoqPrintModel, fmtMoney, fmtPercent, fmtQty } from '../boq-print-model';

const sample = createProject('sample');
const boq = computeProject(sample).boq;
const model = buildBoqPrintModel(boq, { ...sample.meta, ownerName: ' คุณสมชาย ', documentDate: '26/10/2026' });

const item = (p: Partial<BoqItemRow>): BoqItemRow => ({
    type: 'item', key: 'k', excelRow: 0, desc: '', unit: '', qty: 0, qtySource: 'input', waste: 0, grossQty: 0,
    matUnit: 0, matTotal: 0, labUnit: 0, labTotal: 0, total: 0, editable: { qty: true },
    fromCalc: { qty: false, mat: false, lab: false }, ...p,
});

describe('BOQ print model', () => {
    it('summary: one line per construction section, totals add up', () => {
        expect(model.summary.map(l => l.no)).toEqual(boq.sections.filter(s => s.inConstructionTotal).map(s => s.no));
        expect(model.summary.some(l => l.no === 0)).toBe(false);
        const sum = model.summary.reduce((a, l) => a + l.total, 0);
        expect(sum).toBeCloseTo(boq.constructionTotal, 6);
        expect(model.constructionTotal).toBe(boq.constructionTotal);
        expect(model.constructionMat + model.constructionLab).toBeCloseTo(boq.constructionTotal, 6);
        expect(model.summary.reduce((a, l) => a + l.share, 0)).toBeCloseTo(1, 9);
        expect(model.constructionTotalText.endsWith('สตางค์') || model.constructionTotalText.endsWith('บาทถ้วน')).toBe(true);
    });

    it('pre-construction (section 0) is shown separately, not in the construction total (D2)', () => {
        expect(model.preConstruction).toHaveLength(1);
        expect(model.preConstruction[0]).toMatchObject({ no: 0, title: 'งานตรวจสอบที่ดิน', total: 7500 });
        expect(model.preConstructionTotal).toBe(7500);
    });

    it('header fields: trimmed, empty ones dropped', () => {
        expect(model.fields).toContainEqual({ label: 'เจ้าของบ้าน', value: 'คุณสมชาย' });
        expect(model.fields).toContainEqual({ label: 'วันที่', value: '26/10/2026' });
        expect(model.fields.find(f => f.label === 'สถานที่ก่อสร้าง')).toBeUndefined();
        expect(model.ownerName).toBe('คุณสมชาย');
    });

    it('details: rows without quantity or amount are left out; section totals kept', () => {
        const keys = new Set(model.details.flatMap(s => s.rows.map(r => r.key)));
        expect(keys.has('R12')).toBe(false);          // งานรื้อถอน: 0 เหมา
        expect(keys.has('R13')).toBe(true);           // ดินถม: 234 ลบ.ม., customer-supplied (no price) still listed
        for (const s of model.details) {
            const src = boq.sections.find(x => x.no === s.no);
            expect(src).toBeDefined();
            expect(s.total).toBe(src?.total);
            expect(s.rows.some(r => r.type === 'item')).toBe(true);
            const itemSum = s.rows.reduce((a, r) => a + (r.type === 'item' ? r.total : 0), 0);
            expect(itemSum).toBeCloseTo(s.total, 6);   // dropped rows are all zero
        }
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
                    item({ key: 'B', desc: '- เหล็ก DB12', qty: 4, total: 100, matTotal: 100 }),
                    item({ key: 'C', itemNo: '3)', desc: 'ค่าขนส่ง' }),
                ],
            }],
        };
        const m = buildBoqPrintModel(fake, sample.meta);
        expect(m.details).toHaveLength(1);
        expect(m.details[0]?.title).toBe('งานฐานราก');
        expect(m.details[0]?.rows.map(r => r.key)).toEqual(['H2', 'B']);
    });

    it('a blank project prints an empty summary without NaN', () => {
        const blank = createProject('blank');
        const m = buildBoqPrintModel(computeProject(blank).boq, blank.meta);
        for (const l of [...m.summary, ...m.preConstruction]) {
            expect(Number.isFinite(l.total)).toBe(true);
            expect(Number.isFinite(l.share)).toBe(true);
        }
        expect(m.projectName).toBe('');
    });
});

describe('print formatting', () => {
    it('formats money, quantities and percent like the BOQ page', () => {
        expect(fmtMoney(1850317.343)).toBe('1,850,317.34');
        expect(fmtMoney(0)).toBe('-');
        expect(fmtMoney(null)).toBe('-');
        expect(fmtQty(257.4)).toBe('257.4');
        expect(fmtQty(null)).toBe('');
        expect(fmtPercent(0.1)).toBe('10%');
        expect(fmtPercent(0)).toBe('');
        expect(fmtPercent(0.0405, 1)).toBe('4.1%');
    });
});
