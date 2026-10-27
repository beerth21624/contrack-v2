// QA edge tests for "ฐานราก_Footing" (Excel v5 sheet 25). Expected values are hand-computed from the Excel formulas
// (docs/excel-spec/02-structure-steps-06-13.md §2.1), never by calling the code under test.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import { footing, footingRow, footingTotals, FOOTING_BAR_SIZES, type FootingInput, type FootingRow } from '.';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const diff = (a: Record<string, number>, b: Record<string, number>, k: string): number => (a[k] ?? NaN) - (b[k] ?? NaN);
const SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
const KG = { RB6: 0.222, RB9: 0.499, DB12: 0.888, DB16: 1.58, DB20: 2.47 } as const;
const WASTE = { RB6: 1.06, RB9: 1.09, DB12: 1.12, DB16: 1.12, DB20: 1.12 } as const;

function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const hasItem = (r: ProjectResult, key: string) => r.boq.sections.some(s => s.rows.some(x => x.key === key));
const run = (rows: FootingRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { footing: { rows } }, ...patch });
const slotRows = (input: FootingInput) => footing.boqSlots?.(input, ctx).rebar ?? [];
const slotQty = (input: FootingInput, key: string): number => {
    const row = slotRows(input).find(x => x.key === key);
    return row?.type === 'item' && row.qty.kind === 'input' ? row.qty.value : NaN;
};

const base = (): FootingRow => {
    const r = footing.defaults().rows[0];
    if (!r) throw new Error('no default row');
    return { ...r };
};
const withRow = (patch: Partial<FootingRow>): FootingRow => ({ ...base(), ...patch });
const out1 = (patch: Partial<FootingRow>) => footing.compute({ rows: [withRow(patch)] }, ctx);

/** Hand example A: count 2, 1.0 × 2.0 × 0.5, pit (1.8 × 2.8 = 5.04 m²). */
const A: FootingRow = {
    name: 'F1', count: 2, width: 1, length: 2, depth: 0.5, excavationDepth: 1.5, sandThickness: 0.1, leanThickness: 0.05,
    shortBarSize: 'DB16', shortBarCount: 4, longBarSize: 'DB20', longBarCount: 3, ringBarSize: 'RB6', ringBarCount: 2,
};

describe('footing — blank()', () => {
    it('has no rows; every output finite; every BOQ-linked output 0', () => {
        const b = footing.blank?.();
        expect(b).toEqual({ rows: [] });
        if (!b) return;
        const o = footing.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of footing.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(o.rows).toBe(0);
    });
    it('blank project: no footing rebar rows, BOQ rows 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R38', 'R40', 'R41', 'R55', 'R58']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'footing:rebar:tie-wire')).toBe(false);
    });
});

describe('footing — hand-computed example A (every cell of one row)', () => {
    const r = footingRow(A);
    it('earthwork cells I, K, M', () => {
        expect(r.excavation).toBeCloseTo(15.12, 9);   // 2 × 5.04 × 1.5
        expect(r.sand).toBeCloseTo(1.26, 9);          // 2 × 5.04 × 0.1 × 1.25
        expect(r.lean).toBeCloseTo(0.504, 9);         // 2 × 5.04 × 0.05
    });
    it('bar cells Q..AC', () => {
        expect(r.shortLength).toBeCloseTo(2, 9);      // 1 + 2 × 0.5
        expect(r.shortTotal).toBeCloseTo(16, 9);      // 2 × 4 × 2
        expect(r.shortKg).toBeCloseTo(25.28, 9);      // × 1.58
        expect(r.longLength).toBeCloseTo(3, 9);       // 2 + 1
        expect(r.longTotal).toBeCloseTo(18, 9);       // 2 × 3 × 3
        expect(r.longKg).toBeCloseTo(44.46, 9);       // × 2.47
        expect(r.ringLength).toBeCloseTo(6, 9);       // 2 × 1 + 2 × 2
        expect(r.ringTotal).toBeCloseTo(24, 9);       // 2 × 2 × 6
        expect(r.ringKg).toBeCloseTo(5.328, 9);       // × 0.222
    });
    it('formwork AE, concrete AG, backfill before pedestal', () => {
        expect(r.formwork).toBeCloseTo(6, 9);         // 2 × 6 × 0.5
        expect(r.concrete).toBeCloseTo(2, 9);         // 2 × 2 × 0.5
        expect(r.backfillGross).toBeCloseTo(11.356, 9); // 15.12 − 1.26 − 0.504 − 2
    });
    it('compute() exposes the totals and the per-row keys the pedestal reads', () => {
        const o = footing.compute({ rows: [A] }, ctx);
        expect(o.excavation).toBeCloseTo(15.12, 9);
        expect(o['rebar.DB16']).toBeCloseTo(25.28, 9);
        expect(o['rebar.DB20']).toBeCloseTo(44.46, 9);
        expect(o['rebar.RB6']).toBeCloseTo(5.328, 9);
        expect(o['short.DB16']).toBeCloseTo(25.28, 9);
        expect(o['long.DB20']).toBeCloseTo(44.46, 9);
        expect(o['ring.RB6']).toBeCloseTo(5.328, 9);
        expect(o['row.0.width']).toBe(1);
        expect(o['row.0.depth']).toBe(0.5);
        expect(o['row.0.backfillGross']).toBeCloseTo(11.356, 9);
        expect(o.backfillGross).toBeCloseTo(11.356, 9);
    });
});

describe('footing — each input changed alone from the Excel sample (21 × 0.6³, pit 1.4², dig 1.3)', () => {
    it('count 42 doubles every quantity', () => {
        const o = out1({ count: 42 });
        expect(o.excavation).toBeCloseTo(107.016, 9);
        expect(o.sand).toBeCloseTo(5.145, 9);
        expect(o.lean).toBeCloseTo(4.116, 9);
        expect(o.formwork).toBeCloseTo(60.48, 9);
        expect(o.concrete).toBeCloseTo(9.072, 9);
        expect(o['rebar.DB12']).toBeCloseTo(671.328, 9);
        expect(o['rebar.RB9']).toBeCloseTo(100.5984, 9);
    });
    it('count 1', () => {
        const o = out1({ count: 1 });
        expect(o.excavation).toBeCloseTo(2.548, 9);     // 1.96 × 1.3
        expect(o.concrete).toBeCloseTo(0.216, 9);
        expect(o.formwork).toBeCloseTo(1.44, 9);        // 2.4 × 0.6
    });
    it('width 1.0 (pit 1.8 × 1.4 = 2.52)', () => {
        const o = out1({ width: 1 });
        expect(o.excavation).toBeCloseTo(68.796, 9);    // 21 × 2.52 × 1.3
        expect(o.concrete).toBeCloseTo(7.56, 9);        // 21 × 1 × 0.6 × 0.6
        expect(o.formwork).toBeCloseTo(40.32, 9);       // 21 × 3.2 × 0.6
        expect(o['short.DB12']).toBeCloseTo(205.128, 9);// 21 × 5 × 2.2 × 0.888
        expect(o['long.DB12']).toBeCloseTo(167.832, 9); // unchanged
        expect(o['ring.RB9']).toBeCloseTo(67.0656, 9);  // 21 × 2 × 3.2 × 0.499
    });
    it('length 1.0 (mirror of width)', () => {
        const o = out1({ length: 1 });
        expect(o.excavation).toBeCloseTo(68.796, 9);
        expect(o['short.DB12']).toBeCloseTo(167.832, 9);
        expect(o['long.DB12']).toBeCloseTo(205.128, 9);
        expect(o['ring.RB9']).toBeCloseTo(67.0656, 9);
    });
    it('thickness 0.8 changes bars, concrete and formwork but not excavation', () => {
        const o = out1({ depth: 0.8 });
        expect(o.excavation).toBeCloseTo(53.508, 9);
        expect(o.concrete).toBeCloseTo(6.048, 9);       // 21 × 0.36 × 0.8
        expect(o.formwork).toBeCloseTo(40.32, 9);       // 21 × 2.4 × 0.8
        expect(o['short.DB12']).toBeCloseTo(231 * 0.888, 9); // 21 × 5 × 2.2
        expect(o['ring.RB9']).toBeCloseTo(50.2992, 9);
        expect(o['row.0.depth']).toBe(0.8);
    });
    it('excavation depth 2.0 moves only excavation and backfill', () => {
        const o = out1({ excavationDepth: 2 });
        expect(o.excavation).toBeCloseTo(82.32, 9);     // 41.16 × 2
        expect(o.backfillGross).toBeCloseTo(82.32 - 2.5725 - 2.058 - 4.536, 9);
        expect(o.sand).toBeCloseTo(2.5725, 9);
        expect(o.concrete).toBeCloseTo(4.536, 9);
    });
    it('sand 0.1 and lean 0.1 (pit total 41.16 m²)', () => {
        expect(out1({ sandThickness: 0.1 }).sand).toBeCloseTo(5.145, 9);   // 41.16 × 0.1 × 1.25
        expect(out1({ leanThickness: 0.1 }).lean).toBeCloseTo(4.116, 9);
        expect(out1({ sandThickness: 0 }).sand).toBe(0);
    });
    it('short / long / ring bar counts', () => {
        expect(out1({ shortBarCount: 10 })['short.DB12']).toBeCloseTo(21 * 10 * 1.8 * 0.888, 9);
        expect(out1({ longBarCount: 0 })['long.DB12']).toBe(0);
        expect(out1({ ringBarCount: 4 })['ring.RB9']).toBeCloseTo(21 * 4 * 2.4 * 0.499, 9);
    });
    it('each of the three bar groups can be switched alone', () => {
        // short + long both DB12 (167.832 each): move short to DB16 → 189 m × 1.58 = 298.62
        const o = out1({ shortBarSize: 'DB16' });
        expect(o['rebar.DB16']).toBeCloseTo(298.62, 9);
        expect(o['rebar.DB12']).toBeCloseTo(167.832, 9);
        expect(out1({ longBarSize: 'RB6' })['rebar.RB6']).toBeCloseTo(189 * 0.222, 9);
        expect(out1({ ringBarSize: 'DB20' })['rebar.DB20']).toBeCloseTo(100.8 * 2.47, 9);
    });
});

describe('footing — every bar size option', () => {
    it('the dropdown offers the five sizes', () => {
        expect([...FOOTING_BAR_SIZES]).toEqual([...SIZES]);
    });
    it.each(SIZES)('short bars %s: 189 m × kg/m', (size) => {
        const o = out1({ shortBarSize: size, longBarSize: '', ringBarSize: '' });
        expect(o[`rebar.${size}`]).toBeCloseTo(189 * KG[size], 9);
        for (const other of SIZES.filter(s => s !== size)) expect(o[`rebar.${other}`], other).toBe(0);
    });
    it.each(SIZES)('ring bars %s: 100.8 m × kg/m', (size) => {
        const o = out1({ shortBarSize: '', longBarSize: '', ringBarSize: size });
        expect(o[`rebar.${size}`]).toBeCloseTo(100.8 * KG[size], 9);
    });
    it.each(['', 'DB25', 'db12', 'RB 6'])('unknown size "%s" weighs 0 and is not in any total', (size) => {
        const o = out1({ shortBarSize: size, longBarSize: size, ringBarSize: size });
        for (const s of SIZES) expect(o[`rebar.${s}`], s).toBe(0);
        expect(slotRows({ rows: [withRow({ shortBarSize: size, longBarSize: size, ringBarSize: size })] })).toEqual([]);
    });
});

describe('footing — zero, negative, decimal and huge values', () => {
    const FIELDS = ['count', 'width', 'length', 'depth', 'excavationDepth', 'sandThickness', 'leanThickness',
        'shortBarCount', 'longBarCount', 'ringBarCount'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 3.14159]) {
            const o = out1({ [field]: v });
            for (const [k, x] of Object.entries(o)) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('count 0 zeroes all quantities', () => {
        const o = out1({ count: 0 });
        for (const k of ['excavation', 'sand', 'lean', 'formwork', 'concrete', 'backfillGross', 'rebar.DB12', 'rebar.RB9']) {
            expect(o[k], k).toBe(0);
        }
    });
    it('a NaN input behaves exactly like 0', () => {
        expect(out1({ width: NaN })).toEqual(out1({ width: 0 }));
    });
    it('all-zero size: only the bars that depend on thickness keep length (2 × t)', () => {
        const o = out1({ width: 0, length: 0, depth: 0.5 });
        expect(o.concrete).toBe(0);
        expect(o.formwork).toBe(0);
        expect(o['short.DB12']).toBeCloseTo(21 * 5 * 1 * 0.888, 9);   // bar length 0 + 2 × 0.5
        expect(o.excavation).toBeCloseTo(21 * 0.64 * 1.3, 9);          // pit 0.8 × 0.8
    });
    it('negative thickness reduces bar length arithmetically (no clamping, finite)', () => {
        const o = out1({ depth: -0.1 });
        expect(o['short.DB12']).toBeCloseTo(21 * 5 * 0.4 * 0.888, 9); // 0.6 − 0.2
    });
    it('huge counts stay exact enough: 1e6 footings', () => {
        const o = out1({ count: 1e6 });
        expect(o.concrete).toBeCloseTo(216000, 3);
        expect(o.excavation).toBeCloseTo(2_548_000, 3);
    });
});

describe('footing — table size', () => {
    const rowsOf = (n: number): FootingRow[] => Array.from({ length: n }, () => base());
    it('1 row = Excel sample', () => {
        const o = footing.compute({ rows: rowsOf(1) }, ctx);
        expect(o.excavation).toBeCloseTo(53.508, 9);
        expect(o.rows).toBe(1);
    });
    it('11 rows (Excel rows 8–18) scale linearly', () => {
        const o = footing.compute({ rows: rowsOf(11) }, ctx);
        expect(o.excavation).toBeCloseTo(588.588, 9);
        expect(o.concrete).toBeCloseTo(49.896, 9);
        expect(o['rebar.DB12']).toBeCloseTo(11 * 335.664, 9);
        expect(o.rows).toBe(11);
    });
    it('25 rows (more than Excel, D5 unlimited): every row still counts and has its own keys', () => {
        const o = footing.compute({ rows: rowsOf(25) }, ctx);
        expect(o.rows).toBe(25);
        expect(o.excavation).toBeCloseTo(25 * 53.508, 9);
        expect(o.formwork).toBeCloseTo(25 * 30.24, 9);
        expect(o['row.24.width']).toBe(0.6);
        expect(o['row.25.width']).toBeUndefined();
    });
    it('row 12+ is not dropped (sum range is not capped at row 18)', () => {
        const rows = rowsOf(11);
        rows.push(withRow({ name: 'F2', count: 1 }));
        expect(footingTotals(rows).concrete).toBeCloseTo(11 * 4.536 + 0.216, 9);
    });
    it('deleting a row removes exactly its share', () => {
        const rows = [base(), A, withRow({ count: 3 })];
        const all = footing.compute({ rows }, ctx);
        const without = footing.compute({ rows: [rows[0] ?? base(), rows[2] ?? base()] }, ctx);
        expect(diff(all, without, 'concrete')).toBeCloseTo(2, 9);
        expect(diff(all, without, 'rebar.DB20')).toBeCloseTo(44.46, 9);
        expect(without.rows).toBe(2);
    });
    it('row order does not change totals; per-row keys follow the order', () => {
        const a = footing.compute({ rows: [base(), A] }, ctx);
        const b = footing.compute({ rows: [A, base()] }, ctx);
        expect(a.excavation).toBeCloseTo(b.excavation ?? NaN, 9);
        expect(a['rebar.DB12']).toBeCloseTo(b['rebar.DB12'] ?? NaN, 9);
        expect(a['row.1.width']).toBe(1);
        expect(b['row.0.width']).toBe(1);
    });
    it('sample + A: totals are the sum of both rows', () => {
        const o = footing.compute({ rows: [base(), A] }, ctx);
        expect(o.excavation).toBeCloseTo(53.508 + 15.12, 9);
        expect(o.sand).toBeCloseTo(2.5725 + 1.26, 9);
        expect(o['rebar.RB6']).toBeCloseTo(5.328, 9);
        expect(o['rebar.RB9']).toBeCloseTo(50.2992, 9);
    });
});

describe('footing — rebar slot rows (boqSlots)', () => {
    it('no bars: no rows at all, not even tie wire', () => {
        expect(slotRows({ rows: [] })).toEqual([]);
        expect(slotRows({ rows: [withRow({ shortBarCount: 0, longBarCount: 0, ringBarCount: 0 })] })).toEqual([]);
    });
    it('rows follow RB6, RB9, DB12, DB16, DB20 order then tie wire', () => {
        expect(slotRows({ rows: [A] }).map(x => x.key)).toEqual(['RB6', 'DB16', 'DB20', 'tie-wire']);
        const all = withRow({ shortBarSize: 'DB20', longBarSize: 'RB6', ringBarSize: 'DB16', count: 1 });
        expect(slotRows({ rows: [all, withRow({ shortBarSize: 'RB9', longBarSize: 'DB12', ringBarSize: 'RB9' })] })
            .map(x => x.key)).toEqual(['RB6', 'RB9', 'DB12', 'DB16', 'DB20', 'tie-wire']);
    });
    it('slot quantities equal the by-size totals (kg)', () => {
        expect(slotQty({ rows: [A] }, 'RB6')).toBeCloseTo(5.328, 9);
        expect(slotQty({ rows: [A] }, 'DB16')).toBeCloseTo(25.28, 9);
        expect(slotQty({ rows: [A] }, 'DB20')).toBeCloseTo(44.46, 9);
    });
    it('same size in short+long+ring is merged into one row', () => {
        const rows = [withRow({ shortBarSize: 'DB12', longBarSize: 'DB12', ringBarSize: 'DB12' })];
        expect(slotRows({ rows }).map(x => x.key)).toEqual(['DB12', 'tie-wire']);
        expect(slotQty({ rows }, 'DB12')).toBeCloseTo(167.832 * 2 + 100.8 * 0.888, 9);
    });
    it('BOQ rows: waste RB6 6 % / DB16 12 % / DB20 12 %, material 25 on gross, labour 15 on net, tie wire 3 %', () => {
        const r = run([A]);
        const rb6 = item(r, 'footing:rebar:RB6');
        expect(rb6.qty).toBeCloseTo(5.328, 9);
        expect(rb6.grossQty).toBeCloseTo(5.328 * 1.06, 9);
        expect(rb6.matTotal).toBeCloseTo(25 * 5.328 * 1.06, 9);
        expect(rb6.labTotal).toBeCloseTo(15 * 5.328, 9);
        const db16 = item(r, 'footing:rebar:DB16');
        expect(db16.grossQty).toBeCloseTo(25.28 * 1.12, 9);
        expect(item(r, 'footing:rebar:DB20').grossQty).toBeCloseTo(44.46 * 1.12, 9);
        const wire = item(r, 'footing:rebar:tie-wire');
        const gross = 5.328 * 1.06 + 25.28 * 1.12 + 44.46 * 1.12;
        expect(wire.grossQty).toBeCloseTo(0.03 * gross, 9);
        expect(wire.matUnit).toBe(50);
        expect(wire.matTotal).toBeCloseTo(50 * 0.03 * gross, 9);
        expect(wire.labTotal).toBe(0);
    });
    it.each(SIZES)('size %s alone: waste factor and tie wire', (size) => {
        const rows = [withRow({ shortBarSize: size, longBarSize: '', ringBarSize: '' })];   // 189 m
        const kg = 189 * KG[size];
        const r = run(rows);
        expect(item(r, `footing:rebar:${size}`).grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(item(r, 'footing:rebar:tie-wire').grossQty).toBeCloseTo(kg * WASTE[size] * 0.03, 9);
    });
});

describe('footing — BOQ lines (hand-computed money for example A)', () => {
    const r = run([A]);
    it('R38 excavation 15.12 m³ × 125 labour', () => {
        expect(item(r, 'R38').qty).toBeCloseTo(15.12, 9);
        expect(item(r, 'R38').total).toBeCloseTo(1890, 9);
    });
    it('R40 sand 1.26: gross 1.26 × 1.3, material 750 on gross, labour 500 on net', () => {
        expect(item(r, 'R40').grossQty).toBeCloseTo(1.638, 9);
        expect(item(r, 'R40').total).toBeCloseTo(750 * 1.638 + 500 * 1.26, 9);   // 1228.5 + 630
    });
    it('R41 lean 0.504: gross × 1.1', () => {
        expect(item(r, 'R41').grossQty).toBeCloseTo(0.5544, 9);
        expect(item(r, 'R41').total).toBeCloseTo(2100 * 0.5544 + 1000 * 0.504, 9);
    });
    it('R55 formwork 6 + derived ไม้คร่าว 0.6× and ตะปู 0.25×', () => {
        expect(item(r, 'R55').total).toBeCloseTo(6 * 250 + 6 * 150, 9);
        expect(item(r, 'R56').qty).toBeCloseTo(3.6, 9);
        expect(item(r, 'R56').total).toBeCloseTo(3.6 * 350, 9);
        expect(item(r, 'R57').qty).toBeCloseTo(1.5, 9);
        expect(item(r, 'R57').total).toBeCloseTo(75, 9);
    });
    it('R58 concrete 2.0 m³ → 2.2 → CEILING 0.25 = 2.25 m³', () => {
        expect(item(r, 'R58').grossQty).toBeCloseTo(2.25, 9);
        expect(item(r, 'R58').total).toBeCloseTo(2500 * 2.25 + 500 * 2, 9);
    });
    it.each([
        // footing concrete (m³) → expected ordered m³ = MAX(1, CEILING(c × 1.1, 0.25))
        [0.5, 1], [0.9, 1], [0.91, 1.25], [4, 4.5], [5, 5.5], [10, 11], [2.2727, 2.5], [0.001, 1],
    ])('concrete %s m³ is ordered as %s m³ (rounding boundaries; 5 × 1.1 = 5.500000000000001 must stay 5.5)', (c, ordered) => {
        const rows = [withRow({ count: 1, width: 1, length: 1, depth: c, shortBarCount: 0, longBarCount: 0, ringBarCount: 0 })];
        expect(item(run(rows), 'R58').grossQty).toBeCloseTo(ordered, 9);
    });
    it('no footing: concrete is not forced to 1 m³ (D1)', () => {
        expect(item(run([]), 'R58').grossQty).toBe(0);
        expect(item(run([]), 'R58').total).toBe(0);
    });
});

describe('footing — level skipped ("ไม่มีในโครงการนี้")', () => {
    it('every linked BOQ line and the rebar rows go to 0', () => {
        const r = run([A], { journey: { footing: 'skipped' }, boqOverrides: { R58: { qty: 9 }, R38: { qty: 99 } } });
        for (const l of footing.boqLinks) expect(item(r, l.line).qty, l.line).toBe(0);
        for (const k of ['R56', 'R57']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'footing:rebar:DB16')).toBe(false);
        expect(hasItem(r, 'footing:rebar:tie-wire')).toBe(false);
        expect(Object.values(r.calcOutputs.footing ?? {}).every(v => v === 0)).toBe(true);
    });
    it('the sample project with footing skipped loses the footing money only', () => {
        const full = computeProject(createProject());
        const skip = computeProject({ ...createProject(), journey: { footing: 'skipped' } });
        const s6 = (x: ProjectResult) => x.boq.sections.find(s => s.no === 6)?.total ?? NaN;
        expect(s6(skip)).toBeLessThan(s6(full));
        expect(item(skip, 'R35').total).toBe(item(full, 'R35').total);   // piles untouched
    });
});

describe('footing — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: FootingRow[], patch: Partial<Project> = {}) =>
        missingRequirements('footing', { ...createProject('blank'), calculators: { 'footing': { rows: rows } }, ...patch });
    const keys = (rows: FootingRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['count', 'width', 'length', 'depth', 'excavationDepth'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([base()])).toEqual([]);
    });
    it('an empty table asks for at least one item', () => {
        expect(missing([]).map(m => m.label)).toEqual(['เพิ่มฐานรากอย่างน้อย 1 รายการ']);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withRow({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withRow({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withRow({ count: 0, width: 0, length: 0, depth: 0, excavationDepth: 0 });
        const started = withRow({ ...row, width: 1 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withRow({ count: 0, width: 0, length: 0, depth: 0, excavationDepth: 0, shortBarCount: 0, longBarCount: 0, ringBarCount: 0 })])).toEqual(['เพิ่มฐานรากอย่างน้อย 1 รายการ']);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'footing': 'skipped' } })).toEqual([]);
        expect(missing([withRow({ count: 0 })], { journey: { 'footing': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([base(), withRow({ count: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('rows');
        expect(m[0]?.fieldKey).toBe('count');
    });
});
