import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { fill, type FillInput } from '.';

const ctx = { outputs: () => undefined };
const volume = (i: Partial<FillInput>) => fill.compute({ ...fill.defaults(), ...i }, ctx).volume ?? NaN;

function boqRow(res: ProjectResult, key: string) {
    const r = res.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (r?.type !== 'item') throw new Error(`row ${key} missing`);
    return r;
}
function projectWith(input: Partial<FillInput>, start: 'blank' | 'sample' = 'blank'): Project {
    const p = createProject(start);
    const base = start === 'blank' ? fill.blank?.() ?? fill.defaults() : fill.defaults();
    p.calculators.fill = { ...base, ...input };
    return p;
}

describe('fill edge — blank and defaults', () => {
    it('blank() has no area or height; settlement 30 % and material kept', () => {
        expect(fill.blank?.()).toEqual({ width: 0, length: 0, height: 0, settlementPct: 30, material: 'ลูกค้าจัดหาเอง' });
    });

    it('blank volume is exactly 0, not NaN', () => {
        const o = fill.compute(fill.blank?.() ?? fill.defaults(), ctx);
        expect(o).toEqual({ volume: 0 });
        expect(Object.is(o.volume, 0)).toBe(true);
    });

    it('defaults: 20 × 20 × 0.45 × 1.30 = 234 ลบ.ม. (Excel D9)', () => {
        expect(volume({})).toBeCloseTo(234, 9);
    });

    it('blank project: R13 qty 0 (linked 0 beats the template fallback 234), gross 0, money 0', () => {
        const r13 = boqRow(computeProject(createProject('blank')), 'R13');
        expect(r13.qty).toBe(0);
        expect(r13.grossQty).toBe(0);
        expect(r13.total).toBe(0);
    });

    it('sample project: R13 qty 234, gross with the BOQ 10 % waste = 257.4, priced 0', () => {
        const r13 = boqRow(computeProject(createProject('sample')), 'R13');
        expect(r13.qty).toBeCloseTo(234, 9);
        expect(r13.waste).toBe(0.1);
        expect(r13.grossQty ?? NaN).toBeCloseTo(257.4, 9);
        expect(r13.total).toBe(0);
    });
});

describe('fill edge — each input alone (hand computed)', () => {
    it('width: 10 × 20 × 0.45 × 1.3 = 117', () => {
        expect(volume({ width: 10 })).toBeCloseTo(117, 9);
    });

    it('length: 20 × 5 × 0.45 × 1.3 = 58.5', () => {
        expect(volume({ length: 5 })).toBeCloseTo(58.5, 9);
    });

    it('height: 20 × 20 × 1 × 1.3 = 520', () => {
        expect(volume({ height: 1 })).toBeCloseTo(520, 9);
    });

    it('settlement 0 % → 20 × 20 × 0.45 = 180 (no allowance)', () => {
        expect(volume({ settlementPct: 0 })).toBeCloseTo(180, 9);
    });

    it('settlement 100 % doubles; 50 % is ×1.5', () => {
        expect(volume({ settlementPct: 100 })).toBeCloseTo(360, 9);
        expect(volume({ settlementPct: 50 })).toBeCloseTo(270, 9);
    });

    it('settlement is a whole-number percent: 30 means 30 %, not 3,000 %', () => {
        expect(volume({ settlementPct: 30 }) / volume({ settlementPct: 0 })).toBeCloseTo(1.3, 12);
    });

    it('material text changes only the BOQ note, never the quantity', () => {
        const a = volume({ material: 'ดินลูกรัง' });
        expect(a).toBeCloseTo(234, 9);
        const r13 = boqRow(computeProject(projectWith({ width: 10, length: 10, height: 1, material: 'ดินลูกรัง ซื้อจากบ่อ' })), 'R13');
        expect(r13.note).toBe('ดินลูกรัง ซื้อจากบ่อ');
    });

    it('volume is proportional: doubling any one dimension doubles the volume', () => {
        const base = volume({});
        expect(volume({ width: 40 })).toBeCloseTo(2 * base, 9);
        expect(volume({ length: 40 })).toBeCloseTo(2 * base, 9);
        expect(volume({ height: 0.9 })).toBeCloseTo(2 * base, 9);
    });
});

describe('fill edge — zero, decimal, negative, huge', () => {
    it('any zero dimension → volume 0', () => {
        expect(volume({ width: 0 })).toBe(0);
        expect(volume({ length: 0 })).toBe(0);
        expect(volume({ height: 0 })).toBe(0);
    });

    it('decimals: 12.5 × 8.25 × 0.35 × 1.3 = 46.9219 (4 dp)', () => {
        // 12.5 × 8.25 = 103.125; × 0.35 = 36.09375; × 1.3 = 46.921875
        expect(volume({ width: 12.5, length: 8.25, height: 0.35 })).toBeCloseTo(46.921875, 9);
    });

    it('tiny fill height 0.001 m stays positive and exact', () => {
        // 20 × 20 × 0.001 × 1.3 = 0.52
        expect(volume({ height: 0.001 })).toBeCloseTo(0.52, 12);
    });

    it('NaN and Infinity count as 0, never reach the BOQ', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            expect(volume({ width: bad })).toBe(0);
            expect(volume({ length: bad })).toBe(0);
            expect(volume({ height: bad })).toBe(0);
        }
        expect(volume({ settlementPct: NaN })).toBeCloseTo(180, 9);   // allowance 0
        expect(volume({ settlementPct: Infinity })).toBeCloseTo(180, 9);
    });

    it('huge 1e6 × 1e6 × 1e6 stays finite', () => {
        const v = volume({ width: 1e6, length: 1e6, height: 1e6, settlementPct: 0 });
        expect(v).toBe(1e18);
        const res = computeProject(projectWith({ width: 1e6, length: 1e6, height: 1e6 }));
        expect(Number.isFinite(boqRow(res, 'R13').qty)).toBe(true);
        expect(Number.isFinite(res.boq.constructionTotal)).toBe(true);
    });

    it('negative inputs never yield NaN/Infinity (signed arithmetic)', () => {
        for (const i of [{ width: -1 }, { height: -0.5 }, { settlementPct: -50 }, { settlementPct: -100 }, { settlementPct: -150 }]) {
            expect(Number.isFinite(volume(i)), JSON.stringify(i)).toBe(true);
        }
        expect(volume({ settlementPct: -50 })).toBeCloseTo(90, 9);
        expect(volume({ settlementPct: -100 })).toBe(0);
    });
});

describe('fill edge — BOQ link, project and skipping', () => {
    it('links only the volume into R13 net quantity', () => {
        expect(fill.boqLinks).toEqual([{ line: 'R13', field: 'qty', output: 'volume' }]);
    });

    it('the BOQ gross is net × 1.10 (waste stays in the BOQ, D10)', () => {
        const r13 = boqRow(computeProject(projectWith({ width: 10, length: 10, height: 0.5, settlementPct: 0 })), 'R13');
        expect(r13.qty).toBeCloseTo(50, 9);
        expect(r13.grossQty ?? NaN).toBeCloseTo(55, 9);
    });

    it('a priced fill row (BOQ page price 80/ลบ.ม.) costs gross × price: 55 × 80 = 4,400', () => {
        const p = projectWith({ width: 10, length: 10, height: 0.5, settlementPct: 0 });
        p.boqOverrides = { R13: { mat: 80 } };
        const r13 = boqRow(computeProject(p), 'R13');
        expect(r13.matTotal).toBeCloseTo(4400, 6);
    });

    it('a qty typed on the BOQ page wins over the calculator', () => {
        const p = projectWith({ width: 10, length: 10, height: 0.5 });
        p.boqOverrides = { R13: { qty: 7 } };
        expect(boqRow(computeProject(p), 'R13').qty).toBe(7);
    });

    it('does not touch demolition row R12', () => {
        const r12 = boqRow(computeProject(projectWith({ width: 10, length: 10, height: 1 })), 'R12');
        expect(r12.qty).toBe(0);
    });

    it('marked "ไม่มีในโครงการนี้": volume 0 and R13 quantity 0 for blank and sample', () => {
        for (const start of ['blank', 'sample'] as const) {
            const p = projectWith({ width: 10, length: 10, height: 1 }, start);
            p.journey = { fill: 'skipped' };
            const res = computeProject(p);
            expect(res.calcOutputs.fill).toEqual({ volume: 0 });
            const r13 = boqRow(res, 'R13');
            expect(r13.qty).toBe(0);
            expect(r13.grossQty).toBe(0);
            expect(r13.total).toBe(0);
        }
    });

    it('skipped fill ignores a quantity typed on the BOQ page', () => {
        const p = projectWith({ width: 10, length: 10, height: 1 });
        p.boqOverrides = { R13: { qty: 9, mat: 50 } };
        p.journey = { fill: 'skipped' };
        const r13 = boqRow(computeProject(p), 'R13');
        expect(r13.qty).toBe(0);
        expect(r13.total).toBe(0);
        expect(r13.matUnit).toBe(50);
    });
});
