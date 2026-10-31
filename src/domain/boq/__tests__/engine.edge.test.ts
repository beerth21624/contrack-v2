// QA edge tests for the BOQ engine: equivalence partitions, boundaries, decision tables, error guessing.
// Synthetic templates are used so every expected number can be written down by hand.
import { describe, expect, it } from 'vitest';
import { ceilingTo, computeBoq, expandSlots, roundUp } from '../engine';
import type {
    BoqHeadingTemplate, BoqItemRow, BoqItemTemplate, BoqResult, BoqSectionTemplate, GrossRule, PriceRule, QtyRule,
} from '../types';

type ItemOpts = Partial<Omit<BoqItemTemplate, 'type' | 'key'>>;

const item = (key: string, o: ItemOpts = {}): BoqItemTemplate => ({
    type: 'item', key, excelRow: 1, desc: `d-${key}`, unit: 'u',
    qty: { kind: 'input', value: 0 }, waste: 0, gross: 'std', mat: 0, lab: 0,
    materialBasis: 'gross', labourBasis: 'net', ...o,
});
const heading = (key: string): BoqHeadingTemplate => ({ type: 'heading', key, excelRow: 1, desc: `h-${key}` });
const sec = (no: number, lines: BoqSectionTemplate['lines'], inConstructionTotal = true): BoqSectionTemplate => ({
    no, title: `sec ${no}`, calculators: [], inConstructionTotal, lines,
});
const input = (value: number): QtyRule => ({ kind: 'input', value });

const rowOf = (r: BoqResult, key: string): BoqItemRow => {
    for (const s of r.sections) for (const row of s.rows) if (row.type === 'item' && row.key === key) return row;
    throw new Error(`row ${key} missing`);
};

describe('roundUp (Excel ROUNDUP(x,0))', () => {
    it.each([
        [34.1, 35], [35, 35], [35.0000000001, 35], [34.9999999999, 35], [0.0000001, 1], [0, 0], [1, 1], [-1.5, -1], [1e12 + 0.5, 1e12 + 1],
    ])('roundUp(%d) = %d', (x, want) => {
        expect(roundUp(x)).toBe(want);
    });
    it('never returns -0', () => {
        expect(Object.is(roundUp(-1e-9), 0)).toBe(true);
        expect(Object.is(roundUp(-0), 0)).toBe(true);
    });
});

describe('ceilingTo (Excel CEILING(x, step))', () => {
    it.each([
        [1.01, 0.25, 1.25], [1.25, 0.25, 1.25], [1.2500000001, 0.25, 1.25], [0, 0.25, 0], [2.0000000001, 0.25, 2], [0.26, 0.25, 0.5], [7, 5, 10],
    ])('ceilingTo(%d, %d) = %d', (x, step, want) => {
        expect(ceilingTo(x, step)).toBeCloseTo(want, 12);
    });
});

describe('quantity, waste and gross rules', () => {
    it('std: gross = qty x (1 + waste); mat on gross, labour on net', () => {
        const r = computeBoq({ sections: [sec(1, [item('A', { qty: input(10), waste: 0.1, mat: 100, lab: 50 })])] });
        const a = rowOf(r, 'A');
        expect(a.grossQty).toBeCloseTo(11, 12);
        expect(a.matTotal).toBeCloseTo(1100, 9);
        expect(a.labTotal).toBe(500);
        expect(a.total).toBeCloseTo(1600, 9);
    });

    it.each([
        // qty, waste, expected ROUNDUP
        [10, 0, 10], [10, 0.05, 11], [10, 0.1, 11], [34, 0.003, 35], [0, 0.5, 0], [100, 0.1, 110], [3.2, 0.1, 4],
    ])('ceilInt: qty %d waste %d -> %d', (qty, waste, want) => {
        const r = computeBoq({ sections: [sec(1, [item('A', { qty: input(qty), waste, gross: 'ceilInt', mat: 10 })])] });
        expect(rowOf(r, 'A').grossQty).toBe(want);
        expect(rowOf(r, 'A').matTotal).toBeCloseTo(want * 10, 9);
    });

    it.each([
        // qty, waste -> MAX(1, CEILING(x,0.25)); 0 stays 0 (D1)
        [0, 0, 0], [0.01, 0, 1], [0.9, 0, 1], [1, 0, 1], [1.01, 0, 1.25], [2, 0.1, 2.25], [4, 0, 4], [-3, 0.1, 0],
    ])('concrete: qty %d waste %d -> %d', (qty, waste, want) => {
        const r = computeBoq({ sections: [sec(1, [item('A', { qty: input(qty), waste, gross: 'concrete', mat: 2000 })])] });
        expect(rowOf(r, 'A').grossQty).toBeCloseTo(want, 12);
    });

    it('gross "none": grossQty null, material falls back to net qty', () => {
        const r = computeBoq({ sections: [sec(1, [item('A', { qty: input(4), gross: 'none', mat: 25 })])] });
        expect(rowOf(r, 'A').grossQty).toBeNull();
        expect(rowOf(r, 'A').matTotal).toBe(100);
    });

    it('materialBasis "net" ignores waste; labourBasis "gross" uses it', () => {
        const r = computeBoq({
            sections: [sec(1, [item('A', { qty: input(10), waste: 0.5, mat: 10, lab: 10, materialBasis: 'net', labourBasis: 'gross' })])],
        });
        expect(rowOf(r, 'A').matTotal).toBe(100);
        expect(rowOf(r, 'A').labTotal).toBeCloseTo(150, 9);
    });

    it('qty "none": net 0, only gross carries (tie wire = ratio x sum of gross of refs)', () => {
        const gross: GrossRule = { kind: 'tieWire', refs: ['A', 'B'], ratio: 0.03 };
        const r = computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(100), waste: 0.06, gross: 'std' }),
                item('B', { qty: input(50), waste: 0.09, gross: 'std' }),
                item('W', { qty: { kind: 'none' }, gross, mat: 50, labourBasis: 'gross' }),
            ])],
        });
        const w = rowOf(r, 'W');
        expect(w.qty).toBe(0);
        expect(w.grossQty).toBeCloseTo((106 + 54.5) * 0.03, 9);
        expect(w.matTotal).toBeCloseTo((106 + 54.5) * 0.03 * 50, 9);
    });

    it('tie wire reading a ref without gross uses that ref net qty', () => {
        const r = computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(100), gross: 'none' }),
                item('W', { qty: { kind: 'none' }, gross: { kind: 'tieWire', refs: ['A'], ratio: 0.1 } }),
            ])],
        });
        expect(rowOf(r, 'W').grossQty).toBeCloseTo(10, 12);
    });

    it('tie wire with no refs is 0', () => {
        const r = computeBoq({ sections: [sec(1, [item('W', { qty: { kind: 'none' }, gross: { kind: 'tieWire', refs: [], ratio: 0.03 }, mat: 50 })])] });
        expect(rowOf(r, 'W').grossQty).toBe(0);
        expect(rowOf(r, 'W').total).toBe(0);
    });

    it('waste 100 % doubles the gross', () => {
        const r = computeBoq({ sections: [sec(1, [item('A', { qty: input(7), waste: 1, mat: 3 })])] });
        expect(rowOf(r, 'A').matTotal).toBe(42);
    });

    it('a "calc" row uses its fallback until a calculator links a value', () => {
        const s = [sec(1, [item('A', { qty: { kind: 'calc', calc: 'x', output: 'o', fallback: 12 }, mat: 1 })])];
        expect(rowOf(computeBoq({ sections: s }), 'A').qty).toBe(12);
        expect(rowOf(computeBoq({ sections: s, linked: { A: { qty: 20 } } }), 'A').qty).toBe(20);
        expect(rowOf(computeBoq({ sections: s, linked: { A: { qty: 20 } }, overrides: { A: { qty: 5 } } }), 'A').qty).toBe(5);
    });
});

describe('derived rows (ไม้คร่าว 0.6 / ตะปู 0.25 x ไม้แบบ)', () => {
    const lines = (formwork: number) => [
        item('F', { qty: input(formwork), waste: 0.1, mat: 100, lab: 40 }),
        item('K', { qty: { kind: 'line', ref: 'F', factor: 0.6 }, waste: 0.1, mat: 20, lab: 10 }),
        item('N', { qty: { kind: 'line', ref: 'F', factor: 0.25 }, waste: 0.1, mat: 8, lab: 2 }),
    ];

    it('net quantities are 0.6 / 0.25 of the formwork net quantity', () => {
        const r = computeBoq({ sections: [sec(1, lines(100))] });
        expect(rowOf(r, 'K').qty).toBeCloseTo(60, 12);
        expect(rowOf(r, 'N').qty).toBeCloseTo(25, 12);
        expect(rowOf(r, 'K').grossQty).toBeCloseTo(66, 12);
        expect(rowOf(r, 'K').matTotal).toBeCloseTo(66 * 20, 9);
        expect(rowOf(r, 'N').labTotal).toBeCloseTo(25 * 2, 9);
    });

    it('follow the formwork quantity when it is overridden, and when it is linked', () => {
        expect(rowOf(computeBoq({ sections: [sec(1, lines(100))], overrides: { F: { qty: 200 } } }), 'K').qty).toBeCloseTo(120, 12);
        const s = [sec(1, [
            item('F', { qty: { kind: 'calc', calc: 'c', output: 'o', fallback: 1 }, waste: 0.1 }),
            item('K', { qty: { kind: 'line', ref: 'F', factor: 0.6 } }),
        ])];
        expect(rowOf(computeBoq({ sections: s, linked: { F: { qty: 10 } } }), 'K').qty).toBeCloseTo(6, 12);
    });

    it('formwork 0 gives derived rows 0 and no NaN', () => {
        const r = computeBoq({ sections: [sec(1, lines(0))] });
        expect(rowOf(r, 'K').total).toBe(0);
        expect(Number.isNaN(r.constructionTotal)).toBe(false);
    });

    it('a typed qty override on a derived row is ignored (not editable)', () => {
        const r = computeBoq({ sections: [sec(1, lines(100))], overrides: { K: { qty: 999 } } });
        expect(rowOf(r, 'K').qty).toBeCloseTo(60, 12);
        expect(rowOf(r, 'K').editable.qty).toBe(false);
        expect(rowOf(r, 'F').editable.qty).toBe(true);
    });

    it('chains of derived rows multiply through', () => {
        const r = computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(10) }),
                item('B', { qty: { kind: 'line', ref: 'A', factor: 0.5 } }),
                item('C', { qty: { kind: 'line', ref: 'B', factor: 0.5 } }),
            ])],
        });
        expect(rowOf(r, 'C').qty).toBe(2.5);
    });

    it('sumLines adds net quantities of its refs; an empty list is 0', () => {
        const r = computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(3) }), item('B', { qty: input(4.5) }),
                item('S', { qty: { kind: 'sumLines', refs: ['A', 'B'] } }),
                item('E', { qty: { kind: 'sumLines', refs: [] } }),
            ])],
        });
        expect(rowOf(r, 'S').qty).toBe(7.5);
        expect(rowOf(r, 'E').qty).toBe(0);
    });

    it('a ref in a later section is resolved too', () => {
        const r = computeBoq({
            sections: [
                sec(1, [item('D', { qty: { kind: 'line', ref: 'Z', factor: 2 } })]),
                sec(2, [item('Z', { qty: input(5) })]),
            ],
        });
        expect(rowOf(r, 'D').qty).toBe(10);
    });
});

describe('unit price rules (x2 prices and consumables %)', () => {
    it('linePrice multiplies the referenced price (อิฐเต็มแผ่น = ครึ่งแผ่น x 2) for mat and lab', () => {
        const half: PriceRule = { kind: 'linePrice', ref: 'H', factor: 2 };
        const r = computeBoq({
            sections: [sec(1, [
                item('H', { qty: input(1), mat: 80, lab: 30 }),
                item('F', { qty: input(10), mat: half, lab: half }),
            ])],
        });
        expect(rowOf(r, 'F').matUnit).toBe(160);
        expect(rowOf(r, 'F').labUnit).toBe(60);
        expect(rowOf(r, 'F').total).toBe(1600 + 600);
    });

    it('linePrice follows an override of the referenced price', () => {
        const r = computeBoq({
            sections: [sec(1, [
                item('H', { mat: 80 }),
                item('F', { qty: input(1), mat: { kind: 'linePrice', ref: 'H', factor: 2 } }),
            ])],
            overrides: { H: { mat: 100 } },
        });
        expect(rowOf(r, 'F').matUnit).toBe(200);
    });

    it('consumables = pct x sum(mat+lab totals) of refs, recomputed when a ref changes', () => {
        const mk = (qty: number) => computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(qty), mat: 100, lab: 50 }),
                item('B', { qty: input(2), mat: 10, lab: 5 }),
                item('C', { qty: input(1), mat: { kind: 'consumables', refs: ['A', 'B'], pct: 0.5 } }),
            ])],
        });
        expect(rowOf(mk(10), 'C').matUnit).toBeCloseTo(0.5 * (1500 + 30), 9);
        expect(rowOf(mk(20), 'C').matUnit).toBeCloseTo(0.5 * (3000 + 30), 9);
    });

    it('consumables with pct 0 or no refs is 0', () => {
        const r = computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(1), mat: 100 }),
                item('C', { qty: input(1), mat: { kind: 'consumables', refs: ['A'], pct: 0 } }),
                item('D', { qty: input(1), mat: { kind: 'consumables', refs: [], pct: 0.5 } }),
            ])],
        });
        expect(rowOf(r, 'C').total).toBe(0);
        expect(rowOf(r, 'D').total).toBe(0);
    });

    it('a material override on the consumables row wins over the rule', () => {
        const r = computeBoq({
            sections: [sec(1, [
                item('A', { qty: input(1), mat: 100 }),
                item('C', { qty: input(1), mat: { kind: 'consumables', refs: ['A'], pct: 0.5 } }),
            ])],
            overrides: { C: { mat: 7 } },
        });
        expect(rowOf(r, 'C').matUnit).toBe(7);
    });
});

describe('overrides (override then clear back to the template)', () => {
    const base = [sec(1, [item('A', { qty: input(10), waste: 0.1, mat: 100, lab: 50 })])];
    const original = computeBoq({ sections: base });

    it('qty / waste / mat / lab overrides each change only their own part', () => {
        expect(rowOf(computeBoq({ sections: base, overrides: { A: { qty: 20 } } }), 'A').total).toBeCloseTo(20 * 1.1 * 100 + 20 * 50, 9);
        expect(rowOf(computeBoq({ sections: base, overrides: { A: { waste: 0 } } }), 'A').matTotal).toBe(1000);
        expect(rowOf(computeBoq({ sections: base, overrides: { A: { mat: 1 } } }), 'A').matTotal).toBeCloseTo(11, 9);
        expect(rowOf(computeBoq({ sections: base, overrides: { A: { lab: 0 } } }), 'A').labTotal).toBe(0);
    });

    it('0 is a real override (not treated as "empty")', () => {
        const r = computeBoq({ sections: base, overrides: { A: { qty: 0, mat: 0, lab: 0 } } });
        expect(rowOf(r, 'A').total).toBe(0);
        expect(rowOf(r, 'A').fromCalc.qty).toBe(false);
    });

    it('clearing the override (undefined fields / empty object / no entry) returns exactly the template result', () => {
        expect(computeBoq({ sections: base, overrides: { A: {} } })).toEqual(original);
        expect(computeBoq({ sections: base, overrides: { A: undefined } })).toEqual(original);
        expect(computeBoq({ sections: base, overrides: { A: { qty: undefined, waste: undefined } } })).toEqual(original);
        expect(computeBoq({ sections: base, overrides: {} })).toEqual(original);
    });

    it('desc / note overrides replace the text but not the numbers', () => {
        const r = computeBoq({ sections: base, overrides: { A: { desc: 'ใหม่', note: 'หมายเหตุ' } } });
        expect(rowOf(r, 'A').desc).toBe('ใหม่');
        expect(rowOf(r, 'A').note).toBe('หมายเหตุ');
        expect(rowOf(r, 'A').total).toBe(rowOf(original, 'A').total);
    });

    it('override on one row leaves other rows untouched', () => {
        const s = [sec(1, [item('A', { qty: input(1), mat: 10 }), item('B', { qty: input(1), mat: 20 })])];
        const r = computeBoq({ sections: s, overrides: { A: { mat: 99 } } });
        expect(rowOf(r, 'B').total).toBe(20);
        expect(r.constructionTotal).toBe(119);
    });

    it('an override for an unknown key is ignored (stale override after a slot shrinks)', () => {
        expect(computeBoq({ sections: base, overrides: { GONE: { qty: 5 } } })).toEqual(original);
    });

    it('linked price shows as fromCalc until overridden', () => {
        const r1 = computeBoq({ sections: base, linked: { A: { mat: 7 } } });
        expect(rowOf(r1, 'A').fromCalc.mat).toBe(true);
        expect(rowOf(r1, 'A').matUnit).toBe(7);
        const r2 = computeBoq({ sections: base, linked: { A: { mat: 7 } }, overrides: { A: { mat: 8 } } });
        expect(rowOf(r2, 'A').fromCalc.mat).toBe(false);
        expect(rowOf(r2, 'A').matUnit).toBe(8);
    });

    it('linked unit text replaces the template unit', () => {
        expect(rowOf(computeBoq({ sections: base, linked: { A: { unit: 'ตร.ม.' } } }), 'A').unit).toBe('ตร.ม.');
    });
});

describe('hostile numbers (negative / zero / huge / non-finite)', () => {
    const one = (o: ItemOpts) => [sec(1, [item('A', o)])];

    it('negative qty flows through as negative money (a credit line)', () => {
        const r = computeBoq({ sections: one({ qty: input(-5), waste: 0.1, mat: 10, lab: 4 }) });
        expect(rowOf(r, 'A').matTotal).toBeCloseTo(-55, 9);
        expect(rowOf(r, 'A').labTotal).toBe(-20);
        expect(r.constructionTotal).toBeCloseTo(-75, 9);
    });

    it('negative override qty and zero override qty', () => {
        expect(computeBoq({ sections: one({ qty: input(5), mat: 10 }), overrides: { A: { qty: -2 } } }).constructionTotal).toBe(-20);
        expect(computeBoq({ sections: one({ qty: input(5), mat: 10 }), overrides: { A: { qty: 0 } } }).constructionTotal).toBe(0);
    });

    it('huge quantity stays finite and exact enough', () => {
        const r = computeBoq({ sections: one({ qty: input(1e12), mat: 1000 }) });
        expect(r.constructionTotal).toBe(1e15);
        expect(Number.isFinite(r.constructionTotal)).toBe(true);
    });

    it('NaN / Infinity quantity becomes 0 (not NaN)', () => {
        for (const bad of [Number.NaN, Infinity, -Infinity]) {
            const r = computeBoq({ sections: one({ qty: input(1), mat: 10 }), overrides: { A: { qty: bad } } });
            expect(rowOf(r, 'A').qty).toBe(0);
            expect(r.constructionTotal).toBe(0);
        }
    });

    // The engine's net() guards non-finite quantities, but price/waste overrides are not guarded: a NaN typed
    // into mat/lab/waste poisons the row, the section and the construction total (and everything downstream:
    // planning, cash flow, export). Expected: totals stay finite (treated like quantity: 0).
    it('inputs: override mat = NaN on a row, expected constructionTotal finite, got NaN (engine.ts price())', () => {
        const r = computeBoq({ sections: one({ qty: input(1), mat: 10 }), overrides: { A: { mat: Number.NaN } } });
        expect(Number.isFinite(r.constructionTotal)).toBe(true);
    });
    it('inputs: override waste = NaN, expected constructionTotal finite, got NaN (engine.ts waste())', () => {
        const r = computeBoq({ sections: one({ qty: input(1), mat: 10 }), overrides: { A: { waste: Number.NaN } } });
        expect(Number.isFinite(r.constructionTotal)).toBe(true);
    });
    it('inputs: override lab = Infinity, expected constructionTotal finite, got Infinity (engine.ts price())', () => {
        const r = computeBoq({ sections: one({ qty: input(1), lab: 10 }), overrides: { A: { lab: Infinity } } });
        expect(Number.isFinite(r.constructionTotal)).toBe(true);
    });

    it('floating point: 0.1 x 3 lines sums close to 0.3, never drifting by a satang', () => {
        const r = computeBoq({ sections: [sec(1, [
            item('A', { qty: input(1), mat: 0.1 }), item('B', { qty: input(1), mat: 0.1 }), item('C', { qty: input(1), mat: 0.1 }),
        ])] });
        expect(r.constructionTotal).toBeCloseTo(0.3, 12);
    });

    it('3,000 rows sum without losing precision beyond 1e-6', () => {
        const lines = Array.from({ length: 3000 }, (_, i) => item(`R${i}`, { qty: input(1), mat: 0.1 + (i % 7) * 0.01 }));
        const expected = lines.reduce((s, l) => s + (l.mat as number), 0);
        expect(computeBoq({ sections: [sec(1, lines)] }).constructionTotal).toBeCloseTo(expected, 6);
    });
});

describe('section sub-totals and construction total', () => {
    const sections = [
        sec(0, [item('L', { qty: input(1), lab: 7500 })], false),
        sec(1, [heading('H'), item('A', { qty: input(2), mat: 10, lab: 5 }), item('B', { qty: input(1), mat: 1, lab: 1 })]),
        sec(2, [item('C', { qty: input(3), waste: 0.5, mat: 100, lab: 10 })]),
        sec(3, []),
    ];
    const r = computeBoq({ sections });

    it('each section total = sum of item mat + sum of item lab (headings add nothing)', () => {
        expect(r.sections[1]?.matTotal).toBeCloseTo(2 * 10 + 1, 12);
        expect(r.sections[1]?.labTotal).toBe(2 * 5 + 1);
        expect(r.sections[1]?.total).toBeCloseTo(32, 12);
        expect(r.sections[2]?.total).toBeCloseTo(3 * 1.5 * 100 + 30, 12);
    });

    it('section 0 (land survey 7,500) goes to preConstructionTotal, never to constructionTotal', () => {
        expect(r.preConstructionTotal).toBe(7500);
        expect(r.constructionTotal).toBeCloseTo(32 + 480, 12);
        expect(r.sections[0]?.inConstructionTotal).toBe(false);
    });

    it('an empty section has total 0', () => {
        expect(r.sections[3]?.total).toBe(0);
        expect(r.sections[3]?.rows).toEqual([]);
    });

    it('construction + pre = sum of every section total', () => {
        const all = r.sections.reduce((s, x) => s + x.total, 0);
        expect(r.constructionTotal + r.preConstructionTotal).toBeCloseTo(all, 9);
    });

    it('heading rows keep their identity in the result', () => {
        const h = r.sections[1]?.rows[0];
        expect(h).toMatchObject({ type: 'heading', key: 'H', desc: 'h-H' });
    });

    it('no sections at all gives zeros', () => {
        expect(computeBoq({ sections: [] })).toEqual({ sections: [], constructionTotal: 0, preConstructionTotal: 0 });
    });

    it('is pure: same input twice gives an equal result, input not mutated', () => {
        const frozen = structuredClone(sections);
        const a = computeBoq({ sections, overrides: { A: { qty: 9 } } });
        const b = computeBoq({ sections, overrides: { A: { qty: 9 } } });
        expect(a).toEqual(b);
        expect(sections).toEqual(frozen);
    });
});

describe('slots replacing Excel rows', () => {
    const slotSection = (): BoqSectionTemplate => sec(1, [
        item('PRE', { qty: input(1), mat: 1 }),
        { type: 'slot', key: 'S1', excelRow: 5, calc: 'c', slot: 'rebar', fallback: [item('FB', { qty: input(2), mat: 10 })] },
        item('POST', { qty: input(1), mat: 1 }),
    ]);

    it('uses the Excel fallback rows until a calculator supplies rows', () => {
        const r = computeBoq({ sections: [slotSection()] });
        expect(r.sections[0]?.rows.map(x => x.key)).toEqual(['PRE', 'FB', 'POST']);
        expect(r.constructionTotal).toBe(22);
    });

    it('supplied rows replace the fallback, in place', () => {
        const r = computeBoq({
            sections: [slotSection()],
            slots: { 'c.rebar': [item('X', { qty: input(1), mat: 5 }), item('Y', { qty: input(1), mat: 6 })] },
        });
        expect(r.sections[0]?.rows.map(x => x.key)).toEqual(['PRE', 'X', 'Y', 'POST']);
        expect(r.constructionTotal).toBe(13);
    });

    it('an empty supplied list removes the rows (skipped work), it does not fall back', () => {
        const r = computeBoq({ sections: [slotSection()], slots: { 'c.rebar': [] } });
        expect(r.sections[0]?.rows.map(x => x.key)).toEqual(['PRE', 'POST']);
        expect(r.constructionTotal).toBe(2);
    });

    it('an explicit undefined slot behaves like a missing one', () => {
        const r = computeBoq({ sections: [slotSection()], slots: { 'c.rebar': undefined } });
        expect(r.sections[0]?.rows.map(x => x.key)).toEqual(['PRE', 'FB', 'POST']);
    });

    it('slot rows can be overridden and referenced by other rows', () => {
        const r = computeBoq({
            sections: [sec(1, [
                { type: 'slot', key: 'S', excelRow: 1, calc: 'c', slot: 's', fallback: [] },
                item('D', { qty: { kind: 'line', ref: 'X', factor: 2 } }),
            ])],
            slots: { 'c.s': [item('X', { qty: input(3), mat: 10 })] },
            overrides: { X: { qty: 4 } },
        });
        expect(rowOf(r, 'D').qty).toBe(8);
        expect(rowOf(r, 'X').total).toBe(40);
    });

    it('a stale override of a row that vanished from the slot does not count', () => {
        const r = computeBoq({
            sections: [slotSection()], slots: { 'c.rebar': [] }, overrides: { FB: { mat: 1e6 } },
        });
        expect(r.constructionTotal).toBe(2);
    });

    it('a slot in another calculator id is not touched', () => {
        const r = computeBoq({ sections: [slotSection()], slots: { 'other.rebar': [] } });
        expect(r.sections[0]?.rows).toHaveLength(3);
    });

    it('expandSlots keeps non-slot lines and order', () => {
        const lines = slotSection().lines;
        expect(expandSlots(lines, {}).map(l => l.key)).toEqual(['PRE', 'FB', 'POST']);
    });
});

describe('graph errors', () => {
    it('circular references throw a clear error instead of recursing forever', () => {
        const s = [sec(1, [
            item('A', { qty: { kind: 'line', ref: 'B', factor: 1 } }),
            item('B', { qty: { kind: 'line', ref: 'A', factor: 1 } }),
        ])];
        expect(() => computeBoq({ sections: s })).toThrow(/Circular BOQ reference/);
    });

    it('a consumables rule that includes itself throws', () => {
        const s = [sec(1, [item('A', { qty: input(1), mat: { kind: 'consumables', refs: ['A'], pct: 1 } })])];
        expect(() => computeBoq({ sections: s })).toThrow(/Circular/);
    });

    it('a reference to a missing line throws', () => {
        expect(() => computeBoq({ sections: [sec(1, [item('A', { qty: { kind: 'line', ref: 'NOPE', factor: 1 } })])] })).toThrow(/not found/);
    });
});
