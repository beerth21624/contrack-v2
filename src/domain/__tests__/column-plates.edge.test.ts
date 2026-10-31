// QA edge tests for "เพลทหัวเสา" (journey level `column-plates`, BOQ section 14). The level has no calculator:
// the user types the plate count straight on two BOQ rows (R148 เหล็กเพลท 8 x 8 นิ้ว, R149 ปูนเกร้าท์ นอนชริ้งค์),
// both "จุด" with 0 % waste. Hand-computed from the template prices: R148 = 250 material + 50 labour = 300 per
// point, R149 = 100 + 50 = 150 per point, so one point costs 450 and the Excel sample (21 points) 9,450 baht.
import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../project';
import { JOURNEY_LEVELS, type JourneyLevel } from '../journey/levels';
import { levelRows, levelTotal } from '../journey/money';
import { missingRequirements, requiredFields } from '../journey/requirements';
import type { BoqItemRow } from '../boq/types';

const level = (): JourneyLevel => {
    const l = JOURNEY_LEVELS.find(x => x.id === 'column-plates');
    if (!l) throw new Error('column-plates level missing');
    return l;
};
function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const section14 = (r: ProjectResult) => r.boq.sections.find(s => s.no === 14);
const blank = (patch: Partial<Project> = {}): Project => ({ ...createProject('blank'), ...patch });
const sample = (patch: Partial<Project> = {}): Project => ({ ...createProject('sample'), ...patch });
/** Same count on both rows, as the journey page does. */
const plates = (n: number): Project['boqOverrides'] => ({ R148: { qty: n }, R149: { qty: n } });

describe('column plates — level definition', () => {
    it('is a BOQ-typed level on section 14, not optional, without a calculator or extra rows', () => {
        const l = level();
        expect(l.kind).toEqual({ type: 'boq', sections: [14] });
        expect(l.sections).toEqual([14]);
        expect(l.optional).toBeUndefined();
        expect(l.extraRows).toBeUndefined();
    });
    it('section 14 has exactly the two plate rows (R148, R149), both in the construction total', () => {
        const s = section14(computeProject(sample()));
        expect(s?.rows.map(r => r.key)).toEqual(['R148', 'R149']);
        expect(s?.inConstructionTotal).toBe(true);
    });
    it('REQUIRED_FIELDS: nothing is required (0 plates is valid for a concrete roof)', () => {
        expect(requiredFields('column-plates').size).toBe(0);
        expect(missingRequirements('column-plates', blank())).toEqual([]);
        expect(missingRequirements('column-plates', sample())).toEqual([]);
    });
});

describe('column plates — a blank project', () => {
    const r = computeProject(blank());
    it('both rows have quantity 0 and cost nothing', () => {
        for (const k of ['R148', 'R149']) {
            expect(item(r, k).qty, k).toBe(0);
            expect(item(r, k).total, k).toBe(0);
            expect(item(r, k).grossQty, k).toBe(0);
        }
        expect(section14(r)?.total).toBe(0);
    });
    it('the level money is 0 and it lists both rows', () => {
        expect(levelTotal(level(), r)).toBe(0);
        expect(levelRows(level(), r).map(x => x.key)).toEqual(['R148', 'R149']);
    });
    it('unit prices keep the Excel values (250 / 50 and 100 / 50)', () => {
        expect([item(r, 'R148').matUnit, item(r, 'R148').labUnit]).toEqual([250, 50]);
        expect([item(r, 'R149').matUnit, item(r, 'R149').labUnit]).toEqual([100, 50]);
    });
    it('every finite: no NaN in the BOQ result', () => {
        expect(Number.isFinite(r.boq.constructionTotal)).toBe(true);
        expect(Number.isFinite(r.boq.preConstructionTotal)).toBe(true);
    });
});

describe('column plates — the Excel sample (21 points)', () => {
    const r = computeProject(sample());
    it('R148 = 21 × (250 + 50) = 6,300 and R149 = 21 × (100 + 50) = 3,150', () => {
        expect(item(r, 'R148').qty).toBe(21);
        expect(item(r, 'R148').matTotal).toBe(5250);
        expect(item(r, 'R148').labTotal).toBe(1050);
        expect(item(r, 'R148').total).toBe(6300);
        expect(item(r, 'R149').matTotal).toBe(2100);
        expect(item(r, 'R149').labTotal).toBe(1050);
        expect(item(r, 'R149').total).toBe(3150);
    });
    it('section 14 total 9,450 and the level money agree', () => {
        expect(section14(r)?.total).toBe(9450);
        expect(levelTotal(level(), r)).toBe(9450);
    });
    it('no waste: gross quantity equals the net quantity', () => {
        expect(item(r, 'R148').grossQty).toBe(21);
        expect(item(r, 'R149').grossQty).toBe(21);
    });
    it('a project that has the journey marked done keeps the value', () => {
        const done = computeProject(sample({ journey: { 'column-plates': 'done' } }));
        expect(levelTotal(level(), done)).toBe(9450);
    });
});

describe('column plates — typed quantity (equivalence classes and boundaries)', () => {
    it.each([
        [0, 0], [1, 450], [2, 900], [4, 1800], [8, 3600], [21, 9450], [100, 45000], [0.5, 225], [1_000_000, 450_000_000],
    ])('%s points cost %s baht', (n, baht) => {
        const r = computeProject(blank({ boqOverrides: plates(n) }));
        expect(item(r, 'R148').qty).toBe(n);
        expect(item(r, 'R148').total).toBeCloseTo(300 * n, 6);
        expect(item(r, 'R149').total).toBeCloseTo(150 * n, 6);
        expect(section14(r)?.total).toBeCloseTo(baht, 6);
        expect(levelTotal(level(), r)).toBeCloseTo(baht, 6);
    });
    it.each([NaN, Infinity, -Infinity])('a non-finite quantity %s is read as 0, never NaN/Infinity', (n) => {
        const r = computeProject(blank({ boqOverrides: plates(n) }));
        expect(item(r, 'R148').qty).toBe(0);
        expect(section14(r)?.total).toBe(0);
        expect(Number.isFinite(r.boq.constructionTotal)).toBe(true);
    });
    it('a negative quantity stays finite (typed on the BOQ page, not clamped)', () => {
        const r = computeProject(blank({ boqOverrides: plates(-2) }));
        expect(Number.isFinite(section14(r)?.total ?? NaN)).toBe(true);
        expect(section14(r)?.total).toBe(-900);
    });
    it('the two rows are independent: only R148 typed → R149 stays at its own quantity', () => {
        const r = computeProject(blank({ boqOverrides: { R148: { qty: 4 } } }));
        expect(item(r, 'R148').total).toBe(1200);
        expect(item(r, 'R149').qty).toBe(0);
        expect(item(r, 'R149').total).toBe(0);
    });
    it('sample + R149 typed 10: R148 keeps 21', () => {
        const r = computeProject(sample({ boqOverrides: { R149: { qty: 10 } } }));
        expect(item(r, 'R148').qty).toBe(21);
        expect(item(r, 'R149').total).toBe(1500);
    });
    it('quantity 0 on a sample project (concrete roof) removes the whole section', () => {
        const r = computeProject(sample({ boqOverrides: plates(0) }));
        expect(section14(r)?.total).toBe(0);
    });
});

describe('column plates — prices and waste edited on the BOQ page', () => {
    it('price edits change only their own row', () => {
        const r = computeProject(blank({ boqOverrides: { ...plates(10), R148: { qty: 10, mat: 300, lab: 60 } } }));
        expect(item(r, 'R148').total).toBe(3600);
        expect(item(r, 'R149').total).toBe(1500);
    });
    it('price 0 is honoured (not treated as "unset")', () => {
        const r = computeProject(blank({ boqOverrides: { R148: { qty: 10, mat: 0, lab: 0 } } }));
        expect(item(r, 'R148').total).toBe(0);
    });
    it('waste 10 % raises the material (on gross) but not the labour (on net): 21 × 1.1 × 250 + 21 × 50', () => {
        const r = computeProject(sample({ boqOverrides: { R148: { waste: 0.1 } } }));
        expect(item(r, 'R148').grossQty).toBeCloseTo(23.1, 9);
        expect(item(r, 'R148').matTotal).toBeCloseTo(5775, 9);
        expect(item(r, 'R148').labTotal).toBeCloseTo(1050, 9);
    });
});

describe('column plates — effect on the project totals', () => {
    it('the construction total moves by exactly 450 per point', () => {
        const a = computeProject(blank({ boqOverrides: plates(0) })).boq.constructionTotal;
        const b = computeProject(blank({ boqOverrides: plates(10) })).boq.constructionTotal;
        expect(b - a).toBeCloseTo(4500, 6);
    });
    it('the plates do not touch any other section', () => {
        const a = computeProject(blank({ boqOverrides: plates(0) }));
        const b = computeProject(blank({ boqOverrides: plates(10) }));
        for (const s of a.boq.sections.filter(x => x.no !== 14)) {
            expect(b.boq.sections.find(x => x.no === s.no)?.total, `section ${s.no}`).toBe(s.total);
        }
    });
    it('the level totals of all levels still add up to the BOQ when plates are typed', () => {
        const r = computeProject(blank({ boqOverrides: plates(7) }));
        const sum = JOURNEY_LEVELS.reduce((s, l) => s + levelTotal(l, r), 0);
        expect(sum).toBeCloseTo(r.boq.constructionTotal + r.boq.preConstructionTotal, 4);
    });
});

describe('column plates — level skipped ("ไม่มีในโครงการนี้")', () => {
    // The level is not `optional`, so the screen offers no skip button. If a project still carries the mark
    // (old data, API, or a future change that makes it optional) every other level puts 0 into its BOQ lines;
    // this one keeps the Excel sample's 21 points and 9,450 baht.
    it('skipped on the sample: R148 and R149 should be 0 — inputs journey["column-plates"]="skipped"', () => {
        const r = computeProject(sample({ journey: { 'column-plates': 'skipped' } }));
        expect(section14(r)?.total).toBe(0);
    });
    it('skipped with a typed quantity: should still be 0 — inputs qty 10 on R148/R149', () => {
        const r = computeProject(blank({ boqOverrides: plates(10), journey: { 'column-plates': 'skipped' } }));
        expect(item(r, 'R148').qty).toBe(0);
    });
    it('skipped on a blank project is 0 (nothing typed)', () => {
        const r = computeProject(blank({ journey: { 'column-plates': 'skipped' } }));
        expect(section14(r)?.total).toBe(0);
    });
});
