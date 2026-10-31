// QA edge tests for the print model (ปร.5 summary + ปร.4 detail): totals equal the engine, row filtering, quantity basis.
import { describe, expect, it } from 'vitest';
import type { BoqItemRow, BoqResult, BoqSectionResult } from '@/domain/boq/types';
import { computeProject, createProject, DEFAULT_PROJECT_META, type ProjectMeta } from '@/domain/project';
import { bahtText } from '../baht-text';
import {
    buildBoqPrintModel, buildHeaderFields, fmtMoney, fmtQty, isPrintableItem, PRINT_TEXT, quantityBasis,
} from '../boq-print-model';

const itemRow = (key: string, o: Partial<BoqItemRow> = {}): BoqItemRow => ({
    type: 'item', key, excelRow: 1, itemNo: '1)', desc: `desc ${key}`, unit: 'ลบ.ม.', qty: 10, qtySource: 'input', waste: 0, grossQty: 10,
    matUnit: 0, matTotal: 0, labUnit: 0, labTotal: 0, total: 0, materialBasis: 'gross', labourBasis: 'net',
    editable: { qty: true }, fromCalc: { qty: false, mat: false, lab: false }, ...o,
});
const section = (no: number, rows: BoqSectionResult['rows'], inConstructionTotal = true): BoqSectionResult => {
    const items = rows.filter((r): r is BoqItemRow => r.type === 'item');
    const mat = items.reduce((a, r) => a + r.matTotal, 0);
    const lab = items.reduce((a, r) => a + r.labTotal, 0);
    return { no, title: ` หมวด ${no} `, calculators: [], inConstructionTotal, rows, matTotal: mat, labTotal: lab, total: mat + lab };
};
const boqOf = (sections: BoqSectionResult[]): BoqResult => ({
    sections,
    constructionTotal: sections.filter(s => s.inConstructionTotal).reduce((a, s) => a + s.total, 0),
    preConstructionTotal: sections.filter(s => !s.inConstructionTotal).reduce((a, s) => a + s.total, 0),
});
const meta: ProjectMeta = { ...DEFAULT_PROJECT_META, projectName: '  บ้าน  ', preparedBy: ' ช่าง ' };

describe('quantityBasis (so จำนวน x ราคาต่อหน่วย = จำนวนเงิน can be checked on paper)', () => {
    it('no waste: net quantity, no note', () => {
        expect(quantityBasis(itemRow('A', { qty: 10, grossQty: 10, matUnit: 5, matTotal: 50, labUnit: 2, labTotal: 20, total: 70 }))).toEqual({ qty: 10, qtyNote: '' });
    });

    it('material on gross, labour on net: shows net and says the material is priced on the gross quantity', () => {
        const r = itemRow('A', { qty: 10, waste: 0.1, grossQty: 11, matUnit: 100, matTotal: 1100, labUnit: 50, labTotal: 500, total: 1600 });
        const b = quantityBasis(r);
        expect(b.qty).toBe(10);
        expect(b.qtyNote).toContain(PRINT_TEXT.matShort);
        expect(b.qtyNote).toContain(PRINT_TEXT.pricedAt);
        expect(b.qtyNote).toContain('10%');
    });

    it('every priced amount on gross: shows the gross quantity with an "includes allowance" note', () => {
        const r = itemRow('A', { qty: 10, waste: 0.1, grossQty: 11, matUnit: 100, matTotal: 1100, labUnit: 50, labTotal: 550, total: 1650, labourBasis: 'gross' });
        const b = quantityBasis(r);
        expect(b.qty).toBe(11);
        expect(b.qtyNote).toContain(PRINT_TEXT.grossIncluded);
    });

    it('gross differs only by rounding (waste 0): note says rounded', () => {
        const r = itemRow('A', { qty: 10.2, waste: 0, grossQty: 11, matUnit: 10, matTotal: 110, labUnit: 0, labTotal: 0, total: 110, labourBasis: 'gross' });
        expect(quantityBasis(r)).toEqual({ qty: 11, qtyNote: PRINT_TEXT.grossRounded });
    });

    it('a row with no net quantity (tie wire) shows its gross quantity', () => {
        expect(quantityBasis(itemRow('W', { qtySource: 'none', qty: 0, grossQty: 4.8 }))).toEqual({ qty: 4.8, qtyNote: '' });
        expect(quantityBasis(itemRow('W', { qtySource: 'none', qty: 0, grossQty: null }))).toEqual({ qty: null, qtyNote: '' });
    });

    it('zero prices: nothing to explain, net quantity without a note', () => {
        expect(quantityBasis(itemRow('A', { qty: 10, waste: 0.1, grossQty: 11 }))).toEqual({ qty: 10, qtyNote: '' });
    });

    it('non-finite values are treated as 0', () => {
        const b = quantityBasis(itemRow('A', { qty: Number.NaN, grossQty: Number.NaN }));
        expect(b.qty).toBe(0);
    });
});

describe('isPrintableItem', () => {
    it('prints rows with an amount or a quantity; hides all-zero rows', () => {
        expect(isPrintableItem(itemRow('A', { qty: 0, grossQty: 0, total: 0 }))).toBe(false);
        expect(isPrintableItem(itemRow('A', { qty: 1, total: 0 }))).toBe(true);
        expect(isPrintableItem(itemRow('A', { qty: 0, grossQty: 0, total: 5 }))).toBe(true);
        expect(isPrintableItem(itemRow('A', { qty: 0, qtySource: 'none', grossQty: 2, total: 0 }))).toBe(true);
        expect(isPrintableItem(itemRow('A', { qty: 0, qtySource: 'none', grossQty: null, total: 0 }))).toBe(false);
        expect(isPrintableItem(itemRow('A', { qty: Number.NaN, grossQty: null, total: Number.NaN }))).toBe(false);
    });
});

describe('buildBoqPrintModel', () => {
    const boq = boqOf([
        section(0, [itemRow('L', { matTotal: 0, labTotal: 7500, labUnit: 7500, total: 7500, qty: 1, grossQty: 1 })], false),
        section(1, [
            { type: 'heading', key: 'H1', excelRow: 1, itemNo: '', desc: 'หัวข้อมีรายการ' },
            itemRow('A', { itemNo: '', matUnit: 10, matTotal: 100, labUnit: 5, labTotal: 50, total: 150 }),
            { type: 'heading', key: 'H2', excelRow: 2, itemNo: '', desc: 'หัวข้อว่าง' },
            itemRow('Z', { qty: 0, grossQty: 0 }),
        ]),
        section(2, [itemRow('Z2', { qty: 0, grossQty: 0 })]),
        section(3, [itemRow('B', { matTotal: 40.5, total: 40.5, matUnit: 4.05 })]),
    ]);
    const m = buildBoqPrintModel(boq, meta);

    it('summary lines are the construction sections only; totals equal the engine', () => {
        expect(m.summary.map(s => s.no)).toEqual([1, 2, 3]);
        expect(m.constructionTotal).toBe(boq.constructionTotal);
        expect(m.constructionMat).toBeCloseTo(140.5, 9);
        expect(m.constructionLab).toBeCloseTo(50, 9);
        expect(m.constructionMat + m.constructionLab).toBeCloseTo(m.constructionTotal, 9);
        expect(m.summary.reduce((a, s) => a + s.total, 0)).toBeCloseTo(m.constructionTotal, 9);
    });

    it('section 0 (7,500) is listed under pre-construction and never in the construction total', () => {
        expect(m.preConstruction.map(s => s.no)).toEqual([0]);
        expect(m.preConstructionTotal).toBe(7500);
        expect(m.constructionTotal).toBeCloseTo(190.5, 9);
    });

    it('construction total text is the Thai baht text of the engine total', () => {
        expect(m.constructionTotalText).toBe(bahtText(190.5));
        expect(m.constructionTotalText).toBe('หนึ่งร้อยเก้าสิบบาทห้าสิบสตางค์');
    });

    it('detail drops sections with nothing to print and zero rows; empty headings disappear', () => {
        expect(m.details.map(d => d.no)).toEqual([1, 3]);
        const d1 = m.details[0];
        expect(d1?.rows.map(r => r.key)).toEqual(['H1', 'A']);
        expect(d1?.subtotalLabel).toBe('รวมหมวดที่ 1');
        expect(m.preConstructionDetails.map(d => d.no)).toEqual([0]);
    });

    it('a detail section carries the engine section totals (not a recomputation of printed rows)', () => {
        expect(m.details[0]?.total).toBe(150);
        expect(m.details[1]?.total).toBe(40.5);
    });

    it('printed item amounts are copied unchanged', () => {
        const a = m.details[0]?.rows.find(r => r.type === 'item');
        expect(a).toMatchObject({ type: 'item', key: 'A', matUnit: 10, matTotal: 100, labUnit: 5, labTotal: 50, total: 150 });
    });

    it('trims titles, names and signature; signatures are preparer / checker / approver', () => {
        expect(m.projectName).toBe('บ้าน');
        expect(m.summary[0]?.title).toBe('หมวด 1');
        expect(m.signatures).toEqual([
            { role: PRINT_TEXT.signPrepared, name: 'ช่าง' },
            { role: PRINT_TEXT.signChecked, name: '' },
            { role: PRINT_TEXT.signApproved, name: '' },
        ]);
    });

    it('both forms share the same header fields; the drawing number is blank unless given', () => {
        expect(m.summaryHeader.fields).toEqual(m.detailHeader.fields);
        expect(m.summaryHeader.fields.find(f => f.key === 'drawingNo')?.value).toBe('');
        const withNo = buildBoqPrintModel(boq, meta, { drawingNo: ' A-01 ' });
        expect(withNo.summaryHeader.fields.find(f => f.key === 'drawingNo')?.value).toBe('A-01');
        expect(m.summaryHeader.formLabel).toBe(PRINT_TEXT.formSummary);
        expect(m.detailHeader.formLabel).toBe(PRINT_TEXT.formDetail);
    });

    it('no sections: empty lists, total 0, "ศูนย์บาทถ้วน", no NaN', () => {
        const e = buildBoqPrintModel(boqOf([]), meta);
        expect(e.summary).toEqual([]);
        expect(e.details).toEqual([]);
        expect(e.constructionTotal).toBe(0);
        expect(e.constructionTotalText).toBe('ศูนย์บาทถ้วน');
    });

    it('non-finite totals print as 0 and a blank baht text is never produced', () => {
        const dirty = boqOf([section(1, [itemRow('A', { matTotal: Number.NaN, total: Number.NaN })])]);
        dirty.constructionTotal = Number.NaN;
        const d = buildBoqPrintModel(dirty, meta);
        expect(d.constructionTotal).toBe(0);
        expect(d.constructionTotalText).toBe('ศูนย์บาทถ้วน');
        expect(Number.isFinite(d.summary[0]?.total ?? NaN)).toBe(true);
    });

    it('buildHeaderFields keeps blank values (lines to fill in) and marks the address wide', () => {
        const f = buildHeaderFields({ ...DEFAULT_PROJECT_META, projectName: '' });
        expect(f.map(x => x.key)).toEqual(['projectName', 'revision', 'siteAddress', 'ownerName', 'drawingNo', 'preparedBy', 'documentDate']);
        expect(f.find(x => x.key === 'projectName')?.value).toBe('');
        expect(f.filter(x => x.wide).map(x => x.key)).toEqual(['siteAddress']);
    });
});

describe('print model on the real sample project', () => {
    const { boq } = computeProject(createProject('sample'));
    const m = buildBoqPrintModel(boq, DEFAULT_PROJECT_META);

    it('summary total, mat + lab and the sum of lines all equal the engine construction total', () => {
        expect(m.constructionTotal).toBeCloseTo(1855162.2484765165, 6);
        expect(m.constructionMat + m.constructionLab).toBeCloseTo(m.constructionTotal, 4);
        expect(m.summary.reduce((a, l) => a + l.total, 0)).toBeCloseTo(m.constructionTotal, 4);
        expect(m.constructionTotalText).toBe('หนึ่งล้านแปดแสนห้าหมื่นห้าพันหนึ่งร้อยหกสิบสองบาทยี่สิบห้าสตางค์');
    });

    it('detail sections add up to the section totals and printed item rows are never all-zero', () => {
        for (const d of m.details) {
            const items = d.rows.flatMap(r => (r.type === 'item' ? [r.total] : []));
            expect(items.length).toBeGreaterThan(0);
            const printed = items.reduce((a, t) => a + t, 0);
            // printed rows are exactly the non-zero ones, so they add back to the section total
            expect(printed, `section ${d.no}`).toBeCloseTo(d.total, 4);
        }
    });

    it('the pre-construction section holds the 7,500 land inspection', () => {
        expect(m.preConstructionTotal).toBe(7500);
        expect(m.preConstruction).toHaveLength(1);
    });

    it('a blank project prints almost nothing but the lump sums (18,200) and stays consistent', () => {
        const blank = computeProject(createProject('blank')).boq;
        const bm = buildBoqPrintModel(blank, createProject('blank').meta);
        expect(bm.constructionTotal).toBe(18200);
        expect(bm.constructionTotalText).toBe('หนึ่งหมื่นแปดพันสองร้อยบาทถ้วน');
        // sections with money are always printed
        expect(bm.details.map(d => d.no)).toEqual(expect.arrayContaining([2, 4, 15]));
    });

    // The "วัสดุอุปกรณ์และของใช้สิ้นเปลือง" lines (qty 1, 0 baht) keep an otherwise empty section on the paper.
    // Decision (docs/qa/BUGS.md): a row with a quantity prints even at 0 baht, so a blank project also lists the
    // 0-baht consumables rows R87/R186/R196/R215 (qty 1) and their sections 9, 17, 18, 21.
    it('inputs: createProject("blank"): detail sections are [2, 4, 9, 15, 17, 18, 21], not only the ones with money', () => {
        const blank = computeProject(createProject('blank')).boq;
        expect(buildBoqPrintModel(blank, createProject('blank').meta).details.map(d => d.no)).toEqual([2, 4, 9, 15, 17, 18, 21]);
    });
});

describe('number formatting', () => {
    it.each([
        [1234.5, '1,234.50'], [0, '-'], [0.004, '-'], [-0.004, '-'], [0.005, '0.01'], [null, '-'], [Number.NaN, '-'], [Infinity, '-'],
        [1855162.2484765165, '1,855,162.25'], [-1500, '-1,500.00'], [1e9, '1,000,000,000.00'],
    ])('fmtMoney(%s) = %s', (v, text) => {
        expect(fmtMoney(v)).toBe(text);
    });

    it.each([
        [1.5, '1.50'], [0, '0.00'], [null, ''], [Number.NaN, ''], [Infinity, ''], [1234.567, '1,234.57'], [-2, '-2.00'],
    ])('fmtQty(%s) = %s', (v, text) => {
        expect(fmtQty(v)).toBe(text);
    });
});
