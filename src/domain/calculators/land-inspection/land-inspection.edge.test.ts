import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { checklistProgress, landInspection, LAND_INSPECTION_CHECKLIST, lineTotal, type CostLine, type LandInspectionInput } from '.';

const ctx = { outputs: () => undefined };
const compute = (i: LandInspectionInput) => landInspection.compute(i, ctx);
const line = (qty: number, unitPrice: number): CostLine => ({ label: 'x', qty, unit: 'u', unitPrice });
const withItems = (items: CostLine[]): LandInspectionInput => ({ ...landInspection.defaults(), items });

function boqRow(res: ProjectResult, key: string) {
    const row = res.boq.sections.flatMap(s => s.rows).find(r => r.key === key);
    if (row?.type !== 'item') throw new Error(`row ${key} missing`);
    return row;
}
const section = (res: ProjectResult, no: number) => {
    const s = res.boq.sections.find(x => x.no === no);
    if (!s) throw new Error(`section ${String(no)} missing`);
    return s;
};
function projectWith(input: LandInspectionInput, start: 'blank' | 'sample' = 'blank'): Project {
    const p = createProject(start);
    p.calculators['land-inspection'] = input;
    return p;
}

describe('land-inspection edge — blank and defaults', () => {
    it('blank() is the standard lump sum 7,500 (not read off the plan)', () => {
        const b = landInspection.blank?.();
        expect(b).toEqual(landInspection.defaults());
        if (!b) return;
        expect(compute(b).total).toBe(7500);
    });

    it('defaults: the 4 Excel rows 2×1,500 + 2,500 + 1,200 + 800', () => {
        const d = landInspection.defaults();
        expect(d.items).toHaveLength(4);
        expect(compute(d).total).toBe(2 * 1500 + 2500 + 1200 + 800);
    });

    it('defaults() returns a fresh object each call (no shared mutable state)', () => {
        const a = landInspection.defaults();
        a.items.push(line(1, 1));
        a.checklist[0] = { done: true, note: 'x' };
        const b = landInspection.defaults();
        expect(b.items).toHaveLength(4);
        expect(b.checklist[0]).toEqual({ done: false, note: '' });
    });

    it('the checklist has 5 questions and starts unanswered', () => {
        const d = landInspection.defaults();
        expect(LAND_INSPECTION_CHECKLIST).toHaveLength(5);
        expect(d.checklist).toHaveLength(5);
        expect(checklistProgress(d.checklist)).toEqual({ done: 0, total: 5, problems: 0 });
    });

    it('blank project: BOQ R9 = 1 เหมา × labour 7,500, material 0', () => {
        const res = computeProject(createProject('blank'));
        const r9 = boqRow(res, 'R9');
        expect(r9.qty).toBe(1);
        expect(r9.labUnit).toBe(7500);
        expect(r9.matUnit).toBe(0);
        expect(r9.total).toBe(7500);
        expect(section(res, 0).total).toBe(7500);
    });

    it('section 0 sits outside the construction total (pre-construction only)', () => {
        const res = computeProject(createProject('blank'));
        expect(section(res, 0).inConstructionTotal).toBe(false);
        expect(res.boq.preConstructionTotal).toBe(7500);
    });
});

describe('land-inspection edge — each input alone', () => {
    it('quantity of the first row: 3 วัน → 3×1,500 + 4,500', () => {
        const i = landInspection.defaults();
        i.items[0] = { ...(i.items[0] ?? line(0, 0)), qty: 3 };
        expect(compute(i).total).toBe(9000);
    });

    it('unit price of the travel row: 2,500 → 3,000 adds exactly 500', () => {
        const i = landInspection.defaults();
        i.items[1] = { ...(i.items[1] ?? line(0, 0)), unitPrice: 3000 };
        expect(compute(i).total).toBe(8000);
    });

    it('each of the four rows moves the total by its own price only', () => {
        const prices = [1500, 2500, 1200, 800];
        prices.forEach((price, k) => {
            const i = landInspection.defaults();
            const row = i.items[k] ?? line(0, 0);
            i.items[k] = { ...row, qty: row.qty + 1 };
            expect(compute(i).total, `row ${String(k)}`).toBe(7500 + price);
        });
    });

    it('text fields, unit, note and label never change the money', () => {
        const i = landInspection.defaults();
        i.projectName = 'บ้านทดสอบ';
        i.province = 'เชียงใหม่';
        i.inspector = 'สมชาย';
        i.surveyDate = '2026-10-27';
        i.items = i.items.map(l => ({ ...l, label: 'ชื่ออื่น', unit: 'หน่วยอื่น', note: 'หมายเหตุ' }));
        expect(compute(i).total).toBe(7500);
    });

    it('the checklist never changes the money', () => {
        const i = landInspection.defaults();
        i.checklist = i.checklist.map(() => ({ done: true, note: 'ok', answer: 'no' as const }));
        expect(compute(i).total).toBe(7500);
    });
});

describe('land-inspection edge — table rows', () => {
    it('empty table → total 0 and BOQ R9 labour 0 (qty stays 1 เหมา)', () => {
        expect(compute(withItems([])).total).toBe(0);
        const res = computeProject(projectWith(withItems([])));
        expect(boqRow(res, 'R9').total).toBe(0);
        expect(section(res, 0).total).toBe(0);
    });

    it('one row', () => {
        expect(compute(withItems([line(3, 700)])).total).toBe(2100);
    });

    it('more rows than Excel (D5 unlimited): 50 rows of 1 × 100', () => {
        const items = Array.from({ length: 50 }, () => line(1, 100));
        expect(compute(withItems(items)).total).toBe(5000);
        const res = computeProject(projectWith(withItems(items)));
        expect(boqRow(res, 'R9').total).toBe(5000);
    });

    it('adding a row adds exactly its line; deleting it takes it back out', () => {
        const base = landInspection.defaults();
        const added = withItems([...base.items, line(4, 250)]);
        expect(compute(added).total).toBe(7500 + 1000);
        expect(compute(withItems(added.items.slice(0, 4))).total).toBe(7500);
    });

    it('deleting rows one by one from the end reaches 0 without error', () => {
        let items = landInspection.defaults().items;
        const totals: number[] = [];
        while (items.length > 0) {
            items = items.slice(0, -1);
            totals.push(compute(withItems(items)).total ?? NaN);
        }
        expect(totals).toEqual([6700, 5500, 3000, 0]);
    });

    it('row order does not matter', () => {
        const items = landInspection.defaults().items;
        expect(compute(withItems([...items].reverse())).total).toBe(7500);
    });
});

describe('land-inspection edge — odd values', () => {
    it('zero quantity or zero price gives a 0 line', () => {
        expect(lineTotal(line(0, 999))).toBe(0);
        expect(lineTotal(line(999, 0))).toBe(0);
    });

    it('decimal quantity: 2.5 วัน × 1,500 = 3,750', () => {
        expect(lineTotal(line(2.5, 1500))).toBe(3750);
        expect(compute(withItems([line(0.5, 3)])).total).toBe(1.5);
    });

    it('NaN and Infinity in qty or price count as 0 (never poison the total)', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            expect(lineTotal(line(bad, 100))).toBe(0);
            expect(lineTotal(line(2, bad))).toBe(0);
            expect(compute(withItems([line(bad, 100), line(1, 50)])).total).toBe(50);
        }
    });

    it('huge values stay finite: 1e6 × 1e6 = 1e12', () => {
        expect(compute(withItems([line(1e6, 1e6)])).total).toBe(1e12);
        expect(Number.isFinite(computeProject(projectWith(withItems([line(1e6, 1e6)]))).boq.constructionTotal)).toBe(true);
    });

    it('negative values stay finite (no NaN) and are plain arithmetic', () => {
        expect(compute(withItems([line(-1, 1500), line(2, 1500)])).total).toBe(1500);
        expect(Number.isFinite(compute(withItems([line(-5, -5)])).total)).toBe(true);
    });
});

describe('land-inspection edge — BOQ link and skipping', () => {
    it('links only the total into R9 labour', () => {
        expect(landInspection.boqLinks).toEqual([{ line: 'R9', field: 'lab', output: 'total' }]);
    });

    it('a changed total lands in R9 labour, quantity stays 1, other sections are unchanged', () => {
        const blank = computeProject(createProject('blank'));
        const res = computeProject(projectWith(withItems([line(4, 2000)])));
        const r9 = boqRow(res, 'R9');
        expect(r9.labUnit).toBe(8000);
        expect(r9.total).toBe(8000);
        expect(res.boq.constructionTotal).toBe(blank.boq.constructionTotal);
    });

    it('works the same on the sample project', () => {
        const res = computeProject(projectWith(withItems([line(1, 10)]), 'sample'));
        expect(boqRow(res, 'R9').total).toBe(10);
    });

    it('marked "ไม่มีในโครงการนี้": output 0, R9 quantity 0, section 0 is 0', () => {
        for (const start of ['blank', 'sample'] as const) {
            const p = createProject(start);
            p.journey = { 'land-inspection': 'skipped' };
            const res = computeProject(p);
            expect(res.calcOutputs['land-inspection']).toEqual({ total: 0 });
            expect(boqRow(res, 'R9').qty).toBe(0);
            expect(section(res, 0).total).toBe(0);
            expect(res.boq.preConstructionTotal).toBe(0);
        }
    });

    it('a quantity typed on the BOQ page is also 0 while skipped, and the price edit is kept', () => {
        const p = createProject('blank');
        p.boqOverrides = { R9: { qty: 5, lab: 123 } };
        p.journey = { 'land-inspection': 'skipped' };
        const r9 = boqRow(computeProject(p), 'R9');
        expect(r9.qty).toBe(0);
        expect(r9.total).toBe(0);
        expect(r9.labUnit).toBe(123);
    });

    it('a BOQ-page price override wins over the calculator', () => {
        const p = createProject('blank');
        p.boqOverrides = { R9: { lab: 100 } };
        expect(boqRow(computeProject(p), 'R9').total).toBe(100);
    });
});

describe('land-inspection edge — checklistProgress', () => {
    const a = (done: boolean, answer?: 'yes' | 'no') => ({ done, note: '', ...(answer ? { answer } : {}) });

    it('counts only questions marked done', () => {
        expect(checklistProgress([a(true), a(false), a(true), a(false), a(true)])).toEqual({ done: 3, total: 5, problems: 0 });
    });

    it('a "no" on a yes/no question is a problem; "yes" is not', () => {
        expect(checklistProgress([a(true), a(true, 'no'), a(true, 'yes'), a(true, 'no'), a(true, 'yes')]))
            .toEqual({ done: 5, total: 5, problems: 2 });
    });

    it('an answer on a question not marked done counts neither as done nor as a problem', () => {
        expect(checklistProgress([a(false), a(false, 'no'), a(false), a(false), a(false)])).toEqual({ done: 0, total: 5, problems: 0 });
    });

    it('the open question (1) has no problem answer', () => {
        expect(checklistProgress([a(true, 'no')])).toEqual({ done: 1, total: 5, problems: 0 });
    });

    it('older saves with fewer answers, and extra answers beyond 5, are tolerated', () => {
        expect(checklistProgress([])).toEqual({ done: 0, total: 5, problems: 0 });
        const six = Array.from({ length: 6 }, () => a(true, 'no'));
        expect(checklistProgress(six)).toEqual({ done: 5, total: 5, problems: 4 });
    });
});
