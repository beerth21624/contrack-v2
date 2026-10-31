import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { LAYOUT_FIXED_ROWS, LAYOUT_LIVE_PREVIEW, layout, layoutLine, type LayoutInput, type LayoutMaterialLine } from '.';

const ctx = { outputs: () => undefined };
const blankInput = (): LayoutInput => layout.blank?.() ?? layout.defaults();
const mk = (i: Partial<LayoutInput>, base: 'defaults' | 'blank' = 'defaults'): LayoutInput =>
    ({ ...(base === 'blank' ? blankInput() : layout.defaults()), ...i });
const out = (i: Partial<LayoutInput>, base: 'defaults' | 'blank' = 'defaults') => layout.compute(mk(i, base), ctx);
const prices = (p: number[]): LayoutMaterialLine[] => layout.defaults().materials.map((m, k) => ({ ...m, unitPrice: p[k] ?? 0 }));
const mat = (perPoint: number, fixed: number, unitPrice = 0, fixedFromStakes = false): LayoutMaterialLine =>
    ({ item: 'x', unit: 'u', perPoint, fixed, unitPrice, ...(fixedFromStakes ? { fixedFromStakes } : {}) });

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
function projectWith(input: Partial<LayoutInput>, start: 'blank' | 'sample' = 'blank'): Project {
    const p = createProject(start);
    p.calculators.layout = mk(input, start === 'blank' ? 'blank' : 'defaults');
    return p;
}

describe('layout edge — defaults and blank', () => {
    it('defaults: 26 points, 21 stakes, waste 5 %, labour 0, 5 sheet rows', () => {
        const d = layout.defaults();
        expect([d.points, d.stakes, d.waste, d.labour]).toEqual([26, 21, 0.05, 0]);
        expect(d.materials).toHaveLength(LAYOUT_FIXED_ROWS);
        expect(LAYOUT_FIXED_ROWS).toBe(5);
    });

    it('blank: points and stakes 0; recipe, waste and labour kept', () => {
        const b = blankInput();
        expect(b.points).toBe(0);
        expect(b.stakes).toBe(0);
        expect(b.waste).toBe(0.05);
        expect(b.materials).toEqual(layout.defaults().materials);
    });

    it('blank outputs are finite; the orders for points/stakes are 0 and (priced 0) money is 0', () => {
        const o = out({}, 'blank');
        expect(o).toEqual({ points: 0, stakes: 0, materialTotal: 0, labour: 0, total: 0, orderBoards: 0, orderEucalyptus: 0, orderStakes: 0 });
        for (const v of Object.values(o)) expect(Object.is(v, -0)).toBe(false);
    });

    it('blank: the two fixed rows (nails, string) still order 2 each (1 × 1.05 → 2)', () => {
        const b = blankInput();
        expect(b.materials.map(m => layoutLine(m, b).orderQty)).toEqual([0, 0, 0, 2, 2]);
    });

    it('LIVE PREVIEW maps rows 0, 1, 2 to boards, eucalyptus, stakes', () => {
        expect(LAYOUT_LIVE_PREVIEW.map(p => [p.row, p.output])).toEqual([[0, 'orderBoards'], [1, 'orderEucalyptus'], [2, 'orderStakes']]);
    });
});

describe('layout edge — each input alone (hand computed)', () => {
    it('points 10 (stakes 21): boards ⌈10.5⌉ = 11, eucalyptus ⌈31.5⌉ = 32, stakes ⌈22.05⌉ = 23', () => {
        const o = out({ points: 10 });
        expect([o.orderBoards, o.orderEucalyptus, o.orderStakes]).toEqual([11, 32, 23]);
    });

    it('points 100: boards ⌈105⌉ = 105, eucalyptus ⌈315⌉ = 315 (exact multiples must not round up)', () => {
        const o = out({ points: 100 });
        expect(o.orderBoards).toBe(105);
        expect(o.orderEucalyptus).toBe(315);
    });

    it('stakes 0 → stake order 0 (the other rows unchanged); stakes 30 → ⌈31.5⌉ = 32', () => {
        expect(out({ stakes: 0 }).orderStakes).toBe(0);
        expect(out({ stakes: 0 }).orderBoards).toBe(28);
        expect(out({ stakes: 30 }).orderStakes).toBe(32);
        expect(out({ stakes: 30 }).orderEucalyptus).toBe(82);
    });

    it('waste 0: orders equal the bases 26 / 78 / 21', () => {
        const o = out({ waste: 0 });
        expect([o.orderBoards, o.orderEucalyptus, o.orderStakes]).toEqual([26, 78, 21]);
    });

    it('waste 100 %: 52 / 156 / 42', () => {
        const o = out({ waste: 1 });
        expect([o.orderBoards, o.orderEucalyptus, o.orderStakes]).toEqual([52, 156, 42]);
    });

    it('waste 10 %, points 10: boards 11 (10 × 1.1 = 11.000000000000002 in JS), eucalyptus 33', () => {
        const o = out({ waste: 0.1, points: 10, stakes: 10 });
        expect(o.orderBoards).toBe(11);
        expect(o.orderEucalyptus).toBe(33);
        expect(o.orderStakes).toBe(11);
    });

    it('waste 50 %, points 3: boards ⌈4.5⌉ = 5, eucalyptus ⌈13.5⌉ = 14', () => {
        const o = out({ waste: 0.5, points: 3 });
        expect(o.orderBoards).toBe(5);
        expect(o.orderEucalyptus).toBe(14);
    });

    it('labour is added once to the total and does not touch materials', () => {
        const o = out({ labour: 2500 });
        expect(o.labour).toBe(2500);
        expect(o.materialTotal).toBe(0);
        expect(o.total).toBe(2500);
    });

    it('unit prices: 28×10 + 82×20 + 23×30 + 2×40 + 2×50 = 2,790; with labour 1,000 → 3,790', () => {
        const o = out({ materials: prices([10, 20, 30, 40, 50]), labour: 1000 });
        expect(o.materialTotal).toBe(2790);
        expect(o.total).toBe(3790);
    });

    it('priced blank project: only the fixed rows cost (2 × 40 + 2 × 50 = 180)', () => {
        expect(out({ materials: prices([10, 20, 30, 40, 50]) }, 'blank').materialTotal).toBe(180);
    });
});

describe('layout edge — layoutLine rules', () => {
    const inp = mk({ points: 3, stakes: 5, waste: 0.05 });

    it('beforeWaste = perPoint × points + fixed; order = ⌈× 1.05⌉; total = order × price', () => {
        expect(layoutLine(mat(2, 1, 10), inp)).toEqual({ fixed: 1, beforeWaste: 7, orderQty: 8, total: 80 });   // 7.35 → 8
    });

    it('fixedFromStakes uses the stake count and ignores the typed fixed value', () => {
        expect(layoutLine(mat(0, 99, 0, true), inp)).toEqual({ fixed: 5, beforeWaste: 5, orderQty: 6, total: 0 });   // 5.25 → 6
        expect(layoutLine(mat(1, 99, 0, true), inp).beforeWaste).toBe(8);
    });

    it('a row with perPoint 0 and fixed 0 orders 0', () => {
        expect(layoutLine(mat(0, 0, 100), inp)).toEqual({ fixed: 0, beforeWaste: 0, orderQty: 0, total: 0 });
    });

    it('exact integers do not round up: 20 × 1.05 = 21, 100 × 1.1 = 110', () => {
        expect(layoutLine(mat(0, 20), mk({ waste: 0.05 })).orderQty).toBe(21);
        expect(layoutLine(mat(0, 100), mk({ waste: 0.1 })).orderQty).toBe(110);
    });

    it('a hair above an integer rounds up: 20.001 × 1.05 → 22', () => {
        expect(layoutLine(mat(0, 20.001), mk({ waste: 0.05 })).orderQty).toBe(22);
    });

    it('tiny positive quantity orders 1', () => {
        expect(layoutLine(mat(0, 0.0001), mk({ waste: 0.05 })).orderQty).toBe(1);
    });
});

describe('layout edge — table rows', () => {
    it('empty table: no materials, total = labour, previews 0', () => {
        const o = out({ materials: [], labour: 700 });
        expect(o).toEqual({ points: 26, stakes: 21, materialTotal: 0, labour: 700, total: 700, orderBoards: 0, orderEucalyptus: 0, orderStakes: 0 });
    });

    it('a single row feeds only the first preview', () => {
        const o = out({ materials: [mat(1, 0, 10)], points: 4, waste: 0 });
        expect(o.orderBoards).toBe(4);
        expect(o.orderEucalyptus).toBe(0);
        expect(o.materialTotal).toBe(40);
    });

    it('rows added after the 5 sheet rows count in the money but not in the previews', () => {
        const base = out({ materials: prices([10, 20, 30, 40, 50]) });
        const more = out({ materials: [...prices([10, 20, 30, 40, 50]), mat(0, 2, 65)] });
        expect(more.materialTotal).toBe((base.materialTotal ?? 0) + 3 * 65);   // 2 × 1.05 = 2.1 → 3
        expect(more.orderBoards).toBe(base.orderBoards);
    });

    it('50 extra rows (D5 unlimited)', () => {
        const rows = [...layout.defaults().materials, ...Array.from({ length: 50 }, () => mat(1, 0, 1))];
        const o = out({ materials: rows, points: 10, waste: 0 });
        expect(o.materialTotal).toBe(500);
    });

    it('deleting an extra row removes exactly its money', () => {
        const extra = [mat(0, 4, 10), mat(0, 6, 10)];
        const rows = [...layout.defaults().materials, ...extra];
        const waste0 = { waste: 0, points: 0, stakes: 0 };
        expect(out({ ...waste0, materials: rows }).materialTotal).toBe(100);
        expect(out({ ...waste0, materials: rows.slice(0, -1) }).materialTotal).toBe(40);
    });
});

describe('layout edge — zero, decimal, negative, huge', () => {
    it('decimal points: 2.5 points → boards ⌈2.625⌉ = 3, eucalyptus ⌈7.875⌉ = 8', () => {
        const o = out({ points: 2.5 });
        expect(o.orderBoards).toBe(3);
        expect(o.orderEucalyptus).toBe(8);
        expect(o.points).toBe(2.5);
    });

    it('NaN / Infinity count as 0 in every numeric field', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            const o = out({ points: bad, stakes: bad, waste: bad, labour: bad });
            for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), `${k} ${String(bad)}`).toBe(true);
            expect(o.total).toBe(0);
        }
        const rows = [{ ...mat(NaN, NaN, NaN) }, { ...mat(Infinity, 1, Infinity) }];
        for (const v of Object.values(out({ materials: rows }))) expect(Number.isFinite(v)).toBe(true);
    });

    it('huge 1e6 points: boards ⌈1.05e6⌉ = 1,050,000; eucalyptus 3,150,000', () => {
        const o = out({ points: 1e6, stakes: 1e6 });
        expect(o.orderBoards).toBe(1050000);
        expect(o.orderEucalyptus).toBe(3150000);
        expect(o.orderStakes).toBe(1050000);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });

    it('huge prices stay finite', () => {
        const o = out({ materials: prices([1e6, 1e6, 1e6, 1e6, 1e6]), labour: 1e9 });
        expect(Number.isFinite(o.total)).toBe(true);
        expect(o.materialTotal).toBe((28 + 82 + 23 + 2 + 2) * 1e6);
    });

    it('negative values never produce NaN/Infinity', () => {
        for (const v of Object.values(out({ points: -5, stakes: -5, waste: -0.5, labour: -10 }))) expect(Number.isFinite(v)).toBe(true);
    });
});

describe('layout edge — BOQ (not linked, D8) and skipping', () => {
    it('has no BOQ links', () => {
        expect(layout.boqLinks).toEqual([]);
    });

    it('R32 stays at the Excel lump sum 4,000 + 1,500 for blank and sample, whatever the input', () => {
        for (const start of ['blank', 'sample'] as const) {
            const res = computeProject(projectWith({ points: 99, stakes: 99, labour: 12345, materials: prices([9, 9, 9, 9, 9]) }, start));
            const r32 = boqRow(res, 'R32');
            expect(r32.qty).toBe(1);
            expect(r32.matUnit).toBe(4000);
            expect(r32.labUnit).toBe(1500);
            expect(r32.total).toBe(5500);
            expect(section(res, 4).total).toBe(5500);
        }
    });

    it('a BOQ-page edit of R32 is honoured when not skipped', () => {
        const p = createProject('blank');
        p.boqOverrides = { R32: { mat: 100, lab: 50 } };
        expect(boqRow(computeProject(p), 'R32').total).toBe(150);
    });

    it('marked "ไม่มีในโครงการนี้": outputs 0 and R32 (an extra row of the level) quantity 0, section 4 = 0', () => {
        for (const start of ['blank', 'sample'] as const) {
            const p = projectWith({ points: 20 }, start);
            p.journey = { layout: 'skipped' };
            const res = computeProject(p);
            expect(Object.values(res.calcOutputs.layout ?? {}).every(v => v === 0)).toBe(true);
            expect(boqRow(res, 'R32').qty).toBe(0);
            expect(boqRow(res, 'R32').total).toBe(0);
            expect(section(res, 4).total).toBe(0);
        }
    });

    it('skipped layout ignores a quantity typed on the BOQ page; price edits are kept', () => {
        const p = createProject('blank');
        p.boqOverrides = { R32: { qty: 3, mat: 77 } };
        p.journey = { layout: 'skipped' };
        const r32 = boqRow(computeProject(p), 'R32');
        expect(r32.total).toBe(0);
        expect(r32.matUnit).toBe(77);
    });

    it('skipping layout lowers the construction total by exactly 5,500 (sample)', () => {
        const a = computeProject(createProject('sample'));
        const p = createProject('sample');
        p.journey = { layout: 'skipped' };
        expect(a.boq.constructionTotal - computeProject(p).boq.constructionTotal).toBe(5500);
    });
});
