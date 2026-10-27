import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { demolition, DEMOLITION_FIXED_ITEMS, demolitionTotal, lineTotal, type DemolitionInput, type DemolitionLine } from '.';

const ctx = { outputs: () => undefined };
const compute = (i: DemolitionInput) => demolition.compute(i, ctx);
const blankInput = (): DemolitionInput => demolition.blank?.() ?? demolition.defaults();
const row = (qty: number, rate: number, label = 'งาน'): DemolitionLine => ({ label, unit: 'หน่วย', qty, rate, check: '' });
const withItems = (items: DemolitionLine[]): DemolitionInput => ({ items });
/** The 7 fixed rows with the given [qty, rate] on the first rows. */
function fixedWith(...vals: [number, number][]): DemolitionInput {
    const i = blankInput();
    vals.forEach(([qty, rate], k) => {
        const r = i.items[k];
        if (r) i.items[k] = { ...r, qty, rate };
    });
    return i;
}

function boqRow(res: ProjectResult, key: string) {
    const r = res.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (r?.type !== 'item') throw new Error(`row ${key} missing`);
    return r;
}
const section = (res: ProjectResult, no: number) => {
    const s = res.boq.sections.find(x => x.no === no);
    if (!s) throw new Error(`section ${String(no)} missing`);
    return s;
};
function projectWith(input: DemolitionInput, start: 'blank' | 'sample' = 'blank'): Project {
    const p = createProject(start);
    p.calculators.demolition = input;
    return p;
}

describe('demolition edge — blank and defaults', () => {
    it('blank() lists the 7 fixed kinds of work with qty 0 / rate 0', () => {
        const b = blankInput();
        expect(b.items).toHaveLength(7);
        expect(b.items.map(i => i.label)).toEqual(DEMOLITION_FIXED_ITEMS.map(i => i.label));
        expect(b.items.every(i => i.qty === 0 && i.rate === 0)).toBe(true);
        expect(demolition.defaults()).toEqual(b);
    });

    it('blank: total 0, boqQty 0, all outputs finite', () => {
        const o = compute(blankInput());
        expect(o).toEqual({ total: 0, boqQty: 0 });
        expect(Object.is(o.total, 0)).toBe(true);
    });

    it('the fixed rows are exactly the 7 of the sheet in order', () => {
        expect(DEMOLITION_FIXED_ITEMS.map(i => i.unit)).toEqual(['ตร.ม.', 'ต้น', 'ม.', 'ตร.ม.', 'ตร.ม.', 'ตร.ม.', 'เที่ยว']);
    });

    it('blank and sample projects: R12 quantity 0, note says no demolition, section 1 = 0', () => {
        for (const start of ['blank', 'sample'] as const) {
            const res = computeProject(createProject(start));
            const r12 = boqRow(res, 'R12');
            expect(r12.qty).toBe(0);
            expect(r12.total).toBe(0);
            expect(r12.note).toBe('ไม่มีงานรื้อถอน');
            expect(section(res, 1).total).toBe(0);
        }
    });
});

describe('demolition edge — formula F = D × E, total, boqQty', () => {
    it('one row: 10 ตร.ม. × 350 = 3,500', () => {
        expect(lineTotal(row(10, 350))).toBe(3500);
        expect(compute(fixedWith([10, 350]))).toEqual({ total: 3500, boqQty: 1 });
    });

    it('several rows add up: 10×350 + 3×800 + 4×1,200 = 10,700', () => {
        expect(compute(fixedWith([10, 350], [3, 800], [4, 1200])).total).toBe(10700);
        expect(demolitionTotal([row(10, 350), row(3, 800), row(4, 1200)])).toBe(10700);
    });

    it('quantity alone (rate 0) or rate alone (qty 0) is still a 0 baht line', () => {
        expect(compute(fixedWith([5, 0]))).toEqual({ total: 0, boqQty: 0 });
        expect(compute(fixedWith([0, 500]))).toEqual({ total: 0, boqQty: 0 });
    });

    it('decimal: 2.5 × 100.5 = 251.25', () => {
        expect(compute(fixedWith([2.5, 100.5])).total).toBe(251.25);
    });

    it('labels, units and hints never change the money', () => {
        const i = fixedWith([10, 350]);
        i.items = i.items.map(r => ({ ...r, label: 'อื่น', unit: 'หน่วยอื่น', check: 'ตรวจ' }));
        expect(compute(i).total).toBe(3500);
    });

    it('each fixed row alone moves the total by qty × rate (rows are independent)', () => {
        for (let k = 0; k < 7; k++) {
            const vals: [number, number][] = Array.from({ length: k + 1 }, (_, n) => (n === k ? [2, 100] : [0, 0]));
            expect(compute(fixedWith(...vals)).total, `row ${String(k)}`).toBe(200);
        }
    });

    it('boqQty flips at the boundary: total exactly 0 → 0, any positive total → 1', () => {
        expect(compute(withItems([row(1, 0)])).boqQty).toBe(0);
        expect(compute(withItems([row(1, 1e-9)])).boqQty).toBe(1);
        expect(compute(withItems([row(1, 0.01)])).boqQty).toBe(1);
    });

    it('opposite signs that cancel give total 0 and boqQty 0', () => {
        expect(compute(withItems([row(1, 100), row(1, -100)]))).toEqual({ total: 0, boqQty: 0 });
    });
});

describe('demolition edge — table rows', () => {
    it('empty table: total 0, boqQty 0, no error', () => {
        expect(compute(withItems([]))).toEqual({ total: 0, boqQty: 0 });
        const res = computeProject(projectWith(withItems([])));
        expect(boqRow(res, 'R12').total).toBe(0);
    });

    it('one row only', () => {
        expect(compute(withItems([row(1, 1000)]))).toEqual({ total: 1000, boqQty: 1 });
    });

    it('more rows than the 7 of the sheet (D5): 30 extra rows count', () => {
        const items = [...blankInput().items, ...Array.from({ length: 30 }, (_, k) => row(1, 10 + k))];
        const expected = Array.from({ length: 30 }, (_, k) => 10 + k).reduce((a, b) => a + b, 0);
        expect(compute(withItems(items)).total).toBe(expected);
        expect(expected).toBe(30 * 10 + (29 * 30) / 2);
    });

    it('deleting a priced row takes its money out; deleting all gives 0 again', () => {
        let items = [row(1, 100), row(1, 200), row(1, 300)];
        expect(compute(withItems(items)).total).toBe(600);
        items = items.filter((_, k) => k !== 1);
        expect(compute(withItems(items)).total).toBe(400);
        items = [];
        expect(compute(withItems(items))).toEqual({ total: 0, boqQty: 0 });
    });
});

describe('demolition edge — odd values', () => {
    it('NaN and Infinity count as 0', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            expect(lineTotal(row(bad, 5))).toBe(0);
            expect(lineTotal(row(5, bad))).toBe(0);
            expect(compute(withItems([row(bad, 5), row(2, 3)])).total).toBe(6);
        }
    });

    it('huge: 1e6 × 1e6 = 1e12 and BOQ stays finite', () => {
        expect(compute(withItems([row(1e6, 1e6)])).total).toBe(1e12);
        const res = computeProject(projectWith(withItems([row(1e6, 1e6)])));
        expect(Number.isFinite(res.boq.constructionTotal)).toBe(true);
        expect(boqRow(res, 'R12').total).toBe(1e12);
    });

    it('negative rate or quantity: finite, no NaN, and no demolition line is counted when the total is not positive', () => {
        const o = compute(withItems([row(-5, 100)]));
        expect(o.total).toBe(-500);
        expect(o.boqQty).toBe(0);
        const res = computeProject(projectWith(withItems([row(-5, 100)])));
        expect(Number.isFinite(res.boq.constructionTotal)).toBe(true);
        expect(boqRow(res, 'R12').total).toBe(0);
    });
});

describe('demolition edge — BOQ link, section 1 and skipping', () => {
    it('links boqQty → R12 qty and total → R12 labour only', () => {
        expect(demolition.boqLinks).toEqual([
            { line: 'R12', field: 'qty', output: 'boqQty' },
            { line: 'R12', field: 'lab', output: 'total' },
        ]);
    });

    it('work present: R12 = 1 เหมา × labour total, note cleared, material 0', () => {
        const res = computeProject(projectWith(fixedWith([10, 350], [2, 1000])));
        const r12 = boqRow(res, 'R12');
        expect(r12.qty).toBe(1);
        expect(r12.labUnit).toBe(5500);
        expect(r12.total).toBe(5500);
        expect(r12.matTotal).toBe(0);
        expect(r12.note).toBe('');
        // D1: section 1 now includes row 12 (Excel's short range left it out); fill is priced 0.
        expect(section(res, 1).total).toBe(5500);
        expect(res.boq.constructionTotal - computeProject(createProject('blank')).boq.constructionTotal).toBe(5500);
    });

    it('does not touch the fill row R13', () => {
        const a = boqRow(computeProject(projectWith(fixedWith([10, 350]))), 'R13');
        const b = boqRow(computeProject(createProject('blank')), 'R13');
        expect(a).toEqual(b);
    });

    it('works on the sample project too', () => {
        const res = computeProject(projectWith(fixedWith([1, 1]), 'sample'));
        expect(boqRow(res, 'R12').total).toBe(1);
    });

    it('marked "ไม่มีในโครงการนี้": outputs 0, R12 quantity 0, total 0 even with entered work', () => {
        const p = projectWith(fixedWith([10, 350]));
        p.journey = { demolition: 'skipped' };
        const res = computeProject(p);
        expect(res.calcOutputs.demolition).toEqual({ total: 0, boqQty: 0 });
        const r12 = boqRow(res, 'R12');
        expect(r12.qty).toBe(0);
        expect(r12.total).toBe(0);
        expect(section(res, 1).total).toBe(0);
    });

    it('skipping demolition leaves fill alone (both feed section 1)', () => {
        const p = createProject('sample');
        const a = computeProject(p);
        p.journey = { demolition: 'skipped' };
        const b = computeProject(p);
        expect(boqRow(b, 'R13').qty).toBe(boqRow(a, 'R13').qty);
    });

    it('a quantity typed on the BOQ page for R12 does not survive skipping', () => {
        const p = createProject('blank');
        p.boqOverrides = { R12: { qty: 3, lab: 100 } };
        p.journey = { demolition: 'skipped' };
        expect(boqRow(computeProject(p), 'R12').total).toBe(0);
    });
});
